// 시뮬레이터 공용 타입. Phaser·DOM 에 의존하지 않는 순수 데이터만 둔다.
import type { Rng } from './rng';

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

/** slime·bat·giant 는 1부부터, ghost·spider·crab·mimic 은 3부의 "변이 몬스터"(HP·약점이 시드마다 바뀜) */
export type MonsterKind = 'slime' | 'bat' | 'giant' | 'ghost' | 'spider' | 'crab' | 'mimic';
export type Skill = 'fireball' | 'icebolt' | 'lightning';
export type Element = 'fire' | 'ice' | 'thunder';

/**
 * 움직이지 않는 지형. sign(표지판)·tablet(석판)·gate(비밀 문)은 2부,
 * plate(발판)·bars(창살)은 3부, vault(금고)·statue(석상)·pillar(하노이 기둥)·toll(요금 문)은 4부에서 쓴다
 */
export type Terrain =
  | 'floor'
  | 'wall'
  | 'exit'
  | 'door'
  | 'sign'
  | 'tablet'
  | 'gate'
  | 'plate'
  | 'bars'
  | 'vault'
  | 'statue'
  | 'pillar'
  | 'toll';

/**
 * 창살이 열리는 조건 (3부는 plates, 4부는 스테이지마다):
 * plates = 모든 발판에 조수 + 몬스터 없음, sorted = 석상이 가벼운→무거운 순서,
 * hanoi = 원판이 모두 C 기둥, chests = 보물상자를 모두 엶
 */
export type BarsRule = 'plates' | 'sorted' | 'hanoi' | 'chests';

/** 4부 금고·석상 줄: 번호(0부터, 위→아래·왼→오른) 순서의 칸과 값 (금고 = 숫자, 석상 = 무게) */
export interface ItemRow {
  kind: 'vault' | 'statue';
  cells: Pos[];
  values: number[];
}

/** 표지판(문자열)·석판(리스트)에 적힌 값 */
export type SignValue = string | (string | number)[];
/** 비밀 문 암호. 자료형까지 같아야 열린다 ("7" 과 7 은 다름) */
export type GateCode = string | number;

export interface Pos {
  x: number;
  y: number;
}

/** look() 이 돌려주는 값 (미믹은 "chest" 로 보인다. 발판은 "empty", 열린 창살도 "empty") */
export type LookResult =
  | 'wall'
  | 'empty'
  | 'chest'
  | 'exit'
  | 'door'
  | 'key'
  | 'sign'
  | 'tablet'
  | 'gate'
  | 'bars'
  | 'bot'
  | 'vault'
  | 'statue'
  | 'pillar'
  | 'toll'
  /** 조수 로봇의 look() 에만: 옆 칸의 마법사 */
  | 'wizard'
  | Exclude<MonsterKind, 'mimic'>;

/** scan() 이 돌려주는 몬스터 정보 (파이썬에서 Monster 객체가 된다) */
export interface MonsterInfo {
  /** 몬스터를 가리키는 이름표 (처음 자리 "x,y") */
  id: string;
  kind: MonsterKind;
  hp: number;
  max_hp: number;
  /** 약점 마법 이름 */
  weak: Skill;
}

/** 변이 몬스터의 시드별 정보 */
export interface MonsterMutation {
  hp: number;
  weak: Skill;
}

/** content() 에 넘겨주는, 맵에서 찾은 표지판·석판·비밀 문 위치 (위→아래, 왼→오른 순서) */
export interface ContentSlots {
  /** 랜덤 칸('?')까지 뽑은 뒤의 ASCII 맵 */
  rows: string[];
  signs: Pos[];
  tablets: Pos[];
  gates: Pos[];
  /** 몬스터 (3부: 변이 정보를 정해 줄 수 있다) */
  monsters: { x: number; y: number; kind: MonsterKind }[];
  /** 4부: 금고(V)·석상(W) 칸 (번호 순서) */
  items: Pos[];
  /** 4부: 요금 문($) 칸 */
  tolls: Pos[];
}

/** content() 가 돌려주는 값: 위치 순서대로 표지판 글자, 석판 리스트, 문 암호 */
export interface StageContent {
  signs?: string[];
  tablets?: (string | number)[][];
  gates?: GateCode[];
  /** 몬스터 순서대로 변이 정보 (null 이면 기본 규칙). 변이 몬스터(ghost·spider·crab·mimic)는 꼭 정해야 한다 */
  monsters?: (MonsterMutation | null)[];
  /** 턴 제한을 내용(몬스터 HP 등)을 보고 다시 정할 때 */
  maxTurns?: number;
  /** 4부: 금고 속 숫자 또는 석상 무게 (번호 순서) */
  row?: number[];
  /** 4부: 하노이 원판 수 (기둥 H 가 있으면 꼭) */
  discs?: number;
  /** 4부: 요금 문마다 통행료 */
  tolls?: number[];
  /** 4부: peek()·heavier()·swap() 횟수 제한 (없으면 무제한) */
  peekLimit?: number;
  weighLimit?: number;
  swapLimit?: number;
}

/** 스테이지 정의 (src/stages/*.ts 에서 작성) */
export interface StageDef {
  id: string;
  title: string;
  /** ASCII 맵. 함수면 시드마다 다른 맵(예: 길이가 바뀌는 복도)을 만든다 */
  map: string[] | ((rng: Rng) => string[]);
  /** 랜덤 칸: 문자 → 후보 문자 목록. 예: { '?': ['.', 's'] } */
  random?: Record<string, string[]>;
  /** 이 시드들을 모두 통과해야 클리어 */
  seeds: number[];
  /** 턴 제한. 함수면 시드마다 만든 맵을 보고 정한다 (예: 걸어야 할 칸 수 + 여유) */
  maxTurns?: number | ((rows: string[]) => number);
  playerHp?: number;
  /** 별 조건: lines = 이 줄 수 이하로 클리어 */
  stars?: { lines?: number };
  /** 표지판(T)·석판(M)의 내용, 비밀 문(G)의 암호, 몬스터 변이를 시드로 만든다. 맵을 다 만든 뒤 같은 rng 로 부른다 */
  content?: (rng: Rng, slots: ContentSlots) => StageContent;
  /** scan() 을 쓸 수 있는 횟수 (없으면 무제한). 함수면 시드마다 만든 맵을 보고 정한다 */
  scanLimit?: number | ((rows: string[]) => number);
  /** 4부: 이웃한 석상끼리만 바꿀 수 있다 (swap(i, i + 1)) */
  adjacentOnly?: boolean;
  /** 창살이 열리는 조건 (없으면 plates) */
  barsRule?: BarsRule;
}

/** 시드가 정해진 뒤의 실제 맵 (직렬화 가능한 순수 데이터, 렌더러도 그대로 쓴다) */
export interface Level {
  stageId: string;
  seed: number;
  width: number;
  height: number;
  maxTurns: number;
  playerHp: number;
  /** terrain[y][x] */
  terrain: Terrain[][];
  start: Pos;
  /** hp·weak 가 있으면 변이 몬스터 (약점이 아닌 마법은 반격) */
  monsters: { x: number; y: number; kind: MonsterKind; hp?: number; weak?: Skill }[];
  chests: Pos[];
  keys: Pos[];
  /** 렌더러가 '?' 칸 위치를 표시할 수 있도록 원래 랜덤 칸이었던 좌표 */
  randomCells: Pos[];
  /** 표지판·석판과 적힌 값 (계획 화면에서는 가려서 그린다) */
  signs: { x: number; y: number; kind: 'sign' | 'tablet'; value: SignValue }[];
  /** 비밀 문과 암호 */
  gates: { x: number; y: number; code: GateCode }[];
  /** 조수 로봇 처음 위치 (순서 = 로봇 번호) */
  bots: Pos[];
  /** scan() 사용 횟수 제한 (없으면 무제한) */
  scanLimit?: number;
  /** 4부: 금고·석상 줄 */
  row?: ItemRow;
  peekLimit?: number;
  weighLimit?: number;
  swapLimit?: number;
  adjacentOnly?: boolean;
  /** 4부: 하노이 기둥 3개 (왼→오른 = A, B, C) 와 원판 수. 처음에는 모두 A 에 */
  pillars?: Pos[];
  discs?: number;
  /** 4부: 요금 문과 통행료 */
  tolls?: { x: number; y: number; fee: number }[];
  /** 창살이 열리는 조건 (없으면 plates) */
  barsRule?: BarsRule;
}

export type TraceEvent =
  | 'move' // 빈칸으로 이동
  | 'bump' // 벽·잠긴 문에 부딪힘 (제자리)
  | 'hit' // 몬스터에 부딪혀 피해 (제자리)
  | 'chest' // 보물상자 열기 (이동)
  | 'key' // 열쇠 줍기 (이동)
  | 'door' // 열쇠로 문 열기 (이동)
  | 'exit' // 출구 도착 (클리어)
  | 'damage' // 마법 명중, 몬스터 생존
  | 'kill' // 마법 명중, 몬스터 처치
  | 'miss' // 그 방향에 몬스터가 없음
  | 'read' // 표지판·석판 읽기 (0턴, 재생 때 말풍선)
  | 'gate_open' // 맞는 암호로 비밀 문 열기 (제자리)
  | 'gate_wrong' // 틀린 암호: 경보, HP −1 (제자리)
  | 'scan' // 몬스터 살펴보기 (0턴, 재생 때 말풍선)
  | 'wait' // 한 턴 쉬기
  | 'peek' // 금고 들여다보기 (0턴, 말풍선)
  | 'weigh' // 저울로 석상 둘 비교 (0턴, 말풍선)
  | 'swap' // 석상 둘 자리 바꾸기
  | 'disc' // 하노이 원판 옮기기
  | 'pay' // 통행료 동전 하나 (모자라면 그대로, 딱 맞으면 문이 열림)
  | 'pay_over'; // 통행료보다 많이 냄: 경보, 쓰러짐

/** 한 턴 동안 조수 로봇 하나가 한 일 */
export interface BotStep {
  id: number;
  action: 'move' | 'cast';
  dir: Dir;
  skill?: Skill;
  /** move: 'move' | 'bump', cast: 'damage' | 'kill' | 'miss' */
  event: 'move' | 'bump' | 'damage' | 'kill' | 'miss';
  /** 행동 뒤 위치 */
  pos: Pos;
  target: Pos;
  amount?: number;
  /** 약점이 아닌 마법을 써서 반격을 받아 고장 남 */
  broken?: boolean;
}

export interface TraceStep {
  turn: number;
  action: 'move' | 'cast' | 'read' | 'gate' | 'scan' | 'wait' | 'peek' | 'weigh' | 'swap' | 'disc' | 'pay';
  dir: Dir;
  skill?: Skill;
  event: TraceEvent;
  ok: boolean;
  /** 행동 뒤 플레이어 상태 */
  pos: Pos;
  hp: number;
  coins: number;
  keys: number;
  /** 행동 대상 칸 */
  target: Pos;
  /** 마법 피해량 또는 플레이어가 받은 피해 */
  amount?: number;
  /** 학생 코드의 줄 번호 (알 수 없으면 null) */
  line: number | null;
  /** read: 읽은 값 */
  value?: SignValue;
  /** open_gate: 넣은 암호를 파이썬 모양으로 (말풍선용, 예: '"12"', '42') */
  shown?: string;
  /** gate_wrong: 값은 같아 보이는데 자료형이 달라서 틀림 (예: "42" 와 42) */
  typeMismatch?: boolean;
  /** read: 조수 로봇이 읽었으면 그 로봇 번호 (마법사는 그대로 있다) */
  by?: number;
  /** scan: 살펴본 몬스터 */
  info?: MonsterInfo;
  /** cast: 약점이 아닌 마법이라 반격으로 잃은 HP */
  counter?: number;
  /** 이 턴에 조수 로봇들이 한 일 (마법사 행동 바로 뒤, 화면에서는 함께 움직인다) */
  bots?: BotStep[];
  /** 이 턴이 끝난 뒤 열려 있는 창살 칸 ("x,y"). 창살이 있는 맵에서만 */
  barsOpen?: string[];
  /** peek: 금고 번호 / weigh·swap: 두 석상 번호 */
  index?: number;
  pair?: [number, number];
  /** peek: 금고 속 숫자 */
  num?: number;
  /** weigh: 앞의 석상(pair[0])이 더 무거운가 */
  heavier?: boolean;
  /** disc: 기둥 번호(0=A, 1=B, 2=C)와 원판 크기(1 = 가장 작음) */
  from?: number;
  to?: number;
  size?: number;
  /** pay: 낸 동전, 지금까지 낸 돈, 통행료, 문이 열렸는지 */
  coin?: number;
  paid?: number;
  fee?: number;
  opened?: boolean;
}

export type EndReason =
  | 'exit' // 클리어
  | 'dead' // HP 0
  | 'turn_limit' // 턴 제한 초과
  | 'not_reached' // 코드가 끝났는데 출구에 못 감
  | 'error' // 파이썬 오류 (G2에서 채움)
  | 'timeout'; // 실행 시간 초과 (G2에서 채움)

export interface RunSummary {
  stageId: string;
  seed: number;
  cleared: boolean;
  reason: EndReason;
  turns: number;
  hp: number;
  coins: number;
  chestsTotal: number;
  trace: TraceStep[];
  /** 4부: 들여다보기·저울·바꾸기를 쓴 횟수 (금고·석상이 있는 맵에서만) */
  counts?: AlgoCounts;
}

export interface AlgoCounts {
  peek: number;
  weigh: number;
  swap: number;
}
