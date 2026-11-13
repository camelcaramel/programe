// 모든 스테이지가 "의도한 풀이로 풀리고, 하드코딩으로는 막히는지" 실제 Pyodide 로 확인한다.
import { loadPyodide } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildLevel } from '../sim';
import PRELUDE from '../python/prelude.py?raw';
import { runStageWith, type PyRunStage } from '../python/stageBridge';
import { STAGES, countCodeLines, type StageInfo } from './index';
import { scoreRun } from './score';

let pyRunStage: PyRunStage;
beforeAll(async () => {
  const py = await loadPyodide();
  py.runPython(PRELUDE);
  pyRunStage = py.globals.get('_run_stage') as PyRunStage;
}, 60_000);

const levelsOf = (s: StageInfo) => s.seeds.map((seed) => buildLevel(s, seed));
const run = (s: StageInfo, code: string) => runStageWith(pyRunStage, code, levelsOf(s), { time_limit: 1, api: s.api });

describe('스테이지 목록', () => {
  it('10개, id 중복 없음', () => {
    expect(STAGES).toHaveLength(10);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(10);
  });
});

describe.each(STAGES.map((s) => [s.id, s] as const))('%s', (_id, stage) => {
  it('맵이 올바르게 만들어진다', () => {
    expect(() => levelsOf(stage)).not.toThrow();
  });

  it('정답 예시로 모든 시드 클리어 + 별 3개', () => {
    const r = run(stage, stage.solution);
    for (const x of r.runs) {
      expect(x.error, `seed ${x.seed}: ${x.error}`).toBeNull();
      expect(x.summary.reason, `seed ${x.seed}`).toBe('exit');
    }
    const score = scoreRun(stage, r, stage.solution);
    expect(score.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual([]);
    expect(score.stars).toBe(3);
    if (stage.stars?.lines) expect(countCodeLines(stage.solution)).toBeLessThanOrEqual(stage.stars.lines);
  });

  it('시작 코드는 오류 없이 실행되고, 그대로는 클리어되지 않는다', () => {
    const r = run(stage, stage.starter);
    for (const x of r.runs) expect(x.error, `seed ${x.seed}: ${x.error}`).toBeNull();
    expect(r.ok).toBe(false);
  });

  if (stage.seeds.length > 1) {
    it('시드마다 맵이 다르다', () => {
      const maps = new Set(levelsOf(stage).map((l) => JSON.stringify({ ...l, seed: 0 })));
      expect(maps.size).toBeGreaterThan(1);
    });
  }

  if (stage.hardcoded) {
    it('맵 하나만 보고 짠 풀이는 어떤 시드에서 실패', () => {
      const r = run(stage, stage.hardcoded!);
      expect(r.ok).toBe(false);
    });
  }
});
