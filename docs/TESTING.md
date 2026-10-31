# Testing

The game's logic is a deterministic simulation that runs headless, so most behaviour can be tested
without a browser. There are four layers, fastest first.

| Layer | Command | Time | Proves |
| --- | --- | --- | --- |
| Typecheck | `npm run typecheck` | seconds | The code is type-correct, with no unused names |
| Unit tests | `npm test` | about 1 s | Mechanics, level data, file format, design checks, progress, the editor's model, the docs |
| Solver suite | `npm run test:levels` | about 5 min | Every level can be finished, every seed collected and every badge earned, in real Box2D |
| Browser check | [playbooks/playtest.md](playbooks/playtest.md) | minutes | Screens render, input works, no console errors |

`npm run build` is the last gate. It typechecks, bundles, and must leave the editor out of `dist/`.

## Test files

| File | Covers |
| --- | --- |
| `src/game/sim.test.ts` | Every mechanic, as a scenario in a small made-up level: flying, scroll and edge loss, logs, gates, pebbles and boulders, hazards, Swell and Shrink, Split and clones, checkpoints, winning, snapshot determinism, the run's clock |
| `src/game/levels/levels.test.ts` | Every shipped level passes the design checks; chapter content matches the boards (lengths, seeds, props, sky, one idea per level); narrowest gaps and wheel spins follow the tuning |
| `src/game/levels/format.test.ts` | One file per level, every file canonical, hex sky colours, validation messages, field get and set |
| `src/game/progress.test.ts` | Unlocks, best seeds, badges, worlds opening by seeds |
| `src/config/tuning.test.ts` | The 1% ramp matches the board's printed numbers |
| `src/game/geometry.test.ts` | Segment and circle-triangle helpers |
| `src/editor/model.test.ts` | Editor undo and redo, dirty tracking, ID renames, add, duplicate, delete, revert |
| `src/editor/shapes.test.ts` | Editor dragging and handles for each kind, riding seeds, level markers |
| `src/docs.test.ts` | The docs still match the code: paths exist, npm scripts exist, every schema field is documented |
| `src/game/levels/solvable/l*.slow.test.ts` | One file per level; all of them run `checkLevel(id)` from `check.ts` |

`vitest.config.ts` keeps `*.slow.test.ts` out of `npm test`. `LEVELS=1` (`npm run test:levels`) runs
only those files, three at a time. `vitest.setup.ts` loads Box2D once, before any test runs.

## Writing a simulation test

`sim.test.ts` has helpers. Use them.

```ts
const sim = started(level({ seesaws: [{ id: 'log', px: 900, py: 300, half: 100, high: 'right' }] }));
const events = run(sim, 3, hover(250)); // 3 s, holding whenever Puff sinks below y 250
expect(types(events)).toContain('tip');
```

- `level(over)` builds a 100 000 pt test level with nothing in it; pass only what the scenario needs.
- `make(def)` creates a sim and registers it so `afterEach` destroys it. Never call `createSim` in a
  test without registering it, because Box2D worlds leak otherwise.
- `started(def)` creates a sim and wakes Puff with one held step.
- `run(sim, seconds, control)` steps the sim and returns all events. `control` is either a boolean or
  a function of the sim.
- `hover(y)` holds whenever the leader sinks below y, so Puff cruises along that line.
- `types(events)` and `lead(sim)` are shorthands.

Write each test as a small story with one cause and one effect, and name it for the behaviour, as in
`it('jams a thornwheel it rolls into')`.

## The solver suite

`check.ts` has three kinds of test per level:

- **can be finished:** `solve(level, { beam: 32 })` must win.
- **seed `<id>` can be collected:** one search per seed, with that seed weighted. `SEED_BEAM` gives a
  wider search to a seed that hangs on a beat.
- **the clone badge can be earned:** only for levels with `goalClones > 1`.

The 7 tests the suite reports as skipped are the badge tests of the levels that have no badge.

When a solver test fails:

1. Don't loosen the test. A failure means the solver, playing the real simulation, couldn't do it,
   and players might not either.
2. Open the level in the editor and look at its problems. Then test-fly the stretch around where the
   search stalled (`bestX` in the result).
3. If the stretch is fine to fly by hand but narrow for a search, add a `route` hint to the level or
   the seed ([LEVELS.md](LEVELS.md#routes-hints-for-the-solver)).
4. If you changed physics or tuning, every level may need re-checking. Ask the user first, as
   [AGENTS.md](../AGENTS.md) says.

A single level: `LEVELS=1 npx vitest run src/game/levels/solvable/l18.slow.test.ts`.

## Determinism

The solver and the tests rely on identical input producing identical runs. `sim.test.ts` replays from
a snapshot and compares the state to make sure. Anything that breaks determinism breaks the solver.
That includes `Math.random`, wall-clock time, iteration over unordered state, and frame-rate-dependent
steps.

## What isn't automated yet

- **CI.** Nothing runs on push yet; [ROADMAP.md](ROADMAP.md) has it near the top.
- **Visual regression.** Screens are checked by eye, through screenshots
  ([playbooks/playtest.md](playbooks/playtest.md)).
- **Device testing.** The game hasn't run on an iPhone yet.
