// 게임 화면 위·아래의 정보: 위쪽 상태(HP·상자·열쇠·턴), 맵 아래 도크(안내 → 재생 조작 → 결과)
import { useEffect, useRef, type ReactNode } from 'react';
import { SORT_COST, SORT_LABEL, initialBoard, boardAt, type AlgoCounts, type SortName } from '../sim';
import { currentTrace, gameStore, isTyping, uiStore, useStore, type Speed } from '../state/store';
import {
  REASON_TEXT,
  backToPlan,
  goSelect,
  nextStageId,
  openStage,
  seek,
  setSpeed,
  skipToEnd,
  stepBy,
  togglePlay,
  viewSeed,
} from '../game/play';
import { getStage, stageIndex } from '../stages';
import { HeartIcon, StarIcon } from './icons';
import { RunButton, tileImg } from './SidePanel';
import { TILE } from '../game/scenes/GridScene';

/** 지금 화면에 보이는 장면의 상태 */
function useBoard() {
  return useStore(gameStore, (s) => {
    const showRun = (s.phase === 'replay' || s.phase === 'done') && !!s.result;
    const level = s.levels[showRun ? s.view : 0];
    if (!level) return null;
    const b = showRun ? boardAt(level, currentTrace(s), s.step) : initialBoard(level);
    // useSyncExternalStore 가 매번 새 객체로 착각하지 않도록 원시값 문자열로
    return JSON.stringify({
      hp: b.hp,
      maxHp: level.playerHp,
      coins: b.coins,
      chests: level.chests.length,
      keys: b.keys,
      hasKeys: level.keys.length > 0,
      turn: b.turn,
      maxTurns: level.maxTurns,
      hidden: !showRun && level.randomCells.length > 0,
      anyChests: s.levels.some((l) => l.chests.length > 0),
      counts: level.row ? b.counts : null,
      limits: { peek: level.peekLimit, weigh: level.weighLimit, swap: level.swapLimit },
      rowKind: level.row?.kind ?? null,
    });
  });
}

export function StageHud() {
  const stageId = useStore(gameStore, (s) => s.stageId);
  const muted = useStore(uiStore, (s) => s.muted);
  const showGrid = useStore(uiStore, (s) => s.showGrid);
  const panelOpen = useStore(uiStore, (s) => s.panelOpen);
  const raw = useBoard();
  if (!raw) return null;
  const b = JSON.parse(raw) as {
    hp: number; maxHp: number; coins: number; chests: number; keys: number; hasKeys: boolean; turn: number; maxTurns: number; hidden: boolean;
    anyChests: boolean;
    counts: AlgoCounts | null;
    limits: Partial<Record<keyof AlgoCounts, number>>;
    rowKind: 'vault' | 'statue' | null;
  };
  const stage = getStage(stageId);
  // 4부: 들여다보기·저울·바꾸기 (쓴 횟수 / 제한)
  const algoPills: { key: keyof AlgoCounts; label: string; title: string }[] =
    b.rowKind === 'vault'
      ? [{ key: 'peek', label: '들여다보기', title: 'peek() 쓴 횟수 / 제한' }]
      : b.rowKind === 'statue'
        ? [
            { key: 'weigh', label: '저울', title: 'heavier() 쓴 횟수 / 제한' },
            { key: 'swap', label: '바꾸기', title: 'swap() 쓴 횟수 / 제한' },
          ]
        : [];

  return (
    <div className="hud">
      <div className="hud-stage">
        <button className="btn ghost small" onClick={goSelect}>
          ◀ 스테이지 목록
        </button>
        {/* 코드 창이 열려 있으면 스테이지 이름은 그쪽 설명 카드에 이미 있다 */}
        {!panelOpen && (
          <div className="hud-title">
            <span className="hud-num">{stageIndex(stageId) + 1}</span>
            <div>
              <div className="hud-name">{stage.title}</div>
              <div className="hud-concept">{stage.concept}</div>
            </div>
          </div>
        )}
      </div>

      <div className="hud-stats">
        <div className="pill hearts" title="HP (체력)" aria-label={`HP ${b.hp} / ${b.maxHp}`}>
          {Array.from({ length: b.maxHp }, (_, i) => (
            <HeartIcon key={i} on={i < b.hp} />
          ))}
        </div>
        {b.anyChests && (
          <div className="pill" title="연 보물상자">
            <img src={tileImg(TILE.chest)} alt="" className="pixel" />
            <small>상자</small>
            {b.coins}
            {!b.hidden && <small>/{b.chests}</small>}
          </div>
        )}
        {(b.hasKeys || b.keys > 0) && (
          <div className="pill" title="가진 열쇠">
            <small>열쇠</small>
            {b.keys}
          </div>
        )}
        <div className="pill" title="쓴 턴 / 턴 제한">
          <small>턴</small>
          {b.turn}
          <small>/{b.maxTurns}</small>
        </div>
        {algoPills
          .filter((p) => b.limits[p.key] !== undefined || p.key === 'swap')
          .map((p) => (
            <div key={p.key} className="pill" title={p.title}>
              <small>{p.label}</small>
              {b.counts?.[p.key] ?? 0}
              {b.limits[p.key] !== undefined && <small>/{b.limits[p.key]}</small>}
            </div>
          ))}
        <button
          className={showGrid ? 'pill btn-pill on' : 'pill btn-pill'}
          aria-pressed={showGrid}
          title={showGrid ? '격자·좌표 숨기기' : '격자·좌표 보기'}
          onClick={() => uiStore.set({ showGrid: !showGrid })}
        >
          격자 {showGrid ? '켬' : '끔'}
        </button>
        <button
          className={muted ? 'pill btn-pill' : 'pill btn-pill on'}
          aria-pressed={!muted}
          title={muted ? '소리 켜기' : '소리 끄기'}
          onClick={() => uiStore.set({ muted: !muted })}
        >
          소리 {muted ? '끔' : '켬'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 맵 아래 도크

const SPEEDS: Speed[] = [1, 2, 4];

/** 맵을 가리지 않고 맵 아래에 붙는 막대: 계획 안내 → 실행 중 → 재생 조작 (+ 재생이 끝나면 결과) */
export function Dock() {
  const phase = useStore(gameStore, (s) => s.phase);
  const stageId = useStore(gameStore, (s) => s.stageId);
  const nMaps = useStore(gameStore, (s) => s.levels.length);
  const panelOpen = useStore(uiStore, (s) => s.panelOpen);
  const syntaxOnly = useStore(gameStore, (s) => !!s.result && s.result.runs.every((r) => r.kind === 'syntax'));

  if (phase === 'plan') {
    const stage = getStage(stageId);
    return (
      <div className="dock">
        <div className="dock-row">
          <p className="plan-note">
            {nMaps > 1 ? (
              <>
                <b>맵 {nMaps}개</b>를 같은 코드로 모두 통과해야 해요. {stage.note}
              </>
            ) : panelOpen ? (
              <>맵을 살펴보고, 오른쪽에 코드를 적은 뒤 <b>▶ 실행</b>을 누르세요.</>
            ) : (
              <>맵을 살펴보고, 코드 창을 펼쳐 코드를 적은 뒤 실행하세요.</>
            )}
          </p>
          {/* 코드 창을 접으면 그쪽 실행 버튼이 안 보이므로 여기에 둔다 */}
          {!panelOpen && <RunButton />}
        </div>
      </div>
    );
  }
  if (phase === 'running') {
    return (
      <div className="dock">
        <div className="dock-row">
          <div className="casting">
            <span className="spinner" /> 코드를 실행하는 중… (맵 {nMaps}개)
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="dock">
      {/* 문법 오류는 한 줄도 실행되지 않아 다시 볼 장면이 없다 */}
      {!syntaxOnly && <Controls />}
      {phase === 'done' && <Result />}
    </div>
  );
}

function Controls() {
  const result = useStore(gameStore, (s) => s.result);
  const phase = useStore(gameStore, (s) => s.phase);
  const view = useStore(gameStore, (s) => s.view);
  const step = useStore(gameStore, (s) => s.step);
  const playing = useStore(gameStore, (s) => s.playing);
  const speed = useStore(gameStore, (s) => s.speed);
  const len = useStore(gameStore, (s) => currentTrace(s).length);
  if (!result) return null;

  return (
    <div className="dock-row controls">
      {result.runs.length > 1 && (
        <div className="seed-tabs" role="group" aria-label="다시 볼 맵">
          {result.runs.map((r, i) => (
            <button
              key={i}
              className={`seed-tab ${i === view ? 'active' : ''} ${r.summary.cleared ? 'ok' : 'bad'}`}
              aria-pressed={i === view}
              onClick={() => viewSeed(i)}
              title={REASON_TEXT[r.summary.reason]}
            >
              {r.summary.cleared ? '✔' : '✘'} 맵 {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="transport">
        <button className="tbtn" onClick={() => seek(0)} title="처음으로" aria-label="처음으로">⏮</button>
        <button className="tbtn" onClick={() => stepBy(-1)} title="한 턴 뒤로 (←)" aria-label="한 턴 뒤로">◀</button>
        <button className="tbtn main" onClick={togglePlay} title="재생/멈춤 (Space)" aria-label={playing ? '멈춤' : '재생'}>{playing ? '⏸' : '▶'}</button>
        <button className="tbtn" onClick={() => stepBy(1)} title="한 턴 앞으로 (→)" aria-label="한 턴 앞으로">▶▏</button>
        <button className="tbtn" onClick={skipToEnd} title="끝으로" aria-label="끝으로">⏭</button>
      </div>
      <input
        className="scrub"
        type="range"
        min={0}
        max={len}
        value={step}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="재생 위치"
      />
      <span className="step-count">
        {step}/{len}턴
      </span>
      <div className="speeds" role="group" aria-label="재생 속도">
        {SPEEDS.map((sp) => (
          <button key={sp} className={sp === speed ? 'sp active' : 'sp'} aria-pressed={sp === speed} onClick={() => setSpeed(sp)}>
            {sp}×
          </button>
        ))}
      </div>
      {/* 재생이 끝나면 아래 결과 줄에 같은 버튼이 나오므로 재생 중에만 */}
      {phase === 'replay' && (
        <button className="btn ghost small" onClick={backToPlan} title="재생을 끝내고 코드를 고쳐요">
          ✎ 코드 고치기
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 결과 (도크 안)

/** 실패한 맵에서 자주 하는 실수(틀린 암호, 반격, 미믹 …)를 알려 주는 한 줄 (2·3부) */
function gateTip(result: NonNullable<ReturnType<typeof gameStore.get>['result']>): string | null {
  const steps = result.runs.filter((r) => !r.summary.cleared).flatMap((r) => r.summary.trace);
  if (steps.some((t) => t.typeMismatch)) return '값은 맞는데 자료형이 달라요! "42"(문자열)와 42(정수)는 다른 값이에요. int() 나 str() 로 바꿔 보세요.';
  if (steps.some((t) => t.event === 'gate_wrong')) return '비밀 문에 틀린 암호를 넣었어요(경보, HP −1). print() 로 넣으려는 값을 먼저 확인해 보세요.';
  // 3부
  if (steps.some((t) => t.counter)) return '약점이 아닌 마법을 써서 반격을 받았어요! 몬스터의 약점은 맵마다 바뀌니 scan() 으로 m.weak 를 읽어 보세요.';
  if (steps.some((t) => t.bots?.some((b) => b.broken))) return '로봇이 약점이 아닌 마법을 써서 고장 났어요. self.bot.scan(방향).weak 로 약점을 읽어 보세요.';
  if (steps.some((t) => t.event === 'hit' && t.amount === 3)) return '미믹에 물렸어요! look() 은 미믹도 "chest" 라고 해요. scan() 이 None 이 아니면 미믹이에요.';
  // 4부
  if (steps.some((t) => t.event === 'pay_over')) return '통행료보다 많이 냈어요(경보!). 큰 동전부터 내되, 남은 금액보다 큰 동전은 건너뛰어요.';
  return null;
}

/**
 * 4부 정렬 방(31~33): 지금 보는 맵의 처음 석상 줄에 선택·버블·삽입 정렬을 돌렸다면 저울·바꾸기를 몇 번 썼을지,
 * 내 코드가 쓴 횟수와 막대로 나란히 보여 준다 (효율 비교)
 */
function SortCompare() {
  const raw = useStore(gameStore, (s) => {
    const level = s.levels[s.view];
    const run = s.result?.runs[s.view];
    if (!level?.row || level.row.kind !== 'statue' || level.barsRule !== 'sorted' || !run?.summary.counts) return null;
    return JSON.stringify({ values: level.row.values, mine: run.summary.counts, cleared: run.summary.cleared, map: s.view + 1, many: s.levels.length > 1 });
  });
  if (!raw) return null;
  const { values, mine, cleared, map, many } = JSON.parse(raw) as { values: number[]; mine: AlgoCounts; cleared: boolean; map: number; many: boolean };
  const rows: { label: string; c: AlgoCounts; me?: boolean }[] = [
    { label: cleared ? '내 코드' : '내 코드 (멈춘 곳까지)', c: mine, me: true },
    ...(['selection', 'bubble', 'insertion'] as SortName[]).map((n) => ({ label: SORT_LABEL[n], c: SORT_COST[n](values) })),
  ];
  const max = Math.max(1, ...rows.flatMap((r) => [r.c.weigh, r.c.swap]));
  const bar = (v: number, kind: 'weigh' | 'swap') => (
    <span className="cmp-cell">
      <span className={`cmp-bar ${kind}`} style={{ width: `${(v / max) * 100}%` }} />
      <b>{v}</b>
    </span>
  );
  return (
    <div className="sort-compare" aria-label="정렬 알고리즘 비교">
      <div className="cmp-head">
        <span>{many ? `맵 ${map} 석상 ${values.length}개` : `석상 ${values.length}개`}</span>
        <span>저울</span>
        <span>바꾸기</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className={r.me ? 'cmp-row me' : 'cmp-row'}>
          <span>{r.label}</span>
          {bar(r.c.weigh, 'weigh')}
          {bar(r.c.swap, 'swap')}
        </div>
      ))}
    </div>
  );
}

/** 결과의 대표 버튼. 에디터에 커서가 있을 땐 뺏지 않고, 아니면 Enter 로 바로 누를 수 있게 포커스를 준다 */
function MainAction({ className, onClick, children }: { className: string; onClick: () => void; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isTyping()) ref.current?.focus();
  }, []);
  return (
    <button ref={ref} className={className} onClick={onClick}>
      {children}
    </button>
  );
}

function Result() {
  const score = useStore(gameStore, (s) => s.score);
  const result = useStore(gameStore, (s) => s.result);
  const newRecord = useStore(gameStore, (s) => s.newRecord);
  if (!score || !result) return null;

  const next = nextStageId();
  const failIdx = result.runs.findIndex((r) => !r.summary.cleared);
  const someCleared = result.runs.some((r) => r.summary.cleared);
  const many = result.runs.length > 1;
  const err = result.runs.find((r) => r.error);

  if (score.cleared) {
    return (
      <div className="result win" role="status">
        <div className="result-head">
          <div className="result-stars" aria-label={`별 ${score.stars}개`}>
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} on={i < score.stars} className={`rs rs${i}`} />
            ))}
          </div>
          <h2 className="result-title">클리어!</h2>
          {newRecord && <div className="record">새 기록!</div>}
        </div>
        <div className="result-body">
          <ul className="checks">
            {score.checks.map((c) => (
              <li key={c.id} className={c.ok ? 'ok' : 'no'}>
                <StarIcon on={c.ok} />
                {c.label}
                {c.id === 'lines' && c.label.startsWith('코드') && <small> (지금 {score.lines}줄)</small>}
              </li>
            ))}
          </ul>
          <SortCompare />
        </div>
        <div className="result-actions">
          {next ? (
            <MainAction className="btn gold" onClick={() => openStage(next)}>
              다음 스테이지 ▶
            </MainAction>
          ) : (
            <MainAction className="btn gold" onClick={goSelect}>
              스테이지 목록
            </MainAction>
          )}
          <button className="btn ghost" onClick={backToPlan}>
            ✎ 코드 더 줄여 보기
          </button>
        </div>
      </div>
    );
  }

  // 문법 오류: 실행 전에 막혔으니 맵 목록·다시 보기 없이 오류만
  if (result.runs.every((r) => r.kind === 'syntax')) {
    const r = result.runs[0];
    return (
      <div className="result lose" role="status">
        <div className="result-head">
          <h2 className="result-title">문법 오류</h2>
        </div>
        <div className="result-body">
          <div className="err-box">
            {r.line ? <b>{r.line}번째 줄: </b> : null}
            {r.error?.replace(/^문법 오류: /, '')}
          </div>
          <div className="tip-line">코드가 한 줄도 실행되지 않았어요. 에디터의 빨간 밑줄을 고친 뒤 다시 실행해 보세요.</div>
        </div>
        <div className="result-actions">
          <MainAction className="btn primary" onClick={backToPlan}>
            ✎ 코드 고치기
          </MainAction>
        </div>
      </div>
    );
  }

  return (
    <div className="result lose" role="status">
      <div className="result-head">
        <h2 className="result-title">아쉬워요!</h2>
      </div>
      <div className="result-body">
        <ul className="seed-results">
          {result.runs.map((r, i) => (
            <li key={i} className={r.summary.cleared ? 'ok' : 'no'}>
              <b>
                {r.summary.cleared ? '✔' : '✘'}
                {many && ` 맵 ${i + 1}`}
              </b>{' '}
              {REASON_TEXT[r.summary.reason]}
              {r.summary.reason === 'turn_limit' && <small> ({r.summary.turns}턴 사용)</small>}
            </li>
          ))}
        </ul>
        {err && (
          <div className="err-box">
            {err.line ? <b>{err.line}번째 줄: </b> : null}
            {err.error}
          </div>
        )}
        {!err && gateTip(result) && <div className="tip-line">{gateTip(result)}</div>}
        <SortCompare />
        {!err && !gateTip(result) && someCleared && (
          <div className="tip-line">맵마다 ? 칸이나 길이가 달라요. 한 맵에만 맞춘 코드가 아닌지, look() 으로 살펴보며 움직여 보세요.</div>
        )}
      </div>
      <div className="result-actions">
        <MainAction className="btn primary" onClick={backToPlan}>
          ✎ 코드 고치기
        </MainAction>
        {failIdx >= 0 && (
          <button className="btn ghost" onClick={() => viewSeed(failIdx)}>
            ↻ {many ? `맵 ${failIdx + 1} ` : ''}다시 보기
          </button>
        )}
      </div>
    </div>
  );
}
