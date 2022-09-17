export type Pmnps = {
  platDependencies?: string[];
  ownRoot?: boolean;
  alias?: string;
  buildHook?: { before?: string; after?: string };
};

export type PackageJson = {
  name: string;
  description?: string;
  main?: string;
  module?: string;
  type?: string;
  typings?: string;
  bin?: string | Record<string, any>;
  preferGlobal?: boolean;
  files?: string[];
  private?: boolean;
  scripts?: Record<string, string>;
  version?: string;
  workspaces?: Array<string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  deps?: Array<PackageJson>;
  dets?: Array<PackageJson>;
  level?: number;
  used?: boolean;
  pmnps?: Pmnps;
  getDirPath?: ()=>string;
};

export type ProjectType = 'package' | 'platform' | 'root';

export type StructureActionType = 'create' | 'write';

export type StructureStatus = 'create' | 'write';

export type StructureNodeType = 'dir' | 'file';

export type StructureNode = {
  name: string;
  path: string;
  type: StructureNodeType;
  content?: string | ((c: string) => string);
  action?: StructureActionType;
  status?: StructureStatus;
  alter?: boolean;
  parent?: StructureNode | StructureRoot;
  alterName?: string;
  alterParent?: StructureNode | StructureRoot;
  projectType?: ProjectType;
  isPackageJson?: boolean;
  children?: StructureNode[];
  commands?:('prettier'|'git')[];
  write(
    children?:
      | string
      | ((content: string) => string)
      | (StructureNode | undefined | null)[]
  ): StructureNode;
  rename(name: string): StructureNode;
  find(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
  filter(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
  order(commands:('prettier'|'git')[]):StructureNode;
};

export type StructureRoot = {
  path: string;
  type: 'root';
  children: StructureNode[];
  alter?: boolean;
  modified?:boolean;
  write(
    children:
      | string
      | (StructureNode | undefined | null)[]
      | ((content: string) => string)
  ): StructureRoot;
  find(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
  filter(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
};

export type PackageJsons = {
  root?: PackageJson;
  packages: PackageJson[];
  platforms: PackageJson[];
};

export type Diff = {
  additions: Array<[string, StructureNode]>;
  modifies: Array<[string, StructureNode]>;
  commands:Array<[string,StructureNode]>
};

export type Plugin = string | [string] | [string, Record<string | number, any>];

export type PluginType = 'refresh' | 'create' | 'build' | 'start';

export type PluginRender = (requires: string[]) => Promise<boolean>;

export type PluginRenders = {
  refresh?: PluginRender;
  create?: PluginRender;
  build?: PluginRender;
  start?: PluginRender;
};

export type PluginPack = {
  renders: PluginRenders;
  isOption?: boolean;
  displayName?: string;
  requires?: string[];
};

export type PluginComponent = (
  query?: Record<string | number, any>
) => PluginPack;

export type PluginSource = {
  name: string;
  query?: Record<string | number, any>;
};

export type TemplateComponent = {
  projectType: ProjectType;
  path: string;
};

export type TemplatePack = {
  name: string;
  projectType: ProjectType;
  path: string;
};

export type Config = {
  workspace: string;
  git?: boolean;
  buildByDependencies?: boolean;
  plugins?: Plugin[];
  templates?: string[];
  private?: boolean;
  publishable?: boolean;
  useOldDefineName?: boolean;
  createWithReadme?: boolean;
};

export type RebuildTools = {
  file(
    name: string,
    payload?: string | Record<string | number, any>
  ): StructureNode;
  dir(
    name: string,
    payload?: (StructureNode | undefined | null)[]
  ): StructureNode;
  write(
    node: StructureNode | StructureRoot,
    payload?:
      | string
      | (StructureNode | undefined | null)[]
      | ((content: string) => string)
  ): StructureNode | StructureRoot;
  rename(node: StructureNode, name: string): StructureNode;
  res: {
    readme(content?: string): StructureNode;
    npmrc(content?: string): StructureNode;
    npmForbiddenRc(): StructureNode;
    gitignore(content?: string): StructureNode;
    prettierrc(content?: string | Record<string, any>): StructureNode;
  };
};

export type RebuildCallback = (
  root: StructureRoot,
  tools: RebuildTools
) => void;
