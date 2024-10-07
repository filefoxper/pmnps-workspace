import process from 'process';
import { hold } from '@/state';
import { path } from '@/libs';
import { task } from '@/actions/task';
import type { Package } from '@pmnps/tools';

function parseParameters(parameters = '') {
  return parameters.split(/\s/).filter(d => d.trim());
}

function buildExtendParameters(
  installExtendParameters: any[],
  core: 'npm' | 'pnpm' | 'yarn' | 'yarn2'
) {
  if (core === 'yarn' || core === 'yarn2') {
    return [];
  }
  const extendParameters = installExtendParameters
    .filter((e): e is string => typeof e === 'string')
    .map(e => e.trim());
  const extendParameterConfigEntries = extendParameters.map(
    e =>
      [
        (core === 'npm' ? 'npm_config_' : 'pnpm_config') + e.replace(/-/g, '_'),
        e
      ] as const
  );
  const extendsConfigParameterMap = new Map(extendParameterConfigEntries);
  return Object.keys(process.env)
    .map(
      k =>
        [
          extendsConfigParameterMap.get(k.toLocaleLowerCase()),
          process.env[k]
        ] as const
    )
    .filter((e): e is [string, string] => !!(e[0] && e[1]))
    .map(([k, v]) => `--${k}=${v}`);
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
      npmCiFirst,
      core = 'npm',
      refreshAfterInstall,
      installParameters = '',
      installExtendParameters = []
    } = hold.instance().getState().config ?? {};
    const { hasLockFile, hasNodeModules, isPoint, parameters = '' } = opt ?? {};
    const ps = [
      ...parseParameters(installParameters),
      ...parseParameters(parameters)
    ]
      .join(' ')
      .split(' ')
      .filter(d => d.trim());
    const npmExtendFields = buildExtendParameters(
      installExtendParameters,
      core
    );
    if (core === 'yarn' || core === 'yarn2') {
      return ['yarn', 'install', ...ps, ...npmExtendFields];
    }
    if (core === 'pnpm') {
      return ['pnpm', 'install', ...ps, ...npmExtendFields];
    }
    if (npmCiFirst && !hasNodeModules && hasLockFile) {
      return ['npm', 'ci', ...ps, ...npmExtendFields];
    }
    return ['npm', 'install', ...ps, ...npmExtendFields];
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
