/** Authored cooperation experiment. All comparison modes use this exact arena. */
export const FIRST_CONNECTION = {
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

export const COOP_EXPERIMENTS = [
  { id: 'joint', label: 'Joint Cuts', jointCuts: true, assistCaptures: true },
  { id: 'independent', label: 'Individual cuts', jointCuts: false, assistCaptures: false },
];
