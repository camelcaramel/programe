import { gameStore, toastStore, uiStore, useStore } from '../state/store';
import { isUnlocked, progressStore } from '../state/codeStore';
import { goSelect, goTitle, openStage } from '../game/play';
import { STAGES } from '../stages';
import { TILE } from '../game/scenes/GridScene';
import { EngineStatus, tileImg } from './SidePanel';
import { LockIcon, StarIcon } from './icons';

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
  const screen = useStore(gameStore, (s) => s.screen);
  if (screen === 'title') return <TitleScreen />;
  if (screen === 'select') return <StageSelect />;
  return null;
}

/** 바닥 타일을 깐 던전 배경 */
const floorBg = { backgroundImage: `url(${tileImg(TILE.floor)})` };

function TitleScreen() {
  const status = useStore(uiStore, (s) => s.pythonStatus);
  return (
    <div className="overlay title dungeon-bg" style={floorBg}>
      <div className="title-actors">
        <img src={tileImg(TILE.bat)} alt="" className="pixel ta ta-bat" />
        <img src={tileImg(TILE.player)} alt="" className="pixel ta ta-hero" />
        <img src={tileImg(TILE.slime)} alt="" className="pixel ta ta-slime" />
        <img src={tileImg(TILE.giant)} alt="" className="pixel ta ta-giant" />
        <img src={tileImg(TILE.chest)} alt="" className="pixel ta ta-chest" />
      </div>
      <div className="screen">
        <h1 className="logo">
          <span className="logo-text">programe</span>
          <em className="logo-tag">가제</em>
        </h1>
        <div className="ribbon">파이썬 주문으로 던전을 탈출하라</div>
        <p className="story-card">
          맵을 잘 살펴보고, <b>마법서에 파이썬 코드</b>로 이동 계획을 적으세요.
          <br />
          캐릭터는 <b>오직 내 코드대로만</b>움직여요. <b>?</b> 칸은 실행할 때마다 바뀌니 조심!
        </p>
        <button
          className="btn primary big start"
          autoFocus
          onClick={(e) => {
            e.currentTarget.blur();
            goSelect();
          }}
        >
          모험 시작
        </button>
        <div className="title-engine">
          <EngineStatus status={status} long />
        </div>
      </div>
    </div>
  );
}

function StageSelect() {
  const progress = useStore(progressStore, (s) => s.stages);
  const total = STAGES.reduce((n, s) => n + (progress[s.id]?.stars ?? 0), 0);
  return (
    <div className="overlay select dungeon-bg" style={floorBg}>
      <div className="screen wide">
        <div className="select-head">
          <button className="btn ghost small" onClick={goTitle}>
            ◀ 처음 화면
          </button>
          <h2 className="select-title">던전 지도</h2>
          <div className="star-total">
            <StarIcon on />
            {total} / {STAGES.length * 3}
          </div>
        </div>
        <div className="stage-grid">
          {STAGES.map((s, i) => {
            const open = isUnlocked(s.id, progress);
            const stars = progress[s.id]?.stars ?? 0;
            return (
              <button
                key={s.id}
                className={`stage-card ${open ? '' : 'locked'} ${stars > 0 ? 'cleared' : ''}`}
                disabled={!open}
                onClick={() => openStage(s.id)}
                title={open ? s.goal : '앞 스테이지를 클리어하면 열려요'}
              >
                <span className="sc-num">{i + 1}</span>
                <span className="sc-title">{s.title}</span>
                <span className="sc-concept">{s.concept}</span>
                <span className="sc-stars">
                  {open ? [0, 1, 2].map((k) => <StarIcon key={k} on={k < stars} />) : <LockIcon />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
