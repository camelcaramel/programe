// 턴제 그리드 시뮬레이터. 학생 API(move·look·cast …)의 실제 규칙이 여기 모두 있다.
// 행동마다 TraceStep 을 남기고, 렌더러는 이 기록만 보고 재생한다.
//
// 3부의 조수 로봇: 마법사가 1턴을 쓴 뒤 파이썬이 roundBegin() → 조수마다 act() (botMove·botCast …) → roundEnd() 를 부른다.
// 조수들이 한 일은 그 턴의 마법사 기록(TraceStep.bots)에 붙여서, 화면에서는 함께 움직인다.
import { SimInputError, SimStop } from './errors';
import { MONSTER_RULES, SKILLS, SKILL_ELEMENT, WEAK_DAMAGE, barsShouldOpen, defaultWeak } from './rules';
import {
  DIRS,
  type BotStep,
  type Dir,
  type EndReason,
  type GateCode,
  type Level,
  type LookResult,
  type MonsterInfo,
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
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/** 지나갈 수 없는 지형 (문은 열쇠가 있으면 열림, 창살은 열려 있을 때만) */
const SOLID: ReadonlySet<Terrain> = new Set(['wall', 'sign', 'tablet', 'gate']);

/** 재생 기록이 너무 길어지지 않도록 read·scan 기록은 이만큼만 남긴다 (값은 계속 돌려줌) */
const MAX_READ_TRACE = 300;

const LOOK_KO: Partial<Record<LookResult, string>> = {
  wall: '벽',
  empty: '빈칸',
  exit: '출구',
  door: '문',
  gate: '비밀 문',
  chest: '보물상자',
  key: '열쇠',
  bars: '창살',
  bot: '조수 로봇',
  wizard: '마법사',
};

interface MonsterState {
  id: string;
  kind: MonsterKind;
  hp: number;
  maxHp: number;
  /** 변이 몬스터의 약점 (없으면 1·2부 규칙) */
  weak?: Skill;
}

interface BotState {
  id: number;
  pos: Pos;
  /** 약점이 아닌 마법을 써서 반격을 받아 고장 남 (더는 움직이지 않음) */
  broken: boolean;
  /** 이번 턴에 이미 움직이거나 마법을 썼는지 */
  acted: boolean;
}

export class World {
  readonly trace: TraceStep[] = [];
  readonly maxTurns: number;
  pos: Pos;
  hp: number;
  coins = 0;
  keys = 0;
  turn = 0;

  private readonly terrain: Terrain[][];
  private readonly monsters = new Map<string, MonsterState>();
  private readonly chests = new Set<string>();
  private readonly keyItems = new Set<string>();
  private readonly signs = new Map<string, SignValue>();
  private readonly gates = new Map<string, GateCode>();
  private readonly bots: BotState[];
  private readonly plates: Pos[] = [];
  private readonly barsCells: Pos[] = [];
  private readonly barsOpen = new Set<string>();
  private reads = 0;
  private scans = 0;
  private inRound = false;
  private roundSteps: BotStep[] = [];
  private readonly getLine: () => number | null;
  private ended: EndReason | null = null;

  constructor(readonly level: Level, opts: WorldOptions = {}) {
    this.maxTurns = opts.maxTurns ?? level.maxTurns;
    this.hp = opts.playerHp ?? level.playerHp;
    this.getLine = opts.getLine ?? (() => null);
    this.terrain = level.terrain.map((row) => [...row]);
    this.pos = { ...level.start };
    for (const m of level.monsters) {
      const hp = m.hp ?? MONSTER_RULES[m.kind].hp;
      this.monsters.set(keyOf(m), { id: keyOf(m), kind: m.kind, hp, maxHp: hp, ...(m.weak ? { weak: m.weak } : {}) });
    }
    for (const c of level.chests) this.chests.add(keyOf(c));
    for (const k of level.keys) this.keyItems.add(keyOf(k));
    for (const s of level.signs) this.signs.set(keyOf(s), s.value);
    for (const g of level.gates) this.gates.set(keyOf(g), g.code);
    this.bots = (level.bots ?? []).map((b, id) => ({ id, pos: { ...b }, broken: false, acted: false }));
    this.terrain.forEach((row, y) =>
      row.forEach((t, x) => {
        if (t === 'plate') this.plates.push({ x, y });
        else if (t === 'bars') this.barsCells.push({ x, y });
      }),
    );
    this.updateBars();
  }

  get status(): 'running' | 'cleared' | 'failed' {
    if (this.ended === null) return 'running';
    return this.ended === 'exit' ? 'cleared' : 'failed';
  }

  get endReason(): EndReason | null {
    return this.ended;
  }

  /** 조수 로봇이나 창살이 있어서, 마법사가 턴을 쓸 때마다 roundBegin/roundEnd 를 불러야 하는지 */
  get needsRound(): boolean {
    return this.bots.length > 0 || this.barsCells.length > 0;
  }

  get botCount(): number {
    return this.bots.length;
  }

  // ───────── 학생 API ─────────

  /** 1칸 이동 (1턴) */
  move(dir: unknown): void {
    const d = this.checkDir(dir);
    this.beginTurn();
    const t = this.step(d);
    const k = keyOf(t);
    const ter = this.terrainAt(t);

    if (SOLID.has(ter) || (ter === 'bars' && !this.barsOpen.has(k)) || this.botAt(t))
      return this.record('move', d, 'bump', t, false);
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
    return this.cellName(this.step(d));
  }

  /** 옆 칸의 몬스터에게 마법 (1턴). 변이 몬스터에게 약점이 아닌 마법을 쓰면 반격으로 HP −1 */
  cast(skill: unknown, dir: unknown): void {
    const s = this.checkSkill(skill);
    const d = this.checkDir(dir);
    this.beginTurn();
    const t = this.step(d);
    const monster = this.monsters.get(keyOf(t));
    if (!monster) return this.record('cast', d, 'miss', t, false, undefined, s);
    const { event, dmg, counter } = this.hitMonster(monster, s);
    if (!counter) return this.record('cast', d, event, t, dmg > 0, dmg, s);
    this.hp = Math.max(0, this.hp - 1);
    this.trace.push({ ...this.snapshot('cast', d, event, t, false, dmg, s), counter: 1 });
    if (this.hp === 0) this.end('dead');
  }

  /** 옆 칸 표지판(문자열)·석판(리스트) 읽기 (턴을 쓰지 않음) */
  read(dir: unknown): SignValue {
    const d = this.checkDir(dir);
    if (this.ended) throw new SimStop(this.ended);
    const t = this.step(d);
    const value = this.readAt(t, d);
    if (this.reads < MAX_READ_TRACE) {
      this.reads++;
      this.trace.push({ ...this.snapshot('read', d, 'read', t, true), value: copyValue(value) });
    }
    return copyValue(value);
  }

  /**
   * 옆 칸 몬스터 정보 (턴을 쓰지 않음). 몬스터가 없으면 null.
   * 미믹도 정체를 알 수 있다. scanLimit 이 있는 맵에서는 부를 때마다 수정구 1번을 쓴다.
   */
  scan(dir: unknown): MonsterInfo | null {
    const d = this.checkDir(dir);
    if (this.ended) throw new SimStop(this.ended);
    const limit = this.level.scanLimit;
    if (limit !== undefined && this.scans >= limit)
      throw new SimInputError(`수정구의 힘을 다 썼어요! 이 맵에서 scan() 은 ${limit}번만 쓸 수 있어요. 한 번 알아낸 약점은 적어 두고 다시 쓰세요.`);
    this.scans++;
    const t = this.step(d);
    const info = this.infoAt(t);
    if (info && this.reads < MAX_READ_TRACE) {
      this.reads++;
      this.trace.push({ ...this.snapshot('scan', d, 'scan', t, true), info });
    }
    return info;
  }

  /** scan() 으로 받은 몬스터의 지금 HP (처치했으면 0) */
  monsterHp(id: unknown): number {
    for (const m of this.monsters.values()) if (m.id === id) return m.hp;
    return 0;
  }

  /** 한 턴 쉬기 (1턴. 조수 로봇들은 움직인다) */
  wait(): void {
    this.beginTurn();
    this.record('wait', 'down', 'wait', this.pos, true);
  }

  /** 지금 맵 전체를 look() 과 같은 낱말로: grid[y][x] */
  getMap(): string[][] {
    if (this.ended) throw new SimStop(this.ended);
    return this.terrain.map((row, y) => row.map((_, x) => (same({ x, y }, this.pos) ? 'empty' : this.cellName({ x, y }))));
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

  // ───────── 조수 로봇 (3부) ─────────

  /** 마법사가 1턴을 쓴 뒤, 조수들의 act() 를 부르기 전에 */
  roundBegin(): void {
    if (this.ended) throw new SimStop(this.ended);
    this.inRound = true;
    this.roundSteps = [];
    for (const b of this.bots) b.acted = false;
  }

  /** 조수들의 act() 가 모두 끝난 뒤: 창살을 다시 정하고, 이번 턴 기록에 붙인다 */
  roundEnd(): void {
    this.inRound = false;
    this.updateBars();
    const last = this.trace[this.trace.length - 1];
    if (!last || last.turn !== this.turn) return;
    if (this.roundSteps.length > 0) last.bots = this.roundSteps;
    if (this.barsCells.length > 0) last.barsOpen = [...this.barsOpen].sort();
    this.roundSteps = [];
  }

  botMove(id: unknown, dir: unknown): void {
    const bot = this.botForAction(id);
    const d = this.checkDir(dir);
    if (bot.broken) return;
    bot.acted = true;
    const t = { x: bot.pos.x + DELTA[d].x, y: bot.pos.y + DELTA[d].y };
    const ter = this.terrainAt(t);
    const k = keyOf(t);
    const blocked =
      SOLID.has(ter) ||
      ter === 'door' ||
      (ter === 'bars' && !this.barsOpen.has(k)) ||
      this.monsters.has(k) ||
      this.chests.has(k) ||
      this.keyItems.has(k) ||
      same(t, this.pos) ||
      !!this.botAt(t);
    if (!blocked) bot.pos = t;
    this.roundSteps.push({ id: bot.id, action: 'move', dir: d, event: blocked ? 'bump' : 'move', pos: { ...bot.pos }, target: t });
  }

  botCast(id: unknown, skill: unknown, dir: unknown): void {
    const bot = this.botForAction(id);
    const s = this.checkSkill(skill);
    const d = this.checkDir(dir);
    if (bot.broken) return;
    bot.acted = true;
    const t = { x: bot.pos.x + DELTA[d].x, y: bot.pos.y + DELTA[d].y };
    const monster = this.monsters.get(keyOf(t));
    const base = { id: bot.id, action: 'cast' as const, dir: d, skill: s, pos: { ...bot.pos }, target: t };
    if (!monster) {
      this.roundSteps.push({ ...base, event: 'miss' });
      return;
    }
    const { event, dmg, counter } = this.hitMonster(monster, s);
    if (counter) bot.broken = true;
    this.roundSteps.push({ ...base, event, amount: dmg, ...(counter ? { broken: true } : {}) });
  }

  botLook(id: unknown, dir: unknown): LookResult {
    const bot = this.botById(id);
    return this.cellName(this.botStep(bot, dir));
  }

  botRead(id: unknown, dir: unknown): SignValue {
    const bot = this.botById(id);
    const d = this.checkDir(dir);
    const t = this.botStep(bot, d);
    const value = this.readAt(t, d);
    // 재생 때 표지판 위 말풍선이 보이도록 마법사의 읽기처럼 남긴다 (위치는 표지판 칸)
    if (this.reads < MAX_READ_TRACE) {
      this.reads++;
      this.trace.push({ ...this.snapshot('read', d, 'read', t, true), value: copyValue(value), by: bot.id });
    }
    return copyValue(value);
  }

  botScan(id: unknown, dir: unknown): MonsterInfo | null {
    const bot = this.botById(id);
    return this.infoAt(this.botStep(bot, dir));
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

  private botAt(p: Pos): BotState | undefined {
    return this.bots.find((b) => same(b.pos, p));
  }

  /** 칸에 무엇이 있는지 look() 낱말로 (미믹은 상자로 보인다) */
  private cellName(t: Pos): LookResult {
    const k = keyOf(t);
    const monster = this.monsters.get(k);
    if (monster) return monster.kind === 'mimic' ? 'chest' : monster.kind;
    if (this.botAt(t)) return 'bot';
    if (same(t, this.pos)) return 'wizard';
    if (this.chests.has(k)) return 'chest';
    if (this.keyItems.has(k)) return 'key';
    const ter = this.terrainAt(t);
    if (ter === 'floor' || ter === 'plate') return 'empty';
    if (ter === 'bars') return this.barsOpen.has(k) ? 'empty' : 'bars';
    return ter;
  }

  private readAt(t: Pos, d: Dir): SignValue {
    const value = this.signs.get(keyOf(t));
    if (value === undefined) {
      const what = this.cellName(t);
      const name = LOOK_KO[what] ?? what;
      throw new SimInputError(`read() 는 바로 옆 칸의 표지판이나 석판만 읽을 수 있어요. ${d} 쪽은 ${name}이에요.`);
    }
    return value;
  }

  private infoAt(t: Pos): MonsterInfo | null {
    const m = this.monsters.get(keyOf(t));
    if (!m) return null;
    return { id: m.id, kind: m.kind, hp: m.hp, max_hp: m.maxHp, weak: m.weak ?? defaultWeak(m.kind) };
  }

  /** 마법 한 방. 변이 몬스터는 약점이면 2 피해, 아니면 0 피해 + 반격 */
  private hitMonster(monster: MonsterState, s: Skill): { event: 'damage' | 'kill'; dmg: number; counter: boolean } {
    const dmg = monster.weak ? (s === monster.weak ? WEAK_DAMAGE : 0) : MONSTER_RULES[monster.kind].damage[SKILL_ELEMENT[s]];
    monster.hp = Math.max(0, monster.hp - dmg);
    if (monster.hp === 0) {
      this.monsters.delete(monster.id);
      return { event: 'kill', dmg, counter: false };
    }
    return { event: 'damage', dmg, counter: !!monster.weak && dmg === 0 };
  }

  private updateBars() {
    if (this.barsCells.length === 0) return;
    const open = barsShouldOpen(
      this.plates,
      this.bots.map((b) => b.pos),
      this.monsters.size,
    );
    for (const c of this.barsCells) {
      const k = keyOf(c);
      if (open) this.barsOpen.add(k);
      else if (!same(c, this.pos) && !this.botAt(c)) this.barsOpen.delete(k);
    }
  }

  private botById(id: unknown): BotState {
    if (this.ended) throw new SimStop(this.ended);
    const bot = typeof id === 'number' ? this.bots[id] : undefined;
    if (!bot) throw new SimInputError(`조수 로봇 번호가 잘못됐어요: ${show(id)}`);
    return bot;
  }

  private botForAction(id: unknown): BotState {
    const bot = this.botById(id);
    if (!this.inRound)
      throw new SimInputError('조수 로봇은 hire() 로 고용한 조수의 act() 안에서만 움직이거나 마법을 쓸 수 있어요.');
    if (bot.acted) throw new SimInputError('조수 로봇은 한 턴에 한 번만 움직이거나 마법을 쓸 수 있어요.');
    return bot;
  }

  private botStep(bot: BotState, dir: unknown): Pos {
    const d = this.checkDir(dir);
    return { x: bot.pos.x + DELTA[d].x, y: bot.pos.y + DELTA[d].y };
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
