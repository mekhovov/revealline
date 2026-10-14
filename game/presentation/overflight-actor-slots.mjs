/** Optional, exact Asset Studio contracts. Old releases retain native recipes. */
const soldiers = [
  'lookout',
  'patroller',
  'runner',
  'sprinter',
  'courier',
  'guard',
  'refuge-seeker',
  'switchback',
  'rendezvous-pair',
  'shield-bearer',
  'brace-trooper',
  'relay-warden',
];
const machines = [
  'utility-car',
  'cargo-truck',
  'armored-carrier',
  'scout-car',
  'tracked-tank',
  'radar-truck',
];
const wardrobes = ['tactical', 'rivals', 'arcade'];
export const OVERFLIGHT_ACTOR_SLOTS = Object.freeze([
  ...soldiers.flatMap((family) =>
    wardrobes.map((wardrobe) =>
      Object.freeze({
        id: `overflight.soldier.${family}.${wardrobe}`,
        family,
        wardrobe,
        kind: 'soldier',
        size: 32,
      }),
    ),
  ),
  ...machines.map((family) =>
    Object.freeze({
      id: `overflight.machine.${family}`,
      family,
      kind: 'machine',
      size: 64,
    }),
  ),
]);
export const OVERFLIGHT_ACTOR_SLOT_IDS = Object.freeze(OVERFLIGHT_ACTOR_SLOTS.map(({ id }) => id));
export const OVERFLIGHT_MACHINERY_ALIASES = Object.freeze({
  'utility-car': 'enemy.bouncer',
  'cargo-truck': 'enemy.claimed-rover',
  'armored-carrier': 'enemy.border-patrol',
  'scout-car': 'enemy.contour-patrol',
  'tracked-tank': 'enemy.eroder',
  'radar-truck': 'enemy.relay-sentinel',
});
