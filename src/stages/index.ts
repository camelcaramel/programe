// 스테이지 1~10. 개념을 하나씩 연다: 순차 → for → if → while → def → 변수 → 이중 for.
// solution / hardcoded 는 학생에게 보이지 않고, 테스트(stages.test.ts)가 "풀리는지 / 하드코딩이 막히는지" 확인한다.
import type { StageDef } from '../sim';

export interface StageInfo extends StageDef {
  /** 배우는 개념 (짧게) */
  concept: string;
  /** 목표 설명 */
  goal: string;
  /** 막혔을 때 보여 줄 힌트 */
  hint: string;
  /** 계획 화면에서 맵과 함께 보여 줄 주의 (실행마다 바뀌는 점 등) */
  note?: string;
  /** 처음 에디터에 들어 있는 코드 */
  starter: string;
  /** 이 스테이지에서 쓸 수 있는 명령 */
  api: string[];
  /** 정답 예시 (테스트용) */
  solution: string;
  /** 맵 하나만 보고 짠 풀이. 어떤 시드에서는 반드시 실패해야 한다 (테스트용) */
  hardcoded?: string;
}

export const MOVE_API = ['move_up', 'move_down', 'move_left', 'move_right', 'print'];
export const SENSE_API = [...MOVE_API, 'look', 'cast'];
export const ALL_API = [...SENSE_API, 'get_hp', 'get_pos', 'get_coins', 'get_keys'];

export const STAGES: StageInfo[] = [
  {
    id: 'stage-01',
    title: '첫 걸음',
    concept: '순서대로 실행',
    goal: '출구(초록 마법진)까지 걸어가세요.',
    hint: '오른쪽으로 3칸, 아래로 2칸, 다시 오른쪽으로 3칸이에요. 명령은 위에서부터 한 줄씩 실행돼요.',
    api: MOVE_API,
    seeds: [1],
    map: [
      '#########',
      '#S...####',
      '####.####',
      '####...E#',
      '#########',
    ],
    starter: `# 명령은 위에서부터 한 줄씩 실행돼요.
# move_right() 는 오른쪽으로 한 칸 이동해요.

move_right()
move_right()
`,
    solution: `move_right()
move_right()
move_right()
move_down()
move_down()
move_right()
move_right()
move_right()
`,
  },
  {
    id: 'stage-02',
    title: '보물 찾기',
    concept: '순서대로 실행',
    goal: '보물상자를 모두 열고 출구로 가세요.',
    hint: '아래쪽 길 위에 상자가 하나 숨어 있어요. 위로 올라갔다가 다시 내려오면 돼요.',
    api: MOVE_API,
    seeds: [1],
    map: [
      '#########',
      '#Sc.#####',
      '###.#c###',
      '###....E#',
      '#########',
    ],
    starter: `# 보물상자 칸에 들어가면 상자가 열려요.
# 상자를 모두 열면 별을 하나 더 받아요!

move_right()
`,
    solution: `move_right()
move_right()
move_down()
move_down()
move_right()
move_right()
move_up()
move_down()
move_right()
move_right()
`,
  },
  {
    id: 'stage-03',
    title: '긴 복도',
    concept: 'for 반복문',
    goal: '긴 복도 끝의 출구로 가세요. 3줄 이하로 쓰면 별!',
    hint: 'for i in range(13): 아래에 들여쓰기(스페이스 4칸)한 명령은 13번 반복돼요.',
    api: MOVE_API,
    seeds: [1],
    stars: { lines: 3 },
    map: [
      '################',
      '#S............E#',
      '################',
    ],
    starter: `# 같은 명령을 여러 번 쓸 때는 for 반복문!
# 아래 코드는 move_right() 를 3번 실행해요.

for i in range(3):
    move_right()
`,
    solution: `for i in range(13):
    move_right()
`,
  },
  {
    id: 'stage-04',
    title: '계단',
    concept: 'for 반복문',
    goal: '계단을 따라 내려가세요. 4줄 이하로 쓰면 별!',
    hint: '"오른쪽 → 아래" 가 계속 반복돼요. 반복되는 묶음을 for 안에 넣고, 마지막 한 칸은 따로 움직여요.',
    api: MOVE_API,
    seeds: [1],
    stars: { lines: 4 },
    map: [
      '########',
      '#S.#####',
      '##..####',
      '###..###',
      '####..##',
      '#####.E#',
      '########',
    ],
    starter: `# for 안에 명령을 여러 줄 넣을 수도 있어요.
# 들여쓰기가 같은 줄들이 함께 반복돼요.

for i in range(1):
    move_right()
`,
    solution: `for i in range(4):
    move_right()
    move_down()
move_right()
`,
  },
  {
    id: 'stage-05',
    title: '숨은 슬라임',
    concept: 'if 조건문',
    goal: '? 칸에는 슬라임이 있을 수도, 없을 수도 있어요. 3개의 맵을 모두 통과하세요.',
    hint: 'look("right") 로 오른쪽 칸을 살펴보고, 슬라임이면 cast("fireball", "right") 로 처치해요.',
    note: '? 칸은 실행할 때마다 바뀌어요. 같은 코드가 맵 3개를 모두 통과해야 해요.',
    api: SENSE_API,
    seeds: [1, 8, 9],
    stars: { lines: 4 },
    random: { '?': ['.', 's'] },
    map: ['#########', '#S..?..E#', '#########'],
    starter: `# look("right") 는 오른쪽 칸에 무엇이 있는지 알려 줘요.
#   "empty"(빈칸), "wall"(벽), "slime"(슬라임), "exit"(출구) ...
# 슬라임은 불에 약해요: cast("fireball", "right")

for i in range(6):
    if look("right") == "slime":
        print("슬라임 발견!")
    move_right()
`,
    solution: `for i in range(6):
    if look("right") == "slime":
        cast("fireball", "right")
    move_right()
`,
    hardcoded: `for i in range(6):
    move_right()
`,
  },
  {
    id: 'stage-06',
    title: '약점을 노려라',
    concept: 'if / elif',
    goal: '? 칸에는 슬라임이나 외눈 거인이 나와요. 약점 마법으로 처치하고 출구로!',
    hint: '슬라임은 불(fireball) 1번, 외눈 거인은 얼음(icebolt) 2번. 반대 속성은 효과가 없어요.',
    note: '? 칸은 실행할 때마다 빈칸 · 슬라임 · 외눈 거인 중 하나로 바뀌어요.',
    api: SENSE_API,
    seeds: [6, 2, 12],
    stars: { lines: 8 },
    random: { '?': ['.', 's', 'g'] },
    map: ['###########', '#S.?..?..E#', '###########'],
    starter: `# elif 로 조건을 여러 개 이어 쓸 수 있어요.

for i in range(8):
    ahead = look("right")
    if ahead == "slime":
        cast("fireball", "right")
    elif ahead == "giant":
        print("거인이다!")
    move_right()
`,
    solution: `for i in range(8):
    ahead = look("right")
    if ahead == "slime":
        cast("fireball", "right")
    elif ahead == "giant":
        cast("icebolt", "right")
        cast("icebolt", "right")
    move_right()
`,
    hardcoded: `for i in range(8):
    if look("right") == "slime":
        cast("fireball", "right")
    move_right()
`,
  },
  {
    id: 'stage-07',
    title: '끝이 보이지 않는 길',
    concept: 'while 반복문',
    goal: '길의 길이가 실행할 때마다 달라져요. 턴이 넉넉하지 않으니 벽에 부딪히지 말고 출구로 가세요.',
    hint: 'while look("right") == "empty": 는 오른쪽이 빈칸인 동안 계속 반복해요.',
    note: '복도 길이가 실행할 때마다 달라지고, 턴 제한은 걸어야 할 칸 수 + 2예요.',
    api: SENSE_API,
    seeds: [1, 8, 2],
    stars: { lines: 4 },
    map: (rng) => {
      const a = 3 + rng.int(6); // 오른쪽으로 갈 칸
      const b = 2 + rng.int(4); // 아래로 갈 칸
      const w = a + 3;
      const rows = ['#'.repeat(w), '#S' + '.'.repeat(a) + '#'];
      for (let k = 1; k < b; k++) rows.push('#'.repeat(a + 1) + '.#');
      rows.push('#'.repeat(a + 1) + 'E#', '#'.repeat(w));
      return rows;
    },
    maxTurns: (rows) => rows.join('').split('.').length - 1 + 1 + 2,
    starter: `# while 조건: 은 조건이 참인 동안 계속 반복해요.

while look("right") == "empty":
    move_right()
`,
    solution: `while look("right") == "empty":
    move_right()
while True:
    move_down()
`,
    hardcoded: `for i in range(5):
    move_right()
for i in range(3):
    move_down()
`,
  },
  {
    id: 'stage-08',
    title: '세 개의 방',
    concept: 'def 함수',
    goal: '똑같이 생긴 방이 3개 있어요. 방마다 위쪽 칸에 보물상자나 슬라임이 있어요. 상자를 모두 열고 출구로!',
    hint: 'def room(): 으로 "방 하나 지나가기"를 함수로 만들고, 3번 불러요. 위가 슬라임이면 먼저 처치!',
    note: '위쪽 ? 칸은 실행할 때마다 보물상자나 슬라임으로 바뀌어요.',
    api: SENSE_API,
    seeds: [1, 9, 10],
    stars: { lines: 10 },
    random: { '?': ['c', 's'] },
    map: ['############', '##?##?##?###', '#S........E#', '############'],
    starter: `# def 이름(): 으로 명령 묶음에 이름을 붙일 수 있어요.
# 만든 함수는 이름() 으로 불러요.

def room():
    move_right()
    move_up()
    move_down()
    move_right()
    move_right()

room()
`,
    solution: `def room():
    move_right()
    if look("up") == "slime":
        cast("fireball", "up")
    move_up()
    move_down()
    move_right()
    move_right()

for i in range(3):
    room()
`,
  },
  {
    id: 'stage-09',
    title: '열쇠는 두 개만',
    concept: '변수와 상태',
    goal: '문 2개를 열려면 열쇠 2개가 필요해요. 턴이 딱 맞으니 열쇠는 2개만 주우세요!',
    hint: 'get_keys() 는 지금 가진 열쇠 개수예요. 열쇠가 2개 모이면 더 줍지 말고 지나가요.',
    note: '위쪽 ? 칸 4개 중 2~4개에 열쇠가 있어요. 턴 제한은 11턴이에요.',
    api: ALL_API,
    seeds: [1, 5, 8],
    stars: { lines: 7 },
    random: { K: ['k'], O: ['.'] },
    map: (rng) => {
      const keyCount = 2 + rng.int(3);
      const pockets = ['K', 'K', 'K', 'K'].map((p, i) => (i < keyCount ? p : 'O'));
      for (let i = pockets.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [pockets[i], pockets[j]] = [pockets[j], pockets[i]];
      }
      return ['##########', '##' + pockets.join('') + '####', '#S....DDE#', '##########'];
    },
    maxTurns: 11,
    starter: `# 변수에 값을 담아 두면 나중에 다시 쓸 수 있어요.
# get_keys() 는 지금 가진 열쇠 개수를 알려 줘요.

for i in range(4):
    move_right()
    if look("up") == "key":
        move_up()
        move_down()
    print("열쇠:", get_keys())
`,
    solution: `for i in range(4):
    move_right()
    if get_keys() < 2 and look("up") == "key":
        move_up()
        move_down()
while True:
    move_right()
`,
    hardcoded: `for i in range(4):
    move_right()
    if look("up") == "key":
        move_up()
        move_down()
while True:
    move_right()
`,
  },
  {
    id: 'stage-10',
    title: '보물 창고',
    concept: '이중 for',
    goal: '5×5 창고 곳곳에 보물상자가 있어요. 모든 칸을 지나가며 상자를 다 열고 출구로!',
    hint: '한 줄을 오른쪽으로 다 가고, 한 칸 내려와서 다음 줄은 왼쪽으로… 줄 번호(row)가 짝수인지(row % 2 == 0) 보면 방향을 고를 수 있어요.',
    note: '? 칸은 실행할 때마다 보물상자이거나 빈칸이에요.',
    api: ALL_API,
    seeds: [1, 2, 3],
    stars: { lines: 9 },
    random: { '?': ['c', '.'] },
    map: ['#######', '#S????#', '#?????#', '#?????#', '#?????#', '#?????E', '#######'],
    starter: `# for 안에 for 를 넣을 수 있어요 (이중 for).
# 아래 코드는 "오른쪽 4칸 + 아래 1칸"을 2번 해요. row 는 0, 1 로 바뀌어요.
# 상자를 모두 열려면 오른쪽으로 갔다가, 다음 줄은 왼쪽으로 와야 해요.

for row in range(2):
    print("row =", row)
    for i in range(4):
        move_right()
    move_down()
`,
    solution: `for row in range(5):
    for i in range(4):
        if row % 2 == 0:
            move_right()
        else:
            move_left()
    if row < 4:
        move_down()
move_right()
`,
  },
];

export const stageIndex = (id: string) => STAGES.findIndex((s) => s.id === id);
export const getStage = (id: string) => STAGES[stageIndex(id)];

/** 별 조건에 쓰는 코드 줄 수: 빈 줄과 주석만 있는 줄은 세지 않는다 */
export function countCodeLines(code: string): number {
  return code.split('\n').filter((l) => {
    const t = l.trim();
    return t !== '' && !t.startsWith('#');
  }).length;
}
