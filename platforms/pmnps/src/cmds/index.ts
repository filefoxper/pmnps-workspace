import { hold } from '@/state';
import type { Package } from '@/types';

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
  }) => {
    const {
      useNpmCi,
      core = 'npm',
      useRefreshAfterInstall
    } = hold.instance().getState().config ?? {};
    const { hasPackageLockJsonFile, hasNodeModules, isPoint } = opt ?? {};
    if (core === 'yarn') {
      return isPoint && useRefreshAfterInstall
        ? ['yarn', 'install', '--ignore-scripts']
        : ['yarn', 'install'];
    }
    if (useNpmCi && !hasNodeModules && hasPackageLockJsonFile) {
      return isPoint && useRefreshAfterInstall
        ? ['npm', 'ci', '--ignore-scripts']
        : ['npm', 'ci'];
    }
    return isPoint && useRefreshAfterInstall
      ? ['npm', 'install', '--ignore-scripts']
      : ['npm', 'install'];
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
      ...packs.map(n => n.name)
    ];
  },
  gitAdd: () => ['git', 'add']
};
