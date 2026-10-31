# Roadmap

The backlog, in priority order. Each item is sized for one agent session or a few, and has acceptance
criteria. When you finish an item, tick it and note it in [STATUS.md](STATUS.md). When you find new
work, add it here with criteria, not as a `TODO` in code. The user sets priorities; ask before you
reorder.

Legend: **P0** is foundation, **P1** is next, **P2** is planned, **P3** is someday.

## P0: Foundation

- [ ] **R1 · CI on every push and pull request.** Add `.github/workflows/ci.yml`. It installs with
  `npm ci` on Node 22, then runs `npm run typecheck`, `npm test` and `npm run build`. A second job runs
  `npm run test:levels` nightly, and on pull requests that touch `src/game/`, `src/config/` or level
  files.
  - Done when a push shows green checks, and a failing test turns them red.
  - Pushing a workflow file needs a token with the `workflow` scope. If the push is refused, hand the
    file to the user.
- [ ] **R2 · Lint and format.** Add ESLint (typescript-eslint) and Prettier, with a config that matches
  the current style (see [STYLE.md](STYLE.md); some long lines exist). Add a `lint` script to
  `package.json`, and run it in CI.
  - Done when the codebase passes with no blanket disables.
- [ ] **R3 · Check in WebKit.** Run the playtest checks
  ([playbooks/playtest.md](playbooks/playtest.md)) in Playwright's WebKit as well as Chromium.
  - Done when the title, a level, pause, clear, fail and the editor all work in WebKit with no console
    errors.

## P1: Ship World 1 on iPhone

- [ ] **R4 · Generate the iOS project and run on a device**
  ([playbooks/release-ios.md](playbooks/release-ios.md)). Lock landscape; check safe areas, audio
  unlock, haptics, saving and resuming, and 60 fps on an older iPhone.
  - Done when `ios/` is committed (without Pods or build output) and a device build plays 1-1 to 1-10.
- [ ] **R5 · Performance pass.** Measure frame time on the slowest target device during 1-10 (6 Puffs,
  crushers and wheels).
  - Done when the worst sustained frame time is under 16.7 ms, or there's a documented plan for it.
- [ ] **R6 · Split the bundle.** Put Phaser in its own chunk, and make sure the wasm is cached.
  - Done when Vite reports no chunk-size warning, or the warning is justified in `vite.config.ts`.
- [ ] **R7 · App Store basics.** Add an icon, a launch screen in the palette, the display name, a
  privacy manifest (the app collects no data), and screenshots taken from the game.

## P1: Tidy up from World 1

- [ ] **R8 · One model of crusher timing.** Either make `arrivalTime` include the getting-going time,
  or re-time Chapter 2's crushers with the editor's **Time it** button.
  - Done when the editor and the levels agree, and `npm run test:levels` passes.
- [ ] **R9 · Validate partial groups.** A `ride` or `orbit` with no `log` or `wheel` is a validation
  error. Add a test in `format.test.ts`.
- [ ] **R10 · Attached seeds' positions.** Derive or drop `x` and `y` for seeds with `ride` or `orbit`,
  and update the schema, the editor and the docs.
- [ ] **R11 · Remove or repurpose `levels/util.ts`.** For example, add "Add bramble gap" to the
  editor, using `bramble()`.

## P2: Editor

- [ ] **R12 · New levels from the editor.** "New level" and "Duplicate level as…" create
  `data/<id>.json`, register it in `levels/index.ts` and add `solvable/l<id>.slow.test.ts`. They could
  go through a dev endpoint, or the editor could print the exact steps to take.
- [ ] **R13 · Draw routes.** A tool that draws a level's or a seed's `route` as a polyline on the canvas.
- [ ] **R14 · Run the solver from the editor.** Solve the current level in a Web Worker, then show the
  best line and where it stalled.
- [ ] **R15 · Multi-select, and copy and paste between levels.**

## P2: World 2 · Rustwell (levels 2-1 to 2-10)

These need design with the user first. The board gives only one line per chapter (see
[GAME_DESIGN.md](GAME_DESIGN.md#future-chapters-from-the-board)).

- [ ] **R16 · Design Chapter 3 · Cogworks** (Gust, Hush, gears) with the user, as a board or a written
  spec: the mechanics, 5 levels with beats, and the sky.
- [ ] **R17 · Build Gust** ("speeds up time for 4s") **and Hush** ("slows time for precision runs").
  Decide whether they change the sim's time scale or the scroll speed and drift; time scaling must
  stay deterministic. Follow [playbooks/new-mechanic.md](playbooks/new-mechanic.md).
- [ ] **R18 · Build gears:** turning platforms, likely kinematic bodies or motored joints.
- [ ] **R19 · Build levels 2-1 to 2-5.**
  - Done when they pass the design checks and the solver, and the map and world select open world 2.
- [ ] **R20 · Design and build Chapter 4 · Furnace** (Mawpit, conveyors, ember vents) and levels 2-6
  to 2-10.
- [ ] **R21 · A map for each world.** `MapScene` takes a `world` and draws that world's path, sky and
  name. `WORLD_1_LEVEL_COUNT` becomes a count per world.

## P3: Worlds 3 and 4, and the finale

- [ ] **R22 · Brinefall:** Chapter 5 · Tidepools (buoyancy, currents) and Chapter 6 · Undertow (Burr,
  sinking clones).
- [ ] **R23 · Stillsky:** Chapter 7 · Driftfield (low gravity, orbiting debris) and Chapter 8 · The Long
  Way Home (a remix finale).
- [ ] **R24 · Ending and credits.**

## P3: Polish

- [ ] **R25 · Final art.** Replace the placeholder shapes with the illustrator's art. That needs an
  asset pipeline and textures for Puff and the world; keep the procedural look as a fallback.
- [ ] **R26 · Skins**, as the title's Skins button promises. This needs a design first.
- [ ] **R27 · Audio polish:** volume settings, and more variety in the ambience for each world.
- [ ] **R28 · Accessibility:** reduced motion (parallax and shake), a high-contrast option for
  hazards, and a one-handed mode check.
- [ ] **R29 · Web release:** GitHub Pages or similar, built with the editor left out.
