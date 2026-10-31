# Playbook: build and release on iOS

The game is a Vite web build wrapped by Capacitor 8 (`capacitor.config.ts`: `appId: com.hollowdrift.game`,
`webDir: dist`). This needs **macOS with Xcode**; a Linux container or cloud session can't do it. The
`ios/` project hasn't been generated or committed yet ([ROADMAP.md](../ROADMAP.md) R4).

## First time: generate the project

```sh
npm install
npm run build
npx cap add ios          # creates ios/ (an Xcode project with Swift Package Manager or CocoaPods)
npx cap open ios
```

In Xcode:

1. **Orientation.** Under the target, General, Deployment Info, allow only **Landscape Left** and
   **Landscape Right**, on iPhone. The game is designed at 844 × 390.
2. **Status bar.** Hide it (`UIStatusBarHidden`, and "View controller-based status bar appearance"
   set to NO). The game draws edge to edge; `contentInset: 'never'` is already set.
3. **Signing.** Set the team and bundle identifier, which must match `appId`, or change both.
4. **Commit** the generated `ios/` project, but not `ios/App/Pods/` or `ios/App/App/public/`, which
   `.gitignore` already excludes. `npm run ios:sync` regenerates them.

## Every build

```sh
npm run ios:sync         # npm run build, then cap sync ios: copies dist/ into the app
npx cap open ios         # run on a simulator or device from Xcode
```

## Check on a device

- **Box2D:** the game starts with no WebAssembly errors, using the compat build (no SIMD or threads).
- **Audio:** the first touch unlocks audio, and music and effects play. Mute switch behaviour is as
  expected.
- **Haptics:** off by default; when turned on in Settings, they fire on bumps, losses and wins.
- **Safe areas:** nothing important sits under the notch or the home indicator. The UI keeps 47 pt
  left and right and 21 pt at the bottom.
- **Saving:** progress survives killing the app, through Preferences (UserDefaults).
- **Pausing:** going to the background pauses the game (`visibilitychange`).
- **Speed:** 60 fps in 1-10 with 6 Puffs on the oldest iPhone you support. Use the Safari Web
  Inspector's timeline to measure it.
- **Feel:** holding and releasing feels immediate, with no scrolling, zooming or text selection.

## Release

These aren't set up yet ([ROADMAP.md](../ROADMAP.md) R7):

- app icons and a launch screen in the palette (`#1b0f10` background)
- a privacy manifest declaring no data collection
- screenshots taken from the game

Then archive in Xcode and upload to App Store Connect, and test through TestFlight before release.
