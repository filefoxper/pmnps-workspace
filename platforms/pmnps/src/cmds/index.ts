import { hold } from '@/state';
import { path } from '@/libs';
import { task } from '@/actions/task';
import type { Package } from '@pmnps/tools';

function parseParameters(parameters = '') {
  return parameters.split(/\s/).filter(d => d.trim());
}

export const SystemCommands = {
  start: () => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn' || core === 'yarn2') {
      return ['yarn', 'run', 'start'];
    }
    if (core === 'pnpm') {
      return ['pnpm', 'start'];
    }
    return ['npm', 'start'];
  },
  run: () => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn' || core === 'yarn2') {
      return ['yarn', 'run'];
    }
    if (core === 'pnpm') {
      return ['pnpm', 'run'];
    }
    return ['npm', 'run'];
  },
  install: (opt?: {
    hasLockFile?: boolean;
    hasNodeModules?: boolean;
    isPoint?: boolean;
    parameters?: string;
  }) => {
    const {
      useNpmCi,
      core = 'npm',
      useRefreshAfterInstall,
      installParameters = ''
    } = hold.instance().getState().config ?? {};
    const { hasLockFile, hasNodeModules, isPoint, parameters = '' } = opt ?? {};
    const ps = [
      ...parseParameters(installParameters),
      ...parseParameters(parameters)
    ]
      .join(' ')
      .split(' ')
      .filter(d => d.trim());
    if (core === 'yarn' || core === 'yarn2') {
      return isPoint && useRefreshAfterInstall
        ? ['yarn', 'install', '--ignore-scripts', ...ps]
        : ['yarn', 'install', ...ps];
    }
    if (core === 'pnpm') {
      return isPoint && useRefreshAfterInstall
        ? ['pnpm', 'install', '--ignore-scripts', ...ps]
        : ['pnpm', 'install', ...ps];
    }
    if (useNpmCi && !hasNodeModules && hasLockFile) {
      return isPoint && useRefreshAfterInstall
        ? ['npm', 'ci', '--ignore-scripts', ...ps]
        : ['npm', 'ci', ...ps];
    }
    return isPoint && useRefreshAfterInstall
      ? ['npm', 'install', '--ignore-scripts', ...ps]
      : ['npm', 'install', ...ps];
  },
  link: (pack: Package, to: Package) => {
    if (!pack.paths) {
      throw new Error('Can not add a workspace link.');
    }
    const [p, ...rest] = pack.paths;
    const parent =
      rest.length > 1
        ? path.join(to.path, 'node_modules', ...rest.slice(0, rest.length - 1))
        : path.join(to.path, 'node_modules');
    task.writeDir(parent);
    const targetPathname = path.join(to.path, 'node_modules', ...rest);
    return ['symlink', pack.path, targetPathname];
  },
  gitAdd: () => ['git', 'add']
};
