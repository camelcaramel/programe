// 실제 Pyodide(Node) 로 학생 파이썬 코드 → 시뮬레이터 연결을 확인한다.
import { loadPyodide } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildLevel, type StageDef } from '../sim';
import PRELUDE from './prelude.py?raw';
import { runStageWith, type PyRunStage, type StageLimits } from './stageBridge';

let pyRunStage: PyRunStage;

beforeAll(async () => {
  const py = await loadPyodide();
  py.runPython(PRELUDE);
  pyRunStage = py.globals.get('_run_stage') as PyRunStage;
}, 60_000);

const stage = (map: string[], extra: Partial<StageDef> = {}): StageDef => ({
  id: 'test',
  title: 'test',
  map,
  seeds: [1, 2, 3],
  ...extra,
});
const levelsOf = (def: StageDef) => def.seeds.map((s) => buildLevel(def, s));
const run = (code: string, def: StageDef, limits: StageLimits = { time_limit: 0.3 }) =>
  runStageWith(pyRunStage, code, levelsOf(def), limits);

const strip = (s: string) => s.replace(/^\n/, '');

describe('기본 실행', () => {
  it('순차 코드로 클리어, trace 에 줄 번호', () => {
    const r = run(
      strip(`
move_right()
move_right()
move_down()
`),
      stage(['S..', '##E']),
    );
    expect(r.ok).toBe(true);
    expect(r.runs).toHaveLength(3);
    expect(r.runs[0].summary.trace.map((t) => [t.event, t.line])).toEqual([
      ['move', 1],
      ['move', 2],
      ['exit', 3],
    ]);
    expect(r.runs[0].error).toBeNull();
  });

  it('for 반복문과 학생이 만든 함수 안의 줄 번호', () => {
    const r = run(
      strip(`
def go(n):
    for i in range(n):
        move_right()

go(4)
`),
      stage(['S...E']),
    );
    expect(r.ok).toBe(true);
    expect(r.runs[0].summary.trace.map((t) => t.line)).toEqual([3, 3, 3, 3]);
  });

  it('print 출력과 get_pos·get_coins·get_hp', () => {
    const r = run(
      strip(`
move_right()
print(get_pos(), get_coins(), get_hp())
move_right()
`),
      stage(['ScE']),
    );
    expect(r.runs[0].out).toEqual(['(1, 0) 1 3']);
    expect(r.runs[0].summary.cleared).toBe(true);
  });
});

describe('? 칸과 하드코딩 방지', () => {
  const def = stage(['S.?.E'], { random: { '?': ['.', 's', 'g'] }, seeds: [1, 2, 3, 4, 5, 6] });

  it('look 과 if 로 쓰면 모든 시드 통과', () => {
    const code = strip(`
for i in range(4):
    ahead = look("right")
    if ahead == "slime":
        cast("fireball", "right")
    elif ahead == "giant":
        cast("icebolt", "right")
        cast("icebolt", "right")
    move_right()
`);
    const r = run(code, def);
    const kinds = new Set(levelsOf(def).map((l) => l.monsters[0]?.kind ?? 'none'));
    expect(kinds.size).toBeGreaterThan(1); // 시드마다 실제로 다른 맵인지
    expect(r.ok).toBe(true);
  });

  it('한 가지 맵만 보고 짠 코드는 다른 시드에서 실패', () => {
    // ? 가 빈칸인 시드와 몬스터인 시드를 하나씩 찾는다
    const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
    const empty = seeds.find((s) => buildLevel(def, s).monsters.length === 0)!;
    const monster = seeds.find((s) => buildLevel(def, s).monsters.length === 1)!;
    const r = run('for i in range(4):\n    move_right()\n', { ...def, seeds: [empty, monster] });
    expect(r.ok).toBe(false);
    expect(r.runs.map((x) => x.summary.cleared)).toEqual([true, false]);
  });
});

describe('게임 끝 처리', () => {
  it('출구 도착 뒤 코드는 실행되지 않고, except Exception 으로 막을 수 없다', () => {
    const r = run(
      strip(`
try:
    move_right()
    move_right()
except Exception:
    print("잡힘")
print("여기는 실행되면 안 됨")
`),
      stage(['SE.']),
    );
    expect(r.runs[0].summary.cleared).toBe(true);
    expect(r.runs[0].out).toEqual([]);
    expect(r.runs[0].summary.turns).toBe(1);
  });

  it('맨 except: 로도 게임 종료를 삼킬 수 없다', () => {
    const r = run('while True:\n    try:\n        move_right()\n    except:\n        pass\n', stage(['SE'], { seeds: [1] }), {
      time_limit: 0.2,
    });
    expect(r.runs[0].summary.reason).toBe('exit');
    expect(r.runs[0].error).toBeNull();
  });

  it('맨 except: 로 무한 루프 시간 초과도 삼킬 수 없다', () => {
    const r = run('while True:\n    try:\n        pass\n    except:\n        pass\n', stage(['S.E'], { seeds: [1] }), {
      time_limit: 0.2,
    });
    expect(r.runs[0].kind).toBe('timeout');
  });

  it('except: 안의 일반 오류 처리는 그대로 동작', () => {
    const r = run('try:\n    look("front")\nexcept:\n    print("잡았다")\nmove_right()\nmove_right()\n', stage(['S.E'], { seeds: [1] }));
    expect(r.runs[0].out).toEqual(['잡았다']);
    expect(r.runs[0].summary.cleared).toBe(true);
  });

  it('턴 제한', () => {
    const r = run('while True:\n    move_left()\n', stage(['S.E'], { seeds: [1], maxTurns: 10 }));
    expect(r.runs[0].summary.reason).toBe('turn_limit');
    expect(r.runs[0].summary.turns).toBe(10);
    expect(r.runs[0].error).toBeNull();
  });

  it('코드가 끝났는데 출구에 못 가면 not_reached', () => {
    const r = run('move_right()\n', stage(['S..E'], { seeds: [1] }));
    expect(r.runs[0].summary.reason).toBe('not_reached');
  });
});

describe('오류', () => {
  it('문법 오류는 줄 번호와 함께 모든 시드에', () => {
    const r = run('move_right()\nif True\n    move_right()\n', stage(['S.E']));
    expect(r.ok).toBe(false);
    for (const x of r.runs) {
      expect(x.kind).toBe('syntax');
      expect(x.line).toBe(2);
      expect(x.summary.reason).toBe('error');
      expect(x.summary.trace).toEqual([]);
    }
  });

  it('자주 나는 문법 오류는 한국어로 설명', () => {
    const msg = (code: string) => run(code, stage(['S.E'], { seeds: [1] })).runs[0].error ?? '';
    expect(msg('if True:\nmove_right()\n')).toMatch(/if 문 다음 줄은 안쪽으로 들여 써야/);
    expect(msg('move_right()\n    move_right()\n')).toMatch(/들여 쓸 필요가 없어요/);
    expect(msg('for i in range(3)\n    move_right()\n')).toMatch(/콜론/);
    expect(msg('move_right(\n')).toMatch(/괄호/);
    expect(msg('look("right)\n')).toMatch(/따옴표/);
    expect(msg('if look("right") = "wall":\n    move_down()\n')).toMatch(/==/);
  });

  it('잘못된 방향은 한국어 오류 + 줄 번호, 그 전까지의 trace 는 남는다', () => {
    const r = run('move_right()\nlook("front")\n', stage(['S..E'], { seeds: [1] }));
    const x = r.runs[0];
    expect(x.kind).toBe('runtime');
    expect(x.line).toBe(2);
    expect(x.error).toMatch(/방향은/);
    expect(x.summary.reason).toBe('error');
    expect(x.summary.trace).toHaveLength(1);
  });

  it('인자 개수 실수', () => {
    const r = run('move_right(3)\n', stage(['S..E'], { seeds: [1] }));
    expect(r.runs[0].error).toMatch(/개수/);
  });

  it('import 는 막힌다', () => {
    const r = run('import os\n', stage(['S.E'], { seeds: [1] }));
    expect(r.runs[0].error).toMatch(/import/);
  });

  it('무한 루프는 시간 초과', () => {
    const r = run('while True:\n    pass\n', stage(['S.E'], { seeds: [1] }), { time_limit: 0.2 });
    expect(r.runs[0].kind).toBe('timeout');
    expect(r.runs[0].summary.reason).toBe('timeout');
  });

  it('스테이지에서 아직 안 연 명령은 쓸 수 없다', () => {
    const r = run('look("right")\n', stage(['S.E'], { seeds: [1] }), { api: ['move_right', 'print'] });
    expect(r.runs[0].error).toMatch(/아직 배우지 않은 명령/);
  });
});
