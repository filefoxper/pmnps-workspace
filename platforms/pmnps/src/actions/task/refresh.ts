import { versions } from '@pmnps/tools';
import { hold } from '@/state';
import { task } from '@/actions/task';
import { equal, groupBy, keyBy, omit, omitBy, orderBy } from '@/libs/polyfill';
import { projectSupport } from '@/support';
import { message } from '@/libs';
import { getPluginState } from '@/plugin';
import { refreshByYarn } from '@/core/yarn';
import { refreshByNpm } from '@/core/npm';
import { refreshByPnpm } from '@/core/pnpm';
import type { ActionMessage } from '@/actions/task/type';
import type { PackageJson, Package, Command } from '@pmnps/tools';

function differ(
  source: Record<string, any> | undefined,
  target: Record<string, any> | undefined
) {
  if (source == null) {
    return target;
  }
  if (target == null) {
    return undefined;
  }
  const te = Object.entries(target).filter(([k]) => !source[k]);
  if (!te.length) {
    return undefined;
  }
  return Object.fromEntries(te);
}

const refreshAfterWorkspaceInstallCommand = 'pmnps refresh -i package,platform';

function addSettingToWorkspace(workspace: Package) {
  const { config } = hold.instance().getState();
  const { refreshAfterInstall } = config ?? {};
  const packageJson = workspace.packageJson;
  const { scripts } = packageJson;
  if (!refreshAfterInstall) {
    if (
      scripts &&
      scripts['postinstall'] === refreshAfterWorkspaceInstallCommand
    ) {
      const nextScripts = omit(scripts, 'postinstall');
      const withoutRefreshPackageJson = {
        ...packageJson,
        scripts: Object.keys(nextScripts).length ? nextScripts : undefined
      };
      task.writePackage({
        paths: null,
        type: 'workspace',
        packageJson: withoutRefreshPackageJson
      });
      return { ...workspace, packageJson: withoutRefreshPackageJson };
    }
    return workspace;
  }
  if (
    scripts &&
    scripts['postinstall'] === refreshAfterWorkspaceInstallCommand
  ) {
    return workspace;
  }
  const newScripts = {
    ...scripts,
    postinstall: refreshAfterWorkspaceInstallCommand
  };
  const newPackageJson = { ...packageJson, scripts: newScripts };
  const newWorkspace = { ...workspace, packageJson: newPackageJson };
  task.writePackage({
    paths: null,
    type: 'workspace',
    packageJson: newPackageJson
  });
  return newWorkspace;
}

function computeShouldRemovePackNames(packs: Package[], cachePacks: Package[]) {
  const packageMap = keyBy(packs, 'path');
  return cachePacks
    .filter(p => packageMap.get(p.path) == null)
    .map(p => p.name);
}

function listPackageDependencies(
  workspacePackageJson: PackageJson,
  packs: Package[]
) {
  const { listPackageDependencies } = hold.instance().getState().config ?? {};
  if (!listPackageDependencies) {
    return workspacePackageJson;
  }
  const packages = packs.filter(p => p.type === 'package');
  return packages.reduce((res, current) => {
    const { dependencies, devDependencies } = res;
    const allDeps = { ...dependencies, ...devDependencies };
    const { name, packageJson } = current;
    if (allDeps[name] || packageJson == null || packageJson.version == null) {
      return res;
    }
    return {
      ...res,
      dependencies: { ...dependencies, [name]: packageJson.version }
    };
  }, workspacePackageJson);
}

function mergeWorkspace(
  workspace: Package,
  packs: Package[],
  cachePacks: Package[]
) {
  if (!packs.length) {
    return workspace;
  }
  const packsMap = keyBy(packs.concat(cachePacks), 'name');
  const excludePackDeps = function excludePackDeps(
    data: Record<string, any> | undefined
  ) {
    if (data == null) {
      return data;
    }
    return omitBy(data, (value, key) => packsMap.has(key));
  };
  const { packageJson } = workspace;
  const result = packs.reduce((result, current) => {
    const { dependencies: deps, devDependencies: devDeps } =
      current.packageJson;
    const workspaceDependencies = {
      ...result.dependencies,
      ...result.devDependencies
    };
    const differDeps = differ(workspaceDependencies, excludePackDeps(deps));
    const differDevDeps = differ(
      workspaceDependencies,
      excludePackDeps(devDeps)
    );
    return {
      ...result,
      dependencies: excludePackDeps(
        differDeps
          ? {
              ...result.dependencies,
              ...differDeps
            }
          : result.dependencies
      ),
      devDependencies: excludePackDeps(
        differDevDeps
          ? {
              ...result.devDependencies,
              ...differDevDeps
            }
          : result.devDependencies
      )
    };
  }, packageJson);
  const nextPackageJson = omitBy(
    listPackageDependencies(result, packs),
    (value, key) => {
      if (!['dependencies', 'devDependencies'].includes(key)) {
        return false;
      }
      return value == null || !Object.keys(value).length;
    }
  ) as PackageJson;
  if (equal(packageJson, nextPackageJson)) {
    return workspace;
  }
  task.writePackage({
    paths: null,
    type: 'workspace',
    packageJson: nextPackageJson
  });
  return { ...workspace, packageJson: nextPackageJson };
}

function mergeDeps(
  deps: Record<string, any> | undefined,
  packageJson: PackageJson
) {
  if (deps == null) {
    return deps;
  }
  const { dependencies = {}, devDependencies = {} } = packageJson;
  const refDeps = { ...dependencies, ...devDependencies };
  const entries = Object.entries(deps)
    .filter(([k, v]) => refDeps[k] !== v)
    .map(([k, v]) => [k, refDeps[k] ?? v]);
  if (!entries.length) {
    return deps;
  }
  const differ = Object.fromEntries(entries);
  return { ...deps, ...differ };
}

function mergePacks(
  packs: Package[],
  cachePacks: Package[],
  workspace: Package
) {
  const packVersionMap = new Map(
    packs.map(p => [p.name, p.packageJson.version])
  );
  const shouldRemovePackNameSet = new Set(
    computeShouldRemovePackNames(packs, cachePacks)
  );
  const updateWorkspacePackVersion = function updateWorkspacePackVersion(
    pjs: PackageJson
  ): { packageJson: PackageJson; hasChanges: boolean } {
    function collectChangeWorkspacePackDeps(
      dep: Record<string, string> | undefined
    ) {
      if (dep == null) {
        return undefined;
      }
      const depKeys = dep ? Object.keys(dep) : [];
      const shouldUpdates = depKeys.filter(k => {
        const range = dep[k];
        const ve = packVersionMap.get(k);
        if (range.startsWith('workspace:')) {
          return ve && `workspace:${ve}` !== range;
        }
        return ve && !versions.satisfies(ve, range);
      });
      if (!shouldUpdates.length) {
        return undefined;
      }
      return Object.fromEntries(
        shouldUpdates.map(k => [
          k,
          dep[k] && dep[k].startsWith('workspace:')
            ? `workspace:^${packVersionMap.get(k)}`
            : `^${packVersionMap.get(k)}`
        ])
      );
    }
    function checkHasRemoves(dep: Record<string, string> | undefined) {
      if (dep == null) {
        return false;
      }
      return Object.keys(dep).some(k => shouldRemovePackNameSet.has(k));
    }
    const { dependencies, devDependencies } = pjs;
    const collectedDep = collectChangeWorkspacePackDeps(dependencies);
    const collectedDevDep = collectChangeWorkspacePackDeps(devDependencies);
    const hasRemoves = checkHasRemoves({ ...dependencies, ...devDependencies });
    if (!collectedDep && !collectedDevDep && !hasRemoves) {
      return { packageJson: pjs, hasChanges: false };
    }
    const nextPjs = {
      ...pjs,
      dependencies: !dependencies
        ? dependencies
        : omitBy({ ...dependencies, ...collectedDep }, (value, key) =>
            shouldRemovePackNameSet.has(key as string)
          ),
      devDependencies: !devDependencies
        ? devDependencies
        : omitBy({ ...devDependencies, ...collectedDevDep }, (value, key) =>
            shouldRemovePackNameSet.has(key as string)
          )
    };
    return {
      packageJson: omitBy(nextPjs, value => value == null) as PackageJson,
      hasChanges: true
    };
  };
  const { packageJson } = workspace;
  packs.forEach(pack => {
    const { packageJson: pjs, type, paths } = pack;
    const { packageJson: pj, hasChanges } = updateWorkspacePackVersion(pjs);
    const { dependencies, devDependencies } = pj;
    if (pj.pmnps?.ownRoot) {
      if (hasChanges) {
        task.writePackage({
          paths: paths,
          packageJson: pj,
          type
        });
      }
      return;
    }
    const nextDeps = mergeDeps(dependencies, packageJson);
    const nextDevDeps = mergeDeps(devDependencies, packageJson);
    if (
      dependencies === nextDeps &&
      devDependencies === nextDevDeps &&
      !hasChanges
    ) {
      return;
    }
    const nextPj = {
      ...pj,
      dependencies: nextDeps,
      devDependencies: nextDevDeps
    };
    task.writePackage({
      paths: paths,
      packageJson: nextPj,
      type
    });
  });
}

function mergeSettings() {
  const { project } = hold.instance().getState();
  const content = project?.project;
  if (content == null) {
    return;
  }
  const { workspace } = content;
  if (!workspace) {
    return;
  }
  addSettingToWorkspace(workspace);
}

function mergeProject() {
  const { project, cacheProject } = hold.instance().getState();
  const content = project?.project;
  if (content == null) {
    return;
  }
  const { workspace, platforms, packages } = content;
  if (!workspace) {
    return;
  }
  const list = (platforms ?? []).concat(packages ?? []).concat(workspace);
  const packOrRoots = list.filter(p => p.type !== 'workspace');
  const packs = packOrRoots.filter(p => !p.packageJson.pmnps?.ownRoot);
  const { packages: cachePackages = [], platforms: cachePlatforms = [] } =
    cacheProject?.project ?? {};
  const cachePacks = [...cachePackages, ...cachePlatforms];
  mergePacks(
    packOrRoots,
    cachePacks,
    mergeWorkspace(workspace, packs, cachePacks)
  );
  mergeSettings();
}

function analyzePackagePaths() {
  const { project } = hold.instance().getState();
  if (project == null) {
    return [];
  }
  const content = project?.project;
  if (content == null) {
    return [];
  }
  return projectSupport.checkProjectLoops(project);
}

export async function refresh(option?: {
  force?: boolean;
  install?: string;
  parameters?: string;
}): Promise<ActionMessage> {
  mergeProject();
  const loops = analyzePackagePaths();
  if (loops.length) {
    const groups = groupBy(loops, d => {
      const s = new Set(d);
      return orderBy([...s], [l => l], ['desc']).join();
    }).values();
    [...groups].forEach(([loopPath]) => {
      message.error(`dependencies loop: ${loopPath.join(' -> ')}`);
    });
    return {
      content: 'Refresh is failed for dependency loops are checked out...',
      type: 'failed'
    };
  }
  const { config } = hold.instance().getState();
  const { core = 'npm' } = config ?? {};
  if (core === 'yarn' || core === 'yarn2') {
    return refreshByYarn(option);
  }
  if (core === 'npm') {
    return refreshByNpm(option);
  }
  if (core === 'pnpm') {
    return refreshByPnpm(option);
  }
  return {
    content: `The pkg manager "${core}" is not support by pmnps currently.`,
    type: 'failed'
  };
}

export async function refreshProject(option?: {
  force?: boolean;
  install?: string;
  parameters?: string;
}): Promise<ActionMessage> {
  const pluginState = getPluginState();
  async function runCommand(
    cmds: Command[],
    result: ActionMessage[]
  ): Promise<ActionMessage[]> {
    const [cmd, ...rest] = cmds;
    if (cmd == null) {
      return result;
    }
    const re = await cmd.action(
      { ...pluginState, required: cmd.required },
      undefined
    );
    const nextResult = [...result, re];
    if (!rest.length) {
      return nextResult;
    }
    return runCommand(rest, nextResult);
  }
  const commands = hold.instance().getCommands();
  const refreshes = commands.filter(
    c => c.name === 'refresh' || c.name == null
  );
  const res = await refresh(option);
  if (res.type === 'success') {
    const subRes = await runCommand(refreshes, []);
    return { ...res, children: subRes };
  }
  return res;
}
