import { boundedJSON, exactKeys, required } from '../../game/data-json.mjs';
import { createRateProfile } from './rates.mjs';
import { createTunedResponse } from './flight-response.mjs';
import {
  createAircraftPhysics,
  createAircraftControllerTune,
  aircraftCollisionRadius,
  validateAircraftPhysics,
} from './aircraft-physics.mjs';

export const AIRCRAFT_PRESET_FORMAT = 'FpvAircraftPreset.v1';
export const AIRCRAFT_CATALOG_REVISION = 2;
const freeze = (value) => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
};
const source = (url, title, checked = '2026-10-17') => ({ url, title, checked });
const beta = (slug) => `https://betafpv.com/products/${slug}`;
const lava1 = source(beta('lava-ii-1s-battery'), 'LAVA II 1S specifications');
const manufacturer = (sources, note = '') => ({ kind: 'manufacturer', sources, note });
const estimated = (note) => ({ kind: 'estimated', sources: [], note });
const calculated = (note) => ({ kind: 'calculated', sources: [], note });

// The assembled mass already includes motors, propellers, electronics and the
// named video system. Only the selected battery and explicitly absent receiver
// are added. No advertised flight duration is used to fit the physical model.
const references = [
  {
    id: 'air65-ii-racing-2026',
    name: 'BETAFPV Air65 II Racing',
    variant: '2026 · analog · 30000 KV',
    category: 'whoop',
    wheelbase: 65,
    propeller: 31,
    motor: '0702 30000 KV',
    prop: 'Gemfan 1207 three-blade',
    dry: 17.7,
    batteryMass: 8.2,
    cells: 1,
    capacity: 320,
    chemistry: 'lihv',
    batteryName: 'LAVA II 1S 320 mAh',
    dimensions: [80, 29, 80],
    thrust: 0.23,
    lag: 0.012,
    resistance: 0.055,
    current: 9,
    tilt: 25,
    sources: [
      source(beta('air65-ii-brushless-whoop-quadcopter'), 'Air65 II specifications'),
      lava1,
    ],
  },
  {
    id: 'meteor75-analog-2022',
    name: 'BETAFPV Meteor75',
    variant: '2022 · analog · 19500 KV',
    category: 'whoop',
    wheelbase: 75,
    propeller: 40,
    motor: '0802SE 19500 KV',
    prop: '40 mm two-blade',
    dry: 24.98,
    batteryMass: 12.7,
    cells: 1,
    capacity: 450,
    chemistry: 'lihv',
    batteryName: 'BT2.0 1S 450 mAh 30C',
    dimensions: [98, 35, 98],
    thrust: 0.3,
    lag: 0.016,
    resistance: 0.065,
    current: 11,
    tilt: 30,
    sources: [
      source(beta('meteor75-brushless-whoop-quadcopter-1s'), 'Meteor75 2022 specifications'),
      source(beta('bt2-0-450mah-1s-30c-battery-4pcs'), 'BT2.0 battery specifications'),
    ],
  },
  {
    id: 'meteor75-pro-matrix',
    name: 'BETAFPV Meteor75 Pro',
    variant: 'Matrix · analog · 21000 KV',
    category: 'whoop',
    wheelbase: 80.8,
    propeller: 45,
    motor: '1102 21000 KV',
    prop: '45 mm three-blade',
    dry: 30.5,
    batteryMass: 14.1,
    cells: 1,
    capacity: 580,
    chemistry: 'lihv',
    batteryName: 'LAVA II 1S 580 mAh',
    dimensions: [106, 38, 106],
    thrust: 0.42,
    lag: 0.018,
    resistance: 0.045,
    current: 14,
    tilt: 30,
    sources: [
      source(beta('meteor75-pro-brushless-whoop-quadcopter'), 'Meteor75 Pro Matrix specifications'),
      lava1,
    ],
  },
  {
    id: 'meteor85-analog',
    name: 'BETAFPV Meteor85',
    variant: 'Analog · 11000 KV · LAVA battery',
    category: 'whoop',
    wheelbase: 85,
    propeller: 50.8,
    motor: '1103 11000 KV',
    prop: 'Gemfan 2015 two-blade',
    dry: 43.85,
    batteryMass: 26.1,
    cells: 2,
    capacity: 450,
    chemistry: 'lihv',
    batteryName: 'LAVA 2S 450 mAh',
    dimensions: [118, 40, 118],
    thrust: 0.75,
    lag: 0.02,
    resistance: 0.07,
    current: 15,
    tilt: 25,
    sources: [
      source(beta('meteor85-brushless-whoop-quadcopter-2022'), 'Meteor85 specifications'),
      source(beta('lava-2s-3s-4s-450mah-75c-battery-2pcs'), 'LAVA 450 mAh specifications'),
    ],
  },
  {
    id: 'mobula8-analog-2023',
    revision: 1,
    name: 'Happymodel Mobula8',
    variant: '2023 · analog · SPI ELRS · 11000 KV',
    category: 'whoop',
    wheelbase: 85,
    propeller: 52.17,
    motor: 'EX1103 11000 KV',
    prop: 'Gemfan Hurricane 2023 three-blade',
    dry: 43,
    batteryMass: 26.1,
    cells: 2,
    capacity: 450,
    chemistry: 'lihv',
    batteryName: 'LAVA 2S 450 mAh · SIM-selected pack',
    dimensions: [120, 50, 120],
    thrust: 0.75,
    lag: 0.02,
    resistance: 0.07,
    current: 15,
    tilt: 25,
    hardware: {
      frame: 'Mobula8 85 mm ducted frame · transparent black',
      flightController: 'X12 ELRS V2.1 · STM32F411 · ICM20689 or ICM42688P',
      esc: 'Integrated BLHeli_S 4-in-1 · 12 A per channel',
      receiver: 'Integrated SPI ExpressLRS 2.4 GHz',
      camera: 'Caddx ANT 1200 TVL · 14×14 mm',
      videoTransmitter: 'Integrated 5.8 GHz OpenVTX',
      battery:
        'SIM-selected LAVA 2S 450 mAh LiHV XT30, 63×15.5×13.5 mm; aircraft manufacturer recommends 2S 450/550/650 mAh but supplies no battery.',
      revision:
        'Frozen 2023 analog SPI ELRS bill of materials; later X12 V2.3 and digital O3/O4 variants are separate aircraft.',
    },
    propellerNote:
      'Uses the installed Gemfan 2023 diameter of 52.17 mm in the aircraft specification. The separate 2023 frame page gives a conflicting 51 mm maximum; no exact duct clearance is claimed.',
    sources: [
      source(
        'https://www.happymodel.cn/index.php/2023/04/29/happymodel-mobula8-1-2s-85mm-micro-fpv-whoop-drone/',
        'Mobula8 2023 analog SPI ELRS component specification',
        '2026-10-18',
      ),
      source(
        beta('lava-2s-3s-4s-450mah-75c-battery-2pcs'),
        'LAVA 2S 450 mAh reference-pack specification',
        '2026-10-18',
      ),
      source(
        'https://www.happymodel.cn/index.php/2023/04/28/mobula8-frame-85mm-brushless-whoop-frame/',
        'Mobula8 frame specification and conflicting nominal propeller limit',
        '2026-10-18',
      ),
    ],
  },
  {
    id: 'pavo20-pro-ii-o4-4s',
    name: 'BETAFPV Pavo20 Pro II',
    variant: 'O4 Pro · ELRS · 4S · 5500 KV',
    category: 'cinewhoop',
    wheelbase: 93.9,
    propeller: 55.88,
    motor: 'LAVA 1104 5500 KV',
    prop: 'Gemfan D2.2 three-blade',
    dry: 116.2,
    batteryMass: 55,
    cells: 4,
    capacity: 580,
    chemistry: 'lihv',
    batteryName: 'LAVA II 4S 580 mAh',
    dimensions: [140, 55, 140],
    thrust: 2.1,
    lag: 0.024,
    resistance: 0.09,
    current: 35,
    tilt: 20,
    sources: [
      source(
        beta('pavo20-pro-ii-brushless-whoop-quadcopter'),
        'Pavo20 Pro II O4 Pro specifications',
      ),
      source(beta('lava-ii-4s-battery'), 'LAVA II 4S specifications'),
    ],
  },
  {
    id: 'smart35-analog',
    name: 'GEPRC SMART35',
    variant: 'Analog · 3850 KV · 3.5 inch',
    category: 'freestyle',
    wheelbase: 155,
    propeller: 88.9,
    motor: 'GR1404 3850 KV',
    prop: '3.5×2.8×3',
    dry: 127.4,
    batteryMass: 99,
    cells: 4,
    capacity: 850,
    chemistry: 'lipo',
    batteryName: 'Storm 2.0 4S 850 mAh',
    dimensions: [203, 55, 203],
    thrust: 2.6,
    lag: 0.025,
    resistance: 0.06,
    current: 45,
    tilt: 25,
    sources: [
      source(
        'https://geprc.com/product/geprc-smart-35-analog-3-5inch-micro-freestyle-drone/',
        'SMART35 analog specifications',
      ),
      source(
        'https://geprc.com/product/geprc-storm2-0-4s-850-2000mah-150c-lipo-battery/',
        'Storm 2.0 battery specifications',
      ),
    ],
  },
  {
    id: 'nazgul-eco-xl5-v11',
    name: 'iFlight Nazgul ECO XL5',
    variant: 'V1.1 · analog · 6S · 1800 KV',
    category: 'freestyle',
    wheelbase: 245,
    propeller: 127,
    motor: '2207 1800 KV',
    prop: 'Nazgul F5',
    dry: 427,
    batteryMass: 225,
    cells: 6,
    capacity: 1400,
    chemistry: 'lipo',
    batteryName: '6S 1400 mAh reference pack',
    dimensions: [305, 80, 305],
    thrust: 10,
    lag: 0.03,
    resistance: 0.045,
    current: 110,
    tilt: 30,
    sources: [
      source(
        'https://iflight-rc.eu/en/products/nazgul-xl5-eco-v1-1-6s-analog',
        'Nazgul ECO XL5 V1.1 specifications',
      ),
    ],
    batteryDerived: true,
  },
  {
    id: 'mach-r5-sport-2050',
    name: 'iFlight Mach R5 Sport',
    variant: 'European 2050 KV · analog · canopy',
    category: 'racing',
    wheelbase: 210,
    propeller: 127,
    motor: '2207 2050 KV',
    prop: 'Nazgul R5 V2',
    dry: 300,
    batteryMass: 225,
    cells: 6,
    capacity: 1400,
    chemistry: 'lipo',
    batteryName: '6S 1400 mAh reference pack',
    dimensions: [276, 65, 276],
    thrust: 10,
    lag: 0.022,
    resistance: 0.035,
    current: 125,
    tilt: 40,
    sources: [
      source(
        'https://iflight-rc.eu/en/products/mach-r5-sport-6s-race-drone-analog',
        'Mach R5 Sport European 2050 KV specifications',
      ),
    ],
    batteryDerived: true,
  },
  {
    id: 'rekon7-pro-o3',
    name: 'HGLRC Rekon7 PRO',
    variant: 'DJI O3 · 1350 KV · 7 inch',
    category: 'long-range',
    wheelbase: 324,
    propeller: 177.8,
    motor: 'SPECTER 2806.5 1350 KV',
    prop: 'HQProp DP7×4×3',
    dry: 576,
    receiver: 3,
    batteryMass: 450,
    cells: 6,
    capacity: 3000,
    chemistry: 'lipo',
    batteryName: '6S 3000 mAh reference pack',
    dimensions: [415, 95, 420],
    thrust: 14,
    lag: 0.045,
    resistance: 0.04,
    current: 100,
    tilt: 20,
    sources: [
      source(
        'https://www.hglrc.com/products/rekon7-pro-long-range-fpv-analog-digital-version-racing-drone',
        'Rekon7 PRO O3 specifications',
      ),
    ],
    batteryEstimated: true,
  },
  {
    id: 'chimera7-pro-v2-o4',
    name: 'iFlight Chimera7 Pro V2',
    variant: 'O4 · 1250 KV · 7.5 inch',
    category: 'long-range',
    wheelbase: 327,
    propeller: 190.5,
    motor: '2809 1250 KV',
    prop: 'HQ 7.5×3.7×3',
    dry: 725,
    batteryMass: 896,
    cells: 6,
    capacity: 8000,
    chemistry: 'li-ion',
    batteryName: '6S 8000 mAh 21700 Li-ion',
    dimensions: [435, 110, 435],
    thrust: 17,
    lag: 0.05,
    resistance: 0.06,
    current: 60,
    tilt: 20,
    sources: [
      source(
        'https://shop.iflight-rc.com/Chimera7-Pro-6S-HD-Commando-8-Pro1869?search=Chimera',
        'Chimera7 Pro V2 O4 specifications',
      ),
    ],
    batteryDerived: true,
    deadcat: true,
  },
  {
    id: 'helion-pro-o4',
    name: 'iFlight Helion Pro',
    variant: 'O4 · 900 KV · 10 inch',
    category: 'long-range',
    wheelbase: 414,
    propeller: 254,
    motor: '3110 900 KV',
    prop: 'Gemfan 1050',
    dry: 1070,
    batteryMass: 833,
    cells: 6,
    capacity: 5600,
    chemistry: 'lipo',
    batteryName: '6S 5600 mAh reference pack',
    dimensions: [550, 130, 550],
    thrust: 24,
    lag: 0.065,
    resistance: 0.035,
    current: 130,
    tilt: 20,
    sources: [
      source(
        'https://shop.iflight.com/index.php?product_id=3806&route=product%2Fproduct',
        'Helion Pro O4 specifications',
      ),
    ],
    batteryDerived: true,
  },
  {
    id: 'holybro-x650-v2',
    name: 'Holybro X650 V2',
    variant: 'MN4014 330 KV · Gemfan 1555',
    category: 'training',
    video: false,
    wheelbase: 650,
    propeller: 381,
    motor: 'Tmotor MN4014 330 KV',
    prop: 'Gemfan 1555 carbon fiber',
    dry: 2000,
    batteryMass: 1200,
    cells: 6,
    capacity: 10000,
    chemistry: 'lipo',
    batteryName: '6S 10000 mAh reference pack',
    dimensions: [850, 280, 850],
    thrust: 28,
    lag: 0.095,
    resistance: 0.03,
    current: 90,
    tilt: 10,
    sources: [
      source(
        'https://holybro.com/products/x650-development-kit',
        'X650 V2 installed components and masses',
      ),
    ],
  },
];
const maxRates = {
  whoop: 600,
  cinewhoop: 500,
  freestyle: 800,
  racing: 900,
  'long-range': 500,
  training: 300,
};
const catalog = freeze(
  references.map((r) => {
    const batterySource = r.sources.length > 1 ? [1] : [0];
    return {
      format: AIRCRAFT_PRESET_FORMAT,
      id: r.id,
      // Catalog additions do not revise existing aircraft or replay identities.
      revision: r.revision ?? 1,
      name: r.name,
      variant: r.variant,
      category: r.category,
      confidence: 'specification-based-estimate',
      wheelbaseMm: r.wheelbase,
      propellerDiameterMm: r.propeller,
      motor: r.motor,
      propeller: r.prop,
      ...(r.hardware ? { hardware: r.hardware } : {}),
      envelopeMm: { width: r.dimensions[0], height: r.dimensions[1], length: r.dimensions[2] },
      battery: {
        name: r.batteryName,
        massGrams: r.batteryMass,
        cells: r.cells,
        capacityMah: r.capacity,
        chemistry: r.chemistry,
      },
      components: [
        {
          id: 'assembled-aircraft',
          massGrams: r.dry,
          includes: [
            'motors',
            'propellers',
            'electronics',
            ...(r.video === false ? [] : ['video-system']),
          ],
        },
        ...(r.receiver ? [{ id: 'receiver', massGrams: r.receiver, includes: ['receiver'] }] : []),
        { id: 'battery', massGrams: r.batteryMass, includes: ['battery'] },
      ],
      flyingMassGrams: Math.round((r.dry + (r.receiver ?? 0) + r.batteryMass) * 100) / 100,
      starterMaximumRate: maxRates[r.category],
      camera: { tilt: r.tilt, verticalFov: 82 },
      sources: r.sources,
      evidence: {
        assembledMass: manufacturer(
          [0],
          r.video === false
            ? 'Includes installed kit components; no extra camera payload; excludes battery.'
            : 'Includes installed motors, propellers and named video system; excludes battery.',
        ),
        ...(r.receiver
          ? {
              receiverMass: estimated(
                '3 g receiver and wiring allowance; source aircraft mass excludes receiver.',
              ),
            }
          : {}),
        batteryMass: r.batteryEstimated
          ? estimated(
              '450 g reference-pack estimate; manufacturer recommends capacity but does not identify a pack.',
            )
          : r.batteryDerived
            ? calculated(
                'Published battery-inclusive aircraft mass minus published assembled mass.',
              )
            : manufacturer(batterySource),
        flyingMass: calculated('Assembled aircraft + explicit receiver allowance + one battery.'),
        wheelbase: manufacturer([0]),
        propeller: manufacturer(r.propellerNote ? [0, 2] : [0], r.propellerNote ?? ''),
        motor: manufacturer([0]),
        geometry: estimated(
          'Body envelope and rotor arrangement based on aircraft class and published wheelbase; not CAD-measured.',
        ),
        centerOfMass: estimated(
          'Centered installation assumption; detailed component positions are not measured.',
        ),
        inertia: estimated(
          'Class-specific distributed-mass approximation about the center of mass.',
        ),
        propulsion: estimated(
          'Nominal-voltage thrust, reaction torque and motor lag are engineering estimates, not a fitted bench measurement.',
        ),
        drag: estimated(
          'Directional drag estimated from frontal, side and top area; no flight-log fit.',
        ),
        batteryElectrical: estimated(
          'Chemistry voltage boundaries with estimated pack resistance and current limit.',
        ),
        controller: estimated(
          'Independent SIM controller; no Betaflight/PX4/ArduPilot equivalence.',
        ),
        rates: estimated('SIM-authored Actual starter rates, not manufacturer factory rates.'),
        camera: estimated(
          'SIM view defaults; vertical FOV is not a claim about the physical lens.',
        ),
      },
    };
  }),
);

export function listAircraftPresets() {
  return catalog;
}
export function getAircraftPreset(id) {
  const preset = catalog.find((item) => item.id === id);
  required(preset, 'Unknown built-in aircraft preset');
  return preset;
}

const xyz = ['x', 'y', 'z'];
const componentNumber = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const massProperties = (aircraft) => ({
  mass: aircraft.mass,
  inertia: structuredClone(aircraft.inertia),
  centerOfMass: structuredClone(aircraft.geometry.centerOfMass),
  radius: aircraft.radius,
});

/** Component locations and box dimensions are explicit estimates inside the
 * existing central-body envelope. The installed video system stays in dry mass;
 * cameraPayload is additional equipment, never a second copy of that system. */
export function createPresetComponents(id, aircraft) {
  const preset = getAircraftPreset(id);
  aircraft ??= createPresetConfiguration(id).aircraft;
  const half = aircraft.geometry.bodyHalfExtents;
  return validateAircraftComponents({
    format: 'FpvAircraftComponents.v1',
    presetId: id,
    reference: {
      batteryMassGrams: preset.battery.massGrams,
      capacityMah: preset.battery.capacityMah,
      batteryHalfExtents: { x: half.x * 0.6, y: half.y * 0.25, z: half.z * 0.7 },
      payloadHalfExtents: { x: half.x * 0.3, y: half.y * 0.15, z: half.z * 0.3 },
      payloadPosition: { x: 0, y: half.y * 0.65, z: 0 },
      maxPayloadGrams: Math.min(500, preset.flyingMassGrams * 0.5),
    },
    baseline: massProperties(aircraft),
    battery: { massGrams: preset.battery.massGrams, capacityMah: preset.battery.capacityMah },
    cameraPayload: { massGrams: 0 },
  });
}

export function validateAircraftComponents(input) {
  const value = boundedJSON(input, { maxBytes: 4096, maxNodes: 100, maxDepth: 5 });
  exactKeys(
    value,
    ['format', 'presetId', 'reference', 'baseline', 'battery', 'cameraPayload'],
    'aircraft components',
  );
  required(
    value.format === 'FpvAircraftComponents.v1' &&
      typeof value.presetId === 'string' &&
      value.presetId.length <= 80,
    'Invalid aircraft component inventory',
  );
  const reference = value.reference;
  exactKeys(
    reference,
    [
      'batteryMassGrams',
      'capacityMah',
      'batteryHalfExtents',
      'payloadHalfExtents',
      'payloadPosition',
      'maxPayloadGrams',
    ],
    'component reference',
  );
  required(
    componentNumber(reference.batteryMassGrams, 1, 10000) &&
      componentNumber(reference.capacityMah, 50, 80000) &&
      componentNumber(reference.maxPayloadGrams, 0, 500),
    'Invalid reference component mass or capacity',
  );
  for (const key of ['batteryHalfExtents', 'payloadHalfExtents', 'payloadPosition']) {
    exactKeys(reference[key], xyz, key);
    required(
      xyz.every((axis) =>
        componentNumber(reference[key][axis], key === 'payloadPosition' ? 0 : 0.0001, 1),
      ),
      'Invalid component position or dimensions',
    );
  }
  required(
    reference.payloadPosition.x === 0 && reference.payloadPosition.z === 0,
    'Camera payload must remain on the central vertical axis',
  );
  exactKeys(
    value.baseline,
    ['mass', 'inertia', 'centerOfMass', 'radius'],
    'component mass baseline',
  );
  required(
    componentNumber(value.baseline.mass, 0.01, 25) &&
      componentNumber(value.baseline.radius, 0.01, 2),
    'Invalid component baseline mass',
  );
  for (const key of ['inertia', 'centerOfMass']) {
    exactKeys(value.baseline[key], xyz, key);
    required(
      xyz.every((axis) =>
        componentNumber(
          value.baseline[key][axis],
          key === 'inertia' ? 1e-7 : -2,
          key === 'inertia' ? 100 : 2,
        ),
      ),
      'Invalid component baseline inertia or center',
    );
  }
  exactKeys(value.battery, ['massGrams', 'capacityMah'], 'selected battery');
  required(
    componentNumber(
      value.battery.massGrams,
      reference.batteryMassGrams * 0.5,
      reference.batteryMassGrams * 2,
    ) &&
      componentNumber(
        value.battery.capacityMah,
        reference.capacityMah * 0.5,
        reference.capacityMah * 2,
      ),
    'Battery mass and capacity must be within half to twice the reference pack',
  );
  exactKeys(value.cameraPayload, ['massGrams'], 'additional camera payload');
  required(
    componentNumber(value.cameraPayload.massGrams, 0, reference.maxPayloadGrams),
    'Camera payload exceeds this aircraft allowance',
  );
  return value;
}

// Parallel-axis calculation about the frame origin, followed by a shift to the
// new COM. Reference battery and assembled mass are already inside baseline.
function componentMassChange(base, reference, from, to) {
  const batteryDelta = (to.battery.massGrams - from.battery.massGrams) / 1000,
    payloadDelta = (to.cameraPayload.massGrams - from.cameraPayload.massGrams) / 1000;
  if (batteryDelta === 0 && payloadDelta === 0) return structuredClone(base);
  const mass = base.mass + batteryDelta + payloadDelta;
  const centerOfMass = Object.fromEntries(
    xyz.map((axis) => [
      axis,
      (base.mass * base.centerOfMass[axis] + payloadDelta * reference.payloadPosition[axis]) / mass,
    ]),
  );
  const inertia = Object.fromEntries(
    xyz.map((axis) => {
      const others = xyz.filter((item) => item !== axis);
      const squares = (vector) => others.reduce((sum, key) => sum + vector[key] * vector[key], 0);
      return [
        axis,
        base.inertia[axis] +
          base.mass * squares(base.centerOfMass) +
          (batteryDelta * squares(reference.batteryHalfExtents)) / 3 +
          payloadDelta *
            (squares(reference.payloadHalfExtents) / 3 + squares(reference.payloadPosition)) -
          mass * squares(centerOfMass),
      ];
    }),
  );
  return { ...base, mass, inertia, centerOfMass };
}

/** Recompute from a pinned baseline, never repeatedly add payload mass. If an
 * Advanced editor changed mass properties, preserve that explicit adjustment by
 * rebasing once before applying the new component selection. Other aircraft
 * fields and the controller are untouched. */
export function applyAircraftComponents(source, inventory, selection) {
  exactKeys(selection, ['battery', 'cameraPayload'], 'component selection');
  const aircraft = validateAircraftPhysics(source),
    previous = validateAircraftComponents(inventory),
    next = validateAircraftComponents({ ...previous, ...structuredClone(selection) });
  required(
    aircraft.id === previous.presetId,
    'Component inventory belongs to a different aircraft',
  );
  required(
    next.presetId === previous.presetId &&
      JSON.stringify(next.reference) === JSON.stringify(previous.reference),
    'Component reference cannot change during an edit',
  );
  // View/rates-only saves and capacity-only edits must preserve arbitrary
  // custom geometry. Geometry checks below apply only to a mass change.
  if (
    next.battery.massGrams === previous.battery.massGrams &&
    next.cameraPayload.massGrams === previous.cameraPayload.massGrams
  ) {
    aircraft.battery.capacityAh = next.battery.capacityMah / 1000;
    return { aircraft: validateAircraftPhysics(aircraft), components: next };
  }
  required(
    aircraft.geometry.centerOfMass.x === 0 && aircraft.geometry.centerOfMass.z === 0,
    'Component editing requires a centered lateral/fore-aft COM; retain custom geometry in Advanced',
  );
  const referenceSelection = {
    battery: { massGrams: previous.reference.batteryMassGrams },
    cameraPayload: { massGrams: 0 },
  };
  const expected = componentMassChange(
    previous.baseline,
    previous.reference,
    referenceSelection,
    previous,
  );
  if (
    aircraft.mass !== expected.mass ||
    xyz.some(
      (axis) =>
        aircraft.inertia[axis] !== expected.inertia[axis] ||
        aircraft.geometry.centerOfMass[axis] !== expected.centerOfMass[axis],
    )
  ) {
    next.baseline = componentMassChange(
      massProperties(aircraft),
      previous.reference,
      previous,
      referenceSelection,
    );
  }
  if (aircraft.radius !== Math.max(previous.baseline.radius, aircraftCollisionRadius(aircraft)))
    next.baseline.radius = aircraft.radius;
  const updated = componentMassChange(next.baseline, next.reference, referenceSelection, next);
  for (const axis of xyz) {
    required(
      Math.abs(next.reference.payloadPosition[axis]) + next.reference.payloadHalfExtents[axis] <=
        aircraft.geometry.bodyHalfExtents[axis] + 1e-12,
      'Camera payload no longer fits the custom central body',
    );
    required(
      next.reference.batteryHalfExtents[axis] <= aircraft.geometry.bodyHalfExtents[axis],
      'Reference battery no longer fits the custom central body',
    );
  }
  for (const rotor of aircraft.geometry.rotors)
    for (const axis of xyz)
      rotor.position[axis] =
        rotor.position[axis] + aircraft.geometry.centerOfMass[axis] - updated.centerOfMass[axis];
  aircraft.mass = updated.mass;
  aircraft.inertia = updated.inertia;
  aircraft.geometry.centerOfMass = updated.centerOfMass;
  aircraft.radius = Math.max(next.baseline.radius, aircraftCollisionRadius(aircraft));
  aircraft.battery.capacityAh = next.battery.capacityMah / 1000;
  return {
    aircraft: validateAircraftPhysics(aircraft),
    components: validateAircraftComponents(next),
  };
}

/** Numerical configuration contains no source text or URLs. Saved copies are
 * pinned; later catalog revisions never rewrite an aircraft already in use. */
export function createPresetConfiguration(id) {
  const p = getAircraftPreset(id),
    r = references.find((item) => item.id === id);
  const mass = p.flyingMassGrams / 1000,
    armLength = r.wheelbase / 2000;
  const dimensions = {
    x: r.dimensions[0] / 1000,
    y: r.dimensions[1] / 1000,
    z: r.dimensions[2] / 1000,
  };
  const inertia = {
    x: mass * armLength * armLength * 0.24,
    y: mass * armLength * armLength * 0.43,
    z: mass * armLength * armLength * 0.24,
  };
  const nominal = r.chemistry === 'lihv' ? 3.8 : r.chemistry === 'li-ion' ? 3.6 : 3.7;
  const base = {
    format: 'AdvancedAircraft.v1',
    id,
    mass,
    armLength,
    inertia,
    maxThrust: r.thrust,
    radius: Math.sqrt(dimensions.x * dimensions.x + dimensions.z * dimensions.z) / 2,
    reactionTorque: r.propeller / 10000,
    motorTimeConstant: r.lag,
    linearDrag: 0.02 * mass,
    quadraticDrag: 0.02 * mass,
    angularDrag: 0.002 * mass,
    motorOutputLimit: 1,
    sensorNoise: 0,
    vibration: 0,
    battery: {
      nominalVoltage: nominal * r.cells,
      fullVoltage: (r.chemistry === 'lihv' ? 4.35 : 4.2) * r.cells,
      emptyVoltage: (r.chemistry === 'li-ion' ? 2.9 : 3.2) * r.cells,
      resistance: r.resistance,
      fullCurrent: r.current,
      capacityAh: r.capacity / 1000,
    },
  };
  const frontal = dimensions.x * dimensions.y * 0.32,
    side = dimensions.z * dimensions.y * 0.32,
    top = dimensions.x * dimensions.z * 0.22;
  const lever = armLength / Math.SQRT2;
  const rotors = r.deadcat
    ? [
        { position: { x: -lever * 1.1, y: 0, z: -lever * 0.9 }, spin: -1 },
        { position: { x: lever * 1.1, y: 0, z: -lever * 0.9 }, spin: 1 },
        { position: { x: lever * 0.9, y: 0, z: lever * 1.1 }, spin: -1 },
        { position: { x: -lever * 0.9, y: 0, z: lever * 1.1 }, spin: 1 },
      ]
    : undefined;
  const aircraft = createAircraftPhysics(base, {
    wheelbase: r.wheelbase / 1000,
    propellerDiameter: r.propeller / 1000,
    dimensions: { x: r.wheelbase * 0.00028, y: dimensions.y, z: r.wheelbase * 0.00042 },
    centerOfMass: { x: 0, y: 0, z: 0 },
    ...(rotors ? { rotors } : {}),
    ducted: ['whoop', 'cinewhoop'].includes(r.category),
    linearDrag: { x: mass * 0.025, y: mass * 0.04, z: mass * 0.025 },
    quadraticDrag: { x: side * 0.6125, y: top * 0.735, z: frontal * 0.6125 },
    angularDrag: { x: inertia.x * 0.35, y: inertia.y * 0.25, z: inertia.z * 0.35 },
    idleSpeed: r.category === 'training' ? 0.06 : 0.08,
    airmode: true,
    chemistry: r.chemistry,
    currentLimit: r.current,
    depletion: false,
  });
  const response = createTunedResponse(
    createRateProfile({
      algorithm: 'actual',
      axes: Object.fromEntries(
        ['roll', 'pitch', 'yaw'].map((axis) => [
          axis,
          { rcRate: 10, rate: p.starterMaximumRate / 10, expo: 25 },
        ]),
      ),
    }),
  );
  return {
    aircraft,
    controller: createAircraftControllerTune(aircraft),
    response,
    camera: structuredClone(p.camera),
    preset: { id: p.id, revision: p.revision },
    components: createPresetComponents(id, aircraft),
  };
}
