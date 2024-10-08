/** State **/
import type { LockResolverState } from '../index';

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
  optionalDependencies?: Record<string, string>;
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

export type ScopeSerial = {
  name: string;
  path: string;
  packages: string[];
};

export interface ProjectSerial {
  type: ProjectType;
  path: string;
  name: string;
  packageMap: Record<string, string>;
  project: {
    workspace?: Package;
    scopes?: ScopeSerial[];
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

export type LockResolver = {
  core: 'npm' | 'yarn' | 'yarn2' | 'pnpm';
  filename: string;
  lockfileVersion?: number;
  relativePath?: string;
  formatter?: (source: string) => Promise<string>;
  resolver: (lockContent: string, info: LockResolverState) => [string, boolean];
};

export type Config = {
  name: string;
} & ConfigDetail &
  ConfigSetting &
  ConfigPlugins;

export interface State {
  config?: Config;
  project?: Project;
  cacheProject?: Project;
  commands?: Record<string, Record<string, any>>;
}

export interface Template {
  projectType: 'package' | 'platform';
  path: string;
  name: string;
}

export interface Resource {
  templates: Template[];
}

export interface Configuration {
  config: Config | undefined;
  templates: Template[];
}

/** Task **/

export type CommandSerial = string[];

export interface WriteTask {
  type: 'write';
  fileType: 'file' | 'dir';
  path: string;
  file: string;
  content: string | object | ((c: string | null) => string | null);
  cwd?: string;
  dirSource?: string;
  option?: {
    formatter?: 'json' | ((content: string) => Promise<string>);
    skipIfExist?: true;
    command?: CommandSerial[];
  };
}

export interface PackageTask extends WriteTask {
  packageType: PackageType;
  paths: string[] | null;
}

export interface ExecuteTask {
  type: 'exec';
  command: CommandSerial;
  cwd?: string;
  description?: string;
}

export interface Execution {
  command: CommandSerial;
  cwd?: string;
  description?: string;
}

export type Task = WriteTask | ExecuteTask | PackageTask;

export type ActionMessage<P = unknown> = {
  type: 'success' | 'failed' | 'warning';
  content: string;
  payload?: P;
};
