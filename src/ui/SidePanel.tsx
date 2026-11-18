import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CodeEditor } from './CodeEditor';
import { codeStore, resetCode } from '../state/codeStore';
import { EDITOR_FONT, clampPanelWidth, clearLog, consoleStore, gameStore, uiStore, useStore, type Tab } from '../state/store';
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
  const width = useStore(uiStore, (s) => s.panelWidth);

  if (!open) {
    return (
      <aside className="panel closed">
        <button className="open-book" title="코드 창 펼치기 (Tab)" onClick={() => uiStore.set({ panelOpen: true })}>
          <BookIcon />
          <span className="vertical">코드 창 펼치기</span>
          <kbd>Tab</kbd>
        </button>
      </aside>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'code', label: '코드' },
    { id: 'help', label: '도움말' },
  ];
  return (
    <aside className="panel" style={width === null ? undefined : ({ '--panel-w': `${width}px` } as CSSProperties)}>
      <PanelResizer />
      <div className="panel-head">
        <div className="book-title">
          <BookIcon />
        </div>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => uiStore.set({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="head-spacer" />
        <button className="close-book" title="코드 창 접기 (Tab)" onClick={() => uiStore.set({ panelOpen: false })}>
          접기 <span aria-hidden>»</span>
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

/** 맵과 코드 창 사이 경계선: 끌어서 코드 창 폭을 바꾼다 (두 번 누르면 기본 폭) */
function PanelResizer() {
  const [dragging, setDragging] = useState(false);
  const setWidth = (w: number) => uiStore.set({ panelWidth: clampPanelWidth(w) });
  return (
    <div
      className={dragging ? 'panel-resizer dragging' : 'panel-resizer'}
      role="separator"
      aria-orientation="vertical"
      aria-label="코드 창 폭 조절"
      title="끌어서 코드 창 폭 조절 · 두 번 누르면 기본 폭"
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (dragging) setWidth(window.innerWidth - e.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => uiStore.set({ panelWidth: null })}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation(); // ← → 는 재생 한 턴 이동 단축키이기도 하다
        const now = e.currentTarget.parentElement!.getBoundingClientRect().width;
        setWidth(now + (e.key === 'ArrowLeft' ? 24 : -24));
      }}
    />
  );
}

export function EngineStatus({ status, long }: { status: 'loading' | 'ready' | 'error'; long?: boolean }) {
  const text =
    status === 'ready'
      ? long ? '파이썬 준비 완료!' : '파이썬 준비됨'
      : status === 'loading'
        ? long ? '파이썬을 불러오는 중… (먼저 시작해도 돼요)' : '파이썬 준비 중…'
        : long ? '파이썬을 불러오지 못했어요. 새로고침 해 보세요.' : '파이썬 오류';
  return (
    <span className={`engine ${status}`} title="파이썬 실행기 (Pyodide)">
      <i />
      {text}
    </span>
  );
}

/** 실행 버튼. 화면에 늘 하나만 보인다: 코드 창이 열려 있으면 코드 아래, 접혀 있으면 맵 아래 */
export function RunButton() {
  const phase = useStore(gameStore, (s) => s.phase);
  const status = useStore(uiStore, (s) => s.pythonStatus);
  return (
    <button className="btn primary run-btn" disabled={status !== 'ready' || phase === 'running'} onClick={() => void runCode()}>
      {phase === 'running' ? '실행 중…' : status === 'loading' ? '파이썬 준비 중…' : status === 'error' ? '파이썬 오류' : '▶ 실행'}
      <span className="run-keys">
        <kbd>Ctrl</kbd>
        <kbd>Enter</kbd>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- 코드 탭

function CodeTab() {
  const stageId = useStore(gameStore, (s) => s.stageId);
  const levels = useStore(gameStore, (s) => s.levels);
  const status = useStore(uiStore, (s) => s.pythonStatus);
  const fontSize = useStore(uiStore, (s) => s.editorFontSize);
  const code = useStore(codeStore, (s) => s.code[stageId]);
  const stage = getStage(stageId);
  const [hint, setHint] = useState(false);
  useEffect(() => setHint(false), [stageId]);

  const lines = countCodeLines(code ?? stage.starter);
  const limit = stage.stars?.lines;
  const hasChests = levels.some((l) => l.chests.length > 0);
  const resize = (delta: number) =>
    uiStore.set({ editorFontSize: Math.max(EDITOR_FONT.min, Math.min(EDITOR_FONT.max, fontSize + delta)) });

  return (
    <div className="code-tab">
      <div className="brief">
        <div className="brief-head">
          <span className="brief-num">{stageIndex(stageId) + 1}</span>
          <span className="brief-title">{stage.title}</span>
          {stage.concepts?.length ? (
            <button className="concept" title="이 스테이지의 새 개념 카드를 다시 봐요" onClick={() => showConcept(stageId)}>
              {stage.concept} <small>설명 보기</small>
            </button>
          ) : (
            <span className="concept">{stage.concept}</span>
          )}
          <button className="btn ghost small hint-btn" aria-expanded={hint} onClick={() => setHint(!hint)}>
            {hint ? '힌트 접기' : '힌트 보기'}
          </button>
        </div>
        <p className="brief-goal">{stage.goal}</p>
        <ul className="brief-stars" aria-label="별을 받는 조건">
          {starRules(stage, hasChests).map((r) => (
            <li key={r}>
              <StarIcon on />
              {r}
            </li>
          ))}
        </ul>
        {hint && (
          <div className="brief-hint">
            <b>힌트</b> {stage.hint}
          </div>
        )}
      </div>

      <div className="slate editor-wrap">
        <div className="slate-head">
          <span>
            내 코드 ·{' '}
            <span className={limit && lines > limit ? 'over' : ''}>
              {lines}줄{limit ? ` / 별 조건 ${limit}줄 이하` : ''}
            </span>
          </span>
          <span className="slate-tools">
            <EngineStatus status={status} />
            <span className="font-size" role="group" aria-label="코드 글자 크기">
              <button onClick={() => resize(-EDITOR_FONT.step)} disabled={fontSize <= EDITOR_FONT.min} title="코드 글자 작게" aria-label="코드 글자 작게">
                A−
              </button>
              <button onClick={() => resize(EDITOR_FONT.step)} disabled={fontSize >= EDITOR_FONT.max} title="코드 글자 크게" aria-label="코드 글자 크게">
                A+
              </button>
            </span>
          </span>
        </div>
        <CodeEditor />
      </div>

      <div className="run-row">
        <RunButton />
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

/** print() 출력·맵별 결과·오류. 내용이 없을 땐 머리줄만 남겨 코드 창에 자리를 내준다 */
function Console() {
  const lines = useStore(consoleStore, (s) => s.lines);
  // null = 자동(내용이 있으면 펼침), true/false = 사용자가 직접 펼치거나 접음
  const [manual, setManual] = useState<boolean | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const open = manual ?? lines.length > 0;
  const errors = lines.filter((l) => l.kind === 'error').length;
  useEffect(() => {
    if (lines.length === 0) setManual(null);
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);
  return (
    <div className={open ? 'slate console' : 'slate console folded'}>
      <div className="slate-head">
        <button className="console-toggle" aria-expanded={open} onClick={() => setManual(!open)}>
          <span aria-hidden>{open ? '▾' : '▸'}</span> 실행 결과
          {lines.length > 0 && <span className="console-count">{lines.length}줄</span>}
          {!open && errors > 0 && <span className="console-count bad">오류 {errors}</span>}
          {lines.length === 0 && <span className="console-empty">print() 출력과 오류가 여기에 나와요</span>}
        </button>
        {open && lines.length > 0 && (
          <button className="link" onClick={clearLog}>
            지우기
          </button>
        )}
      </div>
      {open && (
        <div className="console-body">
          {lines.map((l) => (
            <div key={l.id} className={`log log-${l.kind}`}>
              {l.source && <span className="log-src">{l.source}</span>}
              <span className="log-text">{l.text}</span>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 도움말 탭

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
          {stage.part >= 2 && (
            <>
              <li>
                <b>표지판</b>·<b>석판</b>의 내용은 계획 화면에서 가려져 있어요. 바로 옆에서 <code>read()</code> 로 읽어야 알 수 있어요.
              </li>
              <li>
                <b>비밀 문</b>은 <code>open_gate()</code> 로 맞는 암호를 넣으면 열려요. 틀리면 경보가 울려 HP −1!
              </li>
            </>
          )}
          {stage.part === 3 && (
            <>
              <li>
                <b>변이 몬스터</b>(유령·거미·게·미믹)는 HP 와 약점이 실행마다 바뀌어요. <code>scan()</code> 으로 읽어요. 약점이 아닌 마법을 맞히면 <b>반격</b>(HP −1)!
              </li>
              <li>
                <b>미믹</b>은 상자인 척해요. <code>look()</code> 도 <code>"chest"</code> 라고 해요. 부딪히면 HP −3.
              </li>
              <li>
                <b>조수 로봇</b>은 <code>hire()</code> 한 객체의 <code>act()</code> 가 조종해요. 내가 1턴을 쓸 때마다 모두 한 번씩, 함께 움직여요.
              </li>
              <li>
                <b>창살</b>은 모든 <b>발판</b>에 로봇이 서 있고 몬스터가 하나도 없을 때만 열려요. 발판은 <code>look()</code> 에 안 보여요.
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
            if (m.mutant && stage.part < 3) return null;
            const weak = m.damage.fire > 0 ? 'fireball(불)' : 'icebolt(얼음)';
            const casts = Math.ceil(m.hp / Math.max(m.damage.fire, m.damage.ice));
            if (m.mutant)
              return (
                <div className="card" key={k}>
                  <div className="card-icon">
                    <img src={tileImg(TILE[k])} alt="" className="pixel" />
                  </div>
                  <div>
                    <div className="card-title">
                      <code>"{k}"</code> {m.label} <span className="muted">변이</span>
                    </div>
                    <div className="muted">
                      HP·약점: 실행마다 바뀜 · 부딪히면 내 HP −{m.contact}
                      {k === 'mimic' && ' · 겉보기엔 "chest"'}
                    </div>
                    <div>
                      <code>scan()</code> 의 <b>m.weak</b> 마법은 2 피해. 다른 마법은 0 피해 + <b>반격</b>
                    </div>
                  </div>
                </div>
              );
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

      {stage.part >= 2 && (
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
              {stage.part === 3 && (
                <>
                  <tr>
                    <td>
                      <code>None</code>
                    </td>
                    <td>"아무것도 없음". <code>m is None</code> 으로 확인해요.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>{'{"ghost": "lightning"}'}</code>
                    </td>
                    <td>딕셔너리(dict). 키 → 값. <code>book["ghost"]</code>, <code>"ghost" in book</code></td>
                  </tr>
                  <tr>
                    <td>
                      <code>(3, 5)</code>
                    </td>
                    <td>튜플(tuple). 바꿀 수 없는 리스트. 좌표를 딕셔너리 키로 쓸 때 좋아요.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>grid[y][x]</code>
                    </td>
                    <td>2차원 리스트. 줄(y)을 먼저, 칸(x)을 나중에.</td>
                  </tr>
                </>
              )}
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
room()                    # 함수 부르기`}
          {stage.part === 3 &&
            `

class Helper:             # 클래스 (객체의 틀)
    def __init__(self, bot):
        self.bot = bot    # 객체가 기억할 값
        self.left = 3

    def act(self):        # 메서드
        self.left = self.left - 1

h = Helper(get_bots()[0]) # 객체 만들기
hire(h)`}
        </pre>
      </section>

      <section>
        <h3>단축키</h3>
        <ul className="keys">
          <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 실행</li>
          <li><kbd>Space</kbd> 재생 멈춤/계속 (에디터 밖에서)</li>
          <li><kbd>←</kbd><kbd>→</kbd> 재생 한 턴 뒤로/앞으로 (에디터 밖에서)</li>
          <li><kbd>Tab</kbd> 코드 창 접기/펴기 (에디터 밖에서) · <kbd>Esc</kbd> 에디터에서 빠져나오기</li>
        </ul>
      </section>

      <section>
        <h3>처음이라면</h3>
        <button className="btn ghost small" onClick={() => replayTutorial('basic')}>
          튜토리얼 다시 보기
        </button>
      </section>
    </div>
  );
}
