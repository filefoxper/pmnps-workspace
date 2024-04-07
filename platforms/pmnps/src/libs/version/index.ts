function versionStringToNums(version: string) {
  return version.split('.').slice(0, 3).map(Number);
}

function compare(v1: string, v2: string) {
  const limitVersions = versionStringToNums(v2);
  const currentVersions = versionStringToNums(v1);
  const result = limitVersions.reduce((r: number, v: number, i: number) => {
    const c = currentVersions[i];
    if (r !== 0) {
      return r;
    }
    if (c > v) {
      return 1;
    }
    if (c < v) {
      return -1;
    }
    return 0;
  }, 0);
  return {
    gt() {
      return result > 0;
    },
    gte() {
      return result >= 0;
    },
    eq() {
      return result === 0;
    },
    lt() {
      return result < 0;
    },
    lte() {
      return result <= 0;
    }
  };
}

export const version = {
  compare
};
