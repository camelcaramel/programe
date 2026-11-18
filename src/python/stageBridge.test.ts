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

describe('2부 명령: read · open_gate · move', () => {
  const part2 = (map: string[], content: StageDef['content']) => stage(map, { content });
  const signs = part2(['#TM##', '#S.GE', '#####'], () => ({ signs: ['12'], tablets: [['right', 7]], gates: [12] }));

  it('read 는 표지판을 str, 석판을 list 로 돌려준다', () => {
    const r = run(
      strip(`
s = read("up")
move_right()
t = read("up")
print(type(s) == str, s, type(t) == list, t, len(t))
`),
      signs,
    );
    expect(r.runs[0].error).toBeNull();
    expect(r.runs[0].out).toEqual(["True 12 True ['right', 7] 2"]);
    expect(r.runs[0].summary.trace.map((t) => [t.event, t.line])).toEqual([
      ['read', 1],
      ['move', 2],
      ['read', 3],
    ]);
  });

  it('int() 로 바꾼 값은 맞고, 문자열 그대로는 자료형이 달라 경보', () => {
    const ok = run('n = int(read("up"))\nmove_right()\nopen_gate("right", n)\nmove_right()\nmove_right()\n', signs);
    expect(ok.ok).toBe(true);
    const bad = run('n = read("up")\nmove_right()\nopen_gate("right", n)\nmove_right()\nmove_right()\n', signs);
    expect(bad.ok).toBe(false);
    const step = bad.runs[0].summary.trace[2];
    expect(step).toMatchObject({ event: 'gate_wrong', shown: "'12'", typeMismatch: true, hp: 2 });
  });

  it('float·bool 은 같은 수여도 맞지 않는다', () => {
    const g = part2(['S.G.E'], () => ({ gates: [1] }));
    const r = run('move_right()\nopen_gate("right", 1.0)\nopen_gate("right", True)\nopen_gate("right", 1)\n', g);
    expect(r.runs[0].summary.trace.map((t) => t.event)).toEqual(['move', 'gate_wrong', 'gate_wrong', 'gate_open']);
    expect(r.runs[0].summary.hp).toBe(1);
  });

  it('move(방향) 으로 리스트를 따라간다', () => {
    const r = run('for d in ["right", "down", "right"]:\n    move(d)\n', stage(['S.#', '#.E']));
    expect(r.ok).toBe(true);
  });

  it('read 를 표지판이 아닌 곳에 쓰면 친절한 오류', () => {
    const r = run('read("right")\n', signs);
    expect(r.runs[0].error).toMatch(/표지판이나 석판만/);
    expect(r.runs[0].line).toBe(1);
  });

  it('문자열 + 숫자, 리스트 번호 넘침, int("abc") 오류를 한국어로', () => {
    expect(run('x = "12" + 3\n', signs).runs[0].error).toMatch(/int\(\) 로 바꿔/);
    expect(run('x = 3 + "12"\n', signs).runs[0].error).toMatch(/int\(\) 로 바꿔/);
    expect(run('x = [1, 2][2]\n', signs).runs[0].error).toMatch(/0부터/);
    expect(run('x = int("abc")\n', signs).runs[0].error).toMatch(/숫자로 된 글자만/);
  });

  it('배우지 않은 2부 명령은 이름을 알려 준다', () => {
    const r = run('move("right")\n', signs, { time_limit: 0.3, api: ['move_right', 'read', 'open_gate'] });
    expect(r.runs[0].error).toMatch(/move 은\(는\) 아직 배우지 않은 명령/);
  });
});

describe('3부: 객체 · 클래스 · 지도', () => {
  const mut = (hp: number, weak: 'fireball' | 'icebolt' | 'lightning') => ({ hp, weak });
  const p3 = (map: string[], muts: { hp: number; weak: 'fireball' | 'icebolt' | 'lightning' }[] = [], extra: Partial<StageDef> = {}) =>
    stage(map, { seeds: [1], content: () => ({ monsters: muts }), ...extra });

  it('scan 은 Monster 객체(속성 kind·hp·max_hp·weak) 또는 None, hp 는 지금 값', () => {
    const r = run(
      strip(`
m = scan("right")
print(m.kind, m.hp, m.max_hp, m.weak)
print(scan("left") is None)
cast(m.weak, "right")
print(m.hp, m)
cast(m.weak, "right")
print(m.hp, scan("right"))
move_right()
move_right()
move_right()
`),
      p3(['So.E'], [mut(4, 'lightning')]),
    );
    expect(r.runs[0].error).toBeNull();
    expect(r.runs[0].out).toEqual([
      'ghost 4 4 lightning',
      'True',
      "2 Monster(kind='ghost', hp=2, max_hp=4, weak='lightning')",
      '0 None',
    ]);
    expect(r.ok).toBe(true);
  });

  it('None 의 속성을 읽으면 친절한 오류', () => {
    const r = run('print(scan("right").weak)\n', p3(['S.E']));
    expect(r.runs[0].error).toMatch(/is None/);
  });

  const BOT_MAP = ['#####', '#RP.#', '#####', 'S==.E'];
  const HELPER = strip(`
class Helper:
    def __init__(self, bot):
        self.bot = bot
        self.left = 1

    def act(self):
        if self.left > 0:
            self.bot.move("right")
            self.left = self.left - 1

hire(Helper(get_bots()[0]))
while look("right") != "exit":
    if look("right") == "bars":
        wait()
    else:
        move_right()
move_right()
`);

  it('클래스로 만든 조수를 hire 하면 마법사가 턴을 쓸 때마다 act() 가 불린다', () => {
    const r = run(HELPER, p3(BOT_MAP));
    expect(r.runs[0].error).toBeNull();
    expect(r.ok).toBe(true);
    const t = r.runs[0].summary.trace;
    expect(t[0]).toMatchObject({ event: 'wait', bots: [{ id: 0, event: 'move' }], barsOpen: ['1,3', '2,3'] });
    expect(t[1].bots).toBeUndefined(); // 다 세었으니 가만히
  });

  it('로봇을 act() 밖에서 움직이거나, hire 에 클래스·함수를 넣으면 오류', () => {
    expect(run('get_bots()[0].move("right")\n', p3(BOT_MAP)).runs[0].error).toMatch(/act\(\) 안에서만/);
    expect(run('class H:\n    def act(self):\n        pass\nhire(H)\n', p3(BOT_MAP)).runs[0].error).toMatch(/클래스가 아니라 객체/);
    expect(run('def act():\n    pass\nhire(act)\n', p3(BOT_MAP)).runs[0].error).toMatch(/act\(\) 메서드/);
  });

  it('self 를 빠뜨리거나 __init__ 에서 안 만든 속성을 쓰면 친절한 오류', () => {
    const noSelf = 'class H:\n    def act():\n        pass\nhire(H())\nwait()\n';
    expect(run(noSelf, p3(BOT_MAP)).runs[0].error).toMatch(/self 를 꼭/);
    const noAttr = 'class H:\n    def act(self):\n        self.n = self.n + 1\nhire(H())\nwait()\n';
    const r = run(noAttr, p3(BOT_MAP));
    expect(r.runs[0].error).toMatch(/self\.n = /);
    expect(r.runs[0].line).toBe(3);
  });

  it('get_map 은 2차원 리스트, 딕셔너리 KeyError 는 친절한 오류', () => {
    const r = run('g = get_map()\nprint(len(g), len(g[0]), g[0][2])\nd = {}\nprint(d["ghost"])\n', p3(['S.kE']));
    expect(r.runs[0].out).toEqual(['1 4 key']);
    expect(r.runs[0].error).toMatch(/키/);
  });
});
