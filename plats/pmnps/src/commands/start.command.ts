import { Command } from 'commander';
import { config, inquirer, PackageJson, plugin, structure } from '@pmnps/core';
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
        const subprocess = exec('npm', ['start'], { cwd: dirPath,stdio:'inherit' });
        // subprocess.stderr?.pipe(process.stderr);
        // subprocess.stdout?.pipe(process.stdout);
        return subprocess;
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
      const subprocess = exec('npm', ['start'], {
        cwd: platform.getDirPath?.(),stdio:'inherit'
      });
      // subprocess.stderr?.pipe(process.stderr);
      // subprocess.stdout?.pipe(process.stdout);
      // subprocess.stdin?.pipe(process.stdin);
      return subprocess;
    });
    return Promise.all(runners);
  });
  await Promise.all([packagesStarter, starter]);
}

async function startAction({ all }: { all?: boolean }) {
  if (!config.readConfig()) {
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
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
  if (all) {
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
  message.info(`start developing platforms: ${platNames.join()}`);
  await startPlatforms(platformList, packages);
}

function commandStart(program: Command) {
  program
    .command('start')
    .description('Start `platform` for development.')
    .option('-a, --all', 'Start all platform for development')
    .action(startAction);
}

export { commandStart, startAction };
