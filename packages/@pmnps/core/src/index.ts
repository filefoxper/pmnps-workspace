import define from './define';
import structure from './structure';
import path from './path';
import env from './env';
import file from './file';
import config from './config';
import cache from './local';
import resource from './resource';
import pkgJson from './packageJson';
import plugin from './plugin';
import requires from './require';
import template from './template';
import inquirer from './inquirer';
import execution from './exec';
import {
  Config,
  LocalCache,
  PackageJsons,
  PluginPack,
  StructureRoot,
  TemplatePack
} from './type';

declare global {
  var pmnps: {
    rootPath?: string;
    config?: Config;
    local?: LocalCache;
    structureRoot?: StructureRoot;
    alterStructureRoot?: StructureRoot;
    packageJsons?: PackageJsons;
    plugin?: PluginPack[];
    templates?: TemplatePack[];
    rebuildContext?: boolean;
  };
}

export {
  define,
  path,
  structure,
  env,
  file,
  config,
  cache,
  resource,
  pkgJson,
  plugin,
  requires,
  template,
  inquirer,
  execution
};
