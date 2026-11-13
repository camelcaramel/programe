// 메인 스레드 쪽 파이썬 실행기: 워커 관리, 실행 큐, 강제 타임아웃(워커 재시작)
import type { SkillName } from '../game/data';
import type { Level } from '../sim';
import { uiStore } from '../state/store';
import { failedStageResult, type StageLimits, type StageRunResult } from './stageBridge';

export interface EnemyInfo { exists: boolean; hp: number; max_hp: number; type: string; distance: number }
export interface RunPayload {
  code: string;
  enemy: EnemyInfo;
  player: { hp: number; mp: number; max_hp: number; max_mp: number };
}
export interface RunResult {
  ok: boolean;
  casts: SkillName[];
  out: string[];
  error?: string;
  line?: number | null;
  kind?: string;
}

const HARD_TIMEOUT_MS = 2000; // 파이썬 내부 제한(0.5초)을 넘어 워커가 멈췄을 때의 최후 수단
/** 스테이지: 시드 하나당 파이썬 내부 제한 */
const STAGE_SEED_TIME_LIMIT = 0.5;
const STAGE_STEP_LIMIT = 100000;

const TIMEOUT_MSG = '코드가 너무 오래 실행돼서 강제로 멈췄어요. 끝나지 않는 반복문이 있는지 확인하세요.';
const NOT_READY_MSG = '파이썬 엔진을 준비하는 중이에요. 잠시 후 다시 시도하세요.';

interface Pending {
  resolve: (r: unknown) => void;
  /** 워커가 응답하지 못했을 때 돌려줄 결과 */
  fail: (error: string, kind: 'timeout' | 'engine') => unknown;
}

class PythonRunner {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private chain: Promise<unknown> = Promise.resolve();
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    this.spawn();
  }

  private spawn() {
    uiStore.set({ pythonStatus: 'loading' });
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') uiStore.set({ pythonStatus: 'ready' });
      else if (m.type === 'initError') {
        console.error('[python]', m.error);
        uiStore.set({ pythonStatus: 'error' });
      } else if (m.type === 'result' || m.type === 'error') {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        p.resolve(m.type === 'result' ? m.result : p.fail(m.error, 'engine'));
      }
    };
    w.onerror = (e) => {
      console.error('[python worker]', e.message);
      uiStore.set({ pythonStatus: 'error' });
    };
    const indexURL = new URL(import.meta.env.BASE_URL + 'pyodide/', location.href).href;
    w.postMessage({ type: 'init', indexURL });
  }

  private restart() {
    this.worker?.terminate();
    for (const p of this.pending.values()) p.resolve(p.fail('엔진을 다시 시작했어요.', 'engine'));
    this.pending.clear();
    this.spawn();
  }

  get ready() {
    return uiStore.get().pythonStatus === 'ready';
  }

  /** v0.1 스킬 슬롯 실행. 요청은 순서대로 하나씩 처리된다 */
  run(payload: RunPayload): Promise<RunResult> {
    return this.enqueue<RunResult>(
      'run',
      { ...payload, time_limit: 0.5, step_limit: 20000 },
      HARD_TIMEOUT_MS,
      (error, kind) => ({ ok: false, casts: [], out: [], error, line: null, kind }),
    );
  }

  /** v0.2 스테이지 실행: 같은 코드를 시드별 맵(levels)마다 돌린다 */
  runStage(code: string, levels: Level[], api?: string[]): Promise<StageRunResult> {
    const limits: StageLimits = { time_limit: STAGE_SEED_TIME_LIMIT, step_limit: STAGE_STEP_LIMIT, api };
    const hardMs = levels.length * STAGE_SEED_TIME_LIMIT * 1000 + 1500;
    return this.enqueue<StageRunResult>('runStage', { code, levels, limits }, hardMs, (error, kind) =>
      failedStageResult(levels, error, kind),
    );
  }

  private enqueue<T>(type: string, payload: unknown, hardMs: number, fail: Pending['fail']): Promise<T> {
    const job = this.chain.then(() => this.exec(type, payload, hardMs, fail) as Promise<T>);
    this.chain = job.catch(() => undefined);
    return job;
  }

  private exec(type: string, payload: unknown, hardMs: number, fail: Pending['fail']): Promise<unknown> {
    if (!this.ready || !this.worker) return Promise.resolve(fail(NOT_READY_MSG, 'engine'));
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        resolve(fail(TIMEOUT_MSG, 'timeout'));
        this.restart();
      }, hardMs);
      this.pending.set(id, {
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        fail,
      });
      this.worker!.postMessage({ type, id, payload });
    });
  }
}

export const python = new PythonRunner();
