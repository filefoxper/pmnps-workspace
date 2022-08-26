[![npm][npm-image]][npm-url]
[![standard][standard-image]][standard-url]

[npm-image]: https://img.shields.io/npm/v/pmnps.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/pmnps
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://npm.im/standard

# pmnps

`pmnps` 是一个基于 `npm workspaces` 的 `monorepo` 多平台管理工具。

## 安装

```
npm install pmnps -g
```

或

```
npm install pmnps --save-dev
```

## 基本用法

### 使用 pmnps

```
$ pmnps
```

生成目录文件如下:

```
- project
  - node_modules
  - packages
  - platforms (plats)
  package.json
  .pmnpsrc.json
```

该命令用于生成基本 `monorepo` 多平台管理项目目录，配置 pmnps 信息，配置项可参考 `config` 命令。

### 使用 create 命令

创建引导命令。

```
$ pmnps create
```
提示:

```
Welcome to pmnps!
? Choose what you want to create: (Use arrow keys)
❯ package 
  platform 
  scope 
  template
```

引导选项为下列具体 create 命令。

#### create scope

创建一个分组域名 `@<some-scope>`。

```
$ pmnps create scope
```
提示:

```
Welcome to pmnps!
? Please enter the scope name:
```

输入:

```
scope
```

生成目录结构如下:

```
- project
  - node_modules
  - packages
    - @scope
  - platforms
  package.json
  .pmnpsrc.json
```

可以观察到在 packages 中多了 `@scope` 目录，这可以方便我们分组开发专业的公共包集群。

#### create package

用于生成公共包的命令。

```
$ pmnps create package
```
提示:

```
Welcome to pmnps!
? Please enter the package name:
```

输入:

```
test
```

配置:

```
? Config the package: 
 ◉ create package with `root index module`
❯◉ create package buildable
```

* create package with `root index module` 选项会将 `index` 文件生成在包的根目录中，如下结构中的 `test` 包，如不选择该选项，`index` 文件会被生成在包的 `src` 目录中。
* create package buildable 选项会在生成 package.json 文件时，添加 `build` 和 `start` script 脚本。

如果你希望管理的是一组 web app 项目群，并使用 webpack 或 esbuild 做编译器，建议不必开启 create package buildable 选项，webpack 或 esbuild 会将包当作 module 模块使用，这省去了不必要的单包编译过程。在此情况下，选择 create package with `root index module` 选项可以让待开发包的代码与平台项目中的引用直接关联，大多数的前端代码编辑器可以直接分析关联包下的 `index` 文件，而不必使用任何插件，或生成 `index.d.ts` 接口描述文件。

如果包被设置为可编译状态 (create package buildable)，则还需继续配置包的入口类型：

```
? Choose the access type about your package:
❯◉ main
 ◯ module
 ◯ bin
```

* main: 配置 package.json 中的 `main` 字段为 `dist/index.js`。
* module: 配置 package.json 中的 `module` 字段为 `esm/index.js`。
* bin: 配置 package.json 中的 `bin` 字段为 `bin/index.js`。

生成目录文件如下:

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

如果希望将包生成在 @scope 中，则在输入名称时加上 @scope，如：`@scope/test`。

#### create platform

```
$ pmnps create platform
```

提示:

```
Welcome to pmnps!
? Please enter the platform name: 
```

输入:

```
web-test
```

配置:

```
? Choose the access type about your package:
❯◉ main
 ◯ module
 ◯ bin
```

* main: 配置 package.json 中的 `main` 字段为 `dist/index.js`。
* module: 配置 package.json 中的 `module` 字段为 `esm/index.js`。
* bin: 配置 package.json 中的 `bin` 字段为 `bin/index.js`。

生成目录文件如下:

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

该命令可用于添加一个 package 平台依赖包或 platform 平台，并将依赖安装至根 `node_modules` 目录。

#### create template

该命令用于创建一个含有 resource 目录的模版公共包，将模版代码拷贝到包的 resource 目录下，即可作为模版在 create package 和 create platform 命令时使用。

在使用模版前，需要在整个项目根目录下的 `.pmnpsrc.json` 中配置，加入 `templates` 项。

```
$ pmnps create template
```

提示:

```
Welcome to pmnps!
? Please enter the template name: 
```

输入:

```
@scope/web-template
```

生成目录结构如下:

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

### 使用 refresh 命令

```
$ pmnps refresh
```

生成目录文件如下:

```
- project
  - node_modules
  - packages
    - @scope
    - test
      - src
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

该命令用于刷新项目，并将所有第三方依赖安装至根 `node_modules` 目录。

### 使用 start 命令

`start` 命令用于启动平台和公共包的 `npm start` 脚本，请在启用前配置 `package.json > scripts.start`。

```
$ pmnps start
```

或

```
# 全部启动
$ pmnps start -a
```

注意，在包编译模式下， start 命令将会启动所有公共包的 `npm start` 命令，如果，只希望启动被编译平台项目引用到的公共包，请使用 config 命令配置 `build by dependencies` 选项。

### 使用 build 命令

`build` 命令用于启动多个或单个平台的 `npm run build` 脚本，请在启用前配置 `package.json > scripts.build`。

```
# 编译所有平台
$ pmnps build
```

或

```
# 编译指定平台
$ pmnps build -n <platform name>
```

如果想要在 build 之前进行安装依赖项操作，可以使用 `-i` 选项。

```
$ pmnps build -i
```

如果想要使用 npm 脚本传参，可使用 `-p <param>` 选项。

```
$ pmnps build -p "-i -e <param desc>"
```

注意：以上写法，参数会传给所有 `npm run build` 脚本运行，如果希望指定平台可以用：

```
# 就像 url 参数一样，“?平台名=参数&平台名=参数”
$ pmnps build -p "?platA= -i -e <param desc>&platB= -i"
```

如果希望给 buildHook 脚本传参，可使用 `<plat|package name>.<before|after>= <param>` 的方式。

```
$ pmnps build -p "?platA= -i -e <param desc>&platB.before= -i"
```

注意，在包编译模式下， build 命令将会启动所有公共包的 `npm run build` 命令，如果，只希望启动被编译平台项目引用到的公共包，请使用 config 命令配置 `build by dependencies` 选项。

### 使用 config 命令

`config` 命令用于配置部分 pmnp 设置，如：启用 git、重命名 workspace 等。

```
$ pmnps config
```

选项：

```
allow publish to npm              
build by dependencies                
create package or platform privately 
create all with `README.md` file     
use git       
use old platforms dir name `plats`
```

关于 package 创建模式的说明：

* allow publish to npm：允许将包和平台发布至 npm 服务器。
* build by dependencies：在使用 `build` 和 `start` 命令时，只编译当前平台项目依赖的公共包。
* create package or platform privately：创建包和平台项目时，package.json 的 private 字段设置为 true，以防止发布了非公开的包。
* create all with `README.md` file：创建包和平台项目时，为其生成 README.md 文件。
* use git：使用 git
* use old platforms dir name `plats`：在 pmnps@3.0.0 之前，`platforms` 平台集群目录名为 `plats`，如果想要继续使用这个目录做平台集群管理，可开启此项。

### 使用 publish 命令

该命令用于发布所有修改了版本号的 package 和 platform。

```
$ pmnps publish
```

如果发布账号设置了一次性安全密码，可以使用 `-o` 参数带入密码。

```
$ pmnps publish -o 123456
```

## 配置 package.json

我们可以通过添加 "pmnps" 属性来使用 pmnps 的增强功能。

### platform 配置 platDependencies

通过使用 `pmnps.platDependencies` 配置可以描述出平台项目之间的 build 依赖关系，在我们运行 `build` 命令时， pmnps 会按照我们的描述逐一编译。

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

通过运行 `build` 命令，我们可以观察到 `build platC -> build platB -> build platA` 这样的编译顺序。

### 配置 ownRoot

通过在平台或公共包项目的 package.json 文件中配置 `pmnps.ownRoot` 可以让该平台或包使用自己的 `node_modules` 依赖目录。

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

### 配置 alias

项目别名配置，目前只对 `build -p` 命令起作用。使用 `-p` 参数时，可使用类似url的方式描述不同平台或公共包的编译参数，如果编译平台或包名过长，可使用别名。

package.json

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
    "alias": “pb”
  }
}
```

build

```
# 使用 name
$ pmnps build -p "?platB= -i -e <word>"
# 使用 alias
$ pmnps build -p "?pb= -i -e <word>"
```

### 配置 buildHook

`pmnps.buildHook` 提供了 `before` 和 `after` 两种编译介入模式，并可通过脚本的形式执行他们。在每一个平台编译前后都会检查平台 package.json 中是否有这一项，如有则按照编译的前后设定执行他们。

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

可配合 `build -p` 命令进行传参操作。

```
$ pmnps build -p "?platB.before=<params>"
```

如果希望给所有平台或包的 buildHook 传参，可使用 `<global>.before` 或 `<global>.after`：

```
$ pmnps build -p "?<global>.before=<params>"
```

## .pmnpsrc.json

`.pmnpsrc.json` 文件是项目的入口配置文件，它包含了 `workspace`、`git`、`templates`、`plugins` 等配置信息。

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

plugin 插件系统是自 `pmnps@3.0.0` 进行了重构，我们可以通过配置 `.pmnpsrc.json` 文件的方式使用它们。如果使用的插件来源于 npm 服务，在配置它们之前，请先将它们加入pmnps项目根目录 `package.json` 文件的 `devDependencies` 中。

```
{
  "workspace": "workspace",
  "plugins": ["my-pmnps-plugin"]
}
```

## 更新

### v3.0.0

* 重构项目文件读取修改系统
* template 创建方式通过 `create` 命令进行，创建的模版作用公共包使用。
* 重构了 plugin 接口。