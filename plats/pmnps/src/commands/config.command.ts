import {
  Config,
  config,
  define,
  file,
  path,
  pkgJson,
  structure,
  inquirer
} from '@pmnps/core';
import { executeContext, message } from '@pmnps/tools';
import { refreshAction } from './refresh.command';
import { Command } from 'commander';

const configRange: Array<[string, keyof Config]> = [
  ['allow publish to npm', 'publishable'],
  ['build by dependencies', 'buildByDependencies'],
  ['create package or platform privately', 'private'],
  ['create all with `README.md` file', 'createWithReadme'],
  ['use git', 'git'],
  ['use old platforms dir name `plats`', 'useOldDefineName']
];

function createConfigDefaults(
  rootConfig: Config,
  range: Array<[string, keyof Config]>
): string[] {
  const configRangeKeyMap = new Map<keyof Config, string>(
    range.map(([k, v]) => [v, k])
  );
  return Object.keys(rootConfig)
    .filter((k): k is keyof Config => !!rootConfig[k as keyof Config])
    .map(k => {
      return configRangeKeyMap.get(k as keyof Config) as string;
    });
}

async function writeConfig(): Promise<Config> {
  const rootConfig = config.readConfig() || ({} as Config);
  const { workspace } = await inquirer.prompt([
    {
      name: 'workspace',
      type: 'input',
      message: 'Please enter the workspace name:',
      default: rootConfig.workspace || 'workspace'
    }
  ]);

  message.desc(
    'If you want to build all packages, when use command `start` or `build`, you can choose the option `build with all packages`.'
  );
  const configRangeMap = new Map<string, keyof Config>(configRange);
  const { configs } = await inquirer.prompt([
    {
      name: 'configs',
      type: 'checkbox',
      message: 'Config project:',
      choices: [...configRangeMap.keys()],
      default: createConfigDefaults(rootConfig, configRange)
    }
  ]);
  const configSet = new Set(configs);
  const entries: Array<[keyof Config, boolean]> = configRange.map(([k, c]) => [
    c as keyof Config,
    configSet.has(k)
  ]);
  const newConfig = { workspace, ...Object.fromEntries(entries) };
  config.writeConfig(newConfig);
  return newConfig;
}

async function configAction() {
  message.info('start config pmnps ...');
  const rootPath = path.rootPath;
  const configJson = await writeConfig();
  const json = await pkgJson.writeRootPackageJson({
    name: configJson.workspace
  });
  structure.rebuild((r, { write, dir, file, res }) => {
    r.write(
      configJson.git
        ? [
            dir(define.PACKAGE_DIR_NAME),
            dir(define.platformDirName()),
            res.gitignore(),
            res.prettierrc(),
            file(define.CONFIG_FILE_NAME, configJson).write(),
            file('package.json', json).write()
          ]
        : [
            dir(define.PACKAGE_DIR_NAME),
            dir(define.platformDirName()),
            res.prettierrc(),
            write(file('package.json', json))
          ]
    );
  });
  await structure.flush();
  await config.flushConfig();
  await refreshAction();
  await executeContext(async ({ exec }) => {
    if (!configJson.git) {
      return;
    }
    const packageLock = path.join(rootPath, 'package-lock.json');
    const additions = [packageLock];
    const valids = additions.map(p => file.isFile(p));
    const flags = await Promise.all(valids);
    const additionPaths = additions.filter((p, i) => flags[i]);
    await exec(
      'git',
      [
        'add',
        path.join(rootPath, 'package.json'),
        path.join(rootPath, '.pmnpsrc.json'),
        path.join(rootPath, '.prettierrc.json'),
        path.join(rootPath, '.gitignore'),
        ...additionPaths
      ],
      {
        cwd: rootPath
      }
    );
  });
}

function commandConfig(program: Command) {
  program.command('config').description('Config pmnps.').action(configAction);
}

export { configAction, commandConfig };
