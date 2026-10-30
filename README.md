# Hollowdrift

Mobile 2D game built from the Claude Design handoff in `../project/`. This first slice implements
**Level 1-1 · First Light** from World 1 (Mossdeep). Levels 1-2 to 1-5 and the rest of World 1 come next.

## Framework decision: Phaser 4 + TypeScript, shipped to iOS with Capacitor

| Option | Verdict |
| --- | --- |
| **Phaser 4 + TypeScript + Capacitor (chosen)** | Game logic is plain TypeScript and runs under Node tests. The renderer is Phaser's Canvas/WebGL. Capacitor wraps the build as a native iOS app (WKWebView), with a route to native plugins such as haptics. Can be built and tested on Linux CI. |
| Swift + SpriteKit | Best native iOS performance and feel. Needs macOS and Xcode for every build and test, which this environment doesn't have. Pick this if the team is Mac-first and the game will stay iOS-only. |
| Unity 2D / Godot | Both export to iOS but still need a Mac for the final build. Heavier runtimes, and no advantage for a small 2D runner. |

Phaser + Capacitor gives the best mix here: logic verified in CI, a real iOS shell, and a path to Android later.
Trade-off: WebView audio and input latency are a little higher than SpriteKit. Measure on device before launch.

## Layout

- `src/game/constants.ts` physics and screen constants from the design (`gravity 300`, `lift 420`, `scroll 120 pt/s`)
- `src/game/tuning.ts` the 1% ramp, `D(n) = 1.01^(n-1)`, applied to scroll, gaps, and timing
- `src/game/level11.ts` Level 1-1 layout, with x-positions derived from the design's beat timestamps
- `src/game/sim.ts` pure fixed-step simulation: waiting, lift, bumps, seeds, checkpoints, plank tip, burrow
- `src/render/Level11Scene.ts` Phaser scene: parallax sky, Puff, HUD, hint, results
- `src/render/sfx.ts` synth chimes, unlocked on the first touch (iOS requires a gesture)

## Run

```sh
npm install
npm test        # sim and tuning unit tests
npm run build   # typecheck + production bundle in dist/
npm run dev     # local play in a browser
```

## iOS

The iOS project is not generated here because it needs macOS and Xcode:

```sh
npx cap add ios        # once, on a Mac
npm run ios:sync       # build the web app and copy it into ios/
npx cap open ios       # run on a simulator or device from Xcode
```

Lock the orientation to landscape in Xcode's target settings.

## Interpretations of the design

- Puff starts resting on the dandelion and waits for the first hold. Scroll starts on that hold.
- The burrow completes the level at 7,800 pt (beat 10 at 1:05). The stage's 8,400 pt length is the
  run-out after the burrow.
- Mounds, vines, and log walls are bumps: they push Puff back 24 pt and the lag recovers at 60 pt/s.
  Chapter 1 has no lethal objects.
- The Mossback plank is a lid over seed 2's pocket. Landing on it tips it, and it lifts out of the way.
- Vertical speed is capped at 480 pt/s. The design doesn't specify a cap, so this is an implementation choice.

## Not yet implemented

- Ambient audio (wind, crickets, music box), and the chapter-1 fanfare
- Pebble roll on tip, roots twitching, camera linger at the bloom, burrow zoom
- Foreground L4 silhouettes, the pause button, and iPhone safe-area insets
- Levels 1-2 to 1-5 (Mossback, Briarwood, Bramble Run, Thornwheel Glade) and World 1 levels 1-6 to 1-10. The sim already has the solid kinds, but no level data exists yet.
- Worlds 2-4 and the rest of the 40-level curve.
