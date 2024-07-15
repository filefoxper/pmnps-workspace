import type { Package } from '@pmnps/tools';

export type PackageItem = {
  name: string;
  checked?: boolean;
  dependencies: Record<string, any>;
  dependencyItems: PackageItem[];
  dependentItems: PackageItem[];
};

export interface PackageWithDynamicState extends Package {
  hasPackageLockJsonFile: boolean;
  hasNodeModules: boolean;
}
