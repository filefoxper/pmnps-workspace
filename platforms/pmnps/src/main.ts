import { program } from 'commander';
import { createPluginCommand } from '@pmnps/tools';
import { hold } from '@/state';
import { configAction } from '@/actions/config';
import { refreshAction } from '@/actions/refresh';
import { createAction } from '@/actions/create';
import { useCommand } from '@/actions/task';
import { runAction, startAction } from '@/actions/run';
import { getPluginState } from '@/plugin';
import { env, file, path, inquirer, message } from './libs';
import { initialize, loadProject } from './processor';
import type { Command } from '@pmnps/tools';
import type { CommandOption } from '@pmnps/tools/src/plugin/type';
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
  const { projectType = 'monorepo' } = hold.instance().getState().config ?? {};
  return actCommands(
    projectType === 'monorepo'
      ? ([
          startCommand,
          runCommand,
          refreshCommand,
          createCommand,
          configCommand
        ] as Command[])
      : ([startCommand, runCommand, refreshCommand, configCommand] as Command[])
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
  const customizedCommands = getCustomizedCommands().map(
    ({ name, action }) =>
      [name, action] as [string, (...a: any[]) => Promise<ActionMessage>]
  );
  const systemCommands = getCommands().map(
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
  global.pmnps = {
    holder: hold(),
    load: loadProject,
    resources: { templates: [], commands: [] },
    state: {},
    tasks: [],
    isDevelopment
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
    await configAction();
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
