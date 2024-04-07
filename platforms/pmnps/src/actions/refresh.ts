import { hold } from '@/state';
import { task } from '@/actions/task';
import { SystemCommands } from '@/constants';
import {
  equal,
  groupBy,
  keyBy,
  omitBy,
  orderBy,
  partition
} from '@/libs/polyfill';
import { projectSupport } from '@/support';
import { message, path } from '@/libs';
import type { ActionMessage } from '@/actions/task/type';
import type { Package, PackageJson } from '@/types';

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

function addWorkspacePackages(json: PackageJson, packs: Package[]) {
  const { dependencies } = json;
  const entries = packs
    .filter(p => p.type === 'package')
    .map(p => {
      const { name, version } = p.packageJson;
      return [name ?? '', version ?? ''] as const;
    });
  const additions = Object.fromEntries(entries);
  return { ...json, dependencies: { ...dependencies, ...additions } };
}

function mergeWorkspace(workspace: Package, packs: Package[]) {
  if (!packs.length) {
    return workspace;
  }
  const packsMap = keyBy(packs, 'name');
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
  const withWorkspacePackages = addWorkspacePackages(result, packs);
  const nextPackageJson = omitBy(withWorkspacePackages, (value, key) => {
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

function mergePacks(packs: Package[], workspace: Package) {
  const { packageJson } = workspace;
  packs.forEach(pack => {
    const { packageJson: pj, type, paths } = pack;
    if (pj.pmnps?.ownRoot) {
      return;
    }
    const { dependencies, devDependencies } = pj;
    const nextDeps = mergeDeps(dependencies, packageJson);
    const nextDevDeps = mergeDeps(devDependencies, packageJson);
    if (dependencies === nextDeps && devDependencies === nextDevDeps) {
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

function mergeProject() {
  const { project } = hold.instance().getState();
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
  mergePacks(packs, mergeWorkspace(workspace, packs));
}

function analyzePackagePaths() {
  const { project, config } = hold.instance().getState();
  if (project == null) {
    return [];
  }
  const content = project?.project;
  if (content == null || !config || config.usePerformanceFirst) {
    return [];
  }
  return projectSupport.checkProjectLoops(project);
}

function extractAdditionPackages() {
  const { project, cacheProject } = hold.instance().getState();
  const packages = project?.project?.packages ?? [];
  const cachePackages = cacheProject?.project?.packages ?? [];
  const cachePackageNameSet = new Set(cachePackages.map(p => p.name));
  return packages.map(p => p.name).filter(n => !cachePackageNameSet.has(n));
}

function refreshWorkspace() {
  const { scopes = [], workspace } =
    hold.instance().getState().project?.project ?? {};
  const workspacePackageJson = workspace?.packageJson;
  const scopeWorkspaces = scopes.map(s => `packages/${s.name}/*`);
  const workspaces = ['packages/*', ...scopeWorkspaces];
  if (
    orderBy(workspaces, [a => a], ['desc']).join() ===
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

export async function refreshAction(): Promise<ActionMessage> {
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
  refreshWorkspace();
  const changes = hold.instance().diffDepsPackages();
  const changeRoots = changes.filter(
    p => p.type === 'workspace' || p.packageJson.pmnps?.ownRoot
  );
  const [workRoots, ownRoots] = partition(
    changeRoots,
    p => p.type === 'workspace'
  );
  workRoots.forEach(p => {
    task.execute(SystemCommands.install, p.path, 'install workspace');
  });
  ownRoots.forEach(p => {
    task.execute(SystemCommands.install, p.path, `install own root: ${p.name}`);
  });
  if (workRoots.length) {
    return { content: 'Refresh success...', type: 'success' };
  }
  const additionPackages = extractAdditionPackages();
  if (additionPackages.length) {
    task.execute([...SystemCommands.install, ...additionPackages], path.cwd());
  }
  return { content: 'Refresh success...', type: 'success' };
}
