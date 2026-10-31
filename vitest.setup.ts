import { loadBox2D } from './src/game/physics';

// Box2D is WebAssembly: load it once before any test builds a sim.
await loadBox2D();
