// 스테이지 정의에 쓰는 타입과 명령 목록. (index.ts ↔ part2.ts 가 서로 부르지 않도록 따로 둔다)
import type { Level, StageDef } from '../sim';

/** 새 개념 설명 카드 (그 개념이 처음 나오는 스테이지에 둔다) */
export interface Concept {
  /** 개념 이름. 예: "for 반복문" */
  name: string;
  /** 짧은 설명 3~5줄 */
  text: string[];
  /** 아주 작은 예시 코드 */
  example: string;
  /** 게임 속에서 어떻게 쓰는지 한 줄 */
  inGame: string;
}

/** 막아야 할 우회 풀이 (테스트용). code 가 함수면 맵 1(시드 첫째)을 보고 코드를 만든다 */
export interface Bypass {
  name: string;
  code: string | ((levels: Level[]) => string);
}

export interface StageInfo extends StageDef {
  /** 1부(스테이지 1~10) · 2부(11~18) · 3부(19~27) · 4부(28~36) */
  part: 1 | 2 | 3 | 4;
  /** 심화 "도전" 스테이지 (4부 34~36) */
  challenge?: boolean;
  /** 배우는 개념 (짧게) */
  concept: string;
  /** 이 스테이지에서 처음 나오는 개념 설명 카드 */
  concepts?: Concept[];
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
  /** 그 밖에 막아야 할 우회 풀이들 (테스트용, 모두 실패해야 한다) */
  bypasses?: Bypass[];
}

export const MOVE_API = ['move_up', 'move_down', 'move_left', 'move_right', 'print'];
export const SENSE_API = [...MOVE_API, 'look', 'cast'];
export const ALL_API = [...SENSE_API, 'get_hp', 'get_pos', 'get_coins', 'get_keys'];
/** 2부: 표지판·석판 읽기와 비밀 문 */
export const GATE_API = [...ALL_API, 'read', 'open_gate'];
/** 2부 14단계부터: move(방향) */
export const PART2_API = [...GATE_API, 'move'];
/** 3부 19단계부터: scan(방향) 으로 몬스터 객체 */
export const OBJ_API = [...PART2_API, 'scan'];
/** 3부 23단계부터: 로봇 (클래스) */
export const CLASS_API = [...OBJ_API, 'wait', 'get_bots', 'hire'];
/** 3부 26단계부터: get_map() 2차원 리스트 */
export const MAP_API = [...CLASS_API, 'get_map'];
/** 4부: 금고·석상·하노이·통행료 */
export const ALGO_API = [...MAP_API, 'size', 'peek', 'heavier', 'swap', 'move_disc', 'pay'];
