// ASCII 스테이지 정의 + 시드 → 실제 맵(Level)
//
//   .  바닥      #  벽       S  시작     E  출구
//   c  보물상자  k  열쇠     D  문
//   s  슬라임    b  박쥐     g  외눈 거인
//   그 밖의 문자는 StageDef.random 에 후보를 적어 랜덤 칸으로 쓴다 (보통 '?')
import { StageError } from './errors';
import { createRng } from './rng';
import { DEFAULT_MAX_TURNS, DEFAULT_PLAYER_HP, MONSTER_CHAR } from './rules';
import type { Level, Pos, StageDef, Terrain } from './types';

const TERRAIN_CHAR: Record<string, Terrain> = { '.': 'floor', '#': 'wall', E: 'exit', D: 'door' };

export function buildLevel(def: StageDef, seed: number): Level {
  const rng = createRng(seed);
  const rows = typeof def.map === 'function' ? def.map(rng) : def.map;
  const fail = (msg: string): never => {
    throw new StageError(def.id, msg);
  };

  if (rows.length === 0) fail('맵이 비어 있어요');
  const width = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== width) fail(`${y}번째 줄 길이(${r.length})가 첫 줄(${width})과 달라요`);
  });

  const random = def.random ?? {};
  for (const [sym, options] of Object.entries(random)) {
    if (sym.length !== 1) fail(`랜덤 칸 기호는 한 글자여야 해요: ${JSON.stringify(sym)}`);
    if (options.length === 0) fail(`랜덤 칸 ${sym} 의 후보가 없어요`);
    for (const o of options) {
      if (o in random) fail(`랜덤 칸 후보에 다른 랜덤 기호를 넣을 수 없어요: ${o}`);
      if (o === 'S') fail('랜덤 칸 후보에 시작 위치(S)를 넣을 수 없어요');
    }
  }

  const terrain: Terrain[][] = [];
  const level: Level = {
    stageId: def.id,
    seed,
    width,
    height: rows.length,
    maxTurns: def.maxTurns ?? DEFAULT_MAX_TURNS,
    playerHp: def.playerHp ?? DEFAULT_PLAYER_HP,
    terrain,
    start: { x: -1, y: -1 },
    monsters: [],
    chests: [],
    keys: [],
    randomCells: [],
  };
  let starts = 0;
  let exits = 0;

  // 위→아래, 왼→오른 순서로 랜덤을 뽑으므로 같은 시드는 항상 같은 맵이 된다
  rows.forEach((row, y) => {
    const line: Terrain[] = [];
    [...row].forEach((raw, x) => {
      let ch = raw;
      if (ch in random) {
        level.randomCells.push({ x, y });
        ch = rng.pick(random[ch]);
      }
      const here: Pos = { x, y };
      if (ch in TERRAIN_CHAR) {
        line.push(TERRAIN_CHAR[ch]);
        if (ch === 'E') exits++;
        return;
      }
      line.push('floor');
      if (ch in MONSTER_CHAR) level.monsters.push({ ...here, kind: MONSTER_CHAR[ch] });
      else if (ch === 'c') level.chests.push(here);
      else if (ch === 'k') level.keys.push(here);
      else if (ch === 'S') {
        level.start = here;
        starts++;
      } else fail(`알 수 없는 문자 ${JSON.stringify(ch)} (x=${x}, y=${y})`);
    });
    terrain.push(line);
  });

  if (starts !== 1) fail(`시작 위치(S)는 정확히 1개여야 해요 (지금 ${starts}개)`);
  if (exits < 1) fail('출구(E)가 없어요');
  if (def.seeds.length === 0) fail('시드가 없어요');
  return level;
}
