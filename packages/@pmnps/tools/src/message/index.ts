import console from 'console';
import chalk from 'chalk';

function error(message: string): void {
  console.log(chalk.red(message));
}

function info(message: string): void {
  console.log(chalk.blue(message));
}

function log(message: string): void {
  console.log(chalk.black.bold(message));
}

function success(message: string): void {
  console.log(chalk.green(message));
}

function desc(message: string): void {
  console.log(chalk.gray(message));
}

function warn(message: string): void {
  console.log(chalk.magenta(message));
}

function debug(...messages: any[]) {
  console.log(chalk.blue.bold(messages));
}

function result(
  message:
    | {
        type: 'success' | 'failed' | 'warning';
        content: string;
      }
    | null
    | undefined
) {
  if (message == null) {
    return;
  }
  if (message.type === 'success') {
    success(message.content);
    return;
  }
  if (message.type === 'failed') {
    error(message.content);
    return;
  }
  warn(message.content);
}

export const message = { error, info, success, desc, warn, log, debug, result };
