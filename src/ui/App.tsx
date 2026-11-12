import { useEffect, useRef } from 'react';
import { createGame } from '../game/config';
import { python } from '../python/runner';
import { gameStore, isTyping, uiStore } from '../state/store';
import { codeStore } from '../state/codeStore';
import { Hud, MissionBanner } from './Hud';
import { SidePanel } from './SidePanel';
import { Hotbar, KeyHints } from './Hotbar';
import { Overlays, Toasts } from './Overlays';

export default function App() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    python.start();
    // 캔버스 글씨(피해량 등)도 UI 와 같은 글꼴을 쓰도록 미리 불러 둔다
    document.fonts?.load('20px Jua', '0123456789+-약점효과가별로레벨업코드오류부족 HP MP LEVEL UP!').catch(() => {});
    const game = createGame(host.current!);
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __stores: { gameStore, codeStore, uiStore } });

    // 패널을 접고 펼 때 캔버스 크기 다시 맞추기
    const ro = new ResizeObserver(() => game.scale.refresh());
    ro.observe(host.current!);

    // 캔버스를 클릭하면 에디터 포커스를 빼서 바로 게임 조작이 되게
    const canvasDown = () => (document.activeElement as HTMLElement | null)?.blur();
    host.current!.addEventListener('pointerdown', canvasDown);

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
      // 버튼을 클릭한 뒤 Space 가 그 버튼을 다시 누르지 않게 포커스만 뺀다 (preventDefault 하면 Phaser 가 키를 무시함)
      if (!typing && e.key === ' ' && document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      game.destroy(true);
    };
  }, []);

  return (
    <div className="app">
      <div className="main">
        {/* 게임 화면 위에 HUD·퀘스트·핫바가 떠 있는 구조 */}
        <div className="stage">
          <div className="canvas" ref={host} />
          <div className="stage-vignette" />
          <Hud />
          <MissionBanner />
          <Toasts />
          <Hotbar />
          <KeyHints />
        </div>
        <SidePanel />
      </div>
      <Overlays />
    </div>
  );
}
