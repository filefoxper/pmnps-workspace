import execa from 'execa';

export declare type Execution = {
  exec(
    file: string,
    params: string[],
    options?: execa.Options
  ): execa.ExecaChildProcess;
  command(params: string, options?: execa.Options): execa.ExecaChildProcess;
  npx(
    params: string | string[],
    options?: execa.Options
  ): execa.ExecaChildProcess;
};

export declare type Executor<T> = (execution: Execution) => Promise<T>;
