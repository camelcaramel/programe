// 4부 요소: 금고(peek)·석상(heavier·swap)·하노이 기둥(move_disc)·요금 문(pay), 횟수 제한, 스테이지별 창살 조건, 정렬 비용 계산
import { describe, expect, it } from 'vitest';
import {
  SimInputError,
  SimStop,
  World,
  boardAt,
  bubbleCost,
  buildLevel,
  greedyCoins,
  insertionCost,
  inversions,
  selectionCost,
  simulate,
  type StageContent,
  type StageDef,
} from './index';

const lv = (map: string[], content: StageContent = {}, extra: Partial<StageDef> = {}) =>
  buildLevel({ id: 'test', title: 'test', map, seeds: [1], content: () => content, ...extra }, 1);

/** 턴을 쓴 뒤 창살을 다시 정한다 (파이썬의 _after_turn 과 같은 순서) */
function turn(w: World, action: () => void) {
  action();
  w.roundBegin();
  w.roundEnd();
}

describe('금고와 peek', () => {
  it('번호 순서(위→아래, 왼→오른)대로 값이 들어가고 0턴, 기록을 남긴다', () => {
    const l = lv(['VVV#', 'S.VE'], { row: [5, 6, 7, 8] });
    expect(l.row).toEqual({
      kind: 'vault',
      cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }],
      values: [5, 6, 7, 8],
    });
    const w = new World(l);
    expect(w.size()).toBe(4);
    expect(w.peek(3)).toBe(8);
    expect(w.turn).toBe(0);
    expect(w.trace[0]).toMatchObject({ event: 'peek', index: 3, num: 8, target: { x: 2, y: 1 } });
    expect(w.look('up')).toBe('vault');
  });

  it('번호가 범위 밖이거나 정수가 아니면 오류', () => {
    const w = new World(lv(['VV', 'SE'], { row: [1, 2] }));
    expect(() => w.peek(2)).toThrow(/0 부터 1 까지/);
    expect(() => w.peek(-1)).toThrow(SimInputError);
    expect(() => w.peek(1.5)).toThrow(SimInputError);
    expect(() => w.peek(true)).toThrow(SimInputError);
  });

  it('peekLimit 을 넘으면 오류', () => {
    const w = new World(lv(['VVV', 'S.E'], { row: [1, 2, 3], peekLimit: 2 }));
    w.peek(0);
    w.peek(1);
    expect(() => w.peek(2)).toThrow(/2번만/);
    expect(w.counts.peek).toBe(2);
  });

  it('값 개수가 칸 수와 다르거나 금고·석상이 섞이면 맵 오류', () => {
    expect(() => lv(['VV', 'SE'], { row: [1] })).toThrow(/2개인데/);
    expect(() => lv(['VW', 'SE'], { row: [1, 2] })).toThrow(/같이/);
    expect(() => lv(['WW', 'SE'], { row: [1, 1] })).toThrow(/모두 달라야/);
  });
});

describe('석상: heavier · swap', () => {
  it('heavier 는 0턴, 같은 번호끼리는 저울을 쓰지 않고 False', () => {
    const w = new World(lv(['WWW', 'S.E'], { row: [3, 1, 2], weighLimit: 2 }));
    expect(w.heavier(0, 1)).toBe(true);
    expect(w.heavier(1, 2)).toBe(false);
    expect(w.heavier(2, 2)).toBe(false);
    expect(() => w.heavier(0, 2)).toThrow(/저울을 2번/);
    expect(w.turn).toBe(0);
    expect(w.trace.map((t) => [t.event, t.pair, t.heavier])).toEqual([
      ['weigh', [0, 1], true],
      ['weigh', [1, 2], false],
    ]);
  });

  it('swap 은 1턴이고 무게 순서가 바뀐다, swapLimit · adjacentOnly', () => {
    const w = new World(lv(['WWW', 'S.E'], { row: [3, 1, 2], swapLimit: 1 }));
    w.swap(0, 2);
    expect(w.turn).toBe(1);
    expect(w.heavier(0, 2)).toBe(false);
    expect(() => w.swap(0, 1)).toThrow(/1번까지만/);

    const adj = new World(lv(['WWW', 'S.E'], { row: [3, 1, 2] }, { adjacentOnly: true }));
    expect(() => adj.swap(0, 2)).toThrow(/이웃한/);
    adj.swap(1, 0);
    expect(adj.counts.swap).toBe(1);
  });

  it('금고 맵에서 heavier, 석상 맵에서 peek 은 오류', () => {
    expect(() => new World(lv(['VV', 'SE'], { row: [1, 2] })).heavier(0, 1)).toThrow(/석상/);
    expect(() => new World(lv(['WW', 'SE'], { row: [1, 2] })).peek(0)).toThrow(/금고/);
    expect(() => new World(lv(['S.E'])).size()).toThrow(SimInputError);
  });

  it('창살 sorted: 가벼운→무거운 순서가 되면 열리고, 흐트러지면 다시 닫힌다', () => {
    const w = new World(lv(['WWW#', 'S=.E'], { row: [2, 1, 3] }, { barsRule: 'sorted' }));
    expect(w.look('right')).toBe('bars');
    turn(w, () => w.swap(0, 1));
    expect(w.look('right')).toBe('empty');
    expect(w.trace[0].barsOpen).toEqual(['1,1']);
    turn(w, () => w.swap(1, 2));
    expect(w.look('right')).toBe('bars');
  });

  it('요약에 쓴 횟수가 남고, 재생 상태에도 순서·횟수가 반영된다', () => {
    const l = lv(['WWW', 'S.E'], { row: [3, 1, 2] });
    const r = simulate(l, (w) => {
      w.heavier(0, 1);
      w.swap(0, 1);
      w.heavier(1, 2);
      w.swap(1, 2);
    });
    expect(r.counts).toEqual({ peek: 0, weigh: 2, swap: 2 });
    const b = boardAt(l, r.trace, r.trace.length);
    expect(b.row?.values).toEqual([1, 2, 3]);
    expect(b.counts).toEqual({ peek: 0, weigh: 2, swap: 2 });
    expect(boardAt(l, r.trace, 2).row?.values).toEqual([1, 3, 2]);
  });
});

describe('하노이 기둥: move_disc', () => {
  const MAP = ['#H.H.H#', '#S...=E'];
  it('원판은 처음에 모두 A, 큰 것을 작은 것 위에 놓으면 오류', () => {
    const w = new World(lv(MAP, { discs: 2 }, { barsRule: 'hanoi' }));
    expect(w.size()).toBe(2);
    w.moveDisc('A', 'B');
    expect(() => w.moveDisc('A', 'B')).toThrow(/큰 원판\(2\)/);
    expect(() => w.moveDisc('C', 'A')).toThrow(/원판이 없어요/);
    expect(() => w.moveDisc('A', 'D')).toThrow(/"A", "B", "C"/);
    expect(() => w.moveDisc('A', 'A')).toThrow(/같은 기둥/);
    expect(w.turn).toBe(1);
  });

  it('모두 C 로 옮기면 창살이 열린다 (2ⁿ−1 번)', () => {
    const l = lv(MAP, { discs: 2 }, { barsRule: 'hanoi' });
    const w = new World(l);
    turn(w, () => w.moveDisc('A', 'B'));
    turn(w, () => w.moveDisc('A', 'C'));
    expect(w.trace[1].barsOpen).toEqual([]);
    turn(w, () => w.moveDisc('B', 'C'));
    expect(w.trace[2].barsOpen).toEqual(['5,1']);
    expect(boardAt(l, w.trace, 3).pegs).toEqual([[], [], [2, 1]]);
    expect(w.trace[2]).toMatchObject({ event: 'disc', from: 1, to: 2, size: 1 });
  });

  it('기둥이 3개가 아니거나 원판 수가 없으면 맵 오류', () => {
    expect(() => lv(['HH', 'SE'], { discs: 2 })).toThrow(/3개/);
    expect(() => lv(MAP, {})).toThrow(/discs/);
  });
});

describe('요금 문: pay', () => {
  it('딱 맞게 내면 열리고, 그 전에는 막혀 있다', () => {
    const l = lv(['S$E'], { tolls: [60] });
    const w = new World(l);
    expect(w.look('right')).toBe('toll');
    w.pay(50);
    w.move('right');
    expect(w.pos).toEqual({ x: 0, y: 0 });
    w.pay(10);
    expect(w.look('right')).toBe('empty');
    expect(w.trace.filter((t) => t.event === 'pay').map((t) => [t.paid, t.opened])).toEqual([
      [50, false],
      [60, true],
    ]);
    expect(boardAt(l, w.trace, w.trace.length).tolls[0]).toMatchObject({ paid: 60, open: true });
  });

  it('넘치게 내면 경보로 쓰러진다, 없는 동전·옆에 문이 없으면 오류', () => {
    const r = simulate(lv(['S$E'], { tolls: [60] }), (w) => {
      w.pay(100);
    });
    expect(r.reason).toBe('dead');
    expect(r.trace[0]).toMatchObject({ event: 'pay_over', hp: 0 });
    const w = new World(lv(['S.$E'], { tolls: [10] }));
    expect(() => w.pay(10)).toThrow(/바로 옆/);
    expect(() => w.pay(5)).toThrow(/500, 100, 50, 10/);
  });
});

describe('창살 chests: 보물상자를 모두 열면', () => {
  it('마지막 상자를 열면 열린다', () => {
    const w = new World(lv(['E=Sc', '##.c'], {}, { barsRule: 'chests' }));
    expect(w.look('left')).toBe('bars');
    turn(w, () => w.move('right'));
    expect(w.trace[0].barsOpen).toEqual([]);
    turn(w, () => w.move('down'));
    expect(w.trace[1].barsOpen).toEqual(['1,0']);
    turn(w, () => w.move('left'));
    turn(w, () => w.move('up'));
    expect(w.look('left')).toBe('empty');
    turn(w, () => w.move('left'));
    expect(() => w.move('left')).toThrow(SimStop);
    expect(w.status).toBe('cleared');
  });
});

describe('정렬 비용 (결과 화면 비교, 스테이지 제한값)', () => {
  it('선택·버블·삽입 정렬의 저울·바꾸기 수', () => {
    const v = [3, 1, 4, 2];
    expect(inversions(v)).toBe(3);
    expect(selectionCost(v)).toEqual({ peek: 0, weigh: 6, swap: 3 });
    expect(selectionCost([4, 1, 2, 3]).swap).toBe(3);
    expect(selectionCost([1, 2, 4, 3]).swap).toBe(1);
    expect(bubbleCost(v)).toEqual({ peek: 0, weigh: 6, swap: 3 });
    expect(insertionCost(v)).toEqual({ peek: 0, weigh: 5, swap: 3 });
    // 거의 정렬된 줄: 가벼운 것 하나가 끝에 → 삽입은 적고 버블·선택은 많다
    const nearly = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
    expect(insertionCost(nearly).weigh).toBe(17);
    expect(bubbleCost(nearly).weigh).toBe(45);
    expect(selectionCost(nearly).weigh).toBe(45);
  });

  it('탐욕 동전 수', () => {
    expect(greedyCoins(1730, [500, 100, 50, 10])).toBe(3 + 2 + 0 + 3);
    expect(() => greedyCoins(15, [10])).toThrow();
  });
});
