import { hold } from '@/state';

export const SystemCommands = {
  start: () => {
    return ['npm', 'start'];
  },
  run: () => {
    return ['npm', 'run'];
  },
  install: (opt?: {
    hasPackageLockJsonFile?: boolean;
    hasNodeModules?: boolean;
  }) => {
    const { useNpmCi } = hold.instance().getState().config ?? {};
    const { hasPackageLockJsonFile, hasNodeModules } = opt ?? {};
    if (useNpmCi && !hasNodeModules && hasPackageLockJsonFile) {
      return ['npm', 'ci'];
    }
    return ['npm', 'install'];
  },
  addInstall: () => {
    return ['npm', 'install'];
  },
  gitAdd: () => ['git', 'add']
};
