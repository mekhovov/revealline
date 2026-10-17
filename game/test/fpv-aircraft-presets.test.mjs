import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

test('the offline catalog contains twelve distinct immutable aircraft, independently of saved setup capacity', () => {
  const catalog = listAircraftPresets();
  assert.equal(catalog.length, 12);
  assert.equal(new Set(catalog.map((p) => p.id)).size, 12);
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
  assert.equal(identities.size, 12);
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
