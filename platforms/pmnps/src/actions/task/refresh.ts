import { versions } from '@pmnps/tools';
import { hold } from '@/state';
import { task } from '@/actions/task';
import { SystemCommands } from '@/cmds';
import {
  equal,
  groupBy,
  keyBy,
  omit,
  omitBy,
  orderBy,
  partition
} from '@/libs/polyfill';
import { projectSupport } from '@/support';
import { message, path } from '@/libs';
import { getPluginState } from '@/plugin';
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
  const { useRefreshAfterInstall } = config ?? {};
  const packageJson = workspace.packageJson;
  const { scripts } = packageJson;
  if (!useRefreshAfterInstall) {
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
  const nextPackageJson = omitBy(result, (value, key) => {
    if (!['dependencies', 'devDependencies'].includes(key)) {
      return false;
    }
    return value == null || !Object.keys(value).length;
  }) as PackageJson;
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
        return ve && !versions.satisfies(ve, range);
      });
      if (!shouldUpdates.length) {
        return undefined;
      }
      return Object.fromEntries(
        shouldUpdates.map(k => [k, packVersionMap.get(k)])
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

function extractAdditionPackages() {
  const { project, cacheProject } = hold.instance().getState();
  const packages = project?.project?.packages ?? [];
  const cachePackages = cacheProject?.project?.packages ?? [];
  const cachePackageNameSet = new Set(cachePackages.map(p => p.name));
  return packages.filter(n => !cachePackageNameSet.has(n.name));
}

function refreshWorkspace() {
  const { project, config } = hold.instance().getState();
  const { scopes = [], workspace, platforms = [] } = project?.project ?? {};
  const { projectType, core = 'npm' } = config ?? {};
  const workspacePackageJson = workspace?.packageJson;
  if (workspacePackageJson == null) {
    return;
  }
  if (projectType !== 'monorepo') {
    if (workspacePackageJson.workspaces != null) {
      task.writePackage({
        paths: null,
        type: 'workspace',
        packageJson: omit(workspacePackageJson, 'workspaces') as PackageJson
      });
    }
    return;
  }
  function buildPlatformWorkspaces() {
    return platforms
      .filter(p => {
        const or = p.packageJson?.pmnps?.ownRoot;
        return !or || or === 'flexible';
      })
      .map(p => `platforms/${p.name}`);
  }
  const scopeWorkspaces = scopes.map(s => `packages/${s.name}/*`);
  const workspaceSet = new Set([
    'packages/*',
    ...scopeWorkspaces,
    ...buildPlatformWorkspaces()
  ]);
  const workspaces = orderBy([...workspaceSet], [a => a], ['desc']);
  if (
    workspaces.join() ===
    orderBy(workspacePackageJson?.workspaces ?? [], [a => a], ['desc']).join()
  ) {
    return;
  }
  task.writePackage({
    paths: null,
    type: 'workspace',
    packageJson: { ...workspacePackageJson, workspaces, private: true }
  });
}

function rewriteRegistry(content: string | null, registry: string | undefined) {
  if (!registry && !content) {
    return content;
  }
  if (!registry) {
    return (content ?? '').replace(/registry\s*=\s*(.+)/, '');
  }
  if (!content) {
    return `registry=${registry}`;
  }
  if (/registry=.*/.test(content)) {
    return content.replace(/registry\s*=\s*(.+)/, `registry=${registry}`);
  }
  return (content ?? '').concat('\n' + `registry=${registry}`);
}

function refreshChangePackages(changes: Package[]) {
  const { registry } = hold.instance().getState().config ?? {};
  const { scopes = [] } = hold.instance().getState().project?.project ?? {};
  const scopeWorkspaces = scopes.map(s => `../../packages/${s.name}/*`);
  const workspaces = ['../../packages/*', ...scopeWorkspaces];
  const packs = changes.filter(p => p.type !== 'workspace');
  const [ownRoots, parts] = partition(
    packs,
    p =>
      p.packageJson.pmnps?.ownRoot === true ||
      p.packageJson.pmnps?.ownRoot === 'independent'
  );
  parts.forEach(p => {
    if (!p.packageJson.private) {
      return;
    }
    task.write(p.path, '.npmrc', content =>
      rewriteRegistry(content, 'https://invalid.npm.com')
    );
    if (!p.packageJson.workspaces) {
      return;
    }
    task.writePackage({
      ...p,
      packageJson: omit(p.packageJson, 'workspaces') as PackageJson
    });
  });

  ownRoots.forEach(p => {
    if (!p.packageJson.private) {
      return;
    }
    task.write(p.path, '.npmrc', content => rewriteRegistry(content, registry));
    const pj = p.packageJson;
    if (pj.workspaces && pj.workspaces.join(';') === workspaces.join(';')) {
      return;
    }
    task.writePackage({ ...p, packageJson: { ...pj, workspaces } });
  });
}

function installOwnRootPackage(
  pack: Package,
  opt: {
    hasLockFile?: boolean;
    hasNodeModules?: boolean;
    isPoint?: boolean;
    parameters?: string;
  },
  force?: boolean
) {
  const { cacheProject, project } = hold.instance().getState();
  const cacheMap = cacheProject?.packageMap ?? {};
  const cachePack = cacheMap[pack.path];
  if (!cachePack || !project || force) {
    task.execute(
      SystemCommands.install(opt),
      pack.path,
      `install own root: ${pack.name}`
    );
    return;
  }
  const packages = project?.project?.packages || [];
  const packageMap = new Map(packages.map(p => [p.name, p] as const));
  const cachePackDeps = {
    ...cachePack.packageJson.dependencies,
    ...cachePack.packageJson.devDependencies
  };
  const packDeps = {
    ...pack.packageJson.dependencies,
    ...pack.packageJson.devDependencies
  };
  const packageNames = packages.map(n => n.name);
  const newDepKeys = Object.keys(packDeps).filter(k => !cachePackDeps[k]);
  const withoutWorkspaceDepPackDeps = omit(packDeps, ...packageNames);
  const withoutWorkspaceDepCachePackDeps = omit(cachePackDeps, ...packageNames);
  const allInWorkspaces = newDepKeys.every(k => packageMap.has(k));
  const isBasicDepEqual = equal(
    withoutWorkspaceDepPackDeps,
    withoutWorkspaceDepCachePackDeps
  );
  message.debug('add', newDepKeys, allInWorkspaces);
  if (allInWorkspaces && isBasicDepEqual) {
    const additionPackages = newDepKeys
      .map(k => packageMap.get(k))
      .filter((p): p is Package => !!p);
    additionPackages.forEach(p => {
      task.execute(
        SystemCommands.link(p, pack),
        path.cwd(),
        `link ${p.name} to own root: "${pack.name}"`
      );
    });
    return;
  }
  if (isBasicDepEqual) {
    return;
  }
  task.execute(
    SystemCommands.install(opt),
    pack.path,
    `install own root: ${pack.name}`
  );
}

function cleanRemovedPacks() {
  const { project, cacheProject } = hold.instance().getState();
  const { packages: cachePackages = [], platforms: cachePlatforms = [] } =
    cacheProject?.project ?? {};
  const cachePacks = [...cachePackages, ...cachePlatforms];
  if (project == null || project.project == null || !cachePacks.length) {
    return;
  }
  const { workspace, packages = [], platforms = [] } = project.project;
  const allPacks = [workspace, ...packages, ...platforms].filter(
    (p): p is Package => !!p
  );
  const shouldRemovePackNames = computeShouldRemovePackNames(
    allPacks,
    cachePacks
  );
  const nodeModulesOwners = allPacks.filter(p => {
    const { type, packageJson } = p;
    const ownRoot = packageJson.pmnps?.ownRoot;
    return (
      type === 'workspace' || ownRoot === true || ownRoot === 'independent'
    );
  });
  const shouldRemovePathnames = nodeModulesOwners.flatMap(p => {
    const packPath = p.path;
    return shouldRemovePackNames.map(name => {
      const nameParts = name.split('/');
      return path.join(packPath, 'node_modules', ...nameParts);
    });
  });
  shouldRemovePathnames.forEach(pathname => {
    task.remove(pathname);
  });
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
  const { dynamicState = {}, project } = hold.instance().getState();
  const { workspace } = project?.project ?? {};
  const { force, install, parameters } = option ?? {};
  const installRange = install
    ? (install.split(',').filter(d => {
        return d.trim();
      }) as ('package' | 'platform' | 'workspace')[])
    : undefined;
  cleanRemovedPacks();
  refreshWorkspace();
  const { packs: changes } = hold.instance().diffDepsPackages(force);
  refreshChangePackages(changes);
  const changeRoots = changes.filter(
    p => p.type === 'workspace' || p.packageJson.pmnps?.ownRoot
  );
  const [workspaceRoots, ownRoots] = partition(
    changeRoots,
    p => p.type === 'workspace'
  );
  const [independentOwnRoots, flexibleOwnRoots] = partition(
    ownRoots,
    p =>
      p.packageJson.pmnps?.ownRoot === true ||
      p.packageJson.pmnps?.ownRoot === 'independent'
  );
  const workRoots = (function recomputeWorkRoots() {
    if (workspaceRoots.length) {
      return workspaceRoots;
    }
    if (flexibleOwnRoots.length && workspace) {
      return [workspace];
    }
    return [];
  })();
  if (!installRange || installRange.includes('workspace')) {
    workRoots.forEach(p => {
      const ds = dynamicState[p.name];
      task.execute(
        SystemCommands.install({ ...ds, isPoint: !!installRange, parameters }),
        p.path,
        'install workspace'
      );
    });
  }
  const [ownRootPackages, ownRootPlatforms] = partition(
    independentOwnRoots,
    p => p.type === 'package'
  );
  if (!installRange || installRange.includes('package')) {
    ownRootPackages.forEach(p => {
      const ds = dynamicState[p.name];
      installOwnRootPackage(
        p,
        { ...ds, isPoint: !!installRange, parameters },
        force
      );
    });
  }
  if (!installRange || installRange.includes('platform')) {
    ownRootPlatforms.forEach(p => {
      const ds = dynamicState[p.name];
      installOwnRootPackage(
        p,
        { ...ds, isPoint: !!installRange, parameters },
        force
      );
    });
  }
  if (workRoots.length) {
    return { content: 'Refresh success...', type: 'success' };
  }
  const additionPackages = extractAdditionPackages();
  if (additionPackages.length && workspace) {
    additionPackages.forEach(p => {
      task.execute(
        SystemCommands.link(p, workspace),
        path.cwd(),
        `link ${p.name} to workspace`
      );
    });
  }
  return { content: 'Refresh success...', type: 'success' };
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
