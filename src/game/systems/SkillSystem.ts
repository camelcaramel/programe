// 코드 스킬: 슬롯의 파이썬 코드를 실행하고, 돌아온 cast 명령을 게임 안에서 실제로 발동한다.
import Phaser from 'phaser';
import { SKILLS, type SkillName } from '../data';
import type { Monster } from '../entities/Monster';
import { python, type EnemyInfo } from '../../python/runner';
import { codeStore } from '../../state/codeStore';
import { gameStore, log, uiStore } from '../../state/store';
import { burst, floatText } from './effects';
import type { GameScene } from '../scenes/GameScene';

const SLOT_COOLDOWN_MS = 450;
const CAST_GAP_MS = 220;
const PROJECTILE_SPEED = 560;
const TILE = 64;

export class SkillSystem {
  private cooldownUntil = [0, 0, 0];
  readonly usedFromCode = new Set<SkillName>();

  constructor(private scene: GameScene) {}

  async trigger(slot: number) {
    const s = gameStore.get();
    if (s.phase !== 'playing' || s.slotBusy[slot]) return;
    const now = this.scene.time.now;
    if (now < this.cooldownUntil[slot]) return;
    this.cooldownUntil[slot] = now + SLOT_COOLDOWN_MS;

    const scene = this.scene;
    const gen = scene.generation;
    const p = scene.player;
    const target = scene.findTarget();
    const src = `슬롯 ${slot + 1}`;
    const code = codeStore.get().slots[slot].code;

    setBusy(slot, true);
    gameStore.set((st) => ({ codeRuns: st.codeRuns + 1 }));
    const res = await python.run({
      code,
      enemy: enemyInfo(target, p),
      player: { hp: Math.ceil(p.hp), mp: Math.floor(p.mp), max_hp: p.maxHp, max_mp: p.maxMp },
    });
    setBusy(slot, false);
    if (gen !== scene.generation || !p.active || p.isDead) return; // 그 사이 재시작/사망

    for (const line of res.out) log('out', line, src);
    if (!res.ok) {
      gameStore.set((st) => ({ codeErrors: st.codeErrors + 1 }));
      setSlotError(slot, { line: res.line ?? null, message: res.error ?? '알 수 없는 오류' });
      log('error', (res.line ? `${res.line}번째 줄 · ` : '') + res.error, src);
      floatText(scene, p.x, p.y - 70, '코드 오류!', '#ff7a7a', 20);
      scene.sound.play('sfx_bump', { volume: 0.4 });
      return;
    }
    setSlotError(slot, null);
    if (res.casts.length === 0) {
      log('info', 'cast() 가 실행되지 않았어요. 조건문을 확인해 보세요.', src);
      floatText(scene, p.x, p.y - 70, '…', '#d0d6e6', 22);
      return;
    }
    log('cast', res.casts.map((c) => `cast("${c}")`).join('  →  '), src);
    gameStore.set((st) => ({ slotLastCasts: st.slotLastCasts.map((c, j) => (j === slot ? res.casts : c)) }));
    res.casts.forEach((name, i) => {
      scene.time.delayedCall(i * CAST_GAP_MS, () => {
        if (gen === scene.generation) this.cast(name, target, src);
      });
    });
  }

  private cast(name: SkillName, target: Monster | null, src: string) {
    const scene = this.scene;
    const p = scene.player;
    const def = SKILLS[name];
    if (p.isDead) return;
    if (p.mp < def.mp) {
      floatText(scene, p.x, p.y - 70, 'MP 부족', '#7ab8ff', 20);
      log('info', `MP 가 부족해서 ${name} 을(를) 쓰지 못했어요 (필요 MP ${def.mp})`, src);
      return;
    }
    p.mp -= def.mp;
    gameStore.set((st) => ({ casts: st.casts + 1 }));
    this.usedFromCode.add(name);
    scene.completeMission('code');
    if (this.usedFromCode.has('fireball') && this.usedFromCode.has('icebolt')) scene.completeMission('branch');
    scene.sound.play('sfx_magic', { volume: 0.35 });

    if (name === 'heal') {
      const healed = p.heal(Math.round(def.power * p.skillPower));
      floatText(scene, p.x, p.y - 60, `+${healed}`, '#7dff9a', 26);
      const e = scene.add.particles(p.x, p.y + 20, 'tiles', {
        frame: 'heart', speedY: { min: -140, max: -60 }, speedX: { min: -50, max: 50 },
        lifespan: 700, scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, emitting: false,
      });
      e.setDepth(30).explode(8);
      scene.time.delayedCall(800, () => e.destroy());
      burst(scene, p.x, p.y, 0x7dff9a, 18, 120);
      return;
    }

    // 투사체: 살아 있는 대상이 있으면 그쪽으로, 없으면 바라보는 방향으로
    const sx = p.x + p.facing * 30;
    const sy = p.y - 6;
    let angle = p.facing > 0 ? 0 : Math.PI;
    if (target && target.active && !target.dead) angle = Phaser.Math.Angle.Between(sx, sy, target.x, target.y);
    const frame = name === 'fireball' ? 'fireball' : 'gem_blue';
    const proj = scene.projectiles.create(sx, sy, 'tiles', frame) as Phaser.Physics.Arcade.Image;
    proj.setScale(name === 'fireball' ? 1.1 : 0.6).setDepth(25);
    proj.setData({ skill: name, damage: Math.round(def.power * p.skillPower), element: def.element });
    const body = proj.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setCircle(22, 10, 10);
    scene.physics.velocityFromRotation(angle, PROJECTILE_SPEED, body.velocity);
    proj.setRotation(angle);
    if (name === 'icebolt') scene.tweens.add({ targets: proj, angle: '+=360', duration: 400, repeat: -1 });

    const trail = scene.add.particles(0, 0, 'dot', {
      follow: proj, lifespan: 320, frequency: 18, speed: 20,
      scale: { start: 0.8, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: name === 'fireball' ? [0xffb347, 0xff5e3a] : [0x9fe8ff, 0x4fb4ff], blendMode: 'ADD',
    });
    trail.setDepth(24);
    proj.setData('trail', trail);
    scene.time.delayedCall(1300, () => scene.explodeProjectile(proj));
  }
}

function enemyInfo(m: Monster | null, p: Phaser.GameObjects.Components.Transform): EnemyInfo {
  if (!m) return { exists: false, hp: 0, max_hp: 0, type: 'none', distance: 99 };
  return {
    exists: true,
    hp: m.hp,
    max_hp: m.def.hp,
    type: m.kind,
    distance: Math.round(Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y) / TILE),
  };
}

function setBusy(slot: number, v: boolean) {
  gameStore.set((st) => ({ slotBusy: st.slotBusy.map((b, j) => (j === slot ? v : b)) }));
}

function setSlotError(slot: number, err: { line: number | null; message: string } | null) {
  uiStore.set((u) => ({ slotErrors: u.slotErrors.map((e, j) => (j === slot ? err : e)) }));
}
