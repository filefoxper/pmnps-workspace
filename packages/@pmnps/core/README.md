# @pmnps/core

This package is built for provide the file `structure system` for pmnps.

## API

### structre

```typescript
export declare const structure: {
  // the actual root dir node  
  root(): StructureRoot;
  // the modify root dir node
  alterRoot(): StructureRoot;
  // the actual package.json content from 'root & packages & platforms'
  packageJsons(): PackageJsons;
  // the api to modify dir and file nodes
  rebuild(redoCallback: RebuildCallback): StructureRoot;
  // regenerate and modify dirs and files from the alterRoot()
  flush(): Promise<void>;
  // filter nodes you need
  filter(
    root: StructureRoot | StructureNode,
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
  // find the node you need
  find(
    root: StructureRoot | StructureNode,
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
};
```

#### StructureRoot

This is a structure data describe the root dir of pmnps. You can use `structure.root()` api to get the actual one, and use `structure.alterRoot()` api to get the current modifing root.

```typescript
export declare type StructureRoot = {
  // the actual path of the root dir  
  path: string;
  // mark out this is a root node
  type: 'root';
  // the primary child dir and file nodes
  children: StructureNode[];
  // write child nodes into root as part of `children` field,
  // it compare `name` fields from new nodes with old children,
  // and deside merge or create by the node actions
  write(
    children:
      | string
      | ((content: string) => string)
      | (StructureNode | undefined | null)[]
  ): StructureRoot;
  // find node matched by partial fields or a true callback
  find(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
  // filter nodes matched by partial fields or a true callback
  filter(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
};
```

structure:

```
- packages
  - @scope
    - my-pack
      index.js
      package.json
  - my-pack
    index.js
    package.json
- platforms
package.json
.pmnpsrc.json
```

trans to root

```
- root
  - node {name:'packages', type:'dir', children:[...belowNodes]}
    - node {name:'@scope', type:'dir', children:[...belowNodes]}
      - node {name:'my-pack', type:'dir', children:[...belowNodes]}
        node {name:'index.js', type:'file'}
        node {name:'package.json', type:'file'}
    - node {name:'my-pack', type:'dir', children:[...belowNodes]}
      node {name:'index.js', type:'file'}
      node {name:'package.json', type:'file'}
  - node {name:'platforms', type:'dir', children:[...belowNodes]}
  node {name:'package.json', type:'file'}
  node {name:'.pmnpsrc.json', type:'file'}
```

1. find: use `root.find` api can find out the node you want under this root.

```typescript
import {structure,path} from '@pmnps/core';

const actualRoot = structure.root();
// find the package dir node which name is 'my-pack'
const myNode = actualRoot.find({name:'my-pack', projectType:'package'});
// the find api find out the most close to root level node,
// so, here we find out the node path like `root/packages/my-pack`, 
// not the one under `@scope` dir.

// If you want to find more exactly, 
// the callback and the more attrs are needed.
const scopeMyNode = actualRoot.find(({name,parent,projectType})=>{
    return name === 'my-pack' && projectType === 'package' && parent.path !== path.packagesPath;
});
```

2. filter: use `root.filter` api can filter out the nodes you need under this root.

```typescript
import {structure,path} from '@pmnps/core';

const actualRoot = structure.root();
// filter the package dir nodes which name is 'my-pack'
const myNodes = actualRoot.filter({name:'my-pack', projectType:'package'});
```

3. write: use `root.write` api can modify structrure nodes, it only can be called in a rebuild callback.


```typescript
import {structure,path} from '@pmnps/core';

const packageJson = {name:'my-test',version:'1.0.0'};

structure.rebuild((root, {file, dir})=>{
    // root will merge the dir nodes into alterRoot
    root.write([
        // the `packages` dir is exist, it will not be make again
        dir('packages',[
            // `@scope` is like packages
            dir('@scope',[
                // `my-test` is not exist in `@scope` dir, 
                // it will be created
                dir('my-test',[
                    // create an empty `index.js` file in `my-test`
                    file('index.js'),
                    // create `package.json` with content in `my-test`
                    file('package.json', packageJson)
                ])
            ])
        ])
    ]);
});
// after modify, the pmnps will call `structure.flush()` to mkdir and write files.
```

Warning: the `write` api can only be called in rebuild callback, or it will throw exception.

#### StructureNode

```typescript
export declare type StructureNode = {
  // the name of the node dir or file
  name: string;
  // the path of the node dir or file
  path: string;
  // 'file'|'dir'
  type: StructureNodeType;
  // content which is written into a file node
  content?: string | ((c: string) => string);
  // if this node is not exist in old parent, it is 'create'
  // if the node is exist yet, and has been modified, it is 'write'
  status?: StructureStatus;
  // the parent node which has a `children` field contains this node
  parent?: StructureNode | StructureRoot;
  // if the node is a package project dir or package.json, it is 'package'
  // if the node is a platform project dir or package.json, it is 'platform'
  projectType?: ProjectType;
  // if the node is a package.json, it is true.
  isPackageJson?: boolean;
  // the primary child nodes
  children?: StructureNode[];
  // a file node can write a string as content
  // a file node can write an object, the json string will be content
  // a file node can provide a content map function to map content
  // a dir node can write children, and merge them with the old children
  write(
    children?:
      | string
      | ((content: string) => string)
      | (StructureNode | undefined | null)[]
  ): StructureNode;
  // a node can rename itself
  rename(name: string): StructureNode;
  // just like the find method in root to find out a node under the dir node
  find(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode | undefined;
  // just like the filter method in root to filter nodes under the dir node
  filter(
    nodeLike: Partial<StructureNode> | ((node: StructureNode) => boolean)
  ): StructureNode[];
};
```

The write method of StructureNode can only be called in a rebuild callback too.

```typescript
import {structure,path} from '@pmnps/core';

const packageJson = {name:'my-test',version:'1.0.0'};

structure.rebuild((root, {file, dir})=>{
    // find the `@scope` dir node first, 
    // and this node's parent should be 'packages'
    const scopeNode = root.find(({name,parent})=> name==='@scope' && parent.path === path.packagesPath);
    if(!scopeNode){
        return;
    }
    // write `@scope` dir the `my-test` package project.
    scopeNode.write([
        dir('my-test',[
            // create an empty `index.js` file in `my-test`
            file('index.js'),
            // create `package.json` with content in `my-test`
            file('package.json', packageJson)
        ])
    ]);
});
// after modify, the pmnps will call `structure.flush()` to mkdir and write files.
```

Sometimes we want to write or rename files in a plugin, we can use the `status` field which is `create`, like:

```typescript
import {structure,path} from '@pmnps/core';

const packageJson = {name:'my-test',version:'1.0.0'};

structure.rebuild((root, {file, dir})=>{
    // find the creating project node by use status 'create',
    // and projectType is exist.
    const creatingProject = root.find(({status, projectType})=> status === 'create' && projectType);
    if(!creatingProject){
        return;
    }
    // find the index file
    const indexNode = creatingProject.find(({name})=>name.startsWith('index.'));
    if(!indexNode){
        return;
    }
    // rename the index file to name index.ts
    indexNode.rename('index.ts');
});
// after modify, the pmnps will call `structure.flush()` to mkdir and write files.
```

If we want to change the content of a package.json file, we can use `write` api, and give it a callback to read the current content as a base start.

```typescript
import {structure,path} from '@pmnps/core';

const packageJson = {name:'my-test',version:'1.0.0'};

structure.rebuild((root, {file, dir})=>{
    // find the creating project node by use status 'create',
    // and projectType is exist.
    const creatingProject = root.find(({status, projectType})=> status === 'create' && projectType);
    if(!creatingProject){
        return;
    }
    // find the package.json file
    const packageJsonNode = creatingProject.find({isPackageJson:true});
    if(!packageJsonNode){
        return;
    }
    // change package.json file with the old content
    packageJsonNode.write((c)=>{
        const json = JSON.parse(c);
        // for example we change the private field to false
        json.private = false;
        return JSON.stringify(json);
    });
});
// after modify, the pmnps will call `structure.flush()` to mkdir and write files.
```

#### packageJsons

Use `structure.packageJsons` api can fetch all `package.json` content as json objects.

The result is an object:

```typescript
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
  getDirPath?: ()=>string;
};

export declare type PackageJsons = {
  root?: PackageJson;
  packages: PackageJson[];
  platforms: PackageJson[];
};
```

You can use the data to analyze the relationShip of packages and platforms.

### path

```typescript
export declare const path: {
  rootPath: string;
  packagesPath(): string;
  platformsPath(): string;
  join(...params: (string | null | undefined)[]): string;
};
```

1. `path.rootPath` is the root dir path.
2. `path.packagesPath()` returns the path of `packages` dir in root.
3. `path.platformsPath()` returns the path of `platforms` dir in root.
4. `path.join` is a method like the nodejs `path.join`, but it can filter the undefined and null param out.

## Plugin

The plugin structure is a function with or without a param object.

```typescript
// a render returns a boolean resolve promise,
// if it resolves a false data,
// the command and other plugins will be stopped,
// the requires array is the third lib tools versions
export declare type PluginRender = (requires: string[]) => Promise<boolean>;

export declare type PluginRenders = {
  // run before refresh command
  refresh?: PluginRender;
  // run after create command
  create?: PluginRender;
  // run before build command
  build?: PluginRender;
  // run before start command
  start?: PluginRender;
};

// a plugin pack contains some default configs for pmnps
export declare type PluginPack = {
  // the main function called in different commands
  renders: PluginRenders;
  // isOption marks this plugin is optional
  isOption?: boolean;
  // displayName can prettier current plugin name
  displayName?: string;
  // requires is the third lib tools you need to write to package.json
  requires?: string[];
};

// plugin entry function
export declare type PluginComponent = (
  // config for plugin
  config?: Record<string | number, any>
) => PluginPack;
```

Let's make a simple react plugin for example:

```typescript
import {structure} from '@pmnps/core';

export default function reactPlugin(){
  return {
    // is optional
    isOption:true,
    // require react version
    requires:['react'],
    renders:{
      // accept required react version,
      // only run in create command
      create([reactVersion]){
        structure.rebuild((root})=>{
          const createProject = root.find(({status,projectType})=> status === 'create' && !!projectType);
          if(!createProject){
            return;
          }
          // find package.json node
          const packageJson = createProject.find(({isPackageJson})=>isPackageJson);
          if(!packageJson){
            return;
          }
          // write 'react' to package.json dependencies
          packageJson.write((c)=>{
            const {dependencies={},...rest} = JSON.parse(c);
            const newJson = {
              ...rest,
              dependencies:{...dependencies,react:reactVersion}
            };
            return JSON.stringify(newJson);
          })
        });
      }
    }
  }
}
```

This is a simple plugin example, the actual react plugin will be more complex.

## Stop currently

The API is not complete now, but the content before is enough for writing a plugin, so we will stop it currently, and complete it in next version publish.
