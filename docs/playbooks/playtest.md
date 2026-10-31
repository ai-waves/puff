# Playbook: playtest in a browser

Check what's on screen by driving the real game in a headless browser. Use this when you can't hand
the user a dev server, as in a cloud session, or to check visual changes yourself.

## 1. Start the dev server

```sh
npm run dev -- --port 5173 --strictPort    # in the background
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # wait for 200
```

When you're done, stop it **by PID**, for example with `ss -ltnp | grep 5173` to find it. A
`pkill -f vite` can kill your own shell.

## 2. Get a browser

You need Playwright with Chromium. In Claude Code cloud sessions it's preinstalled:
`require('playwright')` works from any directory. Elsewhere, use `npx playwright install chromium`, in
a scratch folder rather than the repo. Keep scripts and screenshots out of the repo, for example in
your scratchpad.

## 3. Drive the game

In dev builds the page exposes `window.__game` (the Phaser game) and `window.__sim` (the sim module).

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);
  // Jump straight into a level.
  await page.evaluate(() => window.__game.scene.getScene('title').scene.start('play', { levelId: '1-8' }));
  await page.waitForTimeout(800);
  // Hold to fly for a moment, then let go.
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(2000);
  console.log(await page.evaluate(() => {
    const s = window.__game.scene.getScene('play').sim.s;
    return { phase: s.phase, t: s.t, x: s.puffs[0]?.x, camX: s.camX };
  }));
  await page.screenshot({ path: 'play-1-8.png' });
  console.log(errors.join('\n') || 'no console errors');
  await browser.close();
})();
```

Useful handles:

- **Scenes:** `window.__game.scene.isActive('play')`, and `getScene('play').sim` for its sim.
- **The editor** (open with `/?edit=<id>`): `getScene('editor').editor` is the controller.
  - `editor.setTime(t)` moves the clock.
  - `editor.select({ c: 'crushers', i: 0 }, true)` selects an object and brings it into view.
  - `editor.model.def` is the level being edited, and `editor.lints` its problems.
  - `editor.camX` is the scroll.
- **Clicking a world point in the editor:** take the canvas box `r` from
  `page.locator('#game canvas').boundingBox()` and set `k = r.width / 844`. The page point is
  `r.x + (worldX - editor.camX) * k`, `r.y + worldY * k`.

## 4. Look at the screenshots

Open every screenshot and check it against the boards: alignment, safe areas, readable text, and
nothing overlapping. A screenshot you didn't look at verifies nothing.

## 5. Clean up

- Stop the dev server by PID.
- If you saved a level in the editor during the test, restore the file:
  `git checkout src/game/levels/data/<id>.json`.
- Delete any stray editor drafts. They live in the browser's localStorage, so a fresh headless
  profile has none.
