// 퍼즐용 규칙 수치. 턴제 퍼즐이라 작은 정수만 쓴다 (v0.1 실시간 전투 수치와 별개).
import type { Element, MonsterKind, Skill } from './types';

export const DEFAULT_MAX_TURNS = 200;
export const DEFAULT_PLAYER_HP = 3;

export const SKILL_ELEMENT: Record<Skill, Element> = {
  fireball: 'fire',
  icebolt: 'ice',
};
export const SKILLS = Object.keys(SKILL_ELEMENT) as Skill[];

export interface MonsterRule {
  label: string;
  hp: number;
  /** 부딪혔을 때 플레이어가 받는 피해 */
  contact: number;
  /** 속성별 마법 피해: 2 = 약점, 1 = 보통, 0 = 효과 없음 */
  damage: Record<Element, number>;
}

export const MONSTER_RULES: Record<MonsterKind, MonsterRule> = {
  slime: { label: '슬라임', hp: 2, contact: 1, damage: { fire: 2, ice: 0 } },
  bat: { label: '박쥐', hp: 2, contact: 1, damage: { fire: 0, ice: 2 } },
  giant: { label: '외눈 거인', hp: 4, contact: 2, damage: { fire: 0, ice: 2 } },
};
export const MONSTER_KINDS = Object.keys(MONSTER_RULES) as MonsterKind[];

/** ASCII 맵 문자 */
export const MONSTER_CHAR: Record<string, MonsterKind> = { s: 'slime', b: 'bat', g: 'giant' };
