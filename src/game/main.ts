/**
 * Entry point: the Phaser game shell. Scenes: Boot (procedural assets) →
 * Home (menu) → Main (isometric game view + SimRunner) + HUD (overlay UI).
 * With `?skipHome` (or `?test`) the game boots straight into a city.
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { HUDScene } from './scenes/HUDScene';
import { MainScene } from './scenes/MainScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#2b1d0e',
  render: { preserveDrawingBuffer: true },
  scene: [BootScene, HomeScene, MainScene, HUDScene],
});
