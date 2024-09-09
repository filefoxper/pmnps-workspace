import { format as formatPackageJson } from 'prettier-package-json';

export const CONF_NAME = '.pmnpsrc.json';

export const DEV_DEPS = {
  pmnps: 'latest'
};

function format(objString: string) {
  const obj = JSON.parse(objString);
  return JSON.stringify(obj, null, 2);
}

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

export const INVALID_REGISTRY = 'https://invalid.npm.com';

export const SystemFormatter = {
  json: (c: string | null) => Promise.resolve(format(c ?? '{}')),
  packageJson: (c: string | null) =>
    Promise.resolve(formatPackageJson(JSON.parse(c ?? '{}'))),
  packageLockJson: (c: string | null) =>
    Promise.resolve(
      formatPackageJson(JSON.parse(c ?? '{}'), { keyOrder: () => 0 })
    )
};
