// 퍼즐용 규칙 수치. 턴제 퍼즐이라 작은 정수만 쓴다 (v0.1 실시간 전투 수치와 별개).
import type { BarsRule, Element, MonsterKind, Pos, Skill } from './types';

export const DEFAULT_MAX_TURNS = 200;
export const DEFAULT_PLAYER_HP = 3;

export const SKILL_ELEMENT: Record<Skill, Element> = {
  fireball: 'fire',
  icebolt: 'ice',
  lightning: 'thunder',
};
export const SKILLS = Object.keys(SKILL_ELEMENT) as Skill[];

export interface MonsterRule {
  label: string;
  hp: number;
  /** 부딪혔을 때 플레이어가 받는 피해 */
  contact: number;
  /** 속성별 마법 피해: 2 = 약점, 1 = 보통, 0 = 효과 없음 (변이 몬스터는 Level 의 weak 를 따른다) */
  damage: Record<Element, number>;
  /** 3부 변이 몬스터: HP·약점이 시드마다 바뀌고, 약점이 아닌 마법에는 반격한다 */
  mutant?: boolean;
}

export const MONSTER_RULES: Record<MonsterKind, MonsterRule> = {
  slime: { label: '슬라임', hp: 2, contact: 1, damage: { fire: 2, ice: 0, thunder: 0 } },
  bat: { label: '박쥐', hp: 2, contact: 1, damage: { fire: 0, ice: 2, thunder: 0 } },
  giant: { label: '외눈 거인', hp: 4, contact: 2, damage: { fire: 0, ice: 2, thunder: 0 } },
  // 3부 변이 몬스터: 아래 hp·damage 는 기본값일 뿐, 실제 값은 스테이지 content() 가 시드마다 정한다
  ghost: { label: '유령', hp: 2, contact: 1, damage: { fire: 2, ice: 0, thunder: 0 }, mutant: true },
  spider: { label: '거미', hp: 2, contact: 1, damage: { fire: 2, ice: 0, thunder: 0 }, mutant: true },
  crab: { label: '게', hp: 4, contact: 2, damage: { fire: 2, ice: 0, thunder: 0 }, mutant: true },
  mimic: { label: '미믹', hp: 2, contact: 3, damage: { fire: 2, ice: 0, thunder: 0 }, mutant: true },
};
export const MONSTER_KINDS = Object.keys(MONSTER_RULES) as MonsterKind[];

/** 약점 마법 피해 (변이 몬스터) */
export const WEAK_DAMAGE = 2;

/** 1·2부 몬스터의 약점 마법 (피해가 가장 큰 속성) */
export function defaultWeak(kind: MonsterKind): Skill {
  const d = MONSTER_RULES[kind].damage;
  return SKILLS.reduce((best, s) => (d[SKILL_ELEMENT[s]] > d[SKILL_ELEMENT[best]] ? s : best), SKILLS[0]);
}

/** ASCII 맵 문자 */
export const MONSTER_CHAR: Record<string, MonsterKind> = {
  s: 'slime',
  b: 'bat',
  g: 'giant',
  o: 'ghost',
  x: 'spider',
  q: 'crab',
  m: 'mimic',
};

/**
 * 창살 규칙 (3부): 모든 발판 위에 로봇이 서 있고, 몬스터가 하나도 남지 않았으면 열린다.
 * 조건이 깨지면 다시 닫히지만, 누가 서 있는 창살 칸은 닫히지 않는다 (World·replay 가 함께 쓴다)
 */
export function barsShouldOpen(plates: readonly Pos[], bots: readonly Pos[], monstersLeft: number): boolean {
  return monstersLeft === 0 && plates.every((p) => bots.some((b) => b.x === p.x && b.y === p.y));
}

/** 창살 조건을 따질 때 필요한 지금 상태 */
export interface BarsState {
  plates: readonly Pos[];
  bots: readonly Pos[];
  monstersLeft: number;
  chestsLeft: number;
  /** 석상 무게 (번호 순서) */
  values?: readonly number[];
  /** 기둥별 원판 */
  pegs?: readonly (readonly number[])[];
  discs?: number;
}

/** 스테이지의 창살 조건(BarsRule)으로 창살이 열려야 하는지 (World·replay 가 함께 쓴다) */
export function barsOpenFor(rule: BarsRule | undefined, s: BarsState): boolean {
  switch (rule ?? 'plates') {
    case 'plates':
      return barsShouldOpen(s.plates, s.bots, s.monstersLeft);
    case 'sorted':
      return !!s.values && isSorted(s.values);
    case 'hanoi':
      return !!s.pegs && s.pegs[2].length === (s.discs ?? 0);
    case 'chests':
      return s.chestsLeft === 0;
  }
}

export const isSorted = (v: readonly number[]) => v.every((x, i) => i === 0 || v[i - 1] < x);

/** 4부 통행료 동전 (큰 것부터) */
export const COINS = [500, 100, 50, 10] as const;

/** 하노이 기둥 이름 (왼→오른) */
export const PEG_NAMES = ['A', 'B', 'C'] as const;
