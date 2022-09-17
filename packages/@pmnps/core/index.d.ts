import { Answers, QuestionCollection, ui,Separator } from 'inquirer';
import execa from 'execa';

/* * types * */
export declare type Pmnps = {
  platDependencies?: string[];
  ownRoot?: boolean;
  alias?: string;
  buildHook?: { before?: string; after?: string };
};

export declare type PackageJson = {
  name: string;
  description?: string;
  private?: boolean;
  main?: string;
  module?: string;
  type?: string;
  typings?: string;
  files?: string[];
  bin?: string | Record<string, any>;
  preferGlobal?: boolean;
  scripts?: Record<string, string>;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  deps?: Array<PackageJson>;
  dets?: Array<PackageJson>;
  level?: number;
  used?: boolean;
  pmnps?: Pmnps;
  getDirPath?: () => string;
};

export declare type PackageJsons = {
  root?: PackageJson;
  packages: PackageJson[];
  platforms: PackageJson[];
};

export declare type Plugin =
  | string
  | [string]
  | [string, Record<string | number, any>];

export declare type Config = {
  workspace: string;
  git?: boolean;
  buildByDependencies?: boolean;
  plugins?: Plugin[];
  private?: boolean;
  publishable?: boolean;
  useOldDefineName?: boolean;
  createWithReadme?: boolean;
};

export declare type ProjectType = 'package' | 'platform' | 'root';

export declare type StructureStatus = 'write' | 'create';

export declare type StructureNodeType = 'dir' | 'file';

export declare type StructureNode = {
  name: string;
  path: string;
  type: StructureNodeType;
  content?: string | ((c: string) => string);
  status?: StructureStatus;
  parent?: StructureNode | StructureRoot;
  projectType?: ProjectType;
  isPackageJson?: boolean;
  children?: StructureNode[];
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

export declare type StructureRoot = {
  path: string;
  type: 'root';
  children: StructureNode[];
  write(
    children:
      | string
      | ((content: string) => string)
      | (StructureNode | undefined | null)[]
  ): StructureRoot;
  find(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
  filter(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
};

export declare type Diff = {
  additions: Array<[string, StructureNode]>;
  modifies: Array<[string, StructureNode]>;
};

export declare type ExecaChildProcess = execa.ExecaChildProcess;

export declare type ExecaSyncReturnValue = execa.ExecaSyncReturnValue;

export declare type ExecaOptions = execa.Options;

declare type RebuildTools = {
  file(
    name: string,
    payload?: string | Record<string | number, any>
  ): StructureNode;
  dir(
    name: string,
    payload?: (StructureNode | undefined | null)[]
  ): StructureNode;
  write<T extends StructureNode | StructureRoot>(
    node: T,
    payload?:
      | string
      | (StructureNode | undefined | null)[]
      | ((content: string) => string)
  ): T extends StructureNode ? StructureNode : StructureRoot;
  rename(node: StructureNode, name: string): StructureNode;
  res: {
    readme(content?: string): StructureNode;
    npmrc(content?: string): StructureNode;
    npmForbiddenRc(): StructureNode;
    gitignore(content?: string): StructureNode;
    prettierrc(content?: string | Record<string, any>): StructureNode;
  };
};

declare type RebuildCallback = (
  root: StructureRoot,
  tools: RebuildTools
) => void;

export declare type PluginType = 'refresh' | 'create' | 'build' | 'start';

export declare type PluginRender = (requires: string[]) => Promise<boolean>;

export declare type PluginRenders = {
  refresh?: PluginRender;
  create?: PluginRender;
  build?: PluginRender;
  start?: PluginRender;
};

export declare type PluginPack = {
  renders: PluginRenders;
  isOption?: boolean;
  displayName?: string;
  requires?: string[];
};

export declare type PluginComponent = (
  query?: Record<string | number, any>
) => PluginPack;

export declare type InAnswers = Answers;

export declare type Prompt<T> = ui.Prompt<T>;

export declare type InQuestions<T> = QuestionCollection<T>;

/* * methods and constants * */
export declare const define: {
  PACKAGE_DIR_NAME: string;
  PLATFORM_DIR_NAME: string;
  CONFIG_FILE_NAME: string;
  README_FILE_NAME: string;
  PRETTIER_RC_FILE_NAME: string;
  GIT_IGNORE_FILE_NAME: string;
  NPM_RC_FILE_NAME: string;
  platformDirName(): string;
};

export declare const path: {
  rootPath: string;
  packagesPath(): string;
  platformsPath(): string;
  join(...params: (string | null | undefined)[]): string;
};

export declare const file: {
  readdir(dirPath: string): Promise<string[]>;
  mkdir(dirPath: string): Promise<boolean>;
  mkdirIfNotExist(dirPath: string): Promise<boolean>;
  readFile(locationPath: string): Promise<string>;
  writeFile(locationPath: string, data: string): Promise<string>;
  readJson<T extends Record<string, any>>(
    locationPath: string
  ): Promise<T | undefined>;
  writeJson(locationPath: string, json: Record<string, any>): Promise<string>;
  createFile(filePath: string, content: string = ''): Promise<string>;
  createFileIfNotExist(filePath: string, content: string = ''): Promise<void>;
  createFileIntoDirIfNotExist(
    dirPath: string,
    filename: string,
    ends?: string[]
  ): Promise<void>;
  copyFolder(sourceDirPath: string, targetDirPath: string): Promise<boolean>;
  unlink(filePath: string): Promise<boolean>;
  isFile(pathname: string): Promise<boolean>;
  isDirectory(pathname: string): Promise<boolean>;
  rmdir(filePath: string): Promise<boolean>;
  rename(sourcePath: string, targetPath: string): Promise<boolean>;
};

export declare const env: {
  IS_WINDOWS: boolean;
  IS_DEV: boolean;
  versionCompare(v1: string, v2: string): boolean;
  isEnvSupport(): Promise<boolean>;
  initial(): Promise<boolean>;
};

export declare const structure: {
  root(): StructureRoot;
  alterRoot(): StructureRoot;
  packageJsons(): PackageJsons;
  rebuild(redoCallback: RebuildCallback): StructureRoot;
  flush(): Promise<void>;
  filter(
    root: StructureRoot | StructureNode,
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
  find(
    root: StructureRoot | StructureNode,
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
};

export declare const config: {
  loadConfig(): Promise<Config | null>;
  readConfig(): Config | null;
  writeConfig(config: Partial<Config>): void;
  flushConfig(): Promise<void>;
};

export declare const resource: {
  defaultPackageJson: PackageJson;
  prettier: string;
  gitignore: string;
  forbiddenNpmrc: string;
};

export declare const pkgJson: {
  writeRootPackageJson(packageJson: PackageJson): Promise<PackageJson>;
  refreshRootPackageJson(): PackageJson;
};

export declare const plugin: {
  runPlugin(type: PluginType): Promise<boolean>;
};

export declare const requires: {
  require(name: string): Promise<string | null>;
  localRequire(name: string): Promise<string | null>;
  npmRequire(name: string): Promise<string | null>;
};

export declare const template: {
  selectTemplate(projectType: ProjectType): Promise<null | string>;
};

export declare const inquirer: {
  prompt<T extends InAnswers = InAnswers>(
    questions: InQuestions<T>,
    initialAnswers?: Partial<T>
  ): Promise<T> & { ui: Prompt<T> };
  Separator:typeof Separator
};

export declare const execution: {
  exec(
    file: string,
    params?: string[] | execa.Options,
    options?: execa.Options
  ): execa.ExecaChildProcess;
  command(params: string, options?: execa.Options): execa.ExecaChildProcess;
  killChildProcess([pid, process]: [number, execa.ExecaChildProcess]): void;
};
