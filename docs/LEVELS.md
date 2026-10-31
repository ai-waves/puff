# Levels

How levels are stored, checked, edited and proven. If you're new to the game's objects, read
[GAME_DESIGN.md](GAME_DESIGN.md) first.

## Where levels live

- Each level is a JSON file, `src/game/levels/data/<id>.json`. For example, `1-2.json` is world 1,
  level 2.
- `src/game/levels/index.ts` imports each file explicitly, runs it through `parseLevel`, and exports
  `LEVELS` in play order. The map, progress and unlocks all follow that order.
- `parseLevel` (`format.ts`) turns `"#rrggbb"` sky colours into numbers, then validates against
  `schema.ts`. An invalid file throws with every problem listed, so the game refuses to start rather
  than play a broken level.

## Coordinates

| | |
| --- | --- |
| Units | points (pt). Box2D uses metres internally, at 30 pt to the metre. |
| x | distance along the level, from 0 to `length` |
| y | grows downward. The roof is at y 14 and the floor at y 350. |
| Screen | 844 × 390 pt, landscape iPhone. Puff keeps to screen x 280. |
| Scroll | 120 pt/s × `1.01^(n-1)` for level number `n` |
| Puff | radius 15 (clones 10). A Swell makes it 1.8×, a Shrink 0.5×. |

## Changing a level

1. **Use the level editor.** Run `npm run dev`, then open http://localhost:5173/?edit=1-2. It shows the
   level exactly as the game draws it, at any moment of a run, and saves the file in canonical form.
   The README's "Level editor" section covers it.
2. **Or edit the JSON by hand,** then run `npm run levels:format`. It checks every level file, rewrites
   each one in canonical form, and prints any design problems. The format test fails on any file
   that isn't canonical.
3. **Then verify:**
   - `npm test` runs validation, design checks and the level content tests.
   - `npm run test:levels` proves the level can still be finished, each seed collected and each badge
     earned.

The step-by-step version, including adding a new level, is
[playbooks/level-change.md](playbooks/level-change.md).

## Canonical form

`formatLevel` writes keys in schema order, numbers rounded to 3 decimals, sky colours as hex, and
short objects and lists on one line (up to 120 characters). A save changes only the lines whose values
changed, so diffs stay reviewable. Never reformat a level file with another tool.

## Design checks (`lint.ts`)

`lintLevel(def)` finds layouts that load fine but play badly. The editor shows them live; the tests
require none in shipped levels.

| Check | Severity |
| --- | --- |
| Anything the schema rejects (missing field, bad value, broken reference, duplicate ID) | error |
| The burrow is past the end of the level | error |
| Puff starts inside solid ground | error |
| A bloom re-forms Puff inside solid ground (at y 190) | error |
| Blooms aren't in order along the level (they open in list order) | warn |
| A free seed is inside solid ground, or outside the play field | warn |
| A gate is too far past its log to be on screen when the log tips | warn |
| A gate is behind its log (Puff only flies forward) | warn |
| An open gate still hangs below the roof, so it reads as a wall | warn |
| A heavy log has no Swell orb in the 700 pt before it | warn |
| A rootcrusher would slam into a block | error |
| A rootcrusher rests so low that nothing fits under it | warn |
| A bramble gap is too tight for a normal Puff, with no Shrink orb in the 700 pt before it | warn |
| A bramble gap is too tight even for a shrunk Puff | error |
| An object is past the end of the level | warn |

To add a check, put it in `lintLevel` and a failing case in `levels.test.ts`. Every shipped level has
to pass it.

## Timing against a Puff keeping its place

Clocked hazards (rootcrushers, thornwheels and beat logs) run on the run's clock, which starts at the
first hold. `arrivalTime(def, x)` in `sim.ts` says when a Puff keeping its place on screen reaches x.

- **In the editor.** Select a crusher to see its beat against that moment, and use **Time it** to set
  its offset so the column has just finished lifting.
- **When the level was authored.** Chapter 2's crushers were timed with `beatCrusher` in
  `levels/util.ts`, which adds 0.5 s for Puff getting going. So the editor shows 1-8's first crusher
  still finishing its lift as Puff arrives. The solver proves every level passable either way.

## Routes: hints for the solver

The solver plays by beam search. A narrow puzzle may need a hint, so a level, or a seed, can carry a
`route`: a list of `[x, y]` points the leader should pass through.

- Points within 600 pt of each other make a line the solver keeps close to.
- A stretch where neighbouring points are more than 600 pt apart is left free.
- A seed's route wins over the level's where both cover the same x.
- Routes only affect the tests, never the game. Turn on **Solver lines** in the editor to see them.

When a solver test fails, look first at where the best run got to (`bestX`). Then:

1. Fix the design problem the editor shows, if there is one.
2. Test-fly that stretch yourself (**P** in the editor).
3. Only then add or adjust a route.

Wider searches for particular seeds are set in `levels/solvable/check.ts` (`SEED_BEAM`).

## Field reference

`src/game/levels/schema.ts` is authoritative. This table mirrors it, and `src/docs.test.ts` fails if a
schema field is missing here. Every object can also have a `note` (free text about what it's for in the
level's beats; the game ignores it), and every kind except labels and roots has a unique `id`.

### Level

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `n`, `world` | text, number, number | `"1-2"`, global level number (1 to 40), world number. Not editable in the editor. |
| `name`, `blurb`, `teach` | text | Name, the level card's goal line, what the level teaches |
| `notes` | text, optional | The level's design notes, beat by beat |
| `length` | number | Level length in pt (at least 844) |
| `startX`, `startY` | number | Where Puff starts |
| `burrowX` | number | The goal |
| `deaths` | `instant` \| `screen` | What losing every Puff does: re-form at once, or show the fail screen |
| `goalClones` | int, 1 to 6 | Clones home for the badge; 1 means the level has no badge |
| `sky` | colour stops | `[[position 0-1, "#rrggbb"], ...]`, top to bottom, at least 2 |
| `sunX`, `sunY` | number | The sun, in screen coordinates (it doesn't scroll) |
| `hint` | bool, optional | 1-1's "Hold" ring |
| `perch` | bool, optional | Start asleep on a dandelion head |
| `lingerAtBloom` | bool, optional | The scroll pauses 0.5 s at the first bloom |
| `rootTrail.x0`, `rootTrail.x1`, `rootTrail.y` | number, optional | A root along the ceiling pointing to a gate's log |
| `route` | points, optional | The solver's line (tests only) |

### Block · `rects`

| Field | Type | Notes |
| --- | --- | --- |
| `look` | `block` `log` `shelf` `ledge` `vine` `lip` `mound`, optional | How it's drawn; `mound` is bouncy, and `vine` is a thin stem with a knot |
| `x0`, `x1`, `y0`, `y1` | number | Left, right, top, bottom |
| `round.tl`, `round.tr`, `round.bl`, `round.br` | number ≥ 0, optional | Corner radii, which are real curves in the physics too |

### Moss mound · `humps`

| Field | Type | Notes |
| --- | --- | --- |
| `cx` | number | Centre x |
| `width` | number ≥ 20 | |
| `height` | number ≥ 5 | Rises from the floor |

### Briar · `briars`

| Field | Type | Notes |
| --- | --- | --- |
| `x0` | number | Left edge |
| `base` | number | y the spikes stand on (`up`) or hang from (`down`). 350 is the floor, 14 the roof. |
| `side` | `up` \| `down` | |
| `width` | number ≥ 4, optional | Spike width, default 20 |
| `spikes` | numbers | Spike heights, left to right |

### Log · `seesaws`

| Field | Type | Notes |
| --- | --- | --- |
| `px`, `py` | number | Pivot |
| `half` | number ≥ 20 | Half the plank's length |
| `high` | `left` \| `right` | Which end starts raised |
| `mode` | `free` `dud` `return` `beat`, optional | Default `free`. `dud` bounces and never tips; `return` tips back; `beat` swings on a beat. |
| `returnAfter` | number ≥ 0, optional | Seconds before a `return` log tips back (default 3) |
| `beat` | number ≥ 0.2, optional | Seconds per swing for a `beat` log (default 1.5) |
| `baseY` | number, optional | Where the fulcrum stands (default the floor) |
| `heavy` | bool, optional | Only a swollen Puff tips it |
| `cradle` | bool, optional | A knot on the low end holds a pebble until the log tips |

### Gate · `gates`

| Field | Type | Notes |
| --- | --- | --- |
| `x` | number | Left edge of the 14 pt bar |
| `openBottom` | number | The bar's bottom edge when open. Keep it in the roof (about 40). |
| `link` | log ID | The log that opens it |
| `mode` | `latch` \| `timed` | `latch` stays open; `timed` drifts shut |
| `closeTime` | number ≥ 0.2, optional | Seconds to close (default 3) |
| `closeAhead` | number ≥ 0, optional | Starts closing when Puff is this close, in pt (default 260) |

### Thorn curtain · `curtains`

| Field | Type | Notes |
| --- | --- | --- |
| `x0`, `x1` | number | Left and right |
| `openBottom` | number | Bottom edge when lifted |
| `closedBottom` | number | Bottom edge when down |
| `link` | log ID | The log that lifts it |

### Thornwheel · `wheels`

| Field | Type | Notes |
| --- | --- | --- |
| `cx`, `cy` | number | Centre |
| `r` | number ≥ 10 | Radius to the thorn tips |
| `spin` | number | Degrees per second; negative turns the other way |
| `missingTooth` | bool, optional | A gap a seed can ride in |
| `jammable` | bool, optional | A pebble in the axle stops it |
| `post` | bool, optional | Drawn on a post down to the floor |
| `hang` | number, optional | Drawn hanging from this y |

### Pebble · `pebbles`

| Field | Type | Notes |
| --- | --- | --- |
| `x`, `y` | number | Centre |
| `r` | number ≥ 6 | Radius |
| `heavy` | bool, optional | A boulder that only a swollen Puff can shove |

### Rootcrusher · `crushers`

| Field | Type | Notes |
| --- | --- | --- |
| `x` | number | Centre x |
| `width` | number ≥ 20 | |
| `rest` | number | y of its underside while raised |
| `period` | number ≥ 1.6 | Seconds per slam, before the 1% ramp |
| `offset` | number, optional | Seconds; shifts this crusher's beat |

### Seed · `seeds`

| Field | Type | Notes |
| --- | --- | --- |
| `x`, `y` | number | Position of a free seed |
| `orbit.wheel`, `orbit.radius` | wheel ID, number, optional | Rides a thornwheel's missing tooth |
| `ride.log`, `ride.at`, `ride.lift` | log ID, −1 to 1, number, optional | Rides a log: `at` runs from the left end (−1) to the right end (1), and `lift` is pt above the plank |
| `route` | points, optional | The solver's line to this seed (tests only) |

### Split bubble · `bubbles`

| Field | Type | Notes |
| --- | --- | --- |
| `x`, `y` | number | Centre |

### Swell or Shrink orb · `orbs`

| Field | Type | Notes |
| --- | --- | --- |
| `x`, `y` | number | Centre |
| `kind` | `swell` \| `shrink` | |
| `time` | number ≥ 1, optional | Seconds the size lasts (default 6) |

### Bloom (checkpoint) · `blooms`

| Field | Type | Notes |
| --- | --- | --- |
| `x` | number | Puff re-forms here at y 190. Blooms open in list order. |

### Label · `labels` (no ID)

| Field | Type | Notes |
| --- | --- | --- |
| `text` | text | Printed on the world, for example 1-1's "Tap to stay level" |
| `x`, `y` | number | Left end and vertical centre |

### Root · `roots` (no ID)

| Field | Type | Notes |
| --- | --- | --- |
| `x` | number | |
| `y0` | number | Top |
| `len` | number ≥ 2 | Length. Roots twitch but never hurt. |

## Level design guidelines

These come from the boards and from building chapters 1 and 2.

- **One new idea per level.** Show it somewhere safe, test it once with a seed as the reward, then
  combine it with an earlier idea. A chapter's last level combines everything from that chapter.
- **Write the beats down.** Each level has about 10 beats with a tension curve, and its `notes` record
  them. Each object's `note` says which beat it belongs to.
- **Use the ramp for the numbers.** Take the gap, speed and spin from `tuning(n)`. Narrow passages use
  exactly the level's gap.
- **Make the screen readable.** Hazards should be visible before they matter, about one screen ahead.
  Gates sit on the same screen as their logs. Thorns end about two screens before the burrow.
- **Put blooms before the hard stretches.** Spacing follows `tuning(n).checkpointSpacing`.
- **Give each seed a reason.** A seed rewards a risk or a detour, and the three seeds in a level ask
  for different skills.
- **Remember the flock.** In the clone levels, a lost clone is a lesson rather than a failure.
  Badges ask for most of the flock home, not all of it.
