# Art Pipeline

The game ships **zero required art assets**: every texture the renderer reads
is keyed by a manifest entry in [`src/game/art.ts`](../src/game/art.ts), and
`BootScene` (see `src/game/scenes/BootScene.ts`) either loads the real sheet
from `public/assets/` or registers a procedurally generated placeholder under
the same key. Renderers never assume a texture came from a file.

## Manifest

`SHEETS` in `src/game/art.ts` lists every sprite sheet:

| key      | file                   | frame width | frame height | frames              |
| -------- | ---------------------- | ----------- | ------------ | ------------------- |
| `terrain`| `public/assets/terrain.png` | 60 px   | 30 px        | 6 (earth, water, fertile, trees, rock, road) |
| `house`  | `public/assets/house.png`   | 60 px   | 48 px        | 5 (tiers 0..4)      |

Frame layout is positional:

- **Terrain**: tile index `i` sits at `x = i * frameWidth`, `y = 0`. The
  mapping from sim tile type to index lives in `TERRAIN_FRAME`.
- **House**: frame `i` sits at `x = i * frameWidth`. The frame is taller than a
  terrain tile: the footprint diamond's top vertex is at `(30, 18)`
  (`HOUSE_FOOT_TOP_Y`), the diamond bottom at `y = 48` aligns with the tile,
  and the roof rises above the diamond into the extra vertical space. House
  tiers clamp to frames `0..4` (`houseFrame(tier)`).

File naming follows the manifest: `public/assets/<key>.png`.

## Loading and fallback

1. `BootScene.create` runs before any scene renders.
2. It `HEAD`-checks each manifest URL; sheets that exist are queued as Phaser
   sprite sheets (`frameWidth`/`frameHeight` from the manifest).
3. After the loader completes, loaded keys are added to the `sheetLoaded`
   registry (`isSheetLoaded(key)`).
4. Any key with no file gets a procedural placeholder texture registered under
   the **same key**, so renderers always find a texture.
5. `MainScene` uses `isSheetLoaded('house')` to choose between sprite
   `Image` rendering and the procedural `Graphics` box renderer; terrain
   always renders through the tilemap using the `terrain` texture.

Delete a file from `public/assets/` and the game boots with the placeholder
for that sheet — that is the CI-safe fallback path.

## Regenerating the first art set

The current `terrain.png` / `house.png` were baked from the procedural
placeholders (deterministic, hash-based). To regenerate:

```sh
node scripts/export-art.mjs
```

This boots Vite, opens the game with `?artexport`, and writes every manifest
sheet from `window.__artExport` to `public/assets/<key>.png`.

## Adding a future (hand-drawn / AI) art set

1. Drop the new sheet at `public/assets/<key>.png` matching the manifest frame
   dims and layout above.
2. Optionally update the manifest if the key or frame size changed.
3. Ship it — the loader picks it up automatically; the placeholder only runs
   while the file is absent.

For an AI-generated set, output a sprite strip at the exact frame width/height
in the manifest (see table), one frame per terrain type or house tier, in the
documented order.
