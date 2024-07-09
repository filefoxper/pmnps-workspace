[![npm][npm-image]][npm-url]
[![NPM downloads][npm-downloads-image]][npm-url]
[![standard][standard-image]][standard-url]

[npm-image]: https://img.shields.io/npm/v/pmnps.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/pmnps
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard
[npm-downloads-image]: https://img.shields.io/npm/dm/pmnps.svg?style=flat-square

# pmnps

`pmnps` is a monorepo tool, it uses `npm workspaces` to manage packages and platforms. From `pmnps@4.0.0`, this tool focuses on the monorepo management, so, it removes some functions like `build`, `publish` and `update`. If you still need these functions, you can find some of them in plugins.

## Other language

[中文](https://github.com/filefoxper/pmnps-workspace/blob/master/platforms/pmnps/README_zh.md)

## Install

```
npm install pmnps -g
```

or

```
npm install pmnps --save-dev
```

## Basic usage

### use pmnps

```
$ npx pmnps
```

info:


```
Pmnps startup...
Env: node@16.14.0
? Use command: (Use arrow keys)
  -- system commands --
> start
  refresh
  create
  config
  -- customized commands --
  ......
```

This command lists all the available commands for `pmnps`.

### use create command

```
$ npx pmnps create
```
info:

```
Welcome to pmnps!
? Choose what you want to create: (Use arrow keys)
❯ package 
  platform 
  scope 
  template
```

This command guides you to create a `package`, `platform`, `scope` or `template`. 

You can enter the command detail for a quick create.

#### create scope

```
$ npx pmnps create scope
```
info:

```
Welcome to pmnps!
? Please enter the scope name:
```

enter:

```
scope
```

after running:

```
- project
  - node_modules
  - packages
    - @scope
  - platforms
  package.json
  .pmnpsrc.json
```

It creates a scope folder for your packages.

#### create a package

```
$ npx pmnps create package
```
info:

```
Welcome to pmnps!
? Please enter the package name:
```

enter:

```
test
```

then:

```
 Use command: create package
? Do you want to set options for this package? Yes
? Choose options for this package (Press <space> to select, <a> to toggle all, <i> to invert selection)
>(*) use node_modules in this package
```

* Create package with `use node_modules in this package` makes package uses a private node_modules folder in it.

after running:

```
- project
  - node_modules
  - packages
    - @scope
    - test
      node_modules  // private node_modules folder
      index.js
      package.json
  - platforms
  package.json
  .pmnpsrc.json
```

If you want to build a package with the root node_modules folder, just skip this option.

```
? Use command: create package
? Please enter the package name: test
? Do you want to set options for this package? No
? Do you want to create package with templates? Yes
? Choose the template for creating package. (Use arrow keys)
> @template/package 
```

after running:

```
- project
  - node_modules
  - packages
    - @scope
    - test  // no private node_modules folder
      index.js
      package.json
  - platforms
  package.json
  .pmnpsrc.json
```

This command can create a package project. 

If you want to create package into scope, you can enter `@scope/test`.

#### create a platform

```
$ npx pmnps create platform
```

info:

```
Welcome to pmnps!
? Please enter the platform name: 
```

It is similar to create a package, but it creates a platform project.

#### create a template

The template now is a package too, use command `pmnps create template` can create a template package, and what you need to do is copy files and dirs into the resource dir in this package.

When you config the template in `.pmnpsrc.json` file, the `create package` or `create platform` command will ask and use the codes from template resource.

```
$ npx pmnps create template
```

info:

```
Welcome to pmnps!
? Please enter the template name: 
```

enter:

```
@scope/web-template
```

after running:

```
- project
  - node_modules
  - packages
    - @scope
      - web-template
        - resource
        index.js
        package.json
    - test
      index.js
      package.json
  - platforms
    - web-test
      -src
        index.js
      package.json
  package.json
  .pmnpsrc.json
```

You can copy the template files and folders into this template `resource` package folder. When use `create package` or `create platform` command, it will be useful.

### use refresh command

```
$ npx pmnps refresh
```

after running:

```
- project
  - node_modules
  - packages
    - @scope
    - test
      index.ts
      package.json
  - platforms
    - web-test
      -src
        index.tsx
      package.json
  package.json
  .pmnpsrc.json
```

This command can install all the dependencies and devDependencies from `packages` and `platforms` into the root `node_modules`. It is the key command for keeping packages and platforms in monorepo environment.

### use start command

The `start` command can start platforms for development. It runs `npm start` command in platform `package.json > scripts.start`.

```
# start with selections
$ npx pmnps start
```

or

```
# start with a specific platform or package
$ npx pmnps start -n <platform or package name>
```

The `start` command will start every package which has a `start` script in package.json for supporting the platform, if you only want to start the packages which are in the dependencies tree of starting platforms, you can config it by use command `pmnps config`, and select `build by dependencies` option.

You can set platforms as a group, so, you can start this group without choose operation.

set platforms as a group named 'xxx':

```
# set platforms as a group named 'xxx'
$ npx pmnps start -g xxx
```

use the group name you have set yet.

```
# use the group name you have set yet
$ npx pmnps start
```

### use run command

The `run` command is not listed in pmnps command options. It runs npm scripts in `package.json`.

```
# run build script in a special platform or package
$ npx pmnps run build -n <platform or package name>
```

It is similar with `start` command, but requires a script name for running.

### use config command

The `config` command allows you to reconfig pmnps. You can open `git usage`, `rename workspace` and so on.

```
$ pmnps config
```

after running:

```
? Use command: config
? Please enter the project name: test
? Config project: (Press <space> to select, <a> to toggle all, <i> to invert selection)
 -- choosing --
 (*) allow publish to npm
 (*) use monorepo
>(*) use git
 ( ) use performance first
 ( ) use refresh after install
 -- setting --
 ( ) set customized npm registry
>( ) set project detail

```

options:

```
allow publish to npm              
use monorepo    
use git       
use performance first
use refresh after install
```

* `allow publish to npm`: This option allows you publish packages and platforms to npm server, if you do not want this happens, please do not choose it.
* `use monorepo`: This option makes a monorepo environment.
* `use git`: We are not certain if you have install a git tool, or you want to push your codes into git server, so, if you want, choose it.
* `use performance first`: This option will skip descriptions and some checks to keep pmnps running with a higher performance.
* `use refresh after install`: This option adds refresh command into the `postinstall` script of root `package.json`, so, after install all dependencies, it will refresh all packages and platforms.

## Package.json config

Now, you can add `pmnps` property into your package.json in platforms or packages.

### config ownRoot

Add `pmnps.ownRoot` config to describe a platform or package which installs `node_modules` in its own root folder. You can set it by using the option `use node_modules in this package` in `create package` or `create platform` command.

```
{
  "private": true,
  "name": "platB",
  "version": "0.0.1",
  "scripts": {
    "start": "...start",
    "build": "... build"
  },
  "pmnps": {
    "ownRoot": true
  }
}
```

## .pmnpsrc.json

The file `pmnpsrc.json` is the config file for whole root project, it contains `workspace name`, `git usage`, `plugins`, `templates` and so on.

```
{
  "name": "test",
  // "allow publish to npm"
  "private": false,
  // "use monorepo"
  "projectType": "monorepo",
  // "use git"
  "useGit": true,
  // "set customized npm registry"
  "registry": "https://registry.npmmirror.com",
  // "use performance first"
  "usePerformanceFirst": false,
  // "set templates for creating command"
  "templates": ["@template/package", "@template/platform"],
  // "set plugins for pmnps"
  "plugins": [
    [
      "@pmnps/plugin-vscode-workspace",
      { "excludes": ["@template/"] }
    ],
    "@pmnps/plugin-publish"
  ],
  // "use refresh after install"
  "useRefreshAfterInstall": false
}
```

## plugins

The plugins make pmnps works more powerful, you can write plugins (if you want, you can publish them to `npm`), or pick the plugins you need, and config them in `pmnpsrc.json` file for usage.

```
{
  "workspace": "workspace",
  "plugins": ["my-pmnps-plugin"]
}
```

If the plugins are from `npm`, you should add them into `devDependencies` in root `package.json` file, and refresh (use `refresh command`) or install them.

## Plugins & Templates

All the plugins and templates can be kept in `packages` dir or publish to `npm server`.

## logs

### v3.0.0

* refact the file modify system
* add template as a package
* combine scope\package\platform\template creation command to one `create` command.
* modify plugin interfaces

### v3.0.1

* fix the bug about repetitive building and publishing.

### v3.1.0

* optimize the dependecies.

### v3.1.3

* provide `<global>` for build global params.

### v3.2.1

* when create a module package or platform, pmnps do not provide a "type":"module" config in `package.json`.

### v3.2.6

* when use `refresh` command, root package.json will feedback the dependencies which are exist in package/platform package.json.

### v3.3.0

* prettier `package.json` with `prettier-package-json`.
* if the workspace projects can be published, the `ownRoot` packages or platforms will not update the version of dependency workspace packages when use command `pmnps update`. 

### v 4.0.0

* remove command `build`, `publish` and `update`.
* add command `run`.
* rebuild plugin system.
* rebuild a more efficient refresh system.
* rebuild a more efficient io system.

### v 4.1.1

* support 'npm'|'yarn' as package manager
* support 'npm ci'
