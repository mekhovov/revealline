/** Frozen revision-1 geometry for historical cutting and cooperation route proofs. */
export const FIRST_CONNECTION_PROTOTYPE = {
  version: 'revealline-coop-level.v1',
  id: 'first-connection',
  revision: 1,
  name: 'First Connection',
  width: 72,
  height: 36,
  spawns: [
    { x: 0.5, y: 18.5 },
    { x: 71.5, y: 18.5 },
  ],
  walls: [],
  enemies: [
    { id: 'orchard-1', type: 'drifter', x: 22.5, y: 26.5, vx: 2.2, vy: 1.3, radius: 0.35 },
    { id: 'orchard-2', type: 'drifter', x: 48.5, y: 28.5, vx: -1.8, vy: -1.2, radius: 0.35 },
  ],
  goal: { coverage: 0.65 },
  rules: { moveSpeed: 8, boostMultiplier: 1.5 },
};

export const RELAY_YARD_PROTOTYPE = {
  version: 'revealline-coop-level.v1',
  id: 'relay-yard',
  revision: 1,
  name: 'Relay Yard',
  width: 72,
  height: 36,
  spawns: [
    { x: 0.5, y: 18.5 },
    { x: 71.5, y: 18.5 },
  ],
  walls: [],
  safeRects: [{ x: 0, y: 17, w: 72, h: 2 }],
  enemies: [
    { id: 'yard-drifter', type: 'drifter', x: 24.5, y: 27.5, vx: 2.2, vy: 1.3, radius: 0.35 },
    { id: 'yard-hunter', type: 'hunter', x: 38.5, y: 12.5, vx: 0, vy: 0, radius: 0.35 },
  ],
  strongholds: [
    {
      id: 'yard-relay',
      core: { x: 36.5, y: 6.5 },
      anchors: [
        { x: 24.5, y: 8.5 },
        { x: 48.5, y: 12.5 },
      ],
    },
  ],
  goal: { cores: ['yard-relay'] },
  rules: { moveSpeed: 8, boostMultiplier: 1.5 },
};
