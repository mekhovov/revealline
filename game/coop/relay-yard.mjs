/** A single full-loop playtest arena. Production campaign expansion follows paired feedback. */
export const RELAY_YARD = {
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

export const COOP_PLAYTEST_CONFIGURATIONS = [
  {
    id: 'full',
    label: 'Full teamwork',
    jointCuts: true,
    assistCaptures: true,
    advancedCooperation: true,
  },
  {
    id: 'joint',
    label: 'Joint Cuts + ordinary cover',
    jointCuts: true,
    assistCaptures: true,
    advancedCooperation: false,
  },
  {
    id: 'independent',
    label: 'Individual cuts + ordinary cover',
    jointCuts: false,
    assistCaptures: false,
    advancedCooperation: false,
  },
];
