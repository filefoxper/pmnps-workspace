import { program } from 'commander';
import { hold } from '@/state';
import { configAction } from '@/actions/config';
import { refreshAction } from '@/actions/refresh';
import { createAction } from '@/actions/create';
import { useCommand } from '@/actions/task';
import { env, file, path, inquirer } from './libs';
import { initialize, loadProject } from './processor';
import type { ActionMessage, Task } from '@/actions/task/type';
import type { State } from './types';

declare global {
  // eslint-disable-next-line no-var
  var pmnps: {
    cwd?: string;
    env?: { node: string; npm: string };
    holder: ReturnType<typeof hold>;
    state: State;
    load: (withCache?: boolean) => Promise<any>;
    tasks: Task[];
  };
}

const commands: Array<[string, (...args: any[]) => Promise<ActionMessage>]> = [
  ['refresh', refreshAction],
  ['create', createAction],
  ['config', configAction]
];

async function initialAction() {
  const commandDesc = commands.map(([des]) => des);
  const { command } = await inquirer.prompt([
    {
      name: 'command',
      type: 'list',
      message: 'Use command:',
      choices: commandDesc,
      default: commandDesc[0]
    }
  ]);
  const commandMap = new Map(commands);
  const action = commandMap.get(command);
  if (!action) {
    return null;
  }
  return action();
}

export async function startup() {
  global.pmnps = {
    holder: hold(),
    load: loadProject,
    state: {},
    tasks: []
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
  useCommand(
    program
      .name('pmnps')
      .description('This is a tool to build monorepo platforms.')
      .version('4.0.0'),
    initialAction
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
    createAction
  );
  program.parse();
}
