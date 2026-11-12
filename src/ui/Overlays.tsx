import { eventBus } from '../bridge/eventBus';
import { gameStore, toastStore, uiStore, useStore } from '../state/store';
import { MISSIONS } from '../game/data';
import { EngineStatus } from './SidePanel';

const asset = (p: string) => import.meta.env.BASE_URL + p;
const CHAR = 'assets/kenney/platformer/Sprites/Characters/Default/';
const ENEMY = 'assets/kenney/platformer/Sprites/Enemies/Default/';
const TILE = 'assets/kenney/platformer/Sprites/Tiles/Default/';
const BG = 'assets/kenney/platformer/Sprites/Backgrounds/Default/';

export function Toasts() {
  const toasts = useStore(toastStore, (s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span className="toast-icon">{t.tone === 'good' ? '✔' : t.tone === 'bad' ? '!' : 'i'}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Overlays() {
  const phase = useStore(gameStore, (s) => s.phase);
  if (phase === 'title') return <TitleScreen />;
  if (phase === 'dead') return <DeadScreen />;
  if (phase === 'victory') return <VictoryScreen />;
  return null;
}

function TitleScreen() {
  const status = useStore(uiStore, (s) => s.pythonStatus);
  return (
    <div className="overlay title">
      {/* 게임 속 배경 에셋으로 꾸민 타이틀 무대 */}
      <div className="title-bg" style={{ backgroundImage: `url(${asset(BG + 'background_color_hills.png')})` }} />
      <div className="title-clouds" style={{ backgroundImage: `url(${asset(BG + 'background_clouds.png')})` }} />
      <div className="title-actors">
        <img src={asset(ENEMY + 'fly_a.png')} alt="" className="ta-fly" />
        <img src={asset(CHAR + 'character_beige_idle.png')} alt="" className="ta-hero" />
        <img src={asset(ENEMY + 'slime_normal_rest.png')} alt="" className="ta-slime" />
        <img src={asset(ENEMY + 'slime_normal_rest.png')} alt="" className="ta-slime b" />
        <img src={asset(ENEMY + 'slime_block_rest.png')} alt="" className="ta-golem" />
      </div>
      <div
        className="title-ground"
        style={{ backgroundImage: `url(${asset(TILE + 'terrain_grass_block_top.png')}), url(${asset(TILE + 'terrain_grass_block_center.png')})` }}
      />

      <div className="screen">
        <h1 className="logo">
          <span className="logo-text">programe</span>
          <em className="logo-tag">가제</em>
        </h1>
        <div className="ribbon">파이썬으로 마법을 짓는 견습 마법사의 모험</div>
        <p className="story-card">
          골렘이 마을 출구를 막아 버렸어요! <b>마법서</b>에 <b>파이썬 코드로 주문</b>을 적고,
          숫자키로 발동해서 몬스터의 약점을 공략하세요.
        </p>
        <button
          className="btn primary big start"
          autoFocus
          onClick={(e) => {
            e.currentTarget.blur();
            eventBus.emit('game:start');
          }}
        >
          모험 시작
        </button>
        <div className="title-keys">
          <span><kbd>←</kbd><kbd>→</kbd> 이동</span>
          <span><kbd>Space</kbd> 점프</span>
          <span><kbd>J</kbd> 공격</span>
          <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 코드 주문</span>
          <span><kbd>Tab</kbd> 마법서</span>
        </div>
        <div className="title-engine">
          <EngineStatus status={status} long />
        </div>
      </div>
    </div>
  );
}

function DeadScreen() {
  return (
    <div className="overlay dead">
      <div className="screen">
        <img src={asset(CHAR + 'character_beige_hit.png')} alt="" className="dead-hero" />
        <h2 className="big-title">쓰러졌어요…</h2>
        <div className="tip-card">
          <span className="tip-badge">TIP</span>
          <span>
            슬롯 3 의 <code>if get_player_hp() &lt; 50: cast("heal")</code> 처럼 위험할 때 회복하는 주문을 만들어 보세요.
          </span>
        </div>
        <button
          className="btn primary big"
          autoFocus
          onClick={(e) => {
            e.currentTarget.blur();
            eventBus.emit('game:respawn');
          }}
        >
          다시 일어나기
        </button>
      </div>
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
}

function VictoryScreen() {
  const s = useStore(gameStore, (st) => st);
  const stars = 1 + (s.deaths === 0 ? 1 : 0) + (s.casts >= 10 ? 1 : 0);
  return (
    <div className="overlay victory">
      <div className="rays" />
      <div className="screen">
        <div className="stars">
          {[0, 1, 2].map((i) => (
            <img key={i} src={asset(TILE + 'star.png')} alt="" className={i < stars ? 'on' : 'off'} />
          ))}
        </div>
        <h2 className="big-title">탈출 성공!</h2>
        <p className="sub">코드로 골렘의 약점을 찾아냈어요. 훌륭한 마법사예요!</p>
        <div className="result-card">
          <div className="stats">
            <div><span>클리어 시간</span><b>{fmtTime(s.endedAt - s.startedAt)}</b></div>
            <div><span>레벨</span><b>Lv.{s.level}</b></div>
            <div><span>처치한 몬스터</span><b>{s.kills}</b></div>
            <div><span>골드</span><b>{s.gold} G</b></div>
            <div><span>코드 실행</span><b>{s.codeRuns}회</b></div>
            <div><span>발동한 스킬</span><b>{s.casts}회</b></div>
            <div><span>만난 오류</span><b>{s.codeErrors}개</b></div>
            <div><span>쓰러진 횟수</span><b>{s.deaths}</b></div>
            <div><span>퀘스트</span><b>{s.missionsDone.length}/{MISSIONS.length}</b></div>
          </div>
          <div className="star-rule">★ 클리어 · ★ 한 번도 쓰러지지 않기 · ★ 스킬 10회 이상</div>
        </div>
        <button
          className="btn gold big"
          autoFocus
          onClick={(e) => {
            e.currentTarget.blur();
            eventBus.emit('game:restart');
          }}
        >
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
