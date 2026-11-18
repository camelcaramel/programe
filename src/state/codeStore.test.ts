// 모든 스테이지는 처음부터 열려 있고, 아직 깨지 않은 첫 스테이지를 추천한다
import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import { nextRecommended } from './codeStore';

describe('추천 순서', () => {
  it('처음에는 1단계를 추천한다', () => {
    expect(nextRecommended({})).toBe(STAGES[0].id);
  });

  it('깬 스테이지는 건너뛰고, 번호 순서로 처음 남은 스테이지를 추천한다', () => {
    expect(nextRecommended({ [STAGES[0].id]: { stars: 1 } })).toBe(STAGES[1].id);
    expect(nextRecommended({ [STAGES[0].id]: { stars: 3 }, [STAGES[2].id]: { stars: 2 } })).toBe(STAGES[1].id);
  });

  it('모두 깨면 추천이 없다', () => {
    expect(nextRecommended(Object.fromEntries(STAGES.map((s) => [s.id, { stars: 1 }])))).toBeNull();
  });
});
