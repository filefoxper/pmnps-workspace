import { file, path } from '@/libs';
import { projectSupport } from '@/support';
import { groupBy, orderBy, partition } from '@/libs/polyfill';
import type { PackageJson, Package, Project } from '@pmnps/tools';
import type { DynamicStateUnit, State } from '@/types';

async function readProject(
  cwd: string
): Promise<
  [undefined | Project, Record<string, DynamicStateUnit> | undefined]
> {
  const [mainPackageJson, hasPackageLockJsonFile, hasNodeModules] =
    await Promise.all([
      file.readJson<PackageJson>(path.join(cwd, 'package.json')),
      file.isFile(path.join(cwd, 'package-lock.json')),
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
    projectSupport.loadPackages(cwd),
    projectSupport.loadScopes(cwd)
  ]);
  const { packs: children, dynamicStates } = packsInfo;
  const dynamicStateArray = [
    ...dynamicStates,
    { name: mainPackage.name, hasPackageLockJsonFile, hasNodeModules }
  ];
  const dynamicState = Object.fromEntries(
    dynamicStateArray.map((d): [string, DynamicStateUnit] => [d.name, d])
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

export async function loadData(cwd: string) {
  const [project, dynamicState] = await readProject(cwd);
  return { project, dynamicState } as State;
}
