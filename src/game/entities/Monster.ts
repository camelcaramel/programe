import Phaser from 'phaser';
import { MONSTERS, type Element, type MonsterDef, type MonsterKind } from '../data';

export interface DamageResult { amount: number; mult: number; killed: boolean }

export class Monster extends Phaser.Physics.Arcade.Sprite {
  readonly def: MonsterDef;
  hp: number;
  dead = false;
  lastAttackId = -1;
  private dir = -1;
  private homeX: number;
  private homeY: number;
  private slowUntil = 0;
  private stunUntil = 0;
  private animTimer = 0;
  private animFrame = 0;
  private nextJump = 0;
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private seed = Math.random() * 1000;

  constructor(scene: Phaser.Scene, x: number, bottomY: number, readonly kind: MonsterKind) {
    const def = MONSTERS[kind];
    super(scene, x, bottomY, 'enemies', def.walk[0]);
    this.def = def;
    this.hp = def.hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(def.scale).setDepth(8);
    this.y = bottomY - this.displayHeight / 2;
    this.homeX = x;
    this.homeY = this.y;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (kind === 'slime') body.setSize(52, 36).setOffset(6, 28);
    if (kind === 'golem') body.setSize(52, 46).setOffset(6, 18);
    if (kind === 'fly') {
      body.setSize(44, 34).setOffset(10, 16);
      body.setAllowGravity(false);
    }

    this.bar = scene.add.graphics().setDepth(20);
    // 학생이 enemy.type 값을 눈으로 익힐 수 있도록 영문 type 을 머리 위에 표시
    this.label = scene.add
      .text(x, this.y, kind, { fontFamily: 'Consolas, "D2Coding", monospace', fontSize: '13px', color: '#fff8ea', backgroundColor: '#353541d9', padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setResolution(2);
  }

  get slowed() {
    return this.scene.time.now < this.slowUntil;
  }

  update(time: number, delta: number, player: Phaser.Physics.Arcade.Sprite, ground: Phaser.Tilemaps.TilemapLayer) {
    if (this.dead) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const sees = Math.abs(dx) < this.def.sight && Math.abs(dy) < 220;
    const speed = this.def.speed * (this.slowed ? 0.35 : 1);
    const stunned = time < this.stunUntil;

    if (this.kind === 'fly') {
      const bob = Math.sin((time + this.seed) / 260) * 40;
      let tx: number, ty: number;
      if (sees) {
        tx = player.x;
        ty = player.y - 30 + bob;
      } else {
        tx = this.homeX + Math.sin((time + this.seed) / 1400) * 120;
        ty = this.homeY + bob;
      }
      if (!stunned) {
        const v = new Phaser.Math.Vector2(tx - this.x, ty - this.y);
        if (v.length() > 4) v.normalize().scale(speed);
        else v.set(0, 0);
        body.setVelocity(v.x, v.y);
      }
      if (Math.abs(body.velocity.x) > 5) this.setFlipX(body.velocity.x > 0);
    } else if (!stunned && body.blocked.down) {
      if (sees && Math.abs(dx) > 8) {
        this.dir = Math.sign(dx);
      } else if (!sees) {
        // 순찰: 벽이나 낭떠러지를 만나면 돌아선다
        const aheadX = this.x + this.dir * (body.width / 2 + 6);
        const footY = body.bottom + 8;
        const wall = this.dir < 0 ? body.blocked.left : body.blocked.right;
        if (wall || !ground.getTileAtWorldXY(aheadX, footY)) this.dir *= -1;
        else if (Math.abs(this.x - this.homeX) > 160) this.dir = this.x < this.homeX ? 1 : -1;
      }
      body.setVelocityX(this.dir * speed);
      this.setFlipX(this.dir > 0);
      // 골렘은 추격 중 가끔 쿵! 하고 뛰어오른다
      if (this.kind === 'golem' && sees && time > this.nextJump) {
        this.nextJump = time + 2600;
        body.setVelocityY(-520);
      }
    }

    // 걷기 애니메이션
    this.animTimer += delta;
    const animSpeed = this.kind === 'fly' ? 90 : 220;
    if (this.animTimer > animSpeed * (this.slowed ? 2 : 1)) {
      this.animTimer = 0;
      this.animFrame ^= 1;
    }
    let frame = this.def.walk[this.animFrame];
    if (this.kind === 'golem' && !body.blocked.down) frame = 'slime_block_jump';
    this.setFrame(frame);
    if (this.slowed) this.setTint(0x9fdcff);
    else if (this.tintTopLeft === 0x9fdcff) this.clearTint();

    this.drawUi();
  }

  /** 피해를 받는다 */
  damage(base: number, element: Element, fromX: number): DamageResult {
    const mult = this.def.resist[element];
    const amount = Math.max(1, Math.round(base * mult));
    this.hp = Math.max(0, this.hp - amount);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const away = this.x < fromX ? -1 : 1;
    const kb = this.kind === 'golem' ? 60 : 220;
    body.setVelocityX(away * kb);
    if (!this.def.flying && body.blocked.down) body.setVelocityY(this.kind === 'golem' ? 0 : -200);
    this.stunUntil = this.scene.time.now + (this.kind === 'golem' ? 80 : 260);
    if (element === 'ice') this.slowUntil = this.scene.time.now + 1800;

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      this.clearTint();
    });
    const killed = this.hp <= 0;
    if (killed) this.die();
    return { amount, mult, killed };
  }

  private die() {
    this.dead = true;
    this.setFrame(this.def.dead).clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.bar.destroy();
    this.label.destroy();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 10,
      duration: 600,
      delay: 250,
      onComplete: () => this.destroy(),
    });
  }

  private drawUi() {
    const top = this.y - this.displayHeight / 2 - 6;
    this.label.setPosition(this.x, top - 14);
    this.bar.clear();
    if (this.hp >= this.def.hp) return;
    const w = Math.max(44, this.displayWidth * 0.8);
    const x = this.x - w / 2;
    const y = top - 8;
    this.bar.fillStyle(0x353541, 1).fillRoundedRect(x - 2, y - 2, w + 4, 8, 4);
    this.bar.fillStyle(this.hp / this.def.hp > 0.35 ? 0x2ecc71 : 0xe54341, 1).fillRoundedRect(x, y, (w * this.hp) / this.def.hp, 4, 2);
  }

  destroy(fromScene?: boolean) {
    this.bar?.destroy();
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
