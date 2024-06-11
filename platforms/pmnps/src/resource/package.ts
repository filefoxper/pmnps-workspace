import { DEV_DEPS } from '@/constants';
import { omitBy } from '@/libs/polyfill';
import type { PackageJson, PackageType } from '@/types';

export const defaultPackageJson = function defaultPackageJson() {
  return {
    name: 'name',
    version: '0.0.0',
    description: 'unknown'
  };
};

export const packageJson = (
  name: string,
  type: PackageType,
  properties?: Record<string, any>
): PackageJson => {
  const { devDependencies, ...rest } = properties ?? {};
  if (type === 'workspace') {
    return omitBy(
      {
        version: '0.0.0',
        description: 'This is a project',
        devDependencies: { ...DEV_DEPS, ...devDependencies },
        ...rest,
        name
      },
      v => v == null
    ) as PackageJson;
  }
  return omitBy(
    {
      version: '0.0.0',
      description:
        type === 'package' ? 'This is a package' : 'This is a platform',
      ...properties,
      name
    },
    v => v == null
  ) as PackageJson;
};
