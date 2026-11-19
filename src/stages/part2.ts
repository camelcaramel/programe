// 2부: stage-11 ~ stage-18 + 비계 14a·16a·17a (화면 번호 14~24). 변수 · 자료형 · 리스트 · 반환값 있는 함수 (PART2.md)
// 표지판(T)·석판(M)의 내용과 비밀 문(G)의 암호는 content() 가 시드로 만들고, 계획 화면에서는 가려진다.
// solution / hardcoded / bypasses 는 학생에게 보이지 않고, 테스트(stages.test.ts)가 확인한다.
import type { Level, Rng } from '../sim';
import { cellsOf, mazeRows, movesCode, OPPOSITE, pathOf } from './maze';
import { GATE_API, PART2_API, type StageInfo } from './types';

const WORDS = ['moon', 'star', 'fire', 'frog', 'mint', 'rain', 'wolf', 'leaf', 'gold', 'snow', 'cake', 'ruby'];
/** 글자 암호. 예: "wolf37" */
const wordCode = (rng: Rng) => rng.pick(WORDS) + String(10 + rng.int(90));

/** 서로 다른 정수 n 개를 [lo, hi] 에서 */
function distinctInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = lo + rng.int(hi - lo + 1);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const firstGate = (levels: Level[]) => levels[0].gates[0].code;

/** 길 안내를 "같은 방향 몇 칸" 묶음으로. ["right","right","down"] → [["right",2],["down",1]] */
function runsOf(path: string[]): [string, number][] {
  const out: [string, number][] = [];
  for (const d of path) {
    const last = out[out.length - 1];
    if (last && last[0] === d) last[1]++;
    else out.push([d, 1]);
  }
  return out;
}
/** 복도 위쪽 곳곳(3~5곳)에 표지판. 문 바로 앞 칸 위에는 두지 않는다 */
function scatteredSigns(rng: Rng): string[] {
  const L = 8 + rng.int(4); // 걷는 칸 (입구 포함)
  const k = 3 + rng.int(3);
  const spots = distinctInts(rng, k, 1, L - 1);
  let top = '';
  for (let x = 0; x < L + 4; x++) top += spots.includes(x) ? 'T' : '#';
  return [top, '#S' + '.'.repeat(L - 1) + 'GE#', '#'.repeat(L + 4)];
}

/** 두 장의 지도(방향·걸음 수 석판)를 한 칸씩 길 안내로 펼친다 */
function expand(level: Level): string[] {
  const [dirs, steps] = level.signs.map((s) => s.value as (string | number)[]);
  return dirs.flatMap((d, i) => Array(steps[i] as number).fill(d as string));
}
/** 파이썬 코드 속 값으로 (문자열은 따옴표) */
const py = (v: unknown) => JSON.stringify(v);

/** 미로: 왼쪽 위 (1,1) 이 입구, 오른쪽 아래가 출구, 입구 바로 위 벽에 석판 */
function mazeMap(rng: Rng, cw: number, ch: number): string[] {
  const g = mazeRows(rng, cw, ch);
  g[1][1] = 'S';
  g[ch * 2 - 1][cw * 2 - 1] = 'E';
  g[0][1] = 'M';
  return g.map((r) => r.join(''));
}

/** 오른쪽 손을 벽에 대고 더듬어 가기 (look 만으로 길 찾기) — 턴이 모자라야 한다 */
const WALL_FOLLOWER = `dirs = ["up", "right", "down", "left"]
h = 1
while True:
    r = (h + 1) % 4
    if look(dirs[r]) in ["empty", "exit"]:
        h = r
    elif look(dirs[h]) not in ["empty", "exit"]:
        h = (h + 3) % 4
        continue
    move(dirs[h])
`;

export const PART2: StageInfo[] = [
  // ───────────────────────────── 11
  {
    id: 'stage-11',
    part: 2,
    title: '기억의 표지판',
    concept: '변수에 저장',
    goal: '입구 위 표지판의 암호로 복도 끝 비밀 문을 열고 출구로!',
    hint: 'read("up") 으로 읽은 글자를 code = read("up") 처럼 변수에 담아 두고, 문 앞에서 open_gate("right", code) 로 넣어요.',
    note: '표지판의 암호는 실행할 때마다 바뀌어요. 계획 화면에서는 보이지 않아요. 틀린 암호를 넣으면 경보가 울려 HP 가 1 줄어요.',
    api: GATE_API,
    seeds: [1, 2, 3],
    stars: { lines: 6 },
    map: ['#T############', '#S.........GE#', '##############'],
    content: (rng) => {
      const code = wordCode(rng);
      return { signs: [code], gates: [code] };
    },
    concepts: [
      {
        name: '변수에 저장해 두기',
        text: [
          '변수(variable)는 값을 담아 두는 이름 붙은 상자예요.',
          '이름 = 값 으로 담고, 나중에 이름만 쓰면 담아 둔 값을 다시 꺼내 써요.',
          '지금 한 번만 볼 수 있는 정보는 변수에 담아 두어야 나중에 쓸 수 있어요.',
        ],
        example: 'word = "hello"\nprint(word)   # hello',
        inGame: '표지판은 입구에서만 읽을 수 있어요. code = read("up") 으로 담아 두었다가 문 앞에서 open_gate("right", code)!',
      },
    ],
    starter: `# 표지판에 적힌 글자가 비밀 문의 암호예요.
# read("up") 은 위쪽 표지판의 글자를 읽어 줘요. (턴을 쓰지 않아요)
# 표지판은 입구에만 있으니, 읽은 값을 변수에 담아 두세요!

code = read("up")
print("암호:", code)
for i in range(9):
    move_right()
`,
    solution: `code = read("up")
for i in range(9):
    move_right()
open_gate("right", code)
move_right()
move_right()
`,
    bypasses: [
      {
        name: '맵 1 의 암호를 코드에 직접 쓰기',
        code: (levels) => `for i in range(9):\n    move_right()\nopen_gate("right", ${py(firstGate(levels))})\nmove_right()\nmove_right()\n`,
      },
      {
        name: '문 앞에서 표지판 다시 읽기',
        code: `for i in range(9):\n    move_right()\nopen_gate("right", read("up"))\nmove_right()\nmove_right()\n`,
      },
      {
        name: '암호를 하나씩 넣어 보기',
        code: `for i in range(9):\n    move_right()\nfor c in range(100):\n    open_gate("right", str(c))\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 12
  {
    id: 'stage-12',
    part: 2,
    title: '두 개의 숫자',
    concept: '자료형 · 형변환',
    goal: '비밀 문의 암호는 두 표지판 숫자의 합(정수)이에요.',
    hint: 'read() 는 글자(문자열)를 줘요. "12" + "30" 은 "1230" 이에요! int(read("up")) 처럼 정수로 바꾼 뒤 더해요.',
    note: '복도 길이와 표지판의 숫자가 실행할 때마다 바뀌어요. 암호는 정수예요. "42" 와 42 는 다른 값이에요!',
    api: GATE_API,
    seeds: [1, 2, 3],
    stars: { lines: 9 },
    map: (rng) => {
      const n = 4 + rng.int(5);
      return ['#T#T' + '#'.repeat(n + 1), '#S' + '.'.repeat(n) + 'GE#', '#'.repeat(n + 5)];
    },
    content: (rng) => {
      const [a, b] = distinctInts(rng, 2, 10, 49);
      return { signs: [String(a), String(b)], gates: [a + b] };
    },
    concepts: [
      {
        name: '자료형과 형변환',
        text: [
          '값에는 종류가 있어요. 이것을 자료형(type)이라고 해요.',
          '"12" 처럼 따옴표 안의 값은 글자(문자열, str), 12 는 정수(int)예요.',
          '문자열끼리 더하면 이어 붙고("1"+"2" → "12"), 정수끼리 더하면 계산돼요(1+2 → 3).',
          'int("12") 는 글자를 정수로, str(12) 는 정수를 글자로 바꿔요(형변환).',
        ],
        example: 'print("12" + "30")            # 1230\nprint(int("12") + int("30"))  # 42',
        inGame: '표지판은 늘 문자열을 줘요. 숫자 계산이 필요하면 int() 로 바꾸세요. 비밀 문은 자료형까지 같아야 열려요!',
      },
    ],
    starter: `# 두 표지판에 숫자가 하나씩 적혀 있어요. 암호는 두 수의 합(정수)이에요.
# 주의: read() 가 돌려주는 값은 글자(문자열)예요.

a = read("up")
move_right()
move_right()
b = read("up")
print(a + b)
`,
    solution: `a = int(read("up"))
move_right()
move_right()
b = int(read("up"))
while look("right") != "gate":
    move_right()
open_gate("right", a + b)
move_right()
move_right()
`,
    bypasses: [
      {
        name: '문자열을 그대로 더하기',
        code: `a = read("up")\nmove_right()\nmove_right()\nb = read("up")\nwhile look("right") != "gate":\n    move_right()\nopen_gate("right", a + b)\nmove_right()\nmove_right()\n`,
      },
      {
        name: '합을 문자열로 넣기',
        code: `a = int(read("up"))\nmove_right()\nmove_right()\nb = int(read("up"))\nwhile look("right") != "gate":\n    move_right()\nopen_gate("right", str(a + b))\nmove_right()\nmove_right()\n`,
      },
      {
        name: '맵 1 의 암호를 코드에 직접 쓰기',
        code: (levels) => `while look("right") != "gate":\n    move_right()\nopen_gate("right", ${py(firstGate(levels))})\nmove_right()\nmove_right()\n`,
      },
      {
        name: '암호를 하나씩 넣어 보기',
        code: `while look("right") != "gate":\n    move_right()\nfor c in range(100):\n    open_gate("right", c)\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 13
  {
    id: 'stage-13',
    part: 2,
    title: '슬라임 사냥꾼',
    concept: '누적 · 카운터',
    goal: '슬라임을 처치하며 가세요. 비밀 문의 암호는 처치한 수(정수)예요.',
    hint: 'count = 0 으로 시작해서, 슬라임을 처치할 때마다 count = count + 1. 문 앞에서 open_gate("right", count)!',
    note: '? 칸은 실행할 때마다 빈칸이나 슬라임으로 바뀌어요. 처치한 수를 알려 주는 명령은 없어요.',
    api: GATE_API,
    seeds: [1, 2, 9],
    stars: { lines: 10 },
    random: { '?': ['.', 's'] },
    map: ['##################', '#S.s.?.s?.?s.?.GE#', '##################'],
    content: (_rng, { rows }) => ({ gates: [rows.join('').split('s').length - 1] }),
    concepts: [
      {
        name: '누적과 카운터',
        text: [
          '무언가를 셀 때는 0 을 담은 변수를 먼저 만들어요.',
          '셀 일이 생길 때마다 count = count + 1 로 1 씩 늘려요.',
          '= 오른쪽을 먼저 계산(지금 값 + 1)하고, 그 결과를 다시 count 에 담는 거예요.',
        ],
        example: 'count = 0\nfor i in range(3):\n    count = count + 1\nprint(count)   # 3',
        inGame: '슬라임을 처치할 때마다 count 를 1 늘리면, 문 앞에서 처치한 수를 알 수 있어요.',
      },
    ],
    starter: `# 비밀 문의 암호는 "처치한 슬라임 수"(정수)예요.
# 슬라임 수를 알려 주는 명령은 없어요. 직접 세어야 해요!

count = 0
while look("right") != "gate":
    if look("right") == "slime":
        cast("fireball", "right")
    move_right()
print("센 슬라임:", count)
`,
    solution: `count = 0
while look("right") != "gate":
    if look("right") == "slime":
        cast("fireball", "right")
        count = count + 1
    move_right()
open_gate("right", count)
move_right()
move_right()
`,
    bypasses: [
      {
        name: '맵 1 의 슬라임 수를 코드에 직접 쓰기',
        code: (levels) =>
          `while look("right") != "gate":\n    if look("right") == "slime":\n        cast("fireball", "right")\n    move_right()\nopen_gate("right", ${py(firstGate(levels))})\nmove_right()\nmove_right()\n`,
      },
      {
        name: '암호를 하나씩 넣어 보기',
        code: `while look("right") != "gate":\n    if look("right") == "slime":\n        cast("fireball", "right")\n    move_right()\nc = 0\nwhile look("right") == "gate":\n    open_gate("right", c)\n    c = c + 1\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 14
  {
    id: 'stage-14',
    part: 2,
    title: '보물 지도',
    concept: '리스트 + for',
    goal: '입구 위 석판의 길 안내(리스트)를 그대로 따라가세요.',
    hint: 'path = read("up") 은 ["right", "down", ...] 같은 리스트예요. for d in path: 아래에서 move(d) 로 한 칸씩!',
    note: '미로 모양은 실행할 때마다 바뀌어요. 턴 제한은 길 길이 + 2 뿐이라, 더듬어 찾아가면 시간이 모자라요.',
    api: PART2_API,
    seeds: [1, 2, 3],
    stars: { lines: 3 },
    map: (rng) => mazeMap(rng, 6, 4),
    maxTurns: (rows) => pathOf(rows).length + 2,
    content: (_rng, { rows }) => ({ tablets: [pathOf(rows)] }),
    concepts: [
      {
        name: '리스트와 for',
        text: [
          '리스트(list)는 값 여러 개를 순서대로 담은 것이에요. [ ] 안에 쉼표로 나눠 적어요.',
          'for 원소 in 리스트: 는 리스트의 값을 앞에서부터 하나씩 꺼내 원소에 담고 반복해요.',
          'range(3) 대신 리스트를 넣으면, 리스트 길이만큼 반복하면서 값도 함께 받아요.',
        ],
        example: 'fruits = ["apple", "pear", "kiwi"]\nfor f in fruits:\n    print(f)',
        inGame: '석판의 길 안내 리스트를 for d in path: 로 하나씩 꺼내 move(d) 로 움직여요.',
      },
    ],
    starter: `# 입구 위 석판에 길 안내가 리스트로 적혀 있어요. 예: ["right", "down", "down", ...]
# move(방향) 은 방향 글자를 받아 한 칸 이동해요. move("right") 는 move_right() 와 같아요.
# 미로 모양은 실행할 때마다 바뀌고, 턴은 길 길이 + 2 뿐이에요.

path = read("up")
print(path)
`,
    solution: `path = read("up")
for d in path:
    move(d)
`,
    bypasses: [
      { name: '맵 1 의 길을 move_* 로 나열', code: (levels) => movesCode(levels[0].signs[0].value as string[]) },
      { name: 'look() 으로 더듬으며 길 찾기', code: WALL_FOLLOWER },
    ],
  },

  // ───────────────────────────── 14a (비계: 인덱스로 두 리스트 짝짓기)
  {
    id: 'stage-14a',
    part: 2,
    title: '두 장의 지도',
    concept: '인덱스 · range(len())',
    goal: '위 석판은 방향, 왼쪽 석판은 걸음 수예요. 같은 번호끼리 짝지어 가세요.',
    hint: 'for i in range(len(dirs)): 로 번호 i 를 0, 1, 2 … 로 돌려요. 그 안에서 for k in range(steps[i]): 로 move(dirs[i]) 를 반복해요.',
    note: '미로 모양은 실행할 때마다 바뀌어요. 턴 제한은 길 길이 + 2 예요.',
    api: PART2_API,
    seeds: [1, 2, 3],
    stars: { lines: 5 },
    map: (rng) => {
      const g = mazeMap(rng, 6, 4).map((r) => [...r]);
      g[1][0] = 'M'; // 입구 왼쪽: 걸음 수 리스트
      return g.map((r) => r.join(''));
    },
    maxTurns: (rows) => pathOf(rows).length + 2,
    content: (_rng, { rows }) => {
      const runs = runsOf(pathOf(rows));
      return { tablets: [runs.map((r) => r[0]), runs.map((r) => r[1])] };
    },
    concepts: [
      {
        name: '인덱스와 len()',
        text: [
          '리스트의 값마다 자리 번호가 있어요. 이것을 인덱스(index)라고 해요. 번호는 0 부터 세요!',
          'dirs[0] 은 첫 번째 값, dirs[1] 은 두 번째 값이에요.',
          'len(dirs) 는 값의 개수예요. for i in range(len(dirs)): 로 번호 i 를 0 부터 끝까지 돌 수 있어요.',
          '번호가 있으면 같은 번호의 값을 여러 리스트에서 함께 꺼낼 수 있어요.',
        ],
        example: 'names = ["a", "b", "c"]\nages = [12, 15, 9]\nfor i in range(len(names)):\n    print(names[i], ages[i])',
        inGame: '방향 리스트와 걸음 수 리스트에서 같은 번호 i 의 값을 꺼내, dirs[i] 쪽으로 steps[i] 칸 걸어요.',
      },
    ],
    starter: `# 위 석판: 방향 리스트, 예: ["right", "down", "right"]
# 왼쪽 석판: 걸음 수 리스트, 예: [3, 2, 1]  →  오른쪽 3칸, 아래 2칸, 오른쪽 1칸
# 번호(인덱스)는 0 부터 세요. dirs[0] 과 steps[0] 이 한 짝이에요.

dirs = read("up")
steps = read("left")
print(dirs[0], steps[0])
print("짝의 수:", len(dirs))
`,
    solution: `dirs = read("up")
steps = read("left")
for i in range(len(dirs)):
    for k in range(steps[i]):
        move(dirs[i])
`,
    bypasses: [
      { name: '방향마다 한 칸씩만 걷기', code: `for d in read("up"):\n    move(d)\n` },
      { name: '맵 1 의 길을 move_* 로 나열', code: (levels) => movesCode(expand(levels[0])) },
      { name: 'look() 으로 더듬으며 길 찾기', code: WALL_FOLLOWER },
    ],
  },

  // ───────────────────────────── 15
  {
    id: 'stage-15',
    part: 2,
    title: '거꾸로 지도',
    concept: '거꾸로 인덱스',
    goal: '석판이 출구부터 거꾸로, 방향도 반대로 적혀 있어요. 뒤에서부터 반대로 가세요.',
    hint: 'path[len(path) - 1] 이 마지막 칸이에요. for i in range(len(path)): 안에서 path[len(path) - 1 - i] 를 꺼내고, "up" ↔ "down", "left" ↔ "right" 로 바꿔 움직여요.',
    note: '미로 모양은 실행할 때마다 바뀌어요. 턴 제한은 길 길이 + 2 예요.',
    api: PART2_API,
    seeds: [4, 5, 6],
    stars: { lines: 11 },
    map: (rng) => mazeMap(rng, 6, 4),
    maxTurns: (rows) => pathOf(rows).length + 2,
    content: (_rng, { rows }) => ({ tablets: [[...pathOf(rows)].reverse().map((d) => OPPOSITE[d])] }),
    concepts: [
      {
        name: '뒤에서부터 꺼내기',
        text: [
          '번호가 0 부터라서, 값이 len(path) 개면 마지막 값은 path[len(path) - 1] 이에요.',
          'i 가 0, 1, 2 … 로 커질 때 len(path) - 1 - i 는 끝 번호부터 거꾸로 작아져요.',
          '그래서 path[len(path) - 1 - i] 는 뒤에서 i 번째 값이에요.',
        ],
        example: 'path = ["a", "b", "c"]\nprint(len(path))             # 3\nprint(path[0], path[2])      # a c\nfor i in range(len(path)):\n    print(path[len(path) - 1 - i])   # c b a',
        inGame: '거꾸로 적힌 길 안내를 뒤에서부터 꺼내고, 방향을 반대로 바꿔 움직여요.',
      },
    ],
    starter: `# 이번 석판은 출구에서 입구 쪽으로 거꾸로 적혀 있어요. 방향도 반대예요!
# 예: 입구→출구 길이 ["right", "down"] 이면 석판에는 ["up", "left"]
# path[0] 은 첫 번째 값, path[len(path) - 1] 은 마지막 값이에요.

path = read("up")
print("길이:", len(path))
print("마지막 값:", path[len(path) - 1])
`,
    solution: `path = read("up")
for i in range(len(path)):
    d = path[len(path) - 1 - i]
    if d == "up":
        move("down")
    elif d == "down":
        move("up")
    elif d == "left":
        move("right")
    else:
        move("left")
`,
    bypasses: [
      { name: '석판 그대로 따라가기', code: `for d in read("up"):\n    move(d)\n` },
      { name: '뒤에서부터 꺼내지만 방향은 그대로', code: `path = read("up")\nfor i in range(len(path)):\n    move(path[len(path) - 1 - i])\n` },
      {
        name: '맵 1 의 길을 move_* 로 나열',
        code: (levels) => movesCode([...(levels[0].signs[0].value as string[])].reverse().map((d) => OPPOSITE[d as keyof typeof OPPOSITE])),
      },
      { name: 'look() 으로 더듬으며 길 찾기', code: WALL_FOLLOWER },
    ],
  },

  // ───────────────────────────── 16
  {
    id: 'stage-16',
    part: 2,
    title: '암호 책',
    concept: '인덱스로 꺼내기',
    goal: '위 석판은 숫자 리스트, 아래 표지판은 칸 번호예요. 그 칸의 값이 암호(정수)예요.',
    hint: 'book = read("up") 은 리스트, read("down") 은 "2" 같은 글자예요. 번호를 int() 로 바꿔 book[n] 으로 꺼내요. 번호는 0 부터!',
    note: '석판의 숫자와 표지판의 번호는 실행할 때마다 바뀌어요.',
    api: PART2_API,
    seeds: [1, 2, 3],
    stars: { lines: 7 },
    map: ['#M#########', '#S......GE#', '#T#########'],
    content: (rng) => {
      const book = distinctInts(rng, 4 + rng.int(3), 10, 99);
      const n = rng.int(book.length);
      return { tablets: [book], signs: [String(n)], gates: [book[n]] };
    },
    starter: `# 석판(위)에는 숫자 리스트, 표지판(아래)에는 몇 번 칸인지가 적혀 있어요.
# 비밀 문 암호 = 리스트의 그 번호 칸 값 (정수). 리스트 번호는 0부터 세요!

book = read("up")
n = read("down")
print(book, n)
for i in range(6):
    move_right()
`,
    solution: `book = read("up")
n = int(read("down"))
for i in range(6):
    move_right()
open_gate("right", book[n])
move_right()
move_right()
`,
    bypasses: [
      {
        name: '번호를 1 부터 세기',
        code: `book = read("up")\nn = int(read("down"))\nfor i in range(6):\n    move_right()\nopen_gate("right", book[n - 1])\nmove_right()\nmove_right()\n`,
      },
      {
        name: '맵 1 의 암호를 코드에 직접 쓰기',
        code: (levels) => `for i in range(6):\n    move_right()\nopen_gate("right", ${py(firstGate(levels))})\nmove_right()\nmove_right()\n`,
      },
      {
        name: '석판의 숫자를 하나씩 넣어 보기',
        code: `book = read("up")\nfor i in range(6):\n    move_right()\nfor v in book:\n    open_gate("right", v)\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 16a (비계: 리스트에 모으기)
  {
    id: 'stage-16a',
    part: 2,
    title: '숫자 모으기',
    concept: 'append · sum',
    goal: '비밀 문의 암호는 위쪽 표지판 숫자를 모두 더한 값(정수)이에요.',
    hint: 'nums = [] 로 빈 리스트를 만들고, 표지판을 만날 때마다 nums.append(int(read("up"))). 문 앞에서 sum(nums)!',
    note: '표지판 개수(3~5개)와 위치, 숫자, 복도 길이가 실행할 때마다 바뀌어요.',
    api: PART2_API,
    seeds: [1, 2, 3],
    stars: { lines: 8 },
    map: scatteredSigns,
    content: (rng, { signs }) => {
      const nums = distinctInts(rng, signs.length, 5, 60);
      return { signs: nums.map(String), gates: [nums.reduce((a, b) => a + b, 0)] };
    },
    concepts: [
      {
        name: '리스트에 모으기: append 와 sum()',
        text: [
          '[] 는 아무것도 없는 빈 리스트예요.',
          '리스트.append(값) 은 리스트 맨 뒤에 값을 하나 붙여요. 몇 개가 될지 몰라도 계속 모을 수 있어요.',
          'sum(리스트) 는 리스트의 값을 모두 더한 값, len(리스트) 는 모은 개수예요.',
        ],
        example: 'nums = []\nnums.append(5)\nnums.append(12)\nprint(nums)        # [5, 12]\nprint(sum(nums))   # 17',
        inGame: '지나가며 읽은 숫자를 nums.append(int(read("up"))) 로 모아 두고, 문 앞에서 sum(nums) 를 넣어요.',
      },
    ],
    starter: `# 길 위쪽 곳곳에 숫자 표지판이 있어요 (개수는 실행할 때마다 달라요).
# 비밀 문 암호 = 표지판 숫자를 모두 더한 값 (정수)
# 빈 리스트 [] 를 만들고 .append(값) 으로 하나씩 모아 보세요.

nums = []
while look("right") != "gate":
    if look("up") == "sign":
        print(read("up"))
    move_right()
print(nums)
`,
    solution: `nums = []
while look("right") != "gate":
    if look("up") == "sign":
        nums.append(int(read("up")))
    move_right()
open_gate("right", sum(nums))
move_right()
move_right()
`,
    bypasses: [
      {
        name: '맵 1 의 암호를 코드에 직접 쓰기',
        code: (levels) => `while look("right") != "gate":\n    move_right()\nopen_gate("right", ${py(firstGate(levels))})\nmove_right()\nmove_right()\n`,
      },
      {
        name: '마지막 표지판 숫자만 넣기',
        code: `n = 0\nwhile look("right") != "gate":\n    if look("up") == "sign":\n        n = int(read("up"))\n    move_right()\nopen_gate("right", n)\nmove_right()\nmove_right()\n`,
      },
      {
        name: '암호를 하나씩 넣어 보기',
        code: `while look("right") != "gate":\n    move_right()\nfor c in range(300):\n    open_gate("right", c)\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 17
  {
    id: 'stage-17',
    part: 2,
    title: '흩어진 숫자',
    concept: 'max · 글자와 수 비교',
    goal: '비밀 문의 암호는 위쪽 표지판 숫자 중 가장 큰 수(정수)예요.',
    hint: 'nums = [] 로 빈 리스트를 만들고, 표지판을 만날 때마다 nums.append(int(read("up"))). 문 앞에서 max(nums)!',
    note: '표지판 개수(3~5개)와 위치, 숫자, 복도 길이가 실행할 때마다 바뀌어요.',
    api: PART2_API,
    seeds: [1, 4, 7],
    stars: { lines: 8 },
    map: scatteredSigns,
    content: (rng, { signs }) => {
      // 글자 그대로 비교한 최댓값("9" > "10")과 수로 비교한 최댓값이 다르도록 고른다
      for (;;) {
        const nums = distinctInts(rng, signs.length, 3, 150);
        const strMax = nums.map(String).reduce((a, b) => (b > a ? b : a));
        if (Number(strMax) !== Math.max(...nums)) return { signs: nums.map(String), gates: [Math.max(...nums)] };
      }
    },
    concepts: [
      {
        name: 'max() 와 글자 비교 함정',
        text: [
          'max(리스트) 는 가장 큰 값, min(리스트) 는 가장 작은 값이에요.',
          '글자끼리 비교하면 사전 순서라서 "9" 가 "10" 보다 커요! (첫 글자 "9" > "1")',
          '수로 비교하려면 모을 때부터 int() 로 바꿔 모으세요.',
        ],
        example: 'print(max(["9", "10"]))   # 9  (글자 비교)\nprint(max([9, 10]))       # 10 (수 비교)',
        inGame: '지나가며 읽은 숫자를 nums.append(int(read("up"))) 로 모아 두고, 문 앞에서 max(nums) 를 넣어요.',
      },
    ],
    starter: `# 길 위쪽 곳곳에 숫자 표지판이 있어요 (개수는 실행할 때마다 달라요).
# 비밀 문 암호 = 표지판 숫자 중 가장 큰 수 (정수)
# 빈 리스트 [] 를 만들고 .append(값) 으로 하나씩 모아 보세요.

nums = []
while look("right") != "gate":
    if look("up") == "sign":
        print(read("up"))
    move_right()
print(nums)
`,
    solution: `nums = []
while look("right") != "gate":
    if look("up") == "sign":
        nums.append(int(read("up")))
    move_right()
open_gate("right", max(nums))
move_right()
move_right()
`,
    bypasses: [
      {
        name: '글자 그대로 모아서 max',
        code: `nums = []\nwhile look("right") != "gate":\n    if look("up") == "sign":\n        nums.append(read("up"))\n    move_right()\nopen_gate("right", int(max(nums)))\nmove_right()\nmove_right()\n`,
      },
      {
        name: '맵 1 의 표지판 수만큼 변수를 따로 쓰기',
        code: (levels) => {
          const xs = levels[0].signs.map((s) => s.x);
          const names = xs.map((_, i) => `n${i}`);
          let x = levels[0].start.x;
          let code = '';
          xs.forEach((sx, i) => {
            for (; x < sx; x++) code += 'move_right()\n';
            code += `${names[i]} = int(read("up"))\n`;
          });
          return code + `while look("right") != "gate":\n    move_right()\nopen_gate("right", max(${names.join(', ')}))\nmove_right()\nmove_right()\n`;
        },
      },
      {
        name: '암호를 하나씩 넣어 보기',
        code: `while look("right") != "gate":\n    move_right()\nfor c in range(200):\n    open_gate("right", c)\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 17a (비계: 값을 돌려주는 함수)
  {
    id: 'stage-17a',
    part: 2,
    title: '암호 변환기',
    concept: 'return 첫걸음',
    goal: '문 3개를 열고 출구로! 암호는 문 앞 칸 위 "표지판 숫자 × 2 + 1"(정수)이에요.',
    hint: 'def code(n): 안에서 return n * 2 + 1 로 계산한 값을 돌려줘요. 그러면 open_gate("right", code(n)) 처럼 쓸 수 있어요.',
    note: '표지판의 숫자는 실행할 때마다 바뀌어요.',
    api: PART2_API,
    seeds: [1, 2, 3],
    stars: { lines: 8 },
    map: ['#T#T#T###', '#SG.G.GE#', '#########'],
    content: (rng) => {
      const nums = distinctInts(rng, 3, 5, 49);
      return { signs: nums.map(String), gates: nums.map((n) => n * 2 + 1) };
    },
    concepts: [
      {
        name: '값을 돌려주는 함수 (return)',
        text: [
          'return 값 은 함수를 끝내면서 그 값을 부른 곳으로 돌려줘요.',
          '함수를 부른 자리 code(5) 가 돌려받은 값(11)으로 바뀐다고 생각하면 돼요.',
          '돌려받은 값은 변수에 담거나, 다른 함수의 괄호 안에 바로 넣을 수 있어요.',
        ],
        example: 'def double(n):\n    return n * 2\n\nx = double(5)\nprint(x, double(x))   # 10 20',
        inGame: 'code(n) 이 암호를 계산해 돌려주면, 문마다 open_gate("right", code(n)) 한 줄로 열어요.',
      },
    ],
    starter: `# 비밀 문의 암호 = 바로 앞 표지판 숫자 × 2 + 1 (정수)
# return 은 함수가 계산한 값을 부른 곳으로 돌려줘요.
# 아래 code(n) 이 올바른 암호를 돌려주도록 고쳐 보세요.

def code(n):
    return 0

for i in range(3):
    n = int(read("up"))
    print(n, "→", code(n))
    open_gate("right", code(n))
    move_right()
    move_right()
`,
    solution: `def code(n):
    return n * 2 + 1

for i in range(3):
    n = int(read("up"))
    open_gate("right", code(n))
    move_right()
    move_right()
`,
    bypasses: [
      {
        name: '× 2 만 하기',
        code: `for i in range(3):\n    n = int(read("up"))\n    open_gate("right", n * 2)\n    move_right()\n    move_right()\n`,
      },
      {
        name: '맵 1 의 암호를 코드에 직접 쓰기',
        code: (levels) =>
          levels[0].gates.map((g) => `open_gate("right", ${py(g.code)})\nmove_right()\nmove_right()\n`).join(''),
      },
    ],
  },

  // ───────────────────────────── 18
  {
    id: 'stage-18',
    part: 2,
    title: '지도 제작자의 탑',
    concept: 'if + return · 종합',
    goal: '위 석판은 길 안내, 왼쪽 석판은 암호 목록이에요. 몬스터를 처치하고 비밀 문 2개를 열어 출구로!',
    hint: 'def spell_for(kind): 가 몬스터 종류에 맞는 마법 이름을 return 하게 만들고, cast(spell_for(look(d)), d) 로 써요. 문은 만나는 순서대로 codes[0], codes[1] 이에요.',
    note: '미로 모양, 몬스터 종류와 위치, 비밀 문 위치와 암호가 실행할 때마다 바뀌어요.',
    api: PART2_API,
    seeds: [1, 2, 3],
    stars: { lines: 13 },
    map: (rng) => {
      const rows = mazeMap(rng, 6, 4);
      const g = rows.map((r) => [...r]);
      g[1][0] = 'M'; // 입구 왼쪽: 암호 목록
      const cells = cellsOf(rows, pathOf(rows));
      // 첫 칸과 출구를 뺀 길 위에 비밀 문 2개, 몬스터 3~4마리
      const spots = distinctInts(rng, 5 + rng.int(2), 1, cells.length - 2).map((i) => cells[i]);
      spots.forEach(([x, y], i) => (g[y][x] = i < 2 ? 'G' : rng.pick(['s', 'b', 'g'])));
      return g.map((r) => r.join(''));
    },
    content: (rng, { rows, gates }) => {
      const path = pathOf(rows);
      const codes = [wordCode(rng), wordCode(rng)];
      // 암호 목록은 길에서 만나는 순서, 비밀 문 자리(gates)는 맵 위→아래 순서이므로 맞춰 준다
      const order = cellsOf(rows, path).map(([x, y]) => `${x},${y}`);
      const rank = gates.map((g) => order.indexOf(`${g.x},${g.y}`));
      const sorted = [...rank].sort((a, b) => a - b);
      // 위쪽 석판(길 안내)이 먼저(위→아래 순서), 왼쪽 석판(암호 목록)이 다음
      return { tablets: [path, codes], gates: rank.map((r) => codes[sorted.indexOf(r)]) };
    },
    concepts: [
      {
        name: '조건마다 다른 값 돌려주기',
        text: [
          'return 을 만나면 함수는 그 자리에서 바로 끝나요. 아래 줄은 실행되지 않아요.',
          'if 안에 return 을 두면 조건마다 다른 값을 돌려줄 수 있어요.',
          '같은 판단을 여러 번 해야 할 때 함수로 만들어 두면 한 줄로 다시 쓸 수 있어요.',
        ],
        example: 'def sign(n):\n    if n < 0:\n        return "음수"\n    return "0 이상"\n\nprint(sign(-3), sign(7))   # 음수 0 이상',
        inGame: 'spell_for(kind) 가 몬스터에 맞는 마법 이름을 돌려주면 cast(spell_for(look(d)), d) 한 줄로 어떤 몬스터든 처치해요.',
      },
    ],
    starter: `# 2부 마지막! 석판 2개: 위쪽은 길 안내, 왼쪽은 비밀 문 암호 목록이에요.
# 길에는 몬스터와 비밀 문 2개가 있어요. 문은 길에서 만나는 순서대로 암호 목록의 0번, 1번이에요.
# return 이 있는 함수는 값을 돌려줘요. 몬스터 종류에 맞는 마법 이름을 돌려주게 고쳐 보세요.

def spell_for(kind):
    return "fireball"

codes = read("left")
path = read("up")
print(codes)
print(path)
`,
    solution: `def spell_for(kind):
    if kind == "slime":
        return "fireball"
    return "icebolt"

codes = read("left")
g = 0
for d in read("up"):
    while look(d) in ["slime", "bat", "giant"]:
        cast(spell_for(look(d)), d)
    if look(d) == "gate":
        open_gate(d, codes[g])
        g = g + 1
    move(d)
`,
    bypasses: [
      {
        name: '언제나 불 마법',
        code: `codes = read("left")\ng = 0\nfor d in read("up"):\n    while look(d) in ["slime", "bat", "giant"]:\n        cast("fireball", d)\n    if look(d) == "gate":\n        open_gate(d, codes[g])\n        g = g + 1\n    move(d)\n`,
      },
      {
        name: '두 문에 같은 암호',
        code: `codes = read("left")\nfor d in read("up"):\n    while look(d) in ["slime", "bat", "giant"]:\n        if look(d) == "slime":\n            cast("fireball", d)\n        else:\n            cast("icebolt", d)\n    if look(d) == "gate":\n        open_gate(d, codes[0])\n    move(d)\n`,
      },
      { name: '맵 1 의 길을 move_* 로 나열', code: (levels) => movesCode(levels[0].signs[0].value as string[]) },
    ],
  },
];
