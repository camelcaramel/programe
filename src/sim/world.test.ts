import { describe, expect, it } from 'vitest';
import { SimInputError, SimStop, World, buildLevel, simulate, type StageDef } from './index';

const level = (map: string[], extra: Partial<StageDef> = {}, seed = 1) =>
  buildLevel({ id: 'test', title: 'test', map, seeds: [seed], ...extra }, seed);

describe('이동', () => {
  it('복도를 따라가면 클리어', () => {
    const r = simulate(level(['S..E']), (w) => {
      w.move('right');
      w.move('right');
      w.move('right');
    });
    expect(r.cleared).toBe(true);
    expect(r.reason).toBe('exit');
    expect(r.turns).toBe(3);
    expect(r.trace.map((t) => t.event)).toEqual(['move', 'move', 'exit']);
    expect(r.trace[2].pos).toEqual({ x: 3, y: 0 });
  });

  it('출구에 닿으면 학생 코드를 멈춘다 (이후 명령은 실행 안 됨)', () => {
    let after = false;
    const r = simulate(level(['SE.']), (w) => {
      w.move('right');
      after = true;
    });
    expect(r.cleared).toBe(true);
    expect(after).toBe(false);
  });

  it('벽에 부딪히면 턴만 쓰고 제자리', () => {
    const r = simulate(level(['#S.E']), (w) => {
      w.move('left');
      w.move('up'); // 맵 밖도 벽
    });
    expect(r.turns).toBe(2);
    expect(r.trace.map((t) => [t.event, t.ok])).toEqual([
      ['bump', false],
      ['bump', false],
    ]);
    expect(r.trace[1].pos).toEqual({ x: 1, y: 0 });
    expect(r.trace[0].target).toEqual({ x: 0, y: 0 });
  });

  it('코드가 끝났는데 출구에 못 가면 not_reached', () => {
    const r = simulate(level(['S..E']), (w) => w.move('right'));
    expect(r.cleared).toBe(false);
    expect(r.reason).toBe('not_reached');
  });
});

describe('보물상자·열쇠·문', () => {
  it('상자 칸에 들어가면 열리고 동전 +1, 다시 지나가도 그대로', () => {
    const r = simulate(level(['Sc.E']), (w) => {
      w.move('right');
      w.move('left');
      w.move('right');
      w.move('right');
      w.move('right');
    });
    expect(r.coins).toBe(1);
    expect(r.chestsTotal).toBe(1);
    expect(r.trace.map((t) => t.event)).toEqual(['chest', 'move', 'move', 'move', 'exit']);
  });

  it('열쇠가 있으면 문이 열리고, 열쇠는 1개 줄어든다', () => {
    const r = simulate(level(['SkDE']), (w) => {
      w.move('right');
      w.move('right');
      w.move('right');
    });
    expect(r.trace.map((t) => [t.event, t.keys])).toEqual([
      ['key', 1],
      ['door', 0],
      ['exit', 0],
    ]);
    expect(r.cleared).toBe(true);
  });

  it('열쇠가 없으면 문은 벽처럼 막힌다', () => {
    const w = new World(level(['SDE']));
    w.move('right');
    expect(w.trace[0].event).toBe('bump');
    expect(w.getPos()).toEqual({ x: 0, y: 0 });
  });
});

describe('몬스터와 마법', () => {
  it('몬스터 칸으로 가면 피해를 받고 제자리', () => {
    const w = new World(level(['SsE']));
    w.move('right');
    expect(w.trace[0]).toMatchObject({ event: 'hit', ok: false, amount: 1, hp: 2, pos: { x: 0, y: 0 } });
  });

  it('HP 가 0 이 되면 dead 로 끝난다', () => {
    const r = simulate(level(['SgE']), (w) => {
      w.move('right'); // 거인: 2 피해
      w.move('right');
      w.move('right');
    });
    expect(r.reason).toBe('dead');
    expect(r.hp).toBe(0);
    expect(r.turns).toBe(2);
  });

  it('약점 마법이면 슬라임·박쥐를 한 번에 처치', () => {
    const r = simulate(level(['bSsE']), (w) => {
      w.cast('fireball', 'right');
      w.cast('icebolt', 'left');
    });
    expect(r.trace.map((t) => [t.event, t.amount])).toEqual([
      ['kill', 2],
      ['kill', 2],
    ]);
  });

  it('반대 속성은 효과 없음', () => {
    const w = new World(level(['SsE']));
    w.cast('icebolt', 'right');
    expect(w.trace[0]).toMatchObject({ event: 'damage', amount: 0, ok: false });
    expect(w.look('right')).toBe('slime');
  });

  it('외눈 거인은 얼음 마법 2번', () => {
    const r = simulate(level(['SgE']), (w) => {
      w.cast('icebolt', 'right');
      w.cast('icebolt', 'right');
      w.move('right');
      w.move('right');
    });
    expect(r.trace.map((t) => t.event)).toEqual(['damage', 'kill', 'move', 'exit']);
    expect(r.cleared).toBe(true);
  });

  it('빈 방향에 마법을 쓰면 miss (턴은 씀)', () => {
    const w = new World(level(['S.E']));
    w.cast('fireball', 'right');
    expect(w.trace[0]).toMatchObject({ event: 'miss', skill: 'fireball', ok: false });
    expect(w.turn).toBe(1);
  });
});

describe('look', () => {
  it('옆 칸을 알려주고 턴을 쓰지 않는다', () => {
    const w = new World(level(['#c#', 'gSE', '#k#', '#D#']));
    expect(w.look('up')).toBe('chest');
    expect(w.look('left')).toBe('giant');
    expect(w.look('right')).toBe('exit');
    expect(w.look('down')).toBe('key');
    expect(w.turn).toBe(0);
    w.move('down');
    expect(w.look('down')).toBe('door');
  });

  it('맵 밖은 wall, 처치한 몬스터 자리는 empty', () => {
    const w = new World(level(['SbE']));
    expect(w.look('up')).toBe('wall');
    w.cast('icebolt', 'right');
    expect(w.look('right')).toBe('empty');
  });
});

describe('제한과 입력 검사', () => {
  it('턴 제한을 넘으면 turn_limit', () => {
    const r = simulate(level(['S.E'], { maxTurns: 5 }), (w) => {
      for (;;) w.move('left');
    });
    expect(r.reason).toBe('turn_limit');
    expect(r.turns).toBe(5);
    expect(r.trace).toHaveLength(5);
  });

  it('게임이 끝난 뒤 API 를 부르면 SimStop', () => {
    const w = new World(level(['SE']));
    expect(() => w.move('right')).toThrow(SimStop);
    expect(() => w.move('right')).toThrow(SimStop);
    expect(() => w.look('left')).toThrow(SimStop);
  });

  it('잘못된 방향·마법 이름은 SimInputError (턴은 쓰지 않음)', () => {
    const w = new World(level(['S.E']));
    expect(() => w.move('rihgt')).toThrow(SimInputError);
    expect(() => w.move(3)).toThrow(/방향은/);
    expect(() => w.cast('heal', 'right')).toThrow(/알 수 없는 마법/);
    expect(() => w.look('front')).toThrow(SimInputError);
    expect(w.turn).toBe(0);
  });

  it('trace 에 학생 코드 줄 번호를 남긴다', () => {
    let line = 0;
    const r = simulate(
      level(['S..E']),
      (w) => {
        line = 3;
        w.move('right');
        line = 7;
        w.move('right');
      },
      { getLine: () => line },
    );
    expect(r.trace.map((t) => t.line)).toEqual([3, 7]);
  });

  it('파이썬 오류로 끝나면 finish("error"), 이미 끝난 게임은 바꾸지 않음', () => {
    const w = new World(level(['S.E']));
    w.move('right');
    expect(w.finish('error').reason).toBe('error');

    const w2 = new World(level(['SE']));
    expect(() => w2.move('right')).toThrow(SimStop);
    expect(w2.finish('error').reason).toBe('exit');
  });
});

describe('결정성', () => {
  it('같은 스테이지·시드·코드는 항상 같은 결과', () => {
    const def: Partial<StageDef> = { random: { '?': ['.', 's', 'b', 'c'] } };
    const script = (w: World) => {
      for (let i = 0; i < 6; i++) {
        const ahead = w.look('right');
        if (ahead === 'slime') w.cast('fireball', 'right');
        else if (ahead === 'bat') w.cast('icebolt', 'right');
        w.move('right');
      }
    };
    for (const seed of [1, 2, 3]) {
      const a = simulate(level(['S????E'], def, seed), script);
      const b = simulate(level(['S????E'], def, seed), script);
      expect(a).toEqual(b);
      expect(a.cleared).toBe(true);
    }
  });
});
