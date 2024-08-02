import { createPluginCommand, type PackageLockInfo } from '@pmnps/tools';
import type { Plugin, Package } from '@pmnps/tools';

interface Query {
  lockfileVersion?: 1 | 2;
}

function omitBy(
  obj: Record<string, any>,
  call: (value: any, key: string) => boolean
) {
  const es = Object.entries(obj).filter(([key, value]) => !call(value, key));
  return Object.fromEntries(es);
}

function checkLock(name: string, lockContent: string, packs: Package[]) {
  const packMap = new Map(packs.map(p => [p.name, p]));
  const currentPack = packMap.get(name);
  if (currentPack == null || currentPack.packageJson == null) {
    return null;
  }
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

    return {
      lock: {
        ...lockJson,
        packages: Object.fromEntries(packEntries),
        dependencies: Object.fromEntries(depEntries)
      },
      path: currentPack.path
    };
  } catch (e) {
    return null;
  }
}

const refreshPackageLock: Plugin<Query> = function refreshPackageLock(
  query?: Query
) {
  const slot = createPluginCommand('refresh');
  return slot.action(async state => {
    const config = state.getConfig();
    const project = state.getProject();
    const dynamicState = state.getLockState();
    if (config?.core && config?.core !== 'npm') {
      return {
        type: 'warning',
        content: 'This plugin only support npm core manager.'
      };
    }
    if (config?.usePerformanceFirst) {
      return {
        type: 'warning',
        content: 'This plugin can not work in a performance first mode.'
      };
    }
    if (query?.lockfileVersion != null && query?.lockfileVersion !== 2) {
      return {
        type: 'warning',
        content: 'This plugin only support npm lockfileVersion 2'
      };
    }
    const { packages = [], platforms = [], workspace } = project?.project || {};
    if (workspace == null || config.projectType !== 'monorepo') {
      return {
        type: 'warning',
        content: 'This plugin only support monorepo usage.'
      };
    }
    const locks = Object.entries(dynamicState)
      .map(([name, value]): { name: string } & PackageLockInfo => ({
        name,
        ...value
      }))
      .filter(d => d.hasLockFile);
    const packs = [...packages, ...platforms, workspace];
    locks.forEach(lock => {
      const { name, lockContent, lockFileName } = lock;
      const res = checkLock(name, lockContent || '', packs);
      if (res == null) {
        return;
      }
      const { path: p, lock: lockObj } = res;
      state.task.write(p, lockFileName, lockObj);
    });
    return {
      type: 'success',
      content: 'Refresh package-locks success...'
    };
  });
};

export default refreshPackageLock;
