# Workflow

How work moves through this project, from a request to a merged change. It's written for coding agents
working with one human owner, but people can follow it too.

## Roles and sources of truth

| What | Where | Who changes it |
| --- | --- | --- |
| What the user wants | The conversation, and [ROADMAP.md](ROADMAP.md) | The user decides; agents keep the roadmap current |
| How it should look and feel | [design/](../design/README.md) (the boards), [GAME_DESIGN.md](GAME_DESIGN.md) | The user; agents record departures in the README |
| What's true right now | [STATUS.md](STATUS.md) | Every agent, at the end of every session |
| Why things are the way they are | [DECISIONS.md](DECISIONS.md) | An agent that makes a big decision adds a record |
| How to do recurring tasks | [playbooks/](playbooks/) | Improve a playbook when it was wrong or missing a step |
| Rules for agents | [AGENTS.md](../AGENTS.md) | Change it rarely; keep it short |

## The loop

1. **Orient.** Read `AGENTS.md`, then `docs/STATUS.md`. Run `git status` and `git log --oneline -10`.
   Run the unit tests to confirm you're starting from green.
2. **Understand the task.** Find it in `ROADMAP.md`, or write it down there if it's new. Restate its
   acceptance criteria. If the design is ambiguous, ask the user before you build. A question is
   cheaper than a rewrite.
3. **Plan.** Anything more than a small fix gets a short plan first: which files change, which tests
   prove it, and what could break. For a new mechanic, follow
   [playbooks/new-mechanic.md](playbooks/new-mechanic.md).
4. **Build in small steps.** Each step leaves the tests green. Write the test with the behaviour; for
   a bug, write the failing test first.
5. **Verify.** Run [playbooks/verify.md](playbooks/verify.md). Run the solver suite in the background
   while you check screens.
6. **Document.** Update the README if a player or designer would notice the change. Update `docs/` if
   architecture or process changed, add a record to `DECISIONS.md` for a lasting choice, and tick the
   item in `ROADMAP.md`.
7. **Hand off.** Run [playbooks/handoff.md](playbooks/handoff.md): update `STATUS.md`, commit and push,
   then tell the user what changed and what's verified, honestly.

## Branches, commits, pull requests

- **Branches.** Branch from the latest `main`. Agent branches are usually `claude/<topic>`, or
  `<agent>/<topic>`. If a branch's pull request has already been merged, start new work from `main`
  again, on a fresh branch or by resetting that branch to `main`. Never stack new commits on merged
  history.
- **Commits.** Each commit is one logical change, and the tests pass at every commit.
  - Write an imperative subject under 72 characters, for example "Add a level editor for dev builds".
  - The body says why, and what a reviewer should know.
  - Never put secrets, tokens, model names or machine paths in commits.
- **Pull requests.** Open one only when the user asks. If the repository has a PR template, follow
  it. Otherwise cover:
  - what changed, and why
  - how it was verified (commands and results)
  - screenshots for anything visual
  - follow-ups
- **Never** force-push a shared branch, rewrite `main`, or commit generated output (`dist/`, the
  `ios/` build products).

## Review checklist

Use it for your own diff before you commit, and for reviewing anyone else's.

- [ ] **Correctness:** edge cases, off-by-one, empty lists, missing references (a gate whose log was
  deleted).
- [ ] **Determinism:** nothing random or time-based in `src/game/`, and fixed steps only.
- [ ] **Resources:** every sim destroyed, every Box2D object `.delete()`d, and listeners on
  `window`/`document` removed.
- [ ] **Data:** level files canonical, schema and types changed together, design checks pass.
- [ ] **Feel:** no magic numbers outside `src/config/`, and no unannounced changes to feel or tuning.
- [ ] **UI:** built with the UI kit and palette, hit targets at least 44 pt, inside the notch-safe
  area, copy in the boards' voice.
- [ ] **Tests:** behaviour covered and named as behaviour; the slow suite run if the sim or levels
  changed.
- [ ] **Docs:** README, `docs/` and `STATUS.md` all match the code.

## When to stop and ask

Stop and ask the user when:

- The boards are ambiguous, or contradict each other or the code.
- A change would alter the feel of every level: physics, drift, tuning or sizes.
- You would delete or reorder content, or rename a level.
- You'd add a dependency, a service, analytics or anything that sends data off the device.
- The solver can't prove a level after a reasonable attempt.

Don't loosen the test to get it green. Report what you tried instead.

## Several agents at once

- **Claim work.** Add your branch and task under "In progress" in `STATUS.md`, and push it early.
- **Split work by file.** Level files are independent of each other. `sim.ts` and `schema.ts` aren't:
  coordinate before two branches change them.
- **Rebase on `main`** before you hand off, and run the tests again after the rebase.
- **Conflicts in a level file:** reapply your change in the editor or by hand, then run
  `npm run levels:format`. Never hand-merge two versions of a canonical file line by line.

## Definition of done

The checklist lives in [AGENTS.md](../AGENTS.md#definition-of-done), and the commands are in
[playbooks/verify.md](playbooks/verify.md).
