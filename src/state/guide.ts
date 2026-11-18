// 새 개념 카드와 첫 사용자 튜토리얼 상태. "이미 본 것"은 브라우저(localStorage)에 저장해 다시 띄우지 않는다.
import { STAGES, getStage } from '../stages';
import { createStore, gameStore, uiStore } from './store';

/** basic: 스테이지 1 화면 안내 · random: 스테이지 5 의 ? 칸 / 여러 맵 안내 */
export type TutorialId = 'basic' | 'random';

export interface GuideState {
  /** 지금 띄운 "부 안내" 카드 (3부 처음 들어올 때) */
  intro: number | null;
  /** 지금 띄운 개념 카드의 스테이지 */
  concept: string | null;
  /** 지금 진행 중인 튜토리얼과 단계 */
  tutorial: { id: TutorialId; step: number } | null;
}

const SEEN_KEY = 'programe.guide.v1';
interface Seen {
  concepts: string[];
  tutorials: TutorialId[];
  /** 본 부 안내 (3) */
  intros: number[];
}

function loadSeen(): Seen {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Seen>;
      return { concepts: v.concepts ?? [], tutorials: v.tutorials ?? [], intros: v.intros ?? [] };
    }
  } catch {
    /* 저장소를 쓸 수 없으면 처음부터 */
  }
  return { concepts: [], tutorials: [], intros: [] };
}

let seen = loadSeen();
function saveSeen() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* 무시 */
  }
}

export const guideStore = createStore<GuideState>({ intro: null, concept: null, tutorial: null });

/** 스테이지를 열 때 차례로 띄울 것 (부 안내 → 개념 카드 → 튜토리얼) */
let queue: Array<{ kind: 'intro'; part: number } | { kind: 'concept'; stageId: string } | { kind: 'tutorial'; id: TutorialId }> = [];

function next() {
  const item = queue.shift();
  if (!item) return guideStore.set({ intro: null, concept: null, tutorial: null });
  if (item.kind === 'intro') guideStore.set({ intro: item.part, concept: null, tutorial: null });
  else if (item.kind === 'concept') guideStore.set({ intro: null, concept: item.stageId, tutorial: null });
  else beginTutorial(item.id);
}

/** 스테이지를 열었을 때: 처음 보는 개념 카드와, 처음이면 튜토리얼을 띄운다 */
export function onStageOpen(stageId: string) {
  queue = [];
  const stage = getStage(stageId);
  if (stage.part === 3 && !seen.intros.includes(3)) queue.push({ kind: 'intro', part: 3 });
  if (stage.concepts?.length && !seen.concepts.includes(stageId)) queue.push({ kind: 'concept', stageId });
  if (stageId === STAGES[0].id && !seen.tutorials.includes('basic')) queue.push({ kind: 'tutorial', id: 'basic' });
  if (stageId === 'stage-05' && !seen.tutorials.includes('random')) queue.push({ kind: 'tutorial', id: 'random' });
  next();
}

/** 스테이지를 나가면 띄운 것을 모두 닫는다 */
export function closeGuide() {
  queue = [];
  guideStore.set({ intro: null, concept: null, tutorial: null });
}

// ---------------- 부 안내 ----------------

export function closeIntro() {
  const part = guideStore.get().intro;
  if (part !== null && !seen.intros.includes(part)) {
    seen = { ...seen, intros: [...seen.intros, part] };
    saveSeen();
  }
  next();
}

/** 부 안내 다시 보기 */
export function showIntro(part: number) {
  guideStore.set({ intro: part });
}

// ---------------- 개념 카드 ----------------

/** 개념 카드 열기 (다시 보기). 큐와 상관없이 바로 띄운다 */
export function showConcept(stageId: string) {
  guideStore.set({ concept: stageId });
}

export function closeConcept() {
  const id = guideStore.get().concept;
  if (id && !seen.concepts.includes(id)) {
    seen = { ...seen, concepts: [...seen.concepts, id] };
    saveSeen();
  }
  if (guideStore.get().tutorial) guideStore.set({ concept: null });
  else next();
}

// ---------------- 튜토리얼 ----------------

function beginTutorial(id: TutorialId) {
  uiStore.set({ panelOpen: true, tab: 'code' });
  guideStore.set({ concept: null, tutorial: { id, step: 0 } });
}

/** "튜토리얼 다시 보기": 지금 화면에서 바로 시작 */
export function replayTutorial(id: TutorialId = 'basic') {
  queue = [];
  beginTutorial(id);
}

export function tutorialStep(step: number) {
  const t = guideStore.get().tutorial;
  if (t) guideStore.set({ tutorial: { ...t, step } });
}

/** 마지막 단계를 마쳤거나 건너뛰었을 때. 다시 뜨지 않게 기록한다 */
export function endTutorial() {
  const t = guideStore.get().tutorial;
  if (t && !seen.tutorials.includes(t.id)) {
    seen = { ...seen, tutorials: [...seen.tutorials, t.id] };
    saveSeen();
  }
  guideStore.set({ tutorial: null });
  next();
}

/** 지금 스테이지까지 나온 개념 (명령 사전의 "배운 개념" 목록) */
export function learnedConcepts(stageId = gameStore.get().stageId) {
  const upto = STAGES.findIndex((s) => s.id === stageId);
  return STAGES.slice(0, upto + 1).flatMap((s, i) => (s.concepts ?? []).map((c) => ({ stageId: s.id, num: i + 1, name: c.name })));
}
