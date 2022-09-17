[![npm][npm-image]][npm-url]
[![NPM downloads][npm-downloads-image]][npm-url]
[![standard][standard-image]][standard-url]

[npm-image]: https://img.shields.io/npm/v/pmnps.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/pmnps
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard
[npm-downloads-image]: https://img.shields.io/npm/dm/pmnps.svg?style=flat-square

# pmnps

`pmnps` is a monorepo tool, it uses `npm workspaces` to manage packages and platforms.

## Other language

[中文](https://github.com/filefoxper/pmnps-workspace/blob/master/plats/pmnps/README_zh.md)

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
$ pmnps
```

after running:

```
- project
  - node_modules
  - packages
  - platforms(plats)
  package.json
  .pmnpsrc.json
```

This command can create a monorepo project and install the `dependencies & devDependencies` into root `node_modules`.

### use create command

```
$ pmnps create
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

This command can guide you to create `package`, `platform`, `scope` and `template`. Or you can enter the command detail as below.

#### create scope

```
$ pmnps create scope
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
$ pmnps create package
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
? Config the package: 
 ◉ create package with `root index module`
❯◉ create package buildable
```

* Create package with `root index module` will set `index` file in package root dir just like the `test` package below, if you want set it into a `src` dir, please do not select it.
* Create package buildable will add `build` and `start` scripts into the package.json file in this package, so, when use command `build` or `start`, this package may be started or built too.

If you are building a web app project using tools like `webpack` or `esbuild`, and you do not want to publish the packages, then, do not choose `create package buildable` may have a better develop experience, you can develop platform without build packages. And in this case, if you choose `create package with root index module`, it can take more good experience for you, for the most popular code eidtors like `vscode`, `intellij ideal` are supporting the `index` code relationship, that you can edit or view codes of packages from platform without using any plugins or writing description file like `index.d.ts`.

If package is buildable, then:

```
? Choose the access type about your package:
❯◉ main
 ◯ module
 ◯ bin
```

* main: set package.json `main field` to be `dist/index.js`.
* module: set package.json `module field` to be `esm/index.js`.
* bin: set package.json `bin field` to be `bin/index.js`.

If package is not buildable, system will auto choose the module type, and then set package.json `module field` to be `src/index.*` or `index.*`.

after running:

```
- project
  - node_modules
  - packages
    - @scope
    - test
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
$ pmnps create platform
```

info:

```
Welcome to pmnps!
? Please enter the platform name: 
```

enter:

```
web-test
```

then:

```
? Choose the access type about your package:
❯◉ main
 ◯ module
 ◯ bin
```

* main: set package.json `main field` to be `dist/index.js`.
* module: set package.json `module field` to be `esm/index.js`.
* bin: set package.json `bin field` to be `bin/index.js`.

after running:

```
- project
  - node_modules
  - packages
    - @scope
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

This command can create a platform project.

#### create a template

The template now is a package too, use command `pmnps create template` can create a template package, and what you need to do is copy files and dirs into the resource dir in this package.

When you config the template in `.pmnpsrc.json` file, the `create package` or `create platform` command will ask and use the codes from template resource.

```
$ pmnps create template
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
$ pmnps refresh
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

This command can install all the dependencies and devDependencies from `packages` and `platforms` into the root `node_modules`.

### use start command

The `start` command can start platforms for development. It runs `npm start` command in platform `package.json > scripts.start`.

```
# start with selections
$ pmnps start
```

or

```
# start all platforms
$ pmnps start -a
```

The `start` command will start every package which has a `start` script in package.json for supporting the platform, if you only want to start the packages which are in the dependencies tree of starting platforms, you can config it by use command `pmnps config`, and select `build by dependencies` option.

### use build command

The `build` command can build platforms and packages. It runs `npm run build` command in platform `package.json > scripts.build`.

```
# build all platforms
$ pmnps build
```

or

```
# build a special platform
$ pmnps build -n <platform name>
```

If you want to install dependencies before build, you can use option param `-i`.

```
# install before build
$ pmnps build -n <platform name> -i
```

If you want to add param to npm build script, you can use option param `-p <param>`.

```
$ pmnps build -p "-e <param desc>"
```

Notice, the usage about `-p` below is global for all building platforms, if you want assign the params to platforms which you want params work on, you can use the url query param to replace it.

```
# it looks like url query param "?name1=param1&name2=param2"
$ pmnps build -p "?platA= -i -e <param desc>&platB= -i"
```

If you want to pass params for a build hook, try `<platform>.before` or `<platform>.after`:

```
# it looks like url query param "?name1=param1&name2=param2"
$ pmnps build -p "?platA.before= -i -e <param desc>&platB.after= -i&platC= -b <param desc>"
```

The `build` command will build every package which has a `build` script in package.json for supporting the platform, if you only want to build the packages which are in the dependencies tree of building platforms, you can config it by use command `pmnps config`, and select `build by dependencies` option.

### use config command

The `config` command allows you to reconfig pmnps. You can open `git usage`, `rename workspace` and so on.

```
$ pmnps config
```

options:

```
allow publish to npm              
build by dependencies                
create package or platform privately 
create all with `README.md` file     
use git       
use old platforms dir name `plats`
```

* `allow publish to npm`: This option allows you publish packages and platforms to npm server, if you do not want this happens, please do not choose it.
* `build by dependencies`: This option makes the `build` and `start` command only pick the packages in the building platforms dependencies tree for working.
* `create package or platform privately`: With this option, the package.json files created by pmnps will have a `private:true` field. It can protect the projects which are not allowed to a public space of npm server.
* `create all with README.md file`: If you want other develops of your team can learn more about your package or platform, choose it, then the important creation will append a `README.md` file.
* `use git`: We are not certain if you have install a git tool, or you want to push your codes into git server, so, if you want, choose it.
* `use old platforms dir name plats`: Before `pmnps@3.0.0`, we are using `plats` as a platforms root dir, and now we have change the name to `platforms`, if you still want to keep the old name, you can choose this option.

### use publish command

The `publish` command can help you publish the packages and platforms.

```
$ pmnps publish
```

If you have set one password, please use `-o` to pass it in.

```
$ pmnps publish -o 123456
```

### use update command

The `update` command can help you updating the verions of your packages and platforms.

```
$ pmnps update
```

You can pick the updating mode, and choose the packages and platforms for updating.

updating modes:

```
*.*.v
*.v.*
v.*.*
```

The mode will update the `v` position of your package.json `version` by `+1`.

## Package.json config

Now, you can add `pmnps` property into your package.json in platforms or packages.

### platform config platDependencies

Add `pmnps.platDependencies` config to describe the build dependencies in platforms.

platA -> package.json

```
{
  "private": true,
  "name": "platA",
  "version": "0.0.1",
  "scripts": {
    "start": "...start",
    "build": "... build"
  },
  "pmnps": {
    "platDependencies": [
      "platB"
    ]
  }
}
```

platB -> package.json

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
    "platDependencies": [
      "platC"
    ]
  }
}
```

platC -> package.json

```
{
  "private": true,
  "name": "platC",
  "version": "0.0.1",
  "scripts": {
    "start": "...start",
    "build": "... build"
  }
}
```

So, when use command `build`, it will follow the `platDependencies` build one by one, `build platC -> build platB -> build platA`.

### config ownRoot

Add `pmnps.ownRoot` config to describe a platform or package which installs `node_modules` in its own root folder.

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

### config alias

Add `pmnps.alias` config to give your platform or package an alias name.

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
    "alias": "pb"
  }
}
```

The alias name can work with `build -p` command option.

```
# it looks like url query param "?name1=param1&name2=param2"
$ pmnps build -p "?platA= -i -e <param desc>&platB= -i"

# use alias
$ pmnps build -p "?pb= -i"
```

### config buildHook

`pmnps.buildHook` provides two synchronous scripts `before` and `after` hook to every platform or package building.

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
    "buildHook": {
      "before":"echo build start...",
      "after":"echo build end..."
    }
  }
}
```

Use `build -p`, we can provide params for `before` or `after` scripts.

```
$ pmnps build -p "?platB.before=<params>"
```

If you want to pass params to all hooks, you can use `<global>.before` or `<global>.after`.

```
$ pmnps build -p "?<global>.before=<params>"
```

## .pmnpsrc.json

The file `pmnpsrc.json` is the config file for whole root project, it contains `workspace name`, `git usage`, `plugins`, `templates` and so on.

```
{
  "workspace": "workspace",
  "publishable": true,
  "createWithReadme": true,
  "git": true,
  "plugins": ["@pmnps/plugin-typescript", "@pmnps/plugin-dependencies"],
  "templates": ["@my/bin-ts-template", "@my/web-template"],
  "useOldDefineName": false,
  "private": false,
  "buildByDependencies": true
}
```

## plugins

The plugins is refact from `pmnps@3.0.0`, you can write plugins (if you want, you can publish them to `npm`), or pick the plugins you need, and config them in `pmnpsrc.json` file for usage.

```
{
  "workspace": "workspace",
  "plugins": ["my-pmnps-plugin"]
}
```

If the plugins are from `npm`, you should add them into `devDependencies` in root `package.json` file, and refresh (use `refresh command`) or install them.

## Plugins & Templates

All the plugins and templates can be kept in `packages` dir or publish to `npm server`.

## update

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
