import {
  structure,
  pkgJson,
  PackageJson,
  path,
  resource,
  plugin,
  config, env
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
  subprocess.stderr?.pipe(process.stderr);
  subprocess.stdout?.pipe(process.stdout);
  subprocess.stdin?.pipe(process.stdin);
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
  subprocess.stderr?.pipe(process.stderr);
  subprocess.stdout?.pipe(process.stdout);
  subprocess.stdin?.pipe(process.stdin);
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

function mergeDeps(
  deps: Record<string, any> | undefined,
  packageMap: Map<string, PackageJson>
): Record<string, any> | undefined {
  function rebuildVersion(version: string, target: string): string {
    if (version.startsWith('>=') || version.startsWith('<=')) {
      return version.slice(0, 2) + target;
    }
    if (
      version.startsWith('~') ||
      version.startsWith('^') ||
      version.startsWith('>') ||
      version.startsWith('<')
    ) {
      return version.slice(0, 1) + target;
    }
    return target;
  }

  if (!deps) {
    return deps;
  }
  const es = Object.entries(deps || {})
    .map(([n, v]) => {
      const workspacePackage = packageMap.get(n);
      if (!workspacePackage || !workspacePackage.version) {
        return undefined;
      }
      if (v.includes(workspacePackage.version)) {
        return undefined;
      }
      return [n, rebuildVersion(v, workspacePackage.version)];
    })
    .filter((d): d is [string, string] => !!d);
  if (!es.length) {
    return deps;
  }
  return { ...deps, ...Object.fromEntries(es) };
}

function refreshWorkspaceDependencies() {
  const { platforms, packages } = structure.packageJsons();
  const packageMap = new Map<string, PackageJson>(
    packages.map(p => [p.name, p])
  );
  const needUpdates = packages
    .concat(platforms)
    .map(p => {
      const { dependencies, devDependencies } = p;
      const newDependencies = mergeDeps(dependencies, packageMap);
      const newDevDependencies = mergeDeps(devDependencies, packageMap);
      if (
        dependencies === newDependencies &&
        devDependencies === newDevDependencies
      ) {
        return undefined;
      }
      return {
        ...p,
        dependencies: newDependencies,
        devDependencies: newDevDependencies
      } as PackageJson;
    })
    .filter((d): d is PackageJson => !!d);
  const updates = new Map(
    needUpdates.map(p => [path.join(p.getDirPath?.(), 'package.json'), p])
  );
  structure.rebuild(r => {
    const updateNodes = r.filter(node => {
      return updates.has(node.path);
    });
    updateNodes.forEach(node => {
      const json = updates.get(node.path);
      if (!json) {
        return;
      }
      node.write(JSON.stringify(json));
    });
  });
  return updates;
}

async function refreshAction() {
  if (!config.readConfig()) {
    message.warn('Please run `pmnps` to initial your workspace first.');
    return;
  }
  const res = await plugin.runPlugin('refresh');
  if (!res) {
    return;
  }
  message.info('refresh project ...');
  const { platforms, packages } = structure.packageJsons();
  const rootPackageJson = pkgJson.refreshRootPackageJson();
  const allPackageJsons = [...packages, ...platforms];
  const updatePackageJsons = refreshWorkspaceDependencies();
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
    const paths = updatePackageJsons.keys();
    return npx(
      [
        'prettier',
        '--write',
        path.join(path.rootPath, 'package.json'),
        path.join(path.rootPath, '.pmnpsrc.json'),
        path.join(path.rootPath, '.prettierrc.json'),
        ...paths
      ],
      { cwd: path.rootPath }
    );
  });
}

function commandRefresh(program: Command) {
  program
    .command('refresh')
    .description('Refresh `packages & plats` to link the unlink packages.')
    .action(async () => {
      message.desc(
        'This command can refresh packages and platforms, update package versions, and install dependencies.'
      );
      await refreshAction();
      message.success('refresh success');
      process.exit(0);
    });
}

export { commandRefresh, refreshAction, installAction };
