// Phaser 와 React 가 함께 쓰는 아주 작은 상태 저장소 (useSyncExternalStore 용)
import { useSyncExternalStore } from 'react';
import type { MonsterKind, SkillName } from '../game/data';

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
export type Phase = 'title' | 'playing' | 'dead' | 'victory';
export interface MiniDot { x: number; y: number; kind: MonsterKind }
export interface MapInfo { cols: number; rows: number; tile: number; solid: Uint8Array }

export interface GameState {
  phase: Phase;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  level: number; xp: number; xpNext: number;
  gold: number;
  kills: number; casts: number; codeRuns: number; codeErrors: number; deaths: number;
  startedAt: number; endedAt: number;
  player: { x: number; y: number };
  monsters: MiniDot[];
  map: MapInfo | null;
  gateOpen: boolean;
  missionsDone: string[];
  slotBusy: boolean[];
  slotLastCasts: SkillName[][];
}

export const initialGameState = (): GameState => ({
  phase: 'title',
  hp: 100, maxHp: 100, mp: 60, maxMp: 60,
  level: 1, xp: 0, xpNext: 70, gold: 0,
  kills: 0, casts: 0, codeRuns: 0, codeErrors: 0, deaths: 0,
  startedAt: 0, endedAt: 0,
  player: { x: 0, y: 0 }, monsters: [], map: null, gateOpen: false,
  missionsDone: [],
  slotBusy: [false, false, false],
  slotLastCasts: [[], [], []],
});

export const gameStore = createStore<GameState>(initialGameState());

// ---------------- UI 상태 ----------------
export type Tab = 'code' | 'missions' | 'help';
export interface SlotError { line: number | null; message: string }
export interface UiState {
  panelOpen: boolean;
  tab: Tab;
  activeSlot: number;
  slotErrors: (SlotError | null)[];
  pythonStatus: 'loading' | 'ready' | 'error';
}
export const uiStore = createStore<UiState>({
  panelOpen: true,
  tab: 'code',
  activeSlot: 0,
  slotErrors: [null, null, null],
  pythonStatus: 'loading',
});

// ---------------- 콘솔 ----------------
export type LogKind = 'info' | 'out' | 'cast' | 'error' | 'ok';
export interface LogLine { id: number; kind: LogKind; text: string; source: string }
let logId = 0;
export const consoleStore = createStore<{ lines: LogLine[] }>({ lines: [] });
export function log(kind: LogKind, text: string, source = '') {
  consoleStore.set((s) => ({ lines: [...s.lines, { id: ++logId, kind, text, source }].slice(-150) }));
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

/** 입력창/에디터에 타이핑 중이면 게임 키 입력을 막는다 */
export function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.matches('input, textarea, select, [contenteditable="true"]');
}
