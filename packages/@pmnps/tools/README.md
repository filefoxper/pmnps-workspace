# @pmnps/tools

This package provides some tools for writing plugins for [pmnps](https://www.npmjs.com/package/pmnps).

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

### execution

This API helps to manage the executions.

```typescript
import type execa from 'execa';

export declare const execution: {
  exec(
    file: string,
    params?: string[] | execa.Options,
    options?: execa.Options
  ): execa.ExecaChildProcess;
  command(params: string, options?: execa.Options): execa.ExecaChildProcess;
  execute: typeof execa;
  killChildProcess([pid, process]: [number, execa.ExecaChildProcess]): void;
};
```

### createPluginCommand

This API helps to create a plugin command.

```typescript
declare type PluginSlot = {
  name: string;
  option(
    optionName: string,
    shortcut: string,
    optional?: { description?: string; inputType?: 'string' | 'boolean' }
  ): PluginSlot;
  describe(description: string): PluginSlot;
  require(requireFn: RequireFn): PluginSlot;
  action(action: Action): Command;
};

export declare function createPluginCommand(name: string): PluginSlot;
```

### inquirer

This API helps to create a prompt for the user.

```typescript
import type { Answers, QuestionCollection, ui, Separator } from 'inquirer';

declare function prompt<T extends Answers = Answers>(
  questions: QuestionCollection<T>,
  initialAnswers?: Partial<T>
): Promise<T> & { ui: ui.Prompt<T> };

export declare const inquirer: {
  prompt: typeof prompt;
  Separator: typeof Separator;
};
```