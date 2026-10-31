# Design

The original design for Hollowdrift, exported from Claude Design on 2026-10-29. It's the spec: the
game follows it, and the README section "Where the boards disagreed" records every deliberate
departure. Don't edit these files. They're a record of what was designed. Put new design work in
`docs/` (or a new board), and record decisions in `docs/DECISIONS.md`.

## Boards

| File | Sections |
| --- | --- |
| `boards/game-artifacts.dc.html` | **A** · Screen flow: seven landscape iPhone screens (Title, World select, Level map, Gameplay, Pause, Level clear, Fail), each with a design note. **B** · Puff's character sheet: a hero render, five animation states and three sizes. **C** · Power-ups (Split, Swell, Shrink, Gust, Hush, Burr) and hazards (Thornwheel, Rootcrusher, Briar, Mawpit). **D** · UI kit: palette, Fredoka type sizes, buttons and the in-game display. |
| `boards/world-1-and-level-1-1.dc.html` | **A** · Difficulty curve: 40 levels in 8 chapters, at 1% per level. **B** · Mossdeep, world 1: background layers, the sky darkening over 10 levels, the world's rules and 8 terrain pieces. **C** · Chapter 1, levels 1-1 to 1-5. **D** · Each of levels 1-1 to 1-5 in full: map, 10 beats, tension curve, tuning numbers, content list and playtest targets. Also "Chapter 1 at a glance". |
| `boards/support.js` | The runtime both boards load |

To view a board, open it in a browser with an internet connection, because the boards load React and
fonts from CDNs. Offline, read the HTML source: all the text, sizes and colours are in it.

## Chats

The conversations with the design assistant. They show what the user asked for, and where they landed.

- `chats/1-game-artifacts.md`: the first board, then World 1 and level 1-1. The user's brief: "similar
  to BadLand but has its own fun character and levels", and 40 levels, getting 1% harder each level.
- `chats/2-levels-1-2-to-1-5.md`: levels 1-2 to 1-5.

## What the boards don't cover

- Chapter 2 (levels 1-6 to 1-10) has only a single line in the plan ("Swell, Shrink, Rootcrusher").
  Its levels were designed in code from the power-up and hazard cards; see `docs/GAME_DESIGN.md`.
- Chapters 3 to 8 have only their names and new ideas. Design them with the user before building them.
- There's no screen design for Skins.
