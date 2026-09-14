import { createRun, stepRun, FIXED_DT } from '../../game/core/index.mjs';
export const pickupKinds = Object.freeze({
  life: 'extra-life',
  speed: 'player-speed',
  slow: 'enemy-slow',
  freeze: 'enemy-freeze',
});
/** The fixture is normalized through the real simulation API, then held. It
 * never receives a player profile, execution catalog, live run or persistence. */
export function createStudioPreviewRun(packs, slotId) {
  const enemyType = slotId.startsWith('enemy.') ? slotId.slice(6) : null;
  const levels = packs.flatMap((pack) => pack.campaigns.flatMap((campaign) => campaign.levels));
  const level = structuredClone(
    (enemyType && levels.find((item) => item.enemies?.some((enemy) => enemy.type === enemyType))) ||
      packs[0].campaigns[0].levels[0],
  );
  if (slotId.startsWith('terrain.') && !slotId.endsWith('wall'))
    level.classic.terrain = [
      { id: 'studio-material', kind: slotId.slice(8), x: 40, y: 14, w: 4, h: 5 },
    ];
  if (slotId.startsWith('pickup.') && pickupKinds[slotId.slice(7)])
    level.classic.powerups = [
      { id: 'studio-pickup', kind: pickupKinds[slotId.slice(7)], x: 10.5, y: 8.5 },
    ];
  if (slotId === 'pickup.objective')
    level.objectives = [{ id: 'studio-objective', x: 10.5, y: 8.5 }];
  if (slotId === 'pickup.supply')
    level.supplies = [{ id: 'studio-supply', x: 10.5, y: 8.5, radius: 1 }];
  const run = createRun(level, { seed: 42 });
  for (let i = 0; i < 12; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  return { level, run };
}
