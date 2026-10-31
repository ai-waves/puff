---
trigger: glob
globs: src/game/sim.ts, src/game/physics.ts, src/game/solver.ts, src/config/**
---

# Simulation and physics

You're editing the deterministic Box2D simulation that the game, the tests and the solver all run.

- No `Math.random`, `Date`, frame time, Phaser or DOM in `src/game/`. The same input must give the
  same run.
- Fixed steps only: `SIM_STEP` (1/60 s) with 4 substeps.
- Every `createSim` needs a matching `destroySim`. Every `new B.b2Vec2(...)` and `B.b2Default*Def()`
  result needs a `.delete()`.
- Create bodies only in `createSim`. All changing state lives in `SimState`, because snapshots copy
  only that and the Box2D world. Tag shapes by `shapeId.index1`.
- Units: pt in the game and metres in Box2D, at 1 m = 30 pt. y grows downward.
- Anything that moves on a clock (crushers, wheels, beat logs) also needs posing in `poseSim` and
  starting in `createSim(def, t0)`.
- Changing a constant or the tuning changes every level, so ask the user first.
- After any change here, run `npm test`, then `npm run test:levels` in the background (about 5 min).
  `docs/ARCHITECTURE.md` explains the step order.
