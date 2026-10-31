# Playbook: add a mechanic

Use this for a new power-up, hazard, prop or pickup, like the board's Gust, Hush, Burr or Mawpit. It
lists every file a mechanic touches, in the order that keeps the build green. The best reference
implementations are Swell and Shrink orbs (`orbs`), a pickup, and rootcrushers (`crushers`), a clocked
hazard. Search the code for them and follow the same path.

## 0. Design it with the user

Write down, and get the user's agreement on:

- **The card:** one line, in the boards' voice, like "Speeds up time for 4s.".
- **The rules:** what triggers it, what it does, how long it lasts, and how it works with the flock,
  with Swell and Shrink, with dying and respawning, and with checkpoints.
- **The numbers,** and whether the 1% ramp scales them.
- **What it looks like:** helpful things glow, and hazards are ink.
- **Its first level:** a safe place to show it, a seed that rewards testing it, and a combination
  with an earlier idea.

Add it to [GAME_DESIGN.md](../GAME_DESIGN.md). If it's a big choice, add a record to
[DECISIONS.md](../DECISIONS.md).

## 1. Data

1. **`src/game/types.ts`:** add `interface ThingDef extends Noted { id: string; ... }`, with a comment
   on each field, and `things: ThingDef[]` on `LevelDef`.
2. **`src/game/levels/schema.ts`:** add `'things'` to `Collection`, and a `SCHEMA.things` entry. It
   needs a label, `hasId`, and fields with kinds, `min`, `optional` and hints. These drive validation,
   the editor's form and the file layout.
3. **`src/game/levels/format.ts`:** add `'things'` to `LEVEL_KEYS`, where it belongs in the file.
4. **Existing level files:** validation requires every list, so add `"things": []` to each one first,
   then run `npm run levels:format`:

   ```sh
   node -e 'for (const f of require("fs").readdirSync("src/game/levels/data")) { const p = "src/game/levels/data/" + f; const j = JSON.parse(require("fs").readFileSync(p, "utf8")); j.things ??= []; require("fs").writeFileSync(p, JSON.stringify(j)); }'
   npm run levels:format
   ```

   Another option is to make the list optional, as `labels` and `roots` are. Then the sim must treat
   a missing list as empty.
5. **`src/game/sim.test.ts`:** add `things: []` to the `level()` helper.

## 2. The simulation (`src/game/sim.ts`)

- **State:** add the mechanic's moving parts to `SimState`, and build them in `initialState`. All
  state lives in `SimState`, because snapshots copy only that and the Box2D world. Never keep state in
  module variables or closures.
- **Bodies:** create them in `createSim`, never later.
  - Pick a collision category from `physics.ts` (`CAT` and `MASK`).
  - Tag every shape in `world.tags`: `solid`, a `hazard` with a `Cause`, or a new tag kind.
  - Move moving things by velocity (`moveY`), never by teleporting.
- **Behaviour** goes in the right part of the step:
  - things that move on their own: `driveProps`
  - forces on Puffs: `drivePuffs`
  - touch and sensor results: `readEvents`
  - pickups: `collectPickups`
  - timed effects: `resize`
- **Events:** add a `SimEvent` for anything the player should hear or feel. If it can be deadly, add
  a `Cause` and its fail title in `PlayScene.showFail` ("Shredded.", "Pricked.", and so on).
- **The clock:** if it moves on a clock, pose it in `poseSim(def, t)`, and start it at `t0` in
  `createSim(def, t0)`. Then the editor and test flights show it where a real run would have it.
- **Keep the rules:**
  - no randomness, and no wall-clock time
  - `.delete()` every WebAssembly object
  - forces scale with mass, so a swollen or shrunk Puff still flies the same
  - respawn resets what it should, as `respawn()` does for bubbles and orbs past the bloom

## 3. Drawing

- **`src/render/art.ts`:** add a `drawThing(g, x, y, ...)` primitive using the palette. Helpful things
  get a `glow()`, and hazards are `INK`.
- **`src/render/levelView.ts`:** draw it in `drawWorld`, in the right order (seeds before pebbles,
  so a pebble resting on a seed hides it), and skip it when it's off screen (`on(x0, x1)`).
- **`src/scenes/PlayScene.ts`:** handle its events in `handle()`, with sound (`audio`), haptics
  (`services.buzz`) and particles (`burst`).

## 4. Design checks

In `src/game/levels/lint.ts`, add a check for each way the mechanic can be misused. Examples: "a heavy
log needs a Swell before it", or "a crusher needs a clear drop". Add a failing case to
`levels.test.ts`.

## 5. The editor

- **`src/editor/model.ts`:** an `ID_PREFIX` entry, defaults in `fresh()`, and its x keys in `X_KEYS`.
- **`src/editor/shapes.ts`:**
  - `bounds`, `hits` if it isn't a box, `handles` and `dragHandle` for anything you can size, and `move`
  - a place in `PICK_ORDER`, with smaller things first
- **`src/editor/panel.ts`:** draw it on the minimap (`drawMinimap`). If it's clocked, add a timing card
  like `crusherTiming`.
- **The form** builds itself from the schema.

## 6. The solver

Check whether the solver can find the lines the mechanic creates. The beam is kept diverse by height,
size and flock count (`select` in `solver.ts`). If the mechanic creates a new kind of state that
matters, such as time speed or stickiness, consider adding it to the band key. Give hard puzzles
`route` hints.

## 7. Tests

- **`sim.test.ts`:** one scenario per rule, in a tiny made-up level. Cover the trigger, the effect,
  how long it lasts, how it works with clones and size, and respawn.
- **`levels.test.ts`:** the content facts of the levels that use it.
- **`src/editor/shapes.test.ts`:** a drag or handle test, if it has handles.
- **The full gate:** [verify.md](verify.md), including `npm run test:levels`.

## 8. Docs

- **[LEVELS.md](../LEVELS.md) field reference:** the docs test fails until every new field is listed.
- **[GAME_DESIGN.md](../GAME_DESIGN.md):** the mechanics table.
- **README:** "What's built", plus any departure from the boards.
- **[STATUS.md](../STATUS.md):** what's built, and what's verified.
