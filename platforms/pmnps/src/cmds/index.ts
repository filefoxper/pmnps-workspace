import { hold } from '@/state';
import type { Package } from '@/types';

function parseParameters(parameters = '') {
  return parameters.split(/\s/).filter(d => d.trim());
}

export const SystemCommands = {
  start: () => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn') {
      return ['yarn', 'run', 'start'];
    }
    return ['npm', 'start'];
  },
  run: () => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn') {
      return ['yarn', 'run'];
    }
    return ['npm', 'run'];
  },
  install: (opt?: {
    hasPackageLockJsonFile?: boolean;
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
    const {
      hasPackageLockJsonFile,
      hasNodeModules,
      isPoint,
      parameters = ''
    } = opt ?? {};
    const ps = [
      ...parseParameters(installParameters),
      ...parseParameters(parameters)
    ]
      .join(' ')
      .split(' ')
      .filter(d => d.trim());
    if (core === 'yarn') {
      return isPoint && useRefreshAfterInstall
        ? ['yarn', 'install', '--ignore-scripts', ...ps]
        : ['yarn', 'install', ...ps];
    }
    if (useNpmCi && !hasNodeModules && hasPackageLockJsonFile) {
      return isPoint && useRefreshAfterInstall
        ? ['npm', 'ci', '--ignore-scripts', ...ps]
        : ['npm', 'ci', ...ps];
    }
    return isPoint && useRefreshAfterInstall
      ? ['npm', 'install', '--ignore-scripts', ...ps]
      : ['npm', 'install', ...ps];
  },
  link: (packs: Package[]) => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn') {
      return ['yarn', 'install', '--ignore-scripts'];
    }
    return [
      'npm',
      'install',
      '--ignore-scripts',
      '--no-save',
      '--workspace',
      ...packs.map(n => n.name)
    ];
  },
  gitAdd: () => ['git', 'add']
};
