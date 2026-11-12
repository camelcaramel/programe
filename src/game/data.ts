// 게임 밸런스 데이터. 학생이 보는 도움말 탭도 이 값을 그대로 사용한다.

export type Element = 'physical' | 'fire' | 'ice';
export type SkillName = 'fireball' | 'icebolt' | 'heal';
export type MonsterKind = 'slime' | 'fly' | 'golem';

export interface SkillDef {
  label: string;
  mp: number;
  power: number; // 피해량 또는 회복량
  element: Element;
  icon: string; // public 기준 이미지 경로
  desc: string;
}

const TILE_IMG = 'assets/kenney/platformer/Sprites/Tiles/Default/';
const ENEMY_IMG = 'assets/kenney/platformer/Sprites/Enemies/Default/';

export const SKILLS: Record<SkillName, SkillDef> = {
  fireball: { label: '파이어볼', mp: 10, power: 24, element: 'fire', icon: TILE_IMG + 'fireball.png', desc: '불 속성 투사체. 슬라임에게 강해요.' },
  icebolt: { label: '아이스볼트', mp: 14, power: 18, element: 'ice', icon: TILE_IMG + 'gem_blue.png', desc: '얼음 투사체. 맞은 적을 잠시 느리게 해요.' },
  heal: { label: '힐', mp: 18, power: 35, element: 'physical', icon: TILE_IMG + 'heart.png', desc: '내 HP를 회복해요.' },
};
export const SKILL_NAMES = Object.keys(SKILLS) as SkillName[];

export interface MonsterDef {
  label: string;
  hp: number;
  speed: number;
  contact: number; // 접촉 피해
  sight: number; // 플레이어 감지 거리(px)
  xp: number;
  gold: number;
  resist: Record<Element, number>; // 받는 피해 배율
  flying: boolean;
  scale: number;
  walk: [string, string];
  dead: string;
  icon: string;
  tip: string;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  slime: {
    label: '슬라임', hp: 40, speed: 70, contact: 10, sight: 320, xp: 15, gold: 5,
    resist: { physical: 1, fire: 1.5, ice: 1 }, flying: false, scale: 1,
    walk: ['slime_normal_walk_a', 'slime_normal_walk_b'], dead: 'slime_normal_flat',
    icon: ENEMY_IMG + 'slime_normal_rest.png', tip: '불에 약해요 (×1.5)',
  },
  fly: {
    label: '날벌레', hp: 30, speed: 120, contact: 8, sight: 400, xp: 20, gold: 8,
    resist: { physical: 1, fire: 1, ice: 1.5 }, flying: true, scale: 1,
    walk: ['fly_a', 'fly_b'], dead: 'fly_rest',
    icon: ENEMY_IMG + 'fly_a.png', tip: '하늘을 날아요. 얼음에 약해요 (×1.5)',
  },
  golem: {
    label: '블록 골렘', hp: 170, speed: 45, contact: 22, sight: 460, xp: 80, gold: 40,
    resist: { physical: 0.25, fire: 0.5, ice: 2 }, flying: false, scale: 1.8,
    walk: ['slime_block_walk_a', 'slime_block_walk_b'], dead: 'slime_block_rest',
    icon: ENEMY_IMG + 'slime_block_rest.png', tip: '기본 공격 ×0.25, 불 ×0.5, 얼음 ×2',
  },
};

export const PLAYER_BASE = { hp: 100, mp: 60, mpRegen: 5, attack: 12 };
export const xpToNext = (level: number) => 40 + level * 30;

export interface Mission {
  id: string;
  title: string;
  desc: string;
  hint: string;
}

export const MISSIONS: Mission[] = [
  { id: 'move', title: '움직여 보기', desc: '←/→ 로 걷고 Space 로 점프해 보세요.', hint: '방향키 또는 A/D, 점프는 ↑/W/Space' },
  { id: 'slime', title: '첫 사냥', desc: '기본 공격(J)으로 슬라임을 처치하세요.', hint: '슬라임 가까이에서 J 또는 Z' },
  { id: 'code', title: '첫 코드 마법', desc: '1번 키로 코드 스킬을 발동하세요.', hint: '오른쪽 패널의 슬롯 1 코드가 실행돼요' },
  { id: 'branch', title: '조건문 마법사', desc: '코드로 fireball 과 icebolt 를 모두 써 보세요.', hint: 'if enemy.hp < 30: 처럼 조건에 따라 다른 스킬을!' },
  { id: 'fly', title: '날벌레 퇴치', desc: '하늘을 나는 날벌레를 처치하세요.', hint: '날벌레는 얼음에 약해요' },
  { id: 'golem', title: '골렘의 약점', desc: '블록 골렘을 쓰러뜨려 문을 여세요.', hint: 'if enemy.type == "golem": cast("icebolt")' },
  { id: 'goal', title: '탈출!', desc: '문 너머의 깃발에 도착하세요.', hint: '골렘이 쓰러지면 문이 열려요' },
];
