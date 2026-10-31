# Playbook: change a level, or add one

Background on fields, design checks, timing and routes is in [LEVELS.md](../LEVELS.md).

## Change an existing level

1. **Read the level's intent** first: its `notes`, and the `note` on each object you'll touch. Don't
   break a beat you weren't asked to change.
2. **Make the change.**
   - **In the editor:** run `npm run dev`, open `/?edit=<id>`, make the change, press Ctrl+S. Test-fly
     it (P) from just before the stretch you changed.
   - **Or by hand,** in `src/game/levels/data/<id>.json`, then run `npm run levels:format`.
3. **Keep the notes true.** If you move a beat, update the level's `notes` and the objects' `note`.
4. **Fix every design problem.** `npm run levels:format` prints them, and the editor shows them.
5. **Verify** ([verify.md](verify.md)):
   - `npm test` runs the design checks, the content tests and the format test.
   - `LEVELS=1 npx vitest run src/game/levels/solvable/l<id without the dash>.slow.test.ts` checks the
     level you changed. Use `l18` for 1-8 and `l110` for 1-10.
   - Then run the whole `npm run test:levels` before you hand off.
6. **Check the content tests.** `levels.test.ts` pins some facts from the boards: level lengths, three
   seeds each, the props each level lists, and narrowest gaps. If you changed one of those on purpose,
   update the test and say why in the commit.

If the solver can no longer finish the level, read
[TESTING.md](../TESTING.md#the-solver-suite) before you add a route or touch the test.

## Add a level

Adding a level to world 1 means replacing one, because world 1 has exactly 10. New levels belong to
world 2 and later, which first needs the map changes in [ROADMAP.md](../ROADMAP.md) (R21). The steps:

1. **Design it first,** with the user: the idea it teaches, its beats, its sky, and how it uses the
   1% ramp (`tuning(n)` for the level's global number `n`). See the guidelines in
   [LEVELS.md](../LEVELS.md#level-design-guidelines).
2. **Create the file** `src/game/levels/data/<world>-<k>.json`. The quickest way is to copy a level
   with similar pieces, then change `id`, `n` (the global number: 2-1 is 11), `world`, `name`,
   `blurb`, `teach`, `notes`, `sky` and the objects. Run `npm run levels:format`.
3. **Register it** in `src/game/levels/index.ts`: import the file and add it to `LEVELS` in play
   order. The format test fails until every file is registered.
4. **Add its solver test,** `src/game/levels/solvable/l<world><k>.slow.test.ts`:

   ```ts
   import { checkLevel } from './check';

   checkLevel('2-1');
   ```

5. **Put it on the map.** World 1 uses `PATH` in `MapScene.ts` and `WORLD_1_LEVEL_COUNT` in
   `levels/index.ts`. Other worlds need R21 first. World select opens a world through
   `progress.ts` `worlds()`, where only world 1 is currently `playable`.
6. **End a chapter** if this level is a chapter's last: add the chapter to `CHAPTERS` in
   `src/scenes/ClearScene.ts`, with its name and sky.
7. **Pin the board's facts** in `src/game/levels/levels.test.ts`: its length, what it teaches, the
   props it lists, and its narrowest gap.
8. **Edit and prove it:** open it in the editor (`/?edit=2-1`), get the design problems to zero,
   test-fly every stretch, then run `npm run test:levels`.
9. **Document it:** add a row to the levels table in the README and in [GAME_DESIGN.md](../GAME_DESIGN.md),
   and update [STATUS.md](../STATUS.md).
