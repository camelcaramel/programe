import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#8fd3ff',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
    render: { roundPixels: true },
    input: { keyboard: { target: window } },
    scene: [GameScene],
  });
}
