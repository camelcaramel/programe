// 4부 정렬 비교용: 같은 석상 줄에 교과서 정렬 알고리즘을 돌렸다면 저울(비교)·바꾸기를 몇 번 썼을지 센다.
// 결과 화면의 비교 막대와, 스테이지 정의의 횟수 제한(33의 저울 수 등)을 정할 때 쓴다.
// 세는 방법은 PART4.md 의 정답 예시 코드와 똑같이 맞춘다.
import type { AlgoCounts } from './types';

export type SortName = 'selection' | 'bubble' | 'insertion';

export const SORT_LABEL: Record<SortName, string> = {
  selection: '선택 정렬',
  bubble: '버블 정렬',
  insertion: '삽입 정렬',
};

/** 선택 정렬: 남은 것 중 가장 가벼운 것을 찾아 앞자리와 바꾼다 (이미 제자리면 바꾸지 않음) */
export function selectionCost(values: readonly number[]): AlgoCounts {
  const a = [...values];
  let weigh = 0;
  let swap = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let small = i;
    for (let j = i + 1; j < a.length; j++) {
      weigh++;
      if (a[small] > a[j]) small = j;
    }
    if (small !== i) {
      [a[i], a[small]] = [a[small], a[i]];
      swap++;
    }
  }
  return { peek: 0, weigh, swap };
}

/** 버블 정렬: 이웃을 비교해 무거운 쪽을 뒤로. 한 바퀴 동안 바꾼 게 없으면 멈춘다 */
export function bubbleCost(values: readonly number[]): AlgoCounts {
  const a = [...values];
  let weigh = 0;
  let swap = 0;
  for (let k = 0; k < a.length - 1; k++) {
    let swapped = false;
    for (let i = 0; i < a.length - 1 - k; i++) {
      weigh++;
      if (a[i] > a[i + 1]) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        swap++;
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return { peek: 0, weigh, swap };
}

/** 삽입 정렬: 왼쪽 이웃보다 가벼운 동안 한 칸씩 왼쪽으로 (이웃끼리 바꾸기) */
export function insertionCost(values: readonly number[]): AlgoCounts {
  const a = [...values];
  let weigh = 0;
  let swap = 0;
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      weigh++;
      if (!(a[j - 1] > a[j])) break;
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      swap++;
      j--;
    }
  }
  return { peek: 0, weigh, swap };
}

export const SORT_COST: Record<SortName, (values: readonly number[]) => AlgoCounts> = {
  selection: selectionCost,
  bubble: bubbleCost,
  insertion: insertionCost,
};

/** 뒤바뀐 쌍의 수 (이웃끼리 바꾸는 정렬이 꼭 바꿔야 하는 횟수) */
export function inversions(values: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) if (values[i] > values[j]) n++;
  return n;
}

/** 탐욕 알고리즘으로 낼 동전 수 (큰 동전부터) */
export function greedyCoins(fee: number, coins: readonly number[]): number {
  let n = 0;
  let left = fee;
  for (const c of coins) {
    n += Math.floor(left / c);
    left %= c;
  }
  if (left !== 0) throw new Error(`동전 ${coins.join('·')} 으로 ${fee} 을(를) 낼 수 없어요`);
  return n;
}
