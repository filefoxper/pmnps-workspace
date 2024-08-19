import path from 'path';
import { createPluginCommand, inquirer } from '@pmnps/tools';
import type { CommandSerial } from 'pmnps/src/actions/task/type';
import type {
  Plugin,
  Config,
  ActionState,
  LockResolver,
  LockResolverState,
  PackageJson
} from '@pmnps/tools';

type Query = {
  to?: string;
  omits?: string;
};

function omitBy(
  obj: Record<string, any>,
  call: (value: any, key: string) => boolean
) {
  const es = Object.entries(obj).filter(([key, value]) => !call(value, key));
  return Object.fromEntries(es);
}

function omit(obj: Record<string, any>, ...keys: string[]) {
  const keySet = new Set(keys);
  return omitBy(obj, (v, k) => keySet.has(k));
}

function parseForkTo(forkTo: string | undefined | Array<string>): string[] {
  if (forkTo == null) {
    return [];
  }
  if (typeof forkTo === 'string') {
    return [forkTo];
  }
  return forkTo;
}

const lockResolver: LockResolver = {
  core: 'npm',
  filename: 'package-lock.json',
  lockfileVersion: 2,
  resolver(
    lockContent: string,
    { project, current, lockBak }: LockResolverState
  ) {
    const paths = (current.paths || []).join('/');
    const lockJson = JSON.parse(lockContent);
    const forkLockObj = lockBak ?? {};
    const packagesObj = lockJson.packages;
    const dependenciesObj = lockJson.dependencies;
    const { customized = [] } = project.project;
    const forks = customized.filter(c => c.category === 'forks');
    const newForks = forks.filter(f => {
      const forkKeyName = `forks/${f.name}`;
      const independentForkKeyName = `../../forks/${f.name}`;
      const matched = parseForkTo(f.packageJson.pmnps?.forkTo as string).some(
        to => {
          const rootMatch = !paths && to.startsWith('node_modules');
          const packMatch = paths && to.startsWith(paths);
          return rootMatch || packMatch;
        }
      );
      return (
        packagesObj[forkKeyName] == null &&
        packagesObj[independentForkKeyName] == null &&
        matched
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
      return [lockContent, false];
    }
    const newForkMap = new Map(
      newForks.flatMap(f => {
        const ts = (function getForkTo() {
          const { packageJson } = f;
          return parseForkTo(packageJson.pmnps?.forkTo as string).filter(to => {
            const rootMatch = !paths && to.startsWith('node_modules');
            const packMatch = paths && to.startsWith(paths);
            return rootMatch || packMatch;
          });
        })();
        return ts.map(t => [t, f]);
      })
    );
    const entries = Object.entries(packagesObj);
    const processes = entries.map(
      ([k, v]): [string, { value: any; removed?: string }] => {
        const fork = newForkMap.get(paths ? paths + '/' + k : k);
        if (!fork) {
          return [k, { value: v }];
        }
        return [k, { value: v, removed: fork.name }];
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
    const forkLockEntries = Object.entries(forkLockObj.packages || {});
    const forkBakMap = new Map(
      forkLockEntries.map(([k, v]): [string, any] => {
        const [forkName, actualKey] = k.split(':');
        return [forkName, { [actualKey]: v }];
      })
    );
    const backLockEntries = staleForkNames
      .flatMap(name => {
        const bakValue = forkBakMap.get(name);
        if (bakValue == null) {
          return undefined;
        }
        return Object.entries(bakValue);
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
      .map(([k, v]) => [`${v.removed}:${k}`, v.value]);
    const nextLockContent = JSON.stringify({
      ...lockJson,
      packages: backLockEntries.length
        ? { ...newPackages, ...Object.fromEntries(backLockEntries) }
        : newPackages,
      dependencies: dependenciesObj
    });
    const bak = !removedEntries.length
      ? true
      : (function computeForkLock() {
          const packagesPart = Object.fromEntries(removedEntries);
          const bakPackages = { ...forkLockObj.packages, ...packagesPart };
          return {
            ...forkLockObj,
            packages: bakPackages
          };
        })();
    return [nextLockContent, bak];
  }
};

function writeFork(
  state: ActionState,
  p: Array<string>,
  config?: {
    relative?: boolean;
    source?: string;
    command?: CommandSerial[];
    omits?: string[];
  }
) {
  const cwd = state.cwd();
  const { source, omits: ot = ['devDependencies'] } = config ?? {};
  const pas = source?.split(path.sep) ?? [];
  const ends = pas.slice(pas.length - 2);
  const packageName = ends[0].startsWith('@') ? ends.join('/') : ends[1];
  const pathname = path.join(cwd, 'forks', ...packageName.split('/'));
  const pmnpsForkTo = p;
  return state.task.writeDir(pathname, {
    source,
    onFinish: async () => {
      const pmnps = { forkTo: pmnpsForkTo };
      const pjData = await state.reader.readJson<PackageJson>(
        path.join(pathname, 'package.json')
      );
      if (pjData == null) {
        return;
      }
      const pjdWithOmit = ot
        ? (omit(pjData, ...(ot as 'devDependencies'[])) as PackageJson)
        : pjData;
      const pjDataWithPmnps: PackageJson = { ...pjdWithOmit, pmnps };
      const paths = ['forks', ...packageName.split('/')];
      state.task.writePackageToState(cwd, {
        name: packageName || '',
        paths,
        path: pathname,
        type: 'customized',
        category: 'forks',
        packageJsonFileName: 'package.json',
        packageJson: pjDataWithPmnps
      });
      state.task.write(
        pathname,
        'package.json',
        JSON.stringify(pjDataWithPmnps)
      );
    }
  });
}

const fork: Plugin<any> = function fork() {
  const slot = createPluginCommand('fork');
  return slot
    .filter((config: Config) => {
      const { core } = config;
      return core == null || core === 'npm';
    })
    .resolveLock(lockResolver)
    .requireRefresh()
    .requireSpace('forks')
    .args(
      '<package location>',
      'Enter the source package location for forking.'
    )
    .option('to', 't', {
      inputType: '<target location>',
      description:
        'Enter the target package location in node_modules for replacing.'
    })
    .option('omits', 'o', {
      inputType: '<deps | devDeps>',
      description: 'Enter the fields you want to omit in package.json'
    })
    .describe('Fork package out to replace a same package in node_modules.')
    .action(async (state, argument: string | undefined, options?: Query) => {
      const { to, omits } = options ?? {};
      let pathname = argument;
      if (pathname == null) {
        const { pack } = await inquirer.prompt([
          {
            name: 'pack',
            type: 'input',
            message: 'Please enter the package source path:'
          }
        ]);
        pathname = pack ? pack.trim() : null;
      }
      if (pathname == null || !pathname.trim()) {
        return {
          type: 'warning',
          content:
            'Please provide a relative url to the fork package in node_modules folder.'
        };
      }
      let targetPathname = to ?? pathname;
      if (!argument && (to == null || !to.trim())) {
        const { confirm } = await inquirer.prompt([
          {
            name: 'confirm',
            type: 'confirm',
            message: 'Is the source package path is the target package path?',
            default: true
          }
        ]);
        if (!confirm) {
          const { target } = await inquirer.prompt([
            {
              name: 'target',
              type: 'input',
              message: 'Please enter the target path:'
            }
          ]);
          targetPathname = target;
        }
      }
      const cwd = state.cwd();
      const pathParts = pathname
        .trim()
        .split('/')
        .map(p => p.trim());
      const source = path.join(cwd, ...pathParts);
      writeFork(
        state,
        targetPathname
          .split(',')
          .filter(s => s.trim())
          .map(s => s.trim()),
        { source, omits: omits ? omits.split(',') : ['devDependencies'] }
      );
      return {
        type: 'success',
        content: `Fork package "${pathname}" success`
      };
    });
};

export default fork;
