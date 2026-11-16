// 스테이지 잠금과 교사용 "모두 열기"
import { describe, expect, it } from 'vitest';
import { STAGES } from '../stages';
import { isUnlocked, setUnlockAll, teacherMode, teacherStore } from './codeStore';

describe('스테이지 잠금', () => {
  it('처음에는 1단계만 열리고, 앞 단계를 깨면 다음이 열린다', () => {
    expect(isUnlocked(STAGES[0].id, {}, false)).toBe(true);
    expect(isUnlocked(STAGES[1].id, {}, false)).toBe(false);
    expect(isUnlocked(STAGES[1].id, { [STAGES[0].id]: { stars: 1 } }, false)).toBe(true);
    expect(isUnlocked(STAGES[10].id, { [STAGES[8].id]: { stars: 3 } }, false)).toBe(false);
  });

  it('교사용 모두 열기를 켜면 모든 스테이지가 열리고, 끄면 다시 잠긴다', () => {
    expect(teacherMode).toBe(false);
    expect(teacherStore.get().unlockAll).toBe(false);
    setUnlockAll(true);
    expect(STAGES.every((s) => isUnlocked(s.id, {}))).toBe(true);
    setUnlockAll(false);
    expect(isUnlocked(STAGES[17].id, {})).toBe(false);
  });
});
