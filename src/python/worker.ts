/// <reference lib="webworker" />
// Pyodide 를 별도 스레드에서 실행한다. 메인(게임) 스레드는 절대 멈추지 않는다.
//  - 'run'      : v0.1 스킬 슬롯 (attack_strategy) — G3 이후 삭제 예정
//  - 'runStage' : v0.2 스테이지 (시뮬레이터를 워커 안에서 끝까지 돌리고 trace 를 돌려줌)
import PRELUDE from './prelude.py?raw';
import { runStageWith, type PyRunStage } from './stageBridge';

interface PyodideLike {
  runPython(code: string): unknown;
  globals: { get(name: string): unknown };
}

let run: ((payload: string) => string) | null = null;
let runStage: PyRunStage | null = null;

const engineError = (msg: string) => ({ ok: false, error: msg, line: null, kind: 'engine', casts: [], out: [] });

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      const mod = await import(/* @vite-ignore */ msg.indexURL + 'pyodide.mjs');
      const py: PyodideLike = await mod.loadPyodide({ indexURL: msg.indexURL });
      py.runPython(PRELUDE);
      run = py.globals.get('_run') as typeof run;
      runStage = py.globals.get('_run_stage') as PyRunStage;
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'initError', error: String(err) });
    }
    return;
  }

  if (msg.type === 'run') {
    if (!run) {
      self.postMessage({ type: 'result', id: msg.id, result: engineError('파이썬 엔진이 아직 준비되지 않았어요.') });
      return;
    }
    try {
      const result = JSON.parse(run(JSON.stringify(msg.payload)));
      self.postMessage({ type: 'result', id: msg.id, result });
    } catch (err) {
      self.postMessage({ type: 'result', id: msg.id, result: engineError('엔진 오류: ' + String(err)) });
    }
    return;
  }

  if (msg.type === 'runStage') {
    const { code, levels, limits } = msg.payload;
    if (!runStage) {
      self.postMessage({ type: 'error', id: msg.id, error: '파이썬 엔진이 아직 준비되지 않았어요.' });
      return;
    }
    try {
      self.postMessage({ type: 'result', id: msg.id, result: runStageWith(runStage, code, levels, limits) });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, error: '엔진 오류: ' + String(err) });
    }
  }
};
