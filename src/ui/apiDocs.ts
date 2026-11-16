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
    doc: '옆 칸에 무엇이 있는지 알려 줘요: "empty", "wall", "exit", "chest", "key", "door", "slime", "bat", "giant" (2부: "sign", "tablet", "gate"). 턴을 쓰지 않아요.',
    turn: false,
  },
  {
    name: 'cast',
    sig: 'cast(마법, 방향)',
    snippet: 'cast("${1|fireball,icebolt|}", "${2|right,left,up,down|}")',
    doc: '옆 칸의 몬스터에게 마법을 써요. "fireball"(불) 또는 "icebolt"(얼음).',
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
  { name: 'print', sig: 'print(값, ...)', snippet: 'print(${1})', doc: '아래 기록 창에 값을 출력해요.', turn: false },
];
