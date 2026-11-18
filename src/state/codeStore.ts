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

// ---------------- 추천 순서 ----------------
// 모든 스테이지는 처음부터 열려 있다 (교사가 수업 순서를 정할 수 있게). 번호 순서가 추천 순서이고,
// 아직 깨지 않은 첫 스테이지를 "다음 추천"으로 표시한다.

/** 번호 순서로 처음 만나는, 아직 클리어하지 않은 스테이지 (모두 깼으면 null) */
export function nextRecommended(stages = progressStore.get().stages): string | null {
  return STAGES.find((s) => (stages[s.id]?.stars ?? 0) === 0)?.id ?? null;
}

export function resetProgress() {
  progressStore.set({ stages: {} });
}
