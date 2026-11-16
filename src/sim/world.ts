// 턴제 그리드 시뮬레이터. 학생 API(move·look·cast …)의 실제 규칙이 여기 모두 있다.
// 행동마다 TraceStep 을 남기고, 렌더러는 이 기록만 보고 재생한다.
import { SimInputError, SimStop } from './errors';
import { MONSTER_RULES, SKILLS, SKILL_ELEMENT } from './rules';
import {
  DIRS,
  type Dir,
  type EndReason,
  type GateCode,
  type Level,
  type LookResult,
  type MonsterKind,
  type Pos,
  type RunSummary,
  type SignValue,
  type Skill,
  type Terrain,
  type TraceEvent,
  type TraceStep,
} from './types';

export interface WorldOptions {
  /** 지정하지 않으면 스테이지 값(Level) 사용 */
  maxTurns?: number;
  playerHp?: number;
  /** 지금 실행 중인 학생 코드 줄 번호 (G2 에서 파이썬 추적기가 넘겨줌) */
  getLine?: () => number | null;
}

const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const keyOf = (p: Pos) => `${p.x},${p.y}`;

/** 지나갈 수 없는 지형 (문은 열쇠가 있으면 열림) */
const SOLID: ReadonlySet<Terrain> = new Set(['wall', 'sign', 'tablet', 'gate']);

/** 재생 기록이 너무 길어지지 않도록 read 기록은 이만큼만 남긴다 (값은 계속 돌려줌) */
const MAX_READ_TRACE = 300;

const LOOK_KO: Partial<Record<LookResult, string>> = {
  wall: '벽',
  empty: '빈칸',
  exit: '출구',
  door: '문',
  gate: '비밀 문',
  chest: '보물상자',
  key: '열쇠',
};
export class World {
  readonly trace: TraceStep[] = [];
  readonly maxTurns: number;
  pos: Pos;
  hp: number;
  coins = 0;
  keys = 0;
  turn = 0;

  private readonly terrain: Terrain[][];
  private readonly monsters = new Map<string, { kind: MonsterKind; hp: number }>();
  private readonly chests = new Set<string>();
  private readonly keyItems = new Set<string>();
  private readonly signs = new Map<string, SignValue>();
  private readonly gates = new Map<string, GateCode>();
  private reads = 0;
  private readonly getLine: () => number | null;
  private ended: EndReason | null = null;

  constructor(readonly level: Level, opts: WorldOptions = {}) {
    this.maxTurns = opts.maxTurns ?? level.maxTurns;
    this.hp = opts.playerHp ?? level.playerHp;
    this.getLine = opts.getLine ?? (() => null);
    this.terrain = level.terrain.map((row) => [...row]);
    this.pos = { ...level.start };
    for (const m of level.monsters) this.monsters.set(keyOf(m), { kind: m.kind, hp: MONSTER_RULES[m.kind].hp });
    for (const c of level.chests) this.chests.add(keyOf(c));
    for (const k of level.keys) this.keyItems.add(keyOf(k));
    for (const s of level.signs) this.signs.set(keyOf(s), s.value);
    for (const g of level.gates) this.gates.set(keyOf(g), g.code);
  }

  get status(): 'running' | 'cleared' | 'failed' {
    if (this.ended === null) return 'running';
    return this.ended === 'exit' ? 'cleared' : 'failed';
  }

  get endReason(): EndReason | null {
    return this.ended;
  }

  // ───────── 학생 API ─────────

  /** 1칸 이동 (1턴) */
  move(dir: unknown): void {
    const d = this.checkDir(dir);
    this.beginTurn();
    const t = this.step(d);
    const k = keyOf(t);
    const ter = this.terrainAt(t);

    if (SOLID.has(ter)) return this.record('move', d, 'bump', t, false);
    if (ter === 'door') {
      if (this.keys === 0) return this.record('move', d, 'bump', t, false);
      this.keys--;
      this.terrain[t.y][t.x] = 'floor';
      this.pos = t;
      return this.record('move', d, 'door', t, true);
    }
    const monster = this.monsters.get(k);
    if (monster) {
      const dmg = MONSTER_RULES[monster.kind].contact;
      this.hp = Math.max(0, this.hp - dmg);
      this.record('move', d, 'hit', t, false, dmg);
      if (this.hp === 0) this.end('dead');
      return;
    }

    this.pos = t;
    if (this.chests.delete(k)) {
      this.coins++;
      return this.record('move', d, 'chest', t, true);
    }
    if (this.keyItems.delete(k)) {
      this.keys++;
      return this.record('move', d, 'key', t, true);
    }
    if (ter === 'exit') {
      this.record('move', d, 'exit', t, true);
      this.end('exit');
    }
    this.record('move', d, 'move', t, true);
  }

  /** 옆 칸 살펴보기 (턴을 쓰지 않음) */
  look(dir: unknown): LookResult {
    const d = this.checkDir(dir);
    if (this.ended) throw new SimStop(this.ended);
    const t = this.step(d);
    const k = keyOf(t);
    const monster = this.monsters.get(k);
    if (monster) return monster.kind;
    if (this.chests.has(k)) return 'chest';
    if (this.keyItems.has(k)) return 'key';
    const ter = this.terrainAt(t);
    if (ter === 'floor') return 'empty';
    return ter;
  }

  /** 옆 칸의 몬스터에게 마법 (1턴) */
  cast(skill: unknown, dir: unknown): void {
    const s = this.checkSkill(skill);
    const d = this.checkDir(dir);
    this.beginTurn();
    const t = this.step(d);
    const k = keyOf(t);
    const monster = this.monsters.get(k);
    if (!monster) return this.record('cast', d, 'miss', t, false, undefined, s);
    const dmg = MONSTER_RULES[monster.kind].damage[SKILL_ELEMENT[s]];
    monster.hp -= dmg;
    if (monster.hp <= 0) {
      this.monsters.delete(k);
      return this.record('cast', d, 'kill', t, true, dmg, s);
    }
    this.record('cast', d, 'damage', t, dmg > 0, dmg, s);
  }

  /** 옆 칸 표지판(문자열)·석판(리스트) 읽기 (턴을 쓰지 않음) */
  read(dir: unknown): SignValue {
    const d = this.checkDir(dir);
    if (this.ended) throw new SimStop(this.ended);
    const t = this.step(d);
    const value = this.signs.get(keyOf(t));
    if (value === undefined) {
      const what = this.look(d);
      const name = LOOK_KO[what] ?? what;
      throw new SimInputError(`read() 는 바로 옆 칸의 표지판이나 석판만 읽을 수 있어요. ${d} 쪽은 ${name}이에요.`);
    }
    if (this.reads < MAX_READ_TRACE) {
      this.reads++;
      this.trace.push({ ...this.snapshot('read', d, 'read', t, true), value: copyValue(value) });
    }
    return copyValue(value);
  }

  /**
   * 옆 칸 비밀 문에 암호 넣기 (1턴). 자료형까지 같아야 열린다.
   * 틀리면 경보가 울려 HP −1 (0 이 되면 쓰러짐).
   * shown: 넣은 값을 파이썬 모양으로 (말풍선용). 없으면 JS 값으로 만든다.
   */
  openGate(dir: unknown, code: unknown, shown?: string): void {
    const d = this.checkDir(dir);
    if (this.ended) throw new SimStop(this.ended);
    const t = this.step(d);
    const answer = this.gates.get(keyOf(t));
    if (answer === undefined || this.terrainAt(t) !== 'gate') {
      const what = this.look(d);
      throw new SimInputError(`open_gate() 는 바로 옆 칸의 닫힌 비밀 문에만 쓸 수 있어요. ${d} 쪽은 ${LOOK_KO[what] ?? what}이에요.`);
    }
    this.beginTurn();
    const text = shown ?? (typeof code === 'string' ? JSON.stringify(code) : String(code));
    if (code === answer) {
      this.terrain[t.y][t.x] = 'floor';
      this.trace.push({ ...this.snapshot('gate', d, 'gate_open', t, true), shown: text });
      return;
    }
    this.hp = Math.max(0, this.hp - 1);
    const typeMismatch = (typeof code === 'string' || typeof code === 'number') && typeof code !== typeof answer && String(code) === String(answer);
    this.trace.push({ ...this.snapshot('gate', d, 'gate_wrong', t, false, 1), shown: text, ...(typeMismatch ? { typeMismatch } : {}) });
    if (this.hp === 0) this.end('dead');
  }

  getPos(): Pos {
    return { ...this.pos };
  }

  // ───────── 실행 마무리 ─────────

  /**
   * 학생 코드가 끝난 뒤 부른다. 출구에 못 갔으면 not_reached.
   * failReason: 파이썬 오류·시간 초과처럼 시뮬레이터 밖에서 끝났을 때 (이미 끝난 게임은 바꾸지 않음)
   */
  finish(failReason?: Extract<EndReason, 'error' | 'timeout'>): RunSummary {
    if (this.ended === null) this.ended = failReason ?? 'not_reached';
    return {
      stageId: this.level.stageId,
      seed: this.level.seed,
      cleared: this.ended === 'exit',
      reason: this.ended,
      turns: this.turn,
      hp: this.hp,
      coins: this.coins,
      chestsTotal: this.level.chests.length,
      trace: this.trace,
    };
  }

  // ───────── 내부 ─────────

  private beginTurn() {
    if (this.ended) throw new SimStop(this.ended);
    if (this.turn >= this.maxTurns) this.end('turn_limit');
    this.turn++;
  }

  private end(reason: EndReason): never {
    this.ended = reason;
    throw new SimStop(reason);
  }

  private step(d: Dir): Pos {
    return { x: this.pos.x + DELTA[d].x, y: this.pos.y + DELTA[d].y };
  }

  private terrainAt(p: Pos): Terrain {
    return this.terrain[p.y]?.[p.x] ?? 'wall';
  }

  private record(
    action: TraceStep['action'],
    dir: Dir,
    event: TraceEvent,
    target: Pos,
    ok: boolean,
    amount?: number,
    skill?: Skill,
  ) {
    this.trace.push(this.snapshot(action, dir, event, target, ok, amount, skill));
  }

  private snapshot(
    action: TraceStep['action'],
    dir: Dir,
    event: TraceEvent,
    target: Pos,
    ok: boolean,
    amount?: number,
    skill?: Skill,
  ): TraceStep {
    return {
      turn: this.turn,
      action,
      dir,
      ...(skill ? { skill } : {}),
      event,
      ok,
      pos: { ...this.pos },
      hp: this.hp,
      coins: this.coins,
      keys: this.keys,
      target,
      ...(amount !== undefined ? { amount } : {}),
      line: this.getLine(),
    };
  }

  private checkDir(dir: unknown): Dir {
    if (typeof dir === 'string' && (DIRS as readonly string[]).includes(dir)) return dir as Dir;
    throw new SimInputError(`방향은 "up", "down", "left", "right" 중 하나예요. 받은 값: ${show(dir)}`);
  }

  private checkSkill(skill: unknown): Skill {
    if (typeof skill === 'string' && (SKILLS as string[]).includes(skill)) return skill as Skill;
    throw new SimInputError(`알 수 없는 마법이에요: ${show(skill)}  (사용 가능: ${SKILLS.join(', ')})`);
  }
}

const copyValue = (v: SignValue): SignValue => (Array.isArray(v) ? [...v] : v);

function show(v: unknown): string {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

/** 스크립트(학생 코드 대신 쓰는 함수)를 끝까지 돌리고 결과를 돌려준다. 테스트와 G2 브리지에서 쓴다. */
export function simulate(level: Level, script: (w: World) => void, opts?: WorldOptions): RunSummary {
  const w = new World(level, opts);
  try {
    script(w);
  } catch (e) {
    if (!(e instanceof SimStop)) throw e;
  }
  return w.finish();
}
