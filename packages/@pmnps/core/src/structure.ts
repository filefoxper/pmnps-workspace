import pathBuilder from './path';
import {
  createFileIfNotExist,
  isDirectory,
  isFile,
  mkdirIfNotExist,
  readdir,
  readFile,
  readJson,
  rename,
  writeFile
} from './file';
import {
  Diff,
  PackageJson,
  PackageJsons,
  ProjectType,
  RebuildCallback,
  StructureNode,
  StructureRoot
} from './type';
import {
  GIT_IGNORE_FILE_NAME,
  NPM_RC_FILE_NAME,
  PACKAGE_DIR_NAME,
  platformDirName,
  PRETTIER_RC_FILE_NAME,
  README_FILE_NAME
} from './define';
import resource from './resource';
import { exec } from './exec';
import { readConfig } from './config';

function createStructRoot(): StructureRoot {
  return {
    path: pathBuilder.rootPath,
    type: 'root',
    children: [],
    write(payload: StructureNode[]) {
      const self = this;
      if (!self.alter) {
        throw new Error(
          'It can only be called in `structure.rebuild` callback'
        );
      }
      alterRoot().modified = true;
      writeNodes(self, payload);
      return self;
    },
    find(
      nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
    ): StructureNode | undefined {
      return find(this, nodeLike);
    },
    filter(
      nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
    ): StructureNode[] {
      return filter(this, nodeLike);
    }
  };
}

function ensureNodesParent(parent: StructureNode | StructureRoot) {
  const nodes = parent.children;
  if (!nodes || !nodes.length) {
    return;
  }
  nodes.forEach(node => {
    node.parent = parent;
    node.alterParent = parent;
    node.path = pathBuilder.join(parent.path, node.name);
    if (parent.path === pathBuilder.platformsPath()) {
      node.projectType = 'platform';
    } else if (
      parent.path === pathBuilder.packagesPath() &&
      !node.name.startsWith('@')
    ) {
      node.projectType = 'package';
    } else if (
      parent.type !== 'root' &&
      parent.name.startsWith('@') &&
      parent.parent &&
      parent.parent.path === pathBuilder.packagesPath()
    ) {
      node.projectType = 'package';
    }
    if (node.name === 'package.json') {
      node.isPackageJson = true;
      if (parent.type !== 'root' && parent.projectType) {
        node.projectType = parent.projectType;
      }
    }
    ensureNodesParent(node);
  });
  return;
}

function markAdditions(additions: Array<StructureNode>) {
  additions.forEach(child => {
    child.status = 'create';
    if (child.children && child.children.length) {
      markAdditions(child.children);
    }
  });
}

function writeChildren(
  self: StructureNode | StructureRoot,
  payload: StructureNode[]
) {
  const target: StructureNode[] = payload as StructureNode[];
  const { children: source = [] } = self;
  const sourceMap = new Map(source.map(child => [child.name, child]));
  const targetMap = new Map(target.map(child => [child.name, child]));
  const exists = source.map(child => {
    const childName = child.name;
    const update = targetMap.get(childName);
    if (!update) {
      child.parent = self;
      return child;
    }
    const { status } = child;
    const content =
      typeof child.content === 'string' && typeof update.content === 'function'
        ? update.content(child.content)
        : update.content;
    const name = update.alterName || childName;
    const alterName = update.alterName ? childName : undefined;
    const { children, ...res } = update;
    if (children && children.length) {
      writeChildren(child, children);
    }

    Object.assign(child, {
      ...res,
      name,
      alterName,
      content,
      status: status || 'write'
    });
    return child;
  });
  const additions = target.filter(child => {
    const childName = child.name;
    return !sourceMap.get(childName);
  });
  markAdditions(additions);
  self.children = [...exists, ...additions];
}

function writeNodes(
  self: StructureNode | StructureRoot,
  payload: StructureNode[]
) {
  writeChildren(self, payload);
  ensureNodesParent(self);
}

function createStructureNode(
  name: string,
  type: 'file' | 'dir',
  pathname?: string
): StructureNode {
  return {
    name,
    path: pathname || name,
    type,
    rename(name: string): StructureNode {
      const self = this;
      if (!self.alter) {
        throw new Error(
          'It can only be called in `structure.rebuild` callback'
        );
      }
      alterRoot().modified = true;
      self.alterName = name;
      if (self.parent) {
        self.parent.write([self]);
      }
      return self;
    },
    write(
      payload?:
        | string
        | ((content: string) => string)
        | StructureNode[]
        | Record<string | number, any>
    ) {
      const self = this;
      if (!self.alter) {
        throw new Error(
          'It can only be called in `structure.rebuild` callback'
        );
      }
      alterRoot().modified = true;
      if (payload == null) {
        self.action = 'write';
        return self;
      }
      self.action = 'write';
      if (self.type === 'file') {
        if (typeof payload === 'string') {
          self.content = payload;
        } else if (typeof payload === 'function') {
          if (typeof self.content === 'string') {
            self.content = payload(self.content);
          } else if (typeof self.content === 'function') {
            const cont = self.content;
            self.content = (content: string) => {
              return payload(cont(content));
            };
          } else {
            self.content = payload as (content: string) => string;
          }
        } else {
          self.content = JSON.stringify(payload);
        }
      } else {
        if (!Array.isArray(payload)) {
          return self;
        }
        writeNodes(self, payload);
      }
      return self;
    },
    find(
      nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
    ): StructureNode | undefined {
      return find(this, nodeLike);
    },
    filter(
      nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
    ): StructureNode[] {
      return filter(this, nodeLike);
    },
    order(commands: ('prettier' | 'git')[]) {
      const self = this;
      if (!self.alter) {
        throw new Error(
          'It can only be called in `structure.rebuild` callback'
        );
      }
      self.commands = self.commands
        ? [...self.commands, ...commands]
        : commands;
      return self;
    }
  };
}

async function generateStructure(
  pathname: string,
  name: string,
  level: number = 0,
  stop?: boolean
): Promise<StructureNode> {
  const isDir = await isDirectory(pathname);
  const type = isDir ? 'dir' : 'file';
  const node = createStructureNode(name, type, pathname);
  if (!isDir && name === 'package.json') {
    node.isPackageJson = true;
  }
  if (!isDir || stop) {
    return node;
  }
  const list = await readdir(pathname);
  const canFinish = list.some(n => n === 'package.json') || level >= 5;
  const fetches = list.map((n): Promise<StructureNode | undefined> => {
    if (n === 'node_modules') {
      return Promise.resolve(undefined);
    }
    const pn = pathBuilder.join(pathname, n);
    return generateStructure(pn, n, level + 1, canFinish);
  });

  const children = await Promise.all(fetches);
  node.children = children.filter((d): d is StructureNode => !!d);
  node.children.forEach(d => {
    d.parent = node;
  });
  return node;
}

function markProjects(
  dir: StructureNode,
  level: number,
  projectType?: ProjectType
) {
  const pt =
    projectType ||
    (!level && dir.name === platformDirName() ? 'platform' : 'package');
  const packageJson = (dir.children || []).find(
    d => d.name === 'package.json' && d.type === 'file'
  );
  if (
    packageJson &&
    !dir.name.startsWith('@') &&
    ((!level && ![platformDirName(), PACKAGE_DIR_NAME].includes(dir.name)) ||
      level)
  ) {
    dir.projectType = pt;
    packageJson.projectType = pt;
    return;
  }
  if (level + 1 >= 3) {
    return;
  }
  (dir.children || [])
    .filter(d => d.type === 'dir')
    .forEach(d => markProjects(d, level + 1, pt));
}

async function readPackageJson(
  node: StructureNode
): Promise<PackageJson | undefined> {
  if (node.isPackageJson && node.projectType) {
    const parent = node.parent;
    const json = await readJson<PackageJson>(node.path);
    if (!json) {
      return undefined;
    }
    json.getDirPath = () => parent!.path;
    return json;
  }
  return undefined as never;
}

async function fetchPackageJsons(root: StructureRoot) {
  const packageJsonNodes = filter(
    root,
    s => !!(s.isPackageJson && s.projectType)
  );
  const rootPackageJsonNode = packageJsonNodes.find(
    s => s.projectType === 'root'
  );
  const packageNodes = packageJsonNodes.filter(
    s => s.projectType === 'package'
  );
  const platformNodes = packageJsonNodes.filter(
    s => s.projectType === 'platform'
  );
  const [rootJson, packages, platforms] = await Promise.all([
    rootPackageJsonNode
      ? readPackageJson(rootPackageJsonNode)
      : Promise.resolve(undefined),
    Promise.all(packageNodes.map(s => readPackageJson(s))),
    Promise.all(platformNodes.map(s => readPackageJson(s)))
  ]);
  return {
    root: rootJson,
    packages: packages.filter(
      (d): d is PackageJson => !!d && !!d.name && !!d.version
    ),
    platforms: platforms.filter(
      (d): d is PackageJson => !!d && !!d.name && !!d.version
    )
  };
}

async function build(): Promise<void> {
  const list = await readdir(pathBuilder.rootPath);
  const fetches = list.map((name): Promise<undefined | StructureNode> => {
    if (name === 'node_modules') {
      return Promise.resolve(undefined);
    }
    const pathname = pathBuilder.join(pathBuilder.rootPath, name);
    return generateStructure(pathname, name);
  });
  const children = await Promise.all(fetches);
  const root = createStructRoot();
  root.children = children.filter((d): d is StructureNode => !!d);
  root.children.forEach(d => {
    d.parent = root;
    if (d.type === 'file' && d.name === 'package.json') {
      d.projectType = 'root';
    }
    if (d.type === 'dir') {
      markProjects(d, 0);
    }
  });
  const packageJsons = await fetchPackageJsons(root);
  global.pmnps = global.pmnps || {};
  global.pmnps.structureRoot = root;
  global.pmnps.alterStructureRoot = cloneRoot(root);
  global.pmnps.packageJsons = packageJsons;
}

function cloneNode(node: StructureNode, parent: StructureNode | StructureRoot) {
  const clone = { ...node, parent, alter: true };
  if (!clone.children) {
    return clone;
  }
  clone.children = clone.children.map(child => cloneNode(child, clone));
  return clone;
}

function cloneRoot(root: StructureRoot) {
  const newRoot = { ...root, alter: true };
  newRoot.children = (newRoot.children || []).map(node =>
    cloneNode(node, newRoot)
  );
  return newRoot;
}

function root(): StructureRoot {
  if (!global.pmnps || !global.pmnps.structureRoot) {
    throw new Error('There is some bug here ......');
  }
  return global.pmnps.structureRoot as StructureRoot;
}

function alterRoot(): StructureRoot {
  if (!global.pmnps || !global.pmnps.alterStructureRoot) {
    throw new Error('There is some bug here ......');
  }
  return global.pmnps.alterStructureRoot as StructureRoot;
}

function packageJsons(): PackageJsons {
  if (!global.pmnps || !global.pmnps.packageJsons) {
    throw new Error('There is some bug here ......');
  }
  const { root, packages, platforms } = global.pmnps
    .packageJsons as PackageJsons;
  const cloneRoot = root ? { ...root } : root;
  const clonePackages = !packages ? packages : packages.map(p => ({ ...p }));
  const clonePlatforms = !platforms
    ? platforms
    : platforms.map(p => ({ ...p }));
  return {
    root: cloneRoot,
    packages: clonePackages,
    platforms: clonePlatforms
  };
}

function rebuild(redoCallback: RebuildCallback): StructureRoot {
  function file(
    name: string,
    payload?: string | Record<string | number, any>
  ): StructureNode {
    const content = payload;
    const node = createStructureNode(name, 'file');
    node.alter = true;
    node.content =
      !content || typeof content === 'string'
        ? content
        : JSON.stringify(content);
    node.action = node.action || 'create';
    return node;
  }
  function readme(content?: string): StructureNode {
    return file(README_FILE_NAME, content || '## README');
  }
  function npmrc(content?: string): StructureNode {
    return file(NPM_RC_FILE_NAME, content);
  }
  function npmForbiddenRc(): StructureNode {
    return file(NPM_RC_FILE_NAME, resource.forbiddenNpmrc);
  }
  function gitignore(content?: string): StructureNode {
    return file(GIT_IGNORE_FILE_NAME, content || resource.gitignore);
  }
  function prettierrc(content?: string | Record<string, any>): StructureNode {
    return file(PRETTIER_RC_FILE_NAME, content || resource.prettier);
  }
  const res = {
    readme,
    npmrc,
    npmForbiddenRc,
    gitignore,
    prettierrc
  };
  function dir(
    name: string,
    payload?: (StructureNode | undefined | null)[]
  ): StructureNode {
    const children = payload || [];
    const node = createStructureNode(name, 'dir');
    node.alter = true;
    node.action = node.action || 'create';
    node.children = children.filter((s): s is StructureNode => !!s);
    return node;
  }
  function rename(node: StructureNode, name: string): StructureNode {
    return node.rename(name);
  }
  function write(
    node: StructureNode | StructureRoot,
    payload?:
      | string
      | (StructureNode | undefined | null)[]
      | ((content: string) => string)
  ): StructureNode | StructureRoot {
    if (!payload) {
      if (node.type !== 'root') {
        node.action = 'write';
      }
      return node;
    }
    return node.write(payload);
  }
  redoCallback(global.pmnps.alterStructureRoot!, {
    file,
    dir,
    write,
    rename,
    res
  });
  return global.pmnps.alterStructureRoot!;
}

function flat(nodes: StructureNode[]): StructureNode[] {
  return nodes.flatMap(n => {
    const { children } = n;
    return [n].concat(children ? flat(children) : []);
  });
}

function diff(source: StructureRoot, target: StructureRoot): Diff {
  function toMap(root: StructureRoot): Map<string, StructureNode> {
    const array = flat(root.children);
    const e = array.map((d): [string, StructureNode] => [d.path, d]);
    return new Map(e);
  }
  const sourceMap = toMap(source);
  const targetMap = toMap(target);
  const sourceArray = [...sourceMap];
  const targetArray = [...targetMap];
  const additions = targetArray.filter(([path]) => !sourceMap.has(path));
  const modifies = sourceArray
    .filter(([path]) => {
      const target = targetMap.get(path);
      if (!target) {
        return false;
      }
      return !!target.action;
    })
    .map(
      ([path]) =>
        [path, targetMap.get(path) as StructureNode] as [string, StructureNode]
    );
  const commands = targetArray.filter(([k, d]) => d.commands);
  return { additions, modifies, commands };
}

function analyzeAdditions(
  additions: Array<StructureNode>
): Array<StructureNode[]> {
  const additionMap = new Map<string, StructureNode>(
    additions.map(s => [s.path, s])
  );
  const currents = additions.filter(
    ({ alterParent }) => !alterParent || !additionMap.get(alterParent.path)
  );
  const nexts = currents.flatMap(({ children }) => children || []);
  if (!nexts.length) {
    return [currents];
  }
  const children = analyzeAdditions(nexts);
  return [currents, ...children];
}

async function createFileIfNotExistWithCallback(
  path: string,
  content: undefined | string | ((c: string) => string)
): Promise<void> {
  const shouldBeFile = await isFile(path);
  if (shouldBeFile) {
    return;
  }
  if (typeof content === 'string') {
    await createFileIfNotExist(path, content);
    return;
  }
  await createFileIfNotExist(path);
}

async function writeFileWithCallback(
  path: string,
  content: string | ((c: string) => string)
) {
  if (typeof content === 'string') {
    await writeFile(path, content);
    return;
  }
  const shouldBeFile = await isFile(path);
  let data = '';
  if (shouldBeFile) {
    data = await readFile(path);
  }
  const result = content(data);
  if (result === data) {
    return;
  }
  await writeFile(path, result);
}

async function batchTask(taskGroups: Array<StructureNode[]>): Promise<void> {
  if (!taskGroups.length) {
    return;
  }
  const [current, ...rest] = taskGroups;
  const process = current.map((s): Promise<unknown> => {
    const { type, path, content } = s;
    if (type === 'file') {
      return createFileIfNotExistWithCallback(path, content);
    }
    return mkdirIfNotExist(path);
  });
  await Promise.all(process);
  if (!rest.length) {
    return;
  }
  await batchTask(rest);
}

async function execute(commandNodes: StructureNode[]) {
  const config = readConfig();
  if (!config) {
    return;
  }
  const { git } = config;
  const prettierSet = new Set<string>();
  const gitSet = new Set<string>();
  commandNodes.forEach(node => {
    const { commands = [] } = node;
    if (commands.includes('prettier')) {
      prettierSet.add(node.path);
    }
    if (commands.includes('git')) {
      gitSet.add(node.path);
    }
  });
  if (prettierSet.size) {
    await exec('npx', ['prettier', '--write', ...prettierSet]);
  }
  if (gitSet.size && git) {
    await exec('git', ['add', ...gitSet]);
  }
}

async function flush(): Promise<void> {
  const r = root();
  const ar = alterRoot();
  if (r === ar || !ar.modified) {
    await build();
    return;
  }
  const differ = diff(r, ar);
  const { additions, modifies, commands } = differ;
  const taskGroups = analyzeAdditions(additions.map(([, s]) => s));
  const creates = batchTask(taskGroups);
  const verifies = modifies.map(async ([, s]): Promise<unknown> => {
    const { type, path, content, action, name, alterName, parent } = s;
    if (alterName) {
      const sourcePath = pathBuilder.join(
        parent ? parent.path : null,
        alterName
      );
      const targetPath = pathBuilder.join(parent ? parent.path : null, name);
      await rename(sourcePath, targetPath);
    }
    if (type === 'file' && content) {
      return action === 'write'
        ? writeFileWithCallback(path, content)
        : createFileIfNotExistWithCallback(path, content);
    }
    return Promise.resolve(undefined);
  });
  await creates;
  await Promise.all(verifies);
  await execute(commands.map(([k, d]) => d));
  await build();
}

function filter(
  root: StructureRoot | StructureNode,
  nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
): StructureNode[] {
  const defaultFilterCallback = s => {
    return Object.keys(nodeLike).reduce((result: boolean, key: string) => {
      if (!result || nodeLike[key] !== s[key]) {
        return false;
      }
      return result;
    }, true) as boolean;
  };
  const filterCallback =
    typeof nodeLike === 'function' ? nodeLike : defaultFilterCallback;
  return flat(root.children || []).filter(filterCallback);
}

function deepFind(
  children: StructureNode[],
  call: (node: StructureNode) => boolean
): StructureNode | undefined {
  let matched = children.find(call);
  if (matched) {
    return matched;
  }
  const next = children.flatMap(node => {
    const { children = [] } = node;
    return children;
  });
  if (!next.length) {
    return undefined;
  }
  return deepFind(next, call);
}

function find(
  root: StructureRoot | StructureNode,
  nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
): StructureNode | undefined {
  const defaultFilterCallback = s => {
    return Object.keys(nodeLike).reduce((result: boolean, key: string) => {
      if (!result || nodeLike[key] !== s[key]) {
        return false;
      }
      return result;
    }, true) as boolean;
  };
  const filterCallback =
    typeof nodeLike === 'function' ? nodeLike : defaultFilterCallback;
  return deepFind(root.children || [], filterCallback);
}

export { build, packageJsons };

export default { root, alterRoot, packageJsons, rebuild, flush, filter, find };
