import jsyaml from 'js-yaml';
import { equal, keyBy, omit, orderBy, partition } from '@/libs/polyfill';
import { hold } from '@/state';
import { task } from '@/actions/task';
import { SystemCommands } from '@/cmds';
import { path } from '@/libs';
import { DEFAULT_REGISTRY } from '@/constants';
import type { ActionMessage } from '@/actions/task/type';
import type { Package } from '@pmnps/tools';

function refreshWorkspace() {
  const { project, config, dynamicState } = hold.instance().getState();
  const {
    workspace,
    platforms = [],
    scopes = [],
    customized
  } = project?.project ?? {};
  const { projectType } = config ?? {};
  if (workspace == null) {
    return;
  }
  const { name } = workspace;
  const { payload } = (dynamicState ?? {})[name];
  const pnpmWorkspace = payload?.pnpmWorkspace;
  if (projectType !== 'monorepo') {
    if (pnpmWorkspace != null) {
      task.remove(path.join(workspace.path, 'pnpm-workspace.yaml'));
    }
    return;
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
    'platforms/*'
  ]);
  const workspaces = orderBy([...workspaceSet], [a => a], ['desc']);
  if (
    workspaces.join() ===
    orderBy(pnpmWorkspace?.packages ?? [], [a => a], ['desc']).join()
  ) {
    return;
  }
  task.write(
    workspace.path,
    'pnpm-workspace.yaml',
    jsyaml.dump({ ...pnpmWorkspace, packages: workspaces })
  );
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

function computeShouldRemovePackNames(packs: Package[], cachePacks: Package[]) {
  const packageMap = keyBy(packs, 'path');
  return cachePacks
    .filter(p => packageMap.get(p.path) == null)
    .map(p => p.name);
}

function refreshNpmrcByPackage(p: Package) {
  if (p.type !== 'workspace') {
    task.remove(path.join(p.path, '.npmrc'));
    return;
  }
  const { registry = DEFAULT_REGISTRY } =
    hold.instance().getState().config ?? {};
  const dynamicState = hold.instance().getState().dynamicState ?? {};
  const data = dynamicState[p.name];
  if (!data) {
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

function cleanRemovedPacks() {
  const { project, cacheProject } = hold.instance().getState();
  const {
    packages: cachePackages = [],
    platforms: cachePlatforms = [],
    customized: cacheForks = []
  } = cacheProject?.project ?? {};
  const cachePacks = [...cachePackages, ...cacheForks, ...cachePlatforms];
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

function refreshChanges(changes: Package[]) {
  changes.forEach(p => {
    task.writePackage(p);
  });
}

function linkAdditions(changes: Package[]) {
  const { cacheProject, project } = hold.instance().getState();
  const cacheMap = cacheProject?.packageMap ?? {};
  const packages = project?.project?.packages || [];
  const packageNames = packages.map(n => n.name);
  const packageMap = new Map(packages.map(p => [p.name, p] as const));
  changes.forEach(pack => {
    const cachePack = cacheMap[pack.path];
    const cachePackDeps = {
      ...cachePack.packageJson.dependencies,
      ...cachePack.packageJson.devDependencies
    };
    const packDeps = {
      ...pack.packageJson.dependencies,
      ...pack.packageJson.devDependencies
    };
    const newDepKeys = Object.keys(packDeps).filter(k => !cachePackDeps[k]);
    const withoutWorkspaceDepPackDeps = omit(packDeps, ...packageNames);
    const withoutWorkspaceDepCachePackDeps = omit(
      cachePackDeps,
      ...packageNames
    );
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
    }
  });
}

export async function refreshByPnpm(option?: {
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
  refreshChanges(changes);
  const [changeRoots, otherChanges] = partition(
    changes,
    p => p.type === 'workspace' || !!p.packageJson.pmnps?.ownRoot
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
  linkAdditions(otherChanges);
  return { content: 'Refresh success...', type: 'success' };
}
