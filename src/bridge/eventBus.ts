// Phaser <-> React 통신용 이벤트 버스
import Phaser from 'phaser';
export const eventBus = new Phaser.Events.EventEmitter();
