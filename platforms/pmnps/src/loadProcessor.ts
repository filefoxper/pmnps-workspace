import { file, path } from '@/libs';
import { projectSupport } from '@/support';
import { groupBy, orderBy, partition } from '@/libs/polyfill';
import type { Package, PackageJson, Project, State } from '@/types';

async function readProject(cwd: string): Promise<undefined | Project> {
  const mainPackageJson = await file.readJson<PackageJson>(
    path.join(cwd, 'package.json')
  );
  if (!mainPackageJson) {
    return undefined;
  }
  const mainPackage: Package = {
    name: mainPackageJson.name ?? '',
    path: cwd,
    paths: null,
    packageJson: mainPackageJson,
    packageJsonFileName: 'package.json',
    type: 'workspace'
  };
  const [children, scopes] = await Promise.all([
    projectSupport.loadPackages(cwd),
    projectSupport.loadScopes(cwd)
  ]);
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
  return {
    name: mainPackage.name,
    path: cwd,
    type: 'monorepo',
    packageMap: { [cwd]: mainPackage, ...childMap },
    project: { workspace: mainPackage, packages, platforms, scopes: sps }
  };
}

export async function loadData(cwd: string) {
  const project = await readProject(cwd);
  return { project } as State;
}
