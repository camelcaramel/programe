import { useEffect, useRef } from 'react';
import { gameStore, uiStore, useStore } from '../state/store';
import { MISSIONS } from '../game/data';

const asset = (p: string) => import.meta.env.BASE_URL + p;
const TILE_IMG = 'assets/kenney/platformer/Sprites/Tiles/Default/';

/** 게임식 체력/마나 바: 줄어들 때 하얀 잔상이 천천히 따라온다 */
function GameBar({ value, max, kind, label, small }: { value: number; max: number; kind: 'hp' | 'mp'; label: string; small?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`gbar ${kind}${small ? ' small' : ''}`} role="meter" aria-label={label} aria-valuenow={value} aria-valuemax={max}>
      <div className="gbar-trail" style={{ width: `${pct}%` }} />
      <div className="gbar-fill" style={{ width: `${pct}%` }} />
      <div className="gbar-text">
        <span>{label}</span>
        <span>
          {value} / {max}
        </span>
      </div>
    </div>
  );
}

export function Hud() {
  const hp = useStore(gameStore, (s) => s.hp);
  const maxHp = useStore(gameStore, (s) => s.maxHp);
  const mp = useStore(gameStore, (s) => s.mp);
  const maxMp = useStore(gameStore, (s) => s.maxMp);
  const xp = useStore(gameStore, (s) => s.xp);
  const xpNext = useStore(gameStore, (s) => s.xpNext);
  const level = useStore(gameStore, (s) => s.level);
  const gold = useStore(gameStore, (s) => s.gold);
  const danger = maxHp > 0 && hp > 0 && hp / maxHp < 0.3;

  // 골드가 늘면 살짝 튀는 연출
  const goldEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = goldEl.current;
    if (!el || gold === 0) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }, [gold]);

  return (
    <>
      <div className="hud-player">
        <div className={`portrait${danger ? ' danger' : ''}`}>
          <img src={asset(TILE_IMG + 'hud_player_beige.png')} alt="" />
          <span className="lv-badge">Lv.{level}</span>
        </div>
        <div className="hud-plate">
          <GameBar value={hp} max={maxHp} kind="hp" label="HP" />
          <GameBar value={mp} max={maxMp} kind="mp" label="MP" small />
          <div className="xp-row" role="meter" aria-label="경험치" aria-valuenow={xp} aria-valuemax={xpNext}>
            <div className="xp-track">
              <div className="xp-fill" style={{ width: `${xpNext > 0 ? Math.min(100, (xp / xpNext) * 100) : 0}%` }} />
            </div>
            <span className="xp-text">
              EXP {xp}/{xpNext}
            </span>
          </div>
        </div>
      </div>

      <div className="hud-right">
        <div className="gold-pill" ref={goldEl} title="골드">
          <img src={asset(TILE_IMG + 'hud_coin.png')} alt="" />
          {gold}
        </div>
        <Minimap />
      </div>
    </>
  );
}

function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = canvas.current;
      const s = gameStore.get();
      if (!c || !s.map) return;
      const { cols, rows, tile, solid } = s.map;
      const k = 2; // 타일 1칸 = 2px
      if (c.width !== cols * k) {
        c.width = cols * k;
        c.height = rows * k;
      }
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      // 게임 속 흙/잔디 색 그대로
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          if (!solid[y * cols + x]) continue;
          const top = y === 0 || !solid[(y - 1) * cols + x];
          ctx.fillStyle = top ? '#2ecc71' : '#de7e4f';
          ctx.fillRect(x * k, y * k, k, k);
        }
      if (!s.gateOpen) {
        ctx.fillStyle = '#353541';
        ctx.fillRect(88 * k, 8 * k, k, 4 * k);
      }
      for (const m of s.monsters) {
        const r = m.kind === 'golem' ? 4 : 3;
        ctx.fillStyle = '#353541';
        ctx.fillRect(Math.round((m.x / tile) * k - r / 2) - 0.5, Math.round((m.y / tile) * k - r / 2) - 0.5, r + 1, r + 1);
        ctx.fillStyle = '#e54341';
        ctx.fillRect(Math.round((m.x / tile) * k - r / 2), Math.round((m.y / tile) * k - r / 2), r, r);
      }
      const px = Math.round((s.player.x / tile) * k);
      const py = Math.round((s.player.y / tile) * k);
      ctx.fillStyle = '#353541';
      ctx.fillRect(px - 3, py - 3, 6, 6);
      ctx.fillStyle = '#ffc533';
      ctx.fillRect(px - 2, py - 2, 4, 4);
    };
    draw();
    return gameStore.subscribe(draw);
  }, []);
  return (
    <div className="hud-map" title="지도 (노랑: 나 · 빨강: 몬스터 · 검정: 닫힌 문)">
      <canvas ref={canvas} />
    </div>
  );
}

/** 왼쪽 위 퀘스트 추적기 — 클릭하면 마법서의 미션 탭이 열린다 */
export function MissionBanner() {
  const done = useStore(gameStore, (s) => s.missionsDone);
  const phase = useStore(gameStore, (s) => s.phase);
  const cur = MISSIONS.find((m) => !done.includes(m.id));
  if (!cur || phase !== 'playing') return null;
  const idx = MISSIONS.indexOf(cur);
  return (
    <div key={cur.id} className="quest" onClick={() => uiStore.set({ panelOpen: true, tab: 'missions' })}>
      <div className="quest-head">
        <span className="quest-tag">퀘스트</span>
        <span className="quest-count">
          {idx + 1} / {MISSIONS.length}
        </span>
      </div>
      <div className="quest-title">{cur.title}</div>
      <div className="quest-desc">{cur.desc}</div>
      <div className="quest-more">클릭하면 힌트를 볼 수 있어요 ▸</div>
    </div>
  );
}
