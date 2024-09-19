import { file, path } from '@/libs';
import { equal, keyBy, mapValues, omit, omitBy } from '@/libs/polyfill';
import type { PackageItem, PackageWithDynamicState } from '@/support/type';
import type {
  PackageType,
  Project,
  Package,
  PackageJson,
  Scope,
  ProjectType,
  Config
} from '@pmnps/tools';
import type { ProjectSerial } from '@/types';

export const getLockBakName = function getLockBakName(core: Config['core']) {
  if (core === 'yarn' || core === 'yarn2') {
    return 'yarn-lock-bak.json';
  }
  if (core === 'pnpm') {
    return 'pnpm-lock-bak.json';
  }
  return 'package-lock-bak.json';
};

export function getLockName(core: Config['core']) {
  if (core === 'yarn' || core === 'yarn2') {
    return 'yarn.lock';
  }
  if (core === 'pnpm') {
    return 'pnpm-lock.yaml';
  }
  return 'package-lock.json';
}

async function collectPackages(
  filePath: string,
  core: Config['core'],
  spaceSet: Set<string>,
  performanceFirst: boolean | undefined,
  state: {
    type: PackageType;
    category: string | null;
    level: number;
    dirnames: string[];
  } = {
    type: 'workspace',
    category: null,
    level: 0,
    dirnames: []
  }
) {
  const lockFileName = getLockName(core);
  if (state.level >= 4) {
    return [];
  }
  const isDir = await file.isDirectory(filePath);
  if (!isDir) {
    return [];
  }
  const children = await file.readdir(filePath);
  const packageJsonFile = children.find(
    c => c.trim().toLocaleLowerCase() === 'package.json'
  );
  const hasLockFile = children.some(
    c => c.trim().toLocaleLowerCase() === lockFileName
  );
  const hasNodeModules = children.some(
    c => c.trim().toLocaleLowerCase() === 'node_modules'
  );
  if (packageJsonFile && state.type !== 'workspace') {
    const [packageJson, lockContent, pnpmWorkspace, npmrc, lockBak] =
      await Promise.all([
        file.readJson<PackageJson>(path.join(filePath, packageJsonFile)),
        performanceFirst
          ? Promise.resolve('')
          : file.readFile(path.join(filePath, lockFileName)),
        lockFileName.endsWith('.yaml')
          ? file.readYaml<{ packages: string[] }>(
              path.join(filePath, 'pnpm-workspace.yaml')
            )
          : Promise.resolve(undefined),
        file.readFile(path.join(filePath, '.npmrc')),
        file.readJson(path.join(filePath, getLockBakName(core)))
      ]);
    if (!packageJson) {
      return [];
    }
    const paths = state.dirnames;
    const pack: PackageWithDynamicState = {
      path: filePath,
      name: packageJson.name ?? '',
      category: state.category,
      paths,
      packageJson,
      packageJsonFileName: packageJsonFile,
      lockContent,
      payload: { pnpmWorkspace, lockBak },
      lockFileName,
      hasLockFile,
      hasNodeModules,
      npmrc,
      type: state.type
    };
    return [pack];
  }
  const promises = children
    .map(c => {
      const currentName = c.trim();
      const packageType = (function computeType() {
        if (state.type !== 'workspace') {
          return state.type;
        }
        if (currentName === 'packages') {
          return 'package';
        }
        if (currentName === 'platforms') {
          return 'platform';
        }
        if (spaceSet.has(currentName)) {
          return 'customized';
        }
        return state.type;
      })();
      const nextState = {
        ...state,
        type: packageType,
        category: state.category || currentName,
        level: state.level + 1,
        dirnames: [...state.dirnames, c]
      };
      if (nextState.type === 'workspace') {
        return undefined;
      }
      return collectPackages(
        path.join(filePath, currentName),
        core,
        spaceSet,
        performanceFirst,
        nextState
      );
    })
    .filter((d): d is Promise<PackageWithDynamicState[]> => !!d);
  const results: PackageWithDynamicState[][] = await Promise.all(promises);
  return results.flat();
}

async function loadPackages(
  cwd: string,
  core: Config['core'],
  spaceSet: Set<string>,
  performanceFirst?: boolean
) {
  const packs = await collectPackages(cwd, core, spaceSet, performanceFirst);
  const ps = packs.map((p): Package => {
    const {
      hasLockFile,
      hasNodeModules,
      lockContent,
      lockFileName,
      npmrc,
      payload,
      ...rest
    } = p;
    return rest;
  });
  const dynamicStates = packs.map(p => {
    const {
      name,
      hasNodeModules,
      hasLockFile,
      lockContent,
      lockFileName,
      npmrc,
      payload
    } = p;
    return {
      name,
      hasNodeModules,
      hasLockFile,
      lockContent,
      lockFileName,
      npmrc,
      payload
    };
  });
  return { packs: ps, dynamicStates };
}

async function loadScopes(cwd: string) {
  const packagesPath = path.join(cwd, 'packages');
  const isDir = await file.isDirectory(packagesPath);
  if (!isDir) {
    return [];
  }
  const children = await file.readdir(packagesPath);
  const promises = children
    .filter(d => d.startsWith('@'))
    .map(async (d): Promise<Scope | null> => {
      const p = path.join(packagesPath, d);
      const [isDir, hasPackageJsonFile] = await Promise.all([
        file.isDirectory(p),
        file.isFile(path.join(p, 'package.json'))
      ]);
      return isDir && !hasPackageJsonFile
        ? { name: d, path: p, packages: [] as Package[] }
        : null;
    });
  const s = await Promise.all(promises);
  return s.filter((d): d is Scope => !!d);
}

function diffDepsPackagesMap(
  source: Project | undefined,
  target: Project | undefined
) {
  if (target == null || source == null) {
    return source?.packageMap ?? {};
  }
  if (equal(omit(source, 'project'), omit(target, 'project'))) {
    return {};
  }
  const targetPackageMap = target.packageMap;
  const { packageMap } = source;
  const differs = Object.entries(packageMap).filter(([k, v]) => {
    const targetPj: PackageJson | undefined = targetPackageMap[k]?.packageJson;
    if (!targetPj) {
      return true;
    }
    const {
      dependencies: sd,
      devDependencies: sdev,
      optionalDependencies: sopt,
      pmnps: spmnps
    } = v.packageJson;
    const {
      dependencies: td,
      devDependencies: tdev,
      optionalDependencies: topt,
      pmnps: tpmnps
    } = targetPj;
    const sourceDeps = { ...sd, ...sdev, ...sopt };
    const targetDeps = { ...td, ...tdev, ...topt };
    return (
      !equal(sourceDeps, targetDeps) || spmnps?.ownRoot !== tpmnps?.ownRoot
    );
  });
  return Object.fromEntries(differs);
}

function diffProjectPackageMap(
  source: Project | undefined,
  target: Project | undefined
) {
  if (target == null || source == null) {
    return source?.packageMap ?? {};
  }
  if (equal(omit(source, 'project'), omit(target, 'project'))) {
    return {};
  }
  const targetPackageMap = target.packageMap;
  const { packageMap } = source;
  const differs = Object.entries(packageMap).filter(([k, v]) => {
    const targetValue = targetPackageMap[k];
    if (!targetValue) {
      return true;
    }
    return !equal(targetValue, v);
  });
  return Object.fromEntries(differs);
}

function serial(project: Project): ProjectSerial {
  const { packageMap, project: content } = project;
  const newPackageMap = mapValues(packageMap, v => v.name);
  const { scopes } = content;
  const newScopes = !scopes
    ? scopes
    : scopes.map(s => {
        const { packages } = s;
        return { ...s, packages: packages.map(p => p.name) };
      });
  const newContent = omitBy({ ...content, scopes: newScopes }, (value, key) => {
    return value == null || (Array.isArray(value) && !value.length);
  });
  return { ...project, packageMap: newPackageMap, project: newContent };
}

function parse(serial: ProjectSerial): Project {
  const { packageMap, project } = serial;
  const {
    workspace,
    packages = [],
    platforms = [],
    customized = [],
    scopes = []
  } = project;
  const packs = [workspace, ...packages, ...customized, ...platforms].filter(
    (p): p is Package => !!p
  );
  const packageRecord = keyBy(packs, 'name');
  const newPackageMap: Record<string, Package> = mapValues(packageMap, v => {
    return packageRecord.get(v) as unknown as Package;
  }) as Record<string, Package>;
  const newScopes = !scopes
    ? scopes
    : scopes.map(s => {
        const { packages: packageNames } = s;
        return {
          ...s,
          packages: packageNames.map(
            n => packageRecord.get(n) as unknown as Package
          )
        };
      });
  return {
    ...serial,
    packageMap: newPackageMap,
    project: omitBy(
      {
        ...project,
        scopes: newScopes
      },
      (value, key) => {
        return value == null || (Array.isArray(value) && !value.length);
      }
    )
  };
}

function makeDefaultProject(
  cwd: string,
  type: ProjectType
): Omit<Project, 'project'> & { project?: Project['project'] } {
  return {
    name: 'project',
    path: cwd,
    type,
    packageMap: {}
  };
}

function checkProjectLoops(project: Project) {
  function toPaths(items: PackageItem[], parents: string[] = []) {
    return items.flatMap((item): string[][] => {
      Object.assign(item, { checked: true });
      const dependentItems = item.dependentItems;
      const currentPath = [...parents, item.name];
      const preIndex = parents.indexOf(item.name);
      if (preIndex >= 0) {
        return [currentPath.slice(preIndex)];
      }
      if (!dependentItems.length) {
        return [currentPath];
      }
      return toPaths(dependentItems, currentPath);
    });
  }

  function checkLoops(items: PackageItem[]) {
    const paths = toPaths(items);
    return paths.filter(p => new Set(p).size !== p.length);
  }
  const { project: content } = project;
  const { packages = [], platforms = [] } = content;
  const packageItems = packages
    .concat(platforms)
    .map((p): PackageItem | null => {
      const { packageJson } = p;
      const { name, dependencies, devDependencies, optionalDependencies } =
        packageJson;
      if (name == null) {
        return null;
      }
      return {
        name,
        dependencies: {
          ...dependencies,
          ...devDependencies,
          ...optionalDependencies
        },
        dependencyItems: [],
        dependentItems: []
      };
    })
    .filter((d): d is PackageItem => !!d);
  const packageItemMap = keyBy(packageItems, 'name');
  packageItems.forEach(item => {
    const keys = Object.keys(item.dependencies);
    keys.forEach(key => {
      const depItem = packageItemMap.get(key);
      if (depItem == null) {
        return;
      }
      item.dependencyItems.push(depItem);
      depItem.dependentItems.push(item);
    });
  });

  const roots = packageItems.filter(p => !p.dependencyItems.length);
  const loopsInRoots = checkLoops(roots);
  const left = packageItems.filter(p => !p.checked);
  const loopsInLeft = checkLoops(left);
  return [...loopsInLeft, ...loopsInRoots];
}

export const projectSupport = {
  loadPackages,
  loadScopes,
  diffProjectPackageMap,
  diffDepsPackagesMap,
  makeDefaultProject,
  checkProjectLoops,
  serial,
  parse
};
