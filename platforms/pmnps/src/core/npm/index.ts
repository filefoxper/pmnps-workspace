import { equal, keyBy, omit, orderBy, partition } from '@/libs/polyfill';
import { hold } from '@/state';
import { task } from '@/actions/task';
import { SystemCommands } from '@/cmds';
import { message, path } from '@/libs';
import { DEFAULT_REGISTRY, INVALID_REGISTRY } from '@/constants';
import type { ActionMessage } from '@/actions/task/type';
import type { Package, PackageJson } from '@pmnps/tools';

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

function extractAdditionPackages() {
  const { project, cacheProject } = hold.instance().getState();
  const packages = project?.project?.packages ?? [];
  const cachePackages = cacheProject?.project?.packages ?? [];
  const cachePackageNameSet = new Set(cachePackages.map(p => p.name));
  return packages.filter(n => !cachePackageNameSet.has(n.name));
}

function refreshWorkspace() {
  const { project, config } = hold.instance().getState();
  const {
    scopes = [],
    workspace,
    customized,
    platforms = []
  } = project?.project ?? {};
  const { projectType } = config ?? {};
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
  const customizedWorkspaces = (function computeCustomizedWorkspaces() {
    if (!customized || !customized.length) {
      return [];
    }
    const set = new Set(
      customized.map(c => c.category).filter((c): c is string => !!c)
    );
    return [...set].map(s => `${s}/*`);
  })();
  const workspaceSet = new Set([
    'packages/*',
    ...customizedWorkspaces,
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
    packageJson: { ...workspacePackageJson, workspaces }
  });
}

function refreshChangePackages(changes: Package[]) {
  const { scopes = [], customized } =
    hold.instance().getState().project?.project ?? {};
  const scopeWorkspaces = scopes.map(s => `../../packages/${s.name}/*`);
  const customizedWorkspaces = (function computeCustomizedWorkspaces() {
    if (!customized || !customized.length) {
      return [];
    }
    const set = new Set(
      customized.map(c => c.category).filter((c): c is string => !!c)
    );
    return [...set].map(s => `../../${s}/*`);
  })();
  const workspaces = [
    '../../packages/*',
    ...customizedWorkspaces,
    ...scopeWorkspaces
  ];
  const packs = changes.filter(p => p.type !== 'workspace');
  const workspaceChanges = changes.filter(p => p.type === 'workspace');
  const [ownRoots, parts] = partition(
    packs,
    p =>
      p.packageJson.pmnps?.ownRoot === true ||
      p.packageJson.pmnps?.ownRoot === 'independent'
  );
  parts.forEach(p => {
    task.writePackage({
      ...p,
      packageJson: omit(p.packageJson, 'workspaces') as PackageJson
    });
  });

  ownRoots.forEach(p => {
    const pj = p.packageJson;
    task.writePackage({ ...p, packageJson: { ...pj, workspaces } });
  });

  workspaceChanges.forEach(p => {
    task.writePackage(p);
  });
}

function computeShouldRemovePackNames(packs: Package[], cachePacks: Package[]) {
  const packageMap = keyBy(packs, 'path');
  return cachePacks
    .filter(p => packageMap.get(p.path) == null)
    .map(p => p.name);
}

function cleanRemovedPacks() {
  const { project, cacheProject } = hold.instance().getState();
  const {
    packages: cachePackages = [],
    platforms: cachePlatforms = [],
    customized: cacheCustomized = []
  } = cacheProject?.project ?? {};
  const cachePacks = [...cachePackages, ...cacheCustomized, ...cachePlatforms];
  if (project == null || project.project == null || !cachePacks.length) {
    return;
  }
  const {
    workspace,
    packages = [],
    platforms = [],
    customized = []
  } = project.project;
  const allPacks = [workspace, ...packages, ...customized, ...platforms].filter(
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

function refreshNpmrcByPackage(p: Package) {
  const dynamicState = hold.instance().getState().dynamicState ?? {};
  const { registry = DEFAULT_REGISTRY, forbiddenWorkspacePackageInstall } =
    hold.instance().getState().config ?? {};
  const data = dynamicState[p.name];
  if (!data) {
    return;
  }
  if (
    p.type !== 'workspace' &&
    p.packageJson.pmnps?.ownRoot != true &&
    p.packageJson.pmnps?.ownRoot != 'independent'
  ) {
    if (!forbiddenWorkspacePackageInstall) {
      task.remove(path.join(p.path, '.npmrc'));
      return;
    }
    if (data.npmrc !== `registry=${INVALID_REGISTRY}`) {
      task.write(p.path, '.npmrc', `registry=${INVALID_REGISTRY}`);
    }
    return;
  }
  const { npmrc } = data;
  const contents = (npmrc || '').split('\n');
  const contentSet = new Set(
    [...contents, `registry=${registry}`].filter(r => r.trim())
  );
  const content = [...contentSet].join('\n');
  if (content === npmrc) {
    return;
  }
  task.write(p.path, '.npmrc', content);
}

function refreshNpmrcs() {
  const { project } = hold.instance().getState();
  const { workspace, packages = [], platforms = [] } = project?.project ?? {};
  if (workspace == null) {
    return;
  }
  [workspace, ...packages, ...platforms].forEach(p => refreshNpmrcByPackage(p));
}

export async function refreshByNpm(option?: {
  force?: boolean;
  install?: string;
  parameters?: string;
}): Promise<ActionMessage> {
  const { dynamicState = {}, project } = hold.instance().getState();
  const { workspace } = project?.project ?? {};
  const { force, install, parameters } = option ?? {};
  const installRange = install
    ? (install.split(',').filter(d => {
        return d.trim();
      }) as ('package' | 'platform' | 'workspace')[])
    : undefined;
  refreshNpmrcs();
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
