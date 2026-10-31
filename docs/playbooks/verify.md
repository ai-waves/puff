# Playbook: verify a change

Run this before every commit you'd hand to someone else. Stop at the first failure and fix it; don't
skip steps.

## 1. Always

```sh
npm run typecheck        # no type errors, no unused names
npm test                 # unit tests, about 1 s; must be all green
npm run build            # typecheck and production bundle
```

Then confirm the production bundle leaves out the level editor. This should print nothing:

```sh
grep -rl "__editor\|ed-bar" dist/ || true
```

## 2. If you touched the simulation, physics, tuning or levels

The trigger is any change under `src/game/sim.ts`, `src/game/physics.ts`, `src/game/solver.ts`,
`src/config/` or `src/game/levels/data/`.

```sh
npm run levels:format    # level files canonical; reports design problems
npm run test:levels      # about 5 min; run it in the background and keep working
```

Expect every test to pass, with exactly 7 skipped (the badge tests of levels that have no badge).
For one level, run `LEVELS=1 npx vitest run src/game/levels/solvable/l18.slow.test.ts`. If something
fails, follow [TESTING.md](../TESTING.md#the-solver-suite).

## 3. If you touched anything on screen

That means scenes, rendering, UI, audio triggers or the editor. Follow [playtest.md](playtest.md):
load the screens you changed, act on them, take screenshots and look at them, and check the console
for errors.

## 4. Before you commit

- `git status`: no stray files, such as scratch scripts, screenshots or a changed level file you
  didn't mean to save.
- `git diff`: read it as a reviewer would, using [WORKFLOW.md](../WORKFLOW.md#review-checklist).
- The docs say what's now true: the README, `docs/`, and always `docs/STATUS.md`.

## Report honestly

When you tell the user what you verified, say which of these steps you ran and what they printed.
For example: "unit tests all pass, solver suite not run, browser not checked." Never write
"verified" for a step you skipped.
