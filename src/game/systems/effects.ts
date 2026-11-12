import Phaser from 'phaser';

export const FONT = '"Jua", "Malgun Gothic", sans-serif';

/** 위로 떠오르며 사라지는 글자 (피해량, 회복량, 알림) */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffffff', size = 22) {
  const t = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size + 2}px`, color, stroke: '#353541', strokeThickness: 6 })
    .setOrigin(0.5)
    .setDepth(50)
    .setResolution(2);
  scene.tweens.add({ targets: t, y: y - 46, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}

/** 한 번 터지는 파티클 */
export function burst(scene: Phaser.Scene, x: number, y: number, tint: number, count = 14, speed = 160) {
  const e = scene.add.particles(x, y, 'dot', {
    speed: { min: speed * 0.4, max: speed },
    lifespan: { min: 250, max: 550 },
    scale: { start: 0.7, end: 0 },
    tint,
    blendMode: 'ADD',
    emitting: false,
  });
  e.setDepth(30);
  e.explode(count);
  scene.time.delayedCall(700, () => e.destroy());
}

/** 흰 원 텍스처 'dot' 생성 (파티클용) */
export function makeDotTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('dot')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
  g.generateTexture('dot', 16, 16);
  g.destroy();
}

/**
 * 타일셋 가장자리 픽셀을 바깥으로 늘린(extrude) 새 텍스처를 만든다.
 * 카메라 줌이 정수가 아닐 때 타일 사이에 생기는 가는 틈(이음새)을 없애기 위함.
 */
export function makeExtrudedTileset(scene: Phaser.Scene, srcKey: string, outKey: string, tile = 64, spacing = 1, cols = 18, rows = 18, ex = 2) {
  if (scene.textures.exists(outKey)) return;
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement;
  const step = tile + ex * 2;
  const canvas = scene.textures.createCanvas(outKey, cols * step, rows * step)!;
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = c * (tile + spacing);
      const sy = r * (tile + spacing);
      const dx = c * step + ex;
      const dy = r * step + ex;
      ctx.drawImage(src, sx, sy, tile, tile, dx, dy, tile, tile);
      ctx.drawImage(src, sx, sy, tile, 1, dx, dy - ex, tile, ex);
      ctx.drawImage(src, sx, sy + tile - 1, tile, 1, dx, dy + tile, tile, ex);
      ctx.drawImage(src, sx, sy, 1, tile, dx - ex, dy, ex, tile);
      ctx.drawImage(src, sx + tile - 1, sy, 1, tile, dx + tile, dy, ex, tile);
    }
  }
  canvas.refresh();
}
