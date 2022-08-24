import { Executor } from './type';
import { env, ExecaChildProcess, ExecaOptions, execution } from '@pmnps/core';

const { killChildProcess } = execution;

function killChildProcesses(pidStats: Map<number, ExecaChildProcess>) {
  [...pidStats].forEach(killChildProcess);
  process.exit();
}

function executeContext<T = void>(executor: Executor<T>): Promise<T> {
  const pidStats = new Map<number, ExecaChildProcess>();
  function record(process: ExecaChildProcess) {
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
    params?: string[] | ExecaOptions,
    options?: ExecaOptions
  ): ExecaChildProcess {
    if (Array.isArray(params)) {
      return record(execution.exec(file, params, options));
    }
    return record(execution.exec(file, params));
  }

  function command(params: string, options?: ExecaOptions): ExecaChildProcess {
    return record(execution.command(params, options));
  }

  function npx(
    params: string | string[],
    options?: ExecaOptions
  ): ExecaChildProcess {
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
