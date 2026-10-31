# AGENTS.md: Hollowdrift

Instructions for coding agents (Claude Code, Antigravity, Codex, Cursor and others) working in this
repository. People should start at [README.md](README.md). Before you change anything, read
[docs/STATUS.md](docs/STATUS.md) to see where the project stands. Update it last, before you hand off.

## What this is

Hollowdrift is a side-scrolling physics flyer for landscape iPhone, in the style of Badland: hold to
puff upward, release to drift, collect seeds, and bring clones home. It's built with **Phaser 4,
TypeScript and Vite**, uses **Box2D v3** for physics through
[box2d3-wasm](https://github.com/Birch-san/box2d3-wasm), and ships to iOS with **Capacitor 8**. The art is
drawn with vector shapes and the audio is synthesized, so there are no asset files. The design comes from
the Claude Design boards in [design/](design/README.md). World 1 (levels 1-1 to 1-10) is built and proven
finishable; worlds 2 to 4 exist only as a chapter plan.

## Commands

Node 22.12 or later (see `.nvmrc`). Every command runs from the repo root.

| Task | Command | Time |
| --- | --- | --- |
| Install | `npm install` | |
| Play in a browser | `npm run dev`, then open http://localhost:5173 | |
| Level editor | `npm run dev`, then open http://localhost:5173/?edit=1-2 | |
| Typecheck | `npm run typecheck` | ~3 s |
| Unit tests | `npm test` | ~2 s |
| One test file or test | `npx vitest run src/game/sim.test.ts -t "tips when"` | |
| Level solvability | `npm run test:levels` | ~5 min |
| Tidy level files after a hand edit | `npm run levels:format` | ~1 s |
| Production build | `npm run build` (typecheck, then bundle into `dist/`) | ~5 s |
| iOS | `npm run ios:sync` (macOS and Xcode only) | |

## Definition of done

A change is done only when all of these hold. The full gate is in
[docs/playbooks/verify.md](docs/playbooks/verify.md).

1. `npm run typecheck`, `npm test` and `npm run build` all pass.
2. If you touched `src/game/sim.ts`, `src/game/physics.ts`, `src/game/solver.ts`, `src/config/` or any
   level file, `npm run test:levels` passes. Run it in the background; it takes minutes.
3. If you touched anything on screen (scenes, rendering, UI, the editor), you've looked at it in a
   browser ([docs/playbooks/playtest.md](docs/playbooks/playtest.md)).
4. New behaviour has a test that describes it. A fixed bug has a test that would have caught it.
5. The docs say what's now true: the README for anything a player or designer sees, `docs/` for
   architecture or process, and `docs/STATUS.md` every time.
6. The work is committed in small, focused commits on a branch, and pushed.

## Where things are

```
src/main.ts          boot: fonts, saved progress, Box2D, then the Phaser game (and the editor in dev)
src/config/          constants (screen, physics, sizes), tuning (the 1% per level ramp), palette
src/game/            the game itself, headless: sim.ts (Box2D simulation), physics.ts (Box2D helpers),
                     types.ts (level data types), progress.ts (saves), solver.ts (tests only)
src/game/levels/     data/<id>.json (one file per level), schema.ts, format.ts, lint.ts, index.ts;
                     solvable/ (the slow solver tests, one file per level)
src/render/          levelView.ts (draws a level), art.ts (Puff and objects), ui.ts (UI kit), panels.ts
src/scenes/          Title, World, Map, Play (HUD, pause, fail), Clear
src/editor/          the level editor (dev builds only)
src/audio/           synthesized music and effects; src/platform/: Capacitor storage and haptics
scripts/levels.mjs   npm run levels:format: check every level file and rewrite it in canonical form
design/              the original design boards and design chats (the spec)
docs/                architecture, game design, levels, testing, workflow, decisions, status, playbooks
```

## Rules that keep the game working

- **The simulation is headless and deterministic.** Nothing in `src/game/` may use Phaser, the DOM,
  `Math.random`, `Date` or frame time. The renderer reads sim state and never writes it. The solver
  and the tests depend on a given input always producing the same run.
- **Step at a fixed rate.** Use `SIM_STEP` (1/60 s) with 4 substeps, and never a variable `dt`.
- **Every `createSim` needs a `destroySim`.** Each sim owns a Box2D WebAssembly world, and at most 100
  can be alive at once. In tests, push sims onto the `sims` list so `afterEach` frees them.
- **Free Box2D's WebAssembly objects.** Every `new B.b2Vec2(...)` and `B.b2Default*Def()` result needs
  a `.delete()`. Follow the helpers in `src/game/physics.ts`.
- **Create bodies only in `createSim`.** Snapshots (`snapshot` and `restore`) only work if every
  handle stays valid. Shapes are tagged by `shapeId.index1` in a Map, because Box2D user data doesn't
  survive a snapshot.
- **Units.** The game works in points (pt) with y growing downward. Box2D works in metres, at
  1 m = 30 pt (`PT`, `m()`). The roof is at y 14, the floor at y 350, and the screen is 844 × 390.
- **Levels are data.** A level is `src/game/levels/data/<id>.json`. `schema.ts` is the one list of
  fields: validation, the editor's forms and the file layout all come from it. A new field goes in
  `types.ts` and `schema.ts` together.
- **Keep level files canonical.** Save them from the editor, or run `npm run levels:format` after a
  hand edit. The format test fails on a file that isn't in canonical form.
- **Every shipped level passes the design checks and the solver.** That means `lintLevel` returns
  nothing, and `npm run test:levels` proves the level can be finished and every seed collected.
- **The editor stays out of production.** Import it only behind `import.meta.env.DEV`, as `main.ts`
  does.
- **Feel numbers live in `src/config/`.** Don't scatter magic numbers. A change to `constants.ts` or
  `tuning.ts` changes every level, so ask the user first and run the solver suite after.
- **The boards are the spec.** Follow `design/` for look, layout and copy. When you deliberately
  depart from them, record it in the README section "Where the boards disagreed".

## How the code reads

The full guide is [docs/STYLE.md](docs/STYLE.md).

- TypeScript in strict mode with no unused names, and no `any`. Use `!` only where an index is known
  to be valid.
- Comments say *why*, in plain sentences, as densely as the code around them. Every module opens with
  a short comment saying what it is.
- Use the game's words. A seesaw is a Mossback log; the code calls it `seesaws`. The full glossary is
  in [docs/STYLE.md](docs/STYLE.md).
- Build UI with `src/render/ui.ts`, take colours from `src/config/palette.ts`, and use the fonts
  Fredoka and JetBrains Mono. Hit targets are at least 44 pt.
- Test names read as behaviour, for example `it('tips when Puff lands on the high end')`.
- No formatter is configured, so match the code around you: 2-space indent, single quotes,
  semicolons and trailing commas.

## Gotchas

- `pkill -f <pattern>` kills your own shell when the pattern also appears in your command line. Stop
  processes by PID.
- `npm run test:levels` keeps three cores busy for about 5 minutes. Run it in the background and keep
  working.
- After moving the game canvas to a new parent box, call `scale.getParentBounds()` before
  `scale.refresh()`. A refresh on its own can leave the canvas at its old size.
- Vite must not pre-bundle box2d3-wasm (`optimizeDeps.exclude`), because the package loads its `.wasm`
  file from next to its own module.
- Phaser removes a scene's input listeners when the scene shuts down. Listeners added to `window` or
  `document` are yours to remove.
- In a cloud session, the user can't reach your dev server. Check screens yourself with headless
  Playwright ([docs/playbooks/playtest.md](docs/playbooks/playtest.md)).

## Git

- Work on a branch, never directly on `main`. Keep each commit to one change, with an imperative
  subject under 72 characters and a body that says why.
- Push your branch. Open a pull request only when the user asks for one. Never force-push a branch
  someone else is using.
- Don't commit `dist/`, `node_modules/`, `ios/App/Pods/` or logs; `.gitignore` already excludes them.

## Ask the user before you

- Change a feel constant, the difficulty ramp or Puff's physics.
- Delete or reorder levels, or remove content from a level.
- Depart from the design boards in a way the player would notice.
- Add a dependency, a service, analytics or anything that sends data off the device.

## More documentation

| Read | When |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | First, every session: what's built, what's verified, what's next |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Picking up a task: the backlog, with acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Before changing how modules fit together |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | Before changing gameplay, mechanics or progression |
| [docs/LEVELS.md](docs/LEVELS.md) | Before editing or adding a level |
| [docs/TESTING.md](docs/TESTING.md) | Before writing tests, or when the solver suite fails |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | How work moves from task to merged change |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why things are the way they are; add a record when you decide something big |
| [docs/playbooks/](docs/playbooks/) | Step-by-step guides: verify, playtest, change a level, add a mechanic, release on iOS, hand off |
