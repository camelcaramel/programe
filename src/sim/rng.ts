// 시드 기반 난수 (mulberry32). 같은 시드는 언제나 같은 수열을 낸다.

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [0, n) 정수 */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick: 빈 목록');
      return items[Math.floor(next() * items.length)];
    },
  };
}
