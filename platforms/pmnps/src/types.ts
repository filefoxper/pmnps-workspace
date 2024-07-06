import type { Command } from '@pmnps/tools';

export interface PmnpsJson {
  ownRoot?: boolean;
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
  hasPackageLockJsonFile?: boolean;
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
  useRefreshAfterInstall: boolean;
  useNpmCi?: boolean;
}

export interface ConfigSetting {
  registry?: string;
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
  commands: Command[];
}

export interface Configuration {
  config: Config | undefined;
  templates: Template[];
}
