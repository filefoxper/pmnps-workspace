import type {
  Config,
  Project,
  CommandSerial,
  PackageJson,
  PackageType
} from '../types';

export type Task = {
  write(
    p: string,
    fileName: string,
    content: string | object | ((c: string | null) => string | null) | null,
    config?: {
      skipIfExist?: true;
      command?: CommandSerial[];
      formatter?: (c: string) => Promise<string>;
    }
  ): any;
  writeConfig(config: Config | ((c: Config) => Config)): any;
  writeCommandCache(
    command: string,
    data:
      | Record<string, any>
      | ((d: Record<string, any> | undefined) => Record<string, any>)
  ): any;
  writeDir(
    p: string | Array<string>,
    config?: { relative?: boolean; source?: string; command?: CommandSerial[] }
  ): any;
  writeScope(scopeName: string): any;
  writePackage(pack: {
    paths: string[] | null;
    packageJson:
      | PackageJson
      | null
      | ((json: PackageJson | null) => PackageJson | null);
    type: PackageType;
  }): any;
  execute(command: CommandSerial, cwd: string, description?: string): any;
};

export type CommandOption = {
  name: string;
  shortcut: string;
  description: string;
  inputType: 'string' | 'boolean';
};

export type ActionMessage = {
  type: 'success' | 'failed' | 'warning';
  content: string;
  payload?: unknown;
};

type Reader = {
  read(p: string): Promise<string | null>;
  readJson<D>(p: string): Promise<D | null>;
};

export type RequireFn = <O extends Record<string, any>>(
  state: {
    getProject: () => Project;
    getConfig: () => Config;
    reader: Reader;
    cwd: () => string;
  },
  option?: O
) => Promise<any>;

export type Action = <O extends Record<string, any>>(
  state: {
    getProject: () => Project;
    getConfig: () => Config;
    task: Task;
    cwd: () => string;
    required?: Promise<any>;
  },
  option?: O
) => Promise<ActionMessage>;

export type Command = {
  name: string;
  require?: RequireFn;
  options?: CommandOption[];
  action: Action;
  required?: Promise<any>;
  description: string;
};
