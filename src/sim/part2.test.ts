// 2부 요소: 표지판(T)·석판(M)·비밀 문(G), read / open_gate
import { describe, expect, it } from 'vitest';
import { SimInputError, World, boardAt, buildLevel, simulate, type StageDef } from './index';

const def = (map: string[], extra: Partial<StageDef> = {}): StageDef => ({
  id: 'test',
  title: 'test',
  map,
  seeds: [1, 2, 3],
  content: () => ({ signs: ['42'], tablets: [['right', 'down', 3]], gates: [42] }),
  ...extra,
});

describe('맵 만들기', () => {
  it('T·M·G 의 위치와 내용이 Level 에 들어간다', () => {
    const l = buildLevel(def(['#T##', 'MS.G', '###E']), 1);
    expect(l.terrain[0][1]).toBe('sign');
    expect(l.terrain[1][0]).toBe('tablet');
    expect(l.terrain[1][3]).toBe('gate');
    expect(l.signs).toEqual([
      { x: 1, y: 0, kind: 'sign', value: '42' },
      { x: 0, y: 1, kind: 'tablet', value: ['right', 'down', 3] },
    ]);
    expect(l.gates).toEqual([{ x: 3, y: 1, code: 42 }]);
  });

  it('content 가 없거나 개수가 안 맞으면 오류', () => {
    expect(() => buildLevel(def(['TS.E'], { content: undefined }), 1)).toThrow(/content/);
    expect(() => buildLevel(def(['TTS.E'], { content: () => ({ signs: ['a'] }) }), 1)).toThrow(/표지판 2개/);
  });

  it('content 는 시드 rng 로 만들어 시드마다 다르고, 같은 시드는 같다', () => {
    const d = def(['TS.GE'], { content: (rng) => ({ signs: [String(rng.int(1000))], gates: [rng.int(1000)] }) });
    const values = [1, 2, 3, 4].map((s) => buildLevel(d, s).signs[0].value);
    expect(new Set(values).size).toBeGreaterThan(1);
    expect(buildLevel(d, 7)).toEqual(buildLevel(d, 7));
  });
});

describe('read', () => {
  it('표지판은 문자열, 석판은 리스트를 돌려주고 턴을 쓰지 않는다', () => {
    const w = new World(buildLevel(def(['#T##', 'MS.G', '###E']), 1));
    expect(w.read('up')).toBe('42');
    expect(w.read('left')).toEqual(['right', 'down', 3]);
    expect(w.turn).toBe(0);
    expect(w.trace.map((t) => [t.event, t.value])).toEqual([
      ['read', '42'],
      ['read', ['right', 'down', 3]],
    ]);
  });

  it('돌려받은 리스트를 바꿔도 석판 내용은 그대로', () => {
    const w = new World(buildLevel(def(['#T##', 'MS.G', '###E']), 1));
    (w.read('left') as unknown[]).push('x');
    expect(w.read('left')).toEqual(['right', 'down', 3]);
  });

  it('표지판·석판이 아니면 친절한 오류', () => {
    const w = new World(buildLevel(def(['#T##', 'MS.G', '###E']), 1));
    expect(() => w.read('right')).toThrow(SimInputError);
    expect(() => w.read('right')).toThrow(/빈칸/);
    expect(() => w.read('down')).toThrow(/벽/);
  });

  it('look 은 sign·tablet·gate 를 알려 주고, 셋 다 지나갈 수 없다', () => {
    const r = simulate(buildLevel(def(['#T##', 'MS.G', '###E']), 1), (w) => {
      expect([w.look('up'), w.look('left')]).toEqual(['sign', 'tablet']);
      w.move('up');
      w.move('left');
      w.move('right');
      expect(w.look('right')).toBe('gate');
      w.move('right');
    });
    expect(r.trace.map((t) => t.event)).toEqual(['bump', 'bump', 'move', 'bump']);
  });
});

describe('open_gate', () => {
  const lvl = () => buildLevel(def(['S.G.E'], { content: () => ({ gates: [42] }) }), 1);

  it('맞는 암호면 문이 열리고 지나갈 수 있다 (1턴)', () => {
    const r = simulate(lvl(), (w) => {
      w.move('right');
      w.openGate('right', 42);
      expect(w.look('right')).toBe('empty');
      w.move('right');
      w.move('right');
      w.move('right');
    });
    expect(r.cleared).toBe(true);
    expect(r.turns).toBe(5);
    expect(r.trace[1]).toMatchObject({ action: 'gate', event: 'gate_open', ok: true, shown: '42', hp: 3 });
  });

  it('틀리면 경보: HP −1, 문은 닫힌 채', () => {
    const w = new World(lvl());
    w.move('right');
    w.openGate('right', 41);
    expect(w.hp).toBe(2);
    expect(w.look('right')).toBe('gate');
    expect(w.trace[1]).toMatchObject({ event: 'gate_wrong', ok: false, amount: 1 });
  });

  it('자료형까지 같아야 맞다: "42" 는 42 가 아니다', () => {
    const w = new World(lvl());
    w.move('right');
    w.openGate('right', '42');
    expect(w.hp).toBe(2);
    expect(w.trace[1]).toMatchObject({ event: 'gate_wrong', shown: '"42"', typeMismatch: true });
    w.openGate('right', 1230);
    expect(w.trace[2].typeMismatch).toBeUndefined();
  });

  it('세 번 틀리면 쓰러진다 (하나씩 넣어 보기 금지)', () => {
    const r = simulate(lvl(), (w) => {
      w.move('right');
      for (let c = 0; c < 100; c++) w.openGate('right', c);
    });
    expect(r.reason).toBe('dead');
    expect(r.trace.filter((t) => t.event === 'gate_wrong')).toHaveLength(3);
  });

  it('옆에 닫힌 비밀 문이 없으면 오류 (턴도 안 씀)', () => {
    const w = new World(lvl());
    expect(() => w.openGate('right', 42)).toThrow(/비밀 문에만/);
    expect(w.turn).toBe(0);
    w.move('right');
    w.openGate('right', 42);
    expect(() => w.openGate('right', 42)).toThrow(/빈칸/);
  });
});

describe('되감기', () => {
  it('boardAt 은 열린 비밀 문과 읽은 표지판을 반영한다', () => {
    const level = buildLevel(def(['#T##', 'MS.G', '###E']), 1);
    const r = simulate(level, (w) => {
      w.read('up');
      w.move('right');
      w.openGate('right', 7);
      w.openGate('right', 42);
    });
    expect(boardAt(level, r.trace, 0).gates).toEqual([{ x: 3, y: 1, open: false }]);
    expect(boardAt(level, r.trace, 1).read).toEqual(['1,0']);
    const b3 = boardAt(level, r.trace, 3);
    expect([b3.hp, b3.gates[0].open]).toEqual([2, false]);
    const b4 = boardAt(level, r.trace, 4);
    expect([b4.hp, b4.gates[0].open, b4.turn]).toEqual([2, true, 3]);
  });
});
