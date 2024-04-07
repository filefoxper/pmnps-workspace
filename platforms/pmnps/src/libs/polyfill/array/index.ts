import type {
  ComparableSerial,
  Comparator,
  CompareKeyLike,
  CompareOrder,
  CompareValueGenerator,
  Falsy,
  KeyGenerator,
  OrderCode,
  TreeNode
} from './type';

function partition<T>(
  array: T[],
  callback: (e: T, i: number) => boolean
): [T[], T[]] {
  const [matches, rest] = [[], []] as [T[], T[]];
  array.forEach((e: T, i: number) => {
    if (callback(e, i)) {
      matches.push(e);
    } else {
      rest.push(e);
    }
  });
  return [matches, rest];
}

function groupBy<T, K>(
  array: T[],
  callback: KeyGenerator<T, K> | keyof T
): Map<K, T[]> {
  const newMap = new Map<K, T[]>();
  array.forEach((e: T, i: number) => {
    const keyData =
      typeof callback === 'function' ? callback(e, i) : e[callback];
    const key = keyData as K;
    const value = newMap.get(key);
    if (value === undefined) {
      newMap.set(key, [e]);
    } else {
      value.push(e);
    }
  });
  return newMap;
}

function serialGroupBy<T, K>(
  array: T[],
  callback: KeyGenerator<T, K> | keyof T
): Array<[K, T[]]> {
  const result: Array<[K, T[]]> = [];
  let start = false;
  let key: unknown;
  array.forEach((data, index) => {
    const keyValue =
      typeof callback === 'function' ? callback(data, index) : data[callback];
    if (!start || keyValue !== key) {
      result.push([keyValue as K, [data]]);
    } else {
      const [, value] =
        result.length > 0 ? result[result.length - 1] : [undefined, [] as T[]];
      value.push(data);
    }
    start = true;
    key = keyValue;
  });
  return result;
}

function chunk<T>(array: T[], size: number): T[][] {
  const totalPages = Math.ceil(array.length / size);
  const struct: undefined[] = Array.from({ length: totalPages });
  return array.reduce(
    (result: Array<T[] | undefined>, current: T, index: number) => {
      const resultIndex = Math.floor(index / size);
      return result.map((u, i) => {
        if (i !== resultIndex) {
          return u;
        }
        return u != null ? [...u, current] : [current];
      });
    },
    struct
  ) as T[][];
}

function reject<T>(array: T[], callback: (d: T) => boolean) {
  return array.filter(d => !callback(d));
}

function defaultOrderCode(
  value: string | number,
  other: string | number,
  orderCode: -1 | 1
): -1 | 1 {
  return orderCode;
}

function compare(value: any, other: any, compareOrder: CompareOrder): number {
  const order =
    typeof compareOrder === 'string' ? compareOrder : compareOrder.order;
  const orderCode =
    typeof compareOrder === 'string' || !compareOrder.code
      ? defaultOrderCode
      : compareOrder.code;
  const valIsUndefined = value === undefined;
  const valIsNull = value === null;
  const valIsNaN = Number.isNaN(value);

  const othIsUndefined = other === undefined;
  const othIsNull = other === null;
  const othIsNaN = Number.isNaN(other);

  const offset = order === 'desc' ? -1 : 1;

  if (valIsUndefined || valIsNaN || valIsNull) {
    return orderCode(value, other, (-1 * offset) as -1 | 1);
  }
  if (othIsUndefined || othIsNaN || othIsNull) {
    return orderCode(value, other, (1 * offset) as -1 | 1);
  }
  if (value > other) {
    return orderCode(value, other, (1 * offset) as -1 | 1);
  }
  return orderCode(value, other, (-1 * offset) as -1 | 1);
}

function sort(obj: ComparableSerial, other: ComparableSerial): number {
  const index = obj.comparators.findIndex(
    ({ value }, i) => value !== other.comparators[i].value
  );
  if (index < 0) {
    return obj.index - other.index;
  }
  const compareOrder = obj.comparators[index];
  return compare(
    obj.comparators[index].value,
    other.comparators[index].value,
    compareOrder
  );
}

function sortIndex<T>(
  array: T[],
  comparators: Array<Comparator<T>>
): ComparableSerial[] {
  const is = array.map((d, i) => {
    const comparatorArray = comparators.map(({ order, keyLike, code }) => ({
      value: keyLike(d, i),
      order,
      code
    }));
    return { comparators: comparatorArray, index: i };
  }) as ComparableSerial[];
  is.sort((a, b) => sort(a, b));
  return is;
}

function orderBy<T>(
  array: T[],
  by: Array<CompareKeyLike<T>>,
  orders: Array<CompareOrder> = []
): T[] {
  function generateComparator(
    c: keyof T | CompareValueGenerator<T>,
    order: CompareOrder
  ): Comparator<T> {
    const orderValue = typeof order === 'string' ? order : order.order;
    const code = typeof order === 'string' ? undefined : order.code;
    const placement = typeof order === 'string' ? undefined : order.placement;
    const orderCode = (function computeOrderCode(): OrderCode | undefined {
      if (code) {
        return code;
      }
      if (!placement) {
        return undefined;
      }
      return (value, other, oc) => {
        const rightPlacement = placement(value, oc);
        const leftPlacement = placement(other, oc);
        if (rightPlacement === 'bottom') {
          return 1;
        }
        if (rightPlacement === 'top') {
          return -1;
        }
        if (leftPlacement === 'bottom') {
          return -1;
        }
        if (leftPlacement === 'top') {
          return 1;
        }
        return oc;
      };
    })();
    if (typeof c !== 'function') {
      return {
        order: orderValue,
        code: orderCode,
        keyLike(e: T, ind: number) {
          return e[c] as unknown as string | number;
        }
      };
    }
    return { keyLike: c, code: orderCode, order: orderValue };
  }

  if (by.length === 0) {
    return array;
  }
  const comparators = by.map((c, i) => {
    const order = orders[i] ?? 'asc';
    return generateComparator(c, order);
  }) as Array<Comparator<T>>;
  const indexes = sortIndex(array, comparators);
  return indexes.map(({ index }) => array[index]);
}

/**
 * @deprecated
 * @param array
 * @param callback
 */
function map<T, K>(
  array: T[] | undefined | null,
  callback: KeyGenerator<T, K> | keyof T
): K[] {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.map((e: T, i: number) =>
    typeof callback === 'function' ? callback(e, i) : e[callback]
  ) as K[];
}

function keyBy<T, K extends keyof T>(array: T[], generator: K): Map<T[K], T>;
function keyBy<T, K extends (e: T, i: number) => any>(
  array: T[],
  generator: K
): Map<K extends (e: T, i: number) => infer U ? U : any, T>;
function keyBy<T, K extends keyof T | ((e: T, i: number) => any)>(
  array: T[],
  generator: K
): Map<unknown, T> {
  if (typeof generator === 'function') {
    const entries = array.map(
      (value, index) => [generator(value, index), value] as [unknown, T]
    );
    return new Map<unknown, T>(entries);
  }
  const e = array.map(
    value => [value[generator as keyof T], value] as [unknown, T]
  );
  return new Map<unknown, T>(e);
}

/**
 * @deprecated
 * @param array
 */
function compact<T>(array: T[]): Array<T extends Falsy ? never : T> {
  return array.filter((d): d is Exclude<T, Falsy> => !!d);
}

function first<T>(array: T[]): T | undefined {
  return array[0];
}

function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

function range(size: number): number[] {
  return Array.from({ length: size }).map((d, i) => i);
}

export function mapTree<T, K extends keyof T, P extends keyof T>(
  array: T[],
  keys: [K, P]
): TreeNode<T>[];
export function mapTree<
  T,
  K extends keyof ReturnType<R>,
  P extends keyof ReturnType<R>,
  R extends (e: T) => any
>(array: T[], keys: [K, P], callback: R): TreeNode<ReturnType<R>>[];
export function mapTree<
  T,
  K extends keyof T,
  P extends keyof T,
  R extends (e: T) => any
>(
  array: T[],
  keys: [K, P],
  callback?: R
): typeof callback extends undefined
  ? TreeNode<T>[]
  : TreeNode<ReturnType<R>>[] {
  const [key, parentKey] = keys;
  const shallowClone: TreeNode<T>[] = array.map(d =>
    typeof callback === 'function'
      ? callback({ ...d, children: undefined })
      : { ...d, children: undefined }
  );
  const treeMap = groupBy(shallowClone, parentKey);
  shallowClone.forEach(e => {
    Object.assign(e, { children: treeMap.get(e[key]) });
  });
  return shallowClone.filter(
    e => e[parentKey] == null
  ) as typeof callback extends undefined
    ? TreeNode<T>[]
    : TreeNode<ReturnType<R>>[];
}

function moveElement<T>(array: T[], oldIndex: number, newIndex: number): T[] {
  const movingElement = array[oldIndex];
  const nextIndex = (function adaptNewIndex() {
    if (newIndex < 0) {
      return 0;
    }
    if (newIndex >= array.length) {
      return array.length - 1;
    }
    return newIndex;
  })();
  if (movingElement == null || oldIndex === nextIndex) {
    return array;
  }
  // 老的位置如果大于新位置，直接在新位置元素前面插入，
  // 反之，新位置应前面去掉老位置（相当于-1），那移动项应该排在新位置之后
  const isBefore = oldIndex > nextIndex;

  return array.flatMap((element, index) => {
    if (index === oldIndex) {
      return [];
    }
    if (index === nextIndex) {
      return isBefore ? [movingElement, element] : [element, movingElement];
    }
    return element;
  });
}

export {
  partition,
  groupBy,
  serialGroupBy,
  chunk,
  keyBy,
  orderBy,
  /**
   * @deprecated
   * */
  map,
  compact,
  first,
  last,
  range,
  reject,
  moveElement
};
