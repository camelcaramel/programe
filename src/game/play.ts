// 스테이지 진행: 열기 → 코드 실행 → 실행 기록 재생 → 결과. 화면(React)과 GridScene(Phaser)은 gameStore 만 본다.
import { buildLevel, type EndReason } from '../sim';
import { python } from '../python/runner';
import { STAGES, getStage, stageIndex } from '../stages';
import { scoreRun } from '../stages/score';
import { codeFor, recordStars } from '../state/codeStore';
import { closeGuide, closeLine, onStageCleared, onStageOpen } from '../state/guide';
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

/**
 * 모두 통과했을 때는 맵 1 → 2 → 3 을 차례로 이어서 재생한다.
 * (맵 1 에만 ? 칸이 비어 있으면, 맵 1 만 보여 줄 때 "슬라임이 사라졌다"고 느끼기 쉬움)
 * 사용자가 재생 위치나 맵을 직접 고르면 멈춘다.
 */
let chainAll = false;

export function goTitle() {
  stopTimer();
  closeGuide();
  gameStore.set({ screen: 'title', playing: false });
}

export function goSelect() {
  stopTimer();
  closeGuide();
  gameStore.set({ screen: 'select', playing: false });
}

export function openStage(stageId: string) {
  stopTimer();
  chainAll = false;
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
  });
  uiStore.set({ codeError: null, tab: 'code', panelOpen: true });
  clearLog(); // 스테이지 설명은 코드 창 위쪽에 늘 보이므로 실행 결과 칸은 비워 둔다
  onStageOpen(stageId);
}

export function nextStageId(): string | null {
  const i = stageIndex(gameStore.get().stageId);
  return i >= 0 && i + 1 < STAGES.length ? STAGES[i + 1].id : null;
}

/** 코드 실행: 모든 시드를 돌리고, 실패한 맵이 있으면 그 맵을, 모두 통과면 맵 1부터 차례로 재생 */
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
  gameStore.set({ phase: 'running', playing: false, step: 0, result: null, score: null, newRecord: false });
  closeLine();
  uiStore.set({ codeError: null });

  const result = await python.runStage(code, s.levels, stage.api);
  if (gameStore.get().stageId !== s.stageId || gameStore.get().screen !== 'play') return; // 그 사이 화면을 나갔으면 버림

  const score = scoreRun(stage, result, code);
  const failIdx = result.runs.findIndex((r) => !r.summary.cleared);

  // 문법 오류면 실행 자체가 안 됐으니 재생 없이 바로 오류 표시
  if (result.runs.every((r) => r.kind === 'syntax')) {
    const r = result.runs[0];
    log('error', (r.line ? `${r.line}번째 줄 · ` : '') + r.error, '문법');
    uiStore.set({ codeError: { line: r.line, message: r.error ?? '' } });
    gameStore.set({ phase: 'done', result, score, newRecord: false, view: 0, step: 0, playing: false });
    return;
  }

  // 콘솔: 맵별 결과와 print 출력 (같은 오류가 맵마다 반복되면 짧게)
  log('info', `실행! 맵 ${result.runs.length}개에 같은 코드를 돌려요.`, '실행');
  let lastErr = '';
  result.runs.forEach((r, i) => {
    const src = `맵 ${i + 1}`;
    r.out.forEach((line) => log('out', line, src));
    const errText = r.error ? (r.line ? `${r.line}번째 줄 · ` : '') + r.error : '';
    if (r.error) log('error', errText === lastErr ? '(위와 같은 오류)' : errText, src);
    if (r.error) lastErr = errText;
    else log(r.summary.cleared ? 'ok' : 'error', `${r.summary.cleared ? '✔' : '✘'} ${REASON_TEXT[r.summary.reason]} (${r.summary.turns}턴)`, src);
  });

  const firstErr = result.runs.find((r) => r.error);
  if (firstErr) uiStore.set({ codeError: { line: firstErr.line, message: firstErr.error ?? '' } });

  const newRecord = score.cleared && recordStars(s.stageId, score.stars);
  chainAll = score.cleared && result.runs.length > 1;
  if (chainAll) log('ok', '모두 통과! 맵 1부터 차례로 보여 줄게요.', '실행');
  else if (failIdx >= 0 && result.runs.length > 1) log('info', '맵 ' + (failIdx + 1) + '에서 실패했어요. 그 장면을 보여 줄게요.', '실행');

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
    finishView();
    return;
  }
  gameStore.set({ step: s.step + 1 });
  if (s.step + 1 >= trace.length) {
    // 마지막 장면을 잠깐 보여 준 뒤 다음 맵 또는 결과
    timer = setTimeout(finishView, 650 / s.speed);
    return;
  }
  schedule();
}

/** 지금 맵 재생이 끝났을 때: 이어 볼 맵이 있으면 다음 맵, 아니면 결과 */
function finishView() {
  const s = gameStore.get();
  const total = s.result?.runs.length ?? 0;
  if (chainAll && s.view + 1 < total) {
    gameStore.set({ view: s.view + 1, step: 0, playing: true, phase: 'replay' });
    schedule();
    return;
  }
  chainAll = false;
  gameStore.set({ playing: false, phase: 'done' });
  if (s.score?.cleared) onStageCleared(s.stageId);
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
  gameStore.set({ playing: true, phase: 'replay', step: s.step >= trace.length ? 0 : s.step });
  schedule();
}

export function stepBy(delta: number) {
  if (!canReplay()) return;
  stopTimer();
  chainAll = false;
  const s = gameStore.get();
  const len = currentTrace(s).length;
  gameStore.set({ playing: false, phase: 'replay', step: Math.max(0, Math.min(len, s.step + delta)) });
}

export function seek(step: number) {
  if (!canReplay()) return;
  stopTimer();
  chainAll = false;
  const len = currentTrace().length;
  gameStore.set({ playing: false, phase: 'replay', step: Math.max(0, Math.min(len, step)) });
}

export function skipToEnd() {
  if (!canReplay()) return;
  stopTimer();
  chainAll = false;
  gameStore.set({ playing: false, phase: 'done', step: currentTrace().length });
}

export function setSpeed(speed: Speed) {
  gameStore.set({ speed });
  if (gameStore.get().playing) schedule();
}

export function viewSeed(i: number) {
  const s = gameStore.get();
  if (!s.result || i < 0 || i >= s.result.runs.length) return;
  stopTimer();
  chainAll = false;
  const run = s.result.runs[i];
  uiStore.set({ codeError: run.error ? { line: run.line, message: run.error } : null });
  gameStore.set({ view: i, step: 0, playing: true, phase: 'replay' });
  schedule();
}

/** 결과를 닫고 다시 코드를 고치는 단계로 */
export function backToPlan() {
  stopTimer();
  chainAll = false;
  gameStore.set({ phase: 'plan', playing: false, step: 0, view: 0 });
}
