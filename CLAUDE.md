@AGENTS.md

## Claude Code

The import above is the project's instructions for every coding agent. These notes add only what's
specific to Claude Code.

- **Skills.** `/verify`, `/playtest`, `/level-change`, `/new-mechanic`, `/release-ios` and `/handoff`
  live in `.claude/skills/`. Each one runs the matching guide in `docs/playbooks/`.
- **Path rules.** `.claude/rules/` holds short rules that load when you open the simulation, level or
  editor files.
- **Long runs.** Start `npm run test:levels` with `run_in_background` and keep working; you're notified
  when it finishes. Don't sit in a sleep loop waiting for it.
- **Cloud sessions.** Chromium and Playwright come preinstalled (`require('playwright')`). Put
  screenshots and scratch scripts in the scratchpad directory, not the repo. The user can't open your
  dev server, so show them screenshots instead.
- **Plan first** (plan mode, or a short written plan) before adding a mechanic, changing the sim's step
  order, or touching more than one level at once.
