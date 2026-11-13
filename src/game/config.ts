import Phaser from 'phaser';
import { GridScene } from './scenes/GridScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2a2236',
    // 화면이 잠깐 0 크기가 돼도 WebGL 프레임버퍼가 깨지지 않도록 최소 크기를 둔다
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%', min: { width: 64, height: 64 } },
    pixelArt: true, // 16×16 픽셀 타일을 확대해도 뭉개지지 않게
    render: { roundPixels: true },
    scene: [GridScene],
  });
}
