import { PackageJson } from './type';
import { readJson } from './file';
import path from './path';
import { defaultPackageJson } from './resource';
import { packageJsons } from './structure';
import requires from './require';

async function writeRootPackageJson(
  packageJson: PackageJson
): Promise<PackageJson> {
  const jPath = path.join(path.rootPath, 'package.json');
  const old = await readJson<PackageJson>(jPath);
  if (!old) {
    const { dependencies, devDependencies, workspaces, ...rest } = packageJson;
    const prettierVersion: string | null = await requires.npmRequire(
      'prettier'
    );
    const pVersion =
      prettierVersion || defaultPackageJson.devDependencies!['prettier'];
    return {
      ...defaultPackageJson,
      ...rest,
      workspaces: workspaces || ['packages/*'],
      dependencies: {
        ...dependencies,
        ...defaultPackageJson.dependencies
      },
      devDependencies: {
        ...devDependencies,
        ...defaultPackageJson.devDependencies,
        prettier: pVersion
      }
    };
  }
  const source = old || defaultPackageJson;
  const { dependencies, devDependencies, workspaces, ...rest } = packageJson;
  return {
    ...source,
    ...rest,
    workspaces: workspaces || source.workspaces || ['packages/*'],
    dependencies: {
      ...dependencies,
      ...source.dependencies
    },
    devDependencies: {
      ...devDependencies,
      ...source.devDependencies
    }
  };
}

function isOwnRootPlat(json: PackageJson): boolean {
  const { pmnps = {} } = json;
  const { ownRoot } = pmnps;
  return !!ownRoot;
}

function removeDepPacks(
  packageJson: PackageJson,
  packs: string[]
): PackageJson {
  const packSet = new Set(packs);
  const scopeList = packs
    .filter(d => d.startsWith('@'))
    .map(p => {
      const [scope] = p.split('/');
      return `packages/${scope}/*`;
    });
  const { dependencies } = packageJson;
  if (!dependencies) {
    return {
      ...packageJson,
      workspaces: [...new Set(['packages/*'].concat(scopeList))]
    };
  }
  const e = Object.entries(dependencies).filter(([k]) => !packSet.has(k));
  const newDep = Object.fromEntries(e);
  return {
    ...packageJson,
    dependencies: newDep,
    workspaces: [...new Set(['packages/*'].concat(scopeList))]
  };
}

function refreshRootPackageJson(): [PackageJson, PackageJson[]] {
  const { root, packages, platforms } = packageJsons();
  const packageJson = packages.reduce(
    (data: PackageJson, pack: PackageJson) => {
      const { dependencies, devDependencies } = pack;
      if (isOwnRootPlat(pack)) {
        return data;
      }
      return {
        ...data,
        dependencies: { ...dependencies, ...data.dependencies },
        devDependencies: { ...devDependencies, ...data.devDependencies }
      };
    },
    root as PackageJson
  );
  const list: string[] = packages
    .map(({ name }) => name)
    .filter((name): name is string => !!name);
  const finalPackageJson = platforms.reduce((data, pack) => {
    const current = pack;
    if (isOwnRootPlat(current)) {
      return data;
    }
    const { dependencies, devDependencies } = current;
    return {
      ...data,
      dependencies: { ...dependencies, ...data.dependencies },
      devDependencies: { ...devDependencies, ...data.devDependencies }
    };
  }, packageJson);
  const { deps, dets, used, ...cleanPackageJson } = removeDepPacks(
    finalPackageJson,
    list
  );
  const rootPkgDeps = {
    ...cleanPackageJson.dependencies,
    ...cleanPackageJson.devDependencies
  };
  const needUpdates = packages
    .concat(platforms)
    .map(pkg => {
      if (isOwnRootPlat(pkg)) {
        return pkg;
      }
      const { dependencies = {}, devDependencies = {} } = pkg;
      const dependenciesResult = Object.keys(dependencies).reduce(
        (r, c) => {
          const { deps } = r;
          const rootVersion = rootPkgDeps[c];
          if (rootVersion === deps[c]) {
            return r;
          }
          return { deps: { ...deps, [c]: rootVersion }, needUpdate: true };
        },
        { deps: dependencies, needUpdate: false }
      );
      const devDependenciesResult = Object.keys(devDependencies).reduce(
        (r, c) => {
          const { deps } = r;
          const rootVersion = rootPkgDeps[c];
          if (rootVersion === deps[c]) {
            return r;
          }
          return { deps: { ...deps, [c]: rootVersion }, needUpdate: true };
        },
        { deps: devDependencies, needUpdate: false }
      );
      if (!dependenciesResult.needUpdate && !devDependenciesResult.needUpdate) {
        return pkg;
      }
      return {
        ...pkg,
        dependencies: dependenciesResult.deps,
        devDependencies: devDependenciesResult.deps,
        needPmnpsUpdatePackageJson: true
      };
    })
    .filter(
      (
        d: PackageJson & { needPmnpsUpdatePackageJson?: boolean }
      ): d is PackageJson & { needPmnpsUpdatePackageJson: true } =>
        !!d.needPmnpsUpdatePackageJson
    );
  const updatePackages = needUpdates.map((d): PackageJson => {
    const { needPmnpsUpdatePackageJson, ...pkg } = d;
    return pkg;
  });
  return [cleanPackageJson, updatePackages];
}

export default {
  writeRootPackageJson,
  refreshRootPackageJson
};
