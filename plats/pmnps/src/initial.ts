import { program } from 'commander';
import { env, config, inquirer } from '@pmnps/core';
import { message } from '@pmnps/tools';
import { commandRefresh, refreshAction } from './commands/refresh.command';
import { commandConfig, configAction } from './commands/config.command';
import { commandCreate, emptyCreateAction } from './commands/create.command';
import { commandStart, startAction } from './commands/start.command';
import { commandBuild, buildAction } from './commands/build.command';
import { commandPublish, publishAction } from './commands/publish.command';
import { commandUpdate, updateAction } from './commands/update.command';

const commands: Array<[string, (...args: any[]) => Promise<any>]> = [
  ['start', startAction],
  ['build', buildAction],
  ['refresh', refreshAction],
  ['create', emptyCreateAction],
  ['config', configAction],
  ['update', updateAction],
  ['publish', publishAction]
];

const commandMap = new Map<string, (...args: any[]) => Promise<any>>(commands);

async function initialAction() {
  const rootConfig = config.readConfig();
  if (!rootConfig) {
    await configAction();
    return;
  } else {
    const { command } = await inquirer.prompt([
      {
        name: 'command',
        type: 'list',
        message: 'Choose the command you want to use:',
        choices: [...commandMap.keys()]
      }
    ]);
    const action = commandMap.get(command);
    if (!action) {
      message.log('No command has been selected.');
      return;
    }
    await action();
  }
}

async function initial() {
  message.desc('Welcome to pmnps!');
  const envSupport = await env.initial();
  if (!envSupport) {
    message.warn('pmnps supported by nodejs>=16.7.0 & npm>=7.7.0');
    return;
  }
  program
    .name('pmnps')
    .description('This is a tool to build monorepo platforms.')
    .version('3.0.0')
    .action(initialAction);
  commandRefresh(program);
  commandConfig(program);
  commandCreate(program);
  commandStart(program);
  commandBuild(program);
  commandUpdate(program);
  commandPublish(program);
  program.parse();
}

export { initial };
