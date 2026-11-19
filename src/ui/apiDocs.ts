// 학생용 명령 설명. 자동완성·호버·도움말 탭이 함께 쓴다.
export interface ApiDoc {
  name: string;
  sig: string;
  snippet: string;
  doc: string;
  /** 1턴을 쓰는 명령인지 */
  turn: boolean;
}

export const API_DOCS: ApiDoc[] = [
  { name: 'move_up', sig: 'move_up()', snippet: 'move_up()', doc: '위로 한 칸 이동해요.', turn: true },
  { name: 'move_down', sig: 'move_down()', snippet: 'move_down()', doc: '아래로 한 칸 이동해요.', turn: true },
  { name: 'move_left', sig: 'move_left()', snippet: 'move_left()', doc: '왼쪽으로 한 칸 이동해요.', turn: true },
  { name: 'move_right', sig: 'move_right()', snippet: 'move_right()', doc: '오른쪽으로 한 칸 이동해요.', turn: true },
  {
    name: 'look',
    sig: 'look(방향)',
    snippet: 'look("${1|right,left,up,down|}")',
    doc: '옆 칸에 무엇이 있는지 알려 줘요: "empty", "wall", "exit", "chest", "key", "door", "slime", "bat", "giant" (2부: "sign", "tablet", "gate" · 3부: "ghost", "spider", "crab", "bars", "bot" · 4부: "vault", "statue", "pillar", "toll"). 미믹은 "chest" 로 보여요. 턴을 쓰지 않아요.',
    turn: false,
  },
  {
    name: 'cast',
    sig: 'cast(마법, 방향)',
    snippet: 'cast("${1|fireball,icebolt,lightning|}", "${2|right,left,up,down|}")',
    doc: '옆 칸의 몬스터에게 마법을 써요. "fireball"(불), "icebolt"(얼음), "lightning"(번개, 3부).',
    turn: true,
  },
  { name: 'get_hp', sig: 'get_hp()', snippet: 'get_hp()', doc: '내 HP (처음 3).', turn: false },
  { name: 'get_pos', sig: 'get_pos()', snippet: 'get_pos()', doc: '내 위치 (x, y). 왼쪽 위가 (0, 0)이에요.', turn: false },
  { name: 'get_coins', sig: 'get_coins()', snippet: 'get_coins()', doc: '지금까지 연 보물상자 수(동전).', turn: false },
  { name: 'get_keys', sig: 'get_keys()', snippet: 'get_keys()', doc: '지금 가진 열쇠 수. 문을 열 때마다 1개씩 써요.', turn: false },
  {
    name: 'read',
    sig: 'read(방향)',
    snippet: 'read("${1|up,down,left,right|}")',
    doc: '옆 칸의 표지판은 글자(문자열, 예: "42"), 석판은 리스트(예: ["right", "down"])를 돌려줘요. 턴을 쓰지 않아요.',
    turn: false,
  },
  {
    name: 'open_gate',
    sig: 'open_gate(방향, 암호)',
    snippet: 'open_gate("${1|right,left,up,down|}", ${2:code})',
    doc: '옆 칸 비밀 문에 암호를 넣어요. 자료형까지 같아야 열려요("42" 와 42 는 달라요). 틀리면 경보가 울려 HP −1.',
    turn: true,
  },
  {
    name: 'move',
    sig: 'move(방향)',
    snippet: 'move(${1:d})',
    doc: '방향 글자("up", "down", "left", "right")를 받아 한 칸 이동해요. move("right") 는 move_right() 와 같아요.',
    turn: true,
  },
  {
    name: 'scan',
    sig: 'scan(방향)',
    snippet: 'scan("${1|right,left,up,down|}")',
    doc: '옆 칸 몬스터를 객체로 돌려줘요: m.kind(종류), m.hp(지금 HP), m.max_hp, m.weak(약점 마법 이름). 몬스터가 없으면 None. 미믹의 정체도 알 수 있어요. 턴을 쓰지 않아요.',
    turn: false,
  },
  { name: 'wait', sig: 'wait()', snippet: 'wait()', doc: '한 턴 쉬어요. 고용한 로봇들은 그동안 act() 로 움직여요.', turn: true },
  {
    name: 'get_bots',
    sig: 'get_bots()',
    snippet: 'get_bots()',
    doc: '맵의 로봇 리스트(위→아래, 왼→오른 순서). 로봇 bot 은 bot.move(방향), bot.cast(마법, 방향), bot.look(방향), bot.read(방향), bot.scan(방향) 을 가져요. move·cast 는 act() 안에서 한 턴에 하나만.',
    turn: false,
  },
  {
    name: 'hire',
    sig: 'hire(객체)',
    snippet: 'hire(${1:Robot(bot)})',
    doc: 'act() 메서드가 있는 객체를 고용해요. 그 뒤로 내가 1턴을 쓸 때마다 고용한 객체 모두의 act() 가 한 번씩 불려요.',
    turn: false,
  },
  {
    name: 'get_map',
    sig: 'get_map()',
    snippet: 'get_map()',
    doc: '맵 전체를 2차원 리스트로 돌려줘요. grid[y][x] 는 (x, y) 칸에 있는 것 ("wall", "empty", "exit", "key", "door" … look() 과 같은 낱말).',
    turn: false,
  },
  {
    name: 'size',
    sig: 'size()',
    snippet: 'size()',
    doc: '이 맵의 금고·석상 개수(하노이 맵에서는 원판 수). 번호는 0 부터 size() - 1 까지예요.',
    turn: false,
  },
  {
    name: 'peek',
    sig: 'peek(번호)',
    snippet: 'peek(${1:i})',
    doc: '번호 금고 속 숫자(정수)를 들여다봐요. 맵마다 들여다보기 횟수가 정해져 있어요(위쪽 표시). 턴을 쓰지 않아요.',
    turn: false,
  },
  {
    name: 'heavier',
    sig: 'heavier(i, j)',
    snippet: 'heavier(${1:i}, ${2:j})',
    doc: '저울: i 번 석상이 j 번보다 무거우면 True, 아니면 False. 무게는 볼 수 없고 비교만 돼요. 저울 횟수가 정해져 있어요. 턴을 쓰지 않아요.',
    turn: false,
  },
  {
    name: 'swap',
    sig: 'swap(i, j)',
    snippet: 'swap(${1:i}, ${2:j})',
    doc: '두 석상의 자리를 바꿔요. 방에 따라 바꾸기 횟수가 정해져 있거나, 이웃끼리만(swap(i, i + 1)) 바꿀 수 있어요.',
    turn: true,
  },
  {
    name: 'move_disc',
    sig: 'move_disc(출발, 도착)',
    snippet: 'move_disc("${1|A,B,C|}", "${2|C,B,A|}")',
    doc: '하노이: 기둥("A", "B", "C") 맨 위 원판을 다른 기둥으로 옮겨요. 큰 원판은 작은 원판 위에 놓을 수 없어요.',
    turn: true,
  },
  {
    name: 'pay',
    sig: 'pay(동전)',
    snippet: 'pay(${1|500,100,50,10|})',
    doc: '옆 칸 요금 문에 동전 하나(500, 100, 50, 10원)를 내요. 통행료와 딱 맞으면 열리고, 넘치게 내면 경보로 쓰러져요.',
    turn: true,
  },
  { name: 'print', sig: 'print(값, ...)', snippet: 'print(${1})', doc: '아래 기록 창에 값을 출력해요.', turn: false },
];
