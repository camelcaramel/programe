import { useEffect, useRef, useState } from 'react';
import { CodeEditor } from './CodeEditor';
import { codeStore, resetSlot } from '../state/codeStore';
import { clearLog, consoleStore, gameStore, log, uiStore, useStore, type Tab } from '../state/store';
import { MISSIONS, MONSTERS, SKILLS, SKILL_NAMES, type MonsterKind } from '../game/data';
import { python } from '../python/runner';
import { BookIcon } from './icons';

const asset = (p: string) => import.meta.env.BASE_URL + p;

export function SidePanel() {
  const open = useStore(uiStore, (s) => s.panelOpen);
  const tab = useStore(uiStore, (s) => s.tab);
  const done = useStore(gameStore, (s) => s.missionsDone.length);

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

  const tabs: { id: Tab; label: string; count?: string }[] = [
    { id: 'code', label: '주문 작성' },
    { id: 'missions', label: '퀘스트', count: `${done}/${MISSIONS.length}` },
    { id: 'help', label: '도감' },
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
              {t.count && <span className="tab-count">{t.count}</span>}
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
        {tab === 'missions' && <MissionsTab />}
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
  const active = useStore(uiStore, (s) => s.activeSlot);
  const slots = useStore(codeStore, (s) => s.slots);
  const errors = useStore(uiStore, (s) => s.slotErrors);
  const status = useStore(uiStore, (s) => s.pythonStatus);

  return (
    <div className="code-tab">
      <div className="slot-tabs">
        {slots.map((s, i) => (
          <button key={i} className={i === active ? 'slot-tab active' : 'slot-tab'} onClick={() => uiStore.set({ activeSlot: i })}>
            <kbd>{i + 1}</kbd>
            <span>{s.name}</span>
            {errors[i] && <span className="dot-error" title="오류가 있어요" />}
          </button>
        ))}
      </div>
      <div className="editor-hint">
        게임에서 <kbd>{active + 1}</kbd> 키를 누르면 이 주문이 발동해요 · 자동 저장
      </div>
      <div className="slate editor-wrap">
        <div className="slate-head">
          <span>
            <span className="dot">✦</span> 주문서 {active + 1} · {slots[active].name}
          </span>
          <EngineStatus status={status} />
        </div>
        <CodeEditor />
      </div>
      <TestBar slot={active} disabled={status !== 'ready'} />
      <Console />
    </div>
  );
}

function TestBar({ slot, disabled }: { slot: number; disabled: boolean }) {
  const [kind, setKind] = useState<MonsterKind | 'none'>('slime');
  const [hp, setHp] = useState(MONSTERS.slime.hp);
  const [myHp, setMyHp] = useState(100);
  const [running, setRunning] = useState(false);

  const pick = (k: MonsterKind | 'none') => {
    setKind(k);
    setHp(k === 'none' ? 0 : MONSTERS[k].hp);
  };

  const run = async () => {
    setRunning(true);
    const res = await python.run({
      code: codeStore.get().slots[slot].code,
      enemy: kind === 'none' ? { exists: false, hp: 0, max_hp: 0, type: 'none', distance: 99 } : { exists: true, hp, max_hp: MONSTERS[kind].hp, type: kind, distance: 3 },
      player: { hp: myHp, mp: 60, max_hp: 100, max_mp: 60 },
    });
    setRunning(false);
    const src = '테스트';
    log('info', `enemy = ${kind === 'none' ? '없음' : `${kind}(hp=${hp})`}, 내 HP = ${myHp}`, src);
    res.out.forEach((l) => log('out', l, src));
    if (!res.ok) {
      log('error', (res.line ? `${res.line}번째 줄 · ` : '') + res.error, src);
      uiStore.set((u) => ({ slotErrors: u.slotErrors.map((e, j) => (j === slot ? { line: res.line ?? null, message: res.error ?? '' } : e)) }));
    } else {
      uiStore.set((u) => ({ slotErrors: u.slotErrors.map((e, j) => (j === slot ? null : e)) }));
      log(res.casts.length ? 'ok' : 'info', res.casts.length ? `결과: ${res.casts.map((c) => `cast("${c}")`).join(' → ')}` : '결과: cast 없음', src);
    }
  };

  return (
    <div className="testbar">
      <div className="testbar-title">
        🎯 연습 시전 <small>게임 밖에서 적을 정해 놓고 주문을 시험해요</small>
      </div>
      <div className="test-fields">
        <label>
          적
          <select value={kind} onChange={(e) => pick(e.target.value as MonsterKind | 'none')}>
            {(Object.keys(MONSTERS) as MonsterKind[]).map((k) => (
              <option key={k} value={k}>
                {k} ({MONSTERS[k].label})
              </option>
            ))}
            <option value="none">none (적 없음)</option>
          </select>
        </label>
        <label>
          적 HP
          <input type="number" min={0} max={999} value={hp} disabled={kind === 'none'} onChange={(e) => setHp(Number(e.target.value) || 0)} />
        </label>
        <label>
          내 HP
          <input type="number" min={1} max={999} value={myHp} onChange={(e) => setMyHp(Number(e.target.value) || 0)} />
        </label>
      </div>
      <div className="test-actions">
        <button className="btn primary" disabled={disabled || running} onClick={run}>
          {running ? '시전 중…' : disabled ? '엔진 깨우는 중…' : '▶ 시험 시전'}
        </button>
        <ResetButton slot={slot} />
      </div>
    </div>
  );
}

/** confirm() 창 대신, 한 번 더 누르면 되돌리는 게임식 확인 버튼 */
function ResetButton({ slot }: { slot: number }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  useEffect(() => setArmed(false), [slot]);
  return (
    <button
      className={armed ? 'btn confirm' : 'btn ghost'}
      title="이 슬롯을 처음 예제 코드로 되돌려요"
      onClick={() => {
        if (!armed) return setArmed(true);
        resetSlot(slot);
        setArmed(false);
      }}
    >
      {armed ? '정말 되돌릴까요?' : '↺ 예제로'}
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
        {lines.length === 0 && <div className="console-empty">print() 결과와 발동한 주문, 오류가 여기에 적혀요.</div>}
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

// ---------------------------------------------------------------- 미션 탭

function MissionsTab() {
  const done = useStore(gameStore, (s) => s.missionsDone);
  const current = MISSIONS.find((m) => !done.includes(m.id));
  return (
    <div className="tab-body scroll">
      <p className="lead">퀘스트를 완료하면 골드와 경험치를 받아요. 마지막 목표는 골렘이 지키는 문 너머의 깃발!</p>
      <ol className="missions">
        {MISSIONS.map((m, i) => {
          const isDone = done.includes(m.id);
          const isCur = m === current;
          return (
            <li key={m.id} className={isDone ? 'done' : isCur ? 'current' : ''}>
              <span className="m-num">{isDone ? '✓' : i + 1}</span>
              <div>
                <div className="m-title">{m.title}</div>
                <div className="m-desc">{m.desc}</div>
                {isCur && <div className="m-hint">💡 힌트 · {m.hint}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- 도움말 탭

function HelpTab() {
  return (
    <div className="tab-body scroll help">
      <section>
        <h3>코드 스킬의 기본 모양</h3>
        <pre>{`def attack_strategy(enemy):
    if enemy.type == "golem":
        cast("icebolt")
    else:
        cast("fireball")`}</pre>
        <p className="muted">
          숫자키를 누르면 가장 가까운 적이 <code>enemy</code> 로 들어오고, 함수 안에서 <code>cast()</code> 한 스킬이 순서대로 발동돼요.
        </p>
      </section>

      <section>
        <h3>쓸 수 있는 명령</h3>
        <table>
          <tbody>
            <tr><td><code>cast("이름")</code></td><td>스킬 발동 (한 번에 최대 3번)</td></tr>
            <tr><td><code>get_enemy_hp()</code></td><td>적의 HP</td></tr>
            <tr><td><code>get_player_hp()</code></td><td>내 HP</td></tr>
            <tr><td><code>get_player_mp()</code></td><td>내 MP</td></tr>
            <tr><td><code>print(...)</code></td><td>콘솔에 출력</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>enemy 가 알려 주는 정보</h3>
        <table>
          <tbody>
            <tr><td><code>enemy.hp</code></td><td>현재 HP</td></tr>
            <tr><td><code>enemy.max_hp</code></td><td>최대 HP</td></tr>
            <tr><td><code>enemy.type</code></td><td><code>"slime"</code> · <code>"fly"</code> · <code>"golem"</code> · 없으면 <code>"none"</code></td></tr>
            <tr><td><code>enemy.distance</code></td><td>나와의 거리 (칸)</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>스킬</h3>
        <div className="cards">
          {SKILL_NAMES.map((n) => (
            <div className="card" key={n}>
              <div className="card-icon"><img src={asset(SKILLS[n].icon)} alt="" /></div>
              <div>
                <div className="card-title">
                  <code>{n}</code> {SKILLS[n].label}
                </div>
                <div className="muted">
                  MP {SKILLS[n].mp} · {n === 'heal' ? '회복' : '위력'} {SKILLS[n].power}
                </div>
                <div>{SKILLS[n].desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>몬스터 도감</h3>
        <div className="cards">
          {(Object.keys(MONSTERS) as MonsterKind[]).map((k) => (
            <div className="card" key={k}>
              <div className="card-icon"><img src={asset(MONSTERS[k].icon)} alt="" /></div>
              <div>
                <div className="card-title">
                  <code>{k}</code> {MONSTERS[k].label}
                </div>
                <div className="muted">HP {MONSTERS[k].hp} · 접촉 피해 {MONSTERS[k].contact}</div>
                <div>{MONSTERS[k].tip}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>규칙</h3>
        <ul>
          <li>코드는 0.5초 안에 끝나야 해요. 끝나지 않는 <code>while</code> 은 자동으로 멈춰요.</li>
          <li>
            <code>import</code>, 파일, 인터넷은 쓸 수 없어요.
          </li>
          <li>MP 가 부족하면 그 스킬은 발동하지 않아요. MP 는 시간이 지나면 차올라요.</li>
          <li>오류가 나면 콘솔과 에디터의 빨간 밑줄로 알려 줘요.</li>
        </ul>
      </section>

      <section>
        <h3>조작</h3>
        <ul className="keys">
          <li><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> 이동</li>
          <li><kbd>Space</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> 점프 (길게 누르면 높이)</li>
          <li><kbd>J</kbd> / <kbd>Z</kbd> 기본 공격</li>
          <li><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 코드 스킬</li>
          <li><kbd>Tab</kbd> 패널 열기/닫기 · <kbd>Esc</kbd> 에디터에서 게임으로</li>
        </ul>
      </section>
    </div>
  );
}
