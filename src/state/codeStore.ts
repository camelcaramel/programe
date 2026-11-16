// 스테이지별 학생 코드와 진행 상황(별). 브라우저 localStorage 에 자동 저장한다.
import { STAGES, getStage } from '../stages';
import { createStore } from './store';

const CODE_KEY = 'programe.code.v2';
const PROGRESS_KEY = 'programe.progress.v2';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* 저장소를 쓸 수 없거나 망가졌으면 기본값 */
  }
  return fallback;
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 무시 */
  }
}

// ---------------- 코드 ----------------
export const codeStore = createStore<{ code: Record<string, string> }>({ code: read(CODE_KEY, {}) });

let saveTimer: ReturnType<typeof setTimeout> | undefined;
codeStore.subscribe(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => write(CODE_KEY, codeStore.get().code), 300);
});

export const codeFor = (stageId: string) => codeStore.get().code[stageId] ?? getStage(stageId)?.starter ?? '';

export function setCode(stageId: string, code: string) {
  codeStore.set((s) => ({ code: { ...s.code, [stageId]: code } }));
}

export function resetCode(stageId: string) {
  setCode(stageId, getStage(stageId).starter);
}

// ---------------- 진행 상황 ----------------
export interface StageProgress {
  /** 받은 최고 별 수 (0~3), 클리어하면 1 이상 */
  stars: number;
}

export const progressStore = createStore<{ stages: Record<string, StageProgress> }>({ stages: read(PROGRESS_KEY, {}) });
progressStore.subscribe(() => write(PROGRESS_KEY, progressStore.get().stages));

/** 더 많은 별을 받았을 때만 기록. 새 기록이면 true */
export function recordStars(stageId: string, stars: number): boolean {
  const prev = progressStore.get().stages[stageId]?.stars ?? 0;
  if (stars <= prev) return false;
  progressStore.set((s) => ({ stages: { ...s.stages, [stageId]: { stars } } }));
  return true;
}

export const starsOf = (stageId: string) => progressStore.get().stages[stageId]?.stars ?? 0;

// ---------------- 교사용 "모두 열기" ----------------
const TEACHER_KEY = 'programe.teacher.v1';

/** 주소 끝에 ?teacher 를 붙여 들어오면 스테이지 선택 화면에 교사용 막대가 보인다 */
export const teacherMode = (() => {
  try {
    return new URLSearchParams(location.search).has('teacher') || location.hash === '#teacher';
  } catch {
    return false;
  }
})();

/** unlockAll: 이 브라우저에서 모든 스테이지를 연다 (별 기록은 건드리지 않음) */
export const teacherStore = createStore<{ unlockAll: boolean }>({ unlockAll: read(TEACHER_KEY, { unlockAll: false }).unlockAll === true });
teacherStore.subscribe(() => write(TEACHER_KEY, teacherStore.get()));

export function setUnlockAll(on: boolean) {
  teacherStore.set({ unlockAll: on });
}

/** 첫 스테이지이거나 바로 앞 스테이지를 클리어했으면 열린다. 교사용 "모두 열기"가 켜져 있으면 모두 열린다 */
export function isUnlocked(stageId: string, stages = progressStore.get().stages, unlockAll = teacherStore.get().unlockAll): boolean {
  if (unlockAll) return true;
  const i = STAGES.findIndex((s) => s.id === stageId);
  if (i <= 0) return true;
  return (stages[STAGES[i - 1].id]?.stars ?? 0) > 0;
}

export function resetProgress() {
  progressStore.set({ stages: {} });
}
