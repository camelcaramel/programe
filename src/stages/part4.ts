// 4부: stage-28 ~ stage-36 + 비계 28a·30a·31a (화면 번호 37~48). 탐색 · 최댓값 · 정렬 · 효율 비교, 도전: 재귀 · 탐욕 · 깊이 우선 탐색 (PART4.md)
// 금고 속 숫자·석상 무게·원판 수·통행료는 content() 가 시드마다 정하고, 계획 화면에서는 보이지 않는다.
// 알고리즘은 "횟수"(들여다보기·저울·바꾸기·턴)로 강제한다. 제한값은 sim/algo.ts 의 계산과 정답 코드가 똑같이 맞는다.
// solution / bypasses 는 학생에게 보이지 않고, 테스트(stages.test.ts)가 "정답은 통과, 우회는 실패"를 확인한다.
import { COINS, bubbleCost, greedyCoins, insertionCost, inversions, type Level, type Rng } from '../sim';
import { loopyMaze, movesCode } from './maze';
import { ALGO_API, type StageInfo } from './types';

/** 서로 다른 정수 n 개를 [lo, hi] 에서 (작은 것부터) */
function distinctInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = lo + rng.int(hi - lo + 1);
    if (!out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 한 줄짜리 방: 위에 금고·석상 n 개, 아래 복도 끝에 비밀 문(G) 또는 창살(=), 그 뒤 출구.
 * sign 이면 시작 칸 아래에 표지판. 폭 n + 4
 */
function lineRoom(n: number, item: 'V' | 'W', tail: 'G' | '=', sign = false): string[] {
  const wall = '#'.repeat(n + 4);
  return [wall, '#' + item.repeat(n) + '###', '#S' + '.'.repeat(n - 2) + tail + '.E#', sign ? '#T' + '#'.repeat(n + 2) : wall];
}

/** 시작(x=1)에서 출구까지 걷는 칸 수 (lineRoom 의 복도) */
const corridorWalk = (rows: string[]) => rows[2].indexOf('E') - 1;

const TO_GATE = `while look("right") != "gate":\n    move_right()\n`;
const TO_EXIT = `while look("right") != "exit":\n    move_right()\nmove_right()\n`;

/** 석상 바꾸기 순서를 그대로 적은 코드 (맵 1 을 외우는 우회 풀이) */
const swapsCode = (swaps: [number, number][]) => swaps.map(([a, b]) => `swap(${a}, ${b})`).join('\n') + '\n';

function selectionSwaps(values: readonly number[]): [number, number][] {
  const a = [...values];
  const out: [number, number][] = [];
  for (let i = 0; i < a.length - 1; i++) {
    let small = i;
    for (let j = i + 1; j < a.length; j++) if (a[small] > a[j]) small = j;
    if (small !== i) {
      [a[i], a[small]] = [a[small], a[i]];
      out.push([i, small]);
    }
  }
  return out;
}

function adjacentSwaps(values: readonly number[]): [number, number][] {
  const a = [...values];
  const out: [number, number][] = [];
  for (let i = 1; i < a.length; i++)
    for (let j = i; j > 0 && a[j - 1] > a[j]; j--) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      out.push([j - 1, j]);
    }
  return out;
}

const rowOf = (l: Level) => l.row!.values;

/** 섞인 석상 무게: 뒤바뀐 쌍이 n+1 개 이상 (버블·삽입 정렬은 바꾸기가 n−1 번을 넘게) */
function scrambled(rng: Rng, n: number): number[] {
  const base = distinctInts(rng, n, 10, 99);
  for (;;) {
    const v = shuffle(rng, base);
    if (inversions(v) >= n + 1 && selectionSwaps(v).some(([a, b]) => b - a > 1)) return v;
  }
}

// ───────── 36 보물 동굴: 미로·벽 짚기 ─────────

const STEP: Record<string, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const CLOCK = ['up', 'right', 'down', 'left'];
const open = (rows: string[], x: number, y: number) => {
  const c = rows[y]?.[x];
  return c !== undefined && c !== '#' && c !== '=' && c !== 'E';
};

/** S 에서 갈 수 있는 칸 (창살·출구 제외) */
function reachable(rows: string[]): [number, number][] {
  const y0 = rows.findIndex((r) => r.includes('S'));
  const start: [number, number] = [rows[y0].indexOf('S'), y0];
  const seen = new Set([start.join(',')]);
  const out = [start];
  for (let i = 0; i < out.length; i++) {
    const [x, y] = out[i];
    for (const [dx, dy] of Object.values(STEP)) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && open(rows, x + dx, y + dy)) {
        seen.add(k);
        out.push([x + dx, y + dy]);
      }
    }
  }
  return out;
}

/** 오른손(turn=+1)·왼손(turn=−1)을 벽에 대고 걸을 때 밟는 칸 (상자도 지나갈 수 있다고 본다) */
function wallFollow(rows: string[], turn: 1 | -1): Set<string> {
  let y = rows.findIndex((r) => r.includes('S'));
  let x = rows[y].indexOf('S');
  let h = 1;
  const seen = new Set([`${x},${y}`]);
  for (let guard = 0; guard < rows.length * rows[0].length * 16; guard++) {
    const r = (h + turn + 4) % 4;
    const can = (d: number) => open(rows, x + STEP[CLOCK[d]][0], y + STEP[CLOCK[d]][1]);
    if (can(r)) h = r;
    else if (!can(h)) {
      h = (h - turn + 4) % 4;
      continue;
    }
    x += STEP[CLOCK[h]][0];
    y += STEP[CLOCK[h]][1];
    seen.add(`${x},${y}`);
  }
  return seen;
}

/** 시작점 왼쪽에 창살(=)과 출구를 붙인 고리 미로 + 보물상자. 상자 하나는 벽 짚기로는 못 가는 곳에 */
function caveMap(rng: Rng): string[] {
  for (;;) {
    const base = loopyMaze(rng, 7, 5, 6).map((r) => r.replace('E', '.'));
    const rows = base.map((r, y) => (y === 1 ? '#E=' + r.slice(1) : '##' + r));
    const cells = reachable(rows).slice(1);
    const right = wallFollow(rows, 1);
    const left = wallFollow(rows, -1);
    const hidden = cells.filter(([x, y]) => !right.has(`${x},${y}`) && !left.has(`${x},${y}`));
    if (hidden.length === 0) continue;
    const chests = [rng.pick(hidden)];
    const k = 3 + rng.int(3);
    while (chests.length < k) {
      const c = rng.pick(cells);
      if (!chests.some((d) => d[0] === c[0] && d[1] === c[1])) chests.push(c);
    }
    const g = rows.map((r) => [...r]);
    for (const [x, y] of chests) g[y][x] = 'c';
    return g.map((r) => r.join(''));
  }
}

/** 맵 1 에서 DFS 로 다니는 길을 외운 코드 (우회 풀이) */
function caveRouteCode(l: Level): string {
  const passable = (x: number, y: number) => {
    const t = l.terrain[y]?.[x];
    return t === 'floor';
  };
  const seen = new Set([`${l.start.x},${l.start.y}`]);
  const moves: string[] = [];
  const back: Record<string, string> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const go = (x: number, y: number) => {
    for (const d of ['up', 'down', 'left', 'right']) {
      const nx = x + STEP[d][0];
      const ny = y + STEP[d][1];
      if (!passable(nx, ny) || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      moves.push(d);
      go(nx, ny);
      moves.push(back[d]);
    }
  };
  go(l.start.x, l.start.y);
  return movesCode([...moves, 'left', 'left']);
}

export const PART4: StageInfo[] = [
  // ───────────────────────────── 28
  {
    id: 'stage-28',
    part: 4,
    title: '금고 줄',
    concept: '순차 탐색',
    goal: '표지판(아래) 숫자가 든 금고의 번호를 비밀 문 암호로 넣고 출구로!',
    hint: 'for i in range(size()) 로 0번 금고부터 차례로 peek(i) 를 보고, 찾는 숫자와 같으면 번호를 변수에 담고 break 로 바로 멈춰요.',
    note: '금고 수·숫자·위치는 실행할 때마다 바뀌어요. 들여다보기는 "찾는 금고 번호 + 1" 번뿐이라 찾으면 바로 멈춰야 해요.',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 11 },
    map: (rng) => lineRoom(8 + rng.int(7), 'V', 'G', true),
    maxTurns: (rows) => rows[0].length,
    content: (rng, { items }) => {
      const values = shuffle(rng, distinctInts(rng, items.length, 10, 99));
      const idx = 3 + rng.int(items.length - 3);
      return { row: values, signs: [String(values[idx])], gates: [idx], peekLimit: idx + 1 };
    },
    concepts: [
      {
        name: '알고리즘 · 순차 탐색',
        text: [
          '알고리즘은 문제를 푸는 절차예요. 같은 문제도 여러 알고리즘으로 풀 수 있고, 일을 얼마나 적게 하는지가 서로 달라요.',
          '순차 탐색은 처음부터 하나씩 차례로 보며 찾는 것이에요. 데이터가 섞여 있어도 쓸 수 있어요.',
          '찾았으면 더 볼 필요가 없어요. break 로 반복을 바로 멈춰요.',
        ],
        example: 'nums = [42, 7, 19, 3]\nfor i in range(len(nums)):\n    if nums[i] == 19:\n        print(i, "번째에서 찾음")   # 2\n        break',
        inGame: '금고 속 숫자는 peek(i) 로만 볼 수 있어요. 0번부터 차례로 보고, 찾으면 그 번호를 기억하고 멈춰요!',
      },
    ],
    starter: `# 아래 표지판에 찾을 숫자가 적혀 있어요. 금고는 0번부터 size() - 1 번까지.
# peek(i) 는 i번 금고 속 숫자. 들여다보기는 "찾는 금고 번호 + 1" 번뿐이라 찾으면 바로 멈춰야 해요!
# 비밀 문 암호 = 찾는 숫자가 든 금고의 번호

target = int(read("down"))
print("찾을 수:", target, "/ 금고", size(), "개")
print("0번 금고:", peek(0))
`,
    solution: `target = int(read("down"))
for i in range(size()):
    if peek(i) == target:
        found = i
        break
${TO_GATE}open_gate("right", found)
${TO_EXIT}`,
    bypasses: [
      {
        name: '모두 들여다본 뒤 리스트의 index() 로 찾기',
        code: `target = int(read("down"))\nnums = []\nfor i in range(size()):\n    nums.append(peek(i))\n${TO_GATE}open_gate("right", nums.index(target))\n${TO_EXIT}`,
      },
      { name: '번호를 0 부터 차례로 암호에 넣어 보기', code: `${TO_GATE}for c in range(size()):\n    open_gate("right", c)\n${TO_EXIT}` },
      { name: '맵 1 의 금고 번호를 외우기', code: (levels) => `${TO_GATE}open_gate("right", ${levels[0].gates[0].code})\n${TO_EXIT}` },
    ],
  },

  // ───────────────────────────── 28a (비계: 가운데를 한 번 보고 절반 버리기)
  {
    id: 'stage-28a',
    part: 4,
    title: '가운데부터',
    concept: '이진 탐색 첫걸음',
    goal: '금고는 작은 수 → 큰 수 순서예요. 가운데를 먼저 보고, 찾는 쪽 절반만 들여다봐요!',
    hint: 'mid = (lo + hi) // 2 번 금고를 봐요. 찾는 수가 더 크면 lo = mid + 1, 아니면 hi = mid. 그다음 lo 부터 hi 까지만 차례로 peek!',
    note: '금고 수(10~12)·숫자는 실행할 때마다 바뀌어요. 들여다보기는 "가운데 1번 + 절반 크기" 만큼뿐이라, 처음부터 차례로 보면 모자랄 수 있어요.',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 18 },
    map: (rng) => lineRoom(10 + rng.int(3), 'V', 'G', true),
    maxTurns: (rows) => rows[0].length,
    content: (rng, { items }) => {
      const n = items.length;
      const values = distinctInts(rng, n, 10, 99);
      const mid = Math.floor((n - 1) / 2);
      const limit = 1 + Math.max(mid + 1, n - 1 - mid);
      // 절반은 왼쪽(3 ~ mid), 절반은 "처음부터 차례로 보면 모자란" 오른쪽(limit ~ n-1)
      const idx = rng.int(2) === 0 ? 3 + rng.int(mid - 2) : limit + rng.int(n - limit);
      return { row: values, signs: [String(values[idx])], gates: [idx], peekLimit: limit };
    },
    concepts: [
      {
        name: '가운데를 보고 절반 버리기',
        text: [
          '정렬된 줄에서는 가운데 하나만 봐도, 찾는 수가 왼쪽 절반에 있을지 오른쪽 절반에 있을지 알 수 있어요.',
          '// 는 나눈 몫(소수점 버림)이에요. (0 + 9) // 2 는 4. 그래서 가운데 번호는 (lo + hi) // 2.',
          '남은 범위를 lo(처음) ~ hi(끝) 두 변수로 기억하면, range(lo, hi + 1) 로 그 범위만 볼 수 있어요.',
        ],
        example:
          'nums = [3, 8, 15, 21, 30, 42]\nlo, hi = 0, len(nums) - 1\nmid = (lo + hi) // 2      # 2\nif nums[mid] < 30:\n    lo = mid + 1          # 오른쪽 절반만\nelse:\n    hi = mid\nprint(lo, hi)             # 3 5',
        inGame: '가운데 금고를 peek 해서 절반을 버리고, 남은 절반만 차례로 peek 해요.',
      },
    ],
    starter: `# 금고 속 숫자는 0번부터 작은 것 → 큰 것 순서예요.
# 들여다보기가 모자라서, 처음부터 차례로 보면 못 찾을 수도 있어요!
# 가운데 금고를 먼저 보면 절반을 버릴 수 있어요.

target = int(read("down"))
lo = 0
hi = size() - 1
mid = (lo + hi) // 2
print("가운데", mid, "번 금고:", peek(mid), "/ 찾을 수:", target)
`,
    solution: `target = int(read("down"))
lo = 0
hi = size() - 1
mid = (lo + hi) // 2
if peek(mid) < target:
    lo = mid + 1
else:
    hi = mid
for i in range(lo, hi + 1):
    if peek(i) == target:
        found = i
        break
${TO_GATE}open_gate("right", found)
${TO_EXIT}`,
    bypasses: [
      {
        name: '처음부터 하나씩 (순차 탐색)',
        code: `target = int(read("down"))\nfor i in range(size()):\n    if peek(i) == target:\n        found = i\n        break\n${TO_GATE}open_gate("right", found)\n${TO_EXIT}`,
      },
      {
        name: '가운데를 보지 않고 늘 오른쪽 절반만',
        code: `target = int(read("down"))\nfor i in range(size() // 2, size()):\n    if peek(i) == target:\n        found = i\n        break\n${TO_GATE}open_gate("right", found)\n${TO_EXIT}`,
      },
      { name: '맵 1 의 금고 번호를 외우기', code: (levels) => `${TO_GATE}open_gate("right", ${levels[0].gates[0].code})\n${TO_EXIT}` },
    ],
  },

  // ───────────────────────────── 29
  {
    id: 'stage-29',
    part: 4,
    title: '정렬된 금고',
    concept: '이진 탐색',
    goal: '금고는 작은 수 → 큰 수 순서예요. 표지판 숫자가 든 금고 번호를 찾아요!',
    hint: 'lo = 0, hi = size() - 1 에서 시작해 가운데 mid = (lo + hi) // 2 를 봐요. 찾는 수보다 작으면 lo = mid + 1, 크면 hi = mid - 1 로 절반을 버려요.',
    note: '금고 수(33~63)·숫자는 실행할 때마다 바뀌어요. 들여다보기는 6번뿐이에요. 금고 번호는 위 줄부터, 왼쪽→오른쪽으로 0, 1, 2 …',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 18 },
    map: (rng) => {
      const n = 33 + rng.int(31);
      const rows = ['#'.repeat(13)];
      for (let left = n; left > 0; left -= 9) rows.push('#' + 'V'.repeat(Math.min(9, left)) + '#'.repeat(9 - Math.min(9, left)) + '###');
      return [...rows, '#S.......G.E#', '#T###########'];
    },
    maxTurns: 13,
    content: (rng, { items }) => {
      const values = distinctInts(rng, items.length, 100, 999);
      const idx = 6 + rng.int(items.length - 6);
      return { row: values, signs: [String(values[idx])], gates: [idx], peekLimit: Math.floor(Math.log2(items.length)) + 1 };
    },
    concepts: [
      {
        name: '이진 탐색',
        text: [
          '"가운데를 보고 절반 버리기"를 남은 범위에서 또, 또 되풀이하는 것이 이진 탐색이에요.',
          '찾는 수가 가운데보다 크면 lo = mid + 1, 작으면 hi = mid - 1. 범위가 빌 때까지(lo <= hi) while 로 반복해요.',
          '볼 때마다 절반이 되니까 64개도 6번 안에 찾아요. 순차 탐색이라면 64번까지 볼 수 있어요.',
          '정렬되어 있지 않으면 쓸 수 없어요!',
        ],
        example:
          'nums = [3, 8, 15, 21, 30, 42]\nlo, hi = 0, len(nums) - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if nums[mid] == 30:\n        break\n    elif nums[mid] < 30:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(mid)   # 4',
        inGame: 'nums[mid] 대신 peek(mid)! 찾으면 mid 가 비밀 문 암호예요.',
      },
    ],
    starter: `# 금고 속 숫자는 0번부터 작은 것 → 큰 것 순서로 들어 있어요. 들여다보기는 6번뿐!
# 앞에서부터 보면 모자라요. 가운데를 보고 절반씩 버려 보세요.

target = int(read("down"))
lo = 0
hi = size() - 1
mid = (lo + hi) // 2
print("가운데", mid, "번 금고:", peek(mid), "/ 찾을 수:", target)
`,
    solution: `target = int(read("down"))
lo = 0
hi = size() - 1
while lo <= hi:
    mid = (lo + hi) // 2
    v = peek(mid)
    if v == target:
        break
    if v < target:
        lo = mid + 1
    else:
        hi = mid - 1
${TO_GATE}open_gate("right", mid)
${TO_EXIT}`,
    bypasses: [
      {
        name: '앞에서부터 하나씩 (순차 탐색)',
        code: `target = int(read("down"))\nfor i in range(size()):\n    if peek(i) == target:\n        found = i\n        break\n${TO_GATE}open_gate("right", found)\n${TO_EXIT}`,
      },
      { name: '맵 1 의 금고 번호를 외우기', code: (levels) => `${TO_GATE}open_gate("right", ${levels[0].gates[0].code})\n${TO_EXIT}` },
    ],
  },

  // ───────────────────────────── 30
  {
    id: 'stage-30',
    part: 4,
    title: '가장 무거운 석상',
    concept: '최댓값 찾기',
    goal: '가장 무거운 석상의 번호가 비밀 문 암호예요. 저울은 (석상 수 − 1) 번만 쓸 수 있어요.',
    hint: 'best = 0 으로 두고 1번부터 차례로 heavier(i, best) 를 재요. i 가 더 무거우면 best = i. 마지막에 남은 best 가 답이에요.',
    note: '석상 수·무게는 실행할 때마다 바뀌어요. 무게는 보이지 않고, heavier(i, j) 로 두 석상을 비교만 할 수 있어요.',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 10 },
    map: (rng) => lineRoom(6 + rng.int(5), 'W', 'G'),
    maxTurns: (rows) => rows[0].length,
    content: (rng, { items }) => {
      const n = items.length;
      const values = shuffle(rng, distinctInts(rng, n, 10, 99));
      let top = values.indexOf(Math.max(...values));
      if (top < 3) {
        const to = 3 + rng.int(n - 3);
        [values[top], values[to]] = [values[to], values[top]];
        top = to;
      }
      return { row: values, gates: [top], weighLimit: n - 1 };
    },
    concepts: [
      {
        name: '최댓값 찾기',
        text: [
          '가장 큰 것을 찾을 때는 "지금까지 가장 큰 것"을 변수 하나에 기억해 두고, 나머지를 하나씩 그것과만 비교해요.',
          '더 큰 것이 나오면 변수를 바꿔요. 끝까지 보면 변수에 남은 것이 가장 커요.',
          'n 개 중 가장 큰 것은 n − 1 번 비교로 찾을 수 있어요. 모든 쌍을 비교하면 훨씬 많이 들어요.',
        ],
        example: 'nums = [42, 7, 91, 3]\nbest = 0\nfor i in range(1, len(nums)):\n    if nums[i] > nums[best]:\n        best = i\nprint(best)   # 2',
        inGame: '무게는 보이지 않으니 nums[i] > nums[best] 대신 heavier(i, best)!',
      },
    ],
    starter: `# 석상의 무게는 보이지 않아요. heavier(i, j) 는 i번 석상이 j번보다 무거우면 True.
# 저울은 (석상 수 - 1) 번만! 비밀 문 암호 = 가장 무거운 석상의 번호

print("석상", size(), "개")
print("1번이 0번보다 무거운가?", heavier(1, 0))
`,
    solution: `best = 0
for i in range(1, size()):
    if heavier(i, best):
        best = i
${TO_GATE}open_gate("right", best)
${TO_EXIT}`,
    bypasses: [
      {
        name: '석상마다 "나보다 무거운 게 있나" 모두 재기',
        code: `n = size()\nfor i in range(n):\n    top = True\n    for j in range(n):\n        if heavier(j, i):\n            top = False\n    if top:\n        best = i\n${TO_GATE}open_gate("right", best)\n${TO_EXIT}`,
      },
      { name: '번호를 0 부터 차례로 암호에 넣어 보기', code: `${TO_GATE}for c in range(size()):\n    open_gate("right", c)\n${TO_EXIT}` },
      { name: '맵 1 의 답을 외우기', code: (levels) => `${TO_GATE}open_gate("right", ${levels[0].gates[0].code})\n${TO_EXIT}` },
    ],
  },

  // ───────────────────────────── 30a (비계: 선택 정렬 한 바퀴)
  {
    id: 'stage-30a',
    part: 4,
    title: '가장 가벼운 것을 맨 앞으로',
    concept: '선택 정렬 한 바퀴',
    goal: '가장 가벼운 석상을 찾아 0번과 한 번 바꾸면 창살이 열려요!',
    hint: 'small = 0 으로 두고 1번부터 heavier(small, i) 를 재요. small 이 더 무거우면 small = i. 다 재고 나서 swap(0, small) 한 번!',
    note: '석상 수·순서는 실행할 때마다 바뀌어요. 바꾸기는 1번, 저울은 (석상 수 − 1) 번뿐이에요.',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 8 },
    map: (rng) => lineRoom(6 + rng.int(3), 'W', '='),
    maxTurns: (rows) => 1 + corridorWalk(rows) + 2,
    barsRule: 'sorted',
    content: (rng, { items }) => {
      const n = items.length;
      const row = distinctInts(rng, n, 10, 99);
      const k = 2 + rng.int(n - 2);
      [row[0], row[k]] = [row[k], row[0]];
      return { row, swapLimit: 1, weighLimit: n - 1 };
    },
    concepts: [
      {
        name: '가장 작은 것 찾아 맨 앞으로',
        text: [
          '가장 가벼운 것 찾기는 가장 무거운 것 찾기(최댓값)의 반대예요. heavier(small, i) 가 True 면 i 가 더 가벼워요.',
          'swap(i, j) 는 두 석상의 자리를 바꿔요(1턴). 멀리 떨어진 두 석상도 바꿀 수 있어요.',
          '"남은 것 중 가장 가벼운 것을 찾아 맨 앞과 바꾸기" 한 번이 선택 정렬의 한 바퀴예요.',
        ],
        example: 'a = [50, 20, 10, 40]\nsmall = 0\nfor i in range(1, len(a)):\n    if a[small] > a[i]:\n        small = i\na[0], a[small] = a[small], a[0]\nprint(a)   # [10, 20, 50, 40]',
        inGame: 'a[small] > a[i] 는 heavier(small, i), 자리 바꾸기는 swap(0, small)!',
      },
    ],
    starter: `# 0번 석상과 가장 가벼운 석상, 두 개만 자리가 바뀌어 있어요.
# heavier(i, j) 는 i번이 j번보다 무거우면 True. swap(i, j) 는 두 석상 자리 바꾸기(1번뿐!)

small = 0
print("1번이 0번보다 가벼운가?", heavier(0, 1))
`,
    solution: `small = 0
for i in range(1, size()):
    if heavier(small, i):
        small = i
swap(0, small)
${TO_EXIT}`,
    bypasses: [
      { name: '0번과 1번 바꾸기', code: `swap(0, 1)\n${TO_EXIT}` },
      { name: '0번과 맨 끝 바꾸기', code: `swap(0, size() - 1)\n${TO_EXIT}` },
      { name: '맵 1 의 바꾸기를 외우기', code: (levels) => swapsCode(selectionSwaps(rowOf(levels[0]))) + TO_EXIT },
    ],
  },

  // ───────────────────────────── 31
  {
    id: 'stage-31',
    part: 4,
    title: '무거운 석상',
    concept: '선택 정렬',
    goal: '석상을 가벼운 것 → 무거운 것 순서로 세우면 창살이 열려요. 바꾸기는 (석상 수 − 1) 번뿐!',
    hint: '0번 자리부터 차례로: 남은 석상 중 가장 가벼운 것을 저울로 찾아(30번의 반대), 그 자리와 한 번만 swap 해요.',
    note: '석상 수·순서는 실행할 때마다 바뀌어요. swap(i, j) 은 아무 두 석상이나 바꿀 수 있고 1턴이 들어요.',
    api: ALGO_API,
    seeds: [1, 5, 8],
    stars: { lines: 12 },
    map: (rng) => lineRoom(6 + rng.int(3), 'W', '='),
    maxTurns: (rows) => rows[0].length - 4 - 1 + corridorWalk(rows) + 2,
    barsRule: 'sorted',
    content: (rng, { items }) => {
      const n = items.length;
      return { row: scrambled(rng, n), swapLimit: n - 1, weighLimit: (n * (n - 1)) / 2 };
    },
    concepts: [
      {
        name: '정렬 · 선택 정렬',
        text: [
          '정렬은 데이터를 크기 순서로 늘어놓는 일이에요. 정렬해 두면 이진 탐색처럼 빠르게 찾을 수 있어요.',
          '선택 정렬: 남은 것 중 가장 작은 것을 "선택"해서 맨 앞자리와 바꿔요. 그다음 자리, 그다음 자리 … 차례로.',
          '자리마다 한 번만 바꾸니까 바꾸기가 가장 적어요(n − 1 번). 대신 비교는 늘 n(n − 1)/2 번 해요.',
        ],
        example:
          'a = [30, 10, 20]\nfor i in range(len(a) - 1):\n    small = i\n    for j in range(i + 1, len(a)):\n        if a[small] > a[j]:\n            small = j\n    a[i], a[small] = a[small], a[i]\nprint(a)   # [10, 20, 30]',
        inGame: 'a[small] > a[j] 는 heavier(small, j), 자리 바꾸기는 swap(i, small)!',
      },
    ],
    starter: `# 석상을 가벼운 것부터 무거운 것 순서(0번이 가장 가볍게)로 세우면 창살이 열려요.
# swap(i, j) 는 두 석상의 자리를 바꿔요(1턴). 석상이 무거워서 (석상 수 - 1) 번만 바꿀 수 있어요!

n = size()
small = 0
for j in range(1, n):
    if heavier(small, j):
        small = j
print("가장 가벼운 석상:", small, "번")
`,
    solution: `n = size()
for i in range(n - 1):
    small = i
    for j in range(i + 1, n):
        if heavier(small, j):
            small = j
    if small != i:
        swap(i, small)
${TO_EXIT}`,
    bypasses: [
      {
        name: '버블 정렬 (바꾸기가 많음)',
        code: `n = size()\nfor k in range(n - 1):\n    for i in range(n - 1 - k):\n        if heavier(i, i + 1):\n            swap(i, i + 1)\n${TO_EXIT}`,
      },
      {
        name: '삽입 정렬 (바꾸기가 많음)',
        code: `for i in range(1, size()):\n    j = i\n    while j > 0 and heavier(j - 1, j):\n        swap(j - 1, j)\n        j = j - 1\n${TO_EXIT}`,
      },
      { name: '정렬하지 않고 걷기', code: TO_EXIT },
      { name: '맵 1 의 바꾸기 순서를 외우기', code: (levels) => swapsCode(selectionSwaps(rowOf(levels[0]))) + TO_EXIT },
    ],
  },

  // ───────────────────────────── 31a (비계: 버블 정렬 한 바퀴)
  {
    id: 'stage-31a',
    part: 4,
    title: '한 번 훑기',
    concept: '버블 정렬 한 바퀴',
    goal: '가장 무거운 석상을 이웃끼리 바꿔 맨 끝까지 밀어 보내면 창살이 열려요!',
    hint: 'for i in range(size() - 1): 로 0번부터 이웃끼리 heavier(i, i + 1) 를 재고, 앞이 무거우면 swap(i, i + 1). 무거운 석상이 거품처럼 끝까지 떠올라요.',
    note: '석상 수와 무거운 석상의 자리는 실행할 때마다 바뀌어요. swap(i, i + 1) 만 할 수 있고, 턴 제한 = 꼭 필요한 바꾸기 수 + 걷기 + 2.',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 6 },
    map: (rng) => lineRoom(6 + rng.int(3), 'W', '='),
    adjacentOnly: true,
    barsRule: 'sorted',
    content: (rng, { items, rows }) => {
      const n = items.length;
      const row = distinctInts(rng, n, 10, 99);
      const top = row.pop()!;
      row.splice(1 + rng.int(n - 3), 0, top); // 1 ~ n-3 번 자리 (뒤로 2칸 이상 밀어야 함)
      return { row, weighLimit: n - 1, maxTurns: inversions(row) + corridorWalk(rows) + 2 };
    },
    concepts: [
      {
        name: '이웃끼리 한 번 훑기',
        text: [
          '이웃한 두 개를 비교해서 앞이 더 무거우면 바꿔요. 이것을 0번부터 끝까지 한 번 해요.',
          '무거운 것은 바뀔 때마다 한 칸씩 뒤로 가니까, 한 번 훑으면 가장 무거운 것이 맨 끝에 가 있어요.',
          '이미 순서가 맞는 이웃은 바꾸지 않아요. 그래서 재 보지 않고 바꾸면 줄이 엉망이 돼요.',
        ],
        example: 'a = [10, 40, 20, 30]\nfor i in range(len(a) - 1):\n    if a[i] > a[i + 1]:\n        a[i], a[i + 1] = a[i + 1], a[i]\nprint(a)   # [10, 20, 30, 40]',
        inGame: 'a[i] > a[i + 1] 은 heavier(i, i + 1), 바꾸기는 swap(i, i + 1)!',
      },
    ],
    starter: `# 가장 무거운 석상 하나만 제자리를 벗어나 있어요. 이웃끼리만 바꿀 수 있어요: swap(i, i + 1)
# heavier(i, i + 1) 은 i번이 바로 오른쪽 이웃보다 무거우면 True

n = size()
print("석상", n, "개")
print("0번이 1번보다 무거운가?", heavier(0, 1))
`,
    solution: `for i in range(size() - 1):
    if heavier(i, i + 1):
        swap(i, i + 1)
${TO_EXIT}`,
    bypasses: [
      { name: '재 보지 않고 차례로 바꾸기', code: `for i in range(size() - 1):\n    swap(i, i + 1)\n${TO_EXIT}` },
      { name: '정렬하지 않고 걷기', code: TO_EXIT },
      { name: '맵 1 의 바꾸기 순서를 외우기', code: (levels) => swapsCode(adjacentSwaps(rowOf(levels[0]))) + TO_EXIT },
    ],
  },

  // ───────────────────────────── 32
  {
    id: 'stage-32',
    part: 4,
    title: '이웃끼리',
    concept: '버블 정렬',
    goal: '석상을 가벼운 것 → 무거운 것 순서로 세우면 창살이 열려요.',
    hint: '0번부터 이웃끼리 재 보고, 앞이 더 무거우면 바꿔요. 한 바퀴 돌면 가장 무거운 것이 맨 끝으로 가요. 이것을 (석상 수 − 1) 바퀴!',
    note: '석상 순서는 실행할 때마다 바뀌어요. swap(i, i + 1) 만 할 수 있어요. 턴 제한 = 꼭 필요한 바꾸기 수 + 걷기 + 2.',
    api: ALGO_API,
    seeds: [1, 5, 8],
    stars: { lines: 9 },
    map: (rng) => lineRoom(6 + rng.int(3), 'W', '='),
    adjacentOnly: true,
    barsRule: 'sorted',
    content: (rng, { items, rows }) => {
      const n = items.length;
      const row = scrambled(rng, n);
      return { row, weighLimit: (n - 1) * (n - 1), maxTurns: inversions(row) + corridorWalk(rows) + 2 };
    },
    concepts: [
      {
        name: '버블 정렬',
        text: [
          '이웃한 두 개를 비교해서 앞이 더 크면 바꿔요. 이것을 앞에서부터 끝까지 하면 가장 큰 것이 거품(버블)처럼 맨 뒤로 떠올라요.',
          '한 바퀴마다 맨 뒤 하나가 제자리를 찾으니, 다음 바퀴는 하나 덜 봐도 돼요.',
          '바꾸기는 "뒤바뀐 쌍의 수"만큼, 비교는 n(n − 1)/2 번쯤 해요.',
        ],
        example:
          'a = [3, 1, 2]\nn = len(a)\nfor k in range(n - 1):\n    for i in range(n - 1 - k):\n        if a[i] > a[i + 1]:\n            a[i], a[i + 1] = a[i + 1], a[i]\nprint(a)   # [1, 2, 3]',
        inGame: 'a[i] > a[i + 1] 은 heavier(i, i + 1), 바꾸기는 swap(i, i + 1)!',
      },
    ],
    starter: `# 이번 방에서는 이웃한 석상끼리만 바꿀 수 있어요: swap(i, i + 1)
# 한 바퀴: 이웃끼리 재 보고 앞이 무거우면 바꾸기

n = size()
for i in range(n - 1):
    if heavier(i, i + 1):
        swap(i, i + 1)
print("한 바퀴 끝! 가장 무거운 석상이 맨 끝으로 갔어요.")
`,
    solution: `n = size()
for k in range(n - 1):
    for i in range(n - 1 - k):
        if heavier(i, i + 1):
            swap(i, i + 1)
${TO_EXIT}`,
    bypasses: [
      {
        name: '선택 정렬 (멀리 있는 석상끼리 바꾸기)',
        code: `n = size()\nfor i in range(n - 1):\n    small = i\n    for j in range(i + 1, n):\n        if heavier(small, j):\n            small = j\n    if small != i:\n        swap(i, small)\n${TO_EXIT}`,
      },
      {
        name: '재 보지 않고 차례로 바꾸기',
        code: `n = size()\nfor k in range(n - 1):\n    for i in range(n - 1 - k):\n        swap(i, i + 1)\n${TO_EXIT}`,
      },
      { name: '맵 1 의 바꾸기 순서를 외우기', code: (levels) => swapsCode(adjacentSwaps(rowOf(levels[0]))) + TO_EXIT },
    ],
  },

  // ───────────────────────────── 33
  {
    id: 'stage-33',
    part: 4,
    title: '거의 정렬된 줄',
    concept: '삽입 정렬 · 효율',
    goal: '거의 정렬된 석상 줄이에요. 저울이 빠듯하니 알맞은 정렬을 골라 세우세요!',
    hint: '1번부터 차례로, 왼쪽 이웃보다 가벼운 동안 한 칸씩 왼쪽으로 옮겨요(삽입 정렬). 제자리면 한 번만 재고 바로 다음으로!',
    note: '석상 순서는 실행할 때마다 바뀌어요. 이웃끼리만 바꿀 수 있고, 저울 = 삽입 정렬이 쓰는 만큼 + 1 번.',
    api: ALGO_API,
    seeds: [1, 5, 8],
    stars: { lines: 9 },
    map: (rng) => lineRoom(10 + rng.int(3), 'W', '='),
    adjacentOnly: true,
    barsRule: 'sorted',
    content: (rng, { items, rows }) => {
      const n = items.length;
      const base = distinctInts(rng, n, 10, 99);
      for (;;) {
        const row = [...base];
        const t = 1 + rng.int(2);
        for (let i = 0; i < t; i++) {
          const x = row.splice(rng.int(3), 1)[0];
          row.splice(n - 3 + rng.int(3), 0, x);
        }
        const ins = insertionCost(row).weigh;
        if (inversions(row) >= 3 && bubbleCost(row).weigh > ins + 1)
          return { row, weighLimit: ins + 1, maxTurns: inversions(row) + corridorWalk(rows) + 2 };
      }
    },
    concepts: [
      {
        name: '삽입 정렬',
        text: [
          '카드를 손에 쥘 때처럼, 하나씩 꺼내 이미 정렬된 앞부분의 알맞은 자리에 끼워 넣어요.',
          '왼쪽 이웃보다 작은 동안 한 칸씩 왼쪽으로 옮기고, 아니면 멈춰요.',
          '이미 거의 정렬된 데이터라면 대부분 한 번 비교하고 바로 멈추니까 아주 빨라요.',
        ],
        example:
          'a = [1, 2, 4, 5, 3]\nfor i in range(1, len(a)):\n    j = i\n    while j > 0 and a[j - 1] > a[j]:\n        a[j - 1], a[j] = a[j], a[j - 1]\n        j = j - 1\nprint(a)   # [1, 2, 3, 4, 5]',
        inGame: 'a[j - 1] > a[j] 는 heavier(j - 1, j), 바꾸기는 swap(j - 1, j)!',
      },
      {
        name: '알고리즘의 효율',
        text: [
          '같은 일을 하는 알고리즘도 비교·바꾸기를 몇 번 하는지가 달라요. 이것이 효율이에요.',
          '선택 정렬은 데이터가 어떻든 비교를 n(n − 1)/2 번 해요. 버블 정렬은 왼쪽 끝으로 가야 할 작은 값이 한 바퀴에 한 칸씩밖에 못 가요.',
          '삽입 정렬은 거의 정렬된 데이터에서 비교가 n 번 남짓이에요. 데이터 모양에 따라 알맞은 알고리즘이 달라요.',
        ],
        example: '# 석상 10개, 가벼운 석상 하나가 맨 끝에 있을 때 저울 수\n# 선택 정렬 45번\n# 버블 정렬 45번\n# 삽입 정렬 17번',
        inGame: '결과 화면에서 내 정렬과 세 정렬의 저울·바꾸기 횟수를 막대로 비교해 볼 수 있어요.',
      },
    ],
    starter: `# 석상이 거의 정렬되어 있어요. 저울은 "삽입 정렬이 쓰는 만큼 + 1" 번뿐!
# 삽입 정렬: 1번부터 차례로, 왼쪽 이웃보다 가벼우면 한 칸씩 왼쪽으로

j = 1
if heavier(j - 1, j):
    swap(j - 1, j)
print("석상", size(), "개 중 1번을 끼워 넣어 봤어요")
`,
    solution: `for i in range(1, size()):
    j = i
    while j > 0 and heavier(j - 1, j):
        swap(j - 1, j)
        j = j - 1
${TO_EXIT}`,
    bypasses: [
      {
        name: '버블 정렬 (바꾼 게 없으면 멈추기까지 넣어도)',
        code: `n = size()\nfor k in range(n - 1):\n    swapped = False\n    for i in range(n - 1 - k):\n        if heavier(i, i + 1):\n            swap(i, i + 1)\n            swapped = True\n    if not swapped:\n        break\n${TO_EXIT}`,
      },
      {
        name: '선택 정렬을 이웃 바꾸기로',
        code: `n = size()\nfor i in range(n - 1):\n    small = i\n    for j in range(i + 1, n):\n        if heavier(small, j):\n            small = j\n    while small > i:\n        swap(small - 1, small)\n        small = small - 1\n${TO_EXIT}`,
      },
      { name: '맵 1 의 바꾸기 순서를 외우기', code: (levels) => swapsCode(adjacentSwaps(rowOf(levels[0]))) + TO_EXIT },
    ],
  },

  // ───────────────────────────── 34
  {
    id: 'stage-34',
    part: 4,
    challenge: true,
    title: '하노이의 탑',
    concept: '재귀',
    goal: '원판을 모두 A → C 기둥으로 옮기세요. 큰 원판은 작은 원판 위에 못 놓아요!',
    hint: 'n 개를 옮기려면: 위의 n−1 개를 B 로, 가장 큰 것을 C 로, B 의 n−1 개를 C 로. 이 말을 그대로 자기 자신을 부르는 함수로 써요. n == 0 이면 멈춤!',
    note: '원판 수(3~5)는 실행할 때마다 바뀌어요. 턴 제한 = 2ⁿ − 1 + 걷기 + 2 (가장 적은 횟수로만 들어요).',
    api: ALGO_API,
    seeds: [1, 5, 8],
    stars: { lines: 10 },
    map: ['#############', '#...........#', '#.H...H...H.#', '#S........=E#', '#############'],
    barsRule: 'hanoi',
    content: (rng) => {
      const discs = 3 + rng.int(3);
      return { discs, maxTurns: 2 ** discs - 1 + 10 + 2 };
    },
    concepts: [
      {
        name: '재귀 함수',
        text: [
          '함수 안에서 자기 자신을 다시 부르는 것을 재귀라고 해요. 큰 문제를 "같은 모양의 작은 문제"로 줄여 풀어요.',
          '꼭 멈추는 조건(기저 사례)이 있어야 해요. 없으면 끝없이 불러서 오류가 나요.',
          '부를 때마다 문제가 작아져야 해요(n 에서 n − 1 로).',
        ],
        example: 'def countdown(n):\n    if n == 0:\n        print("발사!")\n        return\n    print(n)\n    countdown(n - 1)\n\ncountdown(3)   # 3 2 1 발사!',
        inGame: 'hanoi(n, 출발, 거쳐 갈 곳, 도착) 안에서 hanoi(n - 1, …) 를 두 번 부르고, 그 사이에 move_disc 한 번!',
      },
    ],
    starter: `# 원판을 모두 A 기둥에서 C 기둥으로! move_disc("A", "C") 처럼 맨 위 원판을 옮겨요(1턴).
# 큰 원판은 작은 원판 위에 놓을 수 없어요. 턴 제한 = 2ⁿ - 1 (+ 걷기)

print("원판", size(), "개")
move_disc("A", "C")
`,
    solution: `def hanoi(n, start, via, end):
    if n == 0:
        return
    hanoi(n - 1, start, end, via)
    move_disc(start, end)
    hanoi(n - 1, via, start, end)

hanoi(size(), "A", "B", "C")
${TO_EXIT}`,
    bypasses: [
      { name: '원판을 C 로 바로 옮기기', code: `for i in range(size()):\n    move_disc("A", "C")\n${TO_EXIT}` },
      {
        name: '맵 1 의 옮기는 순서를 외우기',
        code: (levels) => {
          const out: string[] = [];
          const h = (n: number, a: string, b: string, c: string) => {
            if (n === 0) return;
            h(n - 1, a, c, b);
            out.push(`move_disc("${a}", "${c}")`);
            h(n - 1, b, a, c);
          };
          h(levels[0].discs!, 'A', 'B', 'C');
          return out.join('\n') + '\n' + TO_EXIT;
        },
      },
    ],
  },

  // ───────────────────────────── 35
  {
    id: 'stage-35',
    part: 4,
    challenge: true,
    title: '통행료',
    concept: '탐욕 (그리디)',
    goal: '요금 문마다 통행료를 딱 맞게, 동전 수는 가장 적게 내세요. 동전 하나 = 1턴!',
    hint: '큰 동전부터: 500원을 낼 수 있는 만큼, 다음 100원, 50원, 10원. 문이 여러 개니 def pay_exact(fee): 로 만들어 두면 짧아요.',
    note: '통행료(610~2990원)와 문 개수는 실행할 때마다 바뀌어요. 넘치게 내면 경보! 동전은 500·100·50·10원.',
    api: ALGO_API,
    seeds: [1, 2, 3],
    stars: { lines: 11 },
    map: (rng) => {
      const k = 2 + rng.int(2);
      let lane = '#S';
      const signX: number[] = [];
      for (let i = 0; i < k; i++) {
        lane += '.'.repeat(2 + rng.int(3));
        signX.push(lane.length - 1);
        lane += '$';
      }
      lane += '..E#';
      const top = [...'#'.repeat(lane.length)];
      for (const x of signX) top[x] = 'T';
      return ['#'.repeat(lane.length), top.join(''), lane, '#'.repeat(lane.length)];
    },
    content: (rng, { tolls, rows }) => {
      const fees = tolls.map(() => 610 + 10 * rng.int(239));
      const coins = fees.reduce((n, f) => n + greedyCoins(f, COINS), 0);
      return { tolls: fees, signs: fees.map(String), maxTurns: coins + corridorWalk(rows) + 2 };
    },
    concepts: [
      {
        name: '탐욕 알고리즘 (그리디)',
        text: [
          '탐욕 알고리즘은 매번 "지금 가장 좋아 보이는 것"을 고르는 방법이에요. 동전이라면 낼 수 있는 가장 큰 동전부터 내요.',
          '우리 동전(500·100·50·10원)은 큰 동전이 작은 동전의 배수라서, 큰 것부터 내면 동전 수가 가장 적어요.',
          '생각해 보기: 동전이 1·4·6원이면 8원은 6+1+1(3개)보다 4+4(2개)가 적어요. 탐욕이 늘 최선은 아니에요!',
        ],
        example: 'fee = 1730\nfor coin in [500, 100, 50, 10]:\n    while fee >= coin:\n        print(coin)\n        fee = fee - coin\n# 500 500 500 100 100 10 10 10',
        inGame: 'print(coin) 대신 pay(coin)! 요금 문 앞에서 read("up") 으로 통행료를 읽어요.',
      },
    ],
    starter: `# 요금 문 위 표지판에 통행료가 적혀 있어요. pay(동전) 으로 동전 하나씩 내요(1턴).
# 동전: 500, 100, 50, 10. 넘치게 내면 경보! 동전 수를 가장 적게 내야 턴이 맞아요.

while look("right") != "toll":
    move_right()
fee = int(read("up"))
print("통행료:", fee)
`,
    solution: `def pay_exact(fee):
    for coin in [500, 100, 50, 10]:
        while fee >= coin:
            pay(coin)
            fee = fee - coin

while look("right") != "exit":
    if look("right") == "toll":
        pay_exact(int(read("up")))
    move_right()
move_right()
`,
    bypasses: [
      {
        name: '10원짜리로만 내기',
        code: `while look("right") != "exit":\n    if look("right") == "toll":\n        fee = int(read("up"))\n        for i in range(fee // 10):\n            pay(10)\n    move_right()\nmove_right()\n`,
      },
      {
        name: '맵 1 의 통행료를 외우기',
        code: (levels) =>
          `fees = ${JSON.stringify(levels[0].tolls!.map((t) => t.fee))}\nk = 0\nwhile look("right") != "exit":\n    if look("right") == "toll":\n        fee = fees[k % len(fees)]\n        k = k + 1\n        for coin in [500, 100, 50, 10]:\n            while fee >= coin:\n                pay(coin)\n                fee = fee - coin\n    move_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 36
  {
    id: 'stage-36',
    part: 4,
    challenge: true,
    title: '보물 동굴',
    concept: '깊이 우선 탐색',
    goal: '지도 없이 동굴을 더듬어 상자를 모두 열면 시작점 왼쪽 창살이 열려요.',
    hint: 'explore() 안에서 네 방향마다: 옆 칸 좌표를 계산해 아직 안 가 본 칸이면 seen 에 적고, 그쪽으로 가서 explore() 를 부르고, 돌아오면 반대 방향으로 한 칸 되돌아와요.',
    note: '동굴 모양과 상자 위치는 실행할 때마다 바뀌어요. 턴 제한 = 2 × (갈 수 있는 칸 수 − 1) + 5. 이미 가 본 칸에 들어갔다 나오면 턴이 모자라요.',
    api: ALGO_API.filter((n) => n !== 'get_map'),
    seeds: [1, 2, 3],
    stars: { lines: 15 },
    map: caveMap,
    maxTurns: (rows) => 2 * (reachable(rows).length - 1) + 5,
    barsRule: 'chests',
    concepts: [
      {
        name: '깊이 우선 탐색 · 되돌아가기',
        text: [
          '깊이 우선 탐색(DFS)은 한 길로 갈 수 있는 데까지 깊이 들어갔다가, 막히면 갈림길로 되돌아와 다른 길로 가요.',
          '재귀로 쓰면 "되돌아오기"가 저절로 돼요. 함수가 끝나면 부른 곳으로 돌아오니까요.',
          '가 본 칸을 적어 두지 않으면(방문 표시) 고리에서 빙빙 돌아요.',
          '27번의 너비 우선 탐색(BFS)은 가까운 칸부터 퍼지고, DFS 는 한 길로 끝까지 가요.',
        ],
        example:
          'seen = []\ndef dfs(here):\n    seen.append(here)\n    for nxt in 이웃(here):\n        if nxt not in seen:\n            가기(nxt)\n            dfs(nxt)\n            되돌아오기()',
        inGame: '마법사가 직접 걸으며 DFS! 옆 칸 좌표 = 지금 좌표 + 방향. 다녀오면 반대 방향으로 한 칸 되돌아와요.',
      },
    ],
    starter: `# 보물상자를 모두 열면 시작점 왼쪽의 창살이 열려요. get_map() 은 없어요. 더듬어 찾아요!
# 턴 제한 = 2 × (갈 수 있는 칸 - 1) + 5. 한 길로 끝까지 갔다가 되돌아오는 깊이 우선 탐색!

step = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
back = {"up": "down", "down": "up", "left": "right", "right": "left"}
seen = [get_pos()]
for d in step:
    print(d, look(d))
`,
    solution: `step = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
back = {"up": "down", "down": "up", "left": "right", "right": "left"}
seen = [get_pos()]

def explore():
    x, y = get_pos()
    for d in step:
        nxt = (x + step[d][0], y + step[d][1])
        if look(d) in ["empty", "chest"] and nxt not in seen:
            seen.append(nxt)
            move(d)
            explore()
            move(back[d])

explore()
move_left()
move_left()
`,
    bypasses: [
      {
        name: '오른손을 벽에 대고 걷기 (상자도 지나감)',
        code: `dirs = ["up", "right", "down", "left"]\nh = 1\nwhile True:\n    r = (h + 1) % 4\n    if look(dirs[r]) in ["empty", "exit", "chest"]:\n        h = r\n    elif look(dirs[h]) not in ["empty", "exit", "chest"]:\n        h = (h + 3) % 4\n        continue\n    move(dirs[h])\n`,
      },
      {
        name: '들어가 본 뒤에야 가 본 칸인지 확인하기',
        code: `back = {"up": "down", "down": "up", "left": "right", "right": "left"}\nseen = []\ndef explore():\n    seen.append(get_pos())\n    for d in ["up", "down", "left", "right"]:\n        if look(d) in ["empty", "chest"]:\n            move(d)\n            if get_pos() in seen:\n                move(back[d])\n            else:\n                explore()\n                move(back[d])\nexplore()\nmove_left()\nmove_left()\n`,
      },
      { name: '맵 1 의 길을 외우기', code: (levels) => caveRouteCode(levels[0]) },
    ],
  },
];
