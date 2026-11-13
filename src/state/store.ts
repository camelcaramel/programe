// Phaser 와 React 가 함께 쓰는 아주 작은 상태 저장소 (useSyncExternalStore 용)
import { useSyncExternalStore } from 'react';
import type { Level, TraceStep } from '../sim';
import type { StageRunResult } from '../python/stageBridge';
import type { Score } from '../stages/score';

export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(p) {
      const patch = typeof p === 'function' ? p(state) : p;
      let changed = false;
      for (const k in patch) if (!Object.is(state[k], patch[k])) changed = true;
      if (!changed) return;
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

// ---------------- 게임 상태 ----------------
export type Screen = 'title' | 'select' | 'play';
/**
 * plan    : 맵을 보며 코드를 쓰는 중
 * running : 파이썬 실행 중 (결과 기다림)
 * replay  : 실행 기록 재생 중
 * done    : 재생이 끝나고 결과 카드를 보여 주는 중
 */
export type PlayPhase = 'plan' | 'running' | 'replay' | 'done';
export type Speed = 1 | 2 | 4;

export interface GameState {
  screen: Screen;
  stageId: string;
  phase: PlayPhase;
  /** 현재 스테이지의 시드별 맵 */
  levels: Level[];
  result: StageRunResult | null;
  score: Score | null;
  /** 이번 실행으로 별 최고 기록을 새로 세웠는지 */
  newRecord: boolean;
  /** 보고 있는 시드 번호(levels 의 index) */
  view: number;
  /** 재생 위치: trace 에서 몇 개를 적용했는지 */
  step: number;
  playing: boolean;
  speed: Speed;
  /** 재생 끝에 결과 카드를 닫았는지 */
  resultHidden: boolean;
}

export const gameStore = createStore<GameState>({
  screen: 'title',
  stageId: 'stage-01',
  phase: 'plan',
  levels: [],
  result: null,
  score: null,
  newRecord: false,
  view: 0,
  step: 0,
  playing: false,
  speed: 1,
  resultHidden: false,
});

/** 지금 보고 있는 시드의 실행 기록 */
export function currentTrace(s: GameState = gameStore.get()): TraceStep[] {
  return s.result?.runs[s.view]?.summary.trace ?? [];
}

// ---------------- UI 상태 ----------------
export type Tab = 'code' | 'help';
export interface CodeError {
  line: number | null;
  message: string;
}
export interface UiState {
  panelOpen: boolean;
  tab: Tab;
  /** 에디터에 빨간 밑줄로 보여 줄 오류 */
  codeError: CodeError | null;
  pythonStatus: 'loading' | 'ready' | 'error';
  muted: boolean;
  /** 맵에 격자와 좌표 번호 표시 */
  showGrid: boolean;
}

const MUTE_KEY = 'programe.muted';
const GRID_KEY = 'programe.grid';
function loadFlag(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export const uiStore = createStore<UiState>({
  panelOpen: true,
  tab: 'code',
  codeError: null,
  pythonStatus: 'loading',
  muted: loadFlag(MUTE_KEY, false),
  showGrid: loadFlag(GRID_KEY, true),
});

uiStore.subscribe(() => {
  try {
    localStorage.setItem(MUTE_KEY, uiStore.get().muted ? '1' : '0');
    localStorage.setItem(GRID_KEY, uiStore.get().showGrid ? '1' : '0');
  } catch {
    /* 저장소를 못 쓰면 무시 */
  }
});

// ---------------- 콘솔 ----------------
export type LogKind = 'info' | 'out' | 'ok' | 'error';
export interface LogLine { id: number; kind: LogKind; text: string; source: string }
let logId = 0;
export const consoleStore = createStore<{ lines: LogLine[] }>({ lines: [] });
export function log(kind: LogKind, text: string, source = '') {
  consoleStore.set((s) => ({ lines: [...s.lines, { id: ++logId, kind, text, source }].slice(-200) }));
}
export const clearLog = () => consoleStore.set({ lines: [] });

// ---------------- 토스트 ----------------
export interface Toast { id: number; text: string; tone: 'good' | 'bad' | 'info' }
let toastId = 0;
export const toastStore = createStore<{ toasts: Toast[] }>({ toasts: [] });
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const id = ++toastId;
  toastStore.set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-4) }));
  setTimeout(() => toastStore.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
}

/** 입력창/에디터에 타이핑 중이면 단축키를 막는다 */
export function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  // Monaco 는 textarea 대신 EditContext div 를 쓸 수도 있어서 에디터 안인지도 확인한다
  return el.matches('input, textarea, select, [contenteditable="true"]') || !!el.closest('.monaco-editor');
}
