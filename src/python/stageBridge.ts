// 파이썬(_run_stage) ↔ JS 시뮬레이터(World) 연결. Worker 와 Node 테스트가 함께 쓴다.
// 파이썬이 api.move(...) 를 부르면 여기서 World 를 움직이고, 예외 대신 문자열로 결과를 알려 준다.
import { SimInputError, SimStop, World, type Level, type RunSummary } from '../sim';

export interface StageLimits {
  /** 시드 하나당 실행 시간 제한(초) */
  time_limit?: number;
  /** 시드 하나당 파이썬 추적 이벤트 수 제한 */
  step_limit?: number;
  /** 이 스테이지에서 쓸 수 있는 명령 이름. 없으면 전부 */
  api?: string[];
}

export interface SeedRun {
  seed: number;
  summary: RunSummary;
  /** print 출력 */
  out: string[];
  /** 학생에게 보여줄 오류 메시지 */
  error: string | null;
  line: number | null;
  kind: 'syntax' | 'runtime' | 'timeout' | 'engine' | null;
}

export interface StageRunResult {
  /** 모든 시드를 클리어했는가 */
  ok: boolean;
  runs: SeedRun[];
}

/** prelude.py 의 _run_stage(code, api, limits_json) -> json 문자열 */
export type PyRunStage = (code: string, api: unknown, limitsJson: string) => string;

interface PyResult {
  ok: boolean;
  error: string | null;
  line: number | null;
  kind: SeedRun['kind'];
  stop: string | null;
  out: string[];
  steps: number;
}

export function runStageWith(runStage: PyRunStage, code: string, levels: Level[], limits: StageLimits = {}): StageRunResult {
  const limitsJson = JSON.stringify(limits);
  const runs = levels.map((level): SeedRun => {
    let line: number | null = null;
    const world = new World(level, { getLine: () => line });
    const guard = (ln: number | null | undefined, fn: () => string): string => {
      line = ln ?? null;
      try {
        return fn();
      } catch (e) {
        if (e instanceof SimStop) return 'STOP:' + e.reason;
        if (e instanceof SimInputError) return 'ERR:' + e.message;
        throw e;
      }
    };
    const api = {
      move: (dir: unknown, ln?: number | null) => guard(ln, () => (world.move(dir), '')),
      cast: (skill: unknown, dir: unknown, ln?: number | null) => guard(ln, () => (world.cast(skill, dir), '')),
      look: (dir: unknown, ln?: number | null) => guard(ln, () => world.look(dir)),
      read: (dir: unknown, ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.read(dir))),
      open_gate: (dir: unknown, kind: string, json: string, shown: string, ln?: number | null) =>
        guard(ln, () => (world.openGate(dir, gateValue(kind, json), shown), '')),
      // 3부: 몬스터 객체, 조수 로봇, 지도
      scan: (dir: unknown, ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.scan(dir))),
      monster_hp: (id: unknown) => world.monsterHp(id),
      wait: (ln?: number | null) => guard(ln, () => (world.wait(), '')),
      get_map: (ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.getMap())),
      needs_round: () => world.needsRound,
      bot_count: () => world.botCount,
      round_begin: () => guard(line, () => (world.roundBegin(), '')),
      round_end: () => guard(line, () => (world.roundEnd(), '')),
      bot_move: (id: number, dir: unknown, ln?: number | null) => guard(ln, () => (world.botMove(id, dir), '')),
      bot_cast: (id: number, skill: unknown, dir: unknown, ln?: number | null) => guard(ln, () => (world.botCast(id, skill, dir), '')),
      bot_look: (id: number, dir: unknown, ln?: number | null) => guard(ln, () => world.botLook(id, dir)),
      bot_read: (id: number, dir: unknown, ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.botRead(id, dir))),
      bot_scan: (id: number, dir: unknown, ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.botScan(id, dir))),
      // 4부: 금고·석상·하노이·통행료
      size: (ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.size())),
      peek: (i: unknown, ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.peek(i))),
      heavier: (i: unknown, j: unknown, ln?: number | null) => guard(ln, () => 'VAL:' + JSON.stringify(world.heavier(i, j))),
      swap: (i: unknown, j: unknown, ln?: number | null) => guard(ln, () => (world.swap(i, j), '')),
      move_disc: (a: unknown, b: unknown, ln?: number | null) => guard(ln, () => (world.moveDisc(a, b), '')),
      pay: (coin: unknown, ln?: number | null) => guard(ln, () => (world.pay(coin), '')),
      hp: () => world.hp,
      coins: () => world.coins,
      keys: () => world.keys,
      x: () => world.pos.x,
      y: () => world.pos.y,
    };

    const r = JSON.parse(runStage(code, api, limitsJson)) as PyResult;
    const summary = world.finish(r.ok ? undefined : r.kind === 'timeout' ? 'timeout' : 'error');
    return { seed: level.seed, summary, out: r.out, error: r.error, line: r.line, kind: r.kind };
  });
  return { ok: runs.every((r) => r.summary.cleared), runs };
}

/**
 * 파이썬이 넘긴 암호(종류, JSON)를 JS 값으로. int·str 만 그대로 바꾸고,
 * 나머지(float·bool·list …)는 어떤 암호와도 같지 않은 표시 객체로 만든다 (자료형까지 비교하기 위해).
 */
function gateValue(kind: string, json: string): unknown {
  if (kind === 'int' || kind === 'str') return JSON.parse(json);
  return { pythonType: kind };
}

/** 워커가 강제로 멈췄을 때처럼 파이썬 결과가 아예 없을 때의 결과 */
export function failedStageResult(levels: Level[], error: string, kind: 'timeout' | 'engine'): StageRunResult {
  return {
    ok: false,
    runs: levels.map((level) => ({
      seed: level.seed,
      summary: new World(level).finish(kind === 'timeout' ? 'timeout' : 'error'),
      out: [],
      error,
      line: null,
      kind,
    })),
  };
}
