/** Presentation identity shared by Classic's painter and sound adapter. The
 * board style changes these specialist silhouettes, never their gameplay. */
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

export function classicTargetIdentity(kind, boardStyle = 'theme') {
  const machinery = boardStyle === 'living-circuit' && MACHINE_FAMILIES[kind];
  return machinery
    ? {
        family: machinery,
        humanoid: false,
        machine: machinery === 'tracked-tank' ? 'tracked' : 'wheeled',
      }
    : { family: kind, humanoid: true, machine: false };
}
