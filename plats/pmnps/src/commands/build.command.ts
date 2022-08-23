import { Command } from 'commander';
import {
  config,
  PackageJson,
  plugin,
  ProjectType,
  structure
} from '@pmnps/core';
import { executeContext, Execution, message } from '@pmnps/tools';
import execa from 'execa';
import { installAction } from './refresh.command';

function markPackages(
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
  return range.filter(({ dets, used }) => (!dets || !dets.length) && used);
}

function markPlats(
  range: Array<PackageJson>,
  packs: Array<PackageJson>
): Array<PackageJson> {
  const rangeMap = new Map<string, PackageJson>(range.map(p => [p.name, p]));
  packs.forEach(p => {
    const { pmnps } = p;
    const { platDependencies = [] } = pmnps || {};
    const deps = platDependencies
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
  return range.filter(({ dets, used }) => (!dets || !dets.length) && used);
}

function selectPackages(
  platforms: PackageJson[],
  packages: PackageJson[]
): PackageJson[] {
  const { buildByDependencies } = config.readConfig() || {};
  if (!buildByDependencies) {
    return packages;
  }
  const deps = platforms.flatMap(platform => {
    const { dependencies, devDependencies } = platform;
    const deps = { ...dependencies, ...devDependencies };
    return packages.filter(d => deps[d.name]);
  });
  return [...new Set(deps)];
}

function groupTasks(packages: PackageJson[]): Array<PackageJson[]> {
  const deps = packages.flatMap(({ deps }) => deps || []);
  if (!deps.length) {
    return [packages];
  }
  const result = groupTasks(deps);
  return [...result, packages];
}

function computeTaskGroups(packages: PackageJson[]) {
  const tasks = groupTasks(packages);
  let packageSet = new Set<PackageJson>();
  return tasks.map(task => {
    const ts = new Set(task);
    const group = [...ts].filter(p => !packageSet.has(p));
    packageSet = new Set([...packageSet, ...group]);
    return group;
  });
}

function logBuffer(buffer: execa.ExecaSyncReturnValue | undefined) {
  if (!buffer) {
    return;
  }
  const { stdout, stderr } = buffer;
  if (stderr) {
    console.log(stderr);
  } else {
    console.log(stdout);
  }
}

function parseParam(
  pf: PackageJson,
  param?: string,
  fix?: 'before' | 'after'
): string | undefined {
  if (!param) {
    return undefined;
  }
  const trimParam = param.trim();
  if (!trimParam.startsWith('?')) {
    return trimParam;
  }
  const paramString = trimParam.slice(1);
  const parts = paramString.split('&');
  const entries = parts
    .map(part => {
      const [key, value] = part.split('=');
      if (!value || !value.trim()) {
        return undefined;
      }
      return [key, value];
    })
    .filter((d): d is [string, string] => !!d);
  const { name, pmnps = {} } = pf;
  const { alias } = pmnps;
  const map = Object.fromEntries(entries);
  const nameKey = fix ? `${name}.${fix}` : name;
  if (map[nameKey]) {
    return map[nameKey];
  }
  if (!alias) {
    return undefined;
  }
  const aliasKey = fix ? `${alias}.${fix}` : alias;
  if (map[aliasKey]) {
    return map[aliasKey];
  }
  return undefined;
}

async function multiExecute(
  projectType: ProjectType,
  packageJson: PackageJson,
  execution: Execution,
  param?: string
) {
  const { command } = execution;
  const { getDirPath, name, pmnps = {} } = packageJson;
  const dirPath = getDirPath?.();
  const { buildHook = {} } = pmnps;
  const { before, after } = buildHook;
  let beforeBuffer;
  let afterBuffer;
  if (before) {
    const beforeParam = parseParam(packageJson, param, 'before') || '';
    beforeBuffer = await command(before + beforeParam, {
      cwd: dirPath
    });
  }
  const pam = parseParam(packageJson, param);
  const buffer = await command(`npm run build ${pam ? '-- ' + pam : ''}`, {
    cwd: dirPath
  });
  if (after) {
    const afterParam = parseParam(packageJson, param, 'after') || '';
    afterBuffer = await command(after + afterParam, {
      cwd: dirPath
    });
  }
  message.log(
    `==================== ${projectType} ${name} ====================`
  );
  logBuffer(beforeBuffer);
  logBuffer(buffer);
  logBuffer(afterBuffer);
}

async function execute(
  projectType: ProjectType,
  packageJson: PackageJson,
  execution: Execution,
  param?: string
) {
  const { command } = execution;
  const { getDirPath, name, pmnps = {} } = packageJson;
  const dirPath = getDirPath?.();
  const { buildHook = {} } = pmnps;
  const { before, after } = buildHook;
  let beforeBuffer;
  let afterBuffer;
  message.log(
    `==================== ${projectType} ${name} ====================`
  );
  if (before) {
    const beforeParam = parseParam(packageJson, param, 'before') || '';
    beforeBuffer = command(before + beforeParam, {
      cwd: dirPath
    });
    beforeBuffer.stderr?.pipe(process.stderr);
    beforeBuffer.stdout?.pipe(process.stdout);
    await beforeBuffer;
  }
  const pam = parseParam(packageJson, param);
  const buffer = command(`npm run build ${pam ? '-- ' + pam : ''}`, {
    cwd: dirPath
  });
  buffer.stderr?.pipe(process.stderr);
  buffer.stdout?.pipe(process.stdout);
  await buffer;
  if (after) {
    const afterParam = parseParam(packageJson, param, 'after') || '';
    afterBuffer = command(after + afterParam, {
      cwd: dirPath
    });
    afterBuffer.stderr?.pipe(process.stderr);
    afterBuffer.stdout?.pipe(process.stdout);
    await afterBuffer;
  }
}

async function buildTaskGroups(
  projectType: ProjectType,
  groups: Array<PackageJson[]>,
  execution: Execution,
  param?: string
) {
  if (!groups.length) {
    return;
  }
  const [current, ...rest] = groups;
  const isSingle = current.length === 1;
  const processes = current.map(async p => {
    if (isSingle) {
      await execute(projectType, p, execution, param);
      return;
    }
    await multiExecute(projectType, p, execution, param);
  });
  await Promise.all(processes);
  if (rest.length) {
    await buildTaskGroups(projectType, rest, execution, param);
  }
}

function buildPackages(
  platforms: PackageJson[],
  packages: PackageJson[]
): Array<PackageJson[]> {
  const { buildByDependencies } = config.readConfig() || {};
  const pkgs = buildByDependencies
    ? selectPackages(platforms, packages)
    : packages;
  const bottoms = markPackages(packages, pkgs);
  return computeTaskGroups(bottoms);
}

function buildPlatforms(
  platformRange: PackageJson[],
  platforms: PackageJson[]
): Array<PackageJson[]> {
  const bottoms = markPlats(platformRange, platforms);
  return computeTaskGroups(bottoms);
}

async function buildAction({
  name: startPlat,
  install,
  param
}: { name?: string; install?: boolean; param?: string } | undefined = {}) {
  if(!config.readConfig()){
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
  const { packages, platforms } = structure.packageJsons();
  const buildablePackages = packages.filter(d => d.scripts && d.scripts.build);
  const buildablePlatforms = platforms.filter(
    d => d.scripts && d.scripts.build
  );
  if (!buildablePackages.length && !buildablePlatforms.length) {
    message.warn('No buildable package or platform has been detected.');
    return;
  }
  if (startPlat && !buildablePlatforms.some(d => d.name === startPlat)) {
    message.warn(`The platform ${startPlat} is not buildable.`);
    return;
  }
  const res = await plugin.runPlugin('build');
  if (!res) {
    return;
  }
  message.info('build start ...');
  const plats = startPlat
    ? buildablePlatforms.filter(d => d.name === startPlat)
    : buildablePlatforms;
  const packageGroups = buildPackages(plats, buildablePackages);
  const platformGroups = buildPlatforms(buildablePlatforms, plats);
  if (install) {
    message.log('install dependencies ...');
    const installPacks = [...packageGroups, ...platformGroups].flat();
    await installAction(installPacks);
  }
  message.log('build packages and platforms ...');
  await executeContext(async execution => {
    await buildTaskGroups('package', packageGroups, execution, param);
    await buildTaskGroups('platform', platformGroups, execution, param);
  });
}

function commandBuild(program: Command) {
  program
    .command('build')
    .description('build `platform` and `packages` for production.')
    .option('-n, --name <char>', 'Enter the platform name for building')
    .option('-p, --param <char>', 'Enter the platform building params')
    .option('-i, --install', 'Install before build')
    .action(buildAction);
}

export { commandBuild, buildAction };
