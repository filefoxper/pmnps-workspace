import { ExecaChildProcess, ExecaOptions } from '@pmnps/core';

declare type Execution = {
  exec(
    file: string,
    params?: string[] | ExecaOptions,
    options?: ExecaOptions
  ): ExecaChildProcess;
  command(params: string, options?: ExecaOptions): ExecaChildProcess;
  npx(params: string | string[], options?: ExecaOptions): ExecaChildProcess;
};

declare type Executor<T> = (execution: Execution) => Promise<T>;

export declare function executeContext<T = void>(
  executor: Executor<T>
): Promise<T>;

declare type Message = {
  error(message: string): void;
  info(message: string): void;
  log(message: string): void;
  success(message: string): void;
  desc(message: string): void;
  warn(message: string): void;
};

export declare const message: Message;
