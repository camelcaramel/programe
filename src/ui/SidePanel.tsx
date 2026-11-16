import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from './CodeEditor';
import { codeStore, resetCode } from '../state/codeStore';
import { clearLog, consoleStore, gameStore, uiStore, useStore, type Tab } from '../state/store';
import { runCode } from '../game/play';
import { MONSTER_RULES, MONSTER_KINDS } from '../sim';
import { countCodeLines, getStage, stageIndex } from '../stages';
import { starRules } from '../stages/score';
import { API_DOCS } from './apiDocs';
import { learnedConcepts, replayTutorial, showConcept } from '../state/guide';
import { BookIcon, StarIcon } from './icons';
import { TILE } from '../game/scenes/GridScene';

export const tileImg = (n: number) => `${import.meta.env.BASE_URL}assets/kenney/topdown/Tiles/tile_${String(n).padStart(4, '0')}.png`;

export function SidePanel() {
  const open = useStore(uiStore, (s) => s.panelOpen);
  const tab = useStore(uiStore, (s) => s.tab);

  if (!open) {
    return (
      <aside className="panel closed">
        <button className="open-book" title="마법서 펼치기 (Tab)" onClick={() => uiStore.set({ panelOpen: true })}>
          <BookIcon />
          <span className="vertical">마법서 펼치기</span>
          <kbd>Tab</kbd>
        </button>
      </aside>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'code', label: '주문 작성' },
    { id: 'help', label: '명령 사전' },
  ];
  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="book-title">
          <BookIcon />
          <span>마법서</span>
        </div>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => uiStore.set({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="head-spacer" />
        <button className="close-book" title="마법서 덮기 (Tab)" onClick={() => uiStore.set({ panelOpen: false })}>
          ▶
        </button>
      </div>
      <div className="page">
        {/* 에디터는 탭을 바꿔도 유지되도록 숨기기만 한다 */}
        <div className="tab-body" hidden={tab !== 'code'}>
          <CodeTab />
        </div>
        {tab === 'help' && <HelpTab />}
      </div>
    </aside>
  );
}

export function EngineStatus({ status, long }: { status: 'loading' | 'ready' | 'error'; long?: boolean }) {
  const text =
    status === 'ready'
      ? long ? '파이썬 마법 엔진 준비 완료!' : '엔진 준비됨'
      : status === 'loading'
        ? long ? '파이썬 마법 엔진 깨우는 중… (먼저 시작해도 돼요)' : '엔진 깨우는 중…'
        : long ? '파이썬 엔진을 불러오지 못했어요. 새로고침 해 보세요.' : '엔진 오류';
  return (
    <span className={`engine ${status}`} title="파이썬 엔진 (Pyodide)">
      <i />
      {text}
    </span>
  );
}

// ---------------------------------------------------------------- 코드 탭

function CodeTab() {
  const stageId = useStore(gameStore, (s) => s.stageId);
  const levels = useStore(gameStore, (s) => s.levels);
  const phase = useStore(gameStore, (s) => s.phase);
  const status = useStore(uiStore, (s) => s.pythonStatus);
  const code = useStore(codeStore, (s) => s.code[stageId]);
  const stage = getStage(stageId);
  const [hint, setHint] = useState(false);
  useEffect(() => setHint(false), [stageId]);

  const lines = countCodeLines(code ?? stage.starter);
  const limit = stage.stars?.lines;
  const hasChests = levels.some((l) => l.chests.length > 0);

  return (
    <div className="code-tab">
      <div className="brief">
        <div className="brief-head">
          <span className="brief-num">{stageIndex(stageId) + 1}</span>
          <span className="brief-title">{stage.title}</span>
          <span className="concept">{stage.concept}</span>
        </div>
        <p className="brief-goal">{stage.goal}</p>
        <ul className="brief-stars">
          {starRules(stage, hasChests).map((r) => (
            <li key={r}>
              <StarIcon on />
              {r}
            </li>
          ))}
        </ul>
        {hint && <div className="brief-hint">💡 {stage.hint}</div>}
        <div className="brief-links">
          {!hint && (
            <button className="link dark" onClick={() => setHint(true)}>
              💡 힌트 보기
            </button>
          )}
          {stage.concepts?.length ? (
            <button className="link dark" onClick={() => showConcept(stageId)}>
              📘 새 개념 다시 보기
            </button>
          ) : null}
        </div>
      </div>

      <div className="slate editor-wrap">
        <div className="slate-head">
          <span>
            <span className="dot">✦</span> 내 주문 ·{' '}
            <span className={limit && lines > limit ? 'over' : ''}>
              {lines}줄{limit ? ` / ★ ${limit}줄` : ''}
            </span>
          </span>
          <EngineStatus status={status} />
        </div>
        <CodeEditor />
      </div>

      <div className="run-row">
        <button className="btn primary run-btn" disabled={status !== 'ready' || phase === 'running'} onClick={() => void runCode()}>
          {phase === 'running' ? '주문 외우는 중…' : status !== 'ready' ? '엔진 깨우는 중…' : '▶ 실행'}
          <kbd>Ctrl</kbd>
          <kbd>Enter</kbd>
        </button>
        <ResetButton stageId={stageId} />
      </div>
      <Console />
    </div>
  );
}

/** confirm() 창 대신, 한 번 더 누르면 되돌리는 게임식 확인 버튼 */
function ResetButton({ stageId }: { stageId: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  useEffect(() => setArmed(false), [stageId]);
  return (
    <button
      className={armed ? 'btn confirm' : 'btn ghost'}
      title="이 스테이지의 처음 코드로 되돌려요"
      onClick={() => {
        if (!armed) return setArmed(true);
        resetCode(stageId);
        setArmed(false);
      }}
    >
      {armed ? '정말 되돌릴까요?' : '↺ 처음 코드로'}
    </button>
  );
}

function Console() {
  const lines = useStore(consoleStore, (s) => s.lines);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);
  return (
    <div className="slate console">
      <div className="slate-head">
        <span>
          <span className="dot">✦</span> 주문 기록
        </span>
        <button className="link" onClick={clearLog}>
          지우기
        </button>
      </div>
      <div className="console-body">
        {lines.length === 0 && <div className="console-empty">print() 결과와 맵별 결과, 오류가 여기에 적혀요.</div>}
        {lines.map((l) => (
          <div key={l.id} className={`log log-${l.kind}`}>
            {l.source && <span className="log-src">{l.source}</span>}
            <span className="log-text">{l.text}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 명령 사전 탭

function HelpTab() {
  const stageId = useStore(gameStore, (s) => s.stageId);
  const stage = getStage(stageId);
  const allowed = stage.api;
  const learned = learnedConcepts(stageId);
  return (
    <div className="tab-body scroll help">
      <section>
        <h3>게임 규칙</h3>
        <ul>
          <li>코드는 <b>위에서부터 한 줄씩</b> 실행돼요. 이동과 마법은 1턴씩 써요.</li>
          <li>
            <b>? 칸</b>은 실행할 때마다 바뀌어요. <b>같은 코드로 맵 여러 개를 모두 통과</b>해야 클리어!
          </li>
          <li>벽에 부딪히면 제자리에서 턴만 써요. 몬스터에게 부딪히면 HP 가 줄어요.</li>
          <li>출구에 닿으면 그 순간 성공, 남은 코드는 실행되지 않아요.</li>
          <li>열쇠를 가지고 문으로 가면 열쇠 1개를 써서 문이 열려요.</li>
          {stage.part === 2 && (
            <>
              <li>
                <b>표지판</b>·<b>석판</b>의 내용은 계획 화면에서 가려져 있어요. 바로 옆에서 <code>read()</code> 로 읽어야 알 수 있어요.
              </li>
              <li>
                <b>비밀 문</b>은 <code>open_gate()</code> 로 맞는 암호를 넣으면 열려요. 틀리면 경보가 울려 HP −1!
              </li>
            </>
          )}
        </ul>
      </section>

      {learned.length > 0 && (
        <section>
          <h3>배운 개념</h3>
          <ul className="concept-list">
            {learned.map((c) => (
              <li key={c.stageId + c.name}>
                <span className="num">{c.num}</span>
                <button onClick={() => showConcept(c.stageId)}>{c.name}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>명령</h3>
        <table>
          <tbody>
            {API_DOCS.map((a) => {
              const ok = allowed.includes(a.name);
              return (
                <tr key={a.name} className={ok ? '' : 'locked'}>
                  <td>
                    <code>{a.sig}</code>
                  </td>
                  <td>
                    {ok ? a.doc : '🔒 다음 스테이지에서 배워요'}
                    {ok && a.turn && <span className="turn-tag">1턴</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3>몬스터 도감</h3>
        <div className="cards">
          {MONSTER_KINDS.map((k) => {
            const m = MONSTER_RULES[k];
            const weak = m.damage.fire > 0 ? 'fireball(불)' : 'icebolt(얼음)';
            const casts = Math.ceil(m.hp / Math.max(m.damage.fire, m.damage.ice));
            return (
              <div className="card" key={k}>
                <div className="card-icon">
                  <img src={tileImg(TILE[k])} alt="" className="pixel" />
                </div>
                <div>
                  <div className="card-title">
                    <code>"{k}"</code> {m.label}
                  </div>
                  <div className="muted">
                    HP {m.hp} · 부딪히면 내 HP −{m.contact}
                  </div>
                  <div>
                    약점: <b>{weak}</b> {casts}번이면 처치. 반대 속성은 효과 없음
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {stage.part === 2 && (
        <section>
          <h3>자료형</h3>
          <table>
            <tbody>
              <tr>
                <td>
                  <code>"42"</code>
                </td>
                <td>문자열(str). 글자예요. <code>read()</code> 가 표지판에서 읽어 오는 값.</td>
              </tr>
              <tr>
                <td>
                  <code>42</code>
                </td>
                <td>정수(int). 계산할 수 있는 수예요.</td>
              </tr>
              <tr>
                <td>
                  <code>[3, 8, 1]</code>
                </td>
                <td>리스트(list). 값 여러 개를 순서대로. 번호는 0부터: <code>a[0]</code> 은 3.</td>
              </tr>
              <tr>
                <td>
                  <code>int("42")</code>
                </td>
                <td>문자열 → 정수. <code>str(42)</code> 는 정수 → 문자열. <code>type(x)</code> 로 자료형을 볼 수 있어요.</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3>파이썬 문법 미리보기</h3>
        <pre>{`for i in range(3):        # 3번 반복
    move_right()

if look("right") == "slime":   # 조건
    cast("fireball", "right")
elif look("right") == "wall":
    move_down()

while look("right") == "empty":  # 조건이 참인 동안 반복
    move_right()

def room():               # 함수 만들기
    move_up()
    move_down()
room()                    # 함수 부르기`}</pre>
      </section>

      <section>
        <h3>단축키</h3>
        <ul className="keys">
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 실행</li>
          <li><kbd>Space</kbd> 재생 멈춤/계속 (에디터 밖에서)</li>
          <li><kbd>←</kbd><kbd>→</kbd> 재생 한 턴 뒤로/앞으로 (에디터 밖에서)</li>
          <li><kbd>Tab</kbd> 마법서 접기/펴기 · <kbd>Esc</kbd> 에디터에서 빠져나오기</li>
        </ul>
      </section>

      <section>
        <h3>처음이라면</h3>
        <button className="btn ghost small" onClick={() => replayTutorial('basic')}>
          🧭 튜토리얼 다시 보기
        </button>
      </section>
    </div>
  );
}
