import { LockBak, Package } from '@pmnps/tools';

export type PackageItem = {
  name: string;
  checked?: boolean;
  dependencies: Record<string, any>;
  dependencyItems: PackageItem[];
  dependentItems: PackageItem[];
};

export interface PackageWithDynamicState extends Package {
  hasLockFile: boolean;
  hasNodeModules: boolean;
  lockContent?: string | null;
  lockFileName: string;
  npmrc?: string | null;
  payload?: {
    pnpmWorkspace?: { packages: string[] };
    lockBak?: LockBak | null;
  };
}
