import test from 'node:test';
import { Document } from './helpers/couch-dom.mjs';
import assert from 'node:assert/strict';
import {
  aircraftClassRecommends,
  mountAircraftCourseFilter,
  aircraftCourseAdvice,
  aircraftPracticeEnvelope,
} from '../../optional-practice/civilian-fpv/aircraft-course-advice.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

const aircraft = (id) => createPresetConfiguration(id).aircraft;
const course = (width, height = width) => ({
  bounds: { min: { x: -5000, y: 0, z: -5000 }, max: { x: 5000, y: 6000, z: 5000 } },
  rules: { droneRadius: 220 },
  steps: {
    acro: [
      {
        type: 'gate',
        axis: 'z',
        minSide: -width / 2,
        maxSide: width / 2,
        minY: 1000,
        maxY: 1000 + height,
      },
    ],
    'self-level': [],
  },
});

test('a whoop and 15-inch aircraft receive different physical gate advice without changing the course', () => {
  const selected = course(250),
    original = structuredClone(selected);
  const whoop = aircraftCourseAdvice(selected, aircraft('meteor75-analog-2022'));
  const large = aircraftCourseAdvice(selected, aircraft('holybro-x650-v2'));
  assert.equal(whoop.classId, 'whoop');
  assert.equal(large.classId, 'training');
  assert.ok(whoop.clearanceMm > 100);
  assert.equal(whoop.recommended, true);
  assert.ok(large.clearanceMm < 0);
  assert.equal(large.recommended, false);
  assert.match(large.advisories.en, /All courses remain available/);
  assert.match(large.advisories.uk, /Усі маршрути доступні/);
  assert.deepEqual(selected, original);
});

test('clearance checks both gate width and height across authored modes, rather than legacy radius', () => {
  const model = aircraft('meteor75-analog-2022'),
    selected = course(1000, 20);
  const short = aircraftCourseAdvice(selected, model);
  assert.equal(short.clearanceMm, -15);
  selected.steps.acro[0].maxY = 2000;
  selected.steps['self-level'].push({
    ...selected.steps.acro[0],
    axis: 'x',
    minSide: 0,
    maxSide: 90,
  });
  const narrow = aircraftCourseAdvice(selected, model);
  assert.ok(narrow.clearanceMm < 0);
  selected.rules.droneRadius = 10000;
  assert.deepEqual(aircraftCourseAdvice(selected, model), narrow);
});

test('collision envelope includes asymmetric rotor spacing and center-of-mass offsets', () => {
  const model = aircraft('chimera7-pro-v2-o4'),
    envelope = aircraftPracticeEnvelope(model);
  const rotor = model.geometry.rotors[0];
  assert.ok(
    Math.abs(envelope.minMm.x - (rotor.position.x - model.geometry.propellerRadius) * 1000) < 1e-10,
  );
  const old = aircraftCourseAdvice(course(1000), model);
  model.geometry.centerOfMass.y = -0.1;
  const shifted = aircraftPracticeEnvelope(model);
  assert.ok(shifted.dimensionsMm.y > envelope.dimensionsMm.y);
  assert.equal(old.classId, 'long-range');
  assert.equal(old.propellerDiameterMm, 190.5);
});

test('bounds and missing gate data produce explicitly limited recommendations', () => {
  const model = aircraft('holybro-x650-v2');
  const free = course(2000);
  free.steps.acro = [];
  const result = aircraftCourseAdvice(free, model);
  assert.equal(result.recommended, true);
  assert.equal(Object.hasOwn(result, 'clearanceMm'), false);
  assert.match(result.advisories.en, /No authored gates/);
  free.bounds.max.x = free.bounds.min.x + 500;
  assert.equal(aircraftCourseAdvice(free, model).recommended, false);
  const unavailable = aircraftCourseAdvice({}, model);
  assert.equal(unavailable.recommended, false);
  assert.match(unavailable.advisories.en, /No geometric course recommendation/);
  assert.match(unavailable.advisories.en, /does not check obstacles or a banked approach/);
});

test('geometry-based classes distinguish larger ducts, racing, and exact 7-inch props', () => {
  assert.equal(
    aircraftCourseAdvice(course(2000), aircraft('pavo20-pro-ii-o4-4s')).classId,
    'cinewhoop',
  );
  assert.equal(
    aircraftCourseAdvice(course(2000), aircraft('mach-r5-sport-2050')).classId,
    'racing',
  );
  const seven = aircraftCourseAdvice(course(2000), aircraft('rekon7-pro-o3'));
  assert.equal(seven.classId, 'long-range');
  assert.equal(seven.propellerDiameterMm, 177.8);
});

test('optional class filter restores every course and refreshes EN/UK without changing aircraft geometry', () => {
  const narrow = course(300),
    wide = course(6000),
    original = structuredClone(narrow);
  assert.equal(aircraftClassRecommends(narrow, 'all'), true);
  assert.equal(aircraftClassRecommends(narrow, 'training'), false);
  assert.equal(aircraftClassRecommends(wide, 'training'), true);
  const document = new Document();
  let locale = 'en',
    changes = 0;
  const filter = mountAircraftCourseFilter({
    document,
    locale: () => locale,
    onChange: () => changes++,
  });
  document.body.append(filter.root);
  const select = filter.root.querySelector('select');
  select.value = 'training';
  select.emit('change');
  assert.equal(changes, 1);
  assert.equal(filter.matches(narrow), false);
  select.value = 'all';
  select.emit('change');
  assert.equal(filter.matches(narrow), true);
  locale = 'uk';
  filter.refresh();
  assert.equal(select.options[0].textContent, 'Усі маршрути');
  assert.deepEqual(narrow, original);
  filter.dispose();
  assert.equal(filter.root.isConnected, false);
});
