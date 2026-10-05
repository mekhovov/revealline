/** Original compact field machinery. The host owns all materials, transforms,
 * clocks and collision data; this module constructs presentation geometry only. */
export const INDUSTRIAL_VEHICLE_REVISION = 'industrial-roster-v3';
export const INDUSTRIAL_VEHICLE_MODELS = Object.freeze([
  'field-utility',
  'cargo-truck',
  'armored-carrier',
  'field-tank',
  'relay-truck',
]);

/** Explicit native appearance wins. A collection fallback requires its complete
 * built-in binding; similarly named custom/Company profiles are not owners. */
export function resolveIndustrialVehicleModel({
  actor,
  courseFormat,
  collectionId,
  collectionRevision,
  assetRole,
} = {}) {
  if (actor?.type !== 'vehicle') return null;
  if (actor.vehicleModel !== undefined)
    return courseFormat === 'FlightCourse.v3' &&
      INDUSTRIAL_VEHICLE_MODELS.includes(actor.vehicleModel)
      ? actor.vehicleModel
      : null;
  return collectionId === 'military-field' &&
    collectionRevision === 'r1' &&
    assetRole === 'builtin:military-utility-car'
    ? 'field-utility'
    : null;
}

/** All dimensions are relative to the existing native radius, with -Z forward.
 * Every mesh passes through the host's registered part() ownership boundary.
 * Wheel pivots rotate on X; the scanner pivot rotates on Y. Neither owns time. */
export function buildIndustrialVehicle({
  THREE,
  parent,
  part,
  model,
  radius,
  quality = 'balanced',
  paints,
}) {
  if (!INDUSTRIAL_VEHICLE_MODELS.includes(model))
    throw new TypeError('Unsupported industrial vehicle model.');
  if (!Number.isFinite(radius) || radius <= 0)
    throw new TypeError('Industrial vehicle radius must be positive.');
  if (!['low', 'balanced', 'high'].includes(quality))
    throw new TypeError('Unsupported industrial vehicle quality.');
  if (!parent?.add || typeof part !== 'function' || !THREE?.BoxGeometry)
    throw new TypeError('Industrial vehicles need a registered presentation host.');
  for (const role of ['armor', 'dark', 'metal', 'glass', 'threat'])
    if (!paints?.[role]) throw new TypeError(`Missing industrial vehicle paint: ${role}.`);

  const detailed = quality !== 'low',
    segments = detailed ? 12 : 8,
    wheels = [],
    accessories = {};
  let radar = null;
  const add = (name, shape, paint, at, owner = parent) => {
    const value = part(
      shape,
      paints[paint],
      at.map((n) => n * radius),
      owner,
    );
    value.name = `industrial-${name}`;
    return value;
  };
  const box = (name, size, at, paint = 'armor', owner = parent) =>
    add(name, new THREE.BoxGeometry(...size.map((n) => n * radius)), paint, at, owner);
  const cylinder = (name, top, bottom, height, at, paint = 'armor', owner = parent) =>
    add(
      name,
      new THREE.CylinderGeometry(top * radius, bottom * radius, height * radius, segments),
      paint,
      at,
      owner,
    );
  const taper = (name, size, at, topWidth, topDepth = 1) => {
    const shape = new THREE.BoxGeometry(...size.map((n) => n * radius)),
      positions = shape.attributes.position;
    for (let i = 0; i < positions.count; i++)
      if (positions.getY(i) > 0) {
        positions.setX(i, positions.getX(i) * topWidth);
        positions.setZ(i, positions.getZ(i) * topDepth);
      }
    positions.needsUpdate = true;
    shape.computeVertexNormals();
    return add(name, shape, 'armor', at);
  };
  const pivot = (name, at, owner = parent) => {
    const value = new THREE.Group();
    value.name = `industrial-${name}`;
    value.position.set(...at.map((n) => n * radius));
    owner.add(value);
    return value;
  };
  const wheel = (side, z, { tracked = false } = {}) => {
    const axle = pivot(tracked ? 'track-roller' : 'wheel', [side * 0.62, 0.23, z]),
      tire = cylinder('tire', 0.2, 0.2, 0.2, [0, 0, 0], 'dark', axle),
      hub = cylinder('hub', 0.095, 0.095, 0.021, [side * 0.106, 0, 0], 'metal', axle);
    tire.rotation.z = hub.rotation.z = Math.PI / 2;
    if (detailed) box('hub-spoke', [0.024, 0.035, 0.15], [side * 0.12, 0, 0], 'dark', axle);
    wheels.push(axle);
    return axle;
  };
  const grille = (at, width = 0.5, count = detailed ? 5 : 3) => {
    for (let i = 0; i < count; i++)
      box('grille-slat', [width, 0.026, 0.027], [at[0], at[1] + i * 0.045, at[2]], 'dark');
  };
  const hatch = (x, y, z, size = 0.23) => {
    const value = cylinder('hatch', size, size, 0.035, [x, y, z], 'dark');
    if (detailed) box('hatch-handle', [0.12, 0.04, 0.025], [x, y + 0.034, z], 'metal');
    return value;
  };

  box('chassis', [1.12, 0.22, 1.53], [0, 0.4, 0], 'dark');
  for (const end of [-1, 1]) box('bumper', [1.12, 0.11, 0.07], [0, 0.42, end * 0.8], 'metal');
  for (const side of [-1, 1]) {
    box('headlight', [0.13, 0.105, 0.028], [side * 0.41, 0.59, -0.822], 'threat');
    box('rear-lamp', [0.1, 0.065, 0.025], [side * 0.44, 0.49, 0.837], 'threat');
  }

  if (model === 'field-tank') {
    const tracks = [];
    for (const side of [-1, 1]) {
      const track = box('track-belt', [0.27, 0.31, 1.58], [side * 0.62, 0.23, 0], 'dark');
      tracks.push(track);
      for (const z of [-0.56, -0.19, 0.19, 0.56]) wheel(side, z, { tracked: true });
      box('track-fender', [0.28, 0.045, 1.61], [side * 0.62, 0.455, 0], 'armor');
      if (detailed)
        for (const z of [-0.65, -0.39, -0.13, 0.13, 0.39, 0.65])
          box('track-shoe', [0.28, 0.032, 0.055], [side * 0.62, 0.403, z], 'metal');
    }
    accessories.tracks = tracks;
    taper('sloped-hull', [1.06, 0.32, 1.45], [0, 0.57, 0], 0.87, 0.86);
    taper('turret', [0.7, 0.25, 0.61], [0, 0.84, -0.03], 0.82, 0.85);
    accessories.cupola = cylinder('cupola', 0.15, 0.19, 0.09, [-0.17, 1.015, 0.04]);
    hatch(-0.17, 1.073, 0.04, 0.12);
    accessories.barrel = box('fixed-barrel', [0.09, 0.09, 0.8], [0.12, 0.86, -0.665], 'dark');
    box('mantlet', [0.24, 0.17, 0.15], [0.12, 0.855, -0.345]);
    for (let i = 0; i < (detailed ? 5 : 3); i++)
      box('engine-grille', [0.55, 0.025, 0.028], [0, 0.738, 0.42 + i * 0.044], 'dark');
    if (detailed) {
      box('turret-bin', [0.58, 0.15, 0.16], [0, 0.83, 0.355], 'metal');
      box('sight', [0.15, 0.07, 0.12], [0.18, 1.001, -0.13], 'glass');
    }
  } else {
    const carrier = model === 'armored-carrier',
      utility = model === 'field-utility',
      axles = carrier ? [-0.58, -0.19, 0.19, 0.58] : utility ? [-0.53, 0.53] : [-0.56, 0.2, 0.59];
    for (const side of [-1, 1]) for (const z of axles) wheel(side, z);
    if (carrier) {
      taper('carrier-armor', [1.11, 0.42, 1.48], [0, 0.69, 0], 0.79, 0.86);
      for (const side of [-1, 1]) {
        const window = box(
          'protected-window',
          [0.3, 0.12, 0.033],
          [side * 0.23, 0.8, -0.673],
          'glass',
        );
        window.rotation.x = -0.18;
        box('side-armor', [0.047, 0.23, 1.1], [side * 0.536, 0.66, 0.05]);
      }
      hatch(0, 0.923, -0.23, 0.2);
      hatch(0, 0.923, 0.33, 0.2);
      box('rear-ramp', [0.62, 0.29, 0.027], [0, 0.655, 0.746], 'dark');
      if (detailed) {
        for (const side of [-1, 1])
          for (const z of [-0.3, 0.16, 0.54])
            box('armor-fastener', [0.024, 0.045, 0.065], [side * 0.566, 0.71, z], 'metal');
        for (const y of [0.61, 0.74])
          box('ramp-hinge', [0.5, 0.025, 0.025], [0, y, 0.767], 'metal');
        box('roof-vent', [0.5, 0.04, 0.13], [0, 0.924, 0.05], 'dark');
      }
    } else {
      const cabZ = utility ? -0.13 : -0.45;
      taper('cab', [0.99, 0.51, utility ? 0.87 : 0.56], [0, 0.76, cabZ], 0.82, 0.9);
      box('bonnet', [0.95, 0.16, utility ? 0.37 : 0.15], [0, 0.6, utility ? -0.61 : -0.725]);
      box('windscreen', [0.71, 0.2, 0.026], [0, 0.872, cabZ - (utility ? 0.407 : 0.264)], 'glass');
      for (const side of [-1, 1])
        box(
          'cab-window',
          [0.022, 0.18, utility ? 0.41 : 0.26],
          [side * 0.436, 0.87, cabZ],
          'glass',
        );
      box('cab-roof', [0.88, 0.055, utility ? 0.82 : 0.56], [0, 1.04, cabZ]);
      if (utility) {
        box('rear-bed', [0.95, 0.23, 0.52], [0, 0.59, 0.51]);
        accessories.rack = box('roof-rack', [0.72, 0.045, 0.58], [0, 1.111, -0.05], 'dark');
        for (const side of [-1, 1])
          box('rack-rail', [0.037, 0.11, 0.61], [side * 0.36, 1.15, -0.05], 'metal');
        const spare = cylinder('spare-wheel', 0.22, 0.22, 0.14, [0, 0.74, 0.87], 'dark');
        spare.rotation.x = Math.PI / 2;
        accessories.spare = spare;
        if (detailed) {
          const hub = cylinder('spare-hub', 0.09, 0.09, 0.024, [0, 0.74, 0.953], 'metal');
          hub.rotation.x = Math.PI / 2;
          for (const z of [-0.28, 0.18])
            box('rack-crossbar', [0.7, 0.036, 0.033], [0, 1.16, z], 'metal');
          box('rear-toolbox', [0.61, 0.18, 0.29], [0, 0.78, 0.49], 'dark');
        }
      } else {
        box('cargo-bed', [1.06, 0.15, 1.01], [0, 0.57, 0.3], 'metal');
        taper('canopy', [0.98, 0.62, 0.96], [0, 0.94, 0.3], 0.88);
        for (const z of [-0.01, 0.3, 0.61])
          box('canopy-strap', [0.89, 0.035, 0.045], [0, 1.268, z], 'dark');
        if (detailed)
          for (const side of [-1, 1])
            for (const z of [-0.01, 0.3, 0.61])
              box('canopy-tie', [0.03, 0.55, 0.045], [side * 0.488, 0.91, z], 'dark');
        if (model === 'relay-truck') {
          accessories.mast = cylinder('scanner-mast', 0.03, 0.043, 0.11, [0, 1.328, 0.33], 'dark');
          radar = pivot('scanner', [0, 1.405, 0.33]);
          const dish = cylinder('scanner-face', 0.25, 0.21, 0.055, [0, 0, 0], 'metal', radar);
          dish.rotation.x = 0.4;
          box('scanner-feed', [0.06, 0.04, 0.23], [0, 0.071, -0.05], 'dark', radar);
          const reel = cylinder('cable-reel', 0.16, 0.16, 0.22, [0, 0.86, 0.875], 'dark');
          reel.rotation.x = Math.PI / 2;
          accessories.reel = reel;
          if (detailed) {
            const rim = cylinder('reel-rim', 0.18, 0.18, 0.025, [0, 0.86, 0.997], 'metal');
            rim.rotation.x = Math.PI / 2;
            for (const x of [-0.13, 0, 0.13])
              box('scanner-rib', [0.025, 0.026, 0.29], [x, 0.06, 0], 'dark', radar);
          }
        }
      }
      grille([0, 0.49, -0.825]);
      if (detailed)
        for (const side of [-1, 1]) {
          box('mirror', [0.07, 0.12, 0.09], [side * 0.561, 0.9, cabZ - 0.17], 'metal');
          box('entry-step', [0.12, 0.035, 0.29], [side * 0.555, 0.45, cabZ + 0.1], 'metal');
          box('door-handle', [0.027, 0.035, 0.11], [side * 0.475, 0.74, cabZ + 0.13], 'dark');
        }
    }
  }
  return { wheels, radar, accessories };
}
