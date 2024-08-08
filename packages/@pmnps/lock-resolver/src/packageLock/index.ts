import type { LockResolver, LockResolverState, Package } from '@pmnps/tools';

function omitBy(
  obj: Record<string, any>,
  call: (value: any, key: string) => boolean
) {
  const es = Object.entries(obj).filter(([key, value]) => !call(value, key));
  return Object.fromEntries(es);
}

function resolvePacks(lockJson: any, { project }: LockResolverState) {
  const { packages = [], platforms = [], workspace } = project.project;
  const packs = [...packages, ...platforms, workspace].filter(
    (p): p is Package => !!p
  );
  const packMap = new Map(packs.map(p => [p.name, p]));
  const packagesObj = lockJson.packages;
  const dependenciesObj = lockJson.dependencies;
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
    return { lockJson, change: false };
  }

  return {
    lockJson: {
      ...lockJson,
      packages: Object.fromEntries(packEntries),
      dependencies: Object.fromEntries(depEntries)
    },
    change: true
  };
}

function resolveForks(
  lockJson: any,
  { project, current, forkLockContent }: LockResolverState
) {
  function pathForkName(name: string) {
    return name.split('.').join('/');
  }
  const forkLockObj = (function computeForkLockObj() {
    if (!forkLockContent) {
      return {};
    }
    try {
      return JSON.parse(forkLockContent);
    } catch (e) {
      return {};
    }
  })();
  const packagesObj = lockJson.packages;
  const dependenciesObj = lockJson.dependencies;
  const { forks = [] } = project.project;
  const newForks = forks.filter(f => {
    const forkKeyName = `forks/${f.name}`;
    const independentForkKeyName = `../../forks/${f.name}`;
    return (
      packagesObj[forkKeyName] == null &&
      packagesObj[independentForkKeyName] == null
    );
  });
  const forkNameSet = new Set(forks.map(f => f.name));
  const staleForkNames = Object.entries(packagesObj)
    .map(([prefix, value]) => {
      const prefixName = (function computeName() {
        const independentForkPrefix = '../../forks/';
        const forkPrefix = 'forks/';
        if (prefix.startsWith(independentForkPrefix)) {
          return prefix.slice(independentForkPrefix.length);
        }
        if (prefix.startsWith(forkPrefix)) {
          return prefix.slice(forkPrefix.length);
        }
        return null;
      })();
      if (prefixName == null) {
        return null;
      }
      const [packageName] = prefixName.split('/node_modules/');
      return forkNameSet.has(packageName) ? null : packageName;
    })
    .filter((packageName): packageName is string => packageName != null);
  if (!newForks.length && !staleForkNames.length) {
    return { lockJson, change: false };
  }
  const newForkMap = new Map(newForks.map(f => [pathForkName(f.name), f]));
  const entries = Object.entries(packagesObj);
  const processes = entries.map(
    ([k, v]): [string, { value: any; removed?: boolean }] => {
      const fork = newForkMap.get(k);
      if (!fork) {
        return [k, { value: v }];
      }
      return [k, { value: v, removed: true }];
    }
  );
  const newEntries = processes
    .filter(([k, v]) => !v.removed)
    .map(([k, v]) => [k, v.value]);
  const staleForkNameSetInLock = new Set(
    staleForkNames.flatMap(name => {
      const independentName = `../../forks/${name}`;
      const workName = `forks/${name}`;
      return [workName, independentName];
    })
  );
  const backLockEntries = staleForkNames
    .map(name => {
      const bakKey = pathForkName(name);
      const bakValue = forkLockObj[bakKey];
      if (bakValue == null) {
        return undefined;
      }
      return [bakKey, bakValue];
    })
    .filter((e): e is [string, any] => !!e);
  const processedEntries = newEntries
    .map(([k, v]) => {
      if (staleForkNameSetInLock.has(k)) {
        return undefined;
      }
      return [k, v];
    })
    .filter((e): e is [string, any] => !!e);
  const newPackages = Object.fromEntries(processedEntries);
  const removedEntries = processes
    .filter(([k, v]) => v.removed)
    .map(([k, v]) => [k, v.value]);
  return {
    lockJson: {
      ...lockJson,
      packages: backLockEntries.length
        ? { ...newPackages, ...Object.fromEntries(backLockEntries) }
        : newPackages,
      dependencies: dependenciesObj
    },
    forkLock: !removedEntries.length
      ? null
      : (function computeForkLock() {
          const bak = Object.fromEntries(removedEntries);
          return JSON.stringify({ ...forkLockObj, ...bak });
        })(),
    change: true
  };
}

export const packageLock2: LockResolver = {
  core: 'npm',
  lockfileVersion: 2,
  filename: 'package-lock.json',
  resolver(lockContent: string, state: LockResolverState) {
    try {
      const lockJson = JSON.parse(lockContent || '');
      if (lockJson.lockfileVersion !== 2) {
        return [null, null];
      }
      const packagesObj = lockJson.packages;
      const dependenciesObj = lockJson.dependencies;
      if (!packagesObj || !dependenciesObj) {
        return [null, null];
      }
      const result = resolvePacks(lockJson, state);
      const forkResult = resolveForks(result.lockJson, state);
      if (!result.change && !forkResult.change) {
        return [null, null] as [null, null];
      }
      const locks = JSON.stringify(forkResult.lockJson);
      if (forkResult.forkLock) {
        return [locks, forkResult.forkLock] as [string, string];
      }
      return [locks, null];
    } catch (e) {
      return [null, null];
    }
  }
};
