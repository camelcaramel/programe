// 새 개념 카드와 첫 사용자 튜토리얼 (외부 라이브러리 없이 React 로 직접)
import { useEffect, useState, type ReactNode } from 'react';
import { gameStore, useStore } from '../state/store';
import { closeConcept, closeIntro, endTutorial, guideStore, tutorialStep, type TutorialId } from '../state/guide';
import { getStage, stageIndex } from '../stages';
import { mapScreenRect } from '../game/scenes/GridScene';

export function Guide() {
  const intro = useStore(guideStore, (s) => s.intro);
  const concept = useStore(guideStore, (s) => s.concept);
  const tutorial = useStore(guideStore, (s) => s.tutorial);
  return (
    <>
      {intro === 3 && <Part3Intro />}
      {intro === 4 && <Part4Intro />}
      {intro === null && concept && <ConceptCard stageId={concept} />}
      {intro === null && tutorial && !concept && <Tutorial id={tutorial.id} step={tutorial.step} />}
    </>
  );
}

// ---------------------------------------------------------------- 3부 안내 (처음 한 번)

function Part3Intro() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIntro();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="guide-modal" role="dialog" aria-modal="true" aria-label="3부 안내">
      <div className="concept-card">
        <div className="concept-ribbon">3부 · 객체와 로봇들</div>
        <h2 className="concept-name">고등 과정에 온 걸 환영해요!</h2>
        <ul className="concept-text">
          <li>
            몬스터가 <b>변이</b>해서 약점이 실행마다 바뀌어요. <code>scan()</code> 이 돌려주는 <b>객체</b>의 속성(<code>m.weak</code>)을 읽어야 해요.
          </li>
          <li>
            <b>클래스</b>로 로봇을 만들어 <code>hire()</code> 로 고용하면, 내가 한 턴을 쓸 때마다 로봇들이 함께 움직여요.
          </li>
          <li>
            <code>get_map()</code> 으로 맵 전체를 <b>2차원 리스트</b>로 받아 가장 짧은 길을 <b>탐색</b>해요.
          </li>
        </ul>
        <pre className="concept-code">{`m = scan("right")      # 몬스터 객체 (없으면 None)
print(m.kind, m.hp, m.weak)
cast(m.weak, "right")  # 약점 마법`}</pre>
        <p className="concept-game">
          <span>⚠ 조심</span> 약점이 아닌 마법을 맞히면 몬스터가 <b>반격</b>해요(HP −1). 마법을 차례로 다 넣어 보는 방법은 통하지 않아요!
        </p>
        <div className="result-actions">
          <button className="btn primary" autoFocus onClick={closeIntro}>
            시작할게요!
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 4부 안내 (처음 한 번)

function Part4Intro() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIntro();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="guide-modal" role="dialog" aria-modal="true" aria-label="4부 안내">
      <div className="concept-card">
        <div className="concept-ribbon">4부 · 알고리즘의 탑</div>
        <h2 className="concept-name">같은 답, 더 적은 일!</h2>
        <ul className="concept-text">
          <li>
            <b>금고</b> 속 숫자는 <code>peek(i)</code> 로, <b>석상</b>의 무게는 저울 <code>heavier(i, j)</code> 로만 알 수 있어요. 번호는 0부터예요.
          </li>
          <li>
            들여다보기·저울·바꾸기에는 <b>횟수 제한</b>이 있어요(위쪽 표시). 그 알고리즘이 쓰는 만큼만 주어져서, 다른 방법은 횟수가 모자라요.
          </li>
          <li>
            정렬 방에서는 결과 화면에서 내 정렬과 선택·버블·삽입 정렬의 횟수를 <b>막대로 비교</b>할 수 있어요. 34~36은 <b>도전</b> 스테이지예요.
          </li>
        </ul>
        <pre className="concept-code">{`print(size())          # 석상 몇 개?
if heavier(0, 1):      # 0번이 1번보다 무거우면
    swap(0, 1)         # 자리 바꾸기 (1턴)`}</pre>
        <p className="concept-game">
          <span>💡 팁</span> 무게는 보이지 않아서 <code>sorted()</code> 나 <code>max()</code> 로는 풀 수 없어요. 비교하고 바꾸는 절차(알고리즘)를 직접 써요!
        </p>
        <div className="result-actions">
          <button className="btn primary" autoFocus onClick={closeIntro}>
            시작할게요!
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 새 개념 카드

function ConceptCard({ stageId }: { stageId: string }) {
  const stage = getStage(stageId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConcept();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!stage?.concepts?.length) return null;
  return (
    <div className="guide-modal" role="dialog" aria-modal="true" aria-label="새 개념">
      <div className="concept-card">
        <div className="concept-ribbon">새 개념 · {stageIndex(stageId) + 1}단계</div>
        {stage.concepts.map((c) => (
          <section key={c.name}>
            <h2 className="concept-name">{c.name}</h2>
            <ul className="concept-text">
              {c.text.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <pre className="concept-code">{c.example}</pre>
            <p className="concept-game">
              <span>🎮 게임에서는</span> {c.inGame}
            </p>
          </section>
        ))}
        <div className="result-actions">
          <button className="btn primary" autoFocus onClick={closeConcept}>
            알겠어요!
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 튜토리얼

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TutStep {
  /** 강조할 화면 요소: CSS 선택자 또는 사각형을 돌려주는 함수 */
  target: string | (() => Rect | null);
  title: string;
  text: ReactNode;
  /** 이 조건이 되면 저절로 다음 단계로 (예: 실행 버튼을 눌렀다) */
  advanceWhen?: () => boolean;
  /** 강조할 요소가 아직 없을 때 보여 줄 말 */
  waitText?: string;
}

const phase = () => gameStore.get().phase;

const TUTORIALS: Record<TutorialId, TutStep[]> = {
  basic: [
    {
      target: mapScreenRect,
      title: '던전 지도',
      text: (
        <>
          🧙 <b>마법사</b>가 나예요. 초록 <b>마법진</b>이 출구, 회색 돌은 <b>벽</b>이에요.
          <br />
          위·왼쪽의 숫자는 <b>칸 번호</b>(x, y)예요. 몇 칸 갈지 셀 때 써요.
        </>
      ),
    },
    {
      target: '.editor-wrap',
      title: '코드 창',
      text: (
        <>
          여기에 <b>파이썬 코드</b>를 써요. 마법사는 오직 내 코드대로만 움직여요.
          <br />
          코드는 <b>맨 위 줄부터 한 줄씩</b> 차례대로 실행돼요.
        </>
      ),
    },
    {
      target: '.run-btn',
      title: '실행',
      text: (
        <>
          다 썼으면 <b>▶ 실행</b> 버튼(또는 <kbd>Ctrl</kbd>+<kbd>Enter</kbd>)!
          <br />
          지금 한 번 눌러 보세요. 처음 코드 그대로도 괜찮아요.
        </>
      ),
      advanceWhen: () => phase() !== 'plan',
    },
    {
      target: '.dock',
      title: '재생 막대',
      text: (
        <>
          <b>▶/⏸</b> 재생·멈춤, <b>◀ ▶▏</b> 한 턴씩, <b>1× 2× 4×</b> 속도예요.
          <br />
          지금 실행 중인 줄은 코드 창에서 <b className="hl-yellow">노랗게</b> 빛나요.
        </>
      ),
      waitText: '코드를 실행하는 중… 잠시만요!',
    },
    {
      target: '.result',
      title: '결과',
      text: (
        <>
          실패하면 <b>이유</b>와 <b>몇 번째 줄</b>인지 알려 줘요. 고쳐서 다시 실행!
          <br />
          성공하면 <b>별 3개 조건</b>(맵 통과 · 보물상자 · 줄 수)을 몇 개 채웠는지 보여 줘요.
        </>
      ),
      waitText: '재생이 끝나면 맵 아래에 결과가 나와요…',
    },
  ],
  random: [
    {
      target: mapScreenRect,
      title: '? 칸',
      text: (
        <>
          <b>?</b> 칸은 실행할 때마다 <b>빈칸</b>이 되기도, <b>슬라임</b>이 되기도 해요.
          <br />
          지금 보이는 맵만 믿으면 안 돼요!
        </>
      ),
    },
    {
      target: '.dock .plan-note',
      title: '맵 여러 개',
      text: (
        <>
          이제부터는 맵이 여러 개예요(맵 1·2·3). <b>같은 코드 하나로 모든 맵</b>을 통과해야 클리어!
          <br />
          <code>look()</code> 으로 살펴보고 <code>if</code> 로 판단하는 코드를 써 보세요.
        </>
      ),
    },
  ],
};

function targetRect(t: TutStep['target']): Rect | null {
  if (typeof t === 'function') return t();
  const el = document.querySelector(t);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 말풍선을 놓을 자리: 아래 → 위 → 왼쪽 → 오른쪽 → 요소 안쪽 아래 */
function bubbleStyle(r: Rect | null): React.CSSProperties {
  const W = Math.min(340, window.innerWidth - 24);
  const H = 190;
  const gap = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(12, Math.min(x, vw - W - 12));
  const clampY = (y: number) => Math.max(12, Math.min(y, vh - H - 12));
  if (!r) return { width: W, left: (vw - W) / 2, top: vh / 2 - H / 2 };
  const cx = r.left + r.width / 2;
  if (vh - (r.top + r.height) > H + gap) return { width: W, left: clampX(cx - W / 2), top: r.top + r.height + gap };
  if (r.top > H + gap) return { width: W, left: clampX(cx - W / 2), top: r.top - gap - H };
  if (r.left > W + gap) return { width: W, left: r.left - gap - W, top: clampY(r.top + r.height / 2 - H / 2) };
  if (vw - (r.left + r.width) > W + gap) return { width: W, left: r.left + r.width + gap, top: clampY(r.top + r.height / 2 - H / 2) };
  return { width: W, left: clampX(cx - W / 2), top: clampY(r.top + r.height - H - gap) };
}

function Tutorial({ id, step }: { id: TutorialId; step: number }) {
  const steps = TUTORIALS[id];
  const cur = steps[Math.min(step, steps.length - 1)];
  const [rect, setRect] = useState<Rect | null>(null);
  const ph = useStore(gameStore, (s) => s.phase);

  // 강조할 요소의 위치를 계속 따라간다 (창 크기 변경, 패널 접기, 재생 막대 등장 …)
  useEffect(() => {
    let last = '';
    const update = () => {
      const r = targetRect(cur.target);
      const key = JSON.stringify(r);
      if (key !== last) {
        last = key;
        setRect(r);
      }
    };
    update();
    const t = setInterval(update, 120);
    return () => clearInterval(t);
  }, [cur]);

  // "실행을 눌러 보세요" 같은 단계는 조건이 되면 저절로 넘어간다
  useEffect(() => {
    if (cur.advanceWhen?.()) tutorialStep(step + 1);
  }, [ph, cur, step]);

  const last = step >= steps.length - 1;
  const waiting = !rect && !!cur.waitText;
  const pad = 6;
  return (
    <div className="tutorial" aria-live="polite">
      {rect && (
        <div
          className="tut-spot"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      {!rect && <div className="tut-dim" />}
      <div className="tut-bubble" style={bubbleStyle(rect)} role="dialog" aria-label={`튜토리얼: ${cur.title}`}>
        <div className="tut-head">
          <span className="tut-count">
            {step + 1} / {steps.length}
          </span>
          <b>{cur.title}</b>
        </div>
        <div className="tut-text">{waiting ? cur.waitText : cur.text}</div>
        <div className="tut-actions">
          <button className="link dark" onClick={endTutorial}>
            건너뛰기
          </button>
          {cur.advanceWhen ? (
            <span className="tut-wait">버튼을 누르면 다음으로 넘어가요</span>
          ) : (
            <button className="btn gold small" autoFocus disabled={waiting} onClick={() => (last ? endTutorial() : tutorialStep(step + 1))}>
              {last ? '끝!' : '다음 ▶'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
