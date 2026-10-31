# Documentation

Start with [AGENTS.md](../AGENTS.md) if you're a coding agent, or the [README](../README.md) if you're a
person. Then:

| Doc | What it's for |
| --- | --- |
| [STATUS.md](STATUS.md) | Where the project stands: built, verified, in progress, known issues. Read it first and update it last. |
| [ROADMAP.md](ROADMAP.md) | The prioritized backlog, with acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Modules, the simulation step, rendering, the levels pipeline, the solver, the editor |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Rules, mechanics, difficulty, progression, the levels, future chapters |
| [LEVELS.md](LEVELS.md) | Level files, design checks, timing, solver routes, the field reference |
| [TESTING.md](TESTING.md) | Test layers, the test files, writing sim tests, the solver suite |
| [WORKFLOW.md](WORKFLOW.md) | From task to merged change: branches, commits, review, when to ask |
| [STYLE.md](STYLE.md) | Code style, the game's vocabulary, UI and copy rules |
| [DECISIONS.md](DECISIONS.md) | Architecture decision records |
| [playbooks/](playbooks/) | Step-by-step guides: [verify](playbooks/verify.md), [playtest](playbooks/playtest.md), [change a level](playbooks/level-change.md), [add a mechanic](playbooks/new-mechanic.md), [iOS release](playbooks/release-ios.md), [hand off](playbooks/handoff.md) |
| [../design/](../design/README.md) | The original design boards and chats: the spec |

## How agent tools find these docs

| Tool | Reads | Here |
| --- | --- | --- |
| Most agents (Codex, Cursor, Jules, Antigravity and others) | `AGENTS.md` | the canonical instructions |
| Claude Code | `CLAUDE.md`, plus `.claude/rules/` and `.claude/skills/` | `CLAUDE.md` imports `AGENTS.md`; the skills run the playbooks |
| Antigravity | `.agents/rules/`, `.agents/workflows/` (and `AGENTS.md`) | an always-on rule points to `AGENTS.md`; the workflows run the playbooks |

Procedures live once, in `playbooks/`; the tool-specific files only point to them. The path-scoped
rules are the exception: they're mirrored in `.claude/rules/` and `.agents/rules/`, and
`src/docs.test.ts` checks that the copies match.
