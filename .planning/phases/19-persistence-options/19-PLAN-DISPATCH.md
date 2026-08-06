You are the GSD Planner for Phase 19: "Persistence & Options" in OpenCaesar, a Phaser 3 + TypeScript city sim with a deterministic core at /Users/filipe.esch/projects/pessoal/opencaesar.

<planning_context>
**Phase:** 19
**Mode:** standard

<files_to_read>
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/STATE.md (Project State)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/ROADMAP.md (Roadmap)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/REQUIREMENTS.md (Requirements)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/19-persistence-options/19-CONTEXT.md (USER DECISIONS)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/19-persistence-options/19-RESEARCH.md (Technical Research)
- /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/19-persistence-options/19-PATTERNS.md (Pattern Map)
</files_to_read>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** PERS-01, PERS-02

**Project instructions:** Read ./AGENTS.md or ./.claude/CLAUDE.md if either exists — follow project-specific guidelines.
</planning_context>

<downstream_consumer>
Output consumed by /gsd-execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format with read_first and acceptance_criteria fields (MANDATORY on every task)
- Verification criteria
- must_haves for goal-backward verification
- <threat_model> block (security enforcement active, ASVS level 1; note: save-codec validation is the key input-validation concern — corrupted saves must not crash or inject; URI/localStorage read is a data-integrity concern; XSS via localStorage strings into DOM is a mitigation)
- Wave 0 test gaps from VALIDATION.md
- Tracer-first: lead with one production-quality end-to-end tracer slice verified before expansion tasks
</downstream_consumer>

**TRACER_MODE:** true
**REVERSIBILITY_GATES:** true
**MVP_MODE:** false
**WALKING_SKELETON:** false
**Granularity:** standard

<phase_context>
Goal: Versioned save/load for all systems (migration + validation + deterministic reload) and functional persisted options/accessibility. This is the FINAL phase of the v1.0 milestone.
Success criteria (must be TRUE):
1. Saves round-trip deterministically with migration and validation.
2. Graphics/audio/gameplay/accessibility options are functional and persisted.

KEY RESEARCH + PATTERN findings to honor (19-RESEARCH.md + 19-PATTERNS.md):
- PERS-01 mostly proven: getSaveData()/fromSaveData() round-trip byte-identically across all systems (missions/events/objectives/tutorial/government/production/housing/paused). MISSING: no version check, no migration chain, no validation — fromSaveData replays unguarded (runner.ts:2662-2678); readSave only truthiness-checks version (save.ts:66). Corrupt saves throw raw 'unknown command kind' or silently misbehave on NaN.
- PERS-02 options exist but DEAD CODE: OptionsSchema/DEFAULT_OPTIONS/serialize/deserialize/mergeOptions in src/sim/ui.ts have zero consumers; no localStorage key, no application; no audio, no renderer-quality control (main.ts fixed config), gameSpeedDefault unused (HUD hardcodes [0.5,1,2,4,8]), no text-size/reduced-motion hooks.
- PERS-01 plan: pure src/sim/saveCodec.ts (SAVE_VERSION, additive N→N+1 migrateSave, validateSave with typed error) + loadSavedGame() in save.ts (read→parse→migrate→validate) hooked into HomeScene + MainScene; version 1 stays current (all existing saves valid, no data migration).
- PERS-02 plan: src/game/options.ts (rcb.options key), options read BEFORE new Phaser.Game for RenderConfig (load-time-only constraint verified), boot speed via MainScene.setSpeed(gameSpeedDefault), text-size/reduced-motion via document.body data-attrs + index.html CSS, thin audio.ts mix seam (no assets — §48 deferred v2), Settings panel in HUD control bar following Phase-18 drawer patterns.
- Constraints: RenderConfig (antialias/pixelArt/roundPixels) is context-creation-only; SoundManager is global-volume only; options NEVER in SaveData/getStateJson (golden-byte).
- No new packages.

PATTERN-MAPPER analogs (19-PATTERNS.md): saveCodec.ts modeled on src/sim/ui.ts options codec + save.ts discriminated union {ok:true}|{ok:false;error}; StorageLike + memStore from save.test.ts:5-12 reusable; Settings panel copies Phase-18 control bar/drawer (HUDScene createElement/textContent/data-testid + game.events cleanup); RenderConfig at boot (main.ts:13-21); byte-identical round-trip recipe (determinism.test.ts:29-42) extended with migrate/validate.
</phase_context>

<plan_shape>
Create PLAN.md at /Users/filipe.esch/projects/pessoal/opencaesar/.planning/phases/19-persistence-options/19-PLAN.md with 3 waves aligned to requirements:
- Wave 0: validation test scaffolds — tests/unit/saveCodec.test.ts (migrate chain + validate rejection), tests/unit/options.test.ts (persistence round-trip + defaults), extend tests/unit/save.test.ts (loadSavedGame), extend a determinism suite (round-trip WITH migrate/validate), e2e/settings.spec.ts.
- Wave 1 (PERS-01): saveCodec.ts (SAVE_VERSION, migrateSave additive N→N+1, validateSave typed errors) + loadSavedGame() (read→parse→migrate→validate) + Home/Main hookup + typed corrupt-save rejection (no raw throw).
- Wave 2 (PERS-02): options persistence (src/game/options.ts rcb.options) read before Phaser.Game for RenderConfig; boot speed via MainScene.setSpeed(gameSpeedDefault); text-size/reduced-motion via document.body data-attrs + index.html CSS; Settings panel in HUD (Phase-18 pattern) editing + persisting; e2e settings.
- Wave 3: close — full suite + typecheck + military green; golden no-change (options never in SaveData/getStateJson); migrate+validate embedded in the load path tested end-to-end.
Wave ordering: W1 save codec → W2 options → W3 close. Tracer leads W1.

Security: save-codec validation is the key input-validation control (corrupt saves rejected, no crash/no injection); localStorage strings rendered via textContent (XSS-safe).

Write the final PLAN.md using the Write tool. Do NOT return the PLAN.md content in your reply.
</plan_shape>

Conclude your reply with: ## PLAN COMPLETE
