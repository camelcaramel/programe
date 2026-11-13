// 시뮬레이터 공용 타입. Phaser·DOM 에 의존하지 않는 순수 데이터만 둔다.
import type { Rng } from './rng';

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export type MonsterKind = 'slime' | 'bat' | 'giant';
export type Skill = 'fireball' | 'icebolt';
export type Element = 'fire' | 'ice';

/** 움직이지 않는 지형 */
export type Terrain = 'floor' | 'wall' | 'exit' | 'door';

export interface Pos {
  x: number;
  y: number;
}

/** look() 이 돌려주는 값 */
export type LookResult = 'wall' | 'empty' | 'chest' | 'exit' | 'door' | 'key' | MonsterKind;

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
  monsters: { x: number; y: number; kind: MonsterKind }[];
  chests: Pos[];
  keys: Pos[];
  /** 렌더러가 '?' 칸 위치를 표시할 수 있도록 원래 랜덤 칸이었던 좌표 */
  randomCells: Pos[];
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
  | 'miss'; // 그 방향에 몬스터가 없음

export interface TraceStep {
  turn: number;
  action: 'move' | 'cast';
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
}
