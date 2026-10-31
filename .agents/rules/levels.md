---
trigger: glob
globs: src/game/levels/**
---

# Level files and the level pipeline

- Level files are data, and they stay canonical. After a hand edit, run `npm run levels:format`.
- `schema.ts` is the one list of fields. Change `types.ts` and `schema.ts` together, and the field
  reference in `docs/LEVELS.md`; the docs test checks it.
- Keep each level's `notes`, and each object's `note`, true to its beats.
- A shipped level has no design problems (`lintLevel`), and passes `npm run test:levels`.
- Never loosen a solver test to make it pass; read `docs/TESTING.md` first.
- The full guide is `docs/playbooks/level-change.md`.
