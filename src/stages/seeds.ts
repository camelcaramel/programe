// 실행마다 시드 새로 뽑기. 스테이지에 적힌 seeds 는 "이만큼 다양해야 한다"는 기준(과 시험용 고정 값)이고,
// 실제 게임에서는 같은 개수의 시드를 무작위로 뽑아, 기준만큼 다양한 묶음이 나올 때까지 다시 뽑는다.
// (값이 매번 같으면 재생 화면에서 본 값을 코드에 그대로 적어 넣는 하드코딩이 통한다)
import { buildLevel, type Level, type Pos } from '../sim';
import type { StageInfo } from './types';

/** 시드에 따라 무언가 바뀌는 스테이지인가 (아니면 늘 같은 맵이라 새로 뽑을 필요가 없다) */
export function varies(def: StageInfo): boolean {
  return def.seeds.length > 1 || !!def.random || typeof def.map === 'function' || !!def.content;
}

const sig = (l: Level) => JSON.stringify({ ...l, seed: 0 });
const distinct = (ls: Level[]) => new Set(ls.map(sig)).size;

/** 랜덤 칸(?)에 실제로 나온 것 */
function cellKind(l: Level, p: Pos): string {
  const at = (q: Pos) => q.x === p.x && q.y === p.y;
  return l.monsters.find(at)?.kind ?? (l.chests.some(at) ? 'chest' : l.keys.some(at) ? 'key' : l.bots.some(at) ? 'bot' : l.terrain[p.y][p.x]);
}
const randomKinds = (ls: Level[]) => new Set(ls.flatMap((l) => l.randomCells.map((p) => cellKind(l, p))));

/**
 * 맵 묶음이 "같은 코드로 모두 통과해야 하는" 뜻을 지키는지. 문제마다 한 줄 설명 (없으면 빈 목록).
 * 부마다 시드가 바꿔야 하는 것: 2부 표지판·암호, 3부 몬스터 변이·지도, 4부 금고 숫자·석상·원판·통행료·동굴
 */
export function seedSetProblems(def: StageInfo, ls: Level[]): string[] {
  const out: string[] = [];
  if (ls.length > 1 && distinct(ls) < 2) out.push('맵이 모두 같아요');
  const numericGates = ls.flatMap((l) => l.gates.map((g) => g.code)).filter((c): c is number => typeof c === 'number');
  if (numericGates.some((c) => c <= 2)) out.push('정수 암호가 0·1·2 예요 (0부터 넣어 보면 풀려요)');
  if (def.part === 2) {
    const contents = new Set(ls.map((l) => JSON.stringify([l.signs.map((s) => s.value), l.gates.map((g) => g.code)])));
    if (contents.size !== ls.length) out.push('표지판·암호가 같은 맵이 있어요');
    const codes = new Set(ls.map((l) => JSON.stringify(l.gates.map((g) => g.code))));
    if (ls[0].gates.length > 0 && codes.size !== ls.length) out.push('암호가 같은 맵이 있어요');
  }
  if (def.part === 3) {
    const facts = ls.map((l) =>
      JSON.stringify({
        weak: [...new Set(l.monsters.map((m) => `${m.kind}:${m.weak}`))].sort(),
        hp: l.monsters.map((m) => m.hp),
        signs: l.signs.map((s) => s.value),
        terrain: l.terrain,
      }),
    );
    if (new Set(facts).size !== ls.length) out.push('몬스터 변이·지도가 같은 맵이 있어요');
    // 변이 몬스터가 있으면, 맵 1 의 "종류 → 약점" 표가 다른 맵 중 적어도 하나에서 틀려야 한다
    if (ls.length > 1 && ls[0].monsters.some((m) => m.weak)) {
      const t0 = new Map(ls[0].monsters.map((m) => [m.kind, m.weak]));
      if (!ls.slice(1).some((l) => l.monsters.some((m) => t0.has(m.kind) && t0.get(m.kind) !== m.weak)))
        out.push('맵 1 의 약점 표가 모든 맵에서 맞아요');
    }
  }
  if (def.part === 4) {
    const facts = ls.map((l) => JSON.stringify({ row: l.row?.values, discs: l.discs, tolls: l.tolls, chests: l.chests, terrain: l.terrain, gates: l.gates }));
    if (new Set(facts).size !== ls.length) out.push('금고·석상·원판·통행료·동굴이 같은 맵이 있어요');
  }
  return out;
}

/** 스테이지에 적힌 seeds 로 만든 맵 (시험과 "새로 뽑기"의 기준) */
export const designedLevels = (def: StageInfo): Level[] => def.seeds.map((s) => buildLevel(def, s));

/**
 * 이번 실행에 쓸 맵들. 기준 시드만큼 서로 다르고, 기준 시드에서 ? 칸에 나온 것(슬라임·거인 …)이
 * 모두 한 번 이상 나오고, 부마다의 조건(seedSetProblems)을 지키는 묶음이 나올 때까지 다시 뽑는다.
 * 끝내 못 찾으면(그럴 일은 거의 없다) 기준 시드를 그대로 쓴다.
 */
export function rollLevels(def: StageInfo, rand: () => number = Math.random): Level[] {
  const base = designedLevels(def);
  if (!varies(def)) return base;
  const need = distinct(base);
  const kinds = randomKinds(base);
  for (let tries = 0; tries < 80; tries++) {
    const seeds = new Set<number>();
    while (seeds.size < def.seeds.length) seeds.add(1 + Math.floor(rand() * 0x7ffffffe));
    let ls: Level[];
    try {
      ls = [...seeds].map((s) => buildLevel(def, s));
    } catch {
      continue;
    }
    if (distinct(ls) < need) continue;
    const got = randomKinds(ls);
    if ([...kinds].some((k) => !got.has(k))) continue;
    if (seedSetProblems(def, ls).length > 0) continue;
    return ls;
  }
  return base;
}

/** 코드를 맵들에 돌려 모두 통과했는지 알려 주는 실행기 (게임에서는 파이썬 워커, 시험에서는 Pyodide) */
export type RunCheck = (code: string, levels: Level[]) => Promise<{ ok: boolean }>;

/** 스테이지에 적어 둔 하드코딩·우회 풀이 중 하나라도 이 맵들을 모두 통과하는가 */
export async function shortcutWorks(def: StageInfo, ls: Level[], run: RunCheck): Promise<boolean> {
  const codes = [...(def.hardcoded ? [def.hardcoded] : []), ...(def.bypasses ?? []).map((b) => (typeof b.code === 'function' ? b.code(ls) : b.code))];
  for (const code of codes) if ((await run(code, ls)).ok) return true;
  return false;
}

/**
 * 이번 실행에 쓸 맵 고르기. current(아직 실행하지 않은, 화면에 보이는 맵)가 있으면 먼저 그것을, 아니면 새로 뽑은 묶음을
 * 하드코딩·우회 풀이로 돌려 보고, 하나라도 통과하는 묶음은 버리고 다시 뽑는다. 끝내 못 찾으면 기준 시드(시험으로 확인된 묶음).
 */
export async function pickLevels(def: StageInfo, current: Level[] | null, run: RunCheck, rand: () => number = Math.random): Promise<Level[]> {
  if (!varies(def)) return current ?? designedLevels(def);
  const tries = [...(current ? [current] : []), ...Array.from({ length: 6 }, () => () => rollLevels(def, rand))];
  for (const t of tries) {
    const ls = typeof t === 'function' ? t() : t;
    if (!(await shortcutWorks(def, ls, run))) return ls;
  }
  return designedLevels(def);
}
