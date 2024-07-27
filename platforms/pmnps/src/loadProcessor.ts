import fs from 'fs';
import { file, path } from '@/libs';
import { projectSupport } from '@/support';
import { groupBy, orderBy, partition } from '@/libs/polyfill';
import type {
  PackageJson,
  Package,
  Project,
  PackageLockInfo
} from '@pmnps/tools';
import type { State } from '@/types';

async function readProject(
  cwd: string,
  core?: 'npm' | 'yarn' | 'yarn2',
  performanceFirst?: boolean
): Promise<[undefined | Project, Record<string, PackageLockInfo> | undefined]> {
  const lockFileName = (function computeLockFileName() {
    if (core === 'yarn' || core === 'yarn2') {
      return 'yarn.lock';
    }
    return 'package-lock.json';
  })();
  const [mainPackageJson, lockContent, hasNodeModules] = await Promise.all([
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
    file.isDirectory(path.join(cwd, 'node_modules'))
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
      lockFileName
    }
  ];
  const dynamicState = Object.fromEntries(
    dynamicStateArray.map((d): [string, PackageLockInfo] => [d.name, d])
  );
  const [pks, pls] = partition(children, c => c.type === 'package');
  const packages = orderBy(pks, ['name'], ['desc']);
  const platforms = orderBy(pls, ['name'], ['desc']);
  const childMap = Object.fromEntries(children.map(c => [c.path, c]));
  const scopePackageGroup = groupBy(packages, p => {
    const [n] = p.name.split('/');
    return n.startsWith('@') ? n : '';
  });
  const sps = orderBy(scopes, ['name'], ['desc']).map(scope => {
    const { name } = scope;
    const packages = scopePackageGroup.get(name) ?? [];
    return { ...scope, packages };
  });
  return [
    {
      name: mainPackage.name,
      path: cwd,
      type: 'monorepo',
      packageMap: { [cwd]: mainPackage, ...childMap },
      project: { workspace: mainPackage, packages, platforms, scopes: sps }
    },
    dynamicState
  ];
}

export async function loadData(
  cwd: string,
  core?: 'npm' | 'yarn' | 'yarn2',
  performanceFirst?: boolean
) {
  const [project, dynamicState] = await readProject(
    cwd,
    core,
    performanceFirst
  );
  return { project, dynamicState } as State;
}
