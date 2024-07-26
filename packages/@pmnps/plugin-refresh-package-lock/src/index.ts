import {
  createPluginCommand,
  type PackageLockInfo,
  versions
} from '@pmnps/tools';
import type { Plugin, Package } from '@pmnps/tools';

interface Query {
  lockfileVersion?: 1 | 2;
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
    if (!packagesObj) {
      return null;
    }
    const entries = Object.entries(packagesObj);
    const data = entries.filter(([prefix, value]) => {
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
        return true;
      }
      const [packageName, packageDepName] = prefixName.split('/node_modules/');
      const pack = packMap.get(packageName);
      if (!pack) {
        return false;
      }
      if (packageDepName == null) {
        return true;
      }
      const { dependencies = {}, devDependencies = {} } = pack.packageJson;
      const deps = { ...dependencies, ...devDependencies };
      const expectedVersionRange = deps[packageDepName];
      const lockedVersion: string = (value as Record<string, any>).version;
      if (expectedVersionRange == null) {
        return true;
      }
      return versions.satisfies(lockedVersion, expectedVersionRange);
    });
    if (data.length === entries.length) {
      return null;
    }
    const secondKeySet = new Set(
      data
        .filter(([k]) => {
          return k.split('/node_modules/').length === 2;
        })
        .map(([k]) => k)
    );
    const clean = data.filter(([k]) => {
      const parts = k.split('/node_modules/');
      if (parts.length <= 2) {
        return true;
      }
      const [f, s] = parts;
      return secondKeySet.has([f, s].join('/node_modules'));
    });
    const newPackagesObj = Object.fromEntries(clean);
    return {
      lock: { ...lockJson, packages: newPackagesObj },
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
      content: 'Refresh package-locks success.'
    };
  });
};

export default refreshPackageLock;
