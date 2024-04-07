export interface PmnpsJson {
  ownRoot?: boolean;
}

export interface PackageJson {
  name?: string;
  author?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces: Array<string>;
  pmnps?: PmnpsJson;
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
  usePerformanceFirst: boolean;
}

export interface ConfigSetting {
  registry?: string;
}

export type Config = {
  name: string;
} & ConfigDetail &
  ConfigSetting;

export interface State {
  config?: Config;
  project?: Project;
  cacheProject?: Project;
}
