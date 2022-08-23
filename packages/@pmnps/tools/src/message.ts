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

const message = { error, info, success, desc, warn, log };

export default message;
