// 새 개념 카드와 첫 사용자 튜토리얼 상태. "이미 본 것"은 브라우저(localStorage)에 저장해 다시 띄우지 않는다.
import { STAGES, getStage } from '../stages';
import { PART_STORY, STAGE_STORY, STORY_BEATS, type PartNo } from '../stages/story';
import { createStore, gameStore, uiStore } from './store';

/** basic: 스테이지 1 화면 안내 · random: stage-05 의 ? 칸 / 여러 맵 안내 */
export type TutorialId = 'basic' | 'random';

export interface GuideState {
  /** 지금 띄운 "부 안내" 카드 (부를 처음 열 때, 파이의 이야기 + 그 부의 규칙) */
  intro: number | null;
  /** 지금 띄운 "부 끝 장면" (그 부의 마지막 정규 스테이지를 처음 깼을 때) */
  ending: number | null;
  /** 지금 띄운 중간 이야기 장면 (그 스테이지를 처음 깼을 때) */
  beat: string | null;
  /** 맵 위 파이의 한 줄 (스테이지를 열고 카드들을 다 닫은 뒤 잠깐) */
  line: string | null;
  /** 지금 띄운 개념 카드의 스테이지 */
  concept: string | null;
  /** 지금 진행 중인 튜토리얼과 단계 */
  tutorial: { id: TutorialId; step: number } | null;
}

const SEEN_KEY = 'programe.guide.v1';
interface Seen {
  concepts: string[];
  tutorials: TutorialId[];
  /** 본 부 안내 */
  intros: number[];
  /** 본 부 끝 장면 */
  endings: number[];
  /** 본 중간 이야기 (스테이지 id) */
  beats: string[];
}

function loadSeen(): Seen {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Seen>;
      return { concepts: v.concepts ?? [], tutorials: v.tutorials ?? [], intros: v.intros ?? [], endings: v.endings ?? [], beats: v.beats ?? [] };
    }
  } catch {
    /* 저장소를 쓸 수 없으면 처음부터 */
  }
  return { concepts: [], tutorials: [], intros: [], endings: [], beats: [] };
}

let seen = loadSeen();
function saveSeen() {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* 무시 */
  }
}

export const guideStore = createStore<GuideState>({ intro: null, ending: null, beat: null, line: null, concept: null, tutorial: null });

/** 스테이지를 열 때 차례로 띄울 것 (부 안내 → 개념 카드 → 튜토리얼) */
let queue: Array<{ kind: 'intro'; part: number } | { kind: 'concept'; stageId: string } | { kind: 'tutorial'; id: TutorialId }> = [];

function next() {
  const item = queue.shift();
  if (!item) {
    // 카드를 모두 닫았으면 맵 위에 파이의 한 줄
    const line = pendingLine;
    pendingLine = null;
    return guideStore.set({ intro: null, ending: null, concept: null, tutorial: null, line: line && STAGE_STORY[line] ? line : null });
  }
  if (item.kind === 'intro') guideStore.set({ intro: item.part, concept: null, tutorial: null });
  else if (item.kind === 'concept') guideStore.set({ intro: null, concept: item.stageId, tutorial: null });
  else beginTutorial(item.id);
}

/** 스테이지를 열었을 때: 처음 보는 개념 카드와, 처음이면 튜토리얼을 띄운다 */
let pendingLine: string | null = null;

export function onStageOpen(stageId: string) {
  queue = [];
  pendingLine = stageId;
  const stage = getStage(stageId);
  if (!seen.intros.includes(stage.part)) queue.push({ kind: 'intro', part: stage.part });
  if (stage.concepts?.length && !seen.concepts.includes(stageId)) queue.push({ kind: 'concept', stageId });
  if (stageId === STAGES[0].id && !seen.tutorials.includes('basic')) queue.push({ kind: 'tutorial', id: 'basic' });
  if (stageId === 'stage-05' && !seen.tutorials.includes('random')) queue.push({ kind: 'tutorial', id: 'random' });
  next();
}

/** 스테이지를 나가면 띄운 것을 모두 닫는다 */
export function closeGuide() {
  queue = [];
  pendingLine = null;
  guideStore.set({ intro: null, ending: null, beat: null, line: null, concept: null, tutorial: null });
}

/** 맵 위 파이의 한 줄 닫기 (눌렀거나, 실행했거나, 시간이 지났을 때) */
export function closeLine() {
  if (guideStore.get().line) guideStore.set({ line: null });
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

/** 이미 본 부 끝 장면 (선택 화면의 "다시 보기") */
export const seenEndings = () => seen.endings;

// ---------------- 부 끝 장면 ----------------

/** 스테이지를 깬 결과를 다 보여 준 뒤 처음 한 번: 부의 마지막 정규 스테이지면 끝 장면, 중간 이야기가 있으면 그 장면 */
export function onStageCleared(stageId: string) {
  const part = (Object.keys(PART_STORY).map(Number) as PartNo[]).find((p) => PART_STORY[p].finale === stageId);
  if (part && !seen.endings.includes(part)) guideStore.set({ ending: part, line: null });
  else if (STORY_BEATS[stageId] && !seen.beats.includes(stageId)) guideStore.set({ beat: stageId, line: null });
}

/** 중간 이야기 다시 보기 */
export function showBeat(stageId: string) {
  guideStore.set({ beat: stageId });
}

export function closeBeat() {
  const id = guideStore.get().beat;
  if (id && !seen.beats.includes(id)) {
    seen = { ...seen, beats: [...seen.beats, id] };
    saveSeen();
  }
  guideStore.set({ beat: null });
}

/** 이미 본 중간 이야기 */
export const seenBeats = () => seen.beats;

/** 끝 장면 다시 보기 */
export function showEnding(part: number) {
  guideStore.set({ ending: part });
}

export function closeEnding() {
  const part = guideStore.get().ending;
  if (part !== null && !seen.endings.includes(part)) {
    seen = { ...seen, endings: [...seen.endings, part] };
    saveSeen();
  }
  guideStore.set({ ending: null });
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
