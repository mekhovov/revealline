/** Decorative sources never declare collision. Modules join at native pixel density. */
export const OVERFLIGHT_WORLD_MATERIAL_SLOTS = Object.freeze(
  Object.fromEntries(
    ['earth', 'concrete', 'damaged', 'timber', 'masonry', 'metal'].map((id) => [
      id,
      `world.overflight.material.${id}`,
    ]),
  ),
);
export const OVERFLIGHT_WORLD_PROP_SLOTS = Object.freeze(
  Object.fromEntries(
    [
      'road',
      'tracks',
      'rail',
      'foundation',
      'crater',
      'tree',
      'container',
      'antenna',
      'rubble',
      'pallet',
      'barrel',
      'cable',
      'wheel',
      'puddle',
      'bollard',
      'pipe',
      'timber-stack',
      'spoil',
      'conveyor',
      'survey-post',
      'crate',
      'stump',
      'irrigation',
      'glass',
    ].map((id) => [id, `world.overflight.prop.${id}`]),
  ),
);
export const OVERFLIGHT_WORLD_ASSEMBLY_FAMILIES = Object.freeze([
  'shelter',
  'planter',
  'container',
  'dispatch',
  'antenna',
  'receiver',
  'pump',
  'floodgate',
  'terrace',
  'reclaimer',
  'glasshouse',
  'irrigator',
]);
const assemblyTrims = ['field', 'freight', 'relay', 'port', 'quarry', 'orchard'];
export const OVERFLIGHT_WORLD_ASSEMBLY_SLOTS = Object.freeze(
  Object.fromEntries(
    OVERFLIGHT_WORLD_ASSEMBLY_FAMILIES.map((family, index) => [
      family,
      Object.freeze({
        panel: `world.overflight.module.${family}-panel`,
        cap: `world.overflight.module.${assemblyTrims[Math.floor(index / 2)]}-cap`,
        corner: `world.overflight.module.${assemblyTrims[Math.floor(index / 2)]}-corner`,
      }),
    ]),
  ),
);
export const OVERFLIGHT_WORLD_IMAGE_SLOTS = Object.freeze([
  ...Object.values(OVERFLIGHT_WORLD_MATERIAL_SLOTS),
  ...Object.values(OVERFLIGHT_WORLD_PROP_SLOTS),
  ...new Set(Object.values(OVERFLIGHT_WORLD_ASSEMBLY_SLOTS).flatMap(Object.values)),
]);

/** Exact image bindings consumed by one prepared scene, independent of the kit name.
 * Custom regions/props remain authoritative; unrelated worlds need no decoded art. */
export function overflightWorldImageSlots(presentation) {
  const selected = new Set();
  for (const region of presentation?.regions ?? [])
    selected.add(OVERFLIGHT_WORLD_MATERIAL_SLOTS[region.material]);
  for (const landmark of presentation?.landmarks ?? [])
    selected.add(OVERFLIGHT_WORLD_PROP_SLOTS[landmark.kind]);
  for (const path of presentation?.paths ?? [])
    selected.add(OVERFLIGHT_WORLD_PROP_SLOTS[path.kind]);
  for (const assembly of presentation?.assemblies ?? [])
    for (const slot of Object.values(OVERFLIGHT_WORLD_ASSEMBLY_SLOTS[assembly.family] ?? {}))
      selected.add(slot);
  return Object.freeze(OVERFLIGHT_WORLD_IMAGE_SLOTS.filter((slot) => selected.has(slot)));
}
