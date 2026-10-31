# Decisions

Architecture decision records (ADRs): each lasting choice, with why it was made and what it costs.
Add a record when you make a choice the next person would otherwise question. Never edit an old
record's decision. Write a new record that supersedes it, and mark the old one "Superseded by ADR-N".

Gameplay rules decided against the boards are recorded in the README section "Where the boards
disagreed". The rules learned while building are in [GAME_DESIGN.md](GAME_DESIGN.md#design-rules-learned-while-building).

---

## ADR-001: Phaser 4, TypeScript and Vite, wrapped by Capacitor for iOS

- **Status:** accepted, 2026-10-30
- **Context:** The game is a 2D physics flyer for iPhone, designed as HTML/CSS boards. The user asked
  for the best framework for iOS. The work needed fast iteration, headless tests and one codebase.
- **Decision:** Build it as a web game with Phaser 4 and TypeScript, bundled by Vite, and wrap it as a
  native iOS app with Capacitor 8. Use Capacitor plugins for storage (Preferences) and haptics.
- **Consequences:**
  - The game runs in WKWebView, so performance depends on WebGL and WebAssembly there; check on older
    devices.
  - The same build runs in any browser, which makes development and automated checks easy.
  - Native features come through Capacitor plugins.

## ADR-002: Box2D v3 through box2d3-wasm's compat build

- **Status:** accepted, 2026-10-30. It supersedes the first build's hand-written physics.
- **Context:** The first build used hand-written collision and response. Logs, pebbles, rounded shapes
  and stacking needed a real engine. Rapier 2D was considered; the user chose Box2D v3.
- **Decision:** Use Box2D v3 compiled to WebAssembly by box2d3-wasm, in its **compat** build, which
  needs no SIMD, threads or cross-origin isolation, so it runs in WKWebView.
  - 1 m = 30 pt, with a fixed step of 1/60 s and 4 substeps.
  - Collision filtering by category.
  - A sensor slightly smaller than Puff detects hazards.
  - Kinematic bodies for moving hazards.
  - Revolute joints with motors for logs.
- **Consequences:**
  - The `.wasm` is about 612 kB (about 215 kB gzipped).
  - WebAssembly objects must be freed by hand (`.delete()`), and sims destroyed.
  - Snapshots don't restore user data, so shapes are tagged by `index1`.
  - Bodies can't be created mid-level, which is why there's a fixed pool of Puff bodies.

## ADR-003: A deterministic, headless simulation, apart from rendering

- **Status:** accepted, 2026-10-30
- **Context:** Levels must be provably finishable, and mechanics testable without a browser.
- **Decision:**
  - `src/game/` is pure TypeScript plus Box2D, with no Phaser, DOM, randomness or wall-clock time.
  - Scenes step it at a fixed rate and draw from its state.
  - It reports what happened as `SimEvent`s, which the scenes turn into sound and effects.
- **Consequences:**
  - Tests and the solver run the exact game.
  - Snapshots let the solver branch cheaply.
  - Anything non-deterministic in `src/game/` is a bug.

## ADR-004: Badland rules for scrolling and loss

- **Status:** accepted, 2026-10-30, at the user's request ("like Badland exactly")
- **Context:** The first build let Puff stall behind obstacles indefinitely.
- **Decision:**
  - The screen scrolls by itself at the level's speed.
  - Puff drifts toward screen x 280, and the player controls only its height.
  - A Puff is lost when a hazard touches its sensor, or when the left edge passes its centre.
  - When every Puff is lost, the level either re-forms Puff at once (`instant`) or shows the fail
    screen (`screen`).
- **Consequences:** Level layouts must leave a flyable line at scroll speed, and gates must open in
  time. The solver's score caps progress at the scroll's pace.

## ADR-005: Procedural art and synthesized audio until the final art

- **Status:** accepted, 2026-10-30
- **Context:** The boards call Puff and the scenery placeholder shapes until an illustrator's art
  arrives.
- **Decision:** Draw everything with Phaser `Graphics` from the boards' shapes and palette, and
  synthesize all audio with Web Audio. Ship no image or audio files.
- **Consequences:**
  - The bundle stays tiny, apart from Phaser and Box2D.
  - Final art will mean an asset pipeline and a texture-based renderer for Puff and the world. Plan
    it as its own piece of work ([ROADMAP.md](ROADMAP.md)).

## ADR-006: Levels as JSON data, described by one schema

- **Status:** accepted, 2026-10-30. It supersedes levels as TypeScript modules.
- **Context:** Levels written in TypeScript could only be edited as code, and the design notes were
  comments.
- **Decision:**
  - Each level is `src/game/levels/data/<id>.json`, with design notes as `notes` and per-object
    `note` fields.
  - `schema.ts` lists every field once. Validation, the editor's forms and the canonical file layout
    all derive from it.
  - Files are kept canonical, so diffs stay minimal.
- **Consequences:**
  - A new field must be added to `types.ts` and `schema.ts` together.
  - Hand edits need `npm run levels:format`.
  - Values computed by helpers (`levels/util.ts`) are now baked into the data.

## ADR-007: Prove every level with a solver in the tests

- **Status:** accepted, 2026-10-30
- **Context:** Hand-tuned levels broke silently when physics changed. "It worked when I tried it"
  doesn't scale to 40 levels.
- **Decision:**
  - A beam-search player (`solver.ts`) plays each level in the real simulation. It runs in the slow
    suite, one file per level, three at a time.
  - It proves the level can be finished, each seed collected, and each clone badge earned.
  - Designers can add `route` hints for narrow puzzles.
- **Consequences:**
  - The slow suite takes about 5 minutes, so it's a separate command.
  - A physics or tuning change must re-run it.
  - Routes are test-only data in the level files.

## ADR-008: Design checks shared by the tests and the editor

- **Status:** accepted, 2026-10-30
- **Context:** Some layouts load and can even be solved, but play badly, like a gate off-screen from
  its log, or a heavy log with no Swell before it.
- **Decision:** `lintLevel` holds those rules. The tests require no problems in shipped levels, and
  the editor shows them live.
- **Consequences:** Each new design rule goes into `lintLevel`, with a test.

## ADR-009: A dev-only level editor built on the game's own renderer

- **Status:** accepted, 2026-10-30
- **Context:** Editing coordinates by hand meant guessing what changed. The user asked for a UI.
- **Decision:**
  - The editor is an in-game Phaser scene plus a DOM panel, loaded only in dev builds.
  - It draws through `LevelView` at any moment of a run (`poseSim`), offers schema-driven forms and
    live design checks, and test-flies from anywhere (`createSim(def, t0)`).
  - It saves through a Vite dev-server endpoint, which skips the page reload for its own writes.
- **Consequences:**
  - What you edit is exactly what plays.
  - The editor can't be used from a production build or a phone.
  - New levels still need registering by hand.

## ADR-010: Progress in Capacitor Preferences

- **Status:** accepted, 2026-10-30
- **Context:** iOS can evict web storage.
- **Decision:** Keep the save as one JSON value (`version: 1`) in Capacitor Preferences, which is
  UserDefaults on iOS. `progress.ts` is pure functions, and storage is best effort.
- **Consequences:** Changing the save format needs a version bump and a migration in `loadSave`.

## ADR-011: One instruction file for every agent, with thin adapters

- **Status:** accepted, 2026-10-31
- **Context:** Several coding agents (Claude Code, Antigravity and others) will continue the work, and
  each reads its own files.
- **Decision:**
  - `AGENTS.md` holds the canonical instructions.
  - `CLAUDE.md` imports it (`@AGENTS.md`) and adds Claude Code notes.
  - Antigravity's always-on rule in `.agents/rules/` points to it.
  - Procedures live once, in `docs/playbooks/`. The Claude skills (`.claude/skills/`) and Antigravity
    workflows (`.agents/workflows/`) are short wrappers around them.
  - Path-scoped rules are mirrored in `.claude/rules/` and `.agents/rules/`.
  - `src/docs.test.ts` keeps paths, scripts, schema fields and mirrored rules in step with the code.
- **Consequences:** Change a procedure in its playbook, not in a wrapper. When you add a path rule,
  add it to both folders, or the docs test fails.
