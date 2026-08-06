/**
 * Entry point: the Phaser game shell. Scenes: Boot (procedural assets) →
 * Home (menu) → Main (isometric game view + SimRunner) + HUD (overlay UI).
 * With `?skipHome` (or `?test`) the game boots straight into a city.
 *
 * PERS-02: shell options are read BEFORE `new Phaser.Game` so graphicsQuality
 * can map into the RenderConfig — RenderConfig is context-creation-only
 * (Pitfall 3); changing quality persists immediately but applies on next boot.
 * applyOptions() then sets the body[data-*] attrs + audio mix once scenes
 * exist.
 */

import Phaser from 'phaser';
import { applyOptions, loadOptions } from './options';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { HUDScene } from './scenes/HUDScene';
import { MainScene } from './scenes/MainScene';

const options = loadOptions();

// graphicsQuality → RenderConfig (context-creation-only, read before the Game).
const render =
  options.graphicsQuality === 'low'
    ? { preserveDrawingBuffer: true, antialias: false, roundPixels: true }
    : options.graphicsQuality === 'high'
      ? { preserveDrawingBuffer: true, antialias: true }
      : { preserveDrawingBuffer: true };

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#2b1d0e',
  render,
  scene: [BootScene, HomeScene, MainScene, HUDScene],
});

// document.body exists at module load (this script sits at the end of <body>):
// set the body[data-text-size]/[data-reduced-motion] attrs + the audio mix.
applyOptions(options);
