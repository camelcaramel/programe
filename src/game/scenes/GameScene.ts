import Phaser from 'phaser';
import { Player, type Keys } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { MISSIONS, MONSTERS, xpToNext, type Element, type MonsterKind } from '../data';
import { SkillSystem } from '../systems/SkillSystem';
import { burst, floatText, makeDotTexture, makeExtrudedTileset } from '../systems/effects';
import { eventBus } from '../../bridge/eventBus';
import { gameStore, initialGameState, isTyping, toast, type GameState } from '../../state/store';

const SHEET = 'assets/kenney/platformer/Spritesheets/';
const BG = 'assets/kenney/platformer/Sprites/Backgrounds/Default/';
const TILE = 64;

type TiledObj = Phaser.Types.Tilemaps.TiledObject;
const prop = (o: TiledObj, name: string) => (o.properties as { name: string; value: unknown }[] | undefined)?.find((p) => p.name === name)?.value;

export class GameScene extends Phaser.Scene {
  player!: Player;
  monsters!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  ground!: Phaser.Tilemaps.TilemapLayer;
  skills!: SkillSystem;
  /** 씬이 재시작될 때마다 증가 — 비동기 코드 실행 결과가 이전 판에 적용되지 않게 한다 */
  generation = 0;

  private spawn = { x: 200, y: 600 };
  private gate!: Phaser.Physics.Arcade.StaticGroup;
  private wasTyping = false;
  private lastSync = 0;
  private dying = false;

  constructor() {
    super('Game');
  }

  preload() {
    for (const s of ['characters', 'tiles', 'enemies']) {
      this.load.atlasXML(s, `${SHEET}spritesheet-${s}-default.png`, `${SHEET}spritesheet-${s}-default.xml`);
    }
    this.load.image('tilesheet', SHEET + 'spritesheet-tiles-default.png');
    this.load.image('bg_hills', BG + 'background_color_hills.png');
    this.load.image('bg_clouds', BG + 'background_clouds.png');
    this.load.tilemapTiledJSON('dungeon', 'maps/dungeon.json');
    for (const s of ['jump', 'throw', 'hurt', 'magic', 'coin', 'gem', 'bump', 'disappear', 'select', 'jump-high']) {
      this.load.audio(`sfx_${s}`, `assets/kenney/audio/sfx_${s}.ogg`);
    }
  }

  create() {
    this.generation++;
    this.dying = false;
    this.wasTyping = false;
    makeDotTexture(this);
    makeExtrudedTileset(this, 'tilesheet', 'tilesheet_ex');

    // ---------- 맵 (scripts/generateMap.mjs 로 생성, Tiled 로 수정 가능) ----------
    const map = this.make.tilemap({ key: 'dungeon' });
    const tileset = map.addTilesetImage('tiles', 'tilesheet_ex', TILE, TILE, 2, 4)!;
    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.createBackground(worldW, worldH);
    map.createLayer('decor', tileset)!.setDepth(2);
    this.ground = map.createLayer('ground', tileset)!.setDepth(3);
    this.ground.setCollisionByExclusion([-1]);
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // ---------- 입력 (캡처하지 않음: 에디터 타이핑을 방해하지 않도록) ----------
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = this.input.keyboard!;
    const k = (...codes: number[]) => codes.map((c) => kb.addKey(c, false));
    const keys: Keys = { left: k(K.LEFT, K.A), right: k(K.RIGHT, K.D), jump: k(K.UP, K.W, K.SPACE), attack: k(K.J, K.Z) };
    [k(K.ONE, K.NUMPAD_ONE), k(K.TWO, K.NUMPAD_TWO), k(K.THREE, K.NUMPAD_THREE)].forEach((ks, i) =>
      ks.forEach((key) => key.on('down', () => {
        if (!isTyping()) this.skills.trigger(i);
      })),
    );

    // ---------- 오브젝트 ----------
    const objs = map.getObjectLayer('spawns')!.objects;
    const ps = objs.find((o) => o.type === 'player')!;
    this.spawn = { x: ps.x!, y: ps.y! - 50 };
    this.player = new Player(this, this.spawn.x, this.spawn.y, keys);

    this.monsters = this.physics.add.group();
    this.projectiles = this.physics.add.group({ allowGravity: false });
    const coins = this.physics.add.staticGroup();
    const hearts = this.physics.add.staticGroup();
    this.gate = this.physics.add.staticGroup();
    let goal: Phaser.GameObjects.Sprite | null = null;

    for (const o of objs) {
      if (o.type === 'monster') this.monsters.add(new Monster(this, o.x!, o.y!, prop(o, 'kind') as MonsterKind));
      if (o.type === 'coin') {
        const c = coins.create(o.x!, o.y! - 32, 'tiles', 'coin_gold') as Phaser.Physics.Arcade.Image;
        c.setScale(0.6).refreshBody().setDepth(5);
        this.tweens.add({ targets: c, y: c.y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * 500 });
      }
      if (o.type === 'heart') {
        const h = hearts.create(o.x!, o.y! - 32, 'tiles', 'heart') as Phaser.Physics.Arcade.Image;
        h.setScale(0.6).refreshBody().setDepth(5);
        this.tweens.add({ targets: h, scale: 0.68, duration: 500, yoyo: true, repeat: -1 });
      }
      if (o.type === 'gate') {
        for (let i = 0; i < 4; i++) {
          (this.gate.create(o.x!, o.y! - TILE / 2 - i * TILE, 'tiles', 'block_strong_danger') as Phaser.Physics.Arcade.Image).setDepth(4);
        }
      }
      if (o.type === 'goal') {
        goal = this.add.sprite(o.x!, o.y! - TILE / 2, 'tiles', 'flag_green_a').setDepth(4);
        this.physics.add.existing(goal, true);
      }
    }
    const flag = goal;
    if (flag) {
      this.time.addEvent({ delay: 260, loop: true, callback: () => flag.setFrame(flag.frame.name === 'flag_green_a' ? 'flag_green_b' : 'flag_green_a') });
    }

    // ---------- 충돌/겹침 ----------
    type Obj = unknown;
    const asImg = (o: Obj) => o as unknown as Phaser.Physics.Arcade.Image;
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.monsters, this.ground);
    this.physics.add.collider(this.player, this.gate);
    this.physics.add.collider(this.monsters, this.gate);
    this.physics.add.collider(this.projectiles, this.ground, (proj) => this.explodeProjectile(asImg(proj)));
    this.physics.add.collider(this.projectiles, this.gate, (proj) => this.explodeProjectile(asImg(proj)));

    this.physics.add.overlap(this.player, this.monsters, (_p, m) => this.onContact(m as unknown as Monster));
    this.physics.add.overlap(this.player.attackBox, this.monsters, (_b, m) => this.onMelee(m as unknown as Monster));
    this.physics.add.overlap(this.projectiles, this.monsters, (proj, m) => this.onProjectileHit(asImg(proj), m as unknown as Monster));
    this.physics.add.overlap(this.player, coins, (_p, c) => {
      const coin = asImg(c);
      burst(this, coin.x, coin.y, 0xffd84a, 8, 90);
      floatText(this, coin.x, coin.y - 10, '+3G', '#ffd84a', 16);
      coin.destroy();
      this.sound.play('sfx_coin', { volume: 0.3 });
      gameStore.set((s) => ({ gold: s.gold + 3 }));
    });
    this.physics.add.overlap(this.player, hearts, (_p, h) => {
      const heart = asImg(h);
      const healed = this.player.heal(30);
      floatText(this, heart.x, heart.y - 10, `+${healed} HP`, '#7dff9a', 18);
      burst(this, heart.x, heart.y, 0xff6b8a, 12, 100);
      heart.destroy();
      this.sound.play('sfx_gem', { volume: 0.35 });
    });
    if (flag) this.physics.add.overlap(this.player, flag, () => this.onGoal());

    // ---------- 카메라 ----------
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 40);
    cam.setDeadzone(120, 140);
    // 화면이 맵보다 커서 맵 밖이 보이지 않도록 줌을 맞춘다. 기본 1.4배.
    const fit = () => cam.setZoom(Math.max(1.4, this.scale.height / worldH, this.scale.width / worldW));
    fit();
    this.scale.on('resize', fit);

    this.skills = new SkillSystem(this);

    // ---------- React 와 연결 ----------
    const solid = new Uint8Array(map.width * map.height);
    this.ground.forEachTile((t) => {
      if (t.index !== -1) solid[t.y * map.width + t.x] = 1;
    });
    gameStore.set({ map: { cols: map.width, rows: map.height, tile: TILE, solid } });
    this.syncStats(true);

    const onSlot = (i: number) => this.skills.trigger(i);
    const onStart = () => this.begin();
    const onRespawn = () => this.respawn();
    const onRestart = () => {
      gameStore.set({ ...initialGameState(), phase: 'playing', startedAt: Date.now() });
      this.scene.restart();
    };
    eventBus.on('slot:trigger', onSlot);
    eventBus.on('game:start', onStart);
    eventBus.on('game:respawn', onRespawn);
    eventBus.on('game:restart', onRestart);
    this.events.once('shutdown', () => {
      eventBus.off('slot:trigger', onSlot);
      eventBus.off('game:start', onStart);
      eventBus.off('game:respawn', onRespawn);
      eventBus.off('game:restart', onRestart);
      this.scale.off('resize', fit);
    });

    if (gameStore.get().phase !== 'playing') this.physics.pause();
  }

  private createBackground(worldW: number, worldH: number) {
    // 배경 이미지 맨 윗줄 색으로 하늘을 채워 경계가 보이지 않게
    const c = this.textures.getPixel(4, 2, 'bg_hills');
    if (c) this.cameras.main.setBackgroundColor(c.color);
    const scale = 2.5;
    const h = 256 * scale;
    this.add.tileSprite(0, worldH - h - TILE, worldW, h, 'bg_hills').setOrigin(0).setTileScale(scale).setScrollFactor(0.35, 1).setDepth(0);
    this.add.tileSprite(0, 30, worldW, 256 * 1.6, 'bg_clouds').setOrigin(0).setTileScale(1.6).setScrollFactor(0.15, 1).setDepth(1).setAlpha(0.9);
  }

  update(time: number, delta: number) {
    // 에디터/입력창에 타이핑 중이면 게임 키 입력 끄기
    const typing = isTyping();
    if (typing !== this.wasTyping) {
      this.wasTyping = typing;
      this.input.keyboard!.enabled = !typing;
      this.input.keyboard!.resetKeys();
    }

    if (gameStore.get().phase !== 'playing') return;

    this.player.update(time, delta);
    for (const m of [...this.monsters.getChildren()] as Monster[]) m.update(time, delta, this.player, this.ground);

    if (this.player.moved && this.player.jumped) this.completeMission('move');
    if (this.player.isDead && !this.dying) this.onDeath();
    const withPos = time - this.lastSync > 100;
    if (withPos) this.lastSync = time;
    this.syncStats(withPos);
  }

  // ================= 전투 =================

  /** 코드 스킬의 대상: 가까운 적 (바라보는 방향 우선) */
  findTarget(): Monster | null {
    let best: Monster | null = null;
    let bestScore = Infinity;
    for (const m of this.monsters.getChildren() as Monster[]) {
      if (m.dead || !m.active) continue;
      const dx = m.x - this.player.x;
      const dy = m.y - this.player.y;
      if (Math.abs(dx) > 640 || Math.abs(dy) > 300) continue;
      const behind = Math.sign(dx) !== this.player.facing && Math.abs(dx) > 20;
      const score = Math.hypot(dx, dy) + (behind ? 260 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  private onContact(m: Monster) {
    if (m.dead || this.player.isDead) return;
    if (this.player.hurt(m.def.contact, m.x)) {
      floatText(this, this.player.x, this.player.y - 60, `-${m.def.contact}`, '#ff6b6b', 24);
      this.cameras.main.shake(120, 0.004);
      this.sound.play('sfx_hurt', { volume: 0.4 });
    }
  }

  private onMelee(m: Monster) {
    if (m.dead || m.lastAttackId === this.player.attackId) return;
    m.lastAttackId = this.player.attackId;
    this.hitMonster(m, this.player.attackPower, 'physical', this.player.x);
  }

  private onProjectileHit(proj: Phaser.Physics.Arcade.Image, m: Monster) {
    if (!proj.active || m.dead) return;
    this.hitMonster(m, proj.getData('damage'), proj.getData('element'), proj.x);
    this.explodeProjectile(proj);
  }

  explodeProjectile(proj: Phaser.Physics.Arcade.Image) {
    if (!proj.active) return;
    const fire = proj.getData('skill') === 'fireball';
    burst(this, proj.x, proj.y, fire ? 0xff8a3d : 0x8fe0ff, 16, 180);
    (proj.getData('trail') as Phaser.GameObjects.Particles.ParticleEmitter | undefined)?.destroy();
    proj.destroy();
  }

  private hitMonster(m: Monster, base: number, element: Element, fromX: number) {
    const r = m.damage(base, element, fromX);
    const top = m.y - m.displayHeight / 2;
    const color = r.mult > 1 ? '#ffe14d' : r.mult < 1 ? '#b7bfd1' : '#ffffff';
    floatText(this, m.x, top - 10, `${r.amount}`, color, r.mult > 1 ? 28 : 22);
    if (r.mult > 1) floatText(this, m.x, top - 40, '약점!', '#ffe14d', 16);
    else if (r.mult < 1) floatText(this, m.x, top - 40, '효과가 별로…', '#b7bfd1', 14);
    this.sound.play('sfx_bump', { volume: 0.25 });
    if (r.killed) this.onKill(m);
  }

  private onKill(m: Monster) {
    const def = MONSTERS[m.kind];
    this.sound.play('sfx_disappear', { volume: 0.35 });
    burst(this, m.x, m.y, 0xffffff, 18, 200);
    floatText(this, m.x, m.y - 50, `+${def.gold}G  +${def.xp}XP`, '#ffd84a', 16);
    gameStore.set((s) => ({ kills: s.kills + 1, gold: s.gold + def.gold }));
    this.giveXp(def.xp);
    if (m.kind === 'slime') this.completeMission('slime');
    if (m.kind === 'fly') this.completeMission('fly');
    if (m.kind === 'golem') {
      this.completeMission('golem');
      this.openGate();
    }
  }

  private giveXp(xp: number) {
    const ups = this.player.gainXp(xp);
    if (ups > 0) {
      this.sound.play('sfx_jump-high', { volume: 0.4 });
      floatText(this, this.player.x, this.player.y - 90, 'LEVEL UP!', '#7dd3ff', 26);
      burst(this, this.player.x, this.player.y, 0x7dd3ff, 30, 220);
      toast(`레벨 업! Lv.${this.player.level} · HP/MP 증가, 스킬 위력 +10%`, 'good');
    }
  }

  private openGate() {
    gameStore.set({ gateOpen: true });
    this.time.delayedCall(500, () => {
      this.sound.play('sfx_disappear', { volume: 0.5 });
      this.cameras.main.shake(300, 0.006);
      for (const b of [...this.gate.getChildren()] as Phaser.Physics.Arcade.Image[]) {
        (b.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        burst(this, b.x, b.y, 0xff9f43, 10, 140);
        this.tweens.add({ targets: b, alpha: 0, y: b.y + 20, duration: 400, onComplete: () => b.destroy() });
      }
      toast('쿠구궁… 문이 열렸어요! 깃발로 가세요', 'good');
    });
  }

  completeMission(id: string) {
    const s = gameStore.get();
    if (s.missionsDone.includes(id)) return;
    const mission = MISSIONS.find((m) => m.id === id);
    if (!mission) return;
    gameStore.set({ missionsDone: [...s.missionsDone, id], gold: s.gold + 10 });
    if (id !== 'goal') {
      toast(`미션 완료: ${mission.title}  (+10G)`, 'good');
      this.sound.play('sfx_gem', { volume: 0.35 });
      this.giveXp(15);
    }
  }

  // ================= 진행 =================

  private begin() {
    if (gameStore.get().phase !== 'title') return;
    gameStore.set({ phase: 'playing', startedAt: Date.now() });
    this.physics.resume();
    this.sound.play('sfx_select', { volume: 0.4 });
  }

  private onDeath() {
    this.dying = true;
    this.sound.play('sfx_hurt', { volume: 0.5 });
    this.cameras.main.shake(250, 0.008);
    const gen = this.generation;
    this.time.delayedCall(900, () => {
      if (gen !== this.generation) return;
      gameStore.set((s) => ({ phase: 'dead', deaths: s.deaths + 1 }));
      this.physics.pause();
    });
  }

  private respawn() {
    if (gameStore.get().phase !== 'dead') return;
    this.player.respawn(this.spawn.x, this.spawn.y);
    this.dying = false;
    this.physics.resume();
    gameStore.set({ phase: 'playing' });
  }

  private onGoal() {
    if (gameStore.get().phase !== 'playing') return;
    this.completeMission('goal');
    this.sound.play('sfx_jump-high', { volume: 0.5 });
    burst(this, this.player.x, this.player.y, 0xffe14d, 40, 260);
    this.physics.pause();
    gameStore.set({ phase: 'victory', endedAt: Date.now() });
  }

  private syncStats(withPositions: boolean) {
    const p = this.player;
    const patch: Partial<GameState> = {
      hp: Math.ceil(p.hp),
      maxHp: p.maxHp,
      mp: Math.floor(p.mp),
      maxMp: p.maxMp,
      level: p.level,
      xp: p.xp,
      xpNext: xpToNext(p.level),
    };
    if (withPositions) {
      patch.player = { x: p.x, y: p.y };
      patch.monsters = (this.monsters.getChildren() as Monster[]).filter((m) => !m.dead).map((m) => ({ x: m.x, y: m.y, kind: m.kind }));
    }
    gameStore.set(patch);
  }
}
