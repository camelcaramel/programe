import { useEffect, useState, type CSSProperties } from 'react';
import { gameStore, toastStore, useStore } from '../state/store';
import { nextRecommended, progressStore } from '../state/codeStore';
import { goSelect, goTitle, openStage } from '../game/play';
import { STAGES, getStage, stageNo, type StageInfo } from '../stages';
import { replayTutorial, seenEndings, showEnding, showIntro } from '../state/guide';
import { PROLOGUE } from '../stages/story';
import { PaiIcon } from './Guide';
import { TILE } from '../game/scenes/GridScene';
import { tileImg } from './SidePanel';
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

/** 처음 화면 데모: 두루마리(코드) 한 줄씩 그대로 움직이는 마법사 */
const DEMO_CODE = [
  'for i in range(2):',
  '    move_right()',
  'if look("right") == "slime":',
  '    cast("fireball", "right")',
  'while look("right") != "exit":',
  '    move_right()',
  'move_right()',
];
/** 칸: # 벽, S 시작, . 바닥, s 슬라임, c 상자, E 출구 */
const DEMO_ROW = '#S..s.cE#';
/** 장면마다: 실행 중인 줄, 마법사 x, 불꽃, 슬라임·상자 상태, 탈출 */
const DEMO_STEPS: { hl: number; x: number; fire?: boolean; slime: boolean; chest: boolean; win?: boolean }[] = [
  { hl: -1, x: 1, slime: true, chest: false },
  { hl: 0, x: 1, slime: true, chest: false },
  { hl: 1, x: 2, slime: true, chest: false },
  { hl: 0, x: 2, slime: true, chest: false },
  { hl: 1, x: 3, slime: true, chest: false },
  { hl: 2, x: 3, slime: true, chest: false },
  { hl: 3, x: 3, fire: true, slime: true, chest: false },
  { hl: 3, x: 3, slime: false, chest: false },
  { hl: 4, x: 3, slime: false, chest: false },
  { hl: 5, x: 4, slime: false, chest: false },
  { hl: 5, x: 5, slime: false, chest: false },
  { hl: 5, x: 6, slime: false, chest: true },
  { hl: 4, x: 6, slime: false, chest: true },
  { hl: 6, x: 7, slime: false, chest: true, win: true },
  { hl: 6, x: 7, slime: false, chest: true, win: true },
  { hl: -1, x: 7, slime: false, chest: true, win: true },
];

function DemoScroll() {
  const [i, setI] = useState(0);
  useEffect(() => {
    let still = false;
    try {
      still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* 무시 */
    }
    if (still) return;
    const t = setInterval(() => setI((n) => (n + 1) % DEMO_STEPS.length), 700);
    return () => clearInterval(t);
  }, []);
  const st = DEMO_STEPS[i];
  const tile = (c: string) => (c === '#' ? TILE.wall : c === 'E' ? TILE.exit : TILE.floor);
  return (
    <div className="demo" aria-label="데모: 마법사가 두루마리의 코드를 한 줄씩 그대로 따라 움직여요" role="img">
      <div className="demo-map" style={{ '--cols': DEMO_ROW.length } as CSSProperties}>
        {[...'#'.repeat(DEMO_ROW.length), ...DEMO_ROW, ...'#'.repeat(DEMO_ROW.length)].map((c, k) => (
          <img key={k} src={tileImg(tile(c))} alt="" className="pixel demo-tile" />
        ))}
        {st.slime && <img src={tileImg(TILE.slime)} alt="" className="pixel demo-thing demo-slime" style={{ '--x': 4 } as CSSProperties} />}
        <img src={tileImg(st.chest ? TILE.chestOpen : TILE.chest)} alt="" className="pixel demo-thing" style={{ '--x': 6 } as CSSProperties} />
        {st.fire && <span className="demo-fire" style={{ '--x': 4 } as CSSProperties} />}
        <img
          src={tileImg(TILE.player)}
          alt=""
          className={`pixel demo-thing demo-hero ${st.win ? 'win' : ''}`}
          style={{ '--x': st.x } as CSSProperties}
        />
      </div>
      <pre className="demo-code">
        {DEMO_CODE.map((l, k) => (
          <span key={k} className={k === st.hl ? 'on' : ''}>
            {l}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  );
}

function TitleScreen() {
  const progress = useStore(progressStore, (s) => s.stages);
  const total = STAGES.reduce((n, s) => n + (progress[s.id]?.stars ?? 0), 0);
  const next = nextRecommended(progress);
  const resume = total > 0 && next ? getStage(next) : null;
  return (
    <div className="overlay title dungeon-bg" style={floorBg}>
      <div className="title-actors">
        <img src={tileImg(TILE.bat)} alt="" className="pixel ta ta-bat" />
        <img src={tileImg(TILE.ghost)} alt="" className="pixel ta ta-ghost" />
        <span className="torch torch-l" />
        <span className="torch torch-r" />
      </div>
      <div className="screen title-screen">
        <h1 className="logo">
          <span className="logo-text">programe</span>
          <em className="logo-tag">가제</em>
        </h1>
        <div className="ribbon">사라진 스승을 찾아, 파이썬 주문으로</div>
        <div className="title-pai">
          <PaiIcon size={64} />
          <p className="title-bubble">
            <b>파이</b>
            {PROLOGUE} 방에 들어가기 전에 <em>두루마리(코드)</em>에 주문을 적으면, 적힌 그대로만 움직여요!
          </p>
        </div>
        <DemoScroll />
        <div className="title-actions">
          {resume ? (
            <>
              <button className="btn primary big start" autoFocus onClick={() => openStage(resume.id)}>
                이어하기 · {stageNo(resume.id)}. {resume.title}
              </button>
              <button className="btn ghost" onClick={goSelect}>
                던전 지도
              </button>
            </>
          ) : (
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
          )}
        </div>
        <ol className="floors" aria-label="층마다 모은 별">
          {PARTS.map((p) => {
            const list = STAGES.filter((s) => s.part === p.part);
            const got = list.reduce((n, s) => n + (progress[s.id]?.stars ?? 0), 0);
            return (
              <li key={p.part}>
                <span className="floor-name">{p.title.split(' · ')[1]}</span>
                <span className="floor-stars">
                  <StarIcon on={got > 0} />
                  {got}/{list.length * 3}
                </span>
              </li>
            );
          })}
        </ol>
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
      </div>
    </div>
  );
}

/** 선택 화면의 부 나누기 */
const PARTS: { part: StageInfo['part']; title: string; sub: string }[] = [
  { part: 1, title: '1부 · 견습의 회랑', sub: '순서 · for · if · while · 함수' },
  { part: 2, title: '2부 · 기억의 서고', sub: '변수 · 자료형 · 리스트 · return' },
  { part: 3, title: '3부 · 변이의 공방', sub: '객체 · 딕셔너리 · 클래스 · 2차원 리스트 · 탐색' },
  { part: 4, title: '4부 · 거꾸로 선 탑', sub: '순차·이진 탐색 · 최댓값 · 선택·버블·삽입 정렬 · 도전: 재귀 · 탐욕 · DFS' },
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
        <span className="part-story">
          <button className="btn ghost small" onClick={() => showIntro(part)}>
            이야기
          </button>
          {seenEndings().includes(part) && (
            <button className="btn ghost small" onClick={() => showEnding(part)}>
              {part === 4 ? '엔딩' : '끝 장면'}
            </button>
          )}
        </span>
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
