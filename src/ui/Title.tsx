// 처음 화면 (게임 타이틀) + 프롤로그 컷신.
// 웹 페이지처럼 카드를 쌓지 않고, 화면 전체를 살아 있는 던전 장면으로 채운 뒤 그 위에 로고와 커서 메뉴를 얹는다.
// 타일은 16px 원본을 정수 배율로 키워 픽셀이 뭉개지지 않게 한다 (캔버스에 바닥·벽을 한 번 그리고, 움직이는 것은 그 위 이미지).
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { uiStore, useStore } from '../state/store';
import { nextRecommended, progressStore } from '../state/codeStore';
import { goSelect, openStage } from '../game/play';
import { STAGES, getStage, stageNo } from '../stages';
import { markPrologueSeen, prologueSeen, replayTutorial } from '../state/guide';
import { TILE } from '../game/scenes/GridScene';
import { tileImg } from './SidePanel';
import { PaiIcon } from './Guide';
import { StarIcon } from './icons';

const T = 16;
/** 그레이스 선생님 (회색 머리) · 장식 타일 */
const TEACHER = 100;
const DECO = { banner: 29, statue: 7, gargoyle: 19, gargoyle2: 20, shelf: 63, barrel: 82, table: 72, grave: 65 } as const;

// ---------------------------------------------------------------- 효과음

type SfxName = 'select' | 'magic' | 'coin' | 'gem' | 'jump';
export function sfx(name: SfxName, volume = 0.45) {
  if (uiStore.get().muted) return;
  try {
    const a = new Audio(`${import.meta.env.BASE_URL}assets/kenney/audio/sfx_${name}.ogg`);
    a.volume = volume;
    void a.play().catch(() => {});
  } catch {
    /* 소리를 낼 수 없는 환경 */
  }
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------- 화면 크기 → 타일 배율

function useWorld() {
  const calc = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w, h) >= 760 ? 4 : Math.min(w, h) >= 520 ? 3 : 2;
    return { scale, cols: Math.ceil(w / (T * scale)) + 1, rows: Math.ceil(h / (T * scale)) + 1, visible: Math.floor(h / (T * scale)) };
  };
  const [world, setWorld] = useState(calc);
  useEffect(() => {
    const on = () => setWorld(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return world;
}

/** 시드 고정 난수 (새로고침해도 같은 방) */
function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const imgCache = new Map<number, Promise<HTMLImageElement>>();
function loadTile(n: number) {
  if (!imgCache.has(n))
    imgCache.set(
      n,
      new Promise((ok, fail) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = fail;
        im.src = tileImg(n);
      }),
    );
  return imgCache.get(n)!;
}

/** 바닥·벽·장식을 캔버스에 한 번 그린다. walls = 위쪽 벽 줄 수 */
function DungeonCanvas({ cols, rows, walls, decorate }: { cols: number; rows: number; walls: number; decorate: (put: (n: number, x: number, y: number) => void) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    const cells: [number, number, number][] = [];
    // 바닥은 기본 타일만. 바닥 변형(49~51)은 가장자리 그늘이 줄무늬처럼, 깨진 바닥(42)은 회색 조각이
    // 화면이 깨진 것처럼 보여서 쓰지 않는다
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([y < walls ? TILE.wall : TILE.floor, x, y]);
    decorate((n, x, y) => cells.push([n, x, y]));
    const need = [...new Set(cells.map((c) => c[0]))];
    void Promise.all(need.map(loadTile)).then((ims) => {
      const ctx = ref.current?.getContext('2d');
      if (!alive || !ctx) return;
      const byN = new Map(need.map((n, i) => [n, ims[i]]));
      ctx.imageSmoothingEnabled = false;
      for (const [n, x, y] of cells) ctx.drawImage(byN.get(n)!, x * T, y * T);
    });
    return () => {
      alive = false;
    };
  }, [cols, rows, walls, decorate]);
  return <canvas ref={ref} className="dio-canvas" width={cols * T} height={rows * T} />;
}

const sprite = (n: number) => tileImg(n);
const at = (x: number, y: number): CSSProperties => ({ left: x * T, top: y * T });

// ---------------------------------------------------------------- 아래쪽 길: 코드 말풍선대로 걷는 견습 마법사

type LaneStep = { x: number; say: string; fire?: boolean; slime: boolean; chest: boolean; gone?: boolean };

function laneScript(start: number, slime: number, chest: number, portal: number): LaneStep[] {
  const steps: LaneStep[] = [];
  let x = start;
  const push = (s: Partial<LaneStep> & { say: string }) => steps.push({ x, slime: true, chest: false, ...s });
  push({ say: '' });
  for (; x < slime - 1; ) {
    x++;
    push({ say: 'move_right()' });
  }
  push({ say: 'look("right")' });
  push({ say: '"slime" 이다!' });
  push({ say: 'cast("fireball")', fire: true });
  const after = { slime: false };
  steps.push({ x, say: 'cast("fireball")', slime: false, chest: false });
  for (; x < portal - 1; ) {
    x++;
    steps.push({ x, say: x === chest ? '상자 열림!' : 'move_right()', ...after, chest: x >= chest });
  }
  x++;
  steps.push({ x, say: '탈출!', slime: false, chest: true });
  steps.push({ x, say: '', slime: false, chest: true, gone: true });
  steps.push({ x: start, say: '', slime: false, chest: true, gone: true });
  return steps;
}

function CodeLane({ y, cols }: { y: number; cols: number }) {
  const start = 1;
  const portal = cols - 3;
  const slime = Math.max(start + 3, Math.round(cols * 0.36));
  const chest = Math.max(slime + 2, Math.round(cols * 0.62));
  const steps = useMemo(() => laneScript(start, slime, chest, portal), [slime, chest, portal]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setI((n) => (n + 1) % steps.length), 520);
    return () => clearInterval(t);
  }, [steps.length]);
  const st = steps[Math.min(i, steps.length - 1)];
  const jump = i === steps.length - 1; // 처음 자리로 되돌아갈 때는 순간 이동
  return (
    <>
      <img src={sprite(TILE.exit)} alt="" className="dio-a portal" style={at(portal, y)} />
      {st.slime ? (
        <img src={sprite(TILE.slime)} alt="" className="dio-a squish" style={at(slime, y)} />
      ) : (
        <span className="dio-poof" style={at(slime, y)} />
      )}
      <img src={sprite(st.chest ? TILE.chestOpen : TILE.chest)} alt="" className="dio-a" style={at(chest, y)} />
      {st.chest && <span className="dio-coin" style={at(chest, y)} />}
      {st.fire && <span className="dio-fire" style={{ ...at(st.x + 1, y), '--from': `${-T}px` } as CSSProperties} />}
      <div className={`dio-hero ${st.gone ? 'gone' : ''} ${jump ? 'jump' : ''}`} style={at(st.x, y)}>
        <img src={sprite(TILE.player)} alt="" className="dio-a walk" />
        {st.say && <span className="dio-say">{st.say}</span>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 던전 장면 (배경)

type World = ReturnType<typeof useWorld>;

function Diorama({ world }: { world: World }) {
  const { scale, cols, rows, visible } = world;
  const walls = 2;
  const side = Math.max(2, Math.floor(cols * 0.18)); // 가운데(로고·메뉴)를 비우고 양옆에 소품
  // 화면에 다 보이는 맨 아래 줄. 로고·메뉴 쪽은 CSS 에서 아래 2.8칸(--tile)을 비워 두어 마법사·말풍선과 겹치지 않는다
  const lane = Math.max(walls + 3, visible - 1);
  const decorate = useCallback(
    (put: (n: number, x: number, y: number) => void) => {
      for (let x = 2; x < cols; x += 6) put(DECO.banner, x, 1);
      put(DECO.gargoyle, 0, 1);
      put(DECO.gargoyle2, cols - 2, 1);
      for (let x = 5; x < cols - 1; x += 6) put(DECO.statue, x, 1);
      put(DECO.shelf, 1, 2);
      put(DECO.shelf, 2, 2);
      put(DECO.barrel, 1, 4);
      put(DECO.barrel, 2, 5);
      put(DECO.table, cols - 3, 3);
      put(DECO.grave, cols - 2, 5);
    },
    [cols],
  );
  const torches = [];
  for (let x = 2; x < cols; x += 6) torches.push(x);
  const embers = useMemo(() => {
    const r = rand(7);
    return Array.from({ length: 22 }, () => ({ x: r() * cols * T, d: 5 + r() * 7, delay: -r() * 10, s: r() < 0.3 ? 2 : 1 }));
  }, [cols]);
  return (
    <div className="dio" aria-hidden="true">
      <div className="dio-world" style={{ width: cols * T, height: rows * T, transform: `scale(${scale})` }}>
        <DungeonCanvas cols={cols} rows={rows} walls={walls} decorate={decorate} />
        {torches.map((x) => (
          <span key={x} className="dio-torch" style={at(x, 1)} />
        ))}
        {/* 양옆 손님들 */}
        <img src={sprite(TILE.bot)} alt="" className="dio-a bob" style={at(side - 1, 4)} />
        <img src={sprite(TILE.slime)} alt="" className="dio-a squish" style={at(2, lane - 3)} />
        <div className="dio-spider" style={{ left: side * T + 4 }}>
          <span className="thread" />
          <img src={sprite(TILE.spider)} alt="" className="dio-a" />
        </div>
        <img src={sprite(TILE.ghost)} alt="" className="dio-a ghost" style={at(cols - side, 3)} />
        <div className="dio-sleep" style={at(cols - 4, lane - 3)}>
          <img src={sprite(TILE.giant)} alt="" className="dio-a" />
          <span className="z z1">z</span>
          <span className="z z2">Z</span>
        </div>
        <img src={sprite(TILE.bat)} alt="" className="dio-a dio-bat" style={{ '--w': `${cols * T}px` } as CSSProperties} />
        <CodeLane y={lane} cols={cols} />
        {embers.map((e, k) => (
          <span key={k} className="ember" style={{ left: e.x, width: e.s, height: e.s, animationDuration: `${e.d}s`, animationDelay: `${e.delay}s` }} />
        ))}
      </div>
      <div className="dio-shade" />
    </div>
  );
}

// ---------------------------------------------------------------- 로고 · 메뉴

/**
 * 픽셀 글자 로고. 글꼴 대신 칸(블록)으로 직접 그려서 게임 타일과 같은 결이 되게 한다.
 * 겹 순서: 아래로 밀린 갈색 두께(입체) → 검은 테두리 → 금색 면 → 윗변 반짝임 → 지나가는 빛줄기
 */
const GLYPHS: Record<string, string[]> = {
  P: ['111110', '110011', '110011', '111110', '110000', '110000', '110000'],
  R: ['111110', '110011', '110011', '111110', '110110', '110011', '110011'],
  O: ['011110', '110011', '110011', '110011', '110011', '110011', '011110'],
  G: ['011111', '110000', '110000', '110111', '110011', '110011', '011111'],
  A: ['011110', '110011', '110011', '111111', '110011', '110011', '110011'],
  M: ['1100011', '1110111', '1111111', '1101011', '1100011', '1100011', '1100011'],
  E: ['111111', '110000', '110000', '111110', '110000', '110000', '111111'],
};
const WORD = 'PROGRAME';
const DEPTH = 2; // 입체 두께 (칸)

function PixelLogo() {
  // 글자마다 시작 x 와 칸 목록
  let x = 1;
  const letters = [...WORD].map((ch) => {
    const rows = GLYPHS[ch];
    const cells: [number, number][] = [];
    rows.forEach((r, y) => [...r].forEach((c, cx) => c === '1' && cells.push([x + cx, y + 1])));
    const at = x;
    x += rows[0].length + 1;
    return { ch, at, cells };
  });
  const W = x;
  const H = 7 + 2 + DEPTH;
  const filled = new Set(letters.flatMap((l) => l.cells.map(([cx, cy]) => `${cx},${cy}`)));
  return (
    <svg className="plogo" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" role="img" aria-label="programe">
      <defs>
        <linearGradient id="plogo-gold" x1="0" y1="1" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.35" stopColor="#ffd24a" />
          <stop offset="0.7" stopColor="#ffb21e" />
          <stop offset="1" stopColor="#e07a10" />
        </linearGradient>
        <linearGradient id="plogo-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a3582c" />
          <stop offset="1" stopColor="#5a2b12" />
        </linearGradient>
        <clipPath id="plogo-clip">
          {letters.flatMap((l) => l.cells.map(([cx, cy]) => <rect key={`${cx},${cy}`} x={cx} y={cy} width={1} height={1} />))}
        </clipPath>
      </defs>
      {letters.map((l, i) => (
        <g key={i} className="plogo-letter" style={{ animationDelay: `${i * 0.08}s, ${0.9 + i * 0.12}s` }}>
          {/* 테두리 (입체 포함) */}
          {l.cells.flatMap(([cx, cy]) => (
            <rect key={`o${cx},${cy}`} x={cx - 0.5} y={cy - 0.5} width={2} height={2 + DEPTH} fill="#1a1426" />
          ))}
          {/* 입체 두께 */}
          {l.cells.map(([cx, cy]) => (
            <rect key={`d${cx},${cy}`} x={cx} y={cy + 0.5} width={1} height={DEPTH} fill="url(#plogo-side)" />
          ))}
          {/* 금색 면 */}
          {l.cells.map(([cx, cy]) => (
            <rect key={`f${cx},${cy}`} x={cx} y={cy} width={1} height={1} fill="url(#plogo-gold)" />
          ))}
          {/* 윗변 반짝임: 위가 비어 있는 칸 */}
          {l.cells
            .filter(([cx, cy]) => !filled.has(`${cx},${cy - 1}`))
            .map(([cx, cy]) => (
              <rect key={`h${cx},${cy}`} x={cx} y={cy} width={1} height={0.22} fill="#fffbe6" />
            ))}
        </g>
      ))}
      {/* 지나가는 빛줄기 */}
      <g clipPath="url(#plogo-clip)">
        <rect className="plogo-shine" x={-6} y={0} width={3} height={H} fill="rgba(255,255,255,0.75)" transform="skewX(-20)" />
      </g>
    </svg>
  );
}

function Logo() {
  return (
    <h1 className="glogo">
      <span className="glogo-aura" aria-hidden="true" />
      <PixelLogo />
      <span className="glogo-pai" aria-hidden="true">
        <PaiIcon size={16} />
      </span>
      <span className="glogo-sub">
        <span>사라진 스승과 파이썬 주문</span>
      </span>
    </h1>
  );
}

interface Item {
  label: string;
  sub?: string;
  run: () => void;
}

function Menu({ items, active }: { items: Item[]; active: boolean }) {
  const [sel, setSelState] = useState(0);
  const selRef = useRef(0);
  const setSel = (i: number) => {
    selRef.current = i;
    setSelState(i);
  };
  const pick = (i: number) => {
    sfx('magic', 0.4);
    items[i].run();
  };
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const n = items.length;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setSel((selRef.current + 1) % n);
        sfx('select', 0.3);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setSel((selRef.current + n - 1) % n);
        sfx('select', 0.3);
      } else if (e.key === 'Enter' || e.key === ' ') {
        // 버튼에 포커스가 있으면 브라우저의 클릭이 따로 오므로 여기서는 막고 한 번만
        e.preventDefault();
        pick(selRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items]);
  return (
    <nav className="gmenu" aria-label="메뉴">
      {items.map((it, i) => (
        <button
          key={it.label}
          className={`gmenu-item ${i === sel ? 'on' : ''}`}
          onMouseEnter={() => {
            if (i !== sel) sfx('select', 0.2);
            setSel(i);
          }}
          onFocus={() => setSel(i)}
          onClick={() => pick(i)}
        >
          <span className="gmenu-cursor" aria-hidden="true">
            ▶
          </span>
          <span className="gmenu-label">{it.label}</span>
          {it.sub && <small className="gmenu-sub">{it.sub}</small>}
        </button>
      ))}
    </nav>
  );
}

export function TitleScreen() {
  const progress = useStore(progressStore, (s) => s.stages);
  const muted = useStore(uiStore, (s) => s.muted);
  const [scene, setScene] = useState<'menu' | 'prologue'>('menu');
  const world = useWorld();
  const total = STAGES.reduce((n, s) => n + (progress[s.id]?.stars ?? 0), 0);
  const next = nextRecommended(progress);
  const resume = total > 0 && next ? getStage(next) : null;

  const startNew = () => (prologueSeen() ? openStage(STAGES[0].id) : setScene('prologue'));
  const items: Item[] = useMemo(
    () =>
      resume
        ? [
            { label: '이어하기', sub: `${stageNo(resume.id)}. ${resume.title}`, run: () => openStage(resume.id) },
            { label: '던전 지도', sub: '스테이지 고르기', run: goSelect },
            { label: '프롤로그 보기', run: () => setScene('prologue') },
            { label: '튜토리얼', run: () => (openStage(STAGES[0].id), replayTutorial('basic')) },
          ]
        : [
            { label: '모험 시작', sub: '1부 · 견습의 회랑', run: startNew },
            { label: '던전 지도', sub: '스테이지 고르기', run: goSelect },
            { label: '튜토리얼', run: () => (openStage(STAGES[0].id), replayTutorial('basic')) },
          ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resume?.id],
  );

  return (
    <div className="overlay gtitle" style={{ '--tile': `${T * world.scale}px` } as CSSProperties}>
      <Diorama world={world} />
      <div className="gtitle-top">
        <span className="gstars" title="모은 별">
          <StarIcon on />
          {total} / {STAGES.length * 3}
        </span>
        <button className="gmute" onClick={() => uiStore.set({ muted: !muted })} aria-label={muted ? '소리 켜기' : '소리 끄기'}>
          {muted ? '소리 꺼짐' : '소리 켬'}
        </button>
      </div>
      <div className="gtitle-center">
        <Logo />
        <Menu items={items} active={scene === 'menu'} />
        <p className="gtitle-keys">
          <kbd>↑</kbd>
          <kbd>↓</kbd> 고르기 · <kbd>Enter</kbd> 결정
        </p>
      </div>
      {scene === 'prologue' && (
        <Prologue
          onDone={() => {
            markPrologueSeen();
            setScene('menu');
            openStage(STAGES[0].id);
          }}
          onClose={() => {
            markPrologueSeen();
            setScene('menu');
          }}
          canPlay={!resume}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 프롤로그 (RPG 대화창)

const PROLOGUE_LINES: { who: 'narr' | 'pai'; text: string; act?: 'walk' | 'gone' | 'pai' }[] = [
  { who: 'narr', text: '마법 학교 지하에는, 들어갈 때마다 모양이 바뀌는 "변덕의 던전"이 있다.' },
  { who: 'narr', text: '던전의 심장을 고치러 내려간 그레이스 선생님은…', act: 'walk' },
  { who: 'narr', text: '사흘이 지나도록 돌아오지 않았다.', act: 'gone' },
  { who: 'pai', text: '견습생! 여기야, 여기! 선생님 주문책 속! 난 주문책에 사는 정령, 파이야!', act: 'pai' },
  { who: 'pai', text: '던전 안에서는 입으로 외는 주문이 안 통해. 두루마리에 적은 주문만, 적힌 순서 그대로 발동하지.' },
  { who: 'pai', text: '그 두루마리에 쓰는 말이 바로 파이썬이야. 같이 선생님을 찾으러 가자!' },
];

function Prologue({ onDone, onClose, canPlay }: { onDone: () => void; onClose: () => void; canPlay: boolean }) {
  const [line, setLine] = useState(0);
  const [shown, setShown] = useState(0);
  const cur = PROLOGUE_LINES[line];
  const typing = shown < cur.text.length;
  const finish = canPlay ? onDone : onClose;

  useEffect(() => {
    setShown(reducedMotion() ? cur.text.length : 0);
  }, [line, cur.text.length]);
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => {
      setShown((n) => n + 1);
      if (cur.who === 'pai' && shown % 3 === 0) sfx('select', 0.08);
    }, 34);
    return () => clearTimeout(t);
  }, [shown, typing, cur.who]);

  const advance = useCallback(() => {
    if (typing) return setShown(cur.text.length);
    if (line + 1 >= PROLOGUE_LINES.length) return finish();
    setLine(line + 1);
  }, [typing, cur.text.length, line, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, finish]);

  // 장면: 선생님이 문으로 걸어 들어가 사라지고, 파이가 나타난다
  const acts = PROLOGUE_LINES.slice(0, line + 1).map((l) => l.act);
  const walked = acts.includes('walk');
  const gone = acts.includes('gone');
  const pai = acts.includes('pai');

  return (
    <div className="prologue" role="dialog" aria-modal="true" aria-label="프롤로그" onClick={advance}>
      <div className="pro-stage">
        <div className="pro-world">
          <ProDoor />
          <img
            src={sprite(TEACHER)}
            alt=""
            className={`pro-teacher ${walked ? 'walk' : ''} ${gone ? 'gone' : ''}`}
          />
          {pai && (
            <div className="pro-pai">
              <PaiIcon size={16} />
            </div>
          )}
        </div>
      </div>
      <button
        className="pro-skip"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        건너뛰기 ▶▶
      </button>
      <div className={`pro-box ${cur.who}`}>
        {cur.who === 'pai' && (
          <>
            <div className="pro-face">
              <PaiIcon size={84} />
            </div>
            <span className="pro-name">파이</span>
          </>
        )}
        <p className="pro-text">
          {cur.text.slice(0, shown)}
          <span className="pro-rest">{cur.text.slice(shown)}</span>
        </p>
        {!typing && <span className="pro-next">{line + 1 >= PROLOGUE_LINES.length ? (canPlay ? '모험 시작 ▶' : '닫기 ▶') : '▼'}</span>}
      </div>
    </div>
  );
}

/** 프롤로그 무대: 던전 입구 (9×5 칸) */
const PRO_COLS = 9;
const PRO_ROWS = 5;
function ProDoor() {
  const decorate = useCallback((put: (n: number, x: number, y: number) => void) => {
    put(DECO.banner, 2, 1);
    put(DECO.banner, 6, 1);
    put(22, 4, 1);
    put(DECO.statue, 3, 1);
    put(DECO.statue, 5, 1);
  }, []);
  return <DungeonCanvas cols={PRO_COLS} rows={PRO_ROWS} walls={2} decorate={decorate} />;
}
