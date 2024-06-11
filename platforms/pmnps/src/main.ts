import { program } from 'commander';
import { hold } from '@/state';
import { configAction } from '@/actions/config';
import { refreshAction } from '@/actions/refresh';
import { createAction } from '@/actions/create';
import { useCommand } from '@/actions/task';
import { runAction, startAction } from '@/actions/run';
import { getPluginState } from '@/plugin';
import { env, file, path, inquirer } from './libs';
import { initialize, loadProject } from './processor';
import type { Action } from '@pmnps/tools';
import type { ActionMessage, Task } from '@/actions/task/type';
import type { ProjectType, Resource, State } from './types';

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

const getCommands = (
  projectType: ProjectType
): Array<[string, (...args: any[]) => Promise<ActionMessage>]> => {
  return projectType === 'monorepo'
    ? [
        ['start', startAction],
        ['refresh', refreshAction],
        ['create', createAction],
        ['config', configAction]
      ]
    : [
        ['start', startAction],
        ['refresh', refreshAction],
        ['config', configAction]
      ];
};

function getCustomizedCommands() {
  const customizedCommands = hold.instance().getCommands();
  const state = getPluginState();
  return customizedCommands
    .filter(({ name }) => name && name !== 'refresh')
    .map(c => {
      return {
        ...c,
        action: function commandAction(option?: any) {
          return c.action({ ...state, required: c.required }, option);
        }
      };
    });
}

async function initialAction() {
  const { projectType = 'monorepo' } = hold.instance().getState().config ?? {};
  const customizedCommands = getCustomizedCommands().map(
    ({ name, action }) => [name, action] as [string, Action]
  );
  const systemCommands = getCommands(projectType);
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
  return action();
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
  const customizedCommands = getCustomizedCommands();
  useCommand(
    program
      .name('pmnps')
      .description('This is a tool to build monorepo platforms.')
      .version('4.0.0'),
    initialAction,
    true
  );
  useCommand(
    program
      .command('refresh')
      .description('Refresh and install project dependencies.'),
    refreshAction
  );
  useCommand(
    program
      .command('create')
      .argument(
        '[string]',
        'Choose creating target from: package, platform, scope, template',
        null
      )
      .description('Create package, platform, scope or template'),
    createAction,
    true
  );
  useCommand(
    program
      .command('start')
      .option('-a, --all', 'Starts all platforms and packages.')
      .option(
        '-n, --name <char>',
        'Enter the name of starting package or platform.'
      )
      .option(
        '-g, --group <char>',
        'Enter a group name for starting packages and platforms.'
      )
      .description('Run start script in packages or platforms'),
    startAction,
    true
  );
  useCommand(
    program
      .command('run')
      .argument('script')
      .option('-a, --all', 'Executing scripts in all package or platforms.')
      .option(
        '-n, --name <char>',
        'Enter the package or platform name for executing script.'
      )
      .option(
        '-g, --group <char>',
        'Enter a group name for executing scripts in package or platforms.'
      )
      .description('Run script in packages or platforms'),
    runAction,
    true
  );
  useCommand(
    program.command('config').description('Config pmnps workspace'),
    configAction
  );
  customizedCommands.forEach(c => {
    const { name: commandName, options, action, description } = c;
    const prog = program.command(commandName);
    (options ?? []).forEach(o => {
      const { inputType } = o;
      prog.option(
        inputType === 'string'
          ? `-${o.shortcut} --${o.name} <char>`
          : `-${o.shortcut} --${o.name}`,
        o.description
      );
    });
    useCommand(prog.description(description), action);
  });
  program.parse();
}
