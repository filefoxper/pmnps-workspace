import { type PackageLockInfo, versions } from '@pmnps/tools';
import { packageLock2 } from '@pmnps/lock-resolver';
import { hold } from '@/state';
import { task } from '@/actions/task';
import { equal, groupBy, keyBy, omit, omitBy, orderBy } from '@/libs/polyfill';
import { getLockBakName, projectSupport } from '@/support';
import { message } from '@/libs';
import { getPluginState } from '@/plugin';
import { refreshByYarn } from '@/core/yarn';
import { refreshByNpm } from '@/core/npm';
import { refreshByPnpm } from '@/core/pnpm';
import { SystemCommands } from '@/cmds';
import type { ActionMessage } from '@/actions/task/type';
import type {
  PackageJson,
  Package,
  Command,
  LockResolver,
  LockResolverState,
  LockBak
} from '@pmnps/tools';

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
  const { listPackageDependencies, core } =
    hold.instance().getState().config ?? {};
  if (!listPackageDependencies) {
    return workspacePackageJson;
  }
  const packages = packs.filter(p => p.type === 'package');
  return packages.reduce((res, current) => {
    const { dependencies, devDependencies, optionalDependencies } = res;
    const allDeps = {
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies
    };
    const { name, packageJson } = current;
    if (allDeps[name] || packageJson == null || packageJson.version == null) {
      return res;
    }
    return {
      ...res,
      dependencies: {
        ...dependencies,
        [name]: core === 'pnpm' ? 'workspace:*' : packageJson.version
      }
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
    const {
      dependencies: deps,
      devDependencies: devDeps,
      optionalDependencies: optDeps
    } = current.packageJson;
    const workspaceDependencies = {
      ...result.dependencies,
      ...result.devDependencies,
      ...result.optionalDependencies
    };
    const differDeps = differ(workspaceDependencies, excludePackDeps(deps));
    const differDevDeps = differ(
      workspaceDependencies,
      excludePackDeps(devDeps)
    );
    const differOptDeps = differ(
      workspaceDependencies,
      excludePackDeps(optDeps)
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
      ),
      optionalDependencies: excludePackDeps(
        differOptDeps
          ? { ...result.optionalDependencies, ...differOptDeps }
          : result.optionalDependencies
      )
    };
  }, packageJson);
  const nextPackageJson = omitBy(
    listPackageDependencies(result, packs),
    (value, key) => {
      if (
        !['dependencies', 'devDependencies', 'optionalDependencies'].includes(
          key
        )
      ) {
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
  const {
    dependencies = {},
    devDependencies = {},
    optionalDependencies = {}
  } = packageJson;
  const refDeps = {
    ...dependencies,
    ...devDependencies,
    ...optionalDependencies
  };
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
  const { core } = hold.instance().getState().config ?? {};
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
        if (core === 'pnpm' && packVersionMap.has(k)) {
          return range !== 'workspace:*';
        }
        const ve = packVersionMap.get(k);
        return ve && !versions.satisfies(ve, range);
      });
      if (!shouldUpdates.length) {
        return undefined;
      }
      return Object.fromEntries(
        shouldUpdates.map(k => [
          k,
          core === 'pnpm' && packVersionMap.has(k)
            ? 'workspace:*'
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
    const { dependencies, devDependencies, optionalDependencies } = pjs;
    const collectedDep = collectChangeWorkspacePackDeps(dependencies);
    const collectedDevDep = collectChangeWorkspacePackDeps(devDependencies);
    const collectedOptDep =
      collectChangeWorkspacePackDeps(optionalDependencies);
    const hasRemoves = checkHasRemoves({
      ...dependencies,
      ...devDependencies,
      ...optionalDependencies
    });
    if (!collectedDep && !collectedDevDep && !collectedOptDep && !hasRemoves) {
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
          ),
      optionalDependencies: !optionalDependencies
        ? optionalDependencies
        : omitBy(
            { ...optionalDependencies, ...collectedOptDep },
            (value, key) => shouldRemovePackNameSet.has(key as string)
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
    const { dependencies, devDependencies, optionalDependencies } = pj;
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
    const nextOptDeps = mergeDeps(optionalDependencies, packageJson);
    if (
      dependencies === nextDeps &&
      devDependencies === nextDevDeps &&
      optionalDependencies === nextOptDeps &&
      !hasChanges
    ) {
      return;
    }
    const nextPj = {
      ...pj,
      dependencies: nextDeps,
      devDependencies: nextDevDeps,
      optionalDependencies: nextOptDeps
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

function refreshLock(lockResolvers: LockResolver[], parameters?: string) {
  const { dynamicState = {}, project, config } = hold.instance().getState();
  const commands = hold.instance().getCommands();
  const commandLockResolvers = commands
    .map(c => c.lockResolver)
    .filter((r): r is LockResolver => !!(r && typeof r === 'object'));
  const { packages = [], platforms = [], workspace } = project?.project ?? {};
  if (project == null || workspace == null) {
    return;
  }
  const { core = 'npm', usePerformanceFirst } = config ?? {};
  if (usePerformanceFirst || core !== 'npm') {
    return;
  }

  const allResolvers = [
    packageLock2,
    ...commandLockResolvers,
    ...lockResolvers
  ].filter(r => r.core === 'npm' && r.lockfileVersion === 2);
  const lockResolverFn = function lockResolverFn(
    lockContent: string,
    info: LockResolverState
  ): [string, null | LockBak[]] {
    const resolverFns = allResolvers.map(r => r.resolver);
    const [data, baks] = resolverFns.reduce(
      (r, currentValue) => {
        const [content, changed] = r;
        const [res, change] = currentValue(content, info);
        const currentBak =
          change === false ? null : change === true ? [] : [change];
        return [
          res,
          changed ? [...changed, ...(currentBak || [])] : currentBak
        ] as [string, null | LockBak[]];
      },
      [lockContent, null] as [string, null | LockBak[]]
    );
    return [data, baks];
  };
  const locks = Object.entries(dynamicState)
    .map(([name, value]): { name: string } & PackageLockInfo => ({
      name,
      ...value
    }))
    .filter(d => d.hasLockFile);
  const packs = [...packages, ...platforms, workspace];
  const packMap = new Map(packs.map(p => [p.name, p]));
  locks.forEach(lock => {
    const { name, lockContent, hasLockFile, lockFileName } = lock;
    if (lockContent == null || !hasLockFile) {
      return;
    }
    const current = packMap.get(name);
    if (current == null) {
      return;
    }
    const { path: pathname, type, packageJson } = current;
    const ds = dynamicState[current.name];
    const [res, baks] = lockResolverFn(lockContent, {
      project,
      current,
      lockBak: ds.payload?.lockBak
    });
    if (res == null || pathname == null || !baks) {
      return;
    }
    task.write(pathname, lockFileName, res);
    if (baks.length) {
      task.write(
        pathname,
        getLockBakName(core),
        baks.reduce((r, c) => {
          return { ...r, ...c };
        }, {} as LockBak)
      );
    }
    if (
      type === 'workspace' ||
      packageJson.pmnps?.ownRoot === true ||
      packageJson.pmnps?.ownRoot === 'independent'
    ) {
      task.execute(
        SystemCommands.install({ ...ds, isPoint: false, parameters }),
        pathname,
        type === 'workspace'
          ? 'install workspace'
          : `install own root: ${current.name}`
      );
    }
  });
}

export async function refresh(option?: {
  force?: boolean;
  install?: string;
  parameters?: string;
  name?: string;
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
  name?: string;
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
    const paddingLockResolvers = subRes
      .map(r => r.requireRefresh)
      .filter((r): r is LockResolver => !!(r && typeof r === 'object'));
    refreshLock(paddingLockResolvers, option?.parameters);
    return { ...res, children: subRes };
  }
  return res;
}
