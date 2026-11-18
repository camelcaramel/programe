// ASCII 스테이지 정의 + 시드 → 실제 맵(Level)
//
//   .  바닥      #  벽       S  시작     E  출구
//   c  보물상자  k  열쇠     D  문
//   s  슬라임    b  박쥐     g  외눈 거인
//   T  표지판    M  석판     G  비밀 문   (2부. 내용·암호는 StageDef.content 가 시드로 만든다)
//   o  유령      x  거미     q  게        m  미믹(상자인 척)   (3부 변이 몬스터. HP·약점은 content 가 정한다)
//   R  조수 로봇  P  발판     =  창살      (3부)
//   V  금고      W  석상     H  하노이 기둥  $  요금 문   (4부. 숫자·무게·원판 수·통행료는 content 가 정한다)
//   그 밖의 문자는 StageDef.random 에 후보를 적어 랜덤 칸으로 쓴다 (보통 '?')
import { StageError } from './errors';
import { createRng } from './rng';
import { DEFAULT_MAX_TURNS, DEFAULT_PLAYER_HP, MONSTER_CHAR, MONSTER_RULES, SKILLS } from './rules';
import type { ContentSlots, Level, Pos, StageDef, Terrain } from './types';

const TERRAIN_CHAR: Record<string, Terrain> = {
  '.': 'floor',
  '#': 'wall',
  E: 'exit',
  D: 'door',
  T: 'sign',
  M: 'tablet',
  G: 'gate',
  P: 'plate',
  '=': 'bars',
  V: 'vault',
  W: 'statue',
  H: 'pillar',
  $: 'toll',
};

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
    maxTurns: typeof def.maxTurns === 'function' ? def.maxTurns(rows) : (def.maxTurns ?? DEFAULT_MAX_TURNS),
    playerHp: def.playerHp ?? DEFAULT_PLAYER_HP,
    terrain,
    start: { x: -1, y: -1 },
    monsters: [],
    chests: [],
    keys: [],
    randomCells: [],
    signs: [],
    gates: [],
    bots: [],
  };
  /** 랜덤 칸을 뽑은 뒤의 맵 (content 에 넘긴다) */
  const resolved: string[] = [];
  const slots: ContentSlots = { rows: resolved, signs: [], tablets: [], gates: [], monsters: level.monsters, items: [], tolls: [] };
  const pillars: Pos[] = [];
  const itemKinds = new Set<'vault' | 'statue'>();
  let starts = 0;
  let exits = 0;

  // 위→아래, 왼→오른 순서로 랜덤을 뽑으므로 같은 시드는 항상 같은 맵이 된다
  rows.forEach((row, y) => {
    const line: Terrain[] = [];
    let out = '';
    [...row].forEach((raw, x) => {
      let ch = raw;
      if (ch in random) {
        level.randomCells.push({ x, y });
        ch = rng.pick(random[ch]);
      }
      out += ch;
      const here: Pos = { x, y };
      if (ch in TERRAIN_CHAR) {
        line.push(TERRAIN_CHAR[ch]);
        if (ch === 'E') exits++;
        else if (ch === 'T') slots.signs.push(here);
        else if (ch === 'M') slots.tablets.push(here);
        else if (ch === 'G') slots.gates.push(here);
        else if (ch === 'V' || ch === 'W') {
          slots.items.push(here);
          itemKinds.add(ch === 'V' ? 'vault' : 'statue');
        } else if (ch === 'H') pillars.push(here);
        else if (ch === '$') slots.tolls.push(here);
        return;
      }
      line.push('floor');
      if (ch in MONSTER_CHAR) level.monsters.push({ ...here, kind: MONSTER_CHAR[ch] });
      else if (ch === 'c') level.chests.push(here);
      else if (ch === 'k') level.keys.push(here);
      else if (ch === 'R') level.bots.push(here);
      else if (ch === 'S') {
        level.start = here;
        starts++;
      } else fail(`알 수 없는 문자 ${JSON.stringify(ch)} (x=${x}, y=${y})`);
    });
    terrain.push(line);
    resolved.push(out);
  });

  // 표지판·석판·비밀 문의 내용 (랜덤 칸을 다 뽑은 뒤 같은 rng 로 만들므로 시드가 같으면 내용도 같다)
  const nSlots =
    slots.signs.length + slots.tablets.length + slots.gates.length + slots.items.length + slots.tolls.length + pillars.length;
  const mutants = level.monsters.filter((m) => MONSTER_RULES[m.kind].mutant).length;
  if (itemKinds.size > 1) fail('금고(V)와 석상(W)을 한 맵에 같이 둘 수 없어요');
  if (pillars.length !== 0 && pillars.length !== 3) fail(`하노이 기둥(H)은 3개여야 해요 (지금 ${pillars.length}개)`);
  if (nSlots > 0 || def.content) {
    if (!def.content) fail('표지판(T)·석판(M)·비밀 문(G)·금고(V)·석상(W)·기둥(H)·요금 문($)이 있으면 content 함수가 필요해요');
    // 맵에서 찾은 몬스터 목록은 content 가 바꾸지 못하게 복사해서 넘긴다
    const c = def.content!(rng, { ...slots, monsters: level.monsters.map((m) => ({ ...m })) });
    const signs = c.signs ?? [];
    const tablets = c.tablets ?? [];
    const gates = c.gates ?? [];
    if (signs.length !== slots.signs.length) fail(`표지판 ${slots.signs.length}개인데 내용은 ${signs.length}개예요`);
    if (tablets.length !== slots.tablets.length) fail(`석판 ${slots.tablets.length}개인데 내용은 ${tablets.length}개예요`);
    if (gates.length !== slots.gates.length) fail(`비밀 문 ${slots.gates.length}개인데 암호는 ${gates.length}개예요`);
    slots.signs.forEach((p, i) => level.signs.push({ ...p, kind: 'sign', value: String(signs[i]) }));
    slots.tablets.forEach((p, i) => level.signs.push({ ...p, kind: 'tablet', value: [...tablets[i]] }));
    slots.gates.forEach((p, i) => level.gates.push({ ...p, code: gates[i] }));
    level.signs.sort((a, b) => a.y - b.y || a.x - b.x);
    if (c.maxTurns !== undefined) level.maxTurns = c.maxTurns;
    const muts = c.monsters ?? [];
    if (muts.length > 0 && muts.length !== level.monsters.length)
      fail(`몬스터 ${level.monsters.length}마리인데 변이 정보는 ${muts.length}개예요`);
    muts.forEach((mu, i) => {
      if (!mu) return;
      if (!(SKILLS as string[]).includes(mu.weak)) fail(`알 수 없는 약점 마법: ${mu.weak}`);
      if (!(mu.hp > 0)) fail(`몬스터 HP 는 1 이상이어야 해요: ${mu.hp}`);
      level.monsters[i] = { ...level.monsters[i], hp: mu.hp, weak: mu.weak };
    });

    // 4부: 금고·석상 줄, 하노이 원판, 요금 문, 횟수 제한
    const row = c.row ?? [];
    if (row.length !== slots.items.length) fail(`금고·석상 ${slots.items.length}개인데 값은 ${row.length}개예요`);
    if (row.some((v) => !Number.isInteger(v))) fail('금고·석상 값은 정수여야 해요');
    if (slots.items.length > 0) {
      const kind = [...itemKinds][0];
      if (kind === 'statue' && new Set(row).size !== row.length) fail('석상 무게는 모두 달라야 해요');
      level.row = { kind, cells: slots.items, values: [...row] };
    }
    if (pillars.length === 3) {
      if (!(c.discs !== undefined && Number.isInteger(c.discs) && c.discs >= 1)) fail('하노이 기둥이 있으면 content 의 discs(원판 수, 1 이상)가 필요해요');
      level.pillars = pillars;
      level.discs = c.discs;
    }
    const fees = c.tolls ?? [];
    if (fees.length !== slots.tolls.length) fail(`요금 문 ${slots.tolls.length}개인데 통행료는 ${fees.length}개예요`);
    if (slots.tolls.length > 0) level.tolls = slots.tolls.map((p, i) => ({ ...p, fee: fees[i] }));
    if (c.peekLimit !== undefined) level.peekLimit = c.peekLimit;
    if (c.weighLimit !== undefined) level.weighLimit = c.weighLimit;
    if (c.swapLimit !== undefined) level.swapLimit = c.swapLimit;
  }
  if (def.adjacentOnly) level.adjacentOnly = true;
  if (def.barsRule) level.barsRule = def.barsRule;
  if (level.monsters.some((m) => MONSTER_RULES[m.kind].mutant && !m.weak))
    fail(`변이 몬스터(유령·거미·게·미믹) ${mutants}마리의 HP·약점을 content 의 monsters 로 정해야 해요`);
  if (def.scanLimit !== undefined) level.scanLimit = typeof def.scanLimit === 'function' ? def.scanLimit(resolved) : def.scanLimit;

  if (starts !== 1) fail(`시작 위치(S)는 정확히 1개여야 해요 (지금 ${starts}개)`);
  if (exits < 1) fail('출구(E)가 없어요');
  if (def.seeds.length === 0) fail('시드가 없어요');
  return level;
}
