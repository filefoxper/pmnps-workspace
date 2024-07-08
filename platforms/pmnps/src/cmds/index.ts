import { hold } from '@/state';

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
      return ['yarn', 'install'];
    }
    const { hasPackageLockJsonFile, hasNodeModules } = opt ?? {};
    if (useNpmCi && !hasNodeModules && hasPackageLockJsonFile) {
      return ['npm', 'ci'];
    }
    return ['npm', 'install'];
  },
  addInstall: () => {
    const { core = 'npm' } = hold.instance().getState().config ?? {};
    if (core === 'yarn') {
      return ['yarn', 'add'];
    }
    return ['npm', 'install'];
  },
  gitAdd: () => ['git', 'add']
};
