import { useEffect, useState } from 'react';
import { eventBus } from '../bridge/eventBus';
import { codeStore } from '../state/codeStore';
import { gameStore, uiStore, useStore } from '../state/store';
import { SKILLS } from '../game/data';
import { BookIcon, SwordIcon } from './icons';

const asset = (p: string) => import.meta.env.BASE_URL + p;

export function Hotbar() {
  const slots = useStore(codeStore, (s) => s.slots);
  const busy = useStore(gameStore, (s) => s.slotBusy);
  const last = useStore(gameStore, (s) => s.slotLastCasts);
  const errors = useStore(uiStore, (s) => s.slotErrors);
  const active = useStore(uiStore, (s) => s.activeSlot);
  const panelOpen = useStore(uiStore, (s) => s.panelOpen);
  const mp = useStore(gameStore, (s) => s.mp);

  // 키보드로 발동해도 슬롯이 눌리는 연출
  const [flash, setFlash] = useState(-1);
  useEffect(() => {
    let t = 0;
    const onDown = (e: KeyboardEvent) => {
      const i = ['1', '2', '3'].indexOf(e.key);
      const el = document.activeElement as HTMLElement | null;
      if (i < 0 || el?.matches('input, textarea, select, [contenteditable="true"]')) return;
      setFlash(i);
      clearTimeout(t);
      t = window.setTimeout(() => setFlash(-1), 120);
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, []);

  return (
    <div className="hotbar">
      <div className="hb-slot basic" title="기본 공격 (J / Z)">
        <div className="hb-face">
          <span className="hb-key">J</span>
          <SwordIcon />
        </div>
        <div className="hb-name">기본 공격</div>
      </div>
      <div className="hb-sep" />
      {slots.map((s, i) => {
        const casts = last[i];
        const need = casts.reduce((a, c) => a + SKILLS[c].mp, 0);
        const lowMp = casts.length > 0 && mp < need;
        const cls = ['hb-slot', 'code', busy[i] && 'busy', errors[i] && 'error', lowMp && !busy[i] && 'low', panelOpen && i === active && 'selected', flash === i && 'flash']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={i}
            className={cls}
            title={`${s.name} — 클릭: 발동 · 우클릭: 마법서에서 코드 고치기`}
            onClick={(e) => {
              (e.currentTarget as HTMLButtonElement).blur();
              eventBus.emit('slot:trigger', i);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              uiStore.set({ activeSlot: i, panelOpen: true, tab: 'code' });
            }}
          >
            <div className="hb-face">
              <span className="hb-key">{i + 1}</span>
              {casts.length ? (
                <div className={`cast-icons n${casts.length}`}>
                  {casts.map((c, j) => (
                    <img key={j} src={asset(SKILLS[c].icon)} alt={c} data-skill={c} />
                  ))}
                </div>
              ) : (
                <BookIcon />
              )}
              {errors[i] && <span className="hb-badge err">!</span>}
              {lowMp && !busy[i] && <span className="hb-badge mp">MP</span>}
              {busy[i] && <div className="hb-ring" />}
            </div>
            <div className="hb-name">{s.name}</div>
          </button>
        );
      })}
    </div>
  );
}

/** 오른쪽 아래 조작 안내 */
export function KeyHints() {
  return (
    <div className="keyhints">
      <span>
        <kbd>←</kbd>
        <kbd>→</kbd> 이동 · <kbd>Space</kbd> 점프
      </span>
      <span>
        <kbd>Tab</kbd> 마법서 · <kbd>Esc</kbd> 게임으로
      </span>
    </div>
  );
}
