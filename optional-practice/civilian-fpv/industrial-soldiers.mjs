/** Native 3D counterparts to the shared overhead wardrobe. The host owns every
 * material, mesh, clock and collision shape. These rigs grant no capabilities. */
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../../game/hunt/actor-catalog.mjs';
import { INDUSTRIAL_SOLDIER_KITS } from '../../game/hunt/industrial-soldier-kit.mjs';

export const INDUSTRIAL_SOLDIER_REVISION = 'industrial-roster-v3';
export const INDUSTRIAL_SOLDIER_FAMILIES = Object.freeze(ACTOR_FAMILIES.map(({ id }) => id));
export const INDUSTRIAL_SOLDIER_CASTS = Object.freeze(ACTOR_CASTS.map(({ id }) => id));
export const INDUSTRIAL_SOLDIER_LIMITS = Object.freeze({ lowMeshes: 48, detailedMeshes: 72 });
export function industrialSoldierPaintKeys(family) {
  const kit = INDUSTRIAL_SOLDIER_KITS[family];
  if (!kit) throw new TypeError('Unknown industrial soldier paint identity.');
  return [
    ...new Set([
      'coat',
      'pants',
      'dark',
      'light',
      'trim',
      'skin',
      'skinLight',
      'glove',
      'patch',
      ...kit.rectangles.map(([role]) => role),
    ]),
  ];
}

const nativeFamilies = INDUSTRIAL_SOLDIER_FAMILIES.filter(
  (id) => !['guard', 'relay-warden'].includes(id),
);

export function resolveIndustrialSoldierFamily({
  revision,
  actor,
  family,
  huntTarget = false,
  collectionId,
  collectionRevision,
  assetRole,
} = {}) {
  return revision === INDUSTRIAL_SOLDIER_REVISION &&
    collectionId === 'military-field' &&
    collectionRevision === 'r1' &&
    assetRole === 'builtin:military-field-soldier' &&
    ['patrol', 'sentry'].includes(actor?.type) &&
    actor.role === 'hostile' &&
    actor.fireEveryTicks === 0 &&
    huntTarget &&
    nativeFamilies.includes(family)
    ? family
    : null;
}

const shapes = Object.freeze({
  lookout: [1.04, 0.9],
  patroller: [1.12, 1],
  runner: [0.87, 0.86],
  sprinter: [0.94, 0.85],
  courier: [0.95, 0.92],
  guard: [1.18, 1.07],
  'refuge-seeker': [1.14, 1.04],
  switchback: [0.95, 0.93],
  'rendezvous-pair': [1.06, 0.95],
  'shield-bearer': [1.08, 1.03],
  'brace-trooper': [1.2, 1.1],
  'relay-warden': [1.25, 1.12],
});

/** Forward is local -Z. Body dimensions use the accepted capsule only as a
 * presentation scale; no exported mesh is ever passed to native collision. */
export function buildIndustrialSoldier({
  THREE,
  parent,
  part,
  family,
  cast,
  radius,
  height,
  quality = 'balanced',
  paints,
}) {
  if (!INDUSTRIAL_SOLDIER_FAMILIES.includes(family) || !INDUSTRIAL_SOLDIER_CASTS.includes(cast))
    throw new TypeError('Unknown industrial soldier identity.');
  if (
    ![radius, height].every((n) => Number.isFinite(n) && n > 0) ||
    !['low', 'balanced', 'high'].includes(quality) ||
    !parent?.add ||
    typeof part !== 'function'
  )
    throw new TypeError('Industrial soldiers need bounded native dimensions and an owned host.');
  for (const role of industrialSoldierPaintKeys(family))
    if (!paints?.[role]) throw new TypeError(`Missing industrial soldier paint: ${role}.`);
  const detail = quality !== 'low',
    kit = INDUSTRIAL_SOLDIER_KITS[family],
    [breadth, depth] = shapes[family],
    kitPaint = (index) => kit.rectangles[index][0],
    winter = cast === 'arcade',
    worn = cast === 'rivals';
  const joint = (name, at, owner = parent) => {
    const node = new THREE.Group();
    node.name = `industrial-soldier-${name}`;
    node.position.set(...at);
    owner.add(node);
    return node;
  };
  const box = (name, size, at, paint = 'coat', owner = parent) => {
    const node = part(new THREE.BoxGeometry(...size), paints[paint], at, owner);
    node.name = `industrial-soldier-${name}`;
    return node;
  };
  const round = (name, size, at, paint = 'coat', owner = parent) => {
    const node = part(
      new THREE.CylinderGeometry(size[0], size[1], size[2], detail ? 10 : 6),
      paints[paint],
      at,
      owner,
    );
    node.name = `industrial-soldier-${name}`;
    return node;
  };
  const body = joint('body', [0, 0, 0]),
    head = joint('head', [0, height * 0.865, 0], body),
    legs = [],
    arms = [],
    accessories = {};
  box(
    'torso',
    [radius * 1.12 * breadth, height * 0.285, radius * 0.8 * depth],
    [0, height * 0.605, 0],
    'coat',
    body,
  );
  box(
    'vest',
    [radius * 0.92 * breadth, height * 0.205, radius * 0.12],
    [0, height * 0.61, -radius * 0.45 * depth],
    'dark',
    body,
  );
  box(
    'belt',
    [radius * 1.14 * breadth, height * 0.036, radius * 0.84 * depth],
    [0, height * 0.47, 0],
    'trim',
    body,
  );
  round(
    'face',
    [radius * 0.45, radius * 0.38, height * 0.115],
    [0, 0, -radius * 0.045],
    'skin',
    head,
  );
  round(
    'helmet',
    [radius * (winter ? 0.65 : 0.58), radius * 0.62, height * 0.079],
    [0, height * 0.061, 0],
    'coat',
    head,
  );
  box(
    'helmet-rim',
    [radius * 1.08, height * 0.021, radius * 0.23],
    [0, height * 0.036, -radius * 0.46],
    'dark',
    head,
  );
  box(
    'nose',
    [radius * 0.16, height * 0.025, radius * 0.14],
    [0, -height * 0.007, -radius * 0.44],
    'skinLight',
    head,
  );
  for (const side of [-1, 1]) {
    const leg = joint(`leg-${side}`, [side * radius * 0.32, height * 0.405, 0]),
      knee = joint(`knee-${side}`, [0, -height * 0.18, 0], leg),
      arm = joint(`arm-${side}`, [side * radius * 0.7 * breadth, height * 0.72, 0], body),
      elbow = joint(`elbow-${side}`, [0, -height * 0.14, 0], arm);
    box(
      'thigh',
      [radius * 0.35, height * 0.19, radius * 0.43],
      [0, -height * 0.095, 0],
      'pants',
      leg,
    );
    box(
      'shin',
      [radius * 0.32, height * 0.16, radius * 0.4],
      [0, -height * 0.08, 0],
      'pants',
      knee,
    );
    box(
      'boot',
      [radius * 0.4, height * 0.058, radius * 0.7],
      [0, -height * 0.177, -radius * 0.12],
      'dark',
      knee,
    );
    box(
      'sleeve',
      [radius * 0.32 * (winter ? 1.1 : 1), height * 0.145, radius * 0.36],
      [0, -height * 0.0725, 0],
      'coat',
      arm,
    );
    box(
      'forearm',
      [radius * 0.28, height * 0.13, radius * 0.32],
      [0, -height * 0.065, 0],
      worn ? 'skin' : 'coat',
      elbow,
    );
    box(
      'glove',
      [radius * 0.3, height * 0.037, radius * 0.35],
      [0, -height * 0.14, 0],
      'glove',
      elbow,
    );
    box(
      'webbing',
      [radius * 0.105, height * 0.18, radius * 0.045],
      [side * radius * 0.3, height * 0.625, -radius * 0.53 * depth],
      'trim',
      body,
    );
    legs.push({ joint: leg, knee, side });
    arms.push({ joint: arm, elbow, side });
    if (detail) {
      box(
        'knee-pad',
        [radius * 0.26, height * 0.048, radius * 0.065],
        [0, -0.006 * height, -radius * 0.22],
        'dark',
        knee,
      );
      box(
        'eye',
        [radius * 0.07, height * 0.008, radius * 0.025],
        [side * radius * 0.19, height * 0.012, -radius * 0.43],
        'dark',
        head,
      );
    }
  }
  if (winter) {
    box(
      'parka-collar',
      [radius * 1.01, height * 0.055, radius * 0.75],
      [0, height * 0.774, radius * 0.04],
      'light',
      body,
    );
    for (const side of [-1, 1])
      box(
        'hood-flap',
        [radius * 0.15, height * 0.105, radius * 0.5],
        [side * radius * 0.49, height * 0.862, radius * 0.07],
        'light',
        body,
      );
  } else if (worn) {
    box(
      'repair-patch',
      [radius * 0.28, height * 0.055, radius * 0.035],
      [radius * 0.31, height * 0.69, -radius * 0.468 * depth],
      'patch',
      body,
    );
    box(
      'uneven-pouch',
      [radius * 0.36, height * 0.085, radius * 0.18],
      [-radius * 0.42, height * 0.51, -radius * 0.5],
      'patch',
      body,
    );
  } else {
    for (const side of [-1, 1])
      box(
        'vest-pouch',
        [radius * 0.31, height * 0.085, radius * 0.16],
        [side * radius * 0.29, height * 0.58, -radius * 0.55],
        'trim',
        body,
      );
  }
  const equipment = joint('equipment', [0, 0, 0], body);
  equipment.userData.kitId = kit.id;
  equipment.userData.material = kit.material;
  const pack = (name, width = 0.92, tall = 0.19, back = 0.67, paint = 'trim') =>
    box(
      name,
      [radius * width, height * tall, radius * 0.35],
      [0, height * 0.62, radius * back],
      paint,
      equipment,
    );
  if (family === 'lookout') {
    const binoculars = joint('binoculars', [0, height * 0.7, -radius * 0.68], equipment);
    for (const side of [-1, 1]) {
      const lens = round(
        'binocular-lens',
        [radius * 0.17, radius * 0.2, radius * 0.38],
        [side * radius * 0.23, 0, 0],
        kitPaint(0),
        binoculars,
      );
      lens.rotation.x = Math.PI / 2;
      const glass = round(
        'binocular-glass',
        [radius * 0.135, radius * 0.135, radius * 0.018],
        [side * radius * 0.23, 0, -radius * 0.201],
        kitPaint(side === -1 ? 2 : 3),
        binoculars,
      );
      glass.rotation.x = Math.PI / 2;
    }
    accessories.binoculars = binoculars;
  } else if (family === 'patroller') {
    pack('patrol-pack');
    const roll = round(
      'bedroll',
      [radius * 0.24, radius * 0.24, radius * 1.16],
      [0, height * 0.74, radius * 0.62],
      kitPaint(1),
      equipment,
    );
    roll.rotation.z = Math.PI / 2;
  } else if (family === 'runner') {
    box(
      'light-harness',
      [radius * 0.82, height * 0.035, radius * 0.91],
      [0, height * 0.68, 0],
      'trim',
      equipment,
    );
    box(
      'canteen',
      [radius * 0.3, height * 0.09, radius * 0.3],
      [radius * 0.66, height * 0.49, radius * 0.15],
      'patch',
      equipment,
    );
  } else if (family === 'sprinter') {
    for (const side of [-1, 1])
      box(
        'headset',
        [radius * 0.16, height * 0.057, radius * 0.35],
        [side * radius * 0.56, height * 0.883, 0],
        kitPaint(0),
        body,
      );
    box(
      'light-belt-pouch',
      [radius * 0.48, height * 0.07, radius * 0.2],
      [0, height * 0.49, radius * 0.5],
      'trim',
      equipment,
    );
  } else if (family === 'courier') {
    accessories.satchel = joint(
      'satchel-pivot',
      [radius * 0.77, height * 0.54, radius * 0.08],
      equipment,
    );
    box(
      'satchel',
      [radius * 0.46, height * 0.16, radius * 0.52],
      [0, -height * 0.04, 0],
      kitPaint(1),
      accessories.satchel,
    );
    box(
      'satchel-flap',
      [radius * 0.47, height * 0.055, radius * 0.53],
      [0, height * 0.018, 0],
      kitPaint(2),
      accessories.satchel,
    );
    box(
      'satchel-clasp',
      [radius * 0.15, height * 0.025, radius * 0.03],
      [0, -height * 0.025, -radius * 0.275],
      kitPaint(3),
      accessories.satchel,
    );
    box(
      'strap',
      [radius * 0.1, height * 0.21, radius * 0.04],
      [radius * 0.35, height * 0.67, -radius * 0.46],
      'trim',
      equipment,
    );
  } else if (family === 'guard') {
    pack('guard-pack', 0.84, 0.17);
    for (const side of [-1, 1])
      box(
        'guard-pouch',
        [radius * 0.38, height * 0.13, radius * 0.21],
        [side * radius * 0.41, height * 0.54, -radius * 0.61],
        kitPaint(1),
        equipment,
      );
  } else if (family === 'refuge-seeker') {
    pack('shelter-pack', 1.03, 0.24);
    const roll = round(
      'shelter-roll',
      [radius * 0.27, radius * 0.27, radius * 1.28],
      [0, height * 0.79, radius * 0.62],
      kitPaint(1),
      equipment,
    );
    roll.rotation.z = Math.PI / 2;
    box(
      'hood',
      [radius * 0.92, height * 0.05, radius * 0.75],
      [0, height * 0.82, radius * 0.12],
      'trim',
      body,
    );
  } else if (family === 'switchback') {
    box(
      'scarf-collar',
      [radius * 0.94, height * 0.045, radius * 0.72],
      [0, height * 0.792, 0],
      'trim',
      body,
    );
    accessories.scarf = joint(
      'scarf-tip',
      [-radius * 0.42, height * 0.78, radius * 0.42],
      equipment,
    );
    box(
      'scarf',
      [radius * 0.23, height * 0.18, radius * 0.07],
      [0, -height * 0.09, 0],
      'trim',
      accessories.scarf,
    );
  } else if (family === 'rendezvous-pair' || family === 'relay-warden') {
    pack(
      family === 'relay-warden' ? 'command-pack' : 'radio-pack',
      family === 'relay-warden' ? 1.13 : 0.85,
      0.23,
      0.67,
      kitPaint(1),
    );
    const antenna = box(
      'radio-antenna',
      [radius * 0.045, height * 0.23, radius * 0.045],
      [radius * 0.37, height * 0.84, radius * 0.71],
      'dark',
      equipment,
    );
    accessories.antenna = antenna;
    if (family === 'relay-warden') {
      box(
        'command-receiver',
        [radius * 0.45, height * 0.095, radius * 0.25],
        [-radius * 0.74, height * 0.62, 0],
        'trim',
        equipment,
      );
      box(
        'command-map',
        [radius * 0.6, height * 0.07, radius * 0.12],
        [0, height * 0.6, -radius * 0.61],
        'light',
        equipment,
      );
    } else
      box(
        'radio-handset',
        [radius * 0.19, height * 0.1, radius * 0.18],
        [radius * 0.51, height * 0.67, -radius * 0.39],
        'dark',
        equipment,
      );
  } else if (family === 'shield-bearer') {
    accessories.armor = joint('shield', [0, height * 0.55, -radius * 0.81], equipment);
    box(
      'front-plate',
      [radius * 1.6, height * 0.45, radius * 0.12],
      [0, 0, 0],
      kitPaint(0),
      accessories.armor,
    );
    box(
      'shield-face',
      [radius * 1.4, height * 0.4, radius * 0.035],
      [0, 0, -radius * 0.079],
      kitPaint(1),
      accessories.armor,
    );
    box(
      'shield-rim',
      [radius * 1.35, height * 0.015, radius * 0.036],
      [0, height * 0.19, -radius * 0.09],
      kitPaint(2),
      accessories.armor,
    );
    box(
      'shield-view',
      [radius * 0.59, height * 0.027, radius * 0.025],
      [0, height * 0.13, -radius * 0.105],
      kitPaint(3),
      accessories.armor,
    );
  } else if (family === 'brace-trooper') {
    pack('brace-pack', 1.16, 0.27, 0.67, kitPaint(1));
    accessories.armor = joint('brace-plate', [0, height * 0.62, -radius * 0.6], equipment);
    box(
      'brace-panel',
      [radius * 1.27, Math.min(height * 0.25, radius * 1.5), radius * 0.17],
      [0, -Math.min(height * 0.045, radius * 0.27), 0],
      'trim',
      accessories.armor,
    );
    for (const side of [-1, 1])
      box(
        'brace-shoulder',
        [radius * 0.43, height * 0.077, radius * 0.53],
        [side * radius * 0.7, height * 0.75, 0],
        'dark',
        equipment,
      );
  }
  return {
    family,
    cast,
    radius,
    height,
    body,
    head,
    legs,
    arms,
    accessories,
    equipment,
    kitId: kit.id,
    material: kit.material,
  };
}

/** Pure pose projection from accepted state. Reduced motion removes cycles, not
 * the readable crouch/recovery/protection state. It never rotates the actor root. */
export function sampleIndustrialSoldierPose({
  family,
  ticks = 0,
  moving = false,
  phase = 'idle',
  blocked = false,
  active = true,
  reducedMotion = false,
} = {}) {
  if (!INDUSTRIAL_SOLDIER_FAMILIES.includes(family))
    throw new TypeError('Unknown soldier pose family.');
  const cadence = {
    lookout: 7,
    patroller: 8,
    runner: 12,
    sprinter: 13,
    courier: 9,
    guard: 7,
    'refuge-seeker': 7.5,
    switchback: 11,
    'rendezvous-pair': 8.5,
    'shield-bearer': 6.5,
    'brace-trooper': 9.5,
    'relay-warden': 6,
  }[family];
  const seconds = Math.max(0, Number.isFinite(ticks) ? ticks : 0) / 50,
    walking = active && moving && !blocked && !reducedMotion,
    fast = phase === 'burst' || phase === 'flee',
    cycle = walking ? Math.sin(seconds * cadence * (fast ? 1.45 : 1)) : 0,
    breath = !reducedMotion && active && phase === 'recovering' ? Math.sin(seconds * 5) : 0,
    warning = phase === 'warning',
    notice = phase === 'notice',
    crouch = ['sprinter', 'brace-trooper'].includes(family) && warning ? 0.045 : 0;
  return Object.freeze({
    cycle,
    knee: walking ? Math.max(0, -cycle) : 0,
    sink: crouch,
    head:
      reducedMotion || !active
        ? 0
        : family === 'lookout' && !moving
          ? Math.sin(seconds * 0.9) * 0.14
          : notice
            ? 0.12
            : 0,
    breathing: breath * 0.004,
    binoculars: family === 'lookout' && notice ? 0.09 : 0,
    point: ['refuge-seeker', 'switchback'].includes(family) && warning ? 0.3 : 0,
    greet: family === 'rendezvous-pair' && ['waiting', 'recovering'].includes(phase) ? 0.32 : 0,
    satchel: family === 'courier' ? cycle * 0.1 : 0,
    scarf: family === 'switchback' ? cycle * 0.15 : 0,
    armor: family === 'brace-trooper' && phase === 'recovering' ? Math.PI / 3 : 0,
  });
}

export function applyIndustrialSoldierPose(rig, state) {
  const pose = sampleIndustrialSoldierPose({ ...state, family: rig.family }),
    swing = Math.min(0.35, (rig.radius * 0.6) / (rig.height * 0.36)),
    gesture = Math.min(1, (rig.radius * 0.45) / (rig.height * 0.28 * 0.64)),
    satchel = Math.min(1, (rig.radius * 0.22) / (rig.height * 0.16 * 0.1)),
    scarf = Math.min(1, (rig.radius * 0.45) / (rig.height * 0.18 * 0.15));
  rig.body.position.y = rig.height * (-pose.sink + pose.breathing);
  rig.head.rotation.y = pose.head;
  for (const { joint, knee, side } of rig.legs) {
    joint.rotation.x = pose.cycle * swing * side;
    knee.rotation.x = Math.max(0, -pose.cycle * side) * swing * 0.6;
    // Wide authored capsules need a tiny foot lift during a stride. Evaluate
    // the boot's lowest rotated corner, without shifting the actor/collider.
    const ankle = joint.rotation.x + knee.rotation.x,
      sine = Math.sin(ankle),
      bottom =
        rig.height * (0.405 - 0.18 * Math.cos(joint.rotation.x) - 0.206 * Math.cos(ankle)) -
        Math.max(rig.radius * 0.23 * sine, -rig.radius * 0.47 * sine);
    joint.position.y = rig.height * 0.405 + Math.max(0, -bottom + rig.height * 1e-8);
  }
  for (const { joint, elbow, side } of rig.arms) {
    joint.rotation.x =
      -pose.cycle * swing * side - (side === 1 ? (pose.point + pose.greet) * gesture : 0);
    elbow.rotation.x = side === 1 ? -pose.greet * gesture : 0;
  }
  if (rig.accessories.binoculars)
    rig.accessories.binoculars.position.y = rig.height * (0.7 + pose.binoculars);
  if (rig.accessories.satchel) rig.accessories.satchel.rotation.z = pose.satchel * satchel;
  if (rig.accessories.scarf) rig.accessories.scarf.rotation.x = pose.scarf * scarf;
  if (rig.accessories.armor) rig.accessories.armor.rotation.x = pose.armor;
  return pose;
}
