# Status

The shared state of the project. **Read this first. Update it last, before you hand off**
([playbooks/handoff.md](playbooks/handoff.md)). Keep it short and true: what's built, what's verified,
what's in progress, and what's known to be wrong.

_Last updated: 2026-10-31._

## In one paragraph

World 1 (Mossdeep, levels 1-1 to 1-10, chapters First Flight and Undergrowth) is built, and the tests
prove it can be finished, with every seed and every badge. The game runs on Box2D v3 by Badland rules.
Levels are JSON files with a dev-only visual editor. All screens on board A are built. It hasn't yet run
on an iPhone, there's no CI, and worlds 2 to 4 exist only as the board's chapter plan.

## Branches

- `main` has everything up to the level editor (PR #3, merge commit `a8e897c`).
- `claude/design-rewrite` is the agent working branch. It was reset onto `main` after PR #3 merged,
  and carries the agent documentation (`AGENTS.md`, `CLAUDE.md`, `docs/`, the skill and rule files) and
  `npm run levels:format`.

## Built

- **Screens (board A):** Title, World select, Level map, Gameplay HUD, Pause, Level clear (with the
  chapter cards), and Fail.
- **Puff (board B):** drift, puff, bonk, sleep and lost states; an eye that looks ahead; clones.
- **Mechanics:** blocks, mounds, Mossback logs (free, dud, return, beat, heavy, cradle), pebbles and
  boulders, latch and timed gates, thorn curtains, briar, thornwheels (missing tooth, jammable), Split
  bubbles, Swell and Shrink orbs (flock-wide), rootcrushers, seeds (free, riding a log, orbiting a
  wheel), blooms and the burrow.
- **Levels:** 1-1 to 1-10 as JSON with design notes. They pass the design checks and are proven by
  the solver.
- **Level editor (dev):**
  - The editor shows any moment of a run, and you drag objects or their handles.
  - Forms come from the schema, with undo and redo and live design checks.
  - A crusher shows its timing against the arrival of a Puff keeping its place.
  - Test flights start anywhere.
  - It saves the level file, and keeps a draft through a reload.
- **Persistence:** progress and settings in Capacitor Preferences.
- **Audio:** synthesized ambience, a music box that adds a voice per living clone, and effects.
  Haptics go through Capacitor and are off by default.
- **Tooling:**
  - `npm run levels:format` rewrites level files in canonical form.
  - The solver suite proves levels.
  - `src/docs.test.ts` keeps the docs true.

## Verified

| Check | Result | When |
| --- | --- | --- |
| `npm run typecheck` | clean | 2026-10-31 |
| `npm test` | all pass (177 tests in 9 files, 83 of them checking the docs) | 2026-10-31 |
| `npm run test:levels` | all pass (43 pass, 7 skip: the badge tests of levels without a badge), about 303 s | 2026-10-30 |
| `npm run build` | passes; `dist/` has no editor code | 2026-10-31 |
| Headless Chromium | title, map, playing 1-8, and editor flows (select, drag, resize, undo, save, test flight, reload draft, switching levels), with no console errors | 2026-10-30 |

**Not verified yet:**

- Safari or WebKit. All the browser checks ran in Chromium, but the iOS app runs in WKWebView.
- A real iPhone (performance, audio unlock, haptics, safe areas, landscape lock).
- A generated Xcode project (`ios/` doesn't exist yet).

## In progress

Nothing. Before you start work, add a line here: who, branch, task.

## Known issues and tech debt

1. **There's no CI.** Nothing runs automatically on a push ([ROADMAP.md](ROADMAP.md) R1).
2. **The bundle is large.** The main JS chunk is about 1.5 MB (Phaser), and Vite warns about it. It
   doesn't matter much inside the iOS app, but it does for a web release. Split Phaser into its own
   chunk.
3. **Two models of crusher timing.** Chapter 2's crushers were timed by `beatCrusher` (in
   `levels/util.ts`), which adds 0.5 s for Puff getting going. The editor's clock assumes Puff is in
   place from the first hold. Both pass the solver, but agree on one model before tuning crushers.
4. **`src/game/levels/util.ts` is unused** since levels moved to JSON. Either remove it, or make it
   editor tools (a "bramble gap" and "time this crusher" generator).
5. **Seeds attached to something keep a misleading position.** A seed that orbits a wheel or rides a
   log still has its own `x` and `y`, which nothing uses and which can disagree with where it's drawn.
   Either derive them, or drop them for attached seeds.
6. **Validation misses half-filled groups.** A seed's form can create a half-filled `ride` (an `at`
   with no `log`). The game survives it, but validation should require a group's main field once the
   group exists.
7. **The editor can't add new levels.** A new file needs an import in `levels/index.ts`, a solver test
   file, and a node on the map ([playbooks/level-change.md](playbooks/level-change.md)).
8. **The map shows world 1 only.** World select shows four cards, and worlds 2 to 4 say "Coming soon".
9. **No formatter or linter is configured.** Style is by convention ([STYLE.md](STYLE.md)).
10. **Placeholder screens.** The Skins screen is a placeholder toast, and the art is placeholder until
    the illustrator's art arrives.

## Next up

The top of [ROADMAP.md](ROADMAP.md): CI, an iOS build on a device, then Chapter 3 (Cogworks) once its
mechanics are designed with the user.
