import execa from 'execa';
import { env } from '../env';

function exec(
  file: string,
  params?: string[] | execa.Options,
  options?: execa.Options
): execa.ExecaChildProcess {
  if (Array.isArray(params)) {
    return execa(file, params, options);
  }
  return execa(file, params);
}

function command(
  params: string,
  options?: execa.Options
): execa.ExecaChildProcess {
  return execa.command(params, options);
}

function killChildProcess([pid, process]: [
  number,
  execa.ExecaChildProcess
]): void {
  if (env.platform === 'windows') {
    execa.commandSync(`taskkill /f /t /pid ${pid}`);
  } else {
    process.kill('SIGKILL');
  }
}

export const execution = {
  exec,
  command,
  execute: execa,
  killChildProcess
};
