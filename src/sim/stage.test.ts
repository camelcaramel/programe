import { describe, expect, it } from 'vitest';
import { StageError, buildLevel, createRng, type StageDef } from './index';

const def = (map: StageDef['map'], extra: Partial<StageDef> = {}): StageDef => ({
  id: 'test',
  title: 'test',
  map,
  seeds: [1],
  ...extra,
});

describe('createRng', () => {
  it('같은 시드는 같은 수열', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('다른 시드는 다른 수열', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int(n) 은 0 이상 n 미만', () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.int(3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });
});

describe('buildLevel', () => {
  it('지형·시작·몬스터·상자·열쇠를 읽는다', () => {
    const lv = buildLevel(
      def([
        '#######',
        '#S.csE#',
        '#kbgD.#',
        '#######',
      ]),
      1,
    );
    expect(lv.width).toBe(7);
    expect(lv.height).toBe(4);
    expect(lv.start).toEqual({ x: 1, y: 1 });
    expect(lv.maxTurns).toBe(200);
    expect(lv.playerHp).toBe(3);
    expect(lv.terrain[1][5]).toBe('exit');
    expect(lv.terrain[2][4]).toBe('door');
    expect(lv.terrain[0][0]).toBe('wall');
    expect(lv.terrain[1][3]).toBe('floor'); // 상자 아래는 바닥
    expect(lv.chests).toEqual([{ x: 3, y: 1 }]);
    expect(lv.keys).toEqual([{ x: 1, y: 2 }]);
    expect(lv.monsters).toEqual([
      { x: 4, y: 1, kind: 'slime' },
      { x: 2, y: 2, kind: 'bat' },
      { x: 3, y: 2, kind: 'giant' },
    ]);
  });

  it('? 칸은 시드로 결정되고, 같은 시드는 같은 결과', () => {
    const d = def(['S??????E'], { random: { '?': ['.', 's', 'c'] } });
    const a = buildLevel(d, 5);
    const b = buildLevel(d, 5);
    expect(a).toEqual(b);
    expect(a.randomCells).toHaveLength(6);
  });

  it('여러 시드를 돌리면 후보가 모두 나온다', () => {
    const d = def(['S?E'], { random: { '?': ['.', 's'] } });
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const lv = buildLevel(d, seed);
      seen.add(lv.monsters.length ? 's' : '.');
    }
    expect(seen).toEqual(new Set(['.', 's']));
  });

  it('map 이 함수면 시드마다 다른 맵을 만들 수 있다', () => {
    const d = def((rng) => ['S' + '.'.repeat(2 + rng.int(5)) + 'E']);
    const widths = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) widths.add(buildLevel(d, seed).width);
    expect(widths.size).toBeGreaterThan(1);
  });

  it('잘못된 맵은 StageError', () => {
    expect(() => buildLevel(def(['..E']), 1)).toThrow(StageError); // S 없음
    expect(() => buildLevel(def(['SSE']), 1)).toThrow(/정확히 1개/);
    expect(() => buildLevel(def(['S..']), 1)).toThrow(/출구/);
    expect(() => buildLevel(def(['S.E', '..']), 1)).toThrow(/길이/);
    expect(() => buildLevel(def(['S.xE']), 1)).toThrow(/알 수 없는 문자/);
    expect(() => buildLevel(def(['S?E'], { random: { '?': [] } }), 1)).toThrow(/후보가 없어요/);
    expect(() => buildLevel(def(['S?E'], { random: { '?': ['S'] } }), 1)).toThrow(/시작 위치/);
  });
});
