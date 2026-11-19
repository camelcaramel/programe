// 모든 스테이지가 "의도한 풀이로 풀리고, 하드코딩으로는 막히는지" 실제 Pyodide 로 확인한다.
import { loadPyodide } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildLevel, createRng, type Level } from '../sim';
import PRELUDE from '../python/prelude.py?raw';
import { runStageWith, type PyRunStage } from '../python/stageBridge';
import { STAGES, countCodeLines, type StageInfo } from './index';
import { scoreRun } from './score';
import { pickLevels, seedSetProblems, varies } from './seeds';

let pyRunStage: PyRunStage;
beforeAll(async () => {
  const py = await loadPyodide();
  py.runPython(PRELUDE);
  pyRunStage = py.globals.get('_run_stage') as PyRunStage;
}, 60_000);

/** 스테이지마다 새로 뽑아 볼 맵 묶음 수 */
const ROLLS = 8;
const levelsOf = (s: StageInfo) => s.seeds.map((seed) => buildLevel(s, seed));
const run = (s: StageInfo, code: string) => runStageWith(pyRunStage, code, levelsOf(s), { time_limit: 1, api: s.api });

/** 화면 번호 (1부터). 비계 스테이지가 끼어들어도 id 로 자리를 찾는다 */
const no = (id: string) => {
  const i = STAGES.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`${id} 가 없어요`);
  return i + 1;
};

describe('스테이지 목록', () => {
  it('1부 13개 + 2부 11개 + 3부 12개 + 4부 12개 (비계 12개 포함), id 중복 없음, 도전은 맨 끝 3개', () => {
    expect(STAGES).toHaveLength(48);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(48);
    expect(STAGES.map((s) => s.part)).toEqual([
      ...Array(13).fill(1),
      ...Array(11).fill(2),
      ...Array(12).fill(3),
      ...Array(12).fill(4),
    ]);
    expect(STAGES.filter((s) => s.challenge).map((s) => s.id)).toEqual(['stage-34', 'stage-35', 'stage-36']);
    expect(STAGES.slice(-3).every((s) => s.challenge)).toBe(true);
    // 비계 스테이지는 이름(stage-NNa)대로 NN 바로 뒤에 온다
    for (const s of STAGES.filter((s) => /a$/.test(s.id))) expect(no(s.id), s.id).toBe(no(s.id.slice(0, -1)) + 1);
  });

  it('STORY.md · PART2~4.md 표대로 새 개념 카드가 있다 (카드 없는 스테이지는 앞 스테이지 개념의 연습)', () => {
    const without = STAGES.filter((s) => !s.concepts?.length).map((s) => s.id);
    expect(without).toEqual(['stage-02', 'stage-04', 'stage-07', 'stage-08', 'stage-16']);
    for (const s of STAGES)
      for (const c of s.concepts ?? []) {
        expect(c.text.length, `${s.id} ${c.name}`).toBeGreaterThanOrEqual(2);
        expect(c.text.length, `${s.id} ${c.name}`).toBeLessThanOrEqual(5);
        expect(c.example.trim()).not.toBe('');
      }
  });

  it('명령이 열리는 스테이지: read·open_gate 11 · move 14 · scan 19 · hire 22a · get_map 25a(보물 동굴 36 은 빼고) · 4부 명령 28 (모두 id)', () => {
    STAGES.forEach((s, i) => {
      const n = i + 1;
      expect(s.api.includes('move'), s.id).toBe(n >= no('stage-14'));
      expect(s.api.includes('read'), s.id).toBe(n >= no('stage-11'));
      expect(s.api.includes('scan'), s.id).toBe(n >= no('stage-19'));
      expect(s.api.includes('hire'), s.id).toBe(n >= no('stage-22a'));
      expect(s.api.includes('get_map'), s.id).toBe(n >= no('stage-25a') && s.id !== 'stage-36');
      for (const cmd of ['size', 'peek', 'heavier', 'swap', 'move_disc', 'pay']) expect(s.api.includes(cmd), `${s.id} ${cmd}`).toBe(n >= no('stage-28'));
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

  if (stage.part === 3) {
    it('3부: 몬스터 변이(종류 → 약점)·로봇 걸음 수·지도가 시드마다 다르다', () => {
      const ls = levelsOf(stage);
      const facts = ls.map((l) =>
        JSON.stringify({
          weak: [...new Set(l.monsters.map((m) => `${m.kind}:${m.weak}`))].sort(),
          hp: l.monsters.map((m) => m.hp),
          signs: l.signs.map((s) => s.value),
          terrain: l.terrain,
        }),
      );
      expect(new Set(facts).size).toBe(ls.length);
      // 변이 몬스터가 있으면, 맵 1 의 "종류 → 약점" 표가 다른 맵 중 적어도 하나에서 틀린다
      const table = (l: Level) => new Map(l.monsters.map((m) => [m.kind, m.weak]));
      if (ls[0].monsters.some((m) => m.weak)) {
        const t0 = table(ls[0]);
        expect(ls.slice(1).some((l) => l.monsters.some((m) => t0.has(m.kind) && t0.get(m.kind) !== m.weak))).toBe(true);
      }
    });
  }

  if (stage.part === 4) {
    it('4부: 금고 숫자·석상 순서·원판 수·통행료·동굴이 시드마다 다르다', () => {
      const ls = levelsOf(stage);
      const facts = ls.map((l) =>
        JSON.stringify({ row: l.row?.values, discs: l.discs, tolls: l.tolls, chests: l.chests, terrain: l.terrain, gates: l.gates }),
      );
      expect(new Set(facts).size).toBe(ls.length);
      for (const l of ls) for (const g of l.gates) if (typeof g.code === 'number') expect(g.code).toBeGreaterThan(2);
    });
  }

  if (varies(stage)) {
    // 게임에서는 실행할 때마다 시드를 새로 뽑는다. 뽑힌 맵에서도 같은 약속이 지켜지는지 여러 번 뽑아 본다
    it('기준 시드가 새로 뽑기 조건을 지킨다', () => {
      expect(seedSetProblems(stage, levelsOf(stage))).toEqual([]);
    });

    it(`새로 뽑은 맵 ${ROLLS}묶음: 기준 시드와 다르고 조건을 지키며, 정답은 통과·하드코딩과 우회는 실패`, async () => {
      const rng = createRng(STAGES.indexOf(stage) + 1000);
      const go = (code: string, ls: Level[]) => runStageWith(pyRunStage, code, ls, { time_limit: 1, api: stage.api });
      const base = JSON.stringify(levelsOf(stage).map((l) => l.seed));
      let fresh = 0;
      for (let k = 0; k < ROLLS; k++) {
        const ls = await pickLevels(stage, null, async (code, l) => go(code, l), rng.next);
        const tag = `seeds ${ls.map((l) => l.seed).join(',')}`;
        if (JSON.stringify(ls.map((l) => l.seed)) !== base) fresh++;
        expect(seedSetProblems(stage, ls), tag).toEqual([]);
        for (const x of go(stage.solution, ls).runs) expect(x.summary.reason, `${tag} seed ${x.seed}: ${x.error}`).toBe('exit');
        if (stage.hardcoded) expect(go(stage.hardcoded, ls).ok, `${tag} 하드코딩`).toBe(false);
        for (const b of stage.bypasses ?? []) expect(go(typeof b.code === 'function' ? b.code(ls) : b.code, ls).ok, `${tag} 우회: ${b.name}`).toBe(false);
      }
      // 거의 언제나 새 시드가 뽑혀야 한다 (기준 시드로 물러나는 일은 드물게만)
      expect(fresh).toBeGreaterThanOrEqual(ROLLS - 1);
    }, 120_000);
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
