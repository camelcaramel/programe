// 1부: 스테이지 1~10. 개념을 하나씩 연다: 순차 → for → if → while → def → 변수 → 이중 for.
// 2부(11~18)는 part2.ts. 두 부를 이어 붙인 STAGES 가 스테이지 순서다.
// solution / hardcoded 는 학생에게 보이지 않고, 테스트(stages.test.ts)가 "풀리는지 / 하드코딩이 막히는지" 확인한다.
import { PART2 } from './part2';
import { ALL_API, MOVE_API, SENSE_API, type StageInfo } from './types';

export * from './types';

const PART1: StageInfo[] = [
  {
    part: 1,
    id: 'stage-01',
    title: '첫 걸음',
    concept: '순서대로 실행',
    concepts: [
      {
        name: '명령과 순서대로 실행',
        text: [
          '코드는 컴퓨터에게 내리는 명령을 적은 글이에요.',
          '명령은 맨 위 줄부터 아래로 한 줄씩 차례대로 실행돼요.',
          'move_right() 처럼 이름 뒤에 괄호 () 를 붙이면 그 명령(함수)을 부르는 거예요.',
        ],
        example: 'move_right()   # 오른쪽으로 한 칸\nmove_down()    # 그다음 아래로 한 칸',
        inGame: '마법사가 걸어갈 길을 순서대로 적으면, 실행했을 때 그대로 움직여요.',
      },
    ],
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
    part: 1,
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
    part: 1,
    id: 'stage-03',
    title: '긴 복도',
    concept: 'for 반복문',
    concepts: [
      {
        name: 'for 반복문과 들여쓰기',
        text: [
          'for i in range(5): 는 아래 명령을 5번 반복해요.',
          '반복할 명령은 스페이스 4칸 안쪽으로 들여 써요. 들여 쓴 줄들이 한 묶음(블록)이에요.',
          '콜론(:)을 빼먹지 마세요. 들여쓰기를 멈추면 반복도 끝나요.',
        ],
        example: 'for i in range(3):\n    move_right()   # 3번 반복\nmove_down()        # 반복이 끝난 뒤 1번',
        inGame: '같은 이동을 여러 번 해야 할 때 for 를 쓰면 줄 수가 확 줄어요.',
      },
    ],
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
    part: 1,
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
    part: 1,
    id: 'stage-05',
    title: '숨은 슬라임',
    concept: 'if 조건문',
    concepts: [
      {
        name: 'if 조건문과 == 비교',
        text: [
          'if 조건: 은 조건이 참일 때만 들여 쓴 명령을 실행해요.',
          '== 는 두 값이 같은지 비교해요. (= 하나는 변수에 담기, == 두 개는 비교!)',
          '"slime" 처럼 따옴표로 감싼 글자를 문자열이라고 해요.',
        ],
        example: 'if look("right") == "slime":\n    cast("fireball", "right")',
        inGame: '? 칸에 무엇이 나올지 모르니, look() 으로 보고 if 로 그때그때 판단해요.',
      },
    ],
    goal: '? 칸에는 슬라임이 있을 수도, 없을 수도 있어요. 3개의 맵을 모두 통과하세요.',
    hint: 'look("right") 로 오른쪽 칸을 살펴보고, 슬라임이면 cast("fireball", "right") 로 처치해요.',
    note: '? 칸은 실행할 때마다 빈칸이나 슬라임으로 바뀌어요.',
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
    part: 1,
    id: 'stage-06',
    title: '약점을 노려라',
    concept: 'if / elif',
    concepts: [
      {
        name: 'elif · else 와 변수',
        text: [
          'elif 는 "아니면, 이 조건이면", else 는 "위 조건이 모두 아니면" 이에요.',
          '위에서부터 처음 맞는 하나만 실행돼요.',
          'ahead = look("right") 처럼 = 로 값을 변수에 담아 두면 여러 번 다시 쓸 수 있어요.',
        ],
        example: 'ahead = look("right")\nif ahead == "slime":\n    print("슬라임")\nelif ahead == "giant":\n    print("거인")\nelse:\n    print("다른 것")',
        inGame: '몬스터 종류마다 다른 마법을 고를 때 if / elif 로 나눠요.',
      },
    ],
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
    part: 1,
    id: 'stage-07',
    title: '끝이 보이지 않는 길',
    concept: 'while 반복문',
    concepts: [
      {
        name: 'while 반복문',
        text: [
          'while 조건: 은 조건이 참(True)인 동안 계속 반복해요. 몇 번일지 몰라도 돼요.',
          '조건이 거짓(False)이 되는 순간 반복을 멈추고 아래로 내려가요.',
          'while True: 는 끝나지 않는 반복이에요. 게임에서는 출구에 닿으면 멈추지만, 조심해서 써요.',
        ],
        example: 'while look("right") == "empty":\n    move_right()',
        inGame: '길 길이가 맵마다 달라도 "빈칸인 동안 걷기"는 언제나 맞아요.',
      },
    ],
    goal: '길의 길이가 실행할 때마다 달라져요. 턴이 넉넉하지 않으니 벽에 부딪히지 말고 출구로 가세요.',
    hint: 'while look("right") == "empty": 는 오른쪽이 빈칸인 동안 계속 반복해요.',
    note: '복도 길이가 실행할 때마다 달라지고, 턴 제한은 걸어야 할 칸 수 + 2예요.',
    api: SENSE_API,
    seeds: [1, 8, 2],
    stars: { lines: 5 },
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
    part: 1,
    id: 'stage-08',
    title: '세 개의 방',
    concept: 'def 함수',
    concepts: [
      {
        name: 'def 함수 만들기',
        text: [
          'def 이름(): 으로 명령 묶음에 이름을 붙여 새 명령(함수)을 만들 수 있어요.',
          '함수 안 명령은 들여 써요. 만들기만 하면 실행되지 않아요.',
          '이름() 으로 부를 때마다 그 묶음이 실행돼요.',
        ],
        example: 'def zigzag():\n    move_right()\n    move_down()\n\nzigzag()\nzigzag()',
        inGame: '똑같은 방 3개를 지나는 동작을 함수 하나로 만들어 3번 불러요.',
      },
    ],
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
    part: 1,
    id: 'stage-09',
    title: '열쇠는 두 개만',
    concept: '변수와 상태',
    concepts: [
      {
        name: '비교·논리 연산과 상태 값',
        text: [
          '< (작다), > (크다), <= , >= , != (다르다) 로 두 값을 비교해요. 결과는 True 나 False.',
          'and 는 "둘 다 참일 때", or 는 "하나라도 참일 때" 참이에요.',
          'get_keys() 처럼 지금 상태를 알려 주는 명령의 값을 조건에 쓸 수 있어요.',
        ],
        example: 'if get_keys() < 2 and look("up") == "key":\n    move_up()',
        inGame: '열쇠가 2개보다 적고, 위에 열쇠가 있을 때만 주우러 가요.',
      },
    ],
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
    part: 1,
    id: 'stage-10',
    title: '보물 창고',
    concept: '이중 for · 종합',
    concepts: [
      {
        name: '이중 for · % · 매개변수',
        text: [
          'for 안에 for 를 넣으면(이중 for) 바깥 한 번마다 안쪽이 끝까지 반복돼요.',
          '% 는 나눈 나머지예요. row % 2 == 0 이면 row 가 짝수예요.',
          'def step(d): 처럼 괄호 안에 이름(매개변수)을 두면, step("right") 로 부를 때 d 에 "right" 가 담겨요.',
        ],
        example: 'def step(d):\n    print(d)\n\nfor row in range(2):\n    for i in range(3):\n        step("right")',
        inGame: '줄마다 방향을 바꿔 가며 창고 전체를 훑을 때 이중 for 와 % 를 함께 써요.',
      },
    ],
    goal: '5×5 창고 곳곳에 보물상자가 있고, 슬라임도 숨어 있어요. 모든 칸을 지나가며 상자를 다 열고 출구로!',
    hint: '한 줄을 오른쪽으로 다 가고, 한 칸 내려와서 다음 줄은 왼쪽으로… row % 2 == 0 이면 짝수 줄이에요. "가려는 쪽을 살펴보고, 슬라임이면 처치한 뒤 한 칸 가기"를 def step(d): 함수로 만들어 두면 편해요.',
    note: '? 칸은 실행할 때마다 보물상자 · 빈칸 · 슬라임 중 하나로 바뀌어요.',
    api: ALL_API,
    seeds: [1, 2, 3],
    stars: { lines: 18 },
    random: { '?': ['c', 'c', '.', 's'] },
    map: ['#######', '#S????#', '#?????#', '#?????#', '#?????#', '#?????E', '#######'],
    starter: `# 마지막 스테이지! 지금까지 배운 것을 모두 써 보세요.
# for 안에 for 를 넣을 수 있어요 (이중 for). row 는 0, 1, 2 ... 로 바뀌어요.
# 슬라임이 숨어 있어요. 한 칸 가기 전에 그쪽을 살펴보는 함수를 만들어 두면 편해요.

def step(d):
    # TODO: d 쪽에 슬라임이 있으면 먼저 처치하기
    if d == "right":
        move_right()
    elif d == "left":
        move_left()
    else:
        move_down()

for row in range(2):
    for i in range(4):
        step("right")
    step("down")
`,
    solution: `def step(d):
    if look(d) == "slime":
        cast("fireball", d)
    if d == "right":
        move_right()
    elif d == "left":
        move_left()
    else:
        move_down()

for row in range(5):
    for i in range(4):
        if row % 2 == 0:
            step("right")
        else:
            step("left")
    if row < 4:
        step("down")
move_right()
`,
    hardcoded: `for row in range(5):
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

export const STAGES: StageInfo[] = [...PART1, ...PART2];

export const stageIndex = (id: string) => STAGES.findIndex((s) => s.id === id);
export const getStage = (id: string) => STAGES[stageIndex(id)];

/** 별 조건에 쓰는 코드 줄 수: 빈 줄과 주석만 있는 줄은 세지 않는다 */
export function countCodeLines(code: string): number {
  return code.split('\n').filter((l) => {
    const t = l.trim();
    return t !== '' && !t.startsWith('#');
  }).length;
}
