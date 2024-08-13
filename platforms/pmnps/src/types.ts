import type {
  Command,
  Config,
  Package,
  PackageLockInfo,
  Project,
  ProjectType
} from '@pmnps/tools';

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
    customized?: Package[];
    platforms?: Package[];
  };
}

export interface State {
  config?: Config;
  project?: Project;
  cacheProject?: Project;
  commands?: Record<string, Record<string, any>>;
  dynamicState?: Record<string, PackageLockInfo>;
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
