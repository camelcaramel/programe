// 시드 기반 난수 (mulberry32). 같은 시드는 언제나 같은 수열을 낸다.

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [0, n) 정수 */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  // 작은 시드(1, 2, 3 …)끼리 첫 값이 비슷하게 나오지 않도록 시드를 먼저 섞는다 (murmur3 fmix)
  let a = seed >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0;
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
