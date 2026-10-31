# Game design

The design lives on the boards in [design/](../design/README.md). This page sums up what's built from
them, what the code adds, and where the game goes next. The README's section "Where the boards
disagreed" lists every deliberate departure from the boards.

## Pitch and pillars

Puff is a dandelion seed with a sprout on its head, flying home through a dusky wood. You hold
anywhere to puff upward and let go to drift. The screen scrolls on its own, and anything that blocks
Puff makes it fall behind.

- **Look:** black silhouettes over a glowing, painted sky, with a dusky palette (warm amber sky,
  near-black foreground). Puff's sprout is the only green in the game.
- **UI:** nearly invisible. It's thin and minimal, and full opacity only while something changes.
- **Tone:** light and a little cheeky, in short lines like "Home.", "Shredded." and "Left behind.".
- **Feel:** forgiving. A graze isn't a death, a lost Puff re-forms in 0.4 s, and every new idea is
  shown somewhere safe before it can hurt you.

## Controls and rules

- **Hold anywhere** for lift (420 pt/s² against 300 pt/s² of gravity). **Release** to fall.
- Puff drifts forward toward its spot at screen x 280. The player controls only its height.
- **Badland rules.** A Puff is lost when the left edge of the screen passes it, or when it touches
  something deadly: briar, a thornwheel, a thorn curtain, or a rootcrusher's toothed underside.
  Anything else only bumps it.
- **Losing every Puff** depends on the level's `deaths` setting:
  - `instant`: Puff re-forms at the last bloom and waits for a hold.
  - `screen`: the fail screen shows a title for the cause, and offers Retry (from the bloom) and
    Restart. The clone levels 1-4, 1-5 and 1-10 use it.
- **Clones.** A Split bubble splits every Puff touching it in two, up to 6. Clones copy your input
  80 ms late and keep within a 45 pt spread. When the leader is lost, the next clone leads. Any clone
  can collect a seed.
- **Goals.** Reach the burrow. Each level has 3 seeds, and the clone levels have a badge for bringing
  enough clones home.

## Puff

Puff is 30 pt across for collisions, and clones are smaller. Its states are drift, puff (stretches up
while held), bonk (squash and squint), sleep (only at the start of 1-1) and lost (the tufts scatter).
One big eye looks toward the next hazard.

## Mechanics (built)

| Thing | In the data | What it does | First level |
| --- | --- | --- | --- |
| Block | `rects` | Solid ground. Looks: block, log, shelf, ledge, vine, lip, mound (bouncy). Rounded corners are real curves. | 1-1 |
| Moss mound | `humps` | A soft, bouncy hump rising from the floor | 1-1 |
| Mossback log | `seesaws` | A plank on a hinge that tips when weight lands on its high end. Modes: `free`, `dud` (bounces, never tips), `return` (tips back after `returnAfter` s), `beat` (swung by a motor every `beat` s). `heavy`: only a swollen Puff tips it. `cradle`: holds a pebble until it tips. | 1-1 |
| Pebble and boulder | `pebbles` (`heavy`) | Pebbles roll when bumped and can tip logs or jam wheels. Boulders are octagons that only a swollen Puff can shove. | 1-2, 1-6 |
| Gate | `gates` | A bar from the roof, opened by its log. `latch` stays open; `timed` drifts shut over `closeTime` s once Puff is within `closeAhead` pt. | 1-2 |
| Root and root trail | `roots`, `rootTrail` | Decoration. A trail along the ceiling points to the log that opens a gate. | 1-2 |
| Briar | `briars` | Static spikes, rising (`up`) or hanging (`down`). Deadly. | 1-3 |
| Thorn curtain | `curtains` | A hanging briar that a log lifts. Deadly. | 1-3 |
| Split bubble | `bubbles` | Splits each Puff touching it in two, up to 6 | 1-4 |
| Thornwheel | `wheels` | A spinning disc of thorns. Options: `missingTooth` (a gap a seed can ride in), `jammable` (a pebble stops it), `post` or `hang` (drawn on a post or hanging) | 1-5 |
| Swell orb | `orbs` (`swell`) | The whole flock grows 1.8×, for 6 s unless `time` says otherwise | 1-6 |
| Shrink orb | `orbs` (`shrink`) | The whole flock shrinks to 0.5× and bunches up to fit bramble gaps | 1-7 |
| Rootcrusher | `crushers` | A column of roots that slams on a beat. Dust falls 0.7 s before. Its underside is deadly; its sides only bump. | 1-8 |
| Seed | `seeds` | A collectible. It can float free, ride a log (`ride`) or ride a wheel's missing tooth (`orbit`). | 1-1 |
| Bloom | `blooms` | A checkpoint. It saves the clone count, and Puff re-forms there. | 1-1 |
| Burrow | `burrowX` | The goal | 1-1 |
| Label | `labels` | Text printed on the world, like "Tap to stay level" | 1-1 |

Every field is listed in [LEVELS.md](LEVELS.md).

## Difficulty

The boards set a 1% ramp per level: `D(n) = 1.01^(n-1)`, reaching about 1.47× by level 40. It's in
`src/config/tuning.ts`.

- **Applied while playing:** scroll speed (120 pt/s × D) and crusher timing.
- **Built into each level's layout:** the narrowest gap (110 pt ÷ D), the tap window, checkpoint
  spacing and thornwheel spin (90°/s × D). The level tests check these.

Each chapter brings in one new idea. Within a level, the rule is to show the idea somewhere safe,
test it once with a seed as the reward, then combine it with an earlier idea.

## Progression

- **Worlds, chapters and levels.** There are 4 worlds of 10 levels, which makes 8 chapters of 5.
  Each level has 3 seeds, so each world has 30.
- **Unlocking.** Levels open in order. Worlds open by total seeds:
  - Rustwell at 20
  - Brinefall at 45
  - Stillsky when Brinefall is finished
- **Saves.** Each level keeps its best seeds, best clones home, badge and best time
  (`src/game/progress.ts`).

## World 1 · Mossdeep (built)

| Level | Name | Teaches | Length (pt) | Losing every Puff | Badge |
| --- | --- | --- | --- | --- | --- |
| 1-1 | First Light | One verb: hold | 8400 | instant | |
| 1-2 | Mossback | Touching moves things | 9000 | instant | |
| 1-3 | Briarwood | Some things hurt | 9600 | instant | |
| 1-4 | Bramble Run | You can be many | 10200 | fail screen | 5 home |
| 1-5 | Thornwheel Glade | Hazards move | 11000 | fail screen | 6 home |
| 1-6 | Puffball Patch | Bigger is heavier | 10800 | instant | |
| 1-7 | Needle's Eye | Smaller fits | 10400 | instant | |
| 1-8 | Rootfall | Some things move on a beat | 10600 | instant | |
| 1-9 | Fernshade | Change size on the fly | 10800 | instant | |
| 1-10 | Last Light | Everything at once | 12000 | fail screen | 6 home |

- **Chapter 1 · First Flight (1-1 to 1-5)** follows the level board's maps, beats and tuning tables.
- **Chapter 2 · Undergrowth (1-6 to 1-10)** was designed in code from the board's one-line spec, its
  power-up and hazard cards, and its sky for each level.
- The README describes each level beat by beat. Each level file keeps its beats in its `notes`, and
  in each object's `note`.

## Future chapters (from the board)

| Chapter | Levels | World | New ideas |
| --- | --- | --- | --- |
| 3 · Cogworks | 11–15 | 2 Rustwell | Gust and Hush, gears |
| 4 · Furnace | 16–20 | 2 Rustwell | Mawpit, conveyors, ember vents |
| 5 · Tidepools | 21–25 | 3 Brinefall | Buoyancy, currents |
| 6 · Undertow | 26–30 | 3 Brinefall | Burr, sinking clones |
| 7 · Driftfield | 31–35 | 4 Stillsky | Low gravity, orbiting debris |
| 8 · The Long Way Home | 36–40 | 4 Stillsky | A remix of everything, and the finale |

The board's cards for the mechanics not built yet:

- **Gust:** "Speeds up time for 4s."
- **Hush:** "Slows time for precision runs."
- **Burr:** "Sticks to surfaces and clones bunch up."
- **Mawpit:** "Pulls nearby clones inward. Puff hard to escape."

The cards for what's built read:

- **Split:** "+2 clones. Mint glow."
- **Swell:** "Grow 1.8×. Heavy enough to tip ledges."
- **Shrink:** "0.5×. Slips through bramble gaps."
- **Thornwheel:** "Spinning bramble disc. Instant loss on touch."
- **Rootcrusher:** "Slams on a beat. Watch the dust fall before it drops."
- **Briar:** "Static spikes. Shrink to pass between them."

Gears, conveyors, ember vents, buoyancy, currents, sinking clones, low gravity and orbiting debris have
no cards yet. Design them with the user before you build them.

## Screens (board A)

The seven screens are Title, World select, Level map, Gameplay HUD, Pause, Level clear and Fail. The
README's "What's built" table describes each one. When a chapter's last level is cleared, a chapter
card follows (`ClearScene` `CHAPTERS`).

## Art and audio

- **Art.** The art is placeholder shapes on purpose: the boards say so until the illustrator's art
  arrives. Colours are in `src/config/palette.ts`, and the fonts are Fredoka (UI) and JetBrains Mono
  (labels). The parallax layers are the sky (L0), far hills at 0.2× (L1), mid hills at 0.5× (L2), the
  play layer, and the foreground at 1.4× (L4).
- **Audio.** Low wind and crickets play under a music-box melody that adds a voice for each living
  clone. The chimes, knocks, pops and fluff are synthesized too. Haptics are off by default.

## Design rules learned while building

These are settled. Keep to them unless the user changes their mind.

- Every gate sits on the same screen as the log that opens it, and opens right up into the roof.
- Puff only flies forward, so a seed puzzle can never need going back.
- Heavy logs use a hinge lock that only a swollen Puff's weight frees, not a counterweight.
- Swell and Shrink act on the whole flock. A shrunk flock bunches up so it fits wherever its leader
  fits.
- Rootcrushers are full columns, so Puff can never get above one and be squeezed against the roof.
- Bramble gaps are 22 pt from tip to tip: too narrow for a normal Puff, and wide enough for a shrunk
  one.
- Each crusher's beat is set so that a Puff keeping its place meets the crusher just after it lifts.
