import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AIRCRAFT_CATALOG_REVISION,
  listAircraftPresets,
  getAircraftPreset,
  createPresetConfiguration,
  applyAircraftComponents,
  validateAircraftComponents,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import {
  aircraftPerformance,
  validateAircraftPhysics,
} from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { createRateEvaluator } from '../../optional-practice/civilian-fpv/rates.mjs';

test('the offline catalog contains distinct immutable aircraft, independently of saved setup capacity', () => {
  const catalog = listAircraftPresets();
  assert.ok(catalog.some((p) => p.id === 'mobula8-analog-2023'));
  assert.equal(new Set(catalog.map((p) => p.id)).size, catalog.length);
  assert.throws(() => (catalog[0].battery.massGrams = 999), TypeError);
  assert.throws(() => catalog.push({}), TypeError);
  assert.throws(() => getAircraftPreset('missing'), /Unknown/);
  for (const p of catalog) {
    assert.equal(p.confidence, 'specification-based-estimate');
    assert.ok(p.sources.length > 0 && p.sources.every((s) => s.url.startsWith('https://')));
    assert.equal(p.evidence.propulsion.kind, 'estimated');
    assert.equal(p.evidence.inertia.kind, 'estimated');
    assert.equal(p.evidence.drag.kind, 'estimated');
    assert.equal(p.components.filter((part) => part.includes.includes('battery')).length, 1);
    assert.ok(
      Math.abs(p.components.reduce((sum, part) => sum + part.massGrams, 0) - p.flyingMassGrams) <
        1e-10,
    );
  }
});

test('Nazgul dimension correction preserves all fourteen other complete default configurations byte for byte', () => {
  // Earlier baselines predate catalog revision 3; Cetus X and Protos were
  // captured from cf13 before the Nazgul-only revision 4 correction.
  // Covers physics, response, controller, camera,
  // component baseline and pinned preset revision used by saved flight identities.
  assert.equal(AIRCRAFT_CATALOG_REVISION, 4);
  const originalDefaults = {
    'mobula8-analog-2023': 'bc4c49364de93e47ce91299188af56f8a89035d7d32f9d3e71868685056223c2',
    'cetus-x-betaflight-2022': '7f704557638fdaefc2b1b2b6f1f4e4ff4ccb241073aeab02c1a3571aa963c2e2',
    'protos-16-aio-1-0': '4dfd3c0b84d6efa466f040e2cfaa717a248be40fd986acea6e0cc7fba04f2bc9',
    'air65-ii-racing-2026': 'bb0810c27292d9077c944fdf712c9e95ae841c9171ec4a04fe2eb0b4eb6733f4',
    'meteor75-analog-2022': 'f787e79d44ce7ed83843ac962f6ec6c7daf3268cc45c3a14c5ef8bbc081f94c7',
    'meteor75-pro-matrix': '35b1edd5860c1e93c61695baf311a526ca13630abdd72a6c34d0fb7415c569f0',
    'meteor85-analog': '12c94ae9d41433474a38ad75958e6c4327e1ae1a3a0326e9f57936c1a5ec0bb3',
    'pavo20-pro-ii-o4-4s': 'fca7fda1b907ad6993a3bba3fbcfc9822a79fe4fab11b5d00c49b6dd49f6f71f',
    'smart35-analog': '539e6bf442c4b759179f510712cf8054902cbb2b08183c8ec8129cd6c557c04d',
    'mach-r5-sport-2050': 'ae487a74fdd8c04b6be7184d6d92a6e429c5ca886b26192ae53e756c4eb9ebae',
    'rekon7-pro-o3': 'f515e40bdfab754fee902687f58ac2413faeca9d644a59b10384ae2aeec8a407',
    'chimera7-pro-v2-o4': '94b4387e47e6792a114bde769a3386f4c76a9fe47fca6711c80b703240f3729d',
    'helion-pro-o4': 'b2d68747f248621b5c31a263a2d952fdb46f7cf4d8f551edb3023855fd5ca742',
    'holybro-x650-v2': 'c0ab61cb9bc3496926c9b3c869dcf3f2b51ec55f732d092c14c4f87db23b2d42',
  };
  for (const [id, expected] of Object.entries(originalDefaults)) {
    const actual = createHash('sha256')
      .update(JSON.stringify(createPresetConfiguration(id)))
      .digest('hex');
    assert.equal(actual, expected, id);
  }
});

test('Mobula8 freezes the analog SPI ELRS components and explicit reference battery without double counting', () => {
  const preset = getAircraftPreset('mobula8-analog-2023');
  assert.equal(preset.revision, 1);
  assert.equal(preset.flyingMassGrams, 69.1);
  assert.equal(preset.components[0].massGrams, 43);
  assert.equal(preset.battery.massGrams, 26.1);
  assert.equal(preset.battery.cells, 2);
  assert.equal(preset.battery.capacityMah, 450);
  assert.equal(preset.battery.chemistry, 'lihv');
  assert.equal(preset.wheelbaseMm, 85);
  assert.equal(preset.propellerDiameterMm, 52.17);
  assert.deepEqual(preset.envelopeMm, { width: 120, height: 50, length: 120 });
  assert.match(preset.hardware.flightController, /X12 ELRS V2\.1/);
  assert.match(preset.hardware.camera, /Caddx ANT/);
  assert.match(preset.hardware.battery, /SIM-selected/);
  assert.match(preset.evidence.propeller.note, /conflicting 51 mm/);
  assert.deepEqual(preset.evidence.propeller.sources, [0, 2]);
  assert.deepEqual(preset.evidence.batteryMass.sources, [1]);
  assert.throws(() => (preset.hardware.camera = 'different camera'), TypeError);
  const configuration = createPresetConfiguration(preset.id);
  assert.equal(configuration.aircraft.mass, 0.0691);
  assert.equal(configuration.aircraft.geometry.propellerRadius, 0.026085);
  assert.doesNotMatch(JSON.stringify(configuration), /happymodel\.cn|X12 ELRS|Caddx/);
});

test('historical Cetus X keeps reviewer dry mass separate from a calculated series-cell inventory', () => {
  const p = getAircraftPreset('cetus-x-betaflight-2022');
  const c = createPresetConfiguration(p.id);
  assert.equal(p.revision, 1);
  assert.match(p.variant, /2022.*Betaflight SPI ELRS.*original 30C/);
  assert.equal(p.components[0].massGrams, 56);
  assert.equal(p.evidence.assembledMass.kind, 'reviewer-reported');
  assert.match(p.sources[p.evidence.assembledMass.sources[0]].url, /oscarliang/);
  assert.match(p.evidence.assembledMass.note, /Manufacturer lists 55 g/);
  assert.match(p.evidence.assembledMass.note, /rounded 81 g/);
  assert.equal(p.battery.massGrams, 2 * 12.7);
  assert.deepEqual(p.battery.assembly, {
    series: 2,
    parallel: 1,
    cellCapacityMah: 450,
    cellMassGrams: 12.7,
  });
  assert.equal(p.evidence.batteryMass.kind, 'calculated');
  assert.equal(p.evidence.flyingMass.kind, 'calculated');
  assert.equal(p.flyingMassGrams, 81.4);
  assert.equal(c.aircraft.mass, 0.0814);
  assert.equal(c.aircraft.battery.capacityAh, 0.45, 'series capacity must not become 0.9 Ah');
  assert.equal(c.aircraft.battery.nominalVoltage, 7.6);
  assert.equal(c.aircraft.battery.fullVoltage, 8.7);
  assert.equal(c.components.reference.batteryMassGrams, 25.4);
  assert.equal(c.components.reference.capacityMah, 450);
  assert.equal(p.propellerDiameterMm, 50.3);
  assert.match(p.hardware.camera, /Caddx Nano Ant \/ Runcam Nano 4/);
  assert.match(p.notice.en, /no proprietary Cetus hold modes/);
  assert.doesNotMatch(JSON.stringify(c), /oscarliang|Caddx|reviewer/);
});

test('Protos explicitly marks inferred inclusive mass and uses its pack-specific voltage bounds', () => {
  const p = getAircraftPreset('protos-16-aio-1-0');
  const c = createPresetConfiguration(p.id);
  assert.equal(p.revision, 1);
  assert.equal(p.components[0].massGrams, 62.5);
  assert.equal(p.battery.massGrams, 41.9);
  assert.equal(p.flyingMassGrams, 104.4, 'the included pack must not be added to 104.4 g twice');
  assert.equal(p.evidence.assembledMass.kind, 'calculated');
  assert.equal(p.evidence.batteryMass.kind, 'manufacturer');
  assert.equal(p.evidence.flyingMass.kind, 'inferred');
  assert.match(p.evidence.assembledMass.note, /tolerance bound is 2.0 g/);
  assert.match(p.evidence.flyingMass.note, /without battery-inclusion basis/);
  assert.match(p.notice.en, /Stock Protos position\/height hold.*not reproduced/);
  assert.match(
    p.evidence.controller.note,
    /factory curves, latency and PID behavior are unsupported/,
  );
  assert.equal(c.aircraft.mass, 0.1044);
  assert.equal(c.aircraft.battery.chemistry, 'Li-ion');
  assert.equal(c.aircraft.battery.capacityAh, 0.84);
  assert.equal(c.aircraft.battery.nominalVoltage, 7.6);
  assert.ok(
    Math.abs(c.aircraft.battery.nominalVoltage * c.aircraft.battery.capacityAh - 6.384) < 1e-12,
  );
  assert.equal(
    c.aircraft.battery.fullVoltage,
    8.5,
    'the 8.70 V operating limit is not full charge',
  );
  assert.equal(c.aircraft.battery.emptyVoltage, 6);
  assert.equal(p.evidence.nominalVoltage.kind, 'calculated');
  assert.equal(p.evidence.fullVoltage.kind, 'manufacturer');
  assert.equal(p.evidence.batteryElectrical.kind, 'estimated');
  assert.equal(p.starterMaximumRate, 500);
  assert.equal(c.response.rates.algorithm, 'actual');
  assert.equal(c.aircraft.battery.depletion, false);
  assert.deepEqual(p.envelopeMm, { width: 110, height: 41, length: 102.8 });
  assert.doesNotMatch(JSON.stringify(c), /shopify|WE are FPV|Ascent/);
});

test('documented assembled masses count installed cameras, motors and batteries once', () => {
  assert.equal(getAircraftPreset('pavo20-pro-ii-o4-4s').flyingMassGrams, 171.2);
  assert.equal(getAircraftPreset('meteor75-analog-2022').flyingMassGrams, 37.68);
  assert.equal(getAircraftPreset('meteor85-analog').flyingMassGrams, 69.95);
  assert.equal(getAircraftPreset('holybro-x650-v2').flyingMassGrams, 3200);
  assert.equal(getAircraftPreset('rekon7-pro-o3').evidence.batteryMass.kind, 'estimated');
  assert.equal(getAircraftPreset('rekon7-pro-o3').evidence.receiverMass.kind, 'estimated');
  assert.equal(getAircraftPreset('meteor75-pro-matrix').wheelbaseMm, 80.8);
  assert.equal(getAircraftPreset('chimera7-pro-v2-o4').propellerDiameterMm, 190.5);
});

test('every preset has valid distinct physical geometry and sag-aware flying authority without depletion', () => {
  const identities = new Set();
  for (const p of listAircraftPresets()) {
    const { aircraft } = createPresetConfiguration(p.id);
    assert.deepEqual(validateAircraftPhysics(aircraft), aircraft);
    assert.equal(aircraft.battery.depletion, false);
    assert.equal(aircraft.mass, p.flyingMassGrams / 1000);
    assert.equal(aircraft.armLength, p.wheelbaseMm / 2000);
    assert.equal(aircraft.geometry.propellerRadius, p.propellerDiameterMm / 2000);
    assert.equal(aircraft.geometry.ducted, ['whoop', 'cinewhoop'].includes(p.category));
    assert.equal(aircraft.propulsion.airmode, true);
    assert.ok(aircraft.propulsion.idleSpeed > 0);
    assert.ok(aircraft.geometry.bodyHalfExtents.x < aircraft.radius);
    const performance = aircraftPerformance(aircraft);
    assert.ok(
      performance.thrustToWeight > 1.5,
      `${p.id} should lift its complete battery-inclusive mass`,
    );
    assert.ok(performance.hoverThrottle > 0 && performance.hoverThrottle < 0.8, p.id);
    assert.ok(performance.fullThrottleVoltage < aircraft.battery.fullVoltage, p.id);
    assert.ok(performance.fullThrottleCurrent <= aircraft.battery.currentLimit + 1e-6, p.id);
    identities.add(
      JSON.stringify({
        mass: aircraft.mass,
        inertia: aircraft.inertia,
        lag: aircraft.motorTimeConstant,
      }),
    );
  }
  assert.equal(identities.size, listAircraftPresets().length);
});

test('starter rates use Actual native units with class maximum, 100 degree center and 25 percent expo on every axis', () => {
  for (const p of listAircraftPresets()) {
    const configuration = createPresetConfiguration(p.id),
      evaluator = createRateEvaluator(configuration.response.rates);
    assert.equal(configuration.response.rates.algorithm, 'actual');
    for (const axis of ['roll', 'pitch', 'yaw']) {
      assert.equal(configuration.response.rates.axes[axis].rcRate, 10);
      assert.equal(configuration.response.rates.axes[axis].expo, 25);
      assert.equal(evaluator.rate(axis, 1), p.starterMaximumRate);
    }
    const original = createPresetConfiguration(p.id);
    configuration.aircraft.mass = 12;
    configuration.response.rates.axes.roll.rate = 1;
    assert.deepEqual(createPresetConfiguration(p.id), original);
    assert.ok(
      JSON.stringify(original).length < 12000,
      'Runtime configuration must exclude descriptive source data',
    );
    assert.doesNotMatch(JSON.stringify(original), /https:\/\//);
  }
});

test('component edits count battery replacement and additional camera once, with full-mass parallel-axis inertia', () => {
  for (const preset of listAircraftPresets()) {
    const base = createPresetConfiguration(preset.id);
    const reference = base.components.reference;
    const payload = reference.maxPayloadGrams / 2;
    const selection = {
      battery: {
        massGrams: reference.batteryMassGrams * 1.5,
        capacityMah: reference.capacityMah * 1.5,
      },
      cameraPayload: { massGrams: payload },
    };
    const updated = applyAircraftComponents(base.aircraft, base.components, selection);
    const addedBattery = (reference.batteryMassGrams * 0.5) / 1000;
    const cameraMass = payload / 1000;
    const mass = base.aircraft.mass + addedBattery + cameraMass;
    const center = (cameraMass * reference.payloadPosition.y) / mass;
    assert.equal(updated.aircraft.mass, mass, preset.id);
    assert.equal(updated.aircraft.geometry.centerOfMass.y, center);
    const expectedInertia =
      base.aircraft.inertia.x +
      (addedBattery * (reference.batteryHalfExtents.y ** 2 + reference.batteryHalfExtents.z ** 2)) /
        3 +
      cameraMass *
        ((reference.payloadHalfExtents.y ** 2 + reference.payloadHalfExtents.z ** 2) / 3 +
          reference.payloadPosition.y ** 2) -
      mass * center ** 2;
    assert.ok(Math.abs(updated.aircraft.inertia.x - expectedInertia) < 1e-15);
    assert.equal(updated.aircraft.battery.capacityAh, selection.battery.capacityMah / 1000);
    assert.equal(updated.aircraft.battery.depletion, false);
    for (let i = 0; i < 4; i++) {
      assert.equal(updated.aircraft.geometry.rotors[i].position.y, -center);
      assert.equal(
        updated.aircraft.geometry.rotors[i].position.x,
        base.aircraft.geometry.rotors[i].position.x,
      );
    }
    assert.deepEqual(
      applyAircraftComponents(updated.aircraft, updated.components, selection),
      updated,
    );
    assert.deepEqual(updated.aircraft.propulsion, base.aircraft.propulsion);
    assert.deepEqual(updated.aircraft.drag, base.aircraft.drag);
    const restored = applyAircraftComponents(updated.aircraft, updated.components, {
      battery: base.components.battery,
      cameraPayload: base.components.cameraPayload,
    });
    assert.deepEqual(
      restored.aircraft,
      base.aircraft,
      `${preset.id} reference must restore exactly`,
    );
    assert.deepEqual(restored.components, base.components);
    assert.deepEqual(validateAircraftPhysics(updated.aircraft), updated.aircraft);
  }
});

test('component changes rebase explicit Advanced mass/inertia overrides and preserve other physical coefficients', () => {
  const base = createPresetConfiguration('meteor75-analog-2022');
  const selected = {
    battery: { massGrams: 15, capacityMah: 600 },
    cameraPayload: { massGrams: 3 },
  };
  const first = applyAircraftComponents(base.aircraft, base.components, selected);
  const custom = structuredClone(first.aircraft);
  custom.mass += 0.002;
  for (const axis of ['x', 'y', 'z']) custom.inertia[axis] *= 1.1;
  custom.motorTimeConstant = 0.028;
  custom.drag.quadratic.x *= 1.3;
  custom.battery.resistance = 0.07;
  const next = applyAircraftComponents(custom, first.components, {
    battery: { massGrams: 16, capacityMah: 650 },
    cameraPayload: { massGrams: 4 },
  });
  assert.ok(Math.abs(next.aircraft.mass - custom.mass - 0.002) < 1e-15);
  assert.equal(next.aircraft.motorTimeConstant, custom.motorTimeConstant);
  assert.deepEqual(next.aircraft.drag, custom.drag);
  assert.equal(next.aircraft.battery.resistance, custom.battery.resistance);
  const back = applyAircraftComponents(next.aircraft, next.components, selected);
  assert.ok(Math.abs(back.aircraft.mass - custom.mass) < 1e-15);
  for (const axis of ['x', 'y', 'z'])
    assert.ok(Math.abs(back.aircraft.inertia[axis] - custom.inertia[axis]) < 1e-15);
});

test('component inventory rejects invalid ranges, forged baseline edits and unsupported lateral mounting', () => {
  const base = createPresetConfiguration('air65-ii-racing-2026');
  assert.deepEqual(validateAircraftComponents(base.components), base.components);
  const selection = {
    battery: base.components.battery,
    cameraPayload: base.components.cameraPayload,
  };
  assert.throws(
    () =>
      applyAircraftComponents(base.aircraft, base.components, {
        ...selection,
        baseline: base.components.baseline,
      }),
    /not supported/i,
  );
  assert.throws(
    () =>
      applyAircraftComponents(base.aircraft, base.components, {
        ...selection,
        battery: { massGrams: 999, capacityMah: 320 },
      }),
    /half to twice/,
  );
  assert.throws(
    () =>
      applyAircraftComponents(base.aircraft, base.components, {
        ...selection,
        cameraPayload: { massGrams: -1 },
      }),
    /allowance/,
  );
  const lateral = structuredClone(base.aircraft);
  lateral.geometry.centerOfMass.x = 0.001;
  assert.deepEqual(applyAircraftComponents(lateral, base.components, selection).aircraft, lateral);
  assert.throws(
    () =>
      applyAircraftComponents(lateral, base.components, {
        ...selection,
        cameraPayload: { massGrams: 1 },
      }),
    /centered|radius/,
  );
});
