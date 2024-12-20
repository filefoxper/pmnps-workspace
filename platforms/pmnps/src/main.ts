import os from 'os';
import process from 'process';
import { program } from 'commander';
import { createPluginCommand } from '@pmnps/tools';
import { hold } from '@/state';
import { configAction } from '@/actions/config';
import { refreshAction } from '@/actions/refresh';
import { createAction } from '@/actions/create';
import { executeAction, task, useCommand } from '@/actions/task';
import { runAction, startAction } from '@/actions/run';
import { getPluginState } from '@/plugin';
import {
  setAction,
  setAliasAction,
  setPackageAction,
  setPlatformAction
} from '@/actions/set';
import { CONF_NAME, SystemFormatter } from '@/constants';
import { omitBy } from '@/libs/polyfill';
import { env, file, path, inquirer, message } from './libs';
import { initialize, loadProject } from './processor';
import type { Command, CommandOption, PackageJson } from '@pmnps/tools';
import type { ActionMessage, Task } from '@/actions/task/type';
import type { Resource, State } from './types';

declare global {
  // eslint-disable-next-line no-var
  var pmnps: {
    cwd?: string;
    env?: { node: string; npm: string };
    holder: ReturnType<typeof hold>;
    resources: Resource;
    state: State;
    load: (withCache?: boolean) => Promise<any>;
    tasks: Task[];
    isDevelopment?: boolean;
    px?: boolean;
    platform?: NodeJS.Platform;
    coreChanged: boolean;
  };
}

const refreshCommand = createPluginCommand('refresh')
  .option('force', 'f', {
    description:
      'Refresh force and rewrite project cache. ex: npx pmnps refresh -f'
  })
  .option('install', 'i', {
    description:
      'Enter project types to limit the install command range. ex: npx pmnps refresh -i package,platform',
    inputType: 'package | platform | workspace'
  })
  .option('parameters', 'p', {
    description:
      'Enter the install command parameters. ex: npx pmnps refresh -p "--ignore-scripts"',
    inputType: '"char"'
  })
  .option('name', 'n', {
    description:
      'Enter a specific platform or package for install. ex: npx pmnps refresh -n xxx',
    inputType: '"char"'
  })
  .describe('Integrate and install project dependencies.')
  .action((state, argument, option) => refreshAction(option));

const createCommand = createPluginCommand('create')
  .args('package|platform|scope|template', 'Enter a creating type')
  .requireRefresh()
  .describe('Create package, platform, scope or template')
  .action((state, argument, option) => createAction(argument, option));

const startCommand = createPluginCommand('start')
  .option('all', 'a', {
    description: 'Starts all platforms and packages. ex: npx pmnps start -a'
  })
  .option('name', 'n', {
    description:
      'Enter the package or platform name for executing "start" script. ex: npx pmnps start -n platform1,platform2',
    inputType: 'package or platform name'
  })
  .option('group', 'g', {
    description:
      'Enter a group name for executing "start" script in package or platforms. ex: npx pmnps start -g pmnps-mock',
    inputType: 'group name'
  })
  .describe('Run start script in packages or platforms.')
  .action((state, argument, option) => startAction(option));

const runCommand = createPluginCommand('run')
  .args('script', 'Enter npm script command')
  .option('all', 'a', {
    description:
      'Executing scripts in all package or platforms. ex: npx pmnps run build -a'
  })
  .option('name', 'n', {
    description:
      'Enter the package or platform name for executing script. ex: npx pmnps run build -n platform1,platform2',
    inputType: 'package or platform name'
  })
  .option('group', 'g', {
    description:
      'Enter a group name for executing scripts in package or platforms. ex: npx pmnps run build -g platform-mock',
    inputType: 'group name'
  })
  .describe('Run script in packages or platforms.')
  .action((state, argument, option) => runAction(argument, option));

const configCommand = createPluginCommand('config')
  .requireRefresh()
  .describe('Config pmnps workspace')
  .action(() => configAction());

const setCommand = createPluginCommand('set')
  .describe('Set package/platform detail.')
  .args('package|platform', 'Enter a target type for setting')
  .action((state, argument) => setAction(argument));

const noListCommands = [
  createPluginCommand('set:package')
    .describe('Set package detail.')
    .list(false)
    .args('package name', 'Enter a package name for setting')
    .action((state, argument) => setPackageAction(argument)),
  createPluginCommand('set:platform')
    .describe('Set platform detail.')
    .list(false)
    .args('platform name', 'Enter a platform name for setting')
    .action((state, argument) => setPlatformAction(argument))
];

const setAliasCommand = createPluginCommand('set:alias')
  .describe('Set pmnpx alias.')
  .list(false)
  .args('alias', 'Enter a alias for pmnpx')
  .action((state, argument) => setAliasAction(argument));

function actCommands(cmds: Command[]) {
  const state = getPluginState();
  const { useCommandHelp } = hold.instance().getState().config ?? {};
  return cmds.map(c => {
    return {
      ...c,
      action: c.args
        ? function commandAction(arg: string | undefined, option?: any) {
            if (useCommandHelp) {
              generateCommandHelp(c).forEach(d => message.desc(d));
            }
            return c.action({ ...state, required: c.required }, arg, option);
          }
        : function commandAction(option?: any) {
            if (useCommandHelp) {
              generateCommandHelp(c).forEach(d => message.desc(d));
            }
            return c.action(
              { ...state, required: c.required },
              undefined,
              option
            );
          }
    };
  });
}

const getCommands = () => {
  const { projectType = 'monorepo', core = 'npm' } =
    hold.instance().getState().config ?? {};
  const canUseAlias = !!global.pmnps.px && global.pmnps.platform === 'darwin';
  const pmnpxCommands = canUseAlias ? [setAliasCommand] : [];
  return actCommands(
    projectType === 'monorepo'
      ? ([
          startCommand,
          runCommand,
          refreshCommand,
          createCommand,
          configCommand,
          setCommand,
          ...noListCommands,
          ...pmnpxCommands
        ] as Command[])
      : ([
          startCommand,
          runCommand,
          refreshCommand,
          configCommand,
          setCommand
        ] as Command[])
  );
};

function generateOption(o: CommandOption): [string, string] {
  const { inputType } = o;
  return [
    typeof inputType === 'string'
      ? `-${o.shortcut} --${o.name} <${inputType}>`
      : `-${o.shortcut} --${o.name}`,
    o.description
  ];
}

function generateCommandHelp(command: Command): string[] {
  const { options = [], description, name, args } = command;
  const summary = `==== pmnps ${name + (args ? ' <' + args.param + '>' : '')} ====`;
  const opts = options.map(generateOption);
  const fs = opts.map(t => t[0].length);
  const maxLen = Math.max(...fs);
  const optStrings = opts.map(([f, d]) => {
    return '  ' + f.padEnd(maxLen + 4, ' ') + d;
  });
  const optHelps = optStrings.length ? ['Options:', ...optStrings] : [];
  return [summary, description, ...optHelps];
}

function getCustomizedCommands() {
  const customizedCommands = hold.instance().getCommands();
  return actCommands(
    customizedCommands.filter(({ name }) => name && name !== 'refresh')
  );
}

async function initialAction() {
  const customizedCommands = getCustomizedCommands()
    .filter(c => c.list || c.list == null)
    .map(
      ({ name, action }) =>
        [name, action] as [string, (...a: any[]) => Promise<ActionMessage>]
    );
  const systemCommands = getCommands()
    .filter(c => c.list || c.list == null)
    .map(
      ({ name, action }) =>
        [name, action] as [string, (...a: any[]) => Promise<ActionMessage>]
    );
  const commandDesc = [
    new inquirer.Separator('-- system commands --'),
    ...systemCommands.map(([des]) => des)
  ];
  const customizedCommandDesc = customizedCommands.length
    ? [
        new inquirer.Separator('-- customized commands --'),
        ...customizedCommands.map(([name]) => name)
      ]
    : [];
  const { command } = await inquirer.prompt([
    {
      name: 'command',
      type: 'list',
      message: 'Use command:',
      choices: [...commandDesc, ...customizedCommandDesc],
      default: commandDesc[0]
    }
  ]);
  const commandMap = new Map(systemCommands.concat(customizedCommands));
  const action = commandMap.get(command);
  if (!action) {
    return null;
  }
  const res: ActionMessage = await action();
  return {
    requireRefresh: ['create', 'config'].includes(command),
    ...res
  } as ActionMessage;
}

export async function startup(isDevelopment?: boolean) {
  const px = process.env.PXS_ENV === 'pmnpx';
  const [, , command, template] = process.argv;
  const platform = os.platform();
  global.pmnps = {
    holder: hold(),
    load: loadProject,
    resources: { templates: [], commands: [] },
    state: {},
    tasks: [],
    px,
    platform,
    isDevelopment,
    coreChanged: false
  };
  if (env.isDevelopment) {
    await file.mkdirIfNotExist(path.cwd());
  }
  const success = await initialize();
  if (!success) {
    return;
  }
  const config = hold.instance().getState().config;
  if (config == null) {
    const templatePackage = command === 'init' && template ? template : null;
    const configActionMessage = await configAction(templatePackage);
    await executeAction(configActionMessage, true, {
      skipExit: !!templatePackage
    });
    if (templatePackage) {
      const s = await initialize();
      if (!s) {
        process.exit(0);
        return;
      }
      const { config: sourceConfig, project } = hold.instance().getState();
      const { workspace: sourceWorkspace } = project?.project ?? {};
      const modulePath = path.join(
        path.cwd(),
        'node_modules',
        ...template.split('/'),
        'resource'
      );
      task.writeDir(path.cwd(), {
        source: modulePath,
        force: true,
        async onFinish() {
          const [cnf, pj] = await Promise.all([
            file.readJson(path.join(path.cwd(), CONF_NAME)),
            file.readJson(path.join(path.cwd(), 'package.json'))
          ]);
          const packageJson = (function computePackageJson() {
            const {
              dependencies: pjDep,
              devDependencies: pjDevDep,
              optionalDependencies: pjOptDep
            } = (pj ?? {}) as PackageJson;
            const {
              dependencies,
              devDependencies,
              optionalDependencies,
              ...rest
            } = sourceWorkspace?.packageJson ?? {};
            return omitBy(
              {
                ...pj,
                ...rest,
                dependencies:
                  pjDep || dependencies
                    ? { ...pjDep, ...dependencies }
                    : undefined,
                devDependencies: { ...pjDevDep, ...devDependencies },
                optionalDependencies:
                  pjOptDep || optionalDependencies
                    ? { ...pjOptDep, ...optionalDependencies }
                    : undefined
              },
              v => v == null
            ) as PackageJson;
          })();
          const confString = await SystemFormatter.json(
            JSON.stringify({
              ...cnf,
              ...sourceConfig
            })
          );
          const packageJsonString = await SystemFormatter.packageJson(
            JSON.stringify(packageJson)
          );
          task.writePackageToState(path.cwd(), {
            paths: null,
            path: path.cwd(),
            type: 'workspace',
            packageJson,
            packageJsonFileName: 'package.json',
            name: packageJson.name || '',
            category: null
          });
          return Promise.all([
            file.writeFile(path.join(path.cwd(), CONF_NAME), confString),
            file.writeFile(
              path.join(path.cwd(), 'package.json'),
              packageJsonString
            )
          ]);
        }
      });
      await executeAction(configActionMessage, true);
      return;
    }
    process.exit(0);
    return;
  }
  const systemCommands = getCommands();
  const customizedCommands = getCustomizedCommands();
  useCommand(
    program
      .name('pmnps')
      .description('This is a tool to build monorepo platforms.')
      .version('4.0.0'),
    initialAction
  );
  systemCommands.forEach(c => {
    const { name: commandName, options, action, description, args } = c;
    const prog = !args
      ? program.command(commandName)
      : program
          .command(commandName)
          .argument(
            '[' + args.param + ']',
            args.description || args.param,
            null
          );
    const programmer = (options ?? []).reduce((r, o) => {
      const [flags, description] = generateOption(o);
      r.option(flags, description);
      return r;
    }, prog);
    useCommand(programmer.description(description), action, c.requireRefresh);
  });

  customizedCommands.forEach(c => {
    const { name: commandName, options, action, description, args } = c;
    const prog = !args
      ? program.command(commandName)
      : program
          .command(commandName)
          .argument('[' + args.param + ']', args.description || args.param);
    const programmer = (options ?? []).reduce((r, o) => {
      const [flags, description] = generateOption(o);
      r.option(flags, description);
      return r;
    }, prog);
    useCommand(programmer.description(description), action, c.requireRefresh);
  });
  program.parse();
}
