import {
  structure,
  pkgJson,
  file,
  PackageJson,
  path,
  resource, plugin, config
} from '@pmnps/core';
import { executeContext, message, Execution } from '@pmnps/tools';
import { Command } from 'commander';

async function installGlobal({ exec }: Execution) {
  message.log(
    '==================== install project root dependencies ===================='
  );
  const subprocess = exec('npm', ['install'], {
    cwd: path.rootPath
  });
  // @ts-ignore
  subprocess.stderr.pipe(process.stderr);
  // @ts-ignore
  subprocess.stdout.pipe(process.stdout);
  await subprocess;
}

async function installOwnRootPlats(
  plats: PackageJson[],
  tool: Execution
): Promise<void> {
  if (!plats.length) {
    return;
  }
  const [current, ...rest] = plats;
  const { getDirPath } = current;
  const dirPath = getDirPath?.();
  message.log(
    `==================== install own root platform ${
      (current || { name: 'unknown' }).name
    } dependencies ====================`
  );
  const subprocess = tool.exec('npm', ['install'], {
    cwd: dirPath
  });
  // @ts-ignore
  subprocess.stderr.pipe(process.stderr);
  // @ts-ignore
  subprocess.stdout.pipe(process.stdout);
  await subprocess;
  if (!rest.length) {
    return;
  }
  return installOwnRootPlats(rest, tool);
}

async function installAction(packageJsons: PackageJson[], refresh?: boolean) {
  const ownRoots = packageJsons.filter(packageJson => {
    const { pmnps } = packageJson;
    return pmnps && pmnps.ownRoot;
  });
  await executeContext(async tool => {
    if (
      !packageJsons.length ||
      packageJsons.length > ownRoots.length ||
      refresh
    ) {
      await installGlobal(tool);
    }
    await installOwnRootPlats(ownRoots, tool);
  });
  return ownRoots;
}

async function refreshAction() {
  if(!config.readConfig()){
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
  const res = await plugin.runPlugin('refresh');
  if(!res){
    return;
  }
  message.info('refresh project ...');
  const { platforms, packages } = structure.packageJsons();
  const rootPackageJson = pkgJson.refreshRootPackageJson();
  const allPackageJsons = [...packages, ...platforms];
  structure.rebuild((r, { file }) => {
    const ownRoots = allPackageJsons.filter(d => d.pmnps && d.pmnps.ownRoot);
    const ownRootNpmrcPaths = new Set(
      ownRoots.map(({ getDirPath }) => path.join(getDirPath?.(), '.npmrc'))
    );
    const npmrcNodes = structure.filter(r, s => ownRootNpmrcPaths.has(s.path));
    r.write([file('package.json', rootPackageJson).write()]);
    npmrcNodes.forEach(s => {
      s.write(content => content.replace(resource.forbiddenNpmrc, ''));
    });
  });
  await structure.flush();
  await installAction(allPackageJsons);
  await executeContext(async ({ npx }) => {
    return npx([
      'prettier',
      '--write',
      path.join(path.rootPath, 'package.json'),
      path.join(path.rootPath, '.pmnpsrc.json'),
      path.join(path.rootPath, '.prettierrc.json')
    ]);
  });
}

function commandRefresh(program: Command) {
  program
    .command('refresh')
    .description('Refresh `packages & plats` to link the unlink packages.')
    .action(refreshAction);
}

export { commandRefresh, refreshAction, installAction };
