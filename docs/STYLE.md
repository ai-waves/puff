# Style

How the code and the game's words read. When this page and the code disagree, match the code around
you and fix this page.

## TypeScript

- Strict mode with `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch`
  (`tsconfig.json`). The tsconfig has `types: []`, so don't use Node globals in `src/`. The config files
  and `scripts/` sit outside it.
- No `any`. Prefer `unknown` plus a check, or a precise type. Use `!` only where the index is known to
  be valid, for example `def.seesaws[i]!` inside a loop over `def.seesaws`.
- Use interfaces for data and string unions for kinds (`'latch' | 'timed'`), and `as const` for lookup
  tables.
- `src/game/` is functions over plain data, with no classes and no hidden state; `Sim` is a plain
  object. Scenes, the editor controller and the audio engine are classes.
- Export only what's used elsewhere. One concept per module.
- Tests sit next to the code as `*.test.ts`. Slow tests are `*.slow.test.ts`.

## Formatting

No formatter or linter is configured yet, so match the code around you:

- 2-space indent, single quotes, semicolons, trailing commas in multi-line lists
- no hard line limit, though most lines stay under about 150 characters; short objects go on one line
- `import type` for types
- relative imports with no file extension

## Comments

- Every module opens with a comment saying what it is and why it exists, for example
  `// Beam search over hold/release decisions. ...`.
- Comments say *why*, or what something means in the game: `// a sensor must not weigh anything`.
  Don't restate what the code says.
- Write plain sentences in the present tense. Reference the boards by name when a number comes from
  them: `// (1-4 tuning: clone lag 80 ms)`.
- Put units in the comment when the name doesn't carry them: `// pt/s`, `// s`, `// rad/s`.
- Leave no `TODO` in code. Put it in [ROADMAP.md](ROADMAP.md) instead.

## Names: the game's vocabulary

Code uses short names for the game's things. Docs, UI copy and commit messages use the game's names.

| Game | Code | Notes |
| --- | --- | --- |
| Puff, the leader | `puffs[0]` | The only one with a sprout |
| Clone | `puffs[1..]` | |
| Block | `rects` | With looks such as block, log, shelf, ledge, vine, lip and mound |
| Moss mound | `humps` | |
| Mossback log | `seesaws` | Modes: free, dud, return, beat; options: heavy, cradle |
| Gate | `gates` | |
| Thorn curtain | `curtains` | |
| Briar or bramble | `briars` | A bramble gap is a pair of briars, one hanging and one rising |
| Thornwheel | `wheels` | |
| Pebble and boulder | `pebbles` (`heavy`) | |
| Rootcrusher | `crushers` | |
| Split bubble | `bubbles` | |
| Swell and Shrink orbs | `orbs` (`kind`) | |
| Seed | `seeds` | |
| Bloom (checkpoint) | `blooms`, `checkpoint` | |
| Burrow (goal) | `burrowX` | |
| The scroll | `camX` | World x of the screen's left edge |
| Puff's spot on screen | `PUFF_SCREEN_X` (280) | |
| Losing every Puff | `deaths: 'instant' \| 'screen'` | |

## Numbers

- **Feel and tuning** go in `src/config/constants.ts` and `src/config/tuning.ts`, with a comment
  saying where they came from.
- **Mechanism constants** that only the sim needs live at the top of `sim.ts`, named and commented
  (`KNOCK_TORQUE`, `SENSOR_GRACE`).
- **Level numbers** live in the level's JSON, never in code.

## UI

- Build UI with the kit in `src/render/ui.ts`: `label`, `button` (primary or secondary pills),
  `iconButton`, `toggle`, `seedDots`. Change scenes with `go()`, which fades.
- Colours come from `src/config/palette.ts` and nowhere else. Use `css()` for Phaser text colours.
- The fonts are Fredoka (400 to 700) for UI and JetBrains Mono for small, spaced labels (`mono: true`).
- Hit targets are at least 44 pt. Keep UI inside the notch-safe area: 47 pt left and right, 21 pt at
  the bottom (`SAFE`).
- Layer with `DEPTH` from `render/levelView.ts`. The HUD sits at 85% opacity, and full while something
  changes.
- Phaser containers report no size, so give hit areas explicit rectangles, as `tappable()` does.

## Copy

- Copy is light, short and a little cheeky, in the boards' voice. Titles are one or two words ending
  in a full stop, like "Home." and "Squashed.". Buttons are verbs: Resume, Restart, Retry.
- Say what something does in the game's terms ("Bring 5 clones home."), not in technical ones.
- Use sentence case, and Title Case only for proper names (Puff, Mossdeep, Rootcrusher).
- Every user-facing string is in the scenes (no i18n yet). Put new copy where the screen is built.

## Docs

- Each doc covers one topic. Link rather than repeat, and keep `AGENTS.md` and `CLAUDE.md` short, since
  agents load them into every session.
- Put file paths, commands and code names in backticks so `src/docs.test.ts` can check them.
- Record a big decision in [DECISIONS.md](DECISIONS.md), with its context and consequences, the day you
  make it.
