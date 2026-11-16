// 게임 화면 위에 떠 있는 정보: 스테이지 이름, 상태(HP·상자·열쇠·턴), 아래 재생 막대, 결과 카드
import { initialBoard, boardAt } from '../sim';
import { currentTrace, gameStore, uiStore, useStore, type Speed } from '../state/store';
import {
  REASON_TEXT,
  backToPlan,
  goSelect,
  hideResult,
  nextStageId,
  openStage,
  runCode,
  seek,
  setSpeed,
  skipToEnd,
  stepBy,
  togglePlay,
  viewSeed,
} from '../game/play';
import { getStage, stageIndex } from '../stages';
import { HeartIcon, StarIcon } from './icons';
import { tileImg } from './SidePanel';
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
    });
  });
}

export function StageHud() {
  const stageId = useStore(gameStore, (s) => s.stageId);
  const muted = useStore(uiStore, (s) => s.muted);
  const showGrid = useStore(uiStore, (s) => s.showGrid);
  const raw = useBoard();
  if (!raw) return null;
  const b = JSON.parse(raw) as {
    hp: number; maxHp: number; coins: number; chests: number; keys: number; hasKeys: boolean; turn: number; maxTurns: number; hidden: boolean;
    anyChests: boolean;
  };
  const stage = getStage(stageId);

  return (
    <>
      <div className="hud-stage">
        <button className="btn ghost small" onClick={goSelect} title="스테이지 고르기">
          ◀ 스테이지
        </button>
        <div className="hud-title">
          <span className="hud-num">{stageIndex(stageId) + 1}</span>
          <div>
            <div className="hud-name">{stage.title}</div>
            <div className="hud-concept">{stage.concept}</div>
          </div>
        </div>
      </div>

      <div className="hud-stats">
        <div className="pill hearts" title="HP">
          {Array.from({ length: b.maxHp }, (_, i) => (
            <HeartIcon key={i} on={i < b.hp} />
          ))}
        </div>
        {b.anyChests && (
          <div className="pill" title="연 보물상자">
            <img src={tileImg(TILE.chest)} alt="" className="pixel" />
            {b.coins}
            {!b.hidden && <small>/{b.chests}</small>}
          </div>
        )}
        {(b.hasKeys || b.keys > 0) && (
          <div className="pill" title="가진 열쇠">
            <span className="key-emoji">🔑</span>
            {b.keys}
          </div>
        )}
        <div className="pill" title="쓴 턴 / 턴 제한">
          <span className="turn-label">턴</span>
          {b.turn}
          <small>/{b.maxTurns}</small>
        </div>
        <button
          className={showGrid ? 'pill btn-pill grid-on' : 'pill btn-pill'}
          title={showGrid ? '격자·좌표 숨기기' : '격자·좌표 보기'}
          onClick={() => uiStore.set({ showGrid: !showGrid })}
        >
          #
        </button>
        <button className="pill btn-pill" title={muted ? '소리 켜기' : '소리 끄기'} onClick={() => uiStore.set({ muted: !muted })}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 아래 재생 막대

const SPEEDS: Speed[] = [1, 2, 4];

export function ReplayBar() {
  const phase = useStore(gameStore, (s) => s.phase);
  const stageId = useStore(gameStore, (s) => s.stageId);
  const nMaps = useStore(gameStore, (s) => s.levels.length);
  const status = useStore(uiStore, (s) => s.pythonStatus);

  if (phase === 'plan') {
    const stage = getStage(stageId);
    return (
      <div className="bottom-bar plan">
        <div className="plan-note">
          {nMaps > 1 ? (
            <>
              <b>맵 {nMaps}개</b>를 같은 코드로 모두 통과해야 해요. {stage.note}
            </>
          ) : (
            <>맵을 잘 보고, 오른쪽 마법서에 주문(코드)을 적은 뒤 실행하세요.</>
          )}
        </div>
        <button className="btn primary big-run" disabled={status !== 'ready'} onClick={() => void runCode()}>
          {status === 'ready' ? '▶ 실행' : '엔진 깨우는 중…'}
        </button>
      </div>
    );
  }
  if (phase === 'running') {
    return (
      <div className="bottom-bar">
        <div className="casting">
          <span className="spinner" /> 주문을 외우는 중… (맵 {nMaps}개 실행)
        </div>
      </div>
    );
  }
  return <Controls />;
}

function Controls() {
  const result = useStore(gameStore, (s) => s.result);
  const view = useStore(gameStore, (s) => s.view);
  const step = useStore(gameStore, (s) => s.step);
  const playing = useStore(gameStore, (s) => s.playing);
  const speed = useStore(gameStore, (s) => s.speed);
  const len = useStore(gameStore, (s) => currentTrace(s).length);
  if (!result) return null;

  return (
    <div className="bottom-bar controls">
      <div className="seed-tabs">
        {result.runs.map((r, i) => (
          <button key={i} className={`seed-tab ${i === view ? 'active' : ''} ${r.summary.cleared ? 'ok' : 'bad'}`} onClick={() => viewSeed(i)} title={REASON_TEXT[r.summary.reason]}>
            {r.summary.cleared ? '✔' : '✘'} 맵 {i + 1}
          </button>
        ))}
      </div>
      <div className="transport">
        <button className="tbtn" onClick={() => seek(0)} title="처음으로">⏮</button>
        <button className="tbtn" onClick={() => stepBy(-1)} title="한 턴 뒤로 (←)">◀</button>
        <button className="tbtn main" onClick={togglePlay} title="재생/멈춤 (Space)">{playing ? '⏸' : '▶'}</button>
        <button className="tbtn" onClick={() => stepBy(1)} title="한 턴 앞으로 (→)">▶▏</button>
        <button className="tbtn" onClick={skipToEnd} title="끝으로">⏭</button>
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
        {step}/{len}
      </span>
      <div className="speeds">
        {SPEEDS.map((sp) => (
          <button key={sp} className={sp === speed ? 'sp active' : 'sp'} onClick={() => setSpeed(sp)}>
            {sp}×
          </button>
        ))}
      </div>
      <button className="btn ghost small" onClick={backToPlan} title="재생을 끝내고 코드를 고쳐요">
        ✎ 코드 고치기
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- 결과 카드

/** 실패한 맵에서 비밀 문 암호가 틀렸다면 그 이유를 알려 주는 한 줄 (2부) */
function gateTip(result: NonNullable<ReturnType<typeof gameStore.get>['result']>): string | null {
  const steps = result.runs.filter((r) => !r.summary.cleared).flatMap((r) => r.summary.trace);
  if (steps.some((t) => t.typeMismatch)) return '값은 맞는데 자료형이 달라요! "42"(문자열)와 42(정수)는 다른 값이에요. int() 나 str() 로 바꿔 보세요.';
  if (steps.some((t) => t.event === 'gate_wrong')) return '비밀 문에 틀린 암호를 넣었어요(경보, HP −1). print() 로 넣으려는 값을 먼저 확인해 보세요.';
  return null;
}

export function ResultCard() {
  const phase = useStore(gameStore, (s) => s.phase);
  const hidden = useStore(gameStore, (s) => s.resultHidden);
  const score = useStore(gameStore, (s) => s.score);
  const result = useStore(gameStore, (s) => s.result);
  const newRecord = useStore(gameStore, (s) => s.newRecord);
  const view = useStore(gameStore, (s) => s.view);
  if (phase !== 'done' || hidden || !score || !result) return null;

  const next = nextStageId();
  const failIdx = result.runs.findIndex((r) => !r.summary.cleared);
  const someCleared = result.runs.some((r) => r.summary.cleared);
  const err = result.runs.find((r) => r.error);

  if (score.cleared) {
    return (
      <div className="result-wrap">
        <div className="result-card win">
          <div className="result-stars">
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} on={i < score.stars} className={`rs rs${i}`} />
            ))}
          </div>
          <h2 className="result-title">클리어!</h2>
          {newRecord && <div className="record">새 기록!</div>}
          <ul className="checks">
            {score.checks.map((c) => (
              <li key={c.id} className={c.ok ? 'ok' : 'no'}>
                <StarIcon on={c.ok} />
                {c.label}
                {c.id === 'lines' && c.label.startsWith('코드') && <small> (지금 {score.lines}줄)</small>}
              </li>
            ))}
          </ul>
          <div className="result-actions">
            {next && (
              <button className="btn gold" autoFocus onClick={() => openStage(next)}>
                다음 스테이지 ▶
              </button>
            )}
            {!next && (
              <button className="btn gold" autoFocus onClick={goSelect}>
                스테이지 목록
              </button>
            )}
            <button className="btn ghost" onClick={backToPlan}>
              ✎ 더 줄여 보기
            </button>
            <button className="btn ghost" onClick={hideResult}>
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 문법 오류: 실행 전에 막혔으니 맵 목록·다시 보기 없이 오류만
  if (result.runs.every((r) => r.kind === 'syntax')) {
    const r = result.runs[0];
    return (
      <div className="result-wrap">
        <div className="result-card lose">
          <h2 className="result-title">문법 오류</h2>
          <div className="err-box">
            {r.line ? <b>{r.line}번째 줄: </b> : null}
            {r.error?.replace(/^문법 오류: /, '')}
          </div>
          <div className="tip-line">💡 코드가 한 줄도 실행되지 않았어요. 에디터의 빨간 밑줄을 고친 뒤 다시 실행해 보세요.</div>
          <div className="result-actions">
            <button className="btn primary" autoFocus onClick={backToPlan}>
              ✎ 코드 고치기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="result-wrap">
      <div className="result-card lose">
        <h2 className="result-title">아쉬워요!</h2>
        <ul className="seed-results">
          {result.runs.map((r, i) => (
            <li key={i} className={r.summary.cleared ? 'ok' : 'no'}>
              <b>{r.summary.cleared ? '✔' : '✘'} 맵 {i + 1}</b> {REASON_TEXT[r.summary.reason]}
              {r.summary.reason === 'turn_limit' && <small> ({r.summary.turns}턴 사용)</small>}
              {i === view && <span className="viewing">보는 중</span>}
            </li>
          ))}
        </ul>
        {err && (
          <div className="err-box">
            {err.line ? <b>{err.line}번째 줄: </b> : null}
            {err.error}
          </div>
        )}
        {!err && gateTip(result) && <div className="tip-line">💡 {gateTip(result)}</div>}
        {!err && !gateTip(result) && someCleared && (
          <div className="tip-line">💡 맵마다 ? 칸이나 길이가 달라요. 한 맵에만 맞춘 코드가 아닌지, look() 으로 살펴보며 움직여 보세요.</div>
        )}
        <div className="result-actions">
          <button className="btn primary" autoFocus onClick={backToPlan}>
            ✎ 코드 고치기
          </button>
          {failIdx >= 0 && (
            <button className="btn ghost" onClick={() => viewSeed(failIdx)}>
              ↻ 맵 {failIdx + 1} 다시 보기
            </button>
          )}
          <button className="btn ghost" onClick={hideResult}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
