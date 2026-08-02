/**
 * Entry point: the Phaser game shell. Scenes: Boot (procedural assets) →
 * Main (isometric game view + SimRunner) + HUD (overlay UI).
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HUDScene } from './scenes/HUDScene';
import { MainScene } from './scenes/MainScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#2b1d0e',
  render: { preserveDrawingBuffer: true },
  scene: [BootScene, MainScene, HUDScene],
});
