// 디자인 시스템 색 토큰 — JS 쪽(Phaser 게임 화면, Monaco 에디터)에서 쓰는 값.
// 이름은 style.css :root 의 --이름 을 camelCase 로 바꾼 것이고 값도 같아야 한다 (tokens.test.ts 가 검사).
export const COLOR = {
  ink: '#353541',
  gold: '#ffc533',
  goldLight: '#ffe07a',
  red: '#e54341',
  slate: '#2e2d3d',
  slate2: '#38374a',
  dungeon: '#2a2236',
  lavender: '#cfc8e6',
  dusk: '#8d8aa6',
  slateText: '#ecebf7',
  slateLine: '#6b6884',
  slateThumb: '#55546b',
  // 에디터 (Monaco)
  synComment: '#b4b0cf',
  synKeyword: '#ff8fb8',
  synString: '#7ee2a0',
  editorSelection: '#57538a',
  editorBorder: '#1f1e2a',
  editorIndent: '#3f3e52',
  // 게임 효과 (Phaser)
  fxFire: '#ff8a3d',
  fxIce: '#7fd8ff',
  fxSpark: '#ffd34d',
  fxHurt: '#ff6b6b',
  fxDamage: '#ff8f8f',
  fxBump: '#d9d4ef',
  fxNoeffect: '#c9c4de',
} as const;

export type ColorName = keyof typeof COLOR;

/** Phaser 용 숫자 색 ('#ffc533' → 0xffc533) */
export const hex = (c: string): number => parseInt(c.slice(1, 7), 16);

/** Monaco 토큰 규칙용 '#' 없는 색 ('#ffc533' → 'ffc533') */
export const bare = (c: string): string => c.slice(1);

/** 투명도 붙인 색 ('#55546b', 0x88 → '#55546b88') */
export const withAlpha = (c: string, a: number): string => c + a.toString(16).padStart(2, '0');

/** Phaser setTint 에서 "물들이지 않음" */
export const NO_TINT = 0xffffff;
