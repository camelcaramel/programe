// 실행 기록(trace)의 n 번째까지 적용한 맵 상태를 계산한다. 렌더러가 되감기·건너뛰기할 때 쓴다.
import { MONSTER_RULES, barsShouldOpen } from './rules';
import type { BotStep, Level, MonsterKind, Pos, TraceStep } from './types';

export interface BoardState {
  pos: Pos;
  /** 마지막으로 바라본 방향 (왼쪽이면 스프라이트를 뒤집는다) */
  facing: 'left' | 'right';
  hp: number;
  coins: number;
  keys: number;
  turn: number;
  /** revealed: 미믹의 정체가 드러났는지 (드러나기 전에는 상자로 그린다) */
  monsters: { x: number; y: number; kind: MonsterKind; hp: number; maxHp: number; revealed: boolean }[];
  chests: { x: number; y: number; open: boolean }[];
  keyItems: Pos[];
  doors: { x: number; y: number; open: boolean }[];
  /** 비밀 문 (2부) */
  gates: { x: number; y: number; open: boolean }[];
  /** 한 번이라도 읽은 표지판·석판 ("x,y") */
  read: string[];
  /** 조수 로봇 (3부) */
  bots: { id: number; x: number; y: number; facing: 'left' | 'right'; broken: boolean }[];
  /** 창살 (3부) */
  bars: { x: number; y: number; open: boolean }[];
  /** 발판 (3부). pressed: 조수가 올라서 있음 */
  plates: { x: number; y: number; pressed: boolean }[];
}

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

export function initialBoard(level: Level): BoardState {
  const doors: BoardState['doors'] = [];
  const plates: Pos[] = [];
  const barsCells: Pos[] = [];
  level.terrain.forEach((row, y) =>
    row.forEach((t, x) => {
      if (t === 'door') doors.push({ x, y, open: false });
      else if (t === 'plate') plates.push({ x, y });
      else if (t === 'bars') barsCells.push({ x, y });
    }),
  );
  const bots = (level.bots ?? []).map((b, id) => ({ id, x: b.x, y: b.y, facing: 'right' as const, broken: false }));
  const barsOpen = barsShouldOpen(plates, bots, level.monsters.length);
  const state: BoardState = {
    pos: { ...level.start },
    facing: 'right',
    hp: level.playerHp,
    coins: 0,
    keys: 0,
    turn: 0,
    monsters: level.monsters.map((m) => {
      const hp = m.hp ?? MONSTER_RULES[m.kind].hp;
      return { x: m.x, y: m.y, kind: m.kind, hp, maxHp: hp, revealed: m.kind !== 'mimic' };
    }),
    chests: level.chests.map((c) => ({ ...c, open: false })),
    keyItems: level.keys.map((k) => ({ ...k })),
    doors,
    gates: level.gates.map((g) => ({ x: g.x, y: g.y, open: false })),
    read: [],
    bots,
    bars: barsCells.map((c) => ({ ...c, open: barsOpen })),
    plates: [],
  };
  pressPlates(state, plates);
  return state;
}

function pressPlates(state: BoardState, plates: Pos[] = state.plates) {
  state.plates = plates.map((p) => ({ x: p.x, y: p.y, pressed: state.bots.some((b) => same(b, p)) }));
}

/** 몬스터에게 마법 피해 (kill 이면 없앤다). 맞은 미믹은 정체가 드러난다 */
function hurtMonster(state: BoardState, t: Pos, event: string, amount: number | undefined) {
  const m = state.monsters.find((m) => same(m, t));
  if (m) {
    m.hp -= amount ?? 0;
    m.revealed = true;
  }
  if (event === 'kill') state.monsters = state.monsters.filter((m) => !same(m, t));
}

/** 조수 로봇 하나의 행동 적용 */
export function applyBotStep(state: BoardState, b: BotStep): void {
  const bot = state.bots.find((x) => x.id === b.id);
  if (!bot) return;
  if (b.dir === 'left' || b.dir === 'right') bot.facing = b.dir;
  bot.x = b.pos.x;
  bot.y = b.pos.y;
  if (b.broken) bot.broken = true;
  if (b.action === 'cast' && (b.event === 'damage' || b.event === 'kill')) hurtMonster(state, b.target, b.event, b.amount);
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
    case 'scan':
    case 'hit': {
      const m = state.monsters.find((m) => same(m, t));
      if (m) m.revealed = true;
      break;
    }
    case 'damage':
    case 'kill':
      hurtMonster(state, t, step.event, step.amount);
      break;
  }
  if (step.action !== 'wait' && step.by === undefined && (step.dir === 'left' || step.dir === 'right')) state.facing = step.dir;
  state.pos = { ...step.pos };
  state.hp = step.hp;
  state.coins = step.coins;
  state.keys = step.keys;
  state.turn = step.turn;
  if (step.bots) {
    for (const b of step.bots) applyBotStep(state, b);
    pressPlates(state);
  }
  if (step.barsOpen) {
    const open = new Set(step.barsOpen);
    for (const c of state.bars) c.open = open.has(`${c.x},${c.y}`);
  }
}

/** trace 의 앞에서 n 개를 적용한 상태 */
export function boardAt(level: Level, trace: TraceStep[], n: number): BoardState {
  const s = initialBoard(level);
  for (let i = 0; i < Math.min(n, trace.length); i++) applyStep(s, trace[i]);
  return s;
}
