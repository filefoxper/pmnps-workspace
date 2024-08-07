import fs from 'fs';
import { file, path } from '@/libs';
import { projectSupport } from '@/support';
import { groupBy, omitBy, orderBy, partition } from '@/libs/polyfill';
import type {
  PackageJson,
  Package,
  Project,
  PackageLockInfo,
  Config
} from '@pmnps/tools';
import type { State } from '@/types';

async function readProject(
  cwd: string,
  config?: Config
): Promise<[undefined | Project, Record<string, PackageLockInfo> | undefined]> {
  const {
    core,
    usePerformanceFirst: performanceFirst,
    projectType = 'monorepo'
  } = config ?? {};
  const lockFileName = (function computeLockFileName() {
    if (core === 'yarn' || core === 'yarn2') {
      return 'yarn.lock';
    }
    if (core === 'pnpm') {
      return 'pnpm-lock.yaml';
    }
    return 'package-lock.json';
  })();
  const [mainPackageJson, lockContent, hasNodeModules, pnpmWorkspace] =
    await Promise.all([
      file.readJson<PackageJson>(path.join(cwd, 'package.json')),
      performanceFirst
        ? (new Promise(resolve => {
            if (fs.existsSync(path.join(cwd, lockFileName))) {
              resolve('');
            } else {
              resolve(null);
            }
          }) as Promise<string | null>)
        : file.readFile(path.join(cwd, lockFileName)),
      file.isDirectory(path.join(cwd, 'node_modules')),
      core === 'pnpm'
        ? file.readYaml<{ packages: string[] }>(
            path.join(cwd, 'pnpm-workspace.yaml')
          )
        : Promise.resolve(undefined)
    ]);
  if (!mainPackageJson) {
    return [undefined, undefined];
  }
  const mainPackage: Package = {
    name: mainPackageJson.name ?? '',
    path: cwd,
    paths: null,
    packageJson: mainPackageJson,
    packageJsonFileName: 'package.json',
    type: 'workspace'
  };
  const [packsInfo, scopes] = await Promise.all([
    projectSupport.loadPackages(cwd, lockFileName, performanceFirst),
    projectSupport.loadScopes(cwd)
  ]);
  const { packs: children, dynamicStates } = packsInfo;
  const dynamicStateArray = [
    ...dynamicStates,
    {
      name: mainPackage.name,
      hasLockFile: lockContent != null,
      hasNodeModules,
      lockContent: lockContent || '',
      lockFileName,
      payload: { pnpmWorkspace }
    }
  ];
  const dynamicState = Object.fromEntries(
    dynamicStateArray.map((d): [string, PackageLockInfo] => [d.name, d])
  );
  const [allPks, pls] = partition(children, c => c.type !== 'platform');
  const [pks, fks] = partition(allPks, c => c.type === 'package');
  const packages = orderBy(pks, ['name'], ['desc']);
  const forks = orderBy(fks, ['name'], ['desc']);
  const platforms = orderBy(pls, ['name'], ['desc']);
  const childMap = Object.fromEntries(children.map(c => [c.path, c]));
  const scopePackageGroup = groupBy(packages, p => {
    const [n] = p.name.split('/');
    return n.startsWith('@') ? n : '';
  });
  const sps = orderBy(scopes, ['name'], ['desc']).map(scope => {
    const { name } = scope;
    const packagesInScope = scopePackageGroup.get(name) ?? [];
    return { ...scope, packages: packagesInScope };
  });
  return [
    {
      name: mainPackage.name,
      path: cwd,
      type: projectType,
      packageMap: { [cwd]: mainPackage, ...childMap },
      project: omitBy(
        { workspace: mainPackage, packages, forks, platforms, scopes: sps },
        (value, key) => {
          return value == null || (Array.isArray(value) && !value.length);
        }
      )
    },
    dynamicState
  ];
}

export async function loadData(cwd: string, config?: Config) {
  const [project, dynamicState] = await readProject(cwd, config);
  return { project, dynamicState } as State;
}
