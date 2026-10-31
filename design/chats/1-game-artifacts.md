# Mobile 2D game design

_Started 2026-10-29 11:05 UTC_

---

## User

Design artifacts for Building a 2D game for Mobile applications, the application is similar to BadLand but has its own fun character and levels.

## Assistant



## Assistant



## Assistant



## User

<artifact-content-authored-by-others/>
Answered — Asked Claude to decide; art_style: Silhouette foreground on a glowing painted background (moody, atmospheric); palette: Dusky: warm amber sky, near-black foreground; ui_feel: Nearly invisible: thin, minimal, out of the way

## Assistant

_[tool: ask_user]_

_[tool: ask_user]_

_[tool: dc_write]_

_[tool: grep]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: grep]_

_[tool: dc_js_str_replace]_

_[tool: dc_set_props]_

_[tool: ready_for_verification]_

I've built the design board for **Hollowdrift**, an original game in the style you picked: black silhouettes over warm amber skies, with thin, minimal buttons and menus. The hero is Puff, a dandelion seed with a sprout on its head. A background check is still running.

The board is one canvas with four sections:
- **A · Screen flow:** seven landscape iPhone screens. Title, world select, level map, in-game screen, pause, level clear and fail, each with a short design note.
- **B · Puff character sheet:** a large hero render, five animation states and three sizes.
- **C · Power-ups and hazards:** six glowing power-ups and four black hazards.
- **D · UI kit:** the colour palette, Fredoka type sizes, buttons and the in-game display.

Your earlier question form never came back, so I chose the scope myself: the game name, the four worlds, the mechanics, landscape iPhone and a light, cheeky copy tone. I also used Fredoka, a rounded, friendly font, since you left type to me.

Puff and the scenery are simple placeholder shapes, not final art. There are two switches in the Tweaks panel: one hides the design notes, the other shows the iPhone safe-area outlines.

Possible next steps: a playable prototype, a skins shop, a tutorial, the other three worlds, or App Store screenshots.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Now that first phase is done, use these artifacts to design first 5 levels.

Basically the end goal is to have 40 levels where each 5 increase the level and intensity of the challenge 1% at a time.

Let's design the world, then the first level.

## Assistant

_[tool: dc_write]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I fixed the last problem the check found: the seed counter at the top right of the log-tunnel screen was hard to see against the bright sky. It now sits on the dark log ceiling, which I extended across the top. I didn't re-run the full check after this small fix.

The new board, `Hollowdrift World 1 and Level 1-1.dc.html`, covers:
- **A · Difficulty curve:** all 40 levels in 8 chapters of 5. Each level is 1% harder than the one before, which makes level 40 about 1.47× as hard as level 1. The board lists what the 1% speeds up or tightens.
- **B · Mossdeep, world 1:** how the background layers are stacked, the sky getting darker over its 10 levels, the world's rules, and 8 terrain pieces.
- **C · Chapter 1, levels 1–5:** First Light, Mossback, Briarwood, Bramble Run and Thornwheel Glade. Each brings in one new idea, and nothing can end a run until level 1-3.
- **D · Level 1-1, First Light:** a map of the whole level with 10 beats and a tension track, plus two key screens. It also lists tuning values and playtest targets.

I read your rule as "each level is 1% harder, and each new chapter of 5 adds one new mechanic". The Tweaks panel lets you change the ramp from 0.5% to 3% and see the curve and numbers update. A second option eases the first level of each chapter so new mechanics land more gently.

There's one mismatch with the first board: the world select screen still assumes 20 levels per world (60 seeds each). With 10 levels per world it should be 30. I can update it if you want.

