import { Executor } from './type';
import { ExecaChildProcess, ExecaOptions, execution } from '@pmnps/core';

declare global {
  var pmnps: {
    pidStats?: Map<number, ExecaChildProcess>;
  };
}

function executeContext<T = void>(executor: Executor<T>): Promise<T> {

  function record(process: ExecaChildProcess) {
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

  return executor({ exec, command, npx });
}

export { executeContext };
