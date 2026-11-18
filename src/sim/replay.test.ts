import { describe, expect, it } from 'vitest';
import { boardAt, buildLevel, simulate } from './index';

const level = (map: string[]) => buildLevel({ id: 't', title: 't', map, seeds: [1] }, 1);

describe('boardAt', () => {
  it('0 이면 처음 상태, 끝까지 적용하면 마지막 상태', () => {
    const lv = level(['SkDcgE']);
    const r = simulate(lv, (w) => {
      w.move('right'); // 1 열쇠
      w.move('right'); // 2 문
      w.move('right'); // 3 상자
      w.cast('icebolt', 'right'); // 4 피해
      w.cast('icebolt', 'right'); // 5 처치
      w.move('right'); // 6
      w.move('right'); // 7 출구
    });
    expect(r.trace.map((t) => t.event)).toEqual(['key', 'door', 'chest', 'damage', 'kill', 'move', 'exit']);
    const start = boardAt(lv, r.trace, 0);
    expect(start.pos).toEqual({ x: 0, y: 0 });
    expect(start.keyItems).toEqual([{ x: 1, y: 0 }]);
    expect(start.doors).toEqual([{ x: 2, y: 0, open: false }]);
    expect(start.chests).toEqual([{ x: 3, y: 0, open: false }]);
    expect(start.monsters).toEqual([{ x: 4, y: 0, kind: 'giant', hp: 4, maxHp: 4, revealed: true }]);

    const afterDoor = boardAt(lv, r.trace, 2);
    expect(afterDoor.keyItems).toEqual([]);
    expect(afterDoor.doors[0].open).toBe(true);
    expect(afterDoor.pos).toEqual({ x: 2, y: 0 });
    expect(afterDoor.keys).toBe(0);

    const afterChest = boardAt(lv, r.trace, 3);
    expect(afterChest.chests[0].open).toBe(true);
    expect(afterChest.coins).toBe(1);

    const end = boardAt(lv, r.trace, r.trace.length);
    expect(r.cleared).toBe(true);
    expect(end.monsters).toEqual([]);
    expect(end.pos).toEqual({ x: 5, y: 0 });
    expect(end.turn).toBe(r.turns);
  });

  it('피해만 입은 몬스터는 hp 가 줄어든 채 남는다', () => {
    const lv = level(['SgE']);
    const r = simulate(lv, (w) => w.cast('icebolt', 'right'));
    expect(boardAt(lv, r.trace, 1).monsters[0].hp).toBe(2);
  });

  it('왼쪽으로 가면 facing 이 left', () => {
    const lv = level(['.S.E']);
    const r = simulate(lv, (w) => w.move('left'));
    expect(boardAt(lv, r.trace, 1).facing).toBe('left');
  });
});
