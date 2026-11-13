// 스테이지 진행: 열기 → 코드 실행 → 실행 기록 재생 → 결과. 화면(React)과 GridScene(Phaser)은 gameStore 만 본다.
import { buildLevel, type EndReason } from '../sim';
import { python } from '../python/runner';
import { STAGES, getStage, stageIndex } from '../stages';
import { scoreRun } from '../stages/score';
import { codeFor, recordStars } from '../state/codeStore';
import { clearLog, currentTrace, gameStore, log, toast, uiStore, type Speed } from '../state/store';

const STEP_MS = 420; // 1× 속도에서 한 턴

export const REASON_TEXT: Record<EndReason, string> = {
  exit: '출구 도착!',
  dead: 'HP 가 0 이 됐어요',
  turn_limit: '턴 제한을 넘었어요',
  not_reached: '코드가 끝났는데 출구에 도착하지 못했어요',
  error: '코드에 오류가 있어요',
  timeout: '코드가 너무 오래 실행됐어요',
};

let timer: ReturnType<typeof setTimeout> | undefined;
const stopTimer = () => {
  clearTimeout(timer);
  timer = undefined;
};

export function goTitle() {
  stopTimer();
  gameStore.set({ screen: 'title', playing: false });
}

export function goSelect() {
  stopTimer();
  gameStore.set({ screen: 'select', playing: false });
}

export function openStage(stageId: string) {
  stopTimer();
  const stage = getStage(stageId);
  gameStore.set({
    screen: 'play',
    stageId,
    phase: 'plan',
    levels: stage.seeds.map((seed) => buildLevel(stage, seed)),
    result: null,
    score: null,
    newRecord: false,
    view: 0,
    step: 0,
    playing: false,
    resultHidden: false,
  });
  uiStore.set({ codeError: null, tab: 'code', panelOpen: true });
  clearLog();
  log('info', `${stageIndex(stageId) + 1}. ${stage.title} — ${stage.goal}`, '스테이지');
}

export function nextStageId(): string | null {
  const i = stageIndex(gameStore.get().stageId);
  return i >= 0 && i + 1 < STAGES.length ? STAGES[i + 1].id : null;
}

/** 코드 실행: 모든 시드를 돌리고, 첫 번째로 실패한 맵(없으면 맵 1)부터 재생 */
export async function runCode() {
  const s = gameStore.get();
  if (s.screen !== 'play' || s.phase === 'running') return;
  if (!python.ready) {
    toast('파이썬 엔진을 준비하는 중이에요. 잠시만요!', 'info');
    return;
  }
  stopTimer();
  const stage = getStage(s.stageId);
  const code = codeFor(s.stageId);
  gameStore.set({ phase: 'running', playing: false, step: 0, result: null, score: null, newRecord: false, resultHidden: false });
  uiStore.set({ codeError: null });

  const result = await python.runStage(code, s.levels, stage.api);
  if (gameStore.get().stageId !== s.stageId || gameStore.get().screen !== 'play') return; // 그 사이 화면을 나갔으면 버림

  const score = scoreRun(stage, result, code);
  const failIdx = result.runs.findIndex((r) => !r.summary.cleared);

  // 콘솔: 맵별 결과와 print 출력
  log('info', `실행! 맵 ${result.runs.length}개에 같은 코드를 돌려요.`, '실행');
  result.runs.forEach((r, i) => {
    const src = `맵 ${i + 1}`;
    r.out.forEach((line) => log('out', line, src));
    if (r.error) log('error', (r.line ? `${r.line}번째 줄 · ` : '') + r.error, src);
    else log(r.summary.cleared ? 'ok' : 'error', `${r.summary.cleared ? '✔' : '✘'} ${REASON_TEXT[r.summary.reason]} (${r.summary.turns}턴)`, src);
  });

  const firstErr = result.runs.find((r) => r.error);
  if (firstErr) uiStore.set({ codeError: { line: firstErr.line, message: firstErr.error ?? '' } });

  const newRecord = score.cleared && recordStars(s.stageId, score.stars);

  gameStore.set({ phase: 'replay', result, score, newRecord, view: failIdx >= 0 ? failIdx : 0, step: 0, playing: true });
  schedule();
}

function schedule() {
  stopTimer();
  const s = gameStore.get();
  if (!s.playing) return;
  timer = setTimeout(tick, STEP_MS / s.speed);
}

function tick() {
  const s = gameStore.get();
  const trace = currentTrace(s);
  if (s.step >= trace.length) {
    gameStore.set({ playing: false, phase: 'done' });
    return;
  }
  gameStore.set({ step: s.step + 1 });
  if (s.step + 1 >= trace.length) {
    // 마지막 장면을 잠깐 보여 준 뒤 결과 카드
    timer = setTimeout(() => gameStore.set({ playing: false, phase: 'done' }), 650 / s.speed);
    return;
  }
  schedule();
}

// ---------------- 재생 조작 ----------------

const canReplay = () => {
  const p = gameStore.get().phase;
  return p === 'replay' || p === 'done';
};

export function togglePlay() {
  if (!canReplay()) return;
  const s = gameStore.get();
  const trace = currentTrace(s);
  if (s.playing) {
    stopTimer();
    gameStore.set({ playing: false });
    return;
  }
  // 끝에서 다시 누르면 처음부터
  gameStore.set({ playing: true, phase: 'replay', resultHidden: false, step: s.step >= trace.length ? 0 : s.step });
  schedule();
}

export function stepBy(delta: number) {
  if (!canReplay()) return;
  stopTimer();
  const s = gameStore.get();
  const len = currentTrace(s).length;
  gameStore.set({ playing: false, phase: 'replay', step: Math.max(0, Math.min(len, s.step + delta)) });
}

export function seek(step: number) {
  if (!canReplay()) return;
  stopTimer();
  const len = currentTrace().length;
  gameStore.set({ playing: false, phase: 'replay', step: Math.max(0, Math.min(len, step)) });
}

export function skipToEnd() {
  if (!canReplay()) return;
  stopTimer();
  gameStore.set({ playing: false, phase: 'done', resultHidden: false, step: currentTrace().length });
}

export function setSpeed(speed: Speed) {
  gameStore.set({ speed });
  if (gameStore.get().playing) schedule();
}

export function viewSeed(i: number) {
  const s = gameStore.get();
  if (!s.result || i < 0 || i >= s.result.runs.length) return;
  stopTimer();
  const run = s.result.runs[i];
  uiStore.set({ codeError: run.error ? { line: run.line, message: run.error } : null });
  gameStore.set({ view: i, step: 0, playing: true, phase: 'replay', resultHidden: false });
  schedule();
}

export function hideResult() {
  gameStore.set({ resultHidden: true });
}

/** 결과를 닫고 다시 코드를 고치는 단계로 */
export function backToPlan() {
  stopTimer();
  gameStore.set({ phase: 'plan', playing: false, step: 0, view: 0, resultHidden: false });
}
