import type { LockResolver, Package, Project } from '@pmnps/tools';

function omitBy(
  obj: Record<string, any>,
  call: (value: any, key: string) => boolean
) {
  const es = Object.entries(obj).filter(([key, value]) => !call(value, key));
  return Object.fromEntries(es);
}

export const packageLock2: LockResolver = {
  core: 'npm',
  lockfileVersion: 2,
  filename: 'package-lock.json',
  resolver(project: Project, lockContent: string) {
    const {
      packages = [],
      forks = [],
      platforms = [],
      workspace
    } = project.project;
    const packs = [...packages, ...platforms, workspace].filter(
      (p): p is Package => !!p
    );
    const packMap = new Map(packs.map(p => [p.name, p]));
    try {
      const lockJson = JSON.parse(lockContent || '');
      if (lockJson.lockfileVersion !== 2) {
        return null;
      }
      const packagesObj = lockJson.packages;
      const dependenciesObj = lockJson.dependencies;
      if (!packagesObj || !dependenciesObj) {
        return null;
      }
      const entries = Object.entries(packagesObj);
      const newForks = forks.filter(f => {
        const forkKeyName = `forks/${f.name}`;
        const independentForkKeyName = `../../forks/${f.name}`;
        return (
          packagesObj[forkKeyName] == null &&
          packagesObj[independentForkKeyName] == null
        );
      });
      const newForkNames = newForks.map(f => f.name);
      const notExistPackNames = entries
        .map(([prefix, value]) => {
          const prefixName = (function computeName() {
            const independentPackagePrefix = '../../packages/';
            const independentPlatformPrefix = '../../platforms/';
            const packagePrefix = 'packages/';
            const platformPrefix = 'platforms/';
            if (prefix.startsWith(independentPackagePrefix)) {
              return prefix.slice(independentPackagePrefix.length);
            }
            if (prefix.startsWith(independentPlatformPrefix)) {
              return prefix.slice(independentPlatformPrefix.length);
            }
            if (prefix.startsWith(packagePrefix)) {
              return prefix.slice(packagePrefix.length);
            }
            if (prefix.startsWith(platformPrefix)) {
              return prefix.slice(platformPrefix.length);
            }
            return null;
          })();
          if (prefixName == null) {
            return null;
          }
          const [packageName] = prefixName.split('/node_modules/');
          return packMap.has(packageName) ? null : packageName;
        })
        .filter((packageName): packageName is string => packageName != null);
      const notExistPackNameSet = new Set(notExistPackNames);

      const shouldRemovePackNameSet = new Set(
        [...notExistPackNameSet].flatMap(name => {
          return [
            '../../packages/',
            '../../platforms/',
            '../../node_modules/',
            'packages/',
            'platforms/',
            'node_modules/'
          ].map(prefix => prefix + name);
        })
      );

      const shouldRemoveForkNameSet = new Set(newForkNames);

      const notExistPackNameArray = [...notExistPackNameSet];
      const packRestEntries = entries
        .filter(([key]) => {
          return !shouldRemovePackNameSet.has(key);
        })
        .filter(([key]) => notExistPackNameArray.every(n => !key.includes(n)));
      const packEntries = packRestEntries.map((p): [string, any] => {
        const [k, v] = p;
        const val = v as any;
        if (typeof val === 'object' && val != null && val.dependencies) {
          const newDeps = omitBy(val.dependencies, (v, k) =>
            notExistPackNameSet.has(k)
          );
          return [k, { ...val, dependencies: newDeps }];
        }
        return [k, v];
      });

      const dependenciesEntries = Object.entries(dependenciesObj).filter(
        ([k]) => !notExistPackNameSet.has(k)
      );

      const depEntries = dependenciesEntries.map(([k, v]): [string, any] => {
        const val = v as any;
        if (val != null && typeof val === 'object' && val.requires != null) {
          const newRequires = omitBy(val.requires, (v, key) =>
            notExistPackNameSet.has(key)
          );
          return [k, { ...val, requires: newRequires }];
        }
        return [k, v];
      });

      if (
        packEntries.length === entries.length &&
        depEntries.length === Object.entries(dependenciesObj).length
      ) {
        return null;
      }

      return JSON.stringify({
        ...lockJson,
        packages: Object.fromEntries(packEntries),
        dependencies: Object.fromEntries(depEntries)
      });
    } catch (e) {
      return null;
    }
  }
};
