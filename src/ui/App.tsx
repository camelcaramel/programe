import { useEffect, useRef } from 'react';
import { createGame } from '../game/config';
import { python } from '../python/runner';
import { gameStore, isTyping, uiStore } from '../state/store';
import { codeStore, progressStore } from '../state/codeStore';
import * as play from '../game/play';
import { runCode, stepBy, togglePlay } from '../game/play';
import { ReplayBar, ResultCard, StageHud } from './Hud';
import { SidePanel } from './SidePanel';
import { Overlays, Toasts } from './Overlays';
import { Guide } from './Guide';
import { guideStore } from '../state/guide';

export default function App() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    python.start();
    // 캔버스 글씨도 UI 와 같은 글꼴을 쓰도록 미리 불러 둔다
    document.fonts?.load('40px Jua', '0123456789+-?쿵효과없음').catch(() => {});
    const game = createGame(host.current!);
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __play: play, __stores: { gameStore, codeStore, uiStore, progressStore, guideStore } });

    // 패널을 접고 펼 때 캔버스 크기 다시 맞추기
    const ro = new ResizeObserver(() => game.scale.refresh());
    ro.observe(host.current!);

    // 캔버스를 클릭하면 에디터 포커스를 빼서 단축키가 바로 먹게
    const canvasDown = () => (document.activeElement as HTMLElement | null)?.blur();
    host.current!.addEventListener('pointerdown', canvasDown);

    // Ctrl/⌘ + Enter = 실행 (에디터 안에서도 먹도록 capture 단계에서 먼저 받는다)
    const onRunKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && gameStore.get().screen === 'play') {
        e.preventDefault();
        e.stopPropagation();
        void runCode();
      }
    };
    window.addEventListener('keydown', onRunKey, true);

    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping();
      if (e.key === 'Tab' && !typing) {
        e.preventDefault();
        uiStore.set((s) => ({ panelOpen: !s.panelOpen }));
        return;
      }
      if (e.key === 'Escape' && typing && !document.querySelector('.suggest-widget.visible')) {
        (document.activeElement as HTMLElement).blur();
        return;
      }
      if (typing || gameStore.get().screen !== 'play') return;
      if (e.key === ' ' && !(document.activeElement instanceof HTMLButtonElement)) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') stepBy(1);
      else if (e.key === 'ArrowLeft') stepBy(-1);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onRunKey, true);
      ro.disconnect();
      game.destroy(true);
    };
  }, []);

  return (
    <div className="app">
      <div className="main">
        <div className="stage">
          <div className="canvas" ref={host} />
          <div className="stage-vignette" />
          <StageHud />
          <Toasts />
          <ReplayBar />
          <ResultCard />
        </div>
        <SidePanel />
      </div>
      <Overlays />
      <Guide />
    </div>
  );
}
