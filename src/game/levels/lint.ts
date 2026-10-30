import { PLAYFIELD, PUFF_RADIUS, PUFF_SCREEN_X, SCREEN, SIZE } from '../../config/constants';
import { briarTriangles, humpCircle, seesawEnds } from '../sim';
import type { LevelDef } from '../types';
import { COLLECTIONS, validateLevel, type Collection } from './schema';

// Design checks for a level: things that load fine but play badly. The level editor shows them as
// you work, and the level tests require every shipped level to pass them all.

export interface Lint {
  level: 'error' | 'warn';
  message: string;
  c?: Collection; // the object it's about, if any
  i?: number;
}

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const BLOOM_SPAWN_Y = 190;
const AHEAD = SCREEN.width - PUFF_SCREEN_X - 40; // how far ahead of Puff the screen shows, less a margin
const THORN_SENSOR = 2 * (PUFF_RADIUS - 3); // a normal Puff's thorn-sensing core, across

export function lintLevel(def: LevelDef): Lint[] {
  const errors = validateLevel(def);
  if (errors.length) {
    // "gates[0] ...": point at the object, so the editor can show it.
    return errors.map((message) => {
      const m = /^(\w+)\[(\d+)\]/.exec(message);
      const c = m && (COLLECTIONS as string[]).includes(m[1]!) ? (m[1] as Collection) : undefined;
      return c ? { level: 'error', message, c, i: Number(m![2]) } : { level: 'error', message };
    });
  }
  const out: Lint[] = [];
  const solidAt = (x: number, y: number, pad: number) =>
    def.rects.some((r) => x + pad > r.x0 && x - pad < r.x1 && y + pad > r.y0 && y - pad < r.y1) ||
    def.humps.some((h) => {
      const c = humpCircle(h.width, h.height);
      return Math.hypot(x - h.cx, y - c.cy) < c.r + pad && y + pad > FLOOR - h.height;
    });

  if (def.burrowX >= def.length) out.push({ level: 'error', message: `The burrow (x ${def.burrowX}) is past the end of the level (${def.length}).` });
  if (solidAt(def.startX, def.startY, PUFF_RADIUS)) out.push({ level: 'error', message: 'Puff starts inside solid ground.' });
  def.blooms.forEach((b, i) => {
    if (solidAt(b.x, BLOOM_SPAWN_Y, PUFF_RADIUS)) out.push({ level: 'error', message: `Bloom "${b.id}" re-forms Puff inside solid ground (at y ${BLOOM_SPAWN_Y}).`, c: 'blooms', i });
    if (i > 0 && b.x < def.blooms[i - 1]!.x) out.push({ level: 'warn', message: `Bloom "${b.id}" is listed after a bloom further on; blooms open in list order.`, c: 'blooms', i });
  });

  def.seeds.forEach((s, i) => {
    if (s.orbit || s.ride) return;
    if (solidAt(s.x, s.y, 0)) out.push({ level: 'warn', message: `Seed "${s.id}" is inside solid ground.`, c: 'seeds', i });
    if (s.y <= ROOF || s.y >= FLOOR) out.push({ level: 'warn', message: `Seed "${s.id}" is outside the playfield.`, c: 'seeds', i });
  });

  def.gates.forEach((g, i) => {
    const sw = def.seesaws.find((s) => s.id === g.link)!;
    const e = seesawEnds(sw, 0);
    const far = Math.max(e.ax, e.bx);
    if (g.x - far > AHEAD) out.push({ level: 'warn', message: `Gate "${g.id}" is ${Math.round(g.x - far)}pt past log "${sw.id}": off-screen when the log tips. Keep it within ${AHEAD}pt.`, c: 'gates', i });
    if (g.x < sw.px) out.push({ level: 'warn', message: `Gate "${g.id}" is behind the log that opens it; Puff only flies forward.`, c: 'gates', i });
    if (g.openBottom > ROOF + 30) out.push({ level: 'warn', message: `Gate "${g.id}" still hangs down to y ${g.openBottom} when open, like a wall. Tuck it into the roof (y ${ROOF + 26}).`, c: 'gates', i });
  });

  def.seesaws.forEach((sw, i) => {
    if (!sw.heavy) return;
    const swell = def.orbs.some((o) => o.kind === 'swell' && o.x < sw.px && sw.px - o.x < 700);
    if (!swell) out.push({ level: 'warn', message: `Heavy log "${sw.id}" has no Swell orb in the 700pt before it; nothing else can tip it.`, c: 'seesaws', i });
  });

  def.crushers.forEach((c, i) => {
    const under = def.rects.find((r) => r.x1 > c.x - c.width / 2 && r.x0 < c.x + c.width / 2 && r.y1 > c.rest);
    if (under) out.push({ level: 'error', message: `Rootcrusher "${c.id}" would slam into "${under.id}"; it needs a clear drop to the floor.`, c: 'crushers', i });
    if (c.rest >= FLOOR - 10) out.push({ level: 'warn', message: `Rootcrusher "${c.id}" rests at y ${c.rest}: nothing fits under it.`, c: 'crushers', i });
  });

  // Bramble gaps: a hanging row and a rising row facing each other. Under a normal Puff's width,
  // only a shrunk Puff gets through, so a Shrink orb has to come first.
  def.briars.forEach((top, i) => {
    if (top.side !== 'down') return;
    const topTris = briarTriangles(top);
    const x0 = top.x0;
    const x1 = top.x0 + (top.width ?? 20) * top.spikes.length;
    for (const bottom of def.briars) {
      if (bottom.side !== 'up') continue;
      const bx1 = bottom.x0 + (bottom.width ?? 20) * bottom.spikes.length;
      if (bx1 <= x0 || bottom.x0 >= x1) continue;
      const gap = Math.min(...briarTriangles(bottom).map((t) => t.qy)) - Math.max(...topTris.map((t) => t.qy));
      if (gap >= THORN_SENSOR) continue;
      const shrink = def.orbs.some((o) => o.kind === 'shrink' && o.x < x0 && x0 - o.x < 700);
      if (gap < 2 * (PUFF_RADIUS * SIZE.shrink - 3) + 4) out.push({ level: 'error', message: `Briar "${top.id}" and "${bottom.id}" leave ${Math.round(gap)}pt: too tight even for a shrunk Puff.`, c: 'briars', i });
      else if (!shrink) out.push({ level: 'warn', message: `Briar "${top.id}" and "${bottom.id}" leave ${Math.round(gap)}pt, too tight for a normal Puff, with no Shrink orb in the 700pt before.`, c: 'briars', i });
    }
  });

  const pastEnd = (x: number) => x > def.length;
  for (const [c, xs] of [
    ['rects', def.rects.map((r) => r.x1)],
    ['briars', def.briars.map((b) => b.x0)],
    ['seeds', def.seeds.map((s) => s.x)],
    ['wheels', def.wheels.map((w) => w.cx)],
    ['crushers', def.crushers.map((w) => w.x)],
  ] as const) {
    xs.forEach((x, i) => {
      if (pastEnd(x)) out.push({ level: 'warn', message: `${c}[${i}] is past the end of the level.`, c, i });
    });
  }
  return out;
}
