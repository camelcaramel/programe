// 3부: stage-19 ~ stage-27 + 비계 22a·25a·26a (화면 번호 25~36). 객체 · 딕셔너리 · 클래스 · 2차원 리스트 · 탐색 (PART3.md)
// 변이 몬스터(유령 o·거미 x·게 q·미믹 m)의 HP·약점은 content() 가 시드마다 정하고, 계획 화면에서는 보이지 않는다.
// solution / bypasses 는 학생에게 보이지 않고, 테스트(stages.test.ts)가 "정답은 통과, 우회는 실패"를 확인한다.
import { SKILLS, type Level, type MonsterKind, type MonsterMutation, type Rng, type Skill } from '../sim';
import { loopyMaze, movesCode, pathOf } from './maze';
import { CLASS_API, MAP_API, OBJ_API, type StageInfo } from './types';

/** 3부에서 새로 나오는 변이 몬스터 (미믹은 따로) */
const VARIANTS = ['o', 'x', 'q'] as const;

/** 서로 다른 정수 n 개를 [lo, hi] 에서 (작은 것부터) */
function distinctInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    const v = lo + rng.int(hi - lo + 1);
    if (!out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

/** 몬스터 변이: 같은 시드 안에서는 같은 종류끼리 약점이 같고, HP 는 마리마다 hp 중에서 */
function mutate(rng: Rng, monsters: { kind: MonsterKind }[], hp: number[] = [2, 4]): MonsterMutation[] {
  const weak = new Map<MonsterKind, Skill>();
  return monsters.map((m) => {
    if (!weak.has(m.kind)) weak.set(m.kind, rng.pick(SKILLS));
    return { hp: rng.pick(hp), weak: weak.get(m.kind)! };
  });
}

const casts = (muts: MonsterMutation[]) => muts.reduce((n, m) => n + Math.ceil(m.hp / 2), 0);

/** 맵 1 의 "종류 → 약점" 표를 if/elif 로 외운 풀이 (우회 풀이 테스트용) */
function tableCode(levels: Level[], kindOf = 'look("right")'): string {
  const table = new Map(levels[0].monsters.map((m) => [m.kind === 'mimic' ? 'chest' : m.kind, m.weak]));
  let c = `while look("right") != "exit":\n    k = ${kindOf}\n    if k == "empty":\n        move_right()\n`;
  for (const [k, w] of table) c += `    elif k == "${k}":\n        cast("${w}", "right")\n`;
  return c + '    else:\n        cast("fireball", "right")\nmove_right()\n';
}

/** 마법사 쪽 공통: 창살 앞에서 기다렸다가 출구까지 */
const WALK_TO_EXIT = `while look("right") != "exit":
    if look("right") == "bars":
        wait()
    else:
        move_right()
move_right()
`;

/** 바닥 줄(창살 2칸 + 출구)을 붙인 로봇 맵의 마법사 줄 (폭 13) */
const WIZ_ROW = '#S..==.....E#';
/** 마법사가 창살 앞(x=3)에서 출구(x=11)까지 가는 데 드는 턴 */
const WIZ_CROSS = 8;

/** 맵에서 그 문자가 있는 모든 칸 (위→아래, 왼→오른 순서) */
function find(rows: string[], ch: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === ch && out.push({ x, y })));
  return out;
}

export const PART3: StageInfo[] = [
  // ───────────────────────────── 19
  {
    id: 'stage-19',
    part: 3,
    title: '몬스터 도감',
    concept: '객체 · 속성',
    goal: '몬스터 3마리를 약점 마법으로 처치하고 출구로!',
    hint: 'm = scan("right") 로 몬스터 객체를 받고, cast(m.weak, "right") 처럼 점(.)으로 약점을 꺼내 써요.',
    note: '같은 종류도 맵마다 약점이 달라요. 약점이 아닌 마법을 맞히면 몬스터가 반격해서 HP 가 1 줄어요.',
    api: OBJ_API,
    seeds: [1, 2, 3],
    maxTurns: 20,
    stars: { lines: 8 },
    map: (rng) => {
      const cells = [...'#S..........E#'];
      for (const x of distinctInts(rng, 3, 2, 11)) cells[x] = rng.pick(VARIANTS);
      return ['##############', cells.join(''), '##############'];
    },
    content: (rng, { monsters }) => ({ monsters: mutate(rng, monsters) }),
    concepts: [
      {
        name: '객체와 속성',
        text: [
          '객체(object)는 여러 정보를 한 덩어리로 묶은 값이에요.',
          '객체 안의 정보를 속성(attribute)이라고 하고, 객체.속성 처럼 점(.)으로 꺼내요.',
          'scan() 이 돌려주는 몬스터 객체에는 kind(종류), hp, max_hp, weak(약점 마법) 속성이 있어요.',
        ],
        example: 'm = scan("right")\nprint(m.kind)   # ghost\nprint(m.weak)   # lightning',
        inGame: '이번 던전의 몬스터는 약점이 실행마다 바뀌어요. 외우지 말고 cast(m.weak, "right") 로 읽어서 쓰세요!',
      },
    ],
    starter: `# 3부 시작! 몬스터의 약점이 실행할 때마다 바뀌어요(변이).
# 약점이 아닌 마법을 맞히면 몬스터가 반격해요 (HP -1).
# scan(방향) 은 옆 칸 몬스터를 "객체"로 알려 줘요. 점(.)으로 속성을 꺼내 보세요.

while look("right") == "empty":
    move_right()
m = scan("right")
print(m.kind, m.hp, m.weak)
`,
    solution: `while look("right") != "exit":
    if look("right") == "empty":
        move_right()
    else:
        m = scan("right")
        cast(m.weak, "right")
move_right()
`,
    bypasses: [
      { name: '맵 1 의 "종류 → 마법" 표를 외워서 쓰기', code: (levels) => tableCode(levels) },
      {
        name: '언제나 불 마법',
        code: `while look("right") != "exit":\n    if look("right") == "empty":\n        move_right()\n    else:\n        cast("fireball", "right")\nmove_right()\n`,
      },
      {
        name: '마법을 차례로 다 넣어 보기',
        code: `while look("right") != "exit":\n    if look("right") == "empty":\n        move_right()\n    else:\n        for s in ["fireball", "icebolt", "lightning"]:\n            if look("right") != "empty":\n                cast(s, "right")\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 20
  {
    id: 'stage-20',
    part: 3,
    title: '미믹 주의',
    concept: 'None · is None',
    goal: '진짜 상자는 모두 열고, 상자인 척하는 "미믹"은 약점 마법으로 처치해요.',
    hint: 'look() 은 미믹도 "chest" 라고 해요. m = scan("right") 가 None 이면 진짜 상자, 아니면 미믹이에요. if m is None: 으로 갈라 보세요.',
    note: '미믹의 위치와 약점은 실행할 때마다 바뀌어요. 미믹에 부딪히면 덥석! HP 가 3 줄어요.',
    api: OBJ_API,
    seeds: [1, 2, 3],
    maxTurns: 22,
    stars: { lines: 7 },
    map: (rng) => {
      const cells = [...'#S...........E#'];
      const boxes = distinctInts(rng, 4 + rng.int(2), 2, 12);
      const mimics = new Set(distinctInts(rng, 1 + rng.int(2), 0, boxes.length - 1));
      boxes.forEach((x, i) => (cells[x] = mimics.has(i) ? 'm' : 'c'));
      return ['###############', cells.join(''), '###############'];
    },
    content: (rng, { monsters }) => ({ monsters: mutate(rng, monsters) }),
    concepts: [
      {
        name: 'None 과 is None',
        text: [
          'None 은 "아무것도 없음"을 나타내는 특별한 값이에요.',
          'scan() 은 그쪽에 몬스터가 없으면 None 을 돌려줘요.',
          'None 인지 알아볼 때는 == 대신 is 를 써요: m is None, m is not None',
          'None 에서 속성을 꺼내면(None.weak) 오류가 나요. 먼저 확인!',
        ],
        example: 'm = scan("right")\nif m is None:\n    print("몬스터 없음")\nelse:\n    print(m.kind)',
        inGame: '미믹은 겉보기엔 상자예요. scan() 이 None 이면 진짜 상자니까 열고, 아니면 cast(m.weak, ...)!',
      },
    ],
    starter: `# 상자 중 몇 개는 미믹(상자인 척하는 몬스터)이에요. 부딪히면 HP -3!
# look() 은 미믹도 "chest" 라고 해요. scan() 은 진짜 상자면 None 을 돌려줘요.

while look("right") == "empty":
    move_right()
m = scan("right")
print(m)
print(m is None)
`,
    solution: `while look("right") != "exit":
    m = scan("right")
    if m is None:
        move_right()
    else:
        cast(m.weak, "right")
move_right()
`,
    bypasses: [
      { name: '상자는 그냥 밟고 지나가기', code: `while look("right") != "exit":\n    move_right()\nmove_right()\n` },
      {
        name: '맵 1 의 미믹 자리와 약점을 외우기',
        code: (levels) => {
          const l = levels[0];
          let c = '';
          for (let x = l.start.x + 1; x < l.width - 1; x++) {
            const m = l.monsters.find((m) => m.x === x);
            if (m) for (let i = 0; i < Math.ceil((m.hp ?? 2) / 2); i++) c += `cast("${m.weak}", "right")\n`;
            c += 'move_right()\n';
          }
          return c;
        },
      },
      {
        name: '상자마다 마법을 차례로 다 넣어 보기',
        code: `while look("right") != "exit":\n    if look("right") == "chest":\n        for s in ["fireball", "icebolt", "lightning"]:\n            cast(s, "right")\n    move_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 21
  {
    id: 'stage-21',
    part: 3,
    title: '약한 쪽 길',
    concept: '객체 비교',
    goal: '위·아래 길 중 몬스터 HP 가 적은 쪽을 뚫고 출구로!',
    hint: 'up = scan("up"), down = scan("down") 으로 두 객체를 담아 두고 up.hp 와 down.hp 를 비교해요. m.hp 는 읽을 때마다 지금 HP 를 알려 줘요.',
    note: '몬스터의 HP·약점은 실행할 때마다 바뀌어요. 턴 제한 = 약한 쪽을 처치하고 지나가는 턴 + 1.',
    api: OBJ_API,
    seeds: [1, 2, 3],
    stars: { lines: 18 },
    map: (rng) => [
      '##########',
      `#${rng.pick(VARIANTS)}.....###`,
      '#S####..E#',
      `#${rng.pick(VARIANTS)}.....###`,
      '##########',
    ],
    content: (rng, { monsters }) => {
      const base = mutate(rng, monsters);
      const [a, b] = rng.pick([
        [2, 6],
        [2, 8],
        [4, 8],
      ]);
      const hp = rng.int(2) === 0 ? [a, b] : [b, a];
      const muts = base.map((m, i) => ({ ...m, hp: hp[i] }));
      // 걷기 9턴 + 약한 쪽 처치 + 여유 1
      return { monsters: muts, maxTurns: 9 + Math.min(...hp) / 2 + 1 };
    },
    concepts: [
      {
        name: '객체를 변수에 담아 비교하기',
        text: [
          '객체도 숫자·글자처럼 변수에 담아 둘 수 있어요.',
          '담아 둔 두 객체의 속성을 꺼내 < > == 로 비교해서 하나를 고를 수 있어요.',
          'scan() 이 준 몬스터 객체의 hp 는 읽을 때마다 지금 HP 예요. 마법을 맞히면 줄어든 값이 보여요.',
        ],
        example: 'a = scan("up")\nb = scan("down")\nif a.hp < b.hp:\n    print("위가 더 약해요")',
        inGame: 'm 에 약한 쪽 몬스터를 담아 두면 while m.hp > 0: cast(m.weak, d) 로 끝까지 처치할 수 있어요.',
      },
    ],
    starter: `# 위·아래 두 길 중 몬스터가 약한 쪽으로 가야 턴이 맞아요.
# 두 몬스터를 변수에 담아 두고 비교해 보세요.

up = scan("up")
down = scan("down")
print("위:", up)
print("아래:", down)
`,
    solution: `up = scan("up")
down = scan("down")
m = up
d = "up"
if down.hp < up.hp:
    m = down
    d = "down"
while m.hp > 0:
    cast(m.weak, d)
move(d)
for i in range(5):
    move_right()
if d == "up":
    move_down()
else:
    move_up()
move_right()
move_right()
`,
    bypasses: [
      {
        name: '늘 위 길',
        code: `m = scan("up")\nwhile m.hp > 0:\n    cast(m.weak, "up")\nmove_up()\nfor i in range(5):\n    move_right()\nmove_down()\nmove_right()\nmove_right()\n`,
      },
      {
        name: '늘 아래 길',
        code: `m = scan("down")\nwhile m.hp > 0:\n    cast(m.weak, "down")\nmove_down()\nfor i in range(5):\n    move_right()\nmove_up()\nmove_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 22
  {
    id: 'stage-22',
    part: 3,
    title: '도감 노트',
    concept: '딕셔너리',
    goal: '몬스터를 모두 처치하고 출구로! 수정구(scan)는 몬스터 "종류 수"만큼만 쓸 수 있어요.',
    hint: 'book = {} 을 만들고, 처음 보는 종류일 때만 book[kind] = scan("right").weak 로 적어 둬요. 그다음부터는 cast(book[kind], "right")!',
    note: '같은 종류는 약점이 같아요(이번 맵 안에서만). 약점과 몬스터 배치는 실행할 때마다 바뀌어요.',
    api: OBJ_API,
    seeds: [1, 2, 3],
    maxTurns: 36,
    stars: { lines: 10 },
    scanLimit: (rows) => new Set([...rows.join('')].filter((c) => (VARIANTS as readonly string[]).includes(c))).size,
    map: (rng) => {
      const cells = [...'#S.................E#'];
      const xs = distinctInts(rng, 6 + rng.int(2), 2, 18);
      // 세 종류가 모두 나오고, 같은 종류가 여러 번 나오도록
      const kinds = xs.map((_, i) => (i < 3 ? VARIANTS[i] : rng.pick(VARIANTS)));
      for (let i = kinds.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
      }
      xs.forEach((x, i) => (cells[x] = kinds[i]));
      return ['#####################', cells.join(''), '#####################'];
    },
    content: (rng, { monsters }) => ({ monsters: mutate(rng, monsters) }),
    concepts: [
      {
        name: '딕셔너리',
        text: [
          '딕셔너리(dict)는 "이름표(키) → 값" 짝을 모아 두는 자료형이에요. 빈 딕셔너리는 {} 예요.',
          'book["ghost"] = "lightning" 처럼 키로 값을 넣고, book["ghost"] 로 꺼내요.',
          '키가 있는지는 "ghost" in book 으로 알아봐요. 없는 키를 꺼내면 오류!',
        ],
        example: 'book = {}\nbook["ghost"] = "lightning"\nprint("ghost" in book)   # True\nprint(book["ghost"])     # lightning',
        inGame: '처음 보는 종류만 scan() 하고 book[kind] 에 적어 두면, 수정구를 아끼면서 모든 몬스터를 처치할 수 있어요.',
      },
    ],
    starter: `# 수정구(scan)는 이번 맵의 몬스터 "종류 수"만큼만 쓸 수 있어요!
# 딕셔너리: 이름표(키)로 값을 적어 두는 노트예요.

book = {}
book["ghost"] = "fireball"
print(book)
print("ghost" in book, "crab" in book)
`,
    solution: `book = {}
while look("right") != "exit":
    kind = look("right")
    if kind == "empty":
        move_right()
    else:
        if kind not in book:
            book[kind] = scan("right").weak
        cast(book[kind], "right")
move_right()
`,
    bypasses: [
      {
        name: '몬스터마다 scan',
        code: `while look("right") != "exit":\n    if look("right") == "empty":\n        move_right()\n    else:\n        m = scan("right")\n        cast(m.weak, "right")\nmove_right()\n`,
      },
      { name: '맵 1 의 "종류 → 마법" 표를 외워서 쓰기', code: (levels) => tableCode(levels) },
    ],
  },

  // ───────────────────────────── 22a (비계: 메서드 하나뿐인 클래스)
  {
    id: 'stage-22a',
    part: 3,
    title: '설계도 한 장',
    concept: '클래스 첫걸음',
    goal: '클래스로 로봇을 움직여 복도 끝 발판에 세우면 창살이 열려요.',
    hint: 'act(self) 안에서 get_bots()[0].move("right") 로 로봇을 한 칸 움직여요. 발판은 복도 끝이라, 계속 걸어도 발판 위에 멈춰 서요.',
    note: '복도 길이는 실행할 때마다 바뀌어요. 발판은 look() 으로는 보이지 않아요.',
    api: CLASS_API,
    seeds: [1, 2, 3],
    stars: { lines: 11 },
    map: (rng) => {
      const p = 4 + rng.int(7); // 발판 x (로봇은 x=1)
      const lane = ('#R' + '.'.repeat(p - 2) + 'P').padEnd(13, '#');
      return ['#############', lane, '#############', WIZ_ROW, '#############'];
    },
    maxTurns: (rows) => find(rows, 'P')[0].x - 1 + WIZ_CROSS + 2,
    concepts: [
      {
        name: '클래스와 메서드',
        text: [
          '클래스(class)는 객체를 찍어 내는 틀(설계도)이에요. Walker() 처럼 부르면 새 객체가 만들어져요.',
          '클래스 안에 만든 함수를 메서드라고 해요. 메서드는 첫 매개변수로 self(나 자신, 이 객체)를 받아요.',
          '객체.메서드() 로 부르면 그 객체의 메서드가 실행돼요.',
        ],
        example: 'class Greeter:\n    def hello(self):\n        print("안녕!")\n\ng = Greeter()\ng.hello()   # 안녕!',
        inGame: 'hire(Walker()) 로 고용하면, 내가 한 턴을 쓸 때마다 그 객체의 act() 가 한 번씩 불려요.',
      },
    ],
    starter: `# 클래스(class)는 객체를 찍어 내는 틀이에요. Walker() 로 객체를 하나 만들어요.
# hire(객체) 로 고용하면, 내가 한 턴을 쓸 때마다 그 객체의 act() 가 한 번씩 불려요.
# 지금 act() 는 말만 해요. 로봇을 오른쪽으로 한 칸 움직이게 고쳐 보세요.
# 로봇 목록은 get_bots(), 첫 번째 로봇은 get_bots()[0] 이에요.

class Walker:
    def act(self):
        print("로봇 차례!")

hire(Walker())
${WALK_TO_EXIT}`,
    solution: `class Walker:
    def act(self):
        get_bots()[0].move("right")

hire(Walker())
${WALK_TO_EXIT}`,
    bypasses: [
      { name: '클래스 없이 로봇을 직접 움직이기', code: `bot = get_bots()[0]\nfor i in range(12):\n    bot.move("right")\n${WALK_TO_EXIT}` },
      { name: 'hire 에 함수 넣기', code: `def act():\n    get_bots()[0].move("right")\nhire(act)\n${WALK_TO_EXIT}` },
    ],
  },

  // ───────────────────────────── 23
  {
    id: 'stage-23',
    part: 3,
    title: '첫 로봇',
    concept: '__init__ · self 속성',
    goal: '클래스로 로봇을 발판 위에 세우면 창살이 열려요.',
    hint: '__init__ 에서 self.left = int(bot.read("up")) 로 걸음 수를 담고, act() 에서 self.left 가 0 보다 클 때만 움직이고 1 씩 줄여요.',
    note: '발판 위치(걸음 수)는 실행할 때마다 바뀌어요. 발판은 look() 으로는 보이지 않아요. 로봇이 발판을 지나치면 창살이 다시 닫혀요.',
    api: CLASS_API,
    seeds: [1, 2, 8],
    stars: { lines: 15 },
    map: (rng) => {
      const lane = [...'#R.........#'];
      lane[1 + 3 + rng.int(6)] = 'P';
      return ['#############', '#T###########', lane.join('') + '#', '#############', WIZ_ROW, '#############'];
    },
    maxTurns: (rows) => find(rows, 'P')[0].x - 1 + WIZ_CROSS + 2,
    content: (_rng, { rows }) => ({ signs: [String(find(rows, 'P')[0].x - find(rows, 'R')[0].x)] }),
    concepts: [
      {
        name: '__init__ 과 self.속성',
        text: [
          '__init__ 은 객체가 만들어질 때 한 번 불리는 메서드예요. Robot(bot) 의 괄호 안 값이 __init__ 의 매개변수로 들어가요.',
          '객체가 기억할 값은 self.이름 = 값 으로 담아요. 이것을 속성이라고 해요.',
          'self.left 처럼 객체에 담은 값은 메서드가 끝나도 남아 있어서, 다음에 불릴 때 이어서 쓸 수 있어요.',
        ],
        example:
          'class Counter:\n    def __init__(self, start):\n        self.n = start\n\n    def tick(self):\n        self.n = self.n - 1\n\nc = Counter(3)\nc.tick()\nprint(c.n)   # 2',
        inGame: 'hire(Robot(bot)) 로 고용하면 내가 한 턴을 쓸 때마다 그 객체의 act() 가 불려요. 남은 걸음 수는 self.left 에 기억!',
      },
    ],
    starter: `# 로봇은 내가 만든 "클래스"의 객체가 조종해요.
# hire(객체) 로 고용하면, 내가 한 턴을 쓸 때마다 그 객체의 act() 가 한 번씩 불려요.
# 로봇 위 표지판에 발판까지 걸음 수가 적혀 있어요. 발판을 지나치면 창살이 다시 닫혀요!

class Robot:
    def __init__(self, bot):
        self.bot = bot   # 이 객체가 조종할 로봇

    def act(self):
        self.bot.move("right")

hire(Robot(get_bots()[0]))
${WALK_TO_EXIT}`,
    solution: `class Robot:
    def __init__(self, bot):
        self.bot = bot
        self.left = int(bot.read("up"))

    def act(self):
        if self.left > 0:
            self.bot.move("right")
            self.left = self.left - 1

hire(Robot(get_bots()[0]))
${WALK_TO_EXIT}`,
    bypasses: [
      {
        name: '세지 않고 계속 걷기',
        code: `class Robot:\n    def __init__(self, bot):\n        self.bot = bot\n\n    def act(self):\n        self.bot.move("right")\n\nhire(Robot(get_bots()[0]))\n${WALK_TO_EXIT}`,
      },
      {
        name: '맵 1 의 걸음 수를 코드에 쓰기',
        code: (levels) =>
          `class Robot:\n    def __init__(self, bot):\n        self.bot = bot\n        self.left = ${levels[0].signs[0].value}\n\n    def act(self):\n        if self.left > 0:\n            self.bot.move("right")\n            self.left = self.left - 1\n\nhire(Robot(get_bots()[0]))\n${WALK_TO_EXIT}`,
      },
      { name: '클래스 없이 로봇을 직접 움직이기', code: `bot = get_bots()[0]\nfor i in range(int(bot.read("up"))):\n    bot.move("right")\n${WALK_TO_EXIT}` },
      { name: 'hire 에 함수 넣기', code: `bot = get_bots()[0]\ndef act():\n    bot.move("right")\nhire(act)\n${WALK_TO_EXIT}` },
    ],
  },

  // ───────────────────────────── 24
  {
    id: 'stage-24',
    part: 3,
    title: '로봇 부대',
    concept: '인스턴스 여러 개',
    goal: '모든 로봇이 자기 발판에 "동시에" 서 있으면 창살이 열려요.',
    hint: 'for b in get_bots(): hire(Robot(b)) 로 로봇마다 Robot 객체를 하나씩 만들어요. 객체마다 자기 self.left 를 따로 기억해요.',
    note: '로봇 수(2~4대)와 발판 깊이는 실행할 때마다 바뀌어요.',
    api: CLASS_API,
    seeds: [1, 7, 11],
    stars: { lines: 16 },
    map: (rng) => {
      const n = 2 + rng.int(3);
      const rows = ['#############', '#############'];
      for (let y = 0; y < 7; y++) rows.push('#############');
      const g = rows.map((r) => [...r]);
      for (let i = 0; i < n; i++) {
        const x = 1 + i * 2;
        g[1][x] = 'T';
        g[2][x] = 'R';
        for (let y = 3; y <= 8; y++) g[y][x] = '.';
        g[2 + 2 + rng.int(5)][x] = 'P';
      }
      return [...g.map((r) => r.join('')), '#############', WIZ_ROW, '#############'];
    },
    maxTurns: (rows) => Math.max(...find(rows, 'P').map((p) => p.y - 2)) + WIZ_CROSS + 2,
    content: (_rng, { rows }) => ({ signs: find(rows, 'P').sort((a, b) => a.x - b.x).map((p) => String(p.y - 2)) }),
    concepts: [
      {
        name: '인스턴스 여러 개',
        text: [
          '한 클래스로 객체를 여러 개 만들 수 있어요. 이렇게 만든 객체 하나하나를 인스턴스(instance)라고 해요.',
          '인스턴스마다 self 가 달라서, self.left 같은 값도 각자 따로 기억해요.',
          '몇 개를 만들지 모를 때는 반복문으로 만들어서 리스트에 담거나 바로 써요.',
        ],
        example:
          'a = Counter(3)\nb = Counter(5)\na.tick()\nprint(a.n, b.n)   # 2 5\n\nteam = []\nfor n in [1, 2, 3]:\n    team.append(Counter(n))',
        inGame: '로봇마다 발판까지 걸음 수가 달라요. 로봇 수만큼 Robot 객체를 만들어 각자 세게 하세요.',
      },
    ],
    starter: `# 로봇이 여러 대예요(맵마다 2~4대). get_bots() 는 로봇 리스트를 돌려줘요.
# 로봇 위 표지판에는 그 로봇의 발판까지 걸음 수가 적혀 있어요.

class Robot:
    def __init__(self, bot):
        self.bot = bot
        self.left = int(bot.read("up"))

    def act(self):
        if self.left > 0:
            self.bot.move("down")
            self.left = self.left - 1

bots = get_bots()
print(len(bots), "대")
hire(Robot(bots[0]))
${WALK_TO_EXIT}`,
    solution: `class Robot:
    def __init__(self, bot):
        self.bot = bot
        self.left = int(bot.read("up"))

    def act(self):
        if self.left > 0:
            self.bot.move("down")
            self.left = self.left - 1

for b in get_bots():
    hire(Robot(b))
${WALK_TO_EXIT}`,
    bypasses: [
      {
        name: '모두가 같이 쓰는 클래스 변수 하나로 세기',
        code: `class Robot:\n    left = 0\n    def __init__(self, bot):\n        self.bot = bot\n        Robot.left = int(bot.read("up"))\n\n    def act(self):\n        if Robot.left > 0:\n            self.bot.move("down")\n            Robot.left = Robot.left - 1\n\nfor b in get_bots():\n    hire(Robot(b))\n${WALK_TO_EXIT}`,
      },
      {
        name: '맵 1 의 걸음 수를 차례로 외우기',
        code: (levels) =>
          `steps = ${JSON.stringify(levels[0].signs.map((s) => Number(s.value)))}\nclass Robot:\n    def __init__(self, bot, n):\n        self.bot = bot\n        self.left = n\n\n    def act(self):\n        if self.left > 0:\n            self.bot.move("down")\n            self.left = self.left - 1\n\nbots = get_bots()\nfor i in range(len(steps)):\n    if i < len(bots):\n        hire(Robot(bots[i], steps[i]))\n${WALK_TO_EXIT}`,
      },
    ],
  },

  // ───────────────────────────── 25
  {
    id: 'stage-25',
    part: 3,
    title: '사냥 로봇',
    concept: '상태에 따라 행동',
    goal: '로봇들이 통로의 몬스터를 모두 처치하면 창살이 열려요.',
    hint: 'self.dir 에 지금 가는 방향을 기억하고, 벽에 닿으면 반대로 바꿔요. 몬스터는 self.bot.scan(self.dir) 로 보고 약점 마법을!',
    note: '통로 길이, 로봇 위치, 몬스터의 위치·약점은 실행할 때마다 바뀌어요. 약점이 아닌 마법을 쓴 로봇은 반격을 받아 고장 나요.',
    api: CLASS_API,
    seeds: [1, 2, 3],
    stars: { lines: 20 },
    map: (rng) => {
      const lanes = 2 + rng.int(2);
      const rows = ['#############'];
      for (let i = 0; i < lanes; i++) {
        const len = 7 + rng.int(4); // 통로 칸 x = 1..len
        const bx = 3 + rng.int(len - 4); // 3..len-2
        const lane = [...'#'.repeat(13)];
        for (let x = 1; x <= len; x++) lane[x] = '.';
        lane[bx] = 'R';
        const left = distinctInts(rng, Math.min(1 + rng.int(2), bx - 1), 1, bx - 1);
        const right = distinctInts(rng, Math.min(1 + rng.int(2), len - bx), bx + 1, len);
        for (const x of [...left, ...right]) lane[x] = rng.pick(VARIANTS);
        rows.push(lane.join(''), '#############');
      }
      return [...rows, WIZ_ROW, '#############'];
    },
    content: (rng, { rows, monsters }) => {
      const muts = mutate(rng, monsters);
      // 통로마다 "먼저 왼쪽으로 끝까지 갔다가 돌아오기"와 "먼저 오른쪽으로"에 드는 턴 중 큰 쪽.
      // 처치가 끝나는 턴 + 마법사가 창살을 지나 출구까지(9턴) + 여유 2
      let need = 0;
      for (const r of find(rows, 'R')) {
        const last = [...rows[r.y]].reduce((m, c, x) => (c !== '#' ? x : m), 0);
        const lane = monsters.map((m, i) => ({ m, i })).filter(({ m }) => m.y === r.y);
        const xs = lane.map(({ m }) => m.x);
        const c = casts(lane.map(({ i }) => muts[i]));
        const leftFirst = r.x - 1 + 1 + (Math.max(...xs) - 2) + c;
        const rightFirst = last - r.x + 1 + (last - Math.min(...xs) - 1) + c;
        need = Math.max(need, leftFirst, rightFirst);
      }
      return { monsters: muts, maxTurns: need + WIZ_CROSS + 1 + 2 };
    },
    concepts: [
      {
        name: '상태에 따라 다르게 행동하기',
        text: [
          '객체는 지금 어떤 상황인지(상태)를 속성에 기억해 둘 수 있어요. 예: self.dir = "left"',
          '메서드는 그 상태를 보고 다르게 행동하고, 필요하면 상태를 바꿔요.',
          '로봇마다 상태가 따로 있어서, 한 로봇이 돌아서도 다른 로봇은 하던 일을 계속해요.',
        ],
        example:
          'class Walker:\n    def __init__(self):\n        self.dir = "left"\n\n    def turn(self):\n        if self.dir == "left":\n            self.dir = "right"\n        else:\n            self.dir = "left"',
        inGame: '벽에 닿으면 self.dir 을 바꾸고, 몬스터가 있으면 self.bot.scan(self.dir).weak 로 마법을 써요.',
      },
    ],
    starter: `# 로봇들이 통로의 몬스터를 모두 처치하면 창살이 열려요.
# 로봇은 통로 가운데쯤에서 시작해요. 몬스터는 양쪽에 있어요!
# 로봇도 scan()·cast() 를 쓸 수 있어요: self.bot.scan(방향), self.bot.cast(마법, 방향)

class Hunter:
    def __init__(self, bot):
        self.bot = bot

    def act(self):
        m = self.bot.scan("left")
        if m is not None:
            self.bot.cast(m.weak, "left")
        else:
            self.bot.move("left")

for b in get_bots():
    hire(Hunter(b))
${WALK_TO_EXIT}`,
    solution: `class Hunter:
    def __init__(self, bot):
        self.bot = bot
        self.dir = "left"

    def act(self):
        m = self.bot.scan(self.dir)
        if m is not None:
            self.bot.cast(m.weak, self.dir)
        elif self.bot.look(self.dir) == "wall":
            self.dir = "right"
        else:
            self.bot.move(self.dir)

for b in get_bots():
    hire(Hunter(b))
${WALK_TO_EXIT}`,
    bypasses: [
      {
        name: '방향 상태 없이 한쪽으로만',
        code: `class Hunter:\n    def __init__(self, bot):\n        self.bot = bot\n\n    def act(self):\n        m = self.bot.scan("left")\n        if m is not None:\n            self.bot.cast(m.weak, "left")\n        else:\n            self.bot.move("left")\n\nfor b in get_bots():\n    hire(Hunter(b))\n${WALK_TO_EXIT}`,
      },
      {
        name: '모두가 같이 쓰는 방향 하나 (클래스 변수)',
        code: `class Hunter:
    dir = "left"
    def __init__(self, bot):
        self.bot = bot

    def act(self):
        m = self.bot.scan(Hunter.dir)
        if m is not None:
            self.bot.cast(m.weak, Hunter.dir)
        elif self.bot.look(Hunter.dir) == "wall":
            Hunter.dir = "right"
        else:
            self.bot.move(Hunter.dir)

for b in get_bots():
    hire(Hunter(b))
${WALK_TO_EXIT}`,
      },
      {
        name: '약점을 안 보고 마법을 차례로',
        code: `class Hunter:\n    def __init__(self, bot):\n        self.bot = bot\n        self.dir = "left"\n        self.k = 0\n\n    def act(self):\n        if self.bot.look(self.dir) in ["ghost", "spider", "crab"]:\n            self.bot.cast(["fireball", "icebolt", "lightning"][self.k % 3], self.dir)\n            self.k = self.k + 1\n        elif self.bot.look(self.dir) == "wall":\n            self.dir = "right"\n        else:\n            self.bot.move(self.dir)\n\nfor b in get_bots():\n    hire(Hunter(b))\n${WALK_TO_EXIT}`,
      },
    ],
  },

  // ───────────────────────────── 25a (비계: 2차원 리스트에서 칸 하나 읽기)
  {
    id: 'stage-25a',
    part: 3,
    title: '칸 하나 읽기',
    concept: '2차원 리스트 · grid[y][x]',
    goal: '세 복도(y = 1, 3, 5) 중 하나 끝에만 출구가 있어요. 지도로 찾아 곧장 가세요!',
    hint: 'grid = get_map() 에서 grid[y][x] 는 (x, y) 칸이에요. 복도 끝 칸의 x 는 len(grid[0]) - 2. y 가 1, 3, 5 인 끝 칸 중 "exit" 인 줄로 내려가서 오른쪽으로 쭉!',
    note: '출구가 있는 복도는 실행할 때마다 바뀌어요. 계획 화면은 맵 1 이에요.',
    api: MAP_API,
    seeds: [5, 8, 1],
    stars: { lines: 11 },
    map: (rng) => {
      const exitRow = [1, 3, 5][rng.int(3)];
      return [
        '###########',
        '#S........#',
        '#.#########',
        '#.........#',
        '#.#########',
        '#.........#',
        '###########',
      ].map((r, y) => (y === exitRow ? r.slice(0, 9) + 'E#' : r));
    },
    maxTurns: (rows) => pathOf(rows).length + 1,
    concepts: [
      {
        name: '2차원 리스트',
        text: [
          '리스트 안에 리스트를 넣으면 표(격자) 모양을 담을 수 있어요. 이것을 2차원 리스트라고 해요.',
          'grid[y] 는 y 번째 줄(리스트), grid[y][x] 는 그 줄의 x 번째 칸이에요. 줄(y)을 먼저 써요!',
          '줄 수는 len(grid), 한 줄의 칸 수는 len(grid[0]) 이에요.',
        ],
        example: 'grid = [["#", "."],\n        [".", "k"]]\nprint(grid[1])      # [".", "k"]\nprint(grid[1][1])   # k\nprint(len(grid[0])) # 2',
        inGame: 'get_map() 은 맵 전체를 look() 과 같은 낱말("wall", "empty", "exit" …)로 담은 2차원 리스트예요. 복도 끝 칸만 짚어 보면 출구가 어디인지 알아요.',
      },
    ],
    starter: `# get_map() 은 맵 전체를 2차원 리스트로 줘요. grid[y][x] 는 (x, y) 칸에 있는 것!
# 줄 번호 y 를 먼저, 칸 번호 x 를 나중에 써요.

grid = get_map()
w = len(grid[0])
print("복도 끝 x =", w - 2)
print(grid[1][w - 2])
`,
    solution: `grid = get_map()
w = len(grid[0])
for y in [1, 3, 5]:
    if grid[y][w - 2] == "exit":
        target = y
while get_pos()[1] < target:
    move_down()
while look("right") != "exit":
    move_right()
move_right()
`,
    bypasses: [
      {
        name: '가운데 복도부터 가 보고 되돌아오기',
        code: `move_down()\nmove_down()\nwhile look("right") == "empty":\n    move_right()\nif look("right") != "exit":\n    while get_pos()[0] > 1:\n        move_left()\n    move_up()\n    move_up()\nwhile look("right") == "empty":\n    move_right()\nmove_right()\n`,
      },
      { name: '맵 1 의 길을 외우기', code: (levels) => movesCode(pathOf(levelRows(levels[0]))) },
      {
        name: 'x, y 를 거꾸로 써서 grid[x][y]',
        code: `grid = get_map()\nw = len(grid[0])\ntarget = 1\nfor y in [1, 3, 5]:\n    if grid[w - 2][y] == "exit":\n        target = y\nwhile get_pos()[1] < target:\n    move_down()\nwhile look("right") != "exit":\n    move_right()\nmove_right()\n`,
      },
    ],
  },

  // ───────────────────────────── 26
  {
    id: 'stage-26',
    part: 3,
    title: '보물 지도 두루마리',
    concept: '2차원 리스트 훑기',
    goal: '지도로 열쇠를 찾아 곧장 줍고, 오른쪽 벽의 문을 열어 출구로!',
    hint: 'grid = get_map() 은 줄(y)마다 칸(x)을 담은 2차원 리스트예요. 이중 for 로 grid[y][x] == "key" 인 칸을 찾고, get_pos() 를 보며 그 좌표까지 가요.',
    note: '열쇠와 문의 위치는 실행할 때마다 바뀌어요. 턴 제한 = 열쇠까지 + 문까지 + 2.',
    api: MAP_API,
    seeds: [1, 2, 3],
    stars: { lines: 23 },
    map: (rng) => {
      const g = Array.from({ length: 9 }, (_, y) => [...(y === 0 || y === 8 ? '#'.repeat(16) : '#' + '.'.repeat(13) + '##')]);
      g[1][1] = 'S';
      const dy = 1 + rng.int(7);
      g[dy][14] = 'D';
      g[dy][15] = 'E';
      let kx = 1;
      let ky = 1;
      while ((kx === 1 && ky === 1) || kx + ky < 8) {
        kx = 2 + rng.int(12);
        ky = 1 + rng.int(7);
      }
      g[ky][kx] = 'k';
      return g.map((r) => r.join(''));
    },
    maxTurns: (rows) => {
      const [k] = find(rows, 'k');
      const [d] = find(rows, 'D');
      return k.x - 1 + (k.y - 1) + Math.abs(d.y - k.y) + (d.x - k.x) + 1 + 2;
    },
    concepts: [
      {
        name: '2차원 리스트 전체 훑기',
        text: [
          '이중 for 로 y 는 0 부터 len(grid) - 1 까지, x 는 0 부터 len(grid[y]) - 1 까지 돌면 모든 칸을 하나씩 볼 수 있어요.',
          '찾던 칸을 만나면 그 x, y 를 변수에 담아 두었다가 나중에 써요.',
          '어느 칸으로 가는 동작을 def go(tx, ty): 함수로 만들어 두면 여러 곳에 쓸 수 있어요.',
        ],
        example:
          'grid = [["#", "."],\n        [".", "k"]]\nprint(grid[1][1])   # k\nfor y in range(len(grid)):\n    for x in range(len(grid[y])):\n        if grid[y][x] == "k":\n            print(x, y)   # 1 1',
        inGame: 'get_map() 은 맵 전체를 look() 과 같은 낱말로 담은 2차원 리스트예요. "key" 와 "door" 를 찾아 곧장 가세요.',
      },
    ],
    starter: `# get_map() 은 맵 전체를 2차원 리스트로 줘요. grid[y][x] 는 (x, y) 칸에 있는 것!
# 계획 화면은 맵 1 이에요. 열쇠와 문 위치는 맵마다 달라요.

grid = get_map()
print(len(grid), "줄,", len(grid[0]), "칸")
print(grid[1])
x, y = get_pos()
print("나:", x, y, grid[y][x])
`,
    solution: `grid = get_map()
for y in range(len(grid)):
    for x in range(len(grid[y])):
        if grid[y][x] == "key":
            kx = x
            ky = y
        if grid[y][x] == "door":
            dx = x
            dy = y

def go(tx, ty):
    while get_pos()[1] < ty:
        move_down()
    while get_pos()[1] > ty:
        move_up()
    while get_pos()[0] < tx:
        move_right()
    while get_pos()[0] > tx:
        move_left()

go(kx, ky)
go(dx, dy)
move_right()
`,
    bypasses: [
      {
        name: '방을 지그재그로 훑으며 열쇠 찾기',
        code: `d = "right"\nwhile get_keys() == 0:\n    if look(d) == "wall":\n        move_down()\n        if d == "right":\n            d = "left"\n        else:\n            d = "right"\n    else:\n        move(d)\nwhile look("right") != "exit":\n    if look("right") == "wall":\n        move_down()\n    else:\n        move_right()\nmove_right()\n`,
      },
      {
        name: '맵 1 의 열쇠·문 좌표를 외우기',
        code: (levels) => {
          const l = levels[0];
          const k = l.keys[0];
          const d = l.terrain.findIndex((r) => r.includes('door'));
          const dx = l.terrain[d].indexOf('door');
          const ys = (from: number, to: number) => (to > from ? 'move_down()\n' : 'move_up()\n').repeat(Math.abs(to - from));
          return ys(1, k.y) + 'move_right()\n'.repeat(k.x - 1) + ys(k.y, d) + 'move_right()\n'.repeat(dx - k.x + 1);
        },
      },
    ],
  },

  // ───────────────────────────── 26a (비계: BFS 로 거리만 구하기)
  {
    id: 'stage-26a',
    part: 3,
    title: '한 겹씩 넓히기',
    concept: 'BFS 첫걸음 · 거리',
    goal: '입구 왼쪽 비밀 문의 암호는 열쇠까지 가장 짧은 걸음 수(정수)예요. 지도로 재세요!',
    hint: '너비 우선 탐색: dist = {입구: 0} 과 queue = [입구] 로 시작해서, 꺼낸 칸의 이웃 중 처음 보는 칸은 dist[이웃] = dist[지금] + 1 로 적고 큐에 넣어요. 열쇠 칸의 dist 가 암호!',
    note: '미로는 실행할 때마다 바뀌어요. 길이 여러 갈래라, 아무 길이나 센 걸음 수는 틀릴 수 있어요.',
    api: MAP_API,
    seeds: [1, 2, 3],
    stars: { lines: 18 },
    map: (rng) =>
      // loopyMaze 의 출구 자리에 열쇠를 두고, 왼쪽에 [출구][비밀 문] 을 붙인다 (전체가 1칸 오른쪽으로 밀림)
      loopyMaze(rng, 8, 5, 7).map((r, y) => (y === 1 ? 'EG' : '##') + r.slice(1).replace('E', 'k')),
    maxTurns: 6,
    content: (_rng, { rows }) => {
      const maze = rows.map((r) => r.replace('E', '#').replace('G', '#').replace('k', 'E'));
      return { gates: [pathOf(maze).length] };
    },
    concepts: [
      {
        name: '너비 우선 탐색 (BFS)',
        text: [
          '탐색은 갈 수 있는 곳을 빠짐없이 살펴보며 답을 찾는 방법이에요.',
          '너비 우선 탐색(BFS)은 출발점에서 1칸, 2칸, 3칸 … 거리 순서로 퍼져 나가요. 그래서 처음 닿았을 때의 거리가 가장 짧은 거리예요.',
          '큐(queue): 먼저 넣은 것을 먼저 꺼내는 줄. 리스트의 append() 로 넣고 pop(0) 으로 꺼내요.',
          '칸을 튜플 (x, y) 로 다루면 딕셔너리의 키로 쓸 수 있어요. dist[(x, y)] 에 거리를 적으면 방문 표시도 돼요.',
        ],
        example:
          'queue = [start]\ndist = {start: 0}\nwhile len(queue) > 0:\n    here = queue.pop(0)\n    for nxt in 이웃(here):\n        if nxt not in dist:\n            dist[nxt] = dist[here] + 1\n            queue.append(nxt)',
        inGame: 'get_map() 으로 미로를 받아 입구에서 BFS 로 퍼져 나가며 칸마다 거리를 적어요. 열쇠 칸에 적힌 거리가 암호!',
      },
    ],
    starter: `# 암호 = 입구에서 미로 속 열쇠까지 가장 짧은 걸음 수 (정수)
# 너비 우선 탐색(BFS): 가까운 칸부터 한 겹씩 퍼져 나가며 거리를 적어요.
# 칸은 튜플 (x, y) 로 다루면 딕셔너리의 키로 쓸 수 있어요.

grid = get_map()
start = get_pos()
dist = {start: 0}
queue = [start]
x, y = queue.pop(0)
print("꺼낸 칸:", x, y, "거리:", dist[(x, y)])
for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
    print("이웃:", x + dx, y + dy, grid[y + dy][x + dx])
`,
    solution: `grid = get_map()
start = get_pos()
dist = {start: 0}
queue = [start]
while len(queue) > 0:
    x, y = queue.pop(0)
    if grid[y][x] == "key":
        break
    for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        nx = x + dx
        ny = y + dy
        if grid[ny][nx] == "empty" or grid[ny][nx] == "key":
            if (nx, ny) not in dist:
                dist[(nx, ny)] = dist[(x, y)] + 1
                queue.append((nx, ny))
open_gate("left", dist[(x, y)])
move_left()
move_left()
`,
    bypasses: [
      {
        name: '깊이 우선 탐색(DFS)으로 처음 찾은 길의 걸음 수',
        code: `grid = get_map()
seen = []
def dfs(x, y):
    if grid[y][x] == "key":
        return 0
    seen.append((x, y))
    for dx, dy in [(0, -1), (1, 0), (0, 1), (-1, 0)]:
        nx = x + dx
        ny = y + dy
        if grid[ny][nx] in ["empty", "key"] and (nx, ny) not in seen:
            rest = dfs(nx, ny)
            if rest is not None:
                return rest + 1
    return None
x, y = get_pos()
open_gate("left", dfs(x, y))
move_left()
move_left()
`,
      },
      {
        name: '가로 + 세로 칸 차이 (벽 무시)',
        code: `grid = get_map()\nx, y = get_pos()\nfor yy in range(len(grid)):\n    for xx in range(len(grid[yy])):\n        if grid[yy][xx] == "key":\n            cx = xx\n            cy = yy\nopen_gate("left", abs(cx - x) + abs(cy - y))\nmove_left()\nmove_left()\n`,
      },
      {
        name: '맵 1 의 암호를 코드에 직접 쓰기',
        code: (levels) => `open_gate("left", ${levels[0].gates[0].code})\nmove_left()\nmove_left()\n`,
      },
      {
        name: '암호를 하나씩 넣어 보기',
        code: `for c in range(100):\n    open_gate("left", c)\nmove_left()\nmove_left()\n`,
      },
    ],
  },

  // ───────────────────────────── 27
  {
    id: 'stage-27',
    part: 3,
    title: '가장 짧은 길',
    concept: '탐색 (BFS)',
    goal: '턴 제한이 "가장 짧은 길 + 1" 이에요. 가장 짧은 길로 미로를 빠져나가세요!',
    hint: '가까운 칸부터 차례로 넓혀 가는 "너비 우선 탐색": 큐(리스트)에 칸을 넣고 pop(0) 으로 꺼내며, 처음 도착한 칸마다 어디서 왔는지 딕셔너리에 적어요. 출구에서 거꾸로 되짚으면 길이 나와요.',
    note: '미로는 실행할 때마다 바뀌어요. 다른 길은 가장 짧은 길보다 2칸 이상 길어요.',
    api: MAP_API,
    seeds: [1, 2, 3],
    stars: { lines: 22 },
    map: (rng) => loopyMaze(rng, 8, 5, 7),
    maxTurns: (rows) => pathOf(rows).length + 1,
    concepts: [
      {
        name: '왔던 길 되짚기',
        text: [
          'BFS 로 퍼져 나갈 때 칸마다 "어디서 왔는지(와 어느 방향으로 왔는지)"를 딕셔너리에 적어 두어요.',
          '출구에 닿으면, 출구에서 시작해 "어디서 왔는지"를 따라 입구까지 거꾸로 되짚어요.',
          '되짚은 길은 출구 → 입구 순서라서, reversed() 로 뒤집어 따라가요.',
        ],
        example:
          'queue = [start]\ncame = {start: None}\nwhile queue:\n    here = queue.pop(0)\n    for nxt in 이웃(here):\n        if nxt not in came:\n            came[nxt] = here\n            queue.append(nxt)',
        inGame: 'get_map() 으로 미로를 받아 BFS 로 출구까지 가장 짧은 길(방향 리스트)을 만든 뒤, for d in path: move(d)!',
      },
    ],
    starter: `# 턴 제한 = 가장 짧은 길 + 1. 더듬어 찾으면 턴이 모자라요!
# 너비 우선 탐색(BFS): 가까운 칸부터 퍼져 나가며 "어디서 왔는지" 적어 두기.
# 칸은 튜플 (x, y) 로 다루면 딕셔너리의 키로 쓸 수 있어요.

grid = get_map()
start = get_pos()
step = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
came = {start: None}
queue = [start]
print(start, len(queue), grid[start[1]][start[0]])
`,
    solution: `grid = get_map()
start = get_pos()
step = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
came = {start: None}
queue = [start]
while len(queue) > 0:
    x, y = queue.pop(0)
    if grid[y][x] == "exit":
        break
    for d in step:
        nx = x + step[d][0]
        ny = y + step[d][1]
        if grid[ny][nx] != "wall" and (nx, ny) not in came:
            came[(nx, ny)] = (x, y, d)
            queue.append((nx, ny))
path = []
while came[(x, y)] is not None:
    x, y, d = came[(x, y)]
    path.append(d)
for d in reversed(path):
    move(d)
`,
    bypasses: [
      {
        name: '깊이 우선 탐색(DFS)으로 찾은 길',
        code: `grid = get_map()
step = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}
seen = []
def dfs(x, y):
    if grid[y][x] == "exit":
        return []
    seen.append((x, y))
    for d in step:
        nx = x + step[d][0]
        ny = y + step[d][1]
        if grid[ny][nx] != "wall" and (nx, ny) not in seen:
            rest = dfs(nx, ny)
            if rest is not None:
                return [d] + rest
    return None
x, y = get_pos()
for d in dfs(x, y):
    move(d)
`,
      },
      {
        name: '오른손을 벽에 대고 더듬기',
        code: `dirs = ["up", "right", "down", "left"]\nh = 1\nwhile True:\n    r = (h + 1) % 4\n    if look(dirs[r]) in ["empty", "exit"]:\n        h = r\n    elif look(dirs[h]) not in ["empty", "exit"]:\n        h = (h + 3) % 4\n        continue\n    move(dirs[h])\n`,
      },
      { name: '맵 1 의 길을 외우기', code: (levels) => movesCode(pathOf(levelRows(levels[0]))) },
    ],
  },
];

/** Level 을 다시 ASCII 로 (S·E·벽만, 길 찾기용) */
function levelRows(l: Level): string[] {
  return l.terrain.map((row, y) =>
    row.map((t, x) => (x === l.start.x && y === l.start.y ? 'S' : t === 'exit' ? 'E' : t === 'wall' ? '#' : '.')).join(''),
  );
}
