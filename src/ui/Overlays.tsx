import { gameStore, toastStore, uiStore, useStore } from '../state/store';
import { nextRecommended, progressStore } from '../state/codeStore';
import { goSelect, goTitle, openStage } from '../game/play';
import { STAGES, type StageInfo } from '../stages';
import { replayTutorial } from '../state/guide';
import { TILE } from '../game/scenes/GridScene';
import { EngineStatus, tileImg } from './SidePanel';
import { StarIcon } from './icons';

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
          맵을 잘 살펴보고, <b>파이썬 코드</b>로 이동 계획을 적으세요.
          <br />
          캐릭터는 <b>오직 내 코드대로만</b> 움직여요. <b>?</b> 칸은 실행할 때마다 바뀌니 조심!
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
        <div className="title-links">
          <button
            className="link"
            onClick={() => {
              openStage(STAGES[0].id);
              replayTutorial('basic');
            }}
          >
            튜토리얼 다시 보기
          </button>
        </div>
        <div className="title-engine">
          <EngineStatus status={status} long />
        </div>
      </div>
    </div>
  );
}

/** 선택 화면의 부 나누기 */
const PARTS: { part: StageInfo['part']; title: string; sub: string }[] = [
  { part: 1, title: '1부 · 첫 주문들', sub: '순서 · for · if · while · 함수' },
  { part: 2, title: '2부 · 기억과 목록', sub: '변수 · 자료형 · 리스트 · return' },
  { part: 3, title: '3부 · 객체와 로봇들', sub: '객체 · 딕셔너리 · 클래스 · 2차원 리스트 · 탐색' },
  { part: 4, title: '4부 · 알고리즘의 탑', sub: '순차·이진 탐색 · 최댓값 · 선택·버블·삽입 정렬 · 도전: 재귀 · 탐욕 · DFS' },
];

function StageSelect() {
  const progress = useStore(progressStore, (s) => s.stages);
  const total = STAGES.reduce((n, s) => n + (progress[s.id]?.stars ?? 0), 0);
  const next = nextRecommended(progress);
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
        <p className="select-tip">모든 스테이지가 열려 있어요. 번호 순서대로 하면 개념을 차례로 배울 수 있어요.</p>
        {PARTS.map((p) => (
          <PartSection key={p.part} {...p} progress={progress} next={next} />
        ))}
      </div>
    </div>
  );
}

function PartSection({
  part,
  title,
  sub,
  progress,
  next,
}: {
  part: StageInfo['part'];
  title: string;
  sub: string;
  progress: Record<string, { stars: number }>;
  next: string | null;
}) {
  const list: [StageInfo, number][] = STAGES.map((s, i) => [s, i] as [StageInfo, number]).filter(([s]) => s.part === part);
  return (
    <>
      <div className="part-head">
        <h3>{title}</h3>
        <small>{sub}</small>
      </div>
      <div className="stage-grid">
        {list.map(([s, i]) => {
          const stars = progress[s.id]?.stars ?? 0;
          const isNext = s.id === next;
          return (
            <button
              key={s.id}
              className={`stage-card ${stars > 0 ? 'cleared' : ''} ${isNext ? 'next' : ''}`}
              onClick={() => openStage(s.id)}
              title={s.goal}
              aria-label={`${i + 1}. ${s.title} (${s.concept})${s.challenge ? ', 도전' : ''} 별 ${stars}개${isNext ? ', 다음 추천' : ''}`}
            >
              {isNext && <span className="sc-next">다음 추천</span>}
              {s.challenge && !isNext && <span className="sc-next sc-challenge">도전</span>}
              <span className="sc-num">{i + 1}</span>
              <span className="sc-title">{s.title}</span>
              <span className="sc-concept">{s.concept}</span>
              <span className="sc-stars">
                {[0, 1, 2].map((k) => (
                  <StarIcon key={k} on={k < stars} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
