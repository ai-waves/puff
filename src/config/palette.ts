// Colours from the design boards' UI kit (Palette · Mossdeep) and screen frames.
export const INK = 0x1b0f10; // play layer, hazards, UI ink
export const CREAM = 0xf6ebd5; // Puff and UI ink on dark
export const GLOW = 0xfbe3b4; // sun, blooms
export const PALE = 0xfff8ec; // hint ring, bubble rim
export const SKY = 0xf2c386; // seeds in the HUD
export const FAR = 0xc8705a; // far hills
export const MID = 0x7c3a39; // mid layer, ambient life
export const SPROUT = 0x9bc46a; // the only green in the game
export const STEM = 0x5e7a3a;
export const BLUSH = 0xee9c86;
export const MUTED = 0xc9b9a4; // muted text
export const DEEP = 0x0a0606; // foreground L4 silhouettes
export const MINT = 0xc8f0be; // Split bubble glow
export const BURROW_GLOW = 0xf6d7a2;

export const css = (c: number) => `#${c.toString(16).padStart(6, '0').toUpperCase()}`;

// Typography from the UI kit: Fredoka for everything, JetBrains Mono for labels.
export const FONT = 'Fredoka';
export const MONO = 'JetBrains Mono';
