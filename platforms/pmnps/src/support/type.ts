export type PackageItem = {
  name: string;
  checked?: boolean;
  dependencies: Record<string, any>;
  dependencyItems: PackageItem[];
  dependentItems: PackageItem[];
};
