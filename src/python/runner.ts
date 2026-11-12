// 메인 스레드 쪽 파이썬 실행기: 워커 관리, 실행 큐, 강제 타임아웃(워커 재시작)
import type { SkillName } from '../game/data';
import { uiStore } from '../state/store';

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

class PythonRunner {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (r: RunResult) => void>();
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
      } else if (m.type === 'result') {
        this.pending.get(m.id)?.(m.result);
        this.pending.delete(m.id);
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
    for (const resolve of this.pending.values()) resolve(fail('엔진을 다시 시작했어요.', 'engine'));
    this.pending.clear();
    this.spawn();
  }

  get ready() {
    return uiStore.get().pythonStatus === 'ready';
  }

  /** 실행 요청은 순서대로 하나씩 처리된다 */
  run(payload: RunPayload): Promise<RunResult> {
    const job = this.chain.then(() => this.exec(payload));
    this.chain = job.catch(() => undefined);
    return job;
  }

  private exec(payload: RunPayload): Promise<RunResult> {
    if (!this.ready || !this.worker) {
      return Promise.resolve(fail('파이썬 엔진을 준비하는 중이에요. 잠시 후 다시 시도하세요.', 'engine'));
    }
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        resolve(fail('코드가 너무 오래 실행돼서 강제로 멈췄어요. 끝나지 않는 반복문이 있는지 확인하세요.', 'timeout'));
        this.restart();
      }, HARD_TIMEOUT_MS);
      this.pending.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      this.worker!.postMessage({ type: 'run', id, payload: { ...payload, time_limit: 0.5, step_limit: 20000 } });
    });
  }
}

function fail(error: string, kind: string): RunResult {
  return { ok: false, casts: [], out: [], error, line: null, kind };
}

export const python = new PythonRunner();
