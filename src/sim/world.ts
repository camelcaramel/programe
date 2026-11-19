// 턴제 그리드 시뮬레이터. 학생 API(move·look·cast …)의 실제 규칙이 여기 모두 있다.
// 행동마다 TraceStep 을 남기고, 렌더러는 이 기록만 보고 재생한다.
//
// 3부의 로봇: 마법사가 1턴을 쓴 뒤 파이썬이 roundBegin() → 로봇마다 act() (botMove·botCast …) → roundEnd() 를 부른다.
// 로봇들이 한 일은 그 턴의 마법사 기록(TraceStep.bots)에 붙여서, 화면에서는 함께 움직인다.
import { SimInputError, SimStop } from './errors';
import { COINS, MONSTER_RULES, PEG_NAMES, SKILLS, SKILL_ELEMENT, WEAK_DAMAGE, barsOpenFor, defaultWeak } from './rules';
import {
  DIRS,
  type AlgoCounts,
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
const SOLID: ReadonlySet<Terrain> = new Set(['wall', 'sign', 'tablet', 'gate', 'vault', 'statue', 'pillar', 'toll']);

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
  bot: '로봇',
  wizard: '마법사',
  vault: '금고',
  statue: '석상',
  pillar: '기둥',
  toll: '요금 문',
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
  /** 4부: 금고 숫자·석상 무게 (번호 순서, swap 하면 바뀜) */
  private readonly rowValues: number[];
  /** 4부: 기둥별 원판 (아래→위, 1 = 가장 작음) */
  private readonly pegs: number[][];
  /** 4부: 요금 문 "x,y" → 통행료·낸 돈 */
  private readonly tolls = new Map<string, { fee: number; paid: number }>();
  readonly counts: AlgoCounts = { peek: 0, weigh: 0, swap: 0 };
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
    this.rowValues = [...(level.row?.values ?? [])];
    this.pegs = level.pillars ? [Array.from({ length: level.discs ?? 0 }, (_, i) => (level.discs ?? 0) - i), [], []] : [];
    for (const t of level.tolls ?? []) this.tolls.set(keyOf(t), { fee: t.fee, paid: 0 });
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

  /** 로봇이나 창살이 있어서, 마법사가 턴을 쓸 때마다 roundBegin/roundEnd 를 불러야 하는지 */
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

  /** 한 턴 쉬기 (1턴. 로봇들은 움직인다) */
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

  // ───────── 알고리즘 (4부) ─────────

  /** 금고·석상 개수, 없으면 하노이 원판 수 */
  size(): number {
    if (this.ended) throw new SimStop(this.ended);
    if (this.level.row) return this.rowValues.length;
    if (this.level.pillars) return this.level.discs ?? 0;
    throw new SimInputError('size() 는 금고·석상·하노이 원판이 있는 맵에서만 쓸 수 있어요.');
  }

  /** i 번 금고 속 숫자 (턴을 쓰지 않음). peekLimit 이 있으면 부를 때마다 1번씩 쓴다 */
  peek(i: unknown): number {
    if (this.ended) throw new SimStop(this.ended);
    const row = this.level.row;
    if (row?.kind !== 'vault') throw new SimInputError('peek() 는 금고가 있는 맵에서만 쓸 수 있어요.');
    const idx = this.checkIndex(i, '금고');
    const limit = this.level.peekLimit;
    if (limit !== undefined && this.counts.peek >= limit)
      throw new SimInputError(
        `들여다보기 힘을 다 썼어요! 이 맵에서 peek() 은 ${limit}번만 쓸 수 있어요. 찾으면 바로 멈추고(break), 정렬된 금고라면 가운데를 보고 절반씩 버려 보세요.`,
      );
    this.counts.peek++;
    const num = this.rowValues[idx];
    this.pushAlgo(limit, { ...this.snapshot('peek', 'down', 'peek', row.cells[idx], true), index: idx, num });
    return num;
  }

  /** 저울: i 번 석상이 j 번보다 무거운가 (턴을 쓰지 않음). 같은 번호끼리는 저울을 쓰지 않고 False */
  heavier(i: unknown, j: unknown): boolean {
    if (this.ended) throw new SimStop(this.ended);
    const row = this.statueRow('heavier');
    const a = this.checkIndex(i, '석상');
    const b = this.checkIndex(j, '석상');
    if (a === b) return false;
    const limit = this.level.weighLimit;
    if (limit !== undefined && this.counts.weigh >= limit)
      throw new SimInputError(
        `저울을 ${limit}번 다 썼어요! 이 맵에서 heavier() 는 ${limit}번만 쓸 수 있어요. 이미 비교한 것을 또 재고 있지 않은지 살펴보세요.`,
      );
    this.counts.weigh++;
    const result = this.rowValues[a] > this.rowValues[b];
    this.pushAlgo(limit, { ...this.snapshot('weigh', 'down', 'weigh', row.cells[a], true), pair: [a, b], heavier: result });
    return result;
  }

  /** 두 석상의 자리 바꾸기 (1턴) */
  swap(i: unknown, j: unknown): void {
    if (this.ended) throw new SimStop(this.ended);
    const row = this.statueRow('swap');
    const a = this.checkIndex(i, '석상');
    const b = this.checkIndex(j, '석상');
    if (this.level.adjacentOnly && Math.abs(a - b) !== 1)
      throw new SimInputError(`이 방에서는 이웃한 석상끼리만 바꿀 수 있어요: swap(i, i + 1). 받은 값: swap(${a}, ${b})`);
    const limit = this.level.swapLimit;
    if (limit !== undefined && this.counts.swap >= limit)
      throw new SimInputError(
        `석상이 너무 무거워서 ${limit}번까지만 바꿀 수 있어요! 한 자리마다 딱 한 번만 바꾸는 방법(남은 것 중 가장 가벼운 것을 찾아 앞으로)을 생각해 보세요.`,
      );
    this.beginTurn();
    this.counts.swap++;
    [this.rowValues[a], this.rowValues[b]] = [this.rowValues[b], this.rowValues[a]];
    this.trace.push({ ...this.snapshot('swap', 'down', 'swap', row.cells[a], true), pair: [a, b] });
  }

  /** 하노이: 기둥 a 맨 위 원판을 기둥 b 로 (1턴). 큰 원판을 작은 원판 위에 놓으면 오류 */
  moveDisc(a: unknown, b: unknown): void {
    if (this.ended) throw new SimStop(this.ended);
    const pillars = this.level.pillars;
    if (!pillars) throw new SimInputError('move_disc() 는 하노이 기둥이 있는 맵에서만 쓸 수 있어요.');
    const from = this.checkPeg(a);
    const to = this.checkPeg(b);
    if (from === to) throw new SimInputError(`같은 기둥으로는 옮길 수 없어요: move_disc(${show(a)}, ${show(b)})`);
    const src = this.pegs[from];
    const dst = this.pegs[to];
    if (src.length === 0) throw new SimInputError(`${PEG_NAMES[from]} 기둥에는 원판이 없어요.`);
    const disc = src[src.length - 1];
    if (dst.length > 0 && dst[dst.length - 1] < disc)
      throw new SimInputError(
        `큰 원판(${disc})을 작은 원판(${dst[dst.length - 1]}) 위에 놓을 수 없어요: ${PEG_NAMES[from]} → ${PEG_NAMES[to]}`,
      );
    this.beginTurn();
    dst.push(src.pop()!);
    this.trace.push({ ...this.snapshot('disc', 'down', 'disc', pillars[to], true), from, to, size: disc });
  }

  /** 옆 칸 요금 문에 동전 하나 (1턴). 딱 맞으면 열리고, 넘치면 경보로 쓰러진다 */
  pay(coin: unknown): void {
    if (this.ended) throw new SimStop(this.ended);
    if (typeof coin !== 'number' || !(COINS as readonly number[]).includes(coin))
      throw new SimInputError(`동전은 ${COINS.join(', ')} 원짜리만 있어요. 받은 값: ${show(coin)}`);
    const d = DIRS.find((d) => this.terrainAt(this.step(d)) === 'toll');
    if (!d) throw new SimInputError('pay() 는 요금 문 바로 옆에서만 쓸 수 있어요.');
    const t = this.step(d);
    const toll = this.tolls.get(keyOf(t))!;
    this.beginTurn();
    toll.paid += coin;
    const base = { coin, paid: toll.paid, fee: toll.fee };
    if (toll.paid > toll.fee) {
      this.hp = 0;
      this.trace.push({ ...this.snapshot('pay', d, 'pay_over', t, false), ...base });
      this.end('dead');
    }
    const opened = toll.paid === toll.fee;
    if (opened) this.terrain[t.y][t.x] = 'floor';
    this.trace.push({ ...this.snapshot('pay', d, 'pay', t, true), ...base, opened });
  }

  // ───────── 로봇 (3부) ─────────

  /** 마법사가 1턴을 쓴 뒤, 로봇들의 act() 를 부르기 전에 */
  roundBegin(): void {
    if (this.ended) throw new SimStop(this.ended);
    this.inRound = true;
    this.roundSteps = [];
    for (const b of this.bots) b.acted = false;
  }

  /** 로봇들의 act() 가 모두 끝난 뒤: 창살을 다시 정하고, 이번 턴 기록에 붙인다 */
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
      ...(this.level.row ? { counts: { ...this.counts } } : {}),
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
    const open = barsOpenFor(this.level.barsRule, {
      plates: this.plates,
      bots: this.bots.map((b) => b.pos),
      monstersLeft: this.monsters.size,
      chestsLeft: this.chests.size,
      values: this.rowValues,
      pegs: this.pegs,
      discs: this.level.discs,
    });
    for (const c of this.barsCells) {
      const k = keyOf(c);
      if (open) this.barsOpen.add(k);
      else if (!same(c, this.pos) && !this.botAt(c)) this.barsOpen.delete(k);
    }
  }

  /** 4부 번호 확인: 0 이상 개수 미만의 정수 */
  private checkIndex(i: unknown, what: string): number {
    const n = this.rowValues.length;
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= n)
      throw new SimInputError(`${what} 번호는 0 부터 ${n - 1} 까지예요 (${what} ${n}개, 번호는 0부터 세요). 받은 값: ${show(i)}`);
    return i;
  }

  private checkPeg(p: unknown): number {
    const i = typeof p === 'string' ? (PEG_NAMES as readonly string[]).indexOf(p) : -1;
    if (i < 0) throw new SimInputError(`기둥 이름은 "A", "B", "C" 중 하나예요. 받은 값: ${show(p)}`);
    return i;
  }

  private statueRow(cmd: string) {
    const row = this.level.row;
    if (row?.kind !== 'statue') throw new SimInputError(`${cmd}() 는 석상이 있는 맵에서만 쓸 수 있어요.`);
    return row;
  }

  /** 0턴 기록(peek·weigh). 횟수 제한이 없으면 재생 기록이 너무 길어지지 않게 줄인다 */
  private pushAlgo(limit: number | undefined, step: TraceStep) {
    if (limit === undefined) {
      if (this.reads >= MAX_READ_TRACE) return;
      this.reads++;
    }
    this.trace.push(step);
  }

  private botById(id: unknown): BotState {
    if (this.ended) throw new SimStop(this.ended);
    const bot = typeof id === 'number' ? this.bots[id] : undefined;
    if (!bot) throw new SimInputError(`로봇 번호가 잘못됐어요: ${show(id)}`);
    return bot;
  }

  private botForAction(id: unknown): BotState {
    const bot = this.botById(id);
    if (!this.inRound)
      throw new SimInputError('로봇은 hire() 로 고용한 객체의 act() 안에서만 움직이거나 마법을 쓸 수 있어요.');
    if (bot.acted) throw new SimInputError('로봇은 한 턴에 한 번만 움직이거나 마법을 쓸 수 있어요.');
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
