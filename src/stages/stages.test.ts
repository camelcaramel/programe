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
  it('1부 10개 + 2부 8개, id 중복 없음', () => {
    expect(STAGES).toHaveLength(18);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(18);
    expect(STAGES.map((s) => s.part)).toEqual([...Array(10).fill(1), ...Array(8).fill(2)]);
  });

  it('PART2.md §7 표대로 새 개념 카드가 있다', () => {
    const withCards = STAGES.filter((s) => s.concepts?.length).map((s) => STAGES.indexOf(s) + 1);
    expect(withCards).toEqual([1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18]);
    for (const s of STAGES)
      for (const c of s.concepts ?? []) {
        expect(c.text.length, `${s.id} ${c.name}`).toBeGreaterThanOrEqual(2);
        expect(c.text.length, `${s.id} ${c.name}`).toBeLessThanOrEqual(5);
        expect(c.example.trim()).not.toBe('');
      }
  });

  it('move(방향) 은 14단계부터, read/open_gate 는 11단계부터', () => {
    STAGES.forEach((s, i) => {
      expect(s.api.includes('move'), s.id).toBe(i + 1 >= 14);
      expect(s.api.includes('read'), s.id).toBe(i + 1 >= 11);
    });
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

  if (stage.part === 2) {
    it('표지판·석판 내용과 암호가 시드마다 다르다', () => {
      const ls = levelsOf(stage);
      const contents = new Set(ls.map((l) => JSON.stringify([l.signs.map((s) => s.value), l.gates.map((g) => g.code)])));
      expect(contents.size).toBe(ls.length);
      const codes = new Set(ls.map((l) => JSON.stringify(l.gates.map((g) => g.code))));
      if (ls[0].gates.length > 0) expect(codes.size).toBe(ls.length);
    });

    it('정수 암호는 0·1·2 가 아니다 (0 부터 하나씩 넣어 보면 세 번째에 쓰러짐)', () => {
      for (const l of levelsOf(stage)) for (const g of l.gates) if (typeof g.code === 'number') expect(g.code).toBeGreaterThan(2);
    });
  }

  for (const b of stage.bypasses ?? []) {
    it(`우회 풀이는 실패: ${b.name}`, () => {
      const code = typeof b.code === 'function' ? b.code(levelsOf(stage)) : b.code;
      const r = run(stage, code);
      expect(r.runs.map((x) => x.summary.reason)).not.toEqual(r.runs.map(() => 'exit'));
      expect(r.ok).toBe(false);
    });
  }

  if (stage.hardcoded) {
    it('맵 하나만 보고 짠 풀이는 어떤 시드에서 실패', () => {
      const r = run(stage, stage.hardcoded!);
      expect(r.ok).toBe(false);
    });
  }
});
