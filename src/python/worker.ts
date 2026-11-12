/// <reference lib="webworker" />
// Pyodide 를 별도 스레드에서 실행한다. 메인(게임) 스레드는 절대 멈추지 않는다.
import PRELUDE from './prelude.py?raw';

interface PyodideLike {
  runPython(code: string): unknown;
  globals: { get(name: string): (arg: string) => string };
}

let run: ((payload: string) => string) | null = null;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      const mod = await import(/* @vite-ignore */ msg.indexURL + 'pyodide.mjs');
      const py: PyodideLike = await mod.loadPyodide({ indexURL: msg.indexURL });
      py.runPython(PRELUDE);
      run = py.globals.get('_run');
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'initError', error: String(err) });
    }
    return;
  }
  if (msg.type === 'run') {
    if (!run) {
      self.postMessage({ type: 'result', id: msg.id, result: { ok: false, error: '파이썬 엔진이 아직 준비되지 않았어요.', line: null, kind: 'engine', casts: [], out: [] } });
      return;
    }
    try {
      const result = JSON.parse(run(JSON.stringify(msg.payload)));
      self.postMessage({ type: 'result', id: msg.id, result });
    } catch (err) {
      self.postMessage({ type: 'result', id: msg.id, result: { ok: false, error: '엔진 오류: ' + String(err), line: null, kind: 'engine', casts: [], out: [] } });
    }
  }
};
