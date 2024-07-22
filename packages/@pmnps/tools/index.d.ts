import type execa from 'execa';
import type { Answers, QuestionCollection, ui, Separator } from 'inquirer';

export type CommandSerial = string[];

export interface PmnpsJson {
  ownRoot?: boolean | 'flexible' | 'independent';
  slot?: 'template';
}

export interface PackageJson {
  private?: boolean;
  name?: string;
  author?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces: Array<string>;
  pmnps?: PmnpsJson;
  scripts?: Record<string, string>;
}

export type PackageType = 'package' | 'platform' | 'workspace';

export interface Package {
  path: string;
  paths: string[] | null;
  name: string;
  packageJson: PackageJson;
  packageJsonFileName: string;
  type: PackageType;
}

export type Scope = {
  name: string;
  path: string;
  packages: Package[];
};

export type ProjectType = 'monorepo' | 'classify';

export interface Project {
  type: ProjectType;
  path: string;
  name: string;
  packageMap: Record<string, Package>;
  project: {
    workspace?: Package;
    scopes?: Scope[];
    packages?: Package[];
    platforms?: Package[];
  };
}

export interface ConfigDetail {
  projectType: ProjectType;
  private: boolean;
  useGit: boolean;
  useCommandHelp: boolean;
  usePerformanceFirst: boolean;
  useRefreshAfterInstall: boolean;
  useNpmCi?: boolean;
}

export interface ConfigSetting {
  registry?: string;
  core?: 'npm' | 'yarn' | 'yarn2';
  installParameters?: string;
}

export interface ConfigPlugins {
  templates?: string[];
  plugins?: (string | [string, Record<string, any>])[];
}

export type Config = {
  name: string;
} & ConfigDetail &
  ConfigSetting &
  ConfigPlugins;

/** types **/
export declare type CommandOption = {
  name: string;
  shortcut: string;
  description: string;
  inputType?: string;
};

declare type ActionMessage = {
  type: 'success' | 'failed' | 'warning';
  content: string;
  payload?: unknown;
  requireRefresh?: boolean;
};

declare type Task = {
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

declare type Reader = {
  read(p: string): Promise<string | null>;
  readJson<D extends Record<string, any>>(p: string): Promise<D | undefined>;
};

declare type Writer = {
  write(locationPath: string, data: string): Promise<string>;
  writeJson(locationPath: string, json: Record<string, any>): Promise<string>;
};

export declare type Action = <O extends Record<string, any>>(
  state: {
    getProject: () => Project;
    getConfig: () => Config;
    task: Task;
    cwd: () => string;
    required?: Promise<any>;
    reader: Reader;
    writer: Writer;
  },
  argument: string | undefined,
  option?: O
) => Promise<ActionMessage>;

declare type RequireFn = <O extends Record<string, any>>(
  state: {
    getProject: () => Project;
    getConfig: () => Config;
    reader: Reader;
    writer: Writer;
    cwd: () => string;
  },
  option?: O
) => Promise<any>;

export declare type Command = {
  name: string;
  options?: CommandOption[];
  require?: RequireFn;
  action: Action;
  required?: Promise<any>;
  description: string;
  args?: { param: string; description: string };
  requireRefresh?: boolean;
};

export declare type Plugin<S extends Record<string, any>> = (
  setting?: S
) => Command;

declare function prompt<T extends Answers = Answers>(
  questions: QuestionCollection<T>,
  initialAnswers?: Partial<T>
): Promise<T> & { ui: ui.Prompt<T> };

declare type MessageLog = (mess: string) => void;

declare type PluginSlot = {
  name: string;
  args(param: string, description: string): PluginSlot;
  requireRefresh(): PluginSlot;
  option(
    optionName: string,
    shortcut: string,
    optional?: { description?: string; inputType?: string }
  ): PluginSlot;
  describe(description: string): PluginSlot;
  require(requireFn: RequireFn): PluginSlot;
  action(action: Action): Command;
};

export { ExecaSyncReturnValue } from 'execa';

/** methods **/

export declare const inquirer: {
  prompt: typeof prompt;
  Separator: typeof Separator;
};

export declare const message: {
  error: MessageLog;
  info: MessageLog;
  success: MessageLog;
  desc: MessageLog;
  warn: MessageLog;
  log: MessageLog;
  debug: (...messages: any[]) => void;
  result: (
    mess:
      | {
          type: 'success' | 'failed' | 'warning';
          content: string;
        }
      | null
      | undefined
  ) => void;
};

export declare function createPluginCommand(name: string): PluginSlot;

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

export declare function requireFactory(cwd: string): {
  require: (pathname: string) => Promise<{ pathname: string; module: any }>;
};

export declare const versions: {
  satisfies(version: string, range: string): boolean;
};
