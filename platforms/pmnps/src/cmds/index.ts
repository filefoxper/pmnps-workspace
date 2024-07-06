import { hold } from '@/state';

export const SystemCommands = {
  install: (opt?: { isEmpty?: boolean; hasPackageLockJsonFile?: boolean }) => {
    const { useNpmCi } = hold.instance().getState().config ?? {};
    const { isEmpty, hasPackageLockJsonFile } = opt ?? {};
    if (useNpmCi && isEmpty && hasPackageLockJsonFile) {
      return ['npm', 'ci'];
    }
    return ['npm', 'install'];
  },
  addInstall: () => {
    return ['npm', 'install'];
  },
  gitAdd: () => ['git', 'add']
};
