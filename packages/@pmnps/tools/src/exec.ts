import { Executor } from './type';
import { env, ExecaChildProcess, ExecaOptions, execution } from '@pmnps/core';
import message from "./message";

const { killChildProcess } = execution;

declare global {
  var pmnps: {
    pidStats?: Map<number, ExecaChildProcess>;
  };
}

function killChildProcesses() {
  [...(global.pmnps!.pidStats||[])].forEach((d)=>{
    try {
      killChildProcess(d)
    }catch (e){
      message.warn('This process may has been stopped yet.');
    }
  });
  process.exit();
}

function executeContext<T = void>(executor: Executor<T>): Promise<T> {
  global.pmnps=global.pmnps||{};
  global.pmnps.pidStats = global.pmnps.pidStats||new Map<number, ExecaChildProcess>();
  function record(process: ExecaChildProcess) {
    const { pid } = process;
    if (pid != null) {
      global.pmnps.pidStats!.set(pid, process);
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

  return executor({ exec, command, npx });
}

if (env.IS_WINDOWS) {
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('SIGINT', function () {
    process.emit('SIGINT');
  });

  rl.on('SIGTERM', function () {
    process.emit('SIGTERM');
  });
}

process.on('SIGINT', () => {
  killChildProcesses();
});

process.on('SIGTERM', () => {
  killChildProcesses();
});

export { executeContext };
