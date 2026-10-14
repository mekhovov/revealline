/** Decorative-only artwork. These slots never declare collision or hazards. */
export const OVERFLIGHT_WORLD_MATERIAL_SLOTS = Object.freeze(
  Object.fromEntries(
    ['earth', 'concrete', 'damaged'].map((id) => [id, `world.overflight.material.${id}`]),
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
    ].map((id) => [id, `world.overflight.prop.${id}`]),
  ),
);
export const OVERFLIGHT_WORLD_IMAGE_SLOTS = Object.freeze([
  ...Object.values(OVERFLIGHT_WORLD_MATERIAL_SLOTS),
  ...Object.values(OVERFLIGHT_WORLD_PROP_SLOTS),
]);
