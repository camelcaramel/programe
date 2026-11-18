// 탑다운 그리드 렌더러. 게임 규칙은 모르고, gameStore 의 맵(Level)과 실행 기록(trace)만 보고 그린다.
//  - 재생이 한 칸씩 앞으로 가면 애니메이션, 그 밖(되감기·건너뛰기)은 boardAt 으로 즉시 다시 그림
import Phaser from 'phaser';
import { boardAt, initialBoard, type BoardState, type BotStep, type Level, type MonsterInfo, type Pos, type SignValue, type TraceStep } from '../../sim';
import { currentTrace, gameStore, uiStore } from '../../state/store';
import { FONT, makeDotTexture } from '../systems/effects';
import { COLOR, NO_TINT, hex } from '../../ui/tokens';

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
  sign: 66, // 나무 표지판 (2부)
  tablet: 65, // 돌 석판 (2부)
  gate: 46, // 비밀 문 = 큰 문 + 코드로 그린 자물쇠 (2부)
  ghost: 121, // 3부 변이 몬스터
  spider: 122,
  crab: 110,
  mimic: 92, // 정체가 드러나기 전에는 chest(89) 로 그린다
  bot: 96, // 조수 로봇 (갑옷 인형) + 번호 표
} as const;

const SFX = ['bump', 'coin', 'disappear', 'gem', 'hurt', 'jump-high', 'magic', 'select'] as const;
type Sfx = (typeof SFX)[number];

const SKILL_TINT = { fireball: hex(COLOR.fxFire), icebolt: hex(COLOR.fxIce), lightning: hex(COLOR.fxThunder) } as const;

const keyOf = (p: Pos) => `${p.x},${p.y}`;
const cx = (x: number) => x * T + T / 2;
const cy = (y: number) => y * T + T / 2;

export class GridScene extends Phaser.Scene {
  private terrainLayer!: Phaser.GameObjects.Container;
  private objLayer!: Phaser.GameObjects.Container;
  /** 잠깐 보였다 사라지는 것들(글자·불꽃·사라지는 문/열쇠/몬스터). 다시 그릴 때 통째로 비운다 */
  private fxLayer!: Phaser.GameObjects.Container;
  private guideLayer: Phaser.GameObjects.Container | null = null;
  private player!: Phaser.GameObjects.Sprite;
  private things = new Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>();
  private hpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private marks: Phaser.GameObjects.GameObject[] = [];
  /** 표지판 칸("x,y") → 그 위의 ? 표시 (읽으면 지운다) */
  private signMarks = new Map<string, Phaser.GameObjects.GameObject[]>();
  private bubbles: Phaser.GameObjects.Container[] = [];
  /** 조수 로봇 (몸 + 번호 표) */
  private botViews = new Map<number, Phaser.GameObjects.Container>();

  private level: Level | null = null;
  private shownKey = '';
  private shownStep = -1;
  private board: BoardState | null = null;
  /** 마지막으로 drawObjects 한 조건 (확대 배율이 바뀌면 같은 장면을 다시 그린다) */
  private lastDraw: { plan: boolean; last?: TraceStep } = { plan: true };

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
    makeLockTexture(this);
    makePlateTextures(this);
    makeBarsTexture(this);
    this.cameras.main.setBackgroundColor(COLOR.dungeon);
    this.cameras.main.setRoundPixels(true);
    this.terrainLayer = this.add.container(0, 0);
    this.objLayer = this.add.container(0, 0).setDepth(2);
    this.player = this.add.sprite(0, 0, 'td', TILE.player).setDepth(10).setVisible(false);
    this.objLayer.add(this.player);
    this.fxLayer = this.add.container(0, 0).setDepth(3);

    const unsubGame = gameStore.subscribe(() => this.sync());
    let grid = uiStore.get().showGrid;
    const applyUi = () => {
      this.sound.mute = uiStore.get().muted;
      if (uiStore.get().showGrid !== grid) {
        grid = uiStore.get().showGrid;
        this.fit();
      }
    };
    applyUi();
    const unsubUi = uiStore.subscribe(applyUi);
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
    activeScene = this;
    if (import.meta.env.DEV) Object.assign(window, { __grid: this });
    this.sync();
  }

  // ───────────────────────── 상태 → 화면 ─────────────────────────

  private sync() {
    const s = gameStore.get();
    if (s.screen !== 'play' || s.levels.length === 0) {
      this.objLayer.setVisible(false);
      this.fxLayer.setVisible(false);
      this.guideLayer?.setVisible(false);
      this.terrainLayer.setVisible(false);
      return;
    }
    this.objLayer.setVisible(true);
    this.fxLayer.setVisible(true);
    this.guideLayer?.setVisible(true);
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
      this.board = null; // 맵이 바뀌면 지난 장면을 fit() 에서 다시 그리지 않게
      this.drawTerrain(level);
      this.shownStep = step;
      this.board = boardAt(level, trace, step);
      this.drawObjects(this.board, !showRun, trace[step - 1]);
      return;
    }
    if (step === this.shownStep) return;
    if (step === this.shownStep + 1 && s.playing) {
      const prev = this.board ?? initialBoard(level);
      this.board = boardAt(level, trace, step);
      this.animate(trace[step - 1], prev, s.speed);
    } else {
      this.board = boardAt(level, trace, step);
      this.drawObjects(this.board, false, trace[step - 1]);
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
        if (t === 'sign' || t === 'tablet') {
          // 벽 줄에 박힌 표지판·석판: 벽 위에 그린다
          this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', TILE.wall));
          this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', TILE[t]));
          return;
        }
        const h = (x * 73856093) ^ (y * 19349663);
        const alt = Math.abs(h) % 7 === 0 ? TILE.floorAlt[Math.abs(h) % TILE.floorAlt.length] : TILE.floor;
        this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', alt));
        if (t === 'exit') this.terrainLayer.add(this.add.image(cx(x), cy(y), 'td', TILE.exit));
        if (t === 'plate') this.terrainLayer.add(this.add.image(cx(x), cy(y), 'plate'));
      }),
    );
    this.fit();
  }

  /** 움직이는 것들(상자·열쇠·문·몬스터·플레이어)을 board 상태 그대로 다시 그린다 */
  private drawObjects(board: BoardState, plan: boolean, last?: TraceStep) {
    this.lastDraw = { plan, last };
    // 진행 중이던 연출을 끊으면 onComplete 가 불리지 않으므로, 연출용 오브젝트는 여기서 직접 지운다
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.fxLayer.removeAll(true);
    for (const o of this.things.values()) o.destroy();
    for (const g of this.hpBars.values()) g.destroy();
    for (const m of this.marks) m.destroy();
    for (const b of this.botViews.values()) b.destroy();
    this.botViews.clear();
    this.things.clear();
    this.hpBars.clear();
    this.marks = [];
    this.signMarks.clear();
    this.bubbles = [];
    const hidden = new Set(plan && this.level ? this.level.randomCells.map(keyOf) : []);

    for (const d of board.doors) if (!d.open) this.addThing(`d:${keyOf(d)}`, d, TILE.door);
    for (const g of board.gates) if (!g.open) this.addGate(g);
    for (const b of board.bars) if (!b.open) this.addThing(`bar:${keyOf(b)}`, b, 'bars');
    for (const p of board.plates) if (p.pressed) this.addThing(`pl:${keyOf(p)}`, p, 'platePressed');
    // 아직 읽지 않은 표지판·석판에는 ? 말풍선 (내용은 read() 로만 알 수 있다)
    if (this.level) for (const sg of this.level.signs) if (!board.read.includes(keyOf(sg))) this.addSignMark(sg);
    for (const c of board.chests) if (!hidden.has(keyOf(c))) this.addThing(`c:${keyOf(c)}`, c, c.open ? TILE.chestOpen : TILE.chest);
    for (const k of board.keyItems) if (!hidden.has(keyOf(k))) this.addThing(`k:${keyOf(k)}`, k, 'key');
    for (const m of board.monsters) {
      if (hidden.has(keyOf(m))) continue;
      const disguised = m.kind === 'mimic' && !m.revealed;
      const spr = this.addThing(`m:${keyOf(m)}`, m, disguised ? TILE.chest : TILE[m.kind]);
      if (!disguised) this.idle(spr);
      this.drawHp(m);
    }
    for (const b of board.bots) this.addBot(b);
    if (plan && this.level) for (const p of this.level.randomCells) this.addQuestion(p);

    this.player
      .setVisible(true)
      .setPosition(cx(board.pos.x), cy(board.pos.y))
      .setFlipX(board.facing === 'left')
      .setAlpha(board.hp > 0 ? 1 : 0.45)
      .setAngle(board.hp > 0 ? 0 : 90)
      .clearTint();
    this.objLayer.bringToTop(this.player);
    // 되감기·건너뛰기로 읽기/암호 장면에 멈췄으면 말풍선도 그대로 보여 준다
    if (last && !plan) this.stepBubble(last, false);
  }

  /** 비밀 문 + 자물쇠 */
  private addGate(p: Pos) {
    this.addThing(`g:${keyOf(p)}`, p, TILE.gate);
    const lock = this.add.image(cx(p.x), cy(p.y) + 2, 'lock');
    this.objLayer.add(lock);
    this.things.set(`gl:${keyOf(p)}`, lock);
  }

  /** 표지판·석판 위의 작은 ? 말풍선. 읽으면 지우도록 칸 좌표로 기억한다 */
  private addSignMark(p: Pos) {
    const x = cx(p.x) + 5;
    const y = cy(p.y) - 6;
    const bg = this.add.circle(x, y, 4, 0xf4eeda, 0.95).setStrokeStyle(0.75, 0x353541);
    const t = this.add
      .text(x, y + 0.3, '?', { fontFamily: FONT, fontSize: '40px', color: '#353541' })
      .setOrigin(0.5)
      .setScale(0.17);
    this.objLayer.add([bg, t]);
    this.signMarks.set(keyOf(p), [bg, t]);
    this.marks.push(bg, t);
    this.tweens.add({ targets: [bg, t], y: '-=1', duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** read · open_gate 장면의 말풍선 (재생 중 그 턴 동안 떠 있다) */
  private stepBubble(step: TraceStep, fresh: boolean) {
    const t = step.target;
    if (step.event === 'read' && step.value !== undefined) {
      this.bubble(t, formatValue(step.value), '#353541', 0xf4eeda, fresh);
    } else if (step.event === 'gate_wrong') {
      const why = step.typeMismatch ? '자료형이 달라요!' : '틀린 암호!';
      this.bubble(t, `${step.shown ?? ''}  ✘ ${why}`, '#ffffff', 0xc0392b, fresh);
    } else if (step.event === 'gate_open') {
      this.bubble(t, `${step.shown ?? ''}  ✔ 열림!`, '#353541', 0x7ee2a0, fresh);
    } else if (step.event === 'scan' && step.info) {
      this.bubble(t, formatMonster(step.info), '#ffffff', 0x4a3f6b, fresh);
    }
  }

  /** 화면 기준 글자 크기의 말풍선. 칸 위에 띄우고, 위쪽 HUD 에 가리면 칸 아래에 띄운다 */
  private bubble(cell: Pos, text: string, color: string, fill: number, pop: boolean) {
    const cam = this.cameras.main;
    const z = cam.zoom;
    const s = 15 / 48 / z; // 화면에서 약 15px 글자
    const label = this.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '48px', color, align: 'left', lineSpacing: 6 })
      .setOrigin(0.5, 0)
      .setScale(s);
    const pad = 7 / z;
    const w = label.width * s + pad * 2;
    const h = label.height * s + pad * 2;
    const tail = 5 / z;
    const x = cx(cell.x);
    // 맵 밖으로 너무 나가지 않게 가로 위치를 맞춘다
    const mapW = (this.level?.width ?? 0) * T;
    const left = Math.max(-T, Math.min(x - w / 2, mapW + T - w));
    const above = cell.y * T - 1 - tail - h >= cam.worldView.y + 100 / z; // 위 HUD 높이만큼 비켜서
    const tip = above ? cell.y * T - 1 : (cell.y + 1) * T + 1; // 꼬리 끝
    const top = above ? tip - tail - h : tip + tail;
    const base = above ? tip - tail - 1 / z : tip + tail + 1 / z; // 꼬리 밑변
    const g = this.add.graphics();
    g.fillStyle(0x353541, 0.35).fillRoundedRect(left + 1 / z, top + 2 / z, w, h, 4 / z);
    g.fillStyle(fill, 1).fillRoundedRect(left, top, w, h, 4 / z);
    g.lineStyle(1.5 / z, 0x353541, 1).strokeRoundedRect(left, top, w, h, 4 / z);
    g.fillStyle(fill, 1).fillTriangle(x - tail, base, x + tail, base, x, tip);
    label.setPosition(left + w / 2, top + pad);
    const box = this.add.container(0, 0, [g, label]).setDepth(60);
    this.bubbles.push(box);
    this.fxLayer.add(box);
    if (pop) {
      box.setAlpha(0);
      this.tweens.add({ targets: box, alpha: 1, duration: 120 });
    }
  }

  /** 조수 로봇: 몸(갑옷 인형) + 머리 위 번호 표. 고장 나면 잿빛 */
  private addBot(b: BoardState['bots'][number]) {
    const body = this.add.sprite(0, 0, 'td', TILE.bot).setFlipX(b.facing === 'left');
    const tag = this.add.circle(5, -6, 3.2, 0x7fd8ff).setStrokeStyle(0.75, 0x353541);
    const num = this.add
      .text(5, -5.8, String(b.id), { fontFamily: FONT, fontSize: '40px', color: '#353541' })
      .setOrigin(0.5)
      .setScale(0.13);
    const box = this.add.container(cx(b.x), cy(b.y), [body, tag, num]);
    if (b.broken) this.breakBot(box);
    this.objLayer.add(box);
    this.botViews.set(b.id, box);
  }

  private breakBot(box: Phaser.GameObjects.Container) {
    (box.list[0] as Phaser.GameObjects.Sprite).setTint(0x77748c).setAngle(-12);
    (box.list[1] as Phaser.GameObjects.Arc).setFillStyle(0x8d8aa6);
  }

  private addThing(id: string, p: Pos, frame: number | 'key' | 'bars' | 'platePressed') {
    const spr = typeof frame === 'string' ? this.add.image(cx(p.x), cy(p.y), frame) : this.add.sprite(cx(p.x), cy(p.y), 'td', frame);
    this.objLayer.add(spr);
    this.things.set(id, spr);
    return spr;
  }

  private addQuestion(p: Pos) {
    const bg = this.add.circle(cx(p.x), cy(p.y), 6, hex(COLOR.ink), 0.85).setStrokeStyle(1, hex(COLOR.gold));
    const t = this.add
      .text(cx(p.x), cy(p.y) + 0.5, '?', { fontFamily: FONT, fontSize: '40px', color: COLOR.goldLight })
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
    g.fillStyle(hex(COLOR.ink)).fillRect(cx(m.x) - w / 2 - 1, m.y * T - 3, w + 2, 3);
    g.fillStyle(hex(COLOR.red)).fillRect(cx(m.x) - w / 2, m.y * T - 2, Math.round((w * m.hp) / m.maxHp), 1);
    this.objLayer.add(g);
    this.hpBars.set(id, g);
  }

  // ───────────────────────── 한 턴 애니메이션 ─────────────────────────

  private animate(step: TraceStep, prev: BoardState, speed: number) {
    const d = 260 / speed;
    const p = this.player;
    // 지난 턴의 말풍선(읽기·암호)은 다음 턴이 시작되면 내린다
    for (const b of this.bubbles) b.destroy();
    this.bubbles = [];
    this.tweens.killTweensOf(p);
    p.setPosition(cx(prev.pos.x), cy(prev.pos.y)).setAngle(0).setAlpha(1).clearTint();
    if (step.action !== 'wait' && step.by === undefined && (step.dir === 'left' || step.dir === 'right')) p.setFlipX(step.dir === 'left');
    const tx = cx(step.target.x);
    const ty = cy(step.target.y);
    const tk = keyOf(step.target);
    // 조수 로봇들은 마법사와 같은 턴에 함께 움직인다 (창살·발판도 그 뒤에 맞춘다)
    if (step.bots || step.barsOpen) this.animateRound(step, d);

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
            this.say(tx, ty - 8, '+1', COLOR.goldLight, 7);
            this.spark(tx, ty, hex(COLOR.fxSpark), 10, 50);
            this.play('coin');
          } else if (step.event === 'key') {
            const k = this.things.get(`k:${tk}`);
            this.things.delete(`k:${tk}`);
            if (k) this.tweens.add({ targets: this.retire(k), y: ty - 10, alpha: 0, duration: d, onComplete: () => k.destroy() });
            this.play('gem');
          } else if (step.event === 'exit') {
            this.spark(tx, ty, hex(COLOR.fxSpark), 24, 70);
            this.tweens.add({ targets: p, y: ty - 6, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
            this.play('jump-high');
          }
        });
        break;
      }
      case 'bump':
        this.nudge(p, tx, ty, d);
        this.say((p.x + tx) / 2, (p.y + ty) / 2 - 4, '쿵', COLOR.fxBump, 6);
        this.play('bump');
        this.cameras.main.shake(90, 0.004);
        break;
      case 'hit':
        if (this.reveal(tk)) this.say(tx, ty - 9, '덥석!', COLOR.fxDamage, 7);
        this.nudge(p, tx, ty, d);
        p.setTint(hex(COLOR.fxHurt));
        this.time.delayedCall(d, () => p.clearTint());
        this.say(cx(prev.pos.x), cy(prev.pos.y) - 8, `-${step.amount ?? 1}`, COLOR.fxDamage, 7);
        this.play('hurt');
        this.cameras.main.shake(140, 0.008);
        if (step.hp <= 0) this.tweens.add({ targets: p, angle: 90, alpha: 0.45, delay: d, duration: 300 });
        break;
      case 'damage':
      case 'kill':
      case 'miss':
        this.cast(p, step, d, tx, ty, tk);
        if (step.counter) {
          // 약점이 아닌 마법: 몬스터의 반격
          this.time.delayedCall(d * 0.75, () => {
            p.setTint(hex(COLOR.fxHurt));
            this.say(cx(prev.pos.x), cy(prev.pos.y) - 8, `반격! -${step.counter}`, COLOR.fxDamage, 7);
            this.nudge(p, cx(prev.pos.x) * 2 - tx, cy(prev.pos.y) * 2 - ty, d);
            this.play('hurt');
            this.cameras.main.shake(140, 0.008);
            this.time.delayedCall(d, () => p.clearTint());
            if (step.hp <= 0) this.tweens.add({ targets: p, angle: 90, alpha: 0.45, delay: d, duration: 300 });
          });
        }
        break;
      case 'scan':
        this.reveal(tk);
        this.stepBubble(step, true);
        this.play('select');
        break;
      case 'wait':
        this.say(p.x, p.y - 8, '…', COLOR.lavender, 7);
        break;
      case 'read': {
        for (const m of this.signMarks.get(tk) ?? []) {
          this.tweens.killTweensOf(m);
          m.destroy();
        }
        this.signMarks.delete(tk);
        this.stepBubble(step, true);
        this.play('select');
        break;
      }
      case 'gate_open': {
        this.stepBubble(step, true);
        for (const id of [`g:${tk}`, `gl:${tk}`]) {
          const o = this.things.get(id);
          this.things.delete(id);
          if (o) this.tweens.add({ targets: this.retire(o), alpha: 0, scaleY: 0.2, duration: d, delay: d * 0.3, onComplete: () => o.destroy() });
        }
        this.spark(tx, ty, 0xb48cff, 18, 55);
        this.play('magic');
        break;
      }
      case 'gate_wrong': {
        this.stepBubble(step, true);
        const lock = this.things.get(`gl:${tk}`);
        if (lock) this.tweens.add({ targets: lock, x: lock.x + 1.2, duration: 50, yoyo: true, repeat: 3 });
        p.setTint(0xff6b6b);
        this.time.delayedCall(d, () => p.clearTint());
        this.say(cx(prev.pos.x), cy(prev.pos.y) - 8, '-1', '#ff8f8f', 7);
        this.cameras.main.flash(220, 229, 67, 65);
        this.cameras.main.shake(160, 0.006);
        this.play('hurt');
        if (step.hp <= 0) this.tweens.add({ targets: p, angle: 90, alpha: 0.45, delay: d, duration: 300 });
        break;
      }
    }
  }

  /** 미믹의 정체를 드러낸다 (상자 → 미믹 그림). 새로 드러났으면 true */
  private reveal(tk: string): boolean {
    const mon = this.things.get(`m:${tk}`) as Phaser.GameObjects.Sprite | undefined;
    const m = this.board?.monsters.find((m) => keyOf(m) === tk) ?? (this.level?.monsters.find((m) => keyOf(m) === tk));
    if (!mon || !m || m.kind !== 'mimic' || mon.frame.name === String(TILE.mimic)) return false;
    mon.setFrame(TILE.mimic);
    this.idle(mon);
    this.tweens.add({ targets: mon, scale: { from: 1.35, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    return true;
  }

  /** 한 턴 동안 조수 로봇들이 한 일 + 창살·발판 맞추기 (마법사 연출과 동시에) */
  private animateRound(step: TraceStep, d: number) {
    for (const b of step.bots ?? []) this.animateBot(b, d);
    const board = this.board;
    if (!board) return;
    this.time.delayedCall(d, () => {
      for (const pl of board.plates) {
        const id = `pl:${keyOf(pl)}`;
        const has = this.things.get(id);
        if (pl.pressed && !has) {
          this.addThing(id, pl, 'platePressed');
          this.objLayer.sendToBack(this.things.get(id)!);
        } else if (!pl.pressed && has) {
          has.destroy();
          this.things.delete(id);
        }
      }
      for (const c of board.bars) {
        const id = `bar:${keyOf(c)}`;
        const has = this.things.get(id);
        if (c.open && has) {
          this.things.delete(id);
          this.tweens.add({ targets: this.retire(has), y: has.y - 6, alpha: 0, duration: d, onComplete: () => has.destroy() });
          this.play('select');
        } else if (!c.open && !has) {
          const bar = this.addThing(id, c, 'bars');
          this.tweens.add({ targets: bar, y: { from: bar.y - 6, to: bar.y }, alpha: { from: 0, to: 1 }, duration: d });
          this.play('bump');
        }
      }
    });
  }

  private animateBot(b: BotStep, d: number) {
    const box = this.botViews.get(b.id);
    if (!box) return;
    const body = box.list[0] as Phaser.GameObjects.Sprite;
    if (b.dir === 'left' || b.dir === 'right') body.setFlipX(b.dir === 'left');
    const tx = cx(b.target.x);
    const ty = cy(b.target.y);
    if (b.action === 'move') {
      if (b.event === 'move') {
        this.tweens.add({ targets: box, x: tx, y: ty, duration: d, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: body, scaleY: 0.86, duration: d / 2, yoyo: true, ease: 'Sine.easeOut' });
      } else {
        this.tweens.add({ targets: box, x: box.x + (tx - box.x) * 0.3, y: box.y + (ty - box.y) * 0.3, duration: d / 2, yoyo: true, ease: 'Quad.easeOut' });
      }
      return;
    }
    this.cast(box, b, d, tx, ty, keyOf(b.target));
    if (b.broken)
      this.time.delayedCall(d * 0.75, () => {
        this.breakBot(box);
        this.say(box.x, box.y - 8, '고장!', COLOR.fxDamage, 6);
        this.play('hurt');
      });
  }

  /** from(마법사나 조수)에서 대상 칸으로 마법 구슬 */
  private cast(
    from: { x: number; y: number },
    step: Pick<TraceStep, 'skill' | 'event' | 'amount'>,
    d: number,
    tx: number,
    ty: number,
    tk: string,
  ) {
    const tint = step.skill ? SKILL_TINT[step.skill] : NO_TINT;
    const ball = this.add.image(from.x, from.y, 'dot').setTint(tint).setScale(0.45).setBlendMode(Phaser.BlendModes.ADD);
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
        if (step.event !== 'miss') this.reveal(tk);
        const mon = this.things.get(`m:${tk}`);
        if (step.event === 'miss') return;
        if (step.event === 'kill') {
          this.say(tx, ty - 8, `-${step.amount}`, COLOR.goldLight, 7);
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
          this.say(tx, ty - 8, `-${step.amount}`, COLOR.goldLight, 7);
          const m = this.board?.monsters.find((m) => keyOf(m) === tk);
          if (m) this.drawHp(m);
          if (mon) this.tweens.add({ targets: mon, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
        } else {
          this.say(tx, ty - 8, '효과 없음', COLOR.fxNoeffect, 6);
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
      .text(x, y, text, { fontFamily: FONT, fontSize: '48px', color, stroke: COLOR.ink, strokeThickness: 10 })
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
    const top = 62; // 위 HUD
    // 맵 아래 도크(.dock) 자리. 도크는 재생 조작·결과가 나오면 커지는데, 그때 맵이 움직이거나
    // 가려지지 않도록 가장 클 때의 높이만큼을 늘 비워 둔다
    const bottom = 184;
    // 위·왼쪽 좌표 번호가 들어갈 자리(1칸)와 약간의 여백까지 함께 맞춘다
    const zx = (w - 32) / ((this.level.width + 1.5) * T);
    const zy = (h - top - bottom) / ((this.level.height + 1.25) * T);
    const z = Math.max(1, Math.min(7, Math.floor(Math.min(zx, zy))));
    const zoomChanged = cam.zoom !== z;
    cam.setZoom(z);
    cam.centerOn((this.level.width * T) / 2 - T / 2, (this.level.height * T) / 2 - T / 2 - (top - bottom) / (2 * z));
    this.drawGuides(z);
    // 글자·말풍선 크기는 배율에 맞춰 만들었으므로, 배율이 바뀌면 지금 장면을 다시 그린다
    if (zoomChanged && this.board) this.drawObjects(this.board, this.lastDraw.plan, this.lastDraw.last);
  }

  /**
   * 칸 세기를 돕는 옅은 격자와 좌표 번호 (get_pos() 와 같은 0부터 시작하는 x, y).
   * 글자 크기를 화면 기준으로 맞추므로 확대 배율이 바뀔 때마다 다시 그린다.
   */
  private drawGuides(z: number) {
    this.guideLayer?.destroy(true);
    this.guideLayer = this.add.container(0, 0).setDepth(1); // 바닥 위, 캐릭터 아래
    if (!this.level || !uiStore.get().showGrid) return;
    const { width, height, terrain } = this.level;

    // 1px 선은 픽셀 확대에서 군데군데 사라지므로, 바닥 칸을 체스판처럼 번갈아 살짝 어둡게 칠한다
    const g = this.add.graphics();
    g.fillStyle(hex(COLOR.dungeon), 0.13);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) if (terrain[y][x] !== 'wall' && (x + y) % 2 === 0) g.fillRect(x * T, y * T, T, T);
    this.guideLayer.add(g);

    const label = (x: number, y: number, text: string) =>
      this.add
        .text(x, y, text, { fontFamily: FONT, fontSize: '48px', color: COLOR.lavender, stroke: COLOR.dungeon, strokeThickness: 8 })
        .setOrigin(0.5)
        .setScale(16 / 48 / z);
    for (let x = 0; x < width; x++) this.guideLayer.add(label(cx(x), -T / 2, String(x)));
    for (let y = 0; y < height; y++) this.guideLayer.add(label(-T / 2, cy(y), String(y)));
    this.guideLayer.add(label(-T / 2, -T / 2, 'y\\x').setColor(COLOR.dusk));
  }
}

let activeScene: GridScene | null = null;

/** 화면(브라우저 좌표)에서 맵이 차지하는 사각형 (좌표 번호 줄 포함). 튜토리얼이 맵을 강조할 때 쓴다 */
export function mapScreenRect(): { left: number; top: number; width: number; height: number } | null {
  const sc = activeScene;
  const level = gameStore.get().levels[0];
  if (!sc || !level || !sc.sys.isActive()) return null;
  const cam = sc.cameras.main;
  const box = sc.game.canvas.getBoundingClientRect();
  const k = (box.width / sc.scale.width) * cam.zoom; // 월드 1px → 화면 px
  const left = box.left + (-T - cam.worldView.x) * k;
  const top = box.top + (-T - cam.worldView.y) * k;
  return { left, top, width: (level.width + 1) * T * k, height: (level.height + 1) * T * k };
}

const ids = new WeakMap<object, number>();
let nextId = 1;
function resultId(r: object | null) {
  if (!r) return 0;
  if (!ids.has(r)) ids.set(r, nextId++);
  return ids.get(r)!;
}

/** 말풍선용: 파이썬이 print 하는 모양 그대로 (문자열은 '12', 리스트는 [...]). 긴 리스트는 줄을 나눈다 */
export function formatValue(v: SignValue): string {
  const one = (x: string | number) => (typeof x === 'string' ? `'${x}'` : String(x));
  if (!Array.isArray(v)) return one(v);
  const perLine = 5;
  const lines: string[] = [];
  for (let i = 0; i < v.length; i += perLine) lines.push(v.slice(i, i + perLine).map(one).join(', '));
  return '[' + lines.join(',\n ') + ']';
}

const SKILL_KO: Record<string, string> = { fireball: '불', icebolt: '얼음', lightning: '번개' };

/** scan 말풍선: 파이썬 객체처럼 속성을 줄마다 */
export function formatMonster(m: MonsterInfo): string {
  return `${m.kind}  hp ${m.hp}/${m.max_hp}\n약점 ${m.weak} (${SKILL_KO[m.weak] ?? ''})`;
}

/** 발판: 바닥에 박힌 돌판 (눌리면 금빛 테두리를 위에 겹친다) */
function makePlateTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('plate')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x353541).fillRect(2, 2, 12, 12);
  g.fillStyle(0x8d8aa6).fillRect(3, 3, 10, 10);
  g.fillStyle(0xb4b0cf).fillRect(3, 3, 10, 2);
  g.fillStyle(0x6b6884).fillRect(5, 7, 6, 4);
  g.generateTexture('plate', T, T);
  g.clear();
  g.lineStyle(1, 0xffc533).strokeRect(2.5, 2.5, 11, 11);
  g.fillStyle(0xffe07a, 0.55).fillRect(5, 7, 6, 4);
  g.generateTexture('platePressed', T, T);
  g.destroy();
}

/** 창살: 쇠막대 4개 + 가로대 (Kenney 팔레트) */
function makeBarsTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('bars')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x353541).fillRect(0, 2, 16, 2).fillRect(0, 12, 16, 2);
  g.fillStyle(0x8d8aa6).fillRect(0, 2.5, 16, 1).fillRect(0, 12.5, 16, 1);
  for (const x of [1, 5, 9, 13]) {
    g.fillStyle(0x353541).fillRect(x, 0, 3, 16);
    g.fillStyle(0xcfc8e6).fillRect(x + 1, 0, 1, 16);
  }
  g.generateTexture('bars', T, T);
  g.destroy();
}

/** 비밀 문 자물쇠 (보라 몸통 + 금색 고리, Kenney 팔레트 외곽선) */
function makeLockTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('lock')) return;
  const px = [
    '.....####.....',
    '....#yyyy#....',
    '...#y#..#y#...',
    '...#y#..#y#...',
    '..##########..',
    '..#pppppppp#..',
    '..#pppyyppp#..',
    '..#ppp##ppp#..',
    '..#pppppppp#..',
    '..##########..',
  ];
  const col: Record<string, number> = { '#': 0x353541, y: 0xffc533, p: 0x9b6bff };
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  px.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== '.') g.fillStyle(col[c]).fillRect(x + 1, y + 3, 1, 1);
    }),
  );
  g.generateTexture('lock', T, T);
  g.destroy();
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
      g.fillStyle(c === '#' ? hex(COLOR.ink) : hex(COLOR.gold)).fillRect(x, y + 2, 1, 1);
    }),
  );
  g.generateTexture('key', T, T);
  g.destroy();
}
