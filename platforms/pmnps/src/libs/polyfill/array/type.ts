export type KeyGenerator<T, K> = (e: T, i: number) => K;

export type CompareValueGenerator<T> = (e: T, i: number) => string | number;

export type CompareKeyLike<T> = keyof T | CompareValueGenerator<T>;

export type OrderCode = (
  value: string | number | null | undefined,
  other: string | number | null | undefined,
  orderCode: -1 | 1,
) => number;

export type PlacementOrderCode = (
  value: string | number | null | undefined,
  orderCode: -1 | 1,
) => 'top' | 'bottom' | 'auto';

export type CompareOrder = 'asc' | 'desc' | { order: 'asc' | 'desc'; code?: OrderCode; placement?: PlacementOrderCode };

export interface Comparator<T> {
  keyLike: CompareValueGenerator<T>;
  order: 'asc' | 'desc';
  code?: OrderCode;
}

export interface ComparableSerial {
  comparators: Array<{ value: string | number; order: 'asc' | 'desc'; code?: OrderCode }>;
  index: number;
}

export type Falsy = undefined | null | 0 | false | '';

export type TreeNode<T> = T & { children?: T[] };
