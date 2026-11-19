// 이야기 글이 모든 스테이지에 있고, 학생이 읽기 부담스럽지 않은 길이인지 (STORY.md 원칙)
import { describe, expect, it } from 'vitest';
import { STAGES } from './index';
import { PART_STORY, STAGE_STORY, type PartNo } from './story';

describe('이야기', () => {
  it('모든 스테이지에 한 줄 이야기가 있고, 없는 스테이지 id 는 없다', () => {
    expect(Object.keys(STAGE_STORY).sort()).toEqual(STAGES.map((s) => s.id).sort());
  });

  it('스테이지 한 줄은 60자 안팎(70자 이하)', () => {
    for (const [id, line] of Object.entries(STAGE_STORY)) expect(line.length, id).toBeLessThanOrEqual(70);
  });

  it('부 시작 대사는 2~4줄, 끝 장면은 그 부의 정규 스테이지 중 마지막에서', () => {
    for (const p of [1, 2, 3, 4] as PartNo[]) {
      const st = PART_STORY[p];
      expect(st.intro.length).toBeGreaterThanOrEqual(2);
      expect(st.intro.length).toBeLessThanOrEqual(4);
      const regular = STAGES.filter((s) => s.part === p && !s.challenge);
      expect(st.finale, `${p}부`).toBe(regular[regular.length - 1].id);
    }
  });
});
