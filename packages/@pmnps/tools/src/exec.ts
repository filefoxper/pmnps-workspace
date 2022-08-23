import execa from 'execa';
import { Executor } from './type';
import { env } from '@pmnps/core';

function killChildProcess([pid, process]: [number, execa.ExecaChildProcess]) {
  if (env.IS_WINDOWS) {
    execa.commandSync(`taskkill /f /t /pid ${pid}`);
  } else {
    process.kill('SIGKILL');
  }
}

function killChildProcesses(pidStats: Map<number, execa.ExecaChildProcess>) {
  [...pidStats].forEach(killChildProcess);
  process.exit();
}

function executeContext<T = void>(executor: Executor<T>): Promise<T> {
  const pidStats = new Map<number, execa.ExecaChildProcess>();
  function record(process: execa.ExecaChildProcess) {
    const { pid } = process;
    if (pid != null) {
      pidStats.set(pid, process);
      Promise.resolve(process).finally(() => {
        if (pidStats.has(pid)) {
          pidStats.delete(pid);
        }
      });
    }
    return process;
  }

  function exec(
    file: string,
    params: string[],
    options?: execa.Options
  ): execa.ExecaChildProcess {
    return record(execa(file, params, options));
  }

  function command(
    params: string,
    options?: execa.Options
  ): execa.ExecaChildProcess {
    return record(execa.command(params, options));
  }

  function npx(
    params: string | string[],
    options?: execa.Options
  ): execa.ExecaChildProcess {
    if (Array.isArray(params)) {
      return exec('npx', params, options);
    }
    return command(`npx ${params}`, options);
  }

  if (env.IS_WINDOWS) {
    var rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('SIGINT', function () {
      process.emit('SIGINT');
    });
  }

  process.on('SIGINT', () => {
    killChildProcesses(pidStats);
  });

  process.on('SIGTERM', () => {
    killChildProcesses(pidStats);
  });

  return executor({ exec, command, npx });
}

export { executeContext };
