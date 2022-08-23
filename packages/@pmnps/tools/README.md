# @pmnps/tools

This package provides some tools for writing plugins.

## API

### message

You can use this api to log what happens in your plugin.

```typescript
declare type Message = {
  error(message: string): void;
  info(message: string): void;
  log(message: string): void;
  success(message: string): void;
  desc(message: string): void;
  warn(message: string): void;
};

export declare const message: Message;
```

For example, you can use it to warn some messages in plugin.

```typescript
import {structure} from '@pmnps/core';
import {message} from '@pmnps/tools';

export default function reactPlugin(){
  return {
    // is optional
    isOption:true,
    // require react version
    requires:['react'],
    renders:{
      // accept required react version,
      // only run in create command
      create([reactVersion]){
        if(!reactVersion){
            message.error('require react version failed');
            return;
        }
        message.info(`use react@${reactVersion}`);
        if(reactVersion.startsWith('15')){
            message.warn('react version is too old.');
        }
      }
    }
  }
}
```

### executeContext

This API helps to manage the executions.

```typescript
declare type Execution = {
  exec(
    file: string,
    params: string[],
    options?: execa.Options
  ): execa.ExecaChildProcess;
  command(params: string, options?: execa.Options): execa.ExecaChildProcess;
  npx(params: string | string[],options?: execa.Options): execa.ExecaChildProcess;
};

declare type Executor<T> = (execution: Execution) => Promise<T>;

export declare function executeContext<T = void>(
  executor: Executor<T>,
): Promise<T>;
```

It use `execa`, and manage the executions.

```typescript
import {path,structure} from '@pmnps/core'
import {executeContext} from '@pmnps/tools';

const {platforms} = structure.packageJsons();


await executeContext(({exec,npx})=>{
    const json = platforms.find(({name})=>name==='web-app');
    if(!json){
        return;
    }
    const cwd = json.getDirPath?.();
    return Promise.all([
        exec('npm',['start'],{cwd}),
        npx(['prettier','--write','./package.json'],{cwd})
    ]);
});
```

When the `pmnps` is canceled manually, the executeContext will kill the executions in it.

