const pick = <T, K extends keyof T>(object: T, ...keys: K[]): Pick<T, K> =>
  keys.reduce<Partial<T>>(
    (r: Partial<T>, key: K) => ({ ...r, [key]: object[key] }),
    {}
  ) as Pick<T, K>;

const omit = <T extends object, K extends keyof T>(
  object: T,
  ...keys: K[]
): Omit<T, K> => {
  const keySet = new Set<K>(keys);
  const entries = Object.entries(object).filter(([k]) => !keySet.has(k as K));
  return Object.fromEntries(entries) as Omit<T, K>;
};

const omitBy = <T extends object>(
  object: T,
  callback: (value: T[keyof T], key: keyof T) => boolean
): Partial<T> => {
  const entries = Object.entries(object).filter(
    ([k, v]) => !callback(v, k as keyof T)
  );
  return Object.fromEntries(entries) as Partial<T>;
};

const simpleEqual = (source: unknown, target: unknown): boolean =>
  // +0 === -0
  // NaN match
  typeof source === typeof target &&
  (source === target || Object.is(source, target));

const isRecord = (source: unknown): source is Record<string, unknown> => {
  return typeof source === 'object' && source != null;
};

const equality = (source: unknown, target: unknown, dep = 0): boolean => {
  if (simpleEqual(source, target)) {
    return true;
  }
  if (!isRecord(source) || !isRecord(target)) {
    return false;
  }
  const sourceKeys = Object.keys(source);
  const targetKeys = Object.keys(target);
  if (sourceKeys.length !== targetKeys.length) {
    return false;
  }
  const targetKeySet = new Set<string>(targetKeys);
  const hasDifferentKey = sourceKeys.some(k => !targetKeySet.has(k));
  if (hasDifferentKey) {
    return false;
  }
  if (dep > 50) {
    return false;
  }
  return sourceKeys.reduce((r: boolean, k: string) => {
    if (!r) {
      return r;
    }
    return equality(source[k], target[k], dep + 1);
  }, true);
};

const equal = <T>(source: T, target: T): boolean => equality(source, target);

function mapValues<
  T extends object,
  C extends <K extends keyof T>(v: T[K], k: K) => unknown
>(obj: T, callback: C): { [k in keyof T]: ReturnType<C> } {
  const array = Object.entries(obj).map(
    ([k, v]) => [k, callback(v, k as keyof T)] as const
  );
  return Object.fromEntries(array) as { [k in keyof T]: ReturnType<C> };
}

export { pick, omit, omitBy, equal, mapValues };
