import { Command } from 'commander';
import {
  cache,
  config,
  inquirer,
  PackageJson,
  plugin,
  structure
} from '@pmnps/core';
import { executeContext, message } from '@pmnps/tools';

function markPackage(
  range: Array<PackageJson>,
  packs: Array<PackageJson>
): Array<PackageJson> {
  const rangeMap = new Map<string, PackageJson>(range.map(p => [p.name, p]));
  packs.forEach(p => {
    const { dependencies, devDependencies } = p;
    const allDeps = { ...dependencies, ...devDependencies };
    const deps = Object.keys(allDeps)
      .map(n => rangeMap.get(n))
      .filter((pa): pa is PackageJson => !!pa);
    p.deps = deps;
    p.used = true;
    deps.forEach(sourcePack => {
      const dets = sourcePack.dets || [];
      sourcePack.used = true;
      sourcePack.dets = [...new Set([...dets, p])];
    });
  });
  return range.filter(({ used }) => used);
}

function selectPackages(
  platforms: PackageJson[],
  packages: PackageJson[]
): PackageJson[] {
  const { buildByDependencies } = config.readConfig() || {};
  if (!buildByDependencies) {
    return packages.filter(d => d.scripts && d.scripts.start);
  }
  const deps = platforms.flatMap(platform => {
    const { dependencies, devDependencies } = platform;
    const deps = { ...dependencies, ...devDependencies };
    const depPackages = packages.filter(d => deps[d.name]);
    const needStarts = markPackage(packages, depPackages);
    return needStarts.filter(d => d.scripts && d.scripts.start);
  });
  return [...new Set(deps)];
}

function startPackages(platforms: PackageJson[], packages: PackageJson[]) {
  const needStarts = selectPackages(platforms, packages);
  return executeContext(({ exec }) => {
    return Promise.all(
      needStarts.map(async ({ getDirPath }) => {
        const dirPath = getDirPath?.();
        if (!dirPath) {
          return;
        }
        return exec('npm', ['start'], {
          cwd: dirPath,
          stdio: 'inherit'
        });
      })
    );
  });
}

async function startPlatforms(
  platforms: PackageJson[],
  packages: PackageJson[]
) {
  const packagesStarter = startPackages(platforms, packages);
  const starter = executeContext(({ exec }) => {
    const runners = platforms.map(platform => {
      return exec('npm', ['start'], {
        cwd: platform.getDirPath?.(),
        stdio: 'inherit'
      });
    });
    return Promise.all(runners);
  });
  await Promise.all([packagesStarter, starter]);
}

async function startAction(op?: {
  all?: boolean;
  group?: string;
  choose?: boolean;
}) {
  const { start: startCache } = cache.readCache() || {};
  const { all, group, choose } = op || {};
  message.desc(
    'You can choose the platforms for developing by running the `npm start` script in package.jsons'
  );
  message.desc(
    'The packages will be started too, if there are `start script` in the package.jsons'
  );
  message.desc(
    'If you want to start all platforms without choose operation, use `-a` option.'
  );
  message.desc(
    'If you want to record the `start` selections as a group, use `-g xxx` option.'
  );
  message.desc(
    'If the `xxx` group is exist, `-g xxx` option will start the group cache without choose operation.'
  );
  message.desc(
    'If you want to start with platform choose operation explicitly, use `-c` option.'
  );
  if (!config.readConfig()) {
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
  const groups: undefined | string[] =
    group && group.trim() ? startCache?.groups?.[group.trim()] : undefined;
  const res = await plugin.runPlugin('start');
  if (!res) {
    return;
  }
  const { packages, platforms } = structure.packageJsons();
  const forms = platforms.filter(d => d.scripts && d.scripts.start);
  if (!forms.length) {
    message.warn('No start able `platform` has been detected');
    return;
  }
  const groupSet = new Set(groups || []);
  const validGroupForms = forms.filter(d => groupSet.has(d.name));
  if (validGroupForms.length && !choose) {
    message.info(`start developing group ${group?.trim() || 'unknown'}`);
    await startPlatforms(validGroupForms, packages);
    return;
  }
  if (all && !choose) {
    message.info(`start developing all platform`);
    await startPlatforms(platforms, packages);
    return;
  }
  const names = forms.map(d => d.name);
  const { name: platNames } = await inquirer.prompt([
    {
      name: 'name',
      type: 'checkbox',
      message: 'Choose the platforms you want to start:',
      choices: names
    }
  ]);
  if (!platNames.length) {
    message.warn('You should choose platforms for developing.');
    return;
  }
  const nameSet = new Set(platNames);
  const platformList = platforms.filter(d => nameSet.has(d.name));
  if (group) {
    const groupValue = platformList.map(d => d.name);
    const c = {
      ...startCache,
      groups: {
        ...startCache?.groups,
        [group.trim() || 'unknown']: groupValue.length?groupValue:undefined
      }
    };
    cache.writeCache({ start: c });
    await cache.flushCache();
  }
  message.info(`start developing platforms: ${platNames.join()}`);
  await startPlatforms(platformList, packages);
}

function commandStart(program: Command) {
  program
    .command('start')
    .description('Start `platform` for development.')
    .option('-a, --all', 'Start all platform for development')
    .option('-c, --choose', 'Start with force choose option')
    .option('-g, --group <char>', 'Memo the started platforms as a group')
    .action(startAction);
}

export { commandStart, startAction };
