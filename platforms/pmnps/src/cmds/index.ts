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
  }) => {
    const { useNpmCi, core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn') {
      return ['yarn', 'install', '--check-files'];
    }
    const { hasPackageLockJsonFile, hasNodeModules } = opt ?? {};
    if (useNpmCi && !hasNodeModules && hasPackageLockJsonFile) {
      return ['npm', 'ci'];
    }
    return ['npm', 'install'];
  },
  addInstall: (packs: Package[]) => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn') {
      return ['yarn', 'add','-W', ...packs.map(n => `link:/${n.path}`)];
    }
    return ['npm', 'install', '--no-save', ...packs.map(n => n.name)];
  },
  gitAdd: () => ['git', 'add']
};
