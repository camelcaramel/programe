import Phaser from 'phaser';
import { PLAYER_BASE, xpToNext } from '../data';

const SPEED = 300;
const JUMP = 720;
// 점프를 타이트하게: 상승(키 유지) < 하강 < 상승 중 키를 뗄 때(점프 컷) 순으로 중력을 더한다
const EXTRA_G_RISE = 300;
const EXTRA_G_FALL = 1200;
const EXTRA_G_CUT = 1500;
const COYOTE_MS = 80;
const JUMP_BUFFER_MS = 100;
const ATTACK_MS = 180;
const ATTACK_COOLDOWN = 380;
const HURT_INVINCIBLE_MS = 900;
const HURT_STUN_MS = 220;

export type Keys = Record<'left' | 'right' | 'jump' | 'attack', Phaser.Input.Keyboard.Key[]>;

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = PLAYER_BASE.hp;
  maxHp = PLAYER_BASE.hp;
  mp = PLAYER_BASE.mp;
  maxMp = PLAYER_BASE.mp;
  level = 1;
  xp = 0;
  attackPower = PLAYER_BASE.attack;
  /** 공격 판정 영역 */
  readonly attackBox: Phaser.GameObjects.Zone;
  /** 공격마다 1씩 증가 — 한 번의 공격이 같은 적을 여러 번 때리지 않게 한다 */
  attackId = 0;
  moved = false;
  jumped = false;
  controlsEnabled = true;

  private attackUntil = 0;
  private nextAttack = 0;
  private walkFrame = 0;
  private walkTimer = 0;
  private lastGrounded = 0;
  private jumpPressedAt = -1000;
  private invincibleUntil = 0;
  private stunUntil = 0;
  private slash: Phaser.GameObjects.Graphics;
  private jumpQueued = false;
  private attackQueued = false;

  constructor(scene: Phaser.Scene, x: number, y: number, private keys: Keys) {
    super(scene, x, y, 'characters', 'character_beige_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);

    this.setScale(0.7); // 128px 프레임 -> 약 90px
    this.setCollideWorldBounds(true);
    // 바디는 원본 프레임 기준 좌표
    (this.body as Phaser.Physics.Arcade.Body).setSize(64, 110).setOffset(32, 18);

    this.attackBox = scene.add.zone(x, y, 72, 72);
    scene.physics.add.existing(this.attackBox);
    const box = this.attackBox.body as Phaser.Physics.Arcade.Body;
    box.setAllowGravity(false);
    box.enable = false;

    this.slash = scene.add.graphics().setDepth(11);

    // 아주 짧게 톡 친 입력도 놓치지 않도록 키다운 이벤트로 기록한다
    for (const key of keys.jump) key.on('down', () => (this.jumpQueued = true));
    for (const key of keys.attack) key.on('down', () => (this.attackQueued = true));
  }

  get facing() {
    return this.flipX ? -1 : 1;
  }
  get isAttacking() {
    return this.scene.time.now < this.attackUntil;
  }
  get isInvincible() {
    return this.scene.time.now < this.invincibleUntil;
  }
  get isDead() {
    return this.hp <= 0;
  }

  update(time: number, delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const can = this.controlsEnabled && !this.isDead;
    const down = (ks: Phaser.Input.Keyboard.Key[]) => can && ks.some((k) => k.isDown);
    const jumpPressed = can && this.jumpQueued;
    const attackPressed = can && this.attackQueued;
    this.jumpQueued = this.attackQueued = false;
    const stunned = time < this.stunUntil;

    // MP 자연 회복
    this.mp = Math.min(this.maxMp, this.mp + (PLAYER_BASE.mpRegen * delta) / 1000);

    // 이동
    const dir = (down(this.keys.right) ? 1 : 0) - (down(this.keys.left) ? 1 : 0);
    if (!stunned) {
      body.setVelocityX(dir * SPEED);
      if (dir !== 0) {
        this.setFlipX(dir < 0);
        this.moved = true;
      }
    }

    // 점프 (코요테 타임 + 입력 버퍼)
    if (body.blocked.down) this.lastGrounded = time;
    if (jumpPressed) this.jumpPressedAt = time;
    if (!stunned && time - this.jumpPressedAt <= JUMP_BUFFER_MS && time - this.lastGrounded <= COYOTE_MS) {
      body.setVelocityY(-JUMP);
      this.jumpPressedAt = -1000;
      this.lastGrounded = -1000;
      this.jumped = true;
      this.scene.sound.play('sfx_jump', { volume: 0.3 });
    }
    // 가변 중력: 올라갈 땐 가볍게, 내려올 땐 빠르게, 키를 떼면 점프 컷
    const holdingJump = down(this.keys.jump);
    if (body.velocity.y > 0) body.setGravityY(EXTRA_G_FALL);
    else body.setGravityY(holdingJump ? EXTRA_G_RISE : EXTRA_G_CUT);

    // 기본 공격
    if (attackPressed && time >= this.nextAttack) {
      this.attackUntil = time + ATTACK_MS;
      this.nextAttack = time + ATTACK_COOLDOWN;
      this.attackId++;
      this.scene.sound.play('sfx_throw', { volume: 0.3 });
    }
    this.updateAttackBox();
    this.drawSlash(time);

    // 피격 무적 깜빡임
    this.setAlpha(this.isInvincible && !this.isDead ? (Math.floor(time / 70) % 2 ? 0.35 : 1) : 1);

    // 애니메이션(프레임 교체)
    let frame = 'character_beige_idle';
    if (this.isDead || stunned) frame = 'character_beige_hit';
    else if (this.isAttacking) frame = 'character_beige_walk_b';
    else if (!body.blocked.down) frame = 'character_beige_jump';
    else if (dir !== 0) {
      this.walkTimer += delta;
      if (this.walkTimer > 110) {
        this.walkTimer = 0;
        this.walkFrame ^= 1;
      }
      frame = this.walkFrame ? 'character_beige_walk_b' : 'character_beige_walk_a';
    }
    this.setFrame(frame);
  }

  /** 피해를 받는다. 무적이면 false */
  hurt(amount: number, fromX: number): boolean {
    if (this.isInvincible || this.isDead) return false;
    const now = this.scene.time.now;
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleUntil = now + HURT_INVINCIBLE_MS;
    this.stunUntil = now + HURT_STUN_MS;
    const away = this.x < fromX ? -1 : 1;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(away * 280, -320);
    return true;
  }

  heal(amount: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return Math.round(this.hp - before);
  }

  /** 경험치를 얻고, 레벨업한 횟수를 돌려준다 */
  gainXp(amount: number): number {
    this.xp += amount;
    let ups = 0;
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      this.level++;
      this.maxHp += 15;
      this.maxMp += 10;
      this.attackPower += 3;
      this.hp = this.maxHp;
      this.mp = this.maxMp;
      ups++;
    }
    return ups;
  }

  /** 스킬 위력 배율 (레벨이 오를수록 강해진다) */
  get skillPower() {
    return 1 + (this.level - 1) * 0.1;
  }

  respawn(x: number, y: number) {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.setPosition(x, y);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.invincibleUntil = this.scene.time.now + 2000;
    this.stunUntil = 0;
  }

  private updateAttackBox() {
    const box = this.attackBox.body as Phaser.Physics.Arcade.Body;
    box.enable = this.isAttacking;
    this.attackBox.setPosition(this.x + this.facing * 50, this.y + 4);
    box.updateFromGameObject();
  }

  /** 공격 시 앞쪽에 반달 모양 베기 이펙트 */
  private drawSlash(time: number) {
    this.slash.clear();
    if (!this.isAttacking) return;
    const t = 1 - (this.attackUntil - time) / ATTACK_MS; // 0 → 1
    const cx = this.x + this.facing * 18;
    const cy = this.y + 4;
    const r = 52;
    const start = Phaser.Math.DegToRad(-70 + t * 40);
    const end = Phaser.Math.DegToRad(70);
    this.slash.lineStyle(10 * (1 - t) + 2, 0xffffff, 0.85 * (1 - t) + 0.15);
    this.slash.beginPath();
    if (this.facing > 0) this.slash.arc(cx, cy, r, start, end, false);
    else this.slash.arc(cx, cy, r, Math.PI - start, Math.PI - end, true);
    this.slash.strokePath();
  }

  destroy(fromScene?: boolean) {
    this.slash?.destroy();
    this.attackBox?.destroy();
    super.destroy(fromScene);
  }
}
