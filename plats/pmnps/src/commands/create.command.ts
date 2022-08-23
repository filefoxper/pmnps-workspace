import { Command } from 'commander';
import inquirer from 'inquirer';
import { Creation } from '@/type';
import { executeContext, message } from '@pmnps/tools';
import {
  config,
  define,
  file,
  PackageJson,
  path,
  plugin,
  ProjectType,
  resource,
  structure,
  StructureNode,
  template
} from '@pmnps/core';
import { refreshAction } from './refresh.command';

const range = ['package', 'platform', 'scope', 'template'];

async function createScope(name: string) {
  const { createWithReadme } = config.readConfig() || {};
  const scopeName = name.startsWith('@') ? name.slice(1) : name;
  const scope = `@${scopeName}`;
  message.info(`creating scope ${scope} ...`);
  const root = structure.root();
  const packagesNode = root.children.find(
    ({ name }) => name === define.PACKAGE_DIR_NAME
  );
  if (
    packagesNode &&
    (packagesNode.children || []).some(
      ({ name, type }) => name === scope && type === 'dir'
    )
  ) {
    message.warn(`The scope ${scope} is already exist.`);
    return;
  }
  structure.rebuild((r, { dir }) => {
    r.write([dir(define.PACKAGE_DIR_NAME, [dir(scope)])]);
  });
  await structure.flush();
  if (createWithReadme) {
    await executeContext(({ exec }) => {
      return exec('git', [
        'add',
        path.join(path.packagesPath, scope, 'README.md')
      ]);
    });
  }
  message.success(`create scope ${scope} success.`);
}

async function selectTemplates(
  type: 'package' | 'platform',
  name: (string | null)[]
): Promise<boolean> {
  const templatePath = await template.selectTemplate(type);
  if (!templatePath) {
    return false;
  }
  const { git, publishable } = config.readConfig() || {};
  const projectRoot =
    type === 'package' ? path.packagesPath : path.platformsPath;
  const folderPath = path.join(projectRoot, ...name);
  await file.copyFolder(path.join(templatePath, 'resource'), folderPath);
  await structure.flush();
  const actualName = name.filter((n): n is string => !!n).join('/');
  const { packages } = structure.packageJsons();
  const basic = buildBasicPackageJson(actualName);
  const current = packages.find(
    ({ getDirPath }) => getDirPath?.() === folderPath
  );
  structure.rebuild((r, tools) => {
    const currentNode = r.find({ path: folderPath });
    if (!currentNode) {
      return;
    }
    const json = currentNode.find({
      path: path.join(folderPath, 'package.json')
    });
    if (!json || !current) {
      return;
    }
    const { ownRoot } = current.pmnps || {};
    if (!ownRoot || !publishable) {
      currentNode.write([tools.res.npmForbiddenRc()]);
    }
    json.write(c => {
      const data = JSON.parse(c);
      return JSON.stringify({
        ...data,
        private: basic.private,
        name: basic.name,
        version: basic.version
      });
    });
  });
  await structure.flush();
  await refreshAction();
  await executeContext(async ({ exec, npx }): Promise<void> => {
    if (git) {
      await exec('git', ['add', folderPath], { cwd: path.rootPath });
    }
    await npx(['prettier', '--write', path.join(folderPath, 'package.json')], {
      cwd: path.rootPath
    });
  });
  return true;
}

function buildBasicPackageJson(name: string) {
  const { private: pri } = config.readConfig() || {};
  const defaultPackageJson = resource.defaultPackageJson;
  const { root = { version: '1.0.0' } as PackageJson } =
    structure.packageJsons();
  return {
    ...defaultPackageJson,
    private: pri,
    name,
    description: 'This is a package',
    version: root.version,
    devDependencies: {
      ...defaultPackageJson.devDependencies,
      prettier: (root.devDependencies || {}).prettier || '^2.7.0'
    }
  };
}

async function selectAccess(
  packageName: string,
  buildable: boolean | undefined,
  strict: boolean | undefined
): Promise<Partial<PackageJson>> {
  const packageJson = buildBasicPackageJson(packageName);
  if (!buildable) {
    return strict
      ? {
          ...packageJson,
          module: './src/index.js',
          type: 'module'
        }
      : {
          ...packageJson,
          module: 'index.js',
          type: 'module'
        };
  }
  const { access: ac } = await inquirer.prompt([
    {
      name: 'access',
      type: 'checkbox',
      message: 'Choose the access type about your package:',
      choices: ['main', 'module', 'bin'],
      default: ['main']
    }
  ]);
  const access = ac.length ? ac : ['main'];
  const res: Record<string, Partial<PackageJson>> = {
    main: {
      main: 'dist/index.js',
      files: ['dist']
    },
    bin: {
      bin: {
        [packageName]: 'bin/index.js'
      },
      preferGlobal: true,
      files: ['bin']
    },
    module: {
      module: 'esm/index.js',
      type: 'module',
      files: ['esm']
    }
  };
  const partial = access.reduce((r: Partial<PackageJson>, a: string) => {
    const data = res[a];
    const { files = [] } = data;
    return { ...r, ...data, files: (r.files || []).concat(files) };
  }, {} as Partial<PackageJson>);
  const { scripts } = packageJson;
  const newScripts = {
    start: 'echo edit start script',
    build: 'echo edit build script',
    ...scripts
  };
  return {
    scripts: newScripts,
    ...packageJson,
    ...partial
  };
}

async function optimize(
  name: string,
  projectType: StructureNode['projectType']
) {
  const { git } = config.readConfig() || {};
  const node = structure.root().find({ name, projectType });
  if (!node) {
    return;
  }
  const files = (node.children || []).filter(
    ({ type, name }) => type === 'file' && name.endsWith('.json')
  );
  const filePaths = files.map(file => file.path);
  await executeContext(async ({ exec, npx }): Promise<void> => {
    let gitProcess: Promise<unknown> = Promise.resolve(undefined);
    if (git) {
      gitProcess = exec('git', ['add', node.path], { cwd: path.rootPath });
    }
    const prettierProcess = npx(['prettier', '--write', ...filePaths], {
      cwd: path.rootPath
    });
    await Promise.all([gitProcess, prettierProcess]);
  });
}

async function flush(name: string, projectType: ProjectType) {
  await structure.flush();
  await Promise.all([refreshAction(), optimize(name, projectType)]);
}

const packageConfigRange: Array<[string, string]> = [
  ['create package with `root index module`', 'rootIndex'],
  ['create package buildable', 'buildable']
];

async function createPackage(name: string) {
  const configMap = new Map(packageConfigRange);
  const { createWithReadme, publishable } = config.readConfig() || {};
  const isScopePackage = name.startsWith('@');
  const [scopeOrName, scopePackageName = ''] = name.split('/');
  if (
    (isScopePackage && !scopePackageName.trim()) ||
    (!isScopePackage && scopePackageName.trim())
  ) {
    message.warn('This is not a validate package name.');
    return;
  }
  const root = structure.root();
  const packRoot = (root.children || []).find(
    ({ name }) => name === define.PACKAGE_DIR_NAME
  );
  if (
    isScopePackage &&
    (!packRoot ||
      !(packRoot.children || []).some(({ name }) => name === scopeOrName))
  ) {
    message.warn(
      `The scope ${scopeOrName} is not exist, it may be a mistake, or create the scope first.`
    );
    return;
  }
  if (
    !isScopePackage &&
    packRoot &&
    (packRoot.children || []).some(({ name }) => name === scopeOrName)
  ) {
    message.warn(
      `The package ${scopeOrName} is exist, please choose a new package name.`
    );
    return;
  }
  message.info(`creating package ${name} ...`);
  const usedTemplate = await selectTemplates('package', [
    scopeOrName,
    scopePackageName || null
  ]);
  if (usedTemplate) {
    message.success(`create package ${name} success.`);
    return;
  }
  const { config: packageConfig } = await inquirer.prompt([
    {
      name: 'config',
      type: 'checkbox',
      message: 'Config the package:',
      choices: [...configMap.keys()]
    }
  ]);
  const packageConfigSet = new Set(packageConfig);
  const e: Array<[string, boolean]> = [...configMap].map(
    ([k, v]) => [v, packageConfigSet.has(k)] as [string, boolean]
  );
  const selectedMap = new Map<string, boolean>(e);
  const strict = !selectedMap.get('rootIndex');
  const packageJson = await selectAccess(
    name,
    selectedMap.get('buildable'),
    strict
  );

  const packageName = isScopePackage ? scopePackageName : scopeOrName;
  structure.rebuild((r, { dir, file, res }) => {
    const packageNode = dir(packageName, [
      strict ? dir('src', [file('index.js')]) : file('index.js'),
      createWithReadme ? res.readme(`# ${name}`) : undefined,
      res.prettierrc(),
      res.gitignore(),
      (packageJson.pmnps && packageJson.pmnps.ownRoot) || publishable
        ? undefined
        : res.npmForbiddenRc(),
      file('package.json', packageJson)
    ]);
    r.write([
      dir(define.PACKAGE_DIR_NAME, [
        isScopePackage ? dir(scopeOrName, [packageNode]) : packageNode
      ])
    ]);
  });
  const res = await plugin.runPlugin('create');
  if (!res) {
    return;
  }
  await flush(packageName, 'package');
  message.success(`create package ${name} success.`);
}

function buildTemplateIndex(projectType: 'package' | 'platform') {
  return `"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var src_default = {
  projectType: "${projectType}",
  path:module.path
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
`;
}

async function createTemplate(n: string) {
  const name = n;
  const isScopePackage = name.startsWith('@');
  const [scopeOrName, scopePackageName = ''] = name.split('/');
  if (
    (isScopePackage && !scopePackageName.trim()) ||
    (!isScopePackage && scopePackageName.trim())
  ) {
    message.warn('This is not a validate package name.');
    return;
  }
  const root = structure.root();
  const packRoot = (root.children || []).find(
    ({ name }) => name === define.PACKAGE_DIR_NAME
  );
  if (
    isScopePackage &&
    (!packRoot ||
      !(packRoot.children || []).some(({ name }) => name === scopeOrName))
  ) {
    message.warn(
      `The scope ${scopeOrName} is not exist, it may be a mistake, or create the scope first.`
    );
    return;
  }
  if (
    !isScopePackage &&
    packRoot &&
    (packRoot.children || []).some(({ name }) => name === scopeOrName)
  ) {
    message.warn(
      `The package ${scopeOrName} is exist, please choose a new package name.`
    );
    return;
  }
  const { projectType } = await inquirer.prompt([
    {
      name: 'projectType',
      type: 'list',
      message: 'Select a projectType for template:',
      choices: ['package', 'platform'],
      default: 'package'
    }
  ]);
  const { devDependencies, dependencies, ...json } =
    buildBasicPackageJson(name);
  const packageJson = {
    ...json,
    main: 'index.js',
    files: ['index.js', 'resource']
  };
  structure.rebuild((r, { dir, file }) => {
    const contents = [
      dir('resource'),
      file('index.js', buildTemplateIndex(projectType)),
      file('package.json', packageJson)
    ];
    r.write([
      dir(define.PACKAGE_DIR_NAME, [
        isScopePackage
          ? dir(scopeOrName, [dir(scopePackageName, contents)])
          : dir(scopeOrName, contents)
      ])
    ]);
  });
  const packageName = isScopePackage ? scopePackageName : scopeOrName;
  await flush(packageName, 'package');
  await executeContext(({ npx }) => {
    return npx(
      [
        'prettier',
        '--write',
        path.join(
          path.packagesPath,
          scopeOrName,
          scopePackageName || null,
          'index.js'
        )
      ],
      { cwd: path.rootPath }
    );
  });
  message.success(`create template ${name} success.`);
}

async function createPlatform(platformName: string) {
  const { createWithReadme, publishable } = config.readConfig() || {};
  const root = structure.root();
  const packRoot = (root.children || []).find(
    ({ name }) => name === define.PLATFORM_DIR_NAME
  );
  if (
    packRoot &&
    (packRoot.children || []).some(({ name }) => name === platformName)
  ) {
    message.warn(
      `The platform ${platformName} is exist, please choose a new platform name.`
    );
    return;
  }
  message.info(`creating platform ${platformName} ...`);

  const usedTemplate = await selectTemplates('platform', [platformName]);
  if (usedTemplate) {
    message.success(`create platform ${platformName} success.`);
    return;
  }
  const packageJson = await selectAccess(platformName, true, true);

  structure.rebuild((r, { dir, file, res }) => {
    r.write([
      dir(define.PLATFORM_DIR_NAME, [
        dir(platformName, [
          dir('src', [file('index.js')]),
          createWithReadme ? res.readme(`# ${platformName}`) : undefined,
          res.prettierrc(),
          res.gitignore(),
          (packageJson.pmnps && packageJson.pmnps.ownRoot) || publishable
            ? undefined
            : res.npmForbiddenRc(),
          file('package.json', packageJson)
        ])
      ])
    ]);
  });
  const res = await plugin.runPlugin('create');
  if (!res) {
    return;
  }
  await flush(platformName, 'platform');
  message.success(`create platform ${platformName} success.`);
}

async function create(creation: Creation, name?: string) {
  let n: string | undefined = name;
  if (typeof n !== 'string') {
    const { name: na } = await inquirer.prompt([
      {
        name: 'name',
        type: 'input',
        message: `Please enter the ${creation} name:`
      }
    ]);
    n = na;
  }
  if (n == null || !n.trim()) {
    message.warn(`You should provide a name for the creating ${creation}`);
    return;
  }
  if (creation === 'scope') {
    return createScope(n);
  }
  if (creation === 'package') {
    return createPackage(n);
  }
  if (creation === 'platform') {
    return createPlatform(n);
  }
  if (creation === 'template') {
    return createTemplate(n);
  }
  message.error('A bug about `pmnps` happens here.');
}

async function createAction(
  argument: string | null,
  options: { name?: string }
) {
  if (!config.readConfig()) {
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
  const { name } = options;
  const target = range.find(s => s === argument || '');
  if (target != null) {
    return create(target as Creation, name);
  }
  const { creation } = await inquirer.prompt([
    {
      name: 'creation',
      type: 'list',
      message: 'Choose what you want to create:',
      choices: range
    }
  ]);
  return create(creation, name);
}

async function emptyCreateAction() {
  return createAction(null, {});
}

function commandCreate(program: Command) {
  program
    .command('create')
    .argument(
      '[string]',
      'Choose `package`, `platform`, `scope` or `template`',
      null
    )
    .description('Create a package, platform, scope or template')
    .action(createAction);
}

export { commandCreate, createAction, emptyCreateAction };
