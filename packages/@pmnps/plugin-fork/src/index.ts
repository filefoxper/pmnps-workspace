import path from 'path';
import { createPluginCommand, inquirer } from '@pmnps/tools';
import type { CommandSerial } from 'pmnps/src/actions/task/type';
import type { Plugin, Config, ActionState, PackageJson } from '@pmnps/tools';

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
