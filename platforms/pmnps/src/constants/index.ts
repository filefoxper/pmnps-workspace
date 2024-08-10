import { format } from 'prettier';
import { format as formatPackageJson } from 'prettier-package-json';

export const CONF_NAME = '.pmnpsrc.json';

export const DEV_DEPS = {
  prettier: '3.0.3',
  pmnps: 'latest'
};

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

export const INVALID_REGISTRY = 'https://invalid.npm.com';

export const SystemFormatter = {
  json: (c: string | null) =>
    Promise.resolve(format(c ?? '{}', { parser: 'json' })),
  packageJson: (c: string | null) =>
    Promise.resolve(formatPackageJson(JSON.parse(c ?? '{}'))),
  packageLockJson: (c: string | null) =>
    Promise.resolve(
      formatPackageJson(JSON.parse(c ?? '{}'), { keyOrder: () => 0 })
    )
};
