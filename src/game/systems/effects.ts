import Phaser from 'phaser';

export const FONT = '"Jua", "Malgun Gothic", sans-serif';

/** 흰 원 텍스처 'dot' 생성 (파티클·마법 구슬용) */
export function makeDotTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('dot')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
  g.generateTexture('dot', 16, 16);
  g.destroy();
}
