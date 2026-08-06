/**
 * audio — the thin audio mix seam (PERS-02). NO assets (A2 / §48 full audio
 * deferred v2): the deliverable is the persistent per-bus multiplier store +
 * the play() seam signature. Phaser's SoundManager is global-only (Pitfall 4) —
 * per-sound volume is an app-side multiplier applied at play time.
 */

import type Phaser from 'phaser';

// Default mix mirrors DEFAULT_OPTIONS.audioMusic / .audioSfx.
const mix = { music: 0.6, sfx: 0.8 };

/** Persist the music-bus multiplier (0..1). */
export function setMusicVolume(v: number): void {
  mix.music = v;
}

/** Persist the sfx-bus multiplier (0..1). */
export function setSfxVolume(v: number): void {
  mix.sfx = v;
}

/**
 * Play-sound seam. When §48 audio assets land, this becomes:
 *   game.sound.add(key) → (s as Phaser.Sound.BaseSound).setVolume(mix[kind]) → s.play()
 * Today it is a no-op — the persistent multipliers and signature are the seam.
 */
export function play(_kind: 'music' | 'sfx', _game: Phaser.Game): void {
  /* no-op until audio assets exist (§48 deferred v2) */
}
