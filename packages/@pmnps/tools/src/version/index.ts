import semver from 'semver';

export const versions = {
  satisfies(version: string, range: string) {
    return semver.satisfies(version, range);
  }
};
