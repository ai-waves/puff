---
paths:
  - "src/editor/**"
  - "vite.config.ts"
---

# Level editor (dev builds only)

- The editor must never reach production. `src/main.ts` imports it only behind
  `import.meta.env.DEV`. Check that `npm run build` leaves it out of `dist/`
  (`docs/playbooks/verify.md`).
- Keep `model.ts` and `shapes.ts` pure (no Phaser, no DOM) and unit-tested. The UI is plain DOM in
  `panel.ts`, styled in `editor.css`, with classes prefixed `ed-` and the page layout under
  `body.editing`.
- Draw through `LevelView` with `poseSim`, so the editor shows exactly what the game shows.
- Each edit is one undo step: wrap it in `model.begin()` and `end()`, or `model.change()`.
- Remove any listener you add to `window` or `document` in `destroy()`.
- Saving goes through the Vite plugin in `vite.config.ts` (`POST /__editor/save`), which only writes
  level files that already exist.
- Check every change in a browser (`docs/playbooks/playtest.md`).
