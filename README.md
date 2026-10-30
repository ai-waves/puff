# Hollowdrift

A side-scrolling physics flyer for iPhone, built from the Claude Design boards *Hollowdrift Game Artifacts*
and *Hollowdrift World 1 and Level 1-1*. Hold anywhere to puff upward, release to drift, collect seeds,
and bring as many clones home as you can.

Built with **Phaser 4 + TypeScript**, physics by **Box2D v3** (compiled to WebAssembly by
[box2d3-wasm](https://github.com/Birch-san/box2d3-wasm)), and shipped to iOS with **Capacitor**. The game
logic is a deterministic fixed-step simulation that runs headless in tests, and the renderer draws
everything from the boards' shapes and palette. There are no image or audio files.

**Badland rules.** The screen scrolls on its own. Puff drifts forward toward its spot on screen and the
player only controls its height. Anything that blocks Puff makes it fall behind. A Puff that touches
something deadly (briar, a thornwheel, a rootcrusher's underside), or that the left edge of the screen
passes, is lost. A shadow along the left edge marks the danger.

## What's built

**Screen flow (board A).** Title → World select → Level map → Play → Pause / Clear / Fail.

| Board | Screen | Notes |
| --- | --- | --- |
| A1 | Title | Wordmark in the silhouette layer, Puff bobbing by the sun. The first hold starts the last unfinished level. Skins and Settings pills. |
| A2 | World select | Four palette cards. Worlds open by total seeds. |
| A3 | Level map · Mossdeep | Vine path, seed dots under cleared levels, Puff waiting at the next level, goal card with Play. |
| A4 | Gameplay HUD | Pause, progress bar with checkpoint ticks, seeds, live clone count. 85% opacity, full when something changes. Ink turns pale when the play layer shades the HUD. |
| A5 | Pause | World stays visible under the dark overlay. Resume, Restart, Map. Music, Sound and Haptics toggles, evenly spaced and centred under the buttons. |
| A6 | Level clear | "Home.", clones saved, seeds filling in one at a time with chimes, time, Replay and Next. |
| A7 | Fail · last clone lost | Drained sky, cause title ("Shredded.", "Pricked.", "Squashed.", "Left behind."), Retry from checkpoint, Restart. |

**Puff (board B).** Round body with 8 tufts, one big eye that looks toward the next hazard, a blush, and
the game's only green, the sprout. States: drift (slight sway), puff (stretches up while held), bonk
(squash and squint), sleep (1-1's wake), and lost (tufts scatter, sprout wilts). Clones have no sprout;
when the leader is lost, the next clone takes the lead.

**Physics.** Every prop is a Box2D body. Logs are planks on revolute joints that tip under weight. Pebbles
roll, and boulders slide. Gates, thorn curtains and rootcrushers are kinematic bodies. Thornwheels spin.
Collision shapes match the drawings: rounded corners are real curves, and logs and gates are capsules.
Puff is a circle with a slightly smaller sensor for hazards, so a graze is forgiven. Forces scale with
mass, so a swollen or shrunken Puff flies exactly like a normal one; it only pushes harder or softer.

**Chapter 1 · First Flight (level board, levels 1-1 to 1-5).** Each level follows its map, beats and
tuning table. The 1% ramp `D(n) = 1.01^(n-1)` scales scroll speed, gaps, windows and wheel spin.

| Level | New idea | Mechanics |
| --- | --- | --- |
| 1-1 First Light | Hold to fly | "Hold" hint, moss mound, 110pt hollow log for 6 s with "Tap to stay level" printed on its floor, bloom where the scroll lingers, Mossback log preview with a pebble in its cradle, vine weave, alcove seed. Nothing deadly; only the scroll can leave Puff behind. |
| 1-2 Mossback | Props and gates | Pebbles roll when bumped, logs tip when you land on their high end, gates creak up into the roof in view of their log, a pebble rolls off a mound and tips a log, a timed gate drifts shut over 3 s, a root on the ceiling points to the right log, and the wrong log bounces you. Three knocks on the results screen. |
| 1-3 Briarwood | Death | Briar seen behind glass first, instant 0.4 s respawn at blooms (no fail screen), thorn-roofed log, thorn curtain lifted by a log, a 108pt slalom ending two screens before the burrow. |
| 1-4 Bramble Run | Clones | Split bubbles, clones copying input 80 ms late within a 45pt spread, any clone collecting seeds, blooms saving the clone count, a 107pt bramble run for 10 s. Badge for 5 home. |
| 1-5 Thornwheel Glade | Moving hazards | 9 thornwheels at 94°/s: a resting one, a seed riding a missing tooth, a wheel jammed by a pebble, a log knocked on a beat, and three counter-rotating wheels over briar. Wheels freeze for 1 s after a respawn. Badge for 6 home, then the "First Flight" chapter card. |

**Chapter 2 · Undergrowth (levels 1-6 to 1-10).** The board gives this chapter one line ("Swell, Shrink,
Rootcrusher"), plus the power-up and hazard cards and each level's sky. The levels are designed here to
the board's rule for every new idea: show it in a safe spot, test it once with a seed as the reward, then
combine it with an idea from an earlier level.

| Level | New idea | Mechanics |
| --- | --- | --- |
| 1-6 Puffball Patch | Swell (grow 1.8×) | A Swell orb in open sky. A boulder only a swollen Puff can shove, with a seed behind it. Heavy logs whose hinge only gives under a swollen Puff: one opens a gate, one lifts a thorn curtain. |
| 1-7 Needle's Eye | Shrink (0.5×) | Bramble gaps: thorns tip to tip, 22pt apart. A normal Puff can't fit; a shrunk one slips through. A lower-lane eye, a full bramble wall, a slalom where the Shrink wears off partway, and an upper-lane eye. |
| 1-8 Rootfall | Rootcrusher | Root columns that slam on a beat, with dust falling first. Up, fly under; down, they're a wall that only bumps. A first slow one, a seed underneath one, a row of three, then a crusher-and-thornwheel weave. |
| 1-9 Fernshade | Size on the fly | Swell for a heavy log, then Shrink straight away for the bramble beyond. Low crushers only a shrunk Puff fits under. |
| 1-10 Last Light | Everything, as a flock | The finale, with up to 6 Puffs. A Swell orb swells the whole flock onto a heavy log. A Shrink orb bunches the flock to fit a bramble gap. Then a crusher-and-thornwheel glade. Badge for 6 home, then the "Undergrowth" chapter card. |

**Audio and haptics.** Low wind and crickets, plus a music-box melody that adds a voice for each living
clone. Synthesized chimes, knocks, pops and fluff. Haptics go through `@capacitor/haptics` and are off by
default, as the Pause frame shows. Progress is stored in `@capacitor/preferences` (UserDefaults on iOS).

## Run

```sh
npm install
npm run dev          # play in a browser at the printed URL
npm test             # unit tests: tuning, geometry, every mechanic, level data vs the board, progress
npm run test:levels  # slow (several minutes): a beam-search player proves every level is finishable,
                     # every one of the 30 seeds is collectable, and the three clone badges are earnable
npm run build        # typecheck + production bundle in dist/
```

## Level editor

Run `npm run dev` and open `http://localhost:5173/?edit=1-2`. You can also press **Edit 1-2** on the level
map, or press **E** while playing to edit the level from where you are. The editor is in dev builds
only: `npm run build` leaves it out.

The editor draws the level exactly as the game does, one screen at a time, with a form for the
selected object beside it.

- **The clock.** The editor always shows one moment of a run. The slider, the mouse wheel and dragging
  empty space all move through the level the way the scroll does. Rootcrushers, thornwheels and beat
  logs move with the clock, and ▶ (Space) plays it. The ghost Puff is a Puff keeping its place on
  screen at that moment.
- **Select and drag** anything. Handles resize blocks, mounds, crushers, wheels and pebbles. They also
  set each briar spike's height and the number of spikes, lengthen logs, and place where gates and
  curtains go when open; those other states show as outlines. Drag the start Puff, the burrow and the
  END line too. Positions snap to 5pt: Alt drags freely, Shift keeps to one axis, and the arrow keys
  nudge.
- **The panel** lists every field of the selected object, including its design note. The forms come
  from the same schema the loader validates against. With nothing selected, it shows the level's own
  fields: name, length, sky colours, what losing every Puff does, and so on. Renaming an ID also renames
  everything that points at it.
- **Timing.** A selected rootcrusher shows its beat against the moment a Puff keeping its place is
  under it, with the room left and a button that times it for you. A beat log shows which end is up
  when Puff arrives.
- **Problems** lists the design checks the level tests run, such as a gate out of sight, a buried seed,
  a heavy log with no Swell before it, or a bramble too tight to pass. It also lists anything that would
  stop the level loading. Click a problem to go to it.
- **Test flight (P)** flies from the ghost Puff with the clock where it is. Esc comes back to the
  editor with nothing lost.
- **Save (Ctrl+S)** writes `src/game/levels/data/<id>.json` in canonical form, so the diff shows only
  what changed. A level with problems still saves; one the game couldn't load doesn't. Unsaved changes
  survive a reload.
- **Keys.** Ctrl+Z and Ctrl+Shift+Z undo and redo, Ctrl+D duplicates, and Delete deletes. On a Mac, use Cmd
  instead of Ctrl.

After big changes, run `npm run test:levels` to prove the level can still be finished and every seed
reached.

## iOS

Building for iOS needs macOS and Xcode:

```sh
npx cap add ios      # once
npm run ios:sync     # build and copy into the Xcode project
npx cap open ios     # run on a simulator or device
```

In Xcode, set the target to landscape only. Box2D runs as WebAssembly inside WKWebView. The game uses
box2d3-wasm's compat build, which needs no SIMD, threads or cross-origin isolation, so it runs on every
iOS version Capacitor supports.

## Layout

```
src/config/      palette, constants (physics, screen, safe area), tuning (the 1% ramp)
src/game/        physics.ts (Box2D loading, units, shape builders), sim.ts (the Box2D level simulation),
                 geometry, types, progress, solver (tests only: beam search over Box2D snapshots)
src/game/levels/ data/*.json, one file per level with design notes beat by beat; schema (fields and
                 validation), format (the file form), lint (design checks); solvable/ holds the slow
                 solver checks, one file per level
src/editor/      the level editor (dev builds only): scene, model (undo), shapes (handles), panel (forms)
src/render/      art.ts (Puff and world objects), levelView.ts (draws a level; play and the editor share
                 it), ui.ts (UI kit), panels.ts (settings, toasts)
src/scenes/      Title, World, Map, Play (HUD, pause, fail), Clear (and the chapter card)
src/audio/       synthesized ambience, music box and effects
src/platform/    Capacitor storage and haptics
```

## Where the boards disagreed or couldn't be taken literally

- **Seeds per world.** The level board's structure is 10 levels per world (30 seeds), not the 20 levels
  (60 seeds) the A2/A3 mocks show. So the map has 10 nodes and the world cards read "x / 30". Rustwell opens
  at 20 seeds (the board gives no number), Brinefall at 45 (the board's 90, halved with the world), and
  Stillsky when Brinefall is finished (verbatim).
- **Fail screen.** 1-3 respawns instantly with no fail screen, as its beats say, and so do the other
  single-Puff levels. The A7 fail screen appears in the clone levels (1-4, 1-5 and 1-10) when the last
  clone is lost. Only "Shredded." is designed; briar reads "Pricked.", a rootcrusher "Squashed." and the
  scroll "Left behind.".
- **Split bubble.** Every Puff touching a bubble as it pops splits in two, up to 6. This is the one rule
  that satisfies "popping it makes two Puffs", "Three", "as many as 6 Puffs", "topped up to 6" and the
  card's "+2 clones".
- **Puff only flies forward.** Two seed puzzles describe reaching back under a tipped log, which a
  forward-drifting Puff can't do. In 1-1, a pebble rests in a knot on the Mossback log's low end, right on
  seed 2, which rides the log. Landing on the high end tips the log, the pebble rolls away, and the seed
  rises into reach. In 1-2, seed 3 is a steep dive just past the right log's raised end; "Grab, then tip"
  can't be enforced.
- **Timed gate (1-2).** Gate 2 opens when log 2 tips, then drifts shut over 3 s once Puff comes within
  260pt. Taken literally, the beat timestamps would shut it before Puff ever arrived.
- **Nothing can end a run until 1-3.** The board says so, but with Badland rules the scroll can still
  leave Puff behind in 1-1 and 1-2. There it re-forms at once at the last bloom, with no fail screen and no
  counter. A re-formed Puff, in any level, waits for a fresh hold before the scroll starts again; the
  "Hold" ring shows meanwhile.
- **Gates in view (1-2).** "Gate 1 creaks up in full view" didn't hold: the gate stood off-screen from its
  log, a closed bar from roof to floor. Even open, it hung down to mid-screen like a long block. Every gate
  now sits on the same screen as the log that works it, and opens right up into the roof. Pebble 2 rests
  on the mound's flat top and log 2's high end is tucked under the mound's edge, so the pebble drop works
  with real physics.
- **Map scale vs text.** The level maps are illustrative and their beat timestamps don't line up with the
  scroll speed. Positions follow the maps. Where the text gives a number (110pt for 6 s, a 10 s bramble
  run, thorns ending two screens before the burrow), the number wins.
- **Puff size.** Drawn 30pt across, matching the level board's tuning ("Puff is 30pt across"). The A4
  mock draws Puff larger.
- **Silhouettes behind UI.** On Title and the Level map, the board's CSS puts a black blob behind ink UI
  (the Settings pill, the "Mossdeep" header), which would make them invisible. Those blobs are nudged
  clear.
- **Skins.** The button is there, but no Skins screen is designed; it shows "Skins are coming in a later
  update". Settings on the title opens the same three toggles as Pause.
- **Clones left behind.** A clone the left edge of the screen passes is lost, like the leader.
- **Chapter 2 is designed here.** Level names, beats and layouts for 1-6 to 1-10 are new, built from the
  board's one-line chapter spec, its Swell, Shrink, Briar and Rootcrusher cards, and its sky for each
  level.
- **Heavy logs.** "Heavy enough to tip ledges" became heavy logs: their hinge holds against anything
  lighter than a swollen Puff, then lets go and Box2D tips them. A counterweight alone couldn't tell the
  two apart, because a normal Puff dropped from the roof carries as much momentum as a swollen one's
  weight.
- **Swell and Shrink are flock-wide.** The first Puff to touch an orb pops it and the whole flock changes
  size, which last 5 to 9 s depending on the orb. A shrunk flock bunches up, so it fits where its leader
  fits.
- **Rootcrushers are columns.** The card shows a block above a strip of falling dust. In play, a
  rootcrusher is a column of roots from the roof, so Puff can never get above one and be squeezed against
  the roof as it rises. Only its toothed underside is deadly.
- **Boulders slide.** Boulders are octagons. A round one rolled too easily for a normal Puff to be kept
  from pushing it.

## Not built yet

- Worlds 2 to 4. They aren't designed yet, so their world cards say "Coming soon".
- Gust, Hush and Burr power-ups and the Mawpit hazard. They belong to chapters 3 to 8.
- Final art. Per the board, Puff and the scenery are placeholder shapes until the illustrator's art.
