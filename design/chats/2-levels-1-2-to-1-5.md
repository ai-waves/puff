# Design Levels 2-5

_Started 2026-10-29 13:06 UTC_

---

## User

Design Levels 2-5

## Assistant

We've been building **Hollowdrift**, a Badlands-style mobile game starring Puff, a dandelion seed. You chose the visual direction: black silhouettes over warm amber skies, minimal UI, moody atmosphere.

First phase was complete: I made a full design board with screen flows, character sheet, power-ups, hazards, and UI kit using Fredoka type. We fixed a verifier issue and moved forward.

Now we're designing the 40-level progression and World 1. Key decisions made:
- Each of the 8 chapters has 5 levels, with each level 1% harder than the last (reaching ~1.47× difficulty by level 40).
- Each new chapter introduces one new mechanic, introduced gently.
- World 1 (Mossdeep) has 10 levels; sky darkens progressively.
- Level 1-1 (First Light) is a safe intro with no level-ending hazards; includes 10 narrative beats and a tension curve.

Current state: The design board shows the full 40-level curve with tuning values, all 8 terrain pieces for World 1, the five opening levels with their mechanics, and Level 1-1 fully mapped with key screens and playtest targets. The Tweaks panel lets you adjust difficulty ramp (0.5%–3%) and ease new mechanics.

One issue remains: the original world select screen assumes 20 levels per world (60 seeds each), but we've shifted to 10 per world (30 seeds). That needs updating if you want it synced.

Next steps: build levels 1-2 through 1-5 in detail, test the 1% curve feel, or move to World 2.

Files: `Hollowdrift Game Artifacts.dc.html`, `Hollowdrift World 1 and Level 1-1.dc.html`, `support.js`

## User

<artifact-content-authored-by-others/>
Design Levels 2-5

## User

Design the next 4 levels

## User

<artifact-content-authored-by-others/>
Design the next 4 levels

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Levels 1-2 to 1-5 are now on the board, below Level 1-1 in the same format. Each level has a full map, a tension curve, 10 beats, tuning numbers, a content list and playtest targets. The tuning numbers update with the difficulty ramp setting.

- **1-2 Mossback:** you learn that touching things moves them. You tip logs to open 3 gates, there's one gate that closes on a timer, and a root on the ceiling shows which log works the last gate. Nothing can kill you yet.
- **1-3 Briarwood:** the first level where you can die, and dying is cheap. You see the briar before it can reach you, respawn takes 0.4 seconds, and there's a checkpoint right before the hardest stretch.
- **1-4 Bramble Run:** you learn to fly as a group of clones. Losing one clone is a lesson rather than a fail, any clone can pick up a seed, and the level peaks in a narrow thorn corridor.
- **1-5 Thornwheel Glade:** the chapter finale, with spinning thornwheels. You can jam a wheel with a pebble from 1-2, and the level ends with three wheels spinning in opposite directions over a briar floor.

I also added a **Chapter 1 at a glance** table comparing all five levels, and renamed the board title to "Mossdeep & Chapter 1". The fixes from the review are in: I moved the 1-5 map label that was covering the wheels, and corrected the thornwheel count to 9.

The world select screen still shows 20 levels per world, so it needs updating to 10.

