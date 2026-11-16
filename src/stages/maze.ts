// 2부 미로 스테이지(14·15·18)용 도우미: 시드로 미로 만들기, 입구→출구 길 찾기
import type { Dir, Rng } from '../sim';

const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ORDER: Dir[] = ['up', 'down', 'left', 'right'];

/**
 * cw × ch 칸짜리 "완전 미로"(갈림길은 많고 고리는 없음)를 ASCII 로.
 * 크기는 (2·cw+1) × (2·ch+1). 칸은 홀수 좌표, 왼쪽 위 칸 (1,1) 에서 파 나간다.
 */
export function mazeRows(rng: Rng, cw: number, ch: number): string[][] {
  const W = cw * 2 + 1;
  const H = ch * 2 + 1;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('#'));
  const seen = new Set<string>();
  const stack: [number, number][] = [[0, 0]];
  seen.add('0,0');
  g[1][1] = '.';
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = ORDER.map((d) => [x + STEP[d][0], y + STEP[d][1]] as [number, number]).filter(
      ([nx, ny]) => nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen.has(`${nx},${ny}`),
    );
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next[rng.int(next.length)];
    seen.add(`${nx},${ny}`);
    g[ny * 2 + 1][nx * 2 + 1] = '.';
    g[y + ny + 1][x + nx + 1] = '.'; // 두 칸 사이 벽 허물기
    stack.push([nx, ny]);
  }
  return g;
}

/** 지나갈 수 없는 칸 (몬스터·비밀 문은 길 위에 있을 수 있으니 지나갈 수 있다고 본다) */
const BLOCK = new Set(['#', 'T', 'M']);

/** S 에서 E 까지 가장 짧은 길의 방향 목록 (완전 미로면 길이 하나뿐) */
export function pathOf(rows: string[]): Dir[] {
  const find = (c: string) => {
    for (let y = 0; y < rows.length; y++) {
      const x = rows[y].indexOf(c);
      if (x >= 0) return [x, y] as const;
    }
    throw new Error(`${c} 가 없어요`);
  };
  const [sx, sy] = find('S');
  const [ex, ey] = find('E');
  const prev = new Map<string, { from: string; d: Dir }>();
  const q: [number, number][] = [[sx, sy]];
  const seen = new Set([`${sx},${sy}`]);
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === ex && y === ey) break;
    for (const d of ORDER) {
      const nx = x + STEP[d][0];
      const ny = y + STEP[d][1];
      const k = `${nx},${ny}`;
      const c = rows[ny]?.[nx];
      if (c === undefined || BLOCK.has(c) || seen.has(k)) continue;
      seen.add(k);
      prev.set(k, { from: `${x},${y}`, d });
      q.push([nx, ny]);
    }
  }
  const path: Dir[] = [];
  let k = `${ex},${ey}`;
  while (k !== `${sx},${sy}`) {
    const p = prev.get(k);
    if (!p) throw new Error('S 에서 E 로 가는 길이 없어요');
    path.unshift(p.d);
    k = p.from;
  }
  return path;
}

/** 길을 따라갈 때 차례로 밟는 칸 (마지막이 출구) */
export function cellsOf(rows: string[], path: Dir[]): [number, number][] {
  let y = rows.findIndex((r) => r.includes('S'));
  let x = rows[y].indexOf('S');
  return path.map((d) => {
    x += STEP[d][0];
    y += STEP[d][1];
    return [x, y];
  });
}

export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** 방향 목록을 move_* 명령 줄로 (하드코딩 우회 풀이 테스트용) */
export const movesCode = (path: readonly string[]) => path.map((d) => `move_${d}()`).join('\n') + '\n';
