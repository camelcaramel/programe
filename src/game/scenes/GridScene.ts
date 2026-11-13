// 탑다운 그리드 렌더러. 게임 규칙은 모르고, gameStore 의 맵(Level)과 실행 기록(trace)만 보고 그린다.
//  - 재생이 한 칸씩 앞으로 가면 애니메이션, 그 밖(되감기·건너뛰기)은 boardAt 으로 즉시 다시 그림
import Phaser from 'phaser';
import { boardAt, initialBoard, type BoardState, type Level, type Pos, type TraceStep } from '../../sim';
import { currentTrace, gameStore, uiStore } from '../../state/store';
import { FONT, makeDotTexture } from '../systems/effects';

const T = 16; // Tiny Dungeon 타일 크기

/** Tiny Dungeon 타일 번호 (tilemap_packed.png, 12열) — PLAN.md §10 */
export const TILE = {
  floor: 48,
  floorAlt: [49, 50, 51],
  wall: 40,
  exit: 32, // 초록 마법진 (잠긴 문과 헷갈리지 않게)
  door: 45,
  chest: 89,
  chestOpen: 91,
  player: 84,
  slime: 108,
  bat: 120,
  giant: 109,
} as const;

const SFX = ['bump', 'coin', 'disappear', 'gem', 'hurt', 'jump-high', 'magic', 'select'] as const;
type Sfx = (typeof SFX)[number];

const SKILL_TINT = { fireball: 0xff8a3d, icebolt: 0x7fd8ff } as const;

const keyOf = (p: Pos) => `${p.x},${p.y}`;
const cx = (x: number) => x * T + T / 2;
const cy = (y: number) => y * T + T / 2;

export class GridScene extends Phaser.Scene {
  private terrainLayer!: Phaser.GameObjects.Container;
  private objLayer!: Phaser.GameObjects.Container;
  /** 잠깐 보였다 사라지는 것들(글자·불꽃·사라지는 문/열쇠/몬스터). 다시 그릴 때 통째로 비운다 */
  private fxLayer!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Sprite;
  private things = new Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>();
  private hpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private marks: Phaser.GameObjects.GameObject[] = [];

  private level: Level | null = null;
  private shownKey = '';
  private shownStep = -1;
  private board: BoardState | null = null;

  constructor() {
    super('grid');
  }

  preload() {
    this.load.spritesheet('td', 'assets/kenney/topdown/tilemap_packed.png', { frameWidth: T, frameHeight: T });
    for (const s of SFX) this.load.audio(s, `assets/kenney/audio/sfx_${s}.ogg`);
  }

  create() {
    makeDotTexture(this);
    makeKeyTexture(this);
    this.cameras.main.setBackgroundColor('#2a2236');
    this.cameras.main.setRoundPixels(true);
    this.terrainLayer = this.add.container(0, 0);
    this.objLayer = this.add.container(0, 0);
    this.player = this.add.sprite(0, 0, 'td', TILE.player).setDepth(10).setVisible(false);
    this.objLayer.add(this.player);
    this.fxLayer = this.add.container(0, 0);

    const unsubGame = gameStore.subscribe(() => this.sync());
    const applyMute = () => (this.sound.mute = uiStore.get().muted);
    applyMute();
    const unsubUi = uiStore.subscribe(applyMute);
    this.scale.on('resize', this.fit, this);
    // 씬이 끝나거나(shutdown) 게임째로 없어질 때(destroy, 개발 중 HMR 포함) 구독을 꼭 푼다
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      unsubGame();
      unsubUi();
      this.scale.off('resize', this.fit, this);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    if (import.meta.env.DEV) Object.assign(window, { __grid: this });
    this.sync();
  }

  // ───────────────────────── 상태 → 화면 ─────────────────────────

  private sync() {
    const s = gameStore.get();
    if (s.screen !== 'play' || s.levels.length === 0) {
      this.objLayer.setVisible(false);
      this.fxLayer.setVisible(false);
      this.terrainLayer.setVisible(false);
      return;
    }
    this.objLayer.setVisible(true);
    this.fxLayer.setVisible(true);
    this.terrainLayer.setVisible(true);

    const showRun = (s.phase === 'replay' || s.phase === 'done') && !!s.result;
    const view = showRun ? s.view : 0;
    const level = s.levels[view];
    const key = `${s.stageId}|${view}|${showRun ? 'run' : 'plan'}|${resultId(s.result)}`;
    const trace = showRun ? currentTrace(s) : [];
    const step = showRun ? s.step : 0;

    if (key !== this.shownKey || level !== this.level) {
      this.shownKey = key;
      this.level = level;
      this.drawTerrain(level);
      this.shownStep = step;
      this.board = boardAt(level, trace, step);
      this.drawObjects(this.board, !showRun);
      return;
    }
    if (step === this.shownStep) return;
    if (step === this.shownStep + 1 && s.playing) {
      const prev = this.board ?? initialBoard(level);
      this.board = boardAt(level, trace, step);
      this.animate(trace[step - 1], prev, s.speed);
    } else {
      this.board = boardAt(level, trace, step);
      this.drawObjects(this.board, false);
    }
    this.shownStep = step;
  }

  private drawTerrain(level: Level) {
    this.terrainLayer.removeAll(true);
    level.terrain.forEach((row, y) =>
      row.forEach((t, x) => {
        if (t === 'wall') {
          this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', TILE.wall));
          return;
        }
        const h = (x * 73856093) ^ (y * 19349663);
        const alt = Math.abs(h) % 7 === 0 ? TILE.floorAlt[Math.abs(h) % TILE.floorAlt.length] : TILE.floor;
        this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', alt));
        if (t === 'exit') this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', TILE.exit));
      }),
    );
    this.fit();
  }

  /** 움직이는 것들(상자·열쇠·문·몬스터·플레이어)을 board 상태 그대로 다시 그린다 */
  private drawObjects(board: BoardState, plan: boolean) {
    // 진행 중이던 연출을 끊으면 onComplete 가 불리지 않으므로, 연출용 오브젝트는 여기서 직접 지운다
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.fxLayer.removeAll(true);
    for (const o of this.things.values()) o.destroy();
    for (const g of this.hpBars.values()) g.destroy();
    for (const m of this.marks) m.destroy();
    this.things.clear();
    this.hpBars.clear();
    this.marks = [];
    const hidden = new Set(plan && this.level ? this.level.randomCells.map(keyOf) : []);

    for (const d of board.doors) if (!d.open) this.addThing(`d:${keyOf(d)}`, d, TILE.door);
    for (const c of board.chests) if (!hidden.has(keyOf(c))) this.addThing(`c:${keyOf(c)}`, c, c.open ? TILE.chestOpen : TILE.chest);
    for (const k of board.keyItems) if (!hidden.has(keyOf(k))) this.addThing(`k:${keyOf(k)}`, k, 'key');
    for (const m of board.monsters) {
      if (hidden.has(keyOf(m))) continue;
      const spr = this.addThing(`m:${keyOf(m)}`, m, TILE[m.kind]);
      this.idle(spr);
      this.drawHp(m);
    }
    if (plan && this.level) for (const p of this.level.randomCells) this.addQuestion(p);

    this.player
      .setVisible(true)
      .setPosition(cx(board.pos.x), cy(board.pos.y))
      .setFlipX(board.facing === 'left')
      .setAlpha(board.hp > 0 ? 1 : 0.45)
      .setAngle(board.hp > 0 ? 0 : 90)
      .clearTint();
    this.objLayer.bringToTop(this.player);
  }

  private addThing(id: string, p: Pos, frame: number | 'key') {
    const spr = frame === 'key' ? this.add.image(cx(p.x), cy(p.y), 'key') : this.add.sprite(cx(p.x), cy(p.y), 'td', frame);
    this.objLayer.add(spr);
    this.things.set(id, spr);
    return spr;
  }

  private addQuestion(p: Pos) {
    const bg = this.add.circle(cx(p.x), cy(p.y), 6, 0x353541, 0.85).setStrokeStyle(1, 0xffc533);
    const t = this.add
      .text(cx(p.x), cy(p.y) + 0.5, '?', { fontFamily: FONT, fontSize: '40px', color: '#ffe07a' })
      .setOrigin(0.5)
      .setScale(0.25);
    this.objLayer.add([bg, t]);
    this.marks.push(bg, t);
    this.tweens.add({ targets: [bg, t], y: '-=1.5', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private idle(spr: Phaser.GameObjects.Image) {
    this.tweens.add({ targets: spr, scaleY: 0.92, y: spr.y + 0.6, duration: 520 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawHp(m: BoardState['monsters'][number]) {
    const id = keyOf(m);
    this.hpBars.get(id)?.destroy();
    this.hpBars.delete(id);
    if (m.hp >= m.maxHp || m.hp <= 0) return;
    const g = this.add.graphics();
    const w = 12;
    g.fillStyle(0x353541).fillRect(cx(m.x) - w / 2 - 1, m.y * T - 3, w + 2, 3);
    g.fillStyle(0xe54341).fillRect(cx(m.x) - w / 2, m.y * T - 2, Math.round((w * m.hp) / m.maxHp), 1);
    this.objLayer.add(g);
    this.hpBars.set(id, g);
  }

  // ───────────────────────── 한 턴 애니메이션 ─────────────────────────

  private animate(step: TraceStep, prev: BoardState, speed: number) {
    const d = 260 / speed;
    const p = this.player;
    this.tweens.killTweensOf(p);
    p.setPosition(cx(prev.pos.x), cy(prev.pos.y)).setAngle(0).setAlpha(1).clearTint();
    if (step.dir === 'left' || step.dir === 'right') p.setFlipX(step.dir === 'left');
    const tx = cx(step.target.x);
    const ty = cy(step.target.y);
    const tk = keyOf(step.target);

    switch (step.event) {
      case 'move':
      case 'chest':
      case 'key':
      case 'door':
      case 'exit': {
        if (step.event === 'door') {
          const door = this.things.get(`d:${tk}`);
          this.things.delete(`d:${tk}`);
          if (door) this.tweens.add({ targets: this.retire(door), alpha: 0, scaleY: 0.2, duration: d * 0.6, onComplete: () => door.destroy() });
          this.play('select');
        }
        this.hop(p, tx, ty, d, () => {
          if (step.event === 'chest') {
            const c = this.things.get(`c:${tk}`) as Phaser.GameObjects.Sprite | undefined;
            c?.setFrame(TILE.chestOpen);
            this.say(tx, ty - 8, '+1', '#ffe07a', 7);
            this.spark(tx, ty, 0xffd34d, 10, 50);
            this.play('coin');
          } else if (step.event === 'key') {
            const k = this.things.get(`k:${tk}`);
            this.things.delete(`k:${tk}`);
            if (k) this.tweens.add({ targets: this.retire(k), y: ty - 10, alpha: 0, duration: d, onComplete: () => k.destroy() });
            this.play('gem');
          } else if (step.event === 'exit') {
            this.spark(tx, ty, 0xffd34d, 24, 70);
            this.tweens.add({ targets: p, y: ty - 6, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
            this.play('jump-high');
          }
        });
        break;
      }
      case 'bump':
        this.nudge(p, tx, ty, d);
        this.say((p.x + tx) / 2, (p.y + ty) / 2 - 4, '쿵', '#d9d4ef', 6);
        this.play('bump');
        this.cameras.main.shake(90, 0.004);
        break;
      case 'hit':
        this.nudge(p, tx, ty, d);
        p.setTint(0xff6b6b);
        this.time.delayedCall(d, () => p.clearTint());
        this.say(cx(prev.pos.x), cy(prev.pos.y) - 8, `-${step.amount ?? 1}`, '#ff8f8f', 7);
        this.play('hurt');
        this.cameras.main.shake(140, 0.008);
        if (step.hp <= 0) this.tweens.add({ targets: p, angle: 90, alpha: 0.45, delay: d, duration: 300 });
        break;
      case 'damage':
      case 'kill':
      case 'miss':
        this.cast(step, d, tx, ty, tk);
        break;
    }
  }

  private cast(step: TraceStep, d: number, tx: number, ty: number, tk: string) {
    const tint = step.skill ? SKILL_TINT[step.skill] : 0xffffff;
    const ball = this.add.image(this.player.x, this.player.y, 'dot').setTint(tint).setScale(0.45).setBlendMode(Phaser.BlendModes.ADD);
    this.fxLayer.add(ball);
    this.play('magic');
    this.tweens.add({
      targets: ball,
      x: tx,
      y: ty,
      duration: d * 0.7,
      ease: 'Quad.easeIn',
      onComplete: () => {
        ball.destroy();
        this.spark(tx, ty, tint, step.event === 'miss' ? 5 : 14, step.event === 'miss' ? 25 : 55);
        const mon = this.things.get(`m:${tk}`);
        if (step.event === 'miss') return;
        if (step.event === 'kill') {
          this.say(tx, ty - 8, `-${step.amount}`, '#ffe07a', 7);
          this.things.delete(`m:${tk}`);
          this.hpBars.get(tk)?.destroy();
          this.hpBars.delete(tk);
          if (mon) {
            this.tweens.killTweensOf(mon);
            this.tweens.add({ targets: this.retire(mon), alpha: 0, scale: 0.2, angle: 180, duration: d, onComplete: () => mon.destroy() });
          }
          this.play('disappear');
          return;
        }
        // damage
        if ((step.amount ?? 0) > 0) {
          this.say(tx, ty - 8, `-${step.amount}`, '#ffe07a', 7);
          const m = this.board?.monsters.find((m) => keyOf(m) === tk);
          if (m) this.drawHp(m);
          if (mon) this.tweens.add({ targets: mon, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
        } else {
          this.say(tx, ty - 8, '효과 없음', '#c9c4de', 6);
        }
      },
    });
  }

  /** 화면에서 사라질 오브젝트를 연출용 층으로 옮긴다 (중간에 다시 그려도 남지 않게) */
  private retire<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objLayer.remove(o);
    this.fxLayer.add(o);
    return o;
  }

  private hop(p: Phaser.GameObjects.Sprite, tx: number, ty: number, d: number, done: () => void) {
    this.tweens.add({ targets: p, x: tx, y: ty, duration: d, ease: 'Sine.easeInOut', onComplete: done });
    this.tweens.add({ targets: p, scaleY: 0.86, duration: d / 2, yoyo: true, ease: 'Sine.easeOut' });
  }

  private nudge(p: Phaser.GameObjects.Sprite, tx: number, ty: number, d: number) {
    const ox = p.x;
    const oy = p.y;
    this.tweens.add({ targets: p, x: ox + (tx - ox) * 0.3, y: oy + (ty - oy) * 0.3, duration: d / 2, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** 화면 기준 크기(px)로 떠오르는 글자 */
  private say(x: number, y: number, text: string, color: string, screenPx: number) {
    const z = this.cameras.main.zoom;
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '48px', color, stroke: '#353541', strokeThickness: 10 })
      .setOrigin(0.5)
      .setScale((screenPx * 3.2) / 48 / z)
      .setDepth(50);
    this.fxLayer.add(t);
    this.tweens.add({ targets: t, y: y - 10, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /** 작은 불꽃 파티클 (월드 좌표, 16px 타일 크기에 맞춤) */
  private spark(x: number, y: number, tint: number, count: number, speed: number) {
    const e = this.add.particles(x, y, 'dot', {
      speed: { min: speed * 0.4, max: speed },
      lifespan: { min: 220, max: 480 },
      scale: { start: 0.16, end: 0 },
      tint,
      blendMode: 'ADD',
      emitting: false,
    });
    this.fxLayer.add(e);
    e.explode(count);
    this.time.delayedCall(600, () => e.destroy());
  }

  private play(key: Sfx) {
    if (!this.sound.mute) this.sound.play(key, { volume: 0.35 });
  }

  /** 맵 전체가 보이도록 정수 배율로 확대하고 가운데 맞춤 */
  private fit() {
    if (!this.level) return;
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    const top = 96; // 위 HUD
    const bottom = 96; // 아래 재생 막대
    const zx = (w - 48) / (this.level.width * T);
    const zy = (h - top - bottom) / (this.level.height * T);
    const z = Math.max(1, Math.min(7, Math.floor(Math.min(zx, zy))));
    cam.setZoom(z);
    cam.centerOn((this.level.width * T) / 2, (this.level.height * T) / 2 - (top - bottom) / (2 * z));
  }
}

const ids = new WeakMap<object, number>();
let nextId = 1;
function resultId(r: object | null) {
  if (!r) return 0;
  if (!ids.has(r)) ids.set(r, nextId++);
  return ids.get(r)!;
}

/** 팩에 열쇠 그림이 없어 16×16 픽셀 열쇠를 코드로 그린다 (Kenney 팔레트 색) */
function makeKeyTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('key')) return;
  const px = [
    '................',
    '................',
    '....####........',
    '...#yyyy#.......',
    '..#yy##yy#......',
    '..#y#..#y#......',
    '..#y#..#y#......',
    '..#yy##yy######.',
    '...#yyyyyyyyyyy#',
    '....####yy#y#yy#',
    '........##.#.##.',
    '................',
    '................',
    '................',
    '................',
    '................',
  ];
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  px.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      g.fillStyle(c === '#' ? 0x353541 : 0xffc533).fillRect(x, y + 2, 1, 1);
    }),
  );
  g.generateTexture('key', T, T);
  g.destroy();
}
