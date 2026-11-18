// 3부 요소: 변이 몬스터·미믹·scan·반격, 조수 로봇 라운드·발판·창살, get_map
import { describe, expect, it } from 'vitest';
import { SimInputError, SimStop, World, boardAt, buildLevel, simulate, type MonsterMutation, type StageDef } from './index';

const def = (map: string[], muts: (MonsterMutation | null)[] = [], extra: Partial<StageDef> = {}): StageDef => ({
  id: 'test',
  title: 'test',
  map,
  seeds: [1],
  content: () => ({ monsters: muts }),
  ...extra,
});
const lv = (map: string[], muts: (MonsterMutation | null)[] = [], extra: Partial<StageDef> = {}) => buildLevel(def(map, muts, extra), 1);

/** 조수 라운드를 직접 돌린다 (파이썬의 _after_turn 과 같은 순서) */
function turn(w: World, action: () => void, bots: (() => void)[] = []) {
  action();
  w.roundBegin();
  for (const b of bots) b();
  w.roundEnd();
}

describe('변이 몬스터', () => {
  it('content 의 monsters 로 HP·약점이 정해지고, 없으면 오류', () => {
    const l = lv(['So.E'], [{ hp: 4, weak: 'lightning' }]);
    expect(l.monsters).toEqual([{ x: 1, y: 0, kind: 'ghost', hp: 4, weak: 'lightning' }]);
    expect(() => buildLevel({ id: 't', title: 't', map: ['So.E'], seeds: [1] }, 1)).toThrow(/변이 몬스터/);
    expect(() => lv(['So.E'], [{ hp: 4, weak: 'water' as never }])).toThrow(/약점/);
  });

  it('scan 은 몬스터 정보를, 없으면 null 을 돌려준다 (0턴, 기록 남김)', () => {
    const w = new World(lv(['So.E', '#..#'], [{ hp: 4, weak: 'icebolt' }]));
    expect(w.scan('right')).toEqual({ id: '1,0', kind: 'ghost', hp: 4, max_hp: 4, weak: 'icebolt' });
    expect(w.scan('down')).toBeNull();
    expect(w.turn).toBe(0);
    expect(w.trace.map((t) => t.event)).toEqual(['scan']);
  });

  it('약점 마법은 2 피해, 아닌 마법은 0 피해 + 반격(HP −1)', () => {
    const w = new World(lv(['Sx.E'], [{ hp: 4, weak: 'lightning' }]));
    w.cast('lightning', 'right');
    expect(w.monsterHp('1,0')).toBe(2);
    w.cast('fireball', 'right');
    expect(w.hp).toBe(2);
    expect(w.trace[1]).toMatchObject({ event: 'damage', amount: 0, counter: 1, hp: 2 });
    w.cast('lightning', 'right');
    expect(w.monsterHp('1,0')).toBe(0);
    expect(w.look('right')).toBe('empty');
  });

  it('반격으로 HP 가 0 이 되면 쓰러진다', () => {
    const r = simulate(lv(['Sq.E'], [{ hp: 4, weak: 'icebolt' }]), (w) => {
      for (let i = 0; i < 5; i++) w.cast('fireball', 'right');
    });
    expect(r.reason).toBe('dead');
    expect(r.turns).toBe(3);
  });

  it('1·2부 몬스터는 번개에 효과 없음(반격 없음), scan 의 약점은 기본 규칙', () => {
    const w = new World(lv(['Ss.E']));
    expect(w.scan('right')?.weak).toBe('fireball');
    w.cast('lightning', 'right');
    expect(w.hp).toBe(3);
    expect(w.trace[1].counter).toBeUndefined();
  });

  it('미믹은 look·get_map 에 상자로 보이고, 부딪히면 HP −3', () => {
    const l = lv(['Sm.E'], [{ hp: 2, weak: 'fireball' }]);
    const w = new World(l);
    expect(w.look('right')).toBe('chest');
    expect(w.getMap()[0]).toEqual(['empty', 'chest', 'empty', 'exit']);
    expect(w.scan('right')?.kind).toBe('mimic');
    const r = simulate(l, (w) => w.move('right'));
    expect(r.reason).toBe('dead');
    // 재생: 처음엔 정체를 모르고, 부딪히면 드러난다
    expect(boardAt(l, r.trace, 0).monsters[0].revealed).toBe(false);
    expect(boardAt(l, r.trace, 1).monsters[0].revealed).toBe(true);
  });

  it('scanLimit 을 넘으면 오류', () => {
    const w = new World(lv(['So.E'], [{ hp: 2, weak: 'fireball' }], { scanLimit: 2 }));
    w.scan('right');
    w.scan('left');
    expect(() => w.scan('right')).toThrow(SimInputError);
  });
});

describe('조수 로봇 · 발판 · 창살', () => {
  const MAP = ['#####', '#RP.#', '#####', 'S==.E'];

  it('발판이 눌려 있는 동안만 창살이 열리고, 서 있는 칸은 닫히지 않는다', () => {
    const l = lv(MAP);
    expect(l.bots).toEqual([{ x: 1, y: 1 }]);
    const w = new World(l);
    expect(w.needsRound).toBe(true);
    expect(w.look('right')).toBe('bars');
    turn(w, () => w.wait(), [() => w.botMove(0, 'right')]); // 발판 위
    expect(w.trace[0].barsOpen).toEqual(['1,3', '2,3']);
    expect(w.look('right')).toBe('empty');
    turn(w, () => w.move('right'), [() => w.botMove(0, 'right')]); // 마법사는 창살 칸, 로봇은 발판에서 내려옴
    expect(w.trace[1].barsOpen).toEqual(['1,3']); // 마법사가 선 칸만 열려 있다
    turn(w, () => w.move('right'));
    expect(w.trace[2].event).toBe('bump');
    // 재생도 같은 상태
    const b = boardAt(l, w.trace, 2);
    expect(b.bars).toEqual([
      { x: 1, y: 3, open: true },
      { x: 2, y: 3, open: false },
    ]);
    expect(b.bots[0]).toMatchObject({ x: 3, y: 1 });
    expect(b.plates).toEqual([{ x: 2, y: 1, pressed: false }]);
    expect(boardAt(l, w.trace, 1).plates[0].pressed).toBe(true);
  });

  it('로봇은 라운드 밖에서 움직일 수 없고, 한 턴에 한 번만', () => {
    const w = new World(lv(MAP));
    expect(() => w.botMove(0, 'right')).toThrow(/act\(\) 안에서만/);
    w.wait();
    w.roundBegin();
    w.botMove(0, 'right');
    expect(() => w.botMove(0, 'right')).toThrow(/한 번만/);
    expect(w.botLook(0, 'up')).toBe('wall');
    expect(w.botLook(0, 'left')).toBe('empty');
  });

  it('로봇은 벽·다른 로봇·마법사에 부딪히고, 발판은 look 에 빈칸', () => {
    const w = new World(lv(['#####', '#RR.#', '#S..#', '###E#']));
    w.wait();
    w.roundBegin();
    w.botMove(0, 'right');
    w.botMove(1, 'left');
    w.roundEnd();
    expect(w.trace[0].bots?.map((b) => b.event)).toEqual(['bump', 'bump']);
    expect(w.look('up')).toBe('bot');
    expect(w.botLook(0, 'down')).toBe('wizard');
  });

  it('로봇이 약점이 아닌 마법을 쓰면 고장 나서 멈춘다. 몬스터가 모두 사라지면 창살이 열린다', () => {
    const l = lv(['#####', '#Ro.#', '#####', 'S=..E'], [{ hp: 2, weak: 'icebolt' }]);
    const w = new World(l);
    turn(w, () => w.wait(), [() => w.botCast(0, 'icebolt', 'right')]);
    expect(w.look('right')).toBe('empty');
    expect(w.botScan(0, 'right')).toBeNull();

    const w2 = new World(l);
    turn(w2, () => w2.wait(), [() => w2.botCast(0, 'fireball', 'right')]);
    expect(w2.trace[0].bots?.[0]).toMatchObject({ event: 'damage', amount: 0, broken: true });
    turn(w2, () => w2.wait(), [() => w2.botMove(0, 'down')]);
    expect(w2.trace[1].bots).toBeUndefined(); // 고장 난 로봇은 아무것도 안 함
    expect(boardAt(l, w2.trace, 1).bots[0].broken).toBe(true);
  });

  it('게임이 끝나면 라운드도 멈춘다', () => {
    const w = new World(lv(MAP), { maxTurns: 1 });
    w.wait();
    expect(() => w.wait()).toThrow(SimStop);
    expect(() => w.roundBegin()).toThrow(SimStop);
  });
});

describe('get_map', () => {
  it('look 과 같은 낱말의 2차원 리스트, 내 칸은 empty', () => {
    const w = new World(lv(['#####', '#S.k#', '#.D.E', '#####']));
    const g = w.getMap();
    expect(g).toHaveLength(4);
    expect(g[1]).toEqual(['wall', 'empty', 'empty', 'key', 'wall']);
    expect(g[2][2]).toBe('door');
    expect(g[2][4]).toBe('exit');
  });
});
