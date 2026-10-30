# Hollowdrift

A side-scrolling physics flyer for iPhone, built from the Claude Design boards *Hollowdrift Game Artifacts*
and *Hollowdrift World 1 and Level 1-1*. Hold anywhere to puff upward, release to drift, collect seeds,
and bring as many clones home as you can.

Built with **Phaser 4 + TypeScript** and shipped to iOS with **Capacitor**. The game logic is a pure,
deterministic simulation that runs headless in tests, and the renderer draws everything from the boards'
shapes and palette. There are no image or audio files.

## What's built

**Screen flow (board A).** Title → World select → Level map → Play → Pause / Clear / Fail.

| Board | Screen | Notes |
| --- | --- | --- |
| A1 | Title | Wordmark in the silhouette layer, Puff bobbing by the sun. The first hold starts the last unfinished level. Skins and Settings pills. |
| A2 | World select | Four palette cards. Worlds open by total seeds. |
| A3 | Level map · Mossdeep | Vine path, seed dots under cleared levels, Puff waiting at the next level, goal card with Play. |
| A4 | Gameplay HUD | Pause, progress bar with checkpoint ticks, seeds, live clone count. 85% opacity, full when something changes. Ink turns pale when the play layer shades the HUD. |
| A5 | Pause | World stays visible under the dark overlay. Resume, Restart, Map. Music, Sound and Haptics toggles. |
| A6 | Level clear | "Home.", clones saved, seeds filling in one at a time with chimes, time, Replay and Next. |
| A7 | Fail · last clone lost | Drained sky, one-word cause ("Shredded."), Retry from checkpoint, Restart. |

**Puff (board B).** Round body with 8 tufts, one big eye that looks toward the next hazard, a blush, and
the game's only green, the sprout. States: drift (slight sway), puff (stretches up while held), bonk
(squash and squint), sleep (1-1's wake), and lost (tufts scatter, sprout wilts). Clones have no sprout;
when the leader is lost, the next clone takes the lead.

**Chapter 1 · First Flight (level board, levels 1-1 to 1-5).** Each level follows its map, beats and
tuning table. The 1% ramp `D(n) = 1.01^(n-1)` scales scroll speed, gaps, windows and wheel spin.

| Level | New idea | Mechanics |
| --- | --- | --- |
| 1-1 First Light | Hold to fly | "Hold" hint, moss mound, 110pt hollow log for 6 s with "Tap to stay level" printed on its floor, bloom with camera linger, Mossback log preview, vine weave, alcove seed. No way to die. |
| 1-2 Mossback | Props and gates | Pebbles roll when bumped, logs tip when you land on their high end, gates open, a pebble tips a log, a timed gate drifts shut over 3 s, a root on the ceiling points to the right log, and the wrong log bounces you. Three knocks on the results screen. |
| 1-3 Briarwood | Death | Briar seen behind glass first, instant 0.4 s respawn at blooms (no fail screen), thorn-roofed log, thorn curtain lifted by a log, a 108pt slalom ending two screens before the burrow. |
| 1-4 Bramble Run | Clones | Split bubbles, clones copying input 80 ms late within a 45pt spread, any clone collecting seeds, blooms saving the clone count, a 107pt bramble run for 10 s. Badge for 5 home. |
| 1-5 Thornwheel Glade | Moving hazards | 9 thornwheels at 94°/s: a resting one, a seed riding a missing tooth, a wheel jammed by a pebble, a log knocked on a beat, and three counter-rotating wheels over briar. Wheels freeze for 1 s after a respawn. Badge for 6 home, then the "First Flight" chapter card. |

**Audio and haptics.** Low wind and crickets, plus a music-box melody that adds a voice for each living
clone. Synthesized chimes, knocks, pops and fluff. Haptics go through `@capacitor/haptics` and are off by
default, as the Pause frame shows. Progress is stored in `@capacitor/preferences` (UserDefaults on iOS).

## Run

```sh
npm install
npm run dev          # play in a browser at the printed URL
npm test             # unit tests: tuning, geometry, every mechanic, level data vs the board, progress
npm run test:levels  # slow (several minutes): a beam-search player proves every level is finishable,
                     # every one of the 15 seeds is collectable, and both clone badges are earnable
npm run build        # typecheck + production bundle in dist/
```

## iOS

Building for iOS needs macOS and Xcode:

```sh
npx cap add ios      # once
npm run ios:sync     # build and copy into the Xcode project
npx cap open ios     # run on a simulator or device
```

In Xcode, set the target to landscape only.

## Layout

```
src/config/      palette, constants (physics, screen, safe area), tuning (the 1% ramp)
src/game/        sim.ts (pure fixed-step simulation), geometry, types, progress, solver (tests only)
src/game/levels/ l11.ts ... l15.ts, one file per level, with board positions noted beat by beat
src/render/      art.ts (Puff and world objects), ui.ts (UI kit), panels.ts (settings, toasts)
src/scenes/      Title, World, Map, Play (HUD, pause, fail), Clear (and the chapter card)
src/audio/       synthesized ambience, music box and effects
src/platform/    Capacitor storage and haptics
```

## Where the boards disagreed or couldn't be taken literally

- **Seeds per world.** The level board's structure is 10 levels per world (30 seeds), not the 20 levels
  (60 seeds) the A2/A3 mocks show. So the map has 10 nodes and the world cards read "x / 30". Rustwell opens
  at 20 seeds (the board gives no number), Brinefall at 45 (the board's 90, halved with the world), and
  Stillsky when Brinefall is finished (verbatim).
- **Fail screen.** 1-3 respawns instantly with no fail screen, as its beats say. The A7 fail screen
  appears in 1-4 and 1-5 when the last clone is lost. Briar deaths read "Pricked." (only "Shredded." is
  designed).
- **Split bubble.** Every Puff touching a bubble as it pops splits in two, up to 6. This is the one rule
  that satisfies "popping it makes two Puffs", "Three", "as many as 6 Puffs", "topped up to 6" and the
  card's "+2 clones".
- **Puff only flies forward.** Two seed puzzles describe reaching back under a tipped log. In 1-1, seed 2
  sits under a pebble in a nook, and tipping the log knocks the pebble away ("rolls the pebble away"). In
  1-2, seed 3 is a steep dive just past the right log's raised end; "Grab, then tip" can't be enforced.
- **Timed gate (1-2).** Gate 2 opens when log 2 tips, then drifts shut over 3 s once Puff comes within
  260pt. Taken literally, the beat timestamps would shut it before Puff ever arrived.
- **Never stuck.** Pressed against a closed gate for 3 s, Puff drifts back to the last bloom with no
  penalty, so a missed log never softlocks a level with no way to die. As a safety net, the same happens
  after 8 s with no forward progress at all (the "Hold" hint returns at 4 s first).
- **Logs are one-way.** Puff lands on a log from above but rises up through one from below, so the
  narrowing gap under a raised end can never wedge it against the ground. Side-on touches push Puff
  straight back, so it can always climb or drop along an obstacle. Pebbles are heavy and don't bounce
  off walls, so the one sitting on 1-1's seed 2 stays put until the log knocks it away.
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
- **Clones left behind.** A clone more than 360pt behind the leader is lost.

## Not built yet

- Levels 1-6 to 1-10 and worlds 2 to 4. They aren't designed yet, so the map and world cards say
  "Coming soon".
- Swell, Shrink, Gust, Hush and Burr power-ups, and the Rootcrusher and Mawpit hazards. They belong to
  chapters 2 to 8.
- Final art. Per the board, Puff and the scenery are placeholder shapes until the illustrator's art.
