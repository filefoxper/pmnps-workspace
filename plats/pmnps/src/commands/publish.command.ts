import { Command } from 'commander';
import { config, env, PackageJson, ProjectType, structure } from '@pmnps/core';
import { executeContext, Execution, message } from '@pmnps/tools';
import execa from 'execa';

async function fetchVersion(
  pack: PackageJson,
  { exec }: Execution
): Promise<PackageJson | null> {
  const { name, version, private: pri } = pack;
  if (pri || !version || !name) {
    return null;
  }
  try {
    const { stdout, stderr } = await exec('npm', ['view', name, 'version']);
    if (stderr) {
      return pack;
    }
    const remoteVersion = stdout.trim();
    const isNotGreater = env.versionCompare(remoteVersion, version);
    if (!isNotGreater) {
      return pack;
    }
    return null;
  } catch (e: any) {
    if (!e || !e.toString().includes('404')) {
      return null;
    }
    return pack;
  }
}

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

async function publishPack(
  projectType: ProjectType,
  packageJson: PackageJson,
  execution: Execution,
  option: { otp?: string }
) {
  const { otp } = option;
  const { name } = packageJson;
  const packEnds = name.split('/');
  const isScope =
    projectType === 'package' && name.startsWith('@') && packEnds.length > 1;
  const scopeParams = isScope ? ['--access=public'] : [];
  const otpParams = otp ? ['--otp', otp] : [];
  return execution.exec('npm', ['publish', ...scopeParams, ...otpParams], {
    cwd: packageJson.getDirPath?.()
  });
}

async function publishPackageTask(
  projectType: ProjectType,
  tasks: PackageJson[][],
  packSet:Set<string>,
  option: { otp?: string }
) {
  if (!tasks.length) {
    return;
  }
  const [current, ...rest] = tasks;
  await executeContext(async execution => {
    const task = current.filter((v)=>packSet.has(v.name));
    const builds = task.map(packageJson =>
      publishPack(projectType, packageJson, execution, option)
    );
    const results = await Promise.all(builds);
    results.forEach((buffer, index) => {
      const { name } = task[index];
      message.log(`==================== package ${name} ====================`);
      logBuffer(buffer);
    });
  });

  if (!rest.length) {
    return;
  }
  await publishPackageTask(projectType, rest,packSet, option);
}

async function batchPublishPackages(
  range: Array<PackageJson>,
  packs: Array<PackageJson>,
  option: { otp?: string }
) {
  if (!range.length || !packs.length) {
    return;
  }
  const marked = markPackages(range, range);
  const tasks = computeTaskGroups(marked);
  const packSet = new Set(packs.map(({name})=>name));
  return publishPackageTask('package', tasks,packSet, option);
}

async function publishAction(option: { otp?: string }) {
  if(!config.readConfig()){
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
  const { publishable } = config.readConfig() || {};
  if (!publishable) {
    message.warn('Please use command `config` to enable publish action first.');
    return;
  }
  message.log('start to analyze publish packages and platforms');
  const { packages, platforms } = structure.packageJsons();
  const packagesFetcher = executeContext(execution => {
    return Promise.all(packages.map(p => fetchVersion(p, execution)));
  });
  const platformsFetcher = executeContext(execution => {
    return Promise.all(platforms.map(p => fetchVersion(p, execution)));
  });
  const packs = await packagesFetcher;
  const plats = await platformsFetcher;
  message.log('start to publish packages and platforms');
  const validPacks = packs.filter((d): d is PackageJson => !!d);
  await batchPublishPackages(packages, validPacks, option);
  const validPlats = plats.filter((d): d is PackageJson => !!d);
  const publishResults = await executeContext(execution => {
    const publishes = validPlats.map(packageJson =>
      publishPack('platform', packageJson, execution, option)
    );
    return Promise.all(publishes);
  });
  if (!validPacks.length && !validPlats.length) {
    message.log('nothing for publishing');
  } else {
    publishResults.forEach((d, i) => {
      const { name } = validPlats[i];
      message.log(`==================== platform ${name} ====================`);
      logBuffer(d);
    });
  }
}

function commandPublish(program: Command) {
  program
    .command('publish')
    .description('Publish all packages and platforms')
    .option('-o, --otp <char>', 'Set the one-time passwd for publishing')
    .action(publishAction);
}

export { commandPublish, publishAction };
