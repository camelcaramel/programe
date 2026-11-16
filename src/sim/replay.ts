// 실행 기록(trace)의 n 번째까지 적용한 맵 상태를 계산한다. 렌더러가 되감기·건너뛰기할 때 쓴다.
import { MONSTER_RULES } from './rules';
import type { Level, MonsterKind, Pos, TraceStep } from './types';

export interface BoardState {
  pos: Pos;
  /** 마지막으로 바라본 방향 (왼쪽이면 스프라이트를 뒤집는다) */
  facing: 'left' | 'right';
  hp: number;
  coins: number;
  keys: number;
  turn: number;
  monsters: { x: number; y: number; kind: MonsterKind; hp: number; maxHp: number }[];
  chests: { x: number; y: number; open: boolean }[];
  keyItems: Pos[];
  doors: { x: number; y: number; open: boolean }[];
  /** 비밀 문 (2부) */
  gates: { x: number; y: number; open: boolean }[];
  /** 한 번이라도 읽은 표지판·석판 ("x,y") */
  read: string[];
}

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

export function initialBoard(level: Level): BoardState {
  const doors: BoardState['doors'] = [];
  level.terrain.forEach((row, y) => row.forEach((t, x) => t === 'door' && doors.push({ x, y, open: false })));
  return {
    pos: { ...level.start },
    facing: 'right',
    hp: level.playerHp,
    coins: 0,
    keys: 0,
    turn: 0,
    monsters: level.monsters.map((m) => ({ ...m, hp: MONSTER_RULES[m.kind].hp, maxHp: MONSTER_RULES[m.kind].hp })),
    chests: level.chests.map((c) => ({ ...c, open: false })),
    keyItems: level.keys.map((k) => ({ ...k })),
    doors,
    gates: level.gates.map((g) => ({ x: g.x, y: g.y, open: false })),
    read: [],
  };
}

/** state 에 trace 한 칸을 적용 (state 를 직접 바꾼다) */
export function applyStep(state: BoardState, step: TraceStep): void {
  const t = step.target;
  switch (step.event) {
    case 'chest': {
      const c = state.chests.find((c) => same(c, t));
      if (c) c.open = true;
      break;
    }
    case 'key':
      state.keyItems = state.keyItems.filter((k) => !same(k, t));
      break;
    case 'door': {
      const d = state.doors.find((d) => same(d, t));
      if (d) d.open = true;
      break;
    }
    case 'gate_open': {
      const g = state.gates.find((g) => same(g, t));
      if (g) g.open = true;
      break;
    }
    case 'read': {
      const k = `${t.x},${t.y}`;
      if (!state.read.includes(k)) state.read = [...state.read, k];
      break;
    }
    case 'damage':
    case 'kill': {
      const m = state.monsters.find((m) => same(m, t));
      if (m) m.hp -= step.amount ?? 0;
      if (step.event === 'kill') state.monsters = state.monsters.filter((m) => !same(m, t));
      break;
    }
  }
  if (step.dir === 'left' || step.dir === 'right') state.facing = step.dir;
  state.pos = { ...step.pos };
  state.hp = step.hp;
  state.coins = step.coins;
  state.keys = step.keys;
  state.turn = step.turn;
}

/** trace 의 앞에서 n 개를 적용한 상태 */
export function boardAt(level: Level, trace: TraceStep[], n: number): BoardState {
  const s = initialBoard(level);
  for (let i = 0; i < Math.min(n, trace.length); i++) applyStep(s, trace[i]);
  return s;
}
