/** Presentation identity shared by Classic's painter and sound adapter. The
 * equipment silhouette is stable across appearances, including restrained/retro. */
const MACHINE_FAMILIES = Object.freeze({
  jammer: 'radar-truck',
  lane: 'tracked-tank',
  relay: 'radar-truck',
  perimeter: 'utility-car',
  contour: 'scout-car',
  rover: 'armored-carrier',
  ricochet: 'utility-car',
  eroder: 'cargo-truck',
  guard: 'tracked-tank',
});

export function classicTargetIdentity(kind, _boardStyle = 'theme') {
  const machinery = MACHINE_FAMILIES[kind];
  return machinery
    ? {
        family: machinery,
        humanoid: false,
        machine: machinery === 'tracked-tank' ? 'tracked' : 'wheeled',
      }
    : { family: kind, humanoid: true, machine: false };
}
