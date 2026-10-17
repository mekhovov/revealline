import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  aircraftPreviewGeometry,
  createAircraftPreview,
} from '../../optional-practice/civilian-fpv/aircraft-preview.mjs';
import {
  listAircraftPresets,
  createPresetConfiguration,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftAppearance } from '../../optional-practice/civilian-fpv/aircraft-appearance.mjs';

function preview(preset, locale = 'en') {
  const document = new Document();
  document.createElementNS = (_namespace, tag) => document.createElement(tag);
  const { aircraft } = createPresetConfiguration(preset.id),
    before = structuredClone(aircraft);
  const figure = createAircraftPreview({
    document,
    aircraft,
    name: preset.name,
    wheelbaseMm: preset.wheelbaseMm,
    locale,
  });
  assert.deepEqual(aircraft, before, 'rendering cannot alter flight configuration');
  return { figure, aircraft, svg: figure.querySelector('svg') };
}

test('every built-in has an accessible geometry preview with matching rotors, propellers and guards', () => {
  for (const preset of listAircraftPresets()) {
    const { figure, aircraft, svg } = preview(preset);
    assert.equal(svg.getAttribute('role'), 'img');
    assert.equal(svg.getAttribute('focusable'), 'false');
    assert.ok(svg.getAttribute('aria-label').includes(preset.name));
    assert.match(svg.getAttribute('aria-label'), /Top view, front points up/);
    assert.ok(svg.getAttribute('aria-label').includes(`Wheelbase: ${preset.wheelbaseMm} mm`));
    assert.equal(figure.querySelectorAll('[data-preview-part="rotor"]').length, 4);
    assert.equal(
      figure.querySelectorAll('[data-preview-part="duct"]').length,
      aircraft.geometry.ducted ? 4 : 0,
    );
    assert.equal(
      figure.querySelectorAll('[data-preview-part="blade"]').length,
      4 * aircraftAppearance(preset.id).bladeCount,
    );
    assert.equal(figure.querySelectorAll('image').length, 0, 'does not fetch remote photographs');
    assert.match(
      figure.querySelector('figcaption').textContent,
      /Simplified model.*scaled to fit.*Estimated body shape/,
    );
  }
});

test('75 mm quad preview reports full propeller span and keeps the camera at the front', () => {
  const preset = listAircraftPresets().find((p) => p.id === 'meteor75-analog-2022');
  const { aircraft, figure } = preview(preset),
    geometry = aircraftPreviewGeometry(aircraft);
  const expectedSpan = 0.075 / Math.SQRT2 + 0.04;
  assert.ok(Math.abs(geometry.width - expectedSpan) < 1e-12);
  assert.ok(Math.abs(geometry.length - expectedSpan) < 1e-12);
  assert.equal(geometry.radius, 0.02);
  const camera = figure.querySelector('[data-preview-part="camera"]'),
    body = figure.querySelector('[data-preview-part="body"]');
  assert.ok(
    Number(camera.getAttribute('y')) <
      Number(body.getAttribute('y')) + Number(body.getAttribute('height')) / 2,
  );
  const rotors = figure.querySelectorAll('[data-preview-part="rotor"]');
  const point = (rotor) =>
    rotor
      .getAttribute('transform')
      .match(/translate\(([-\d.]+) ([-\d.]+)\)/)
      .slice(1)
      .map(Number);
  assert.ok(point(rotors[0])[0] < point(rotors[1])[0], 'front left remains left');
  assert.ok(point(rotors[0])[1] < point(rotors[3])[1], 'front remains above rear');
});

test('presentation retains relative geometry when a component moves the center of mass', () => {
  const { aircraft } = createPresetConfiguration('meteor75-analog-2022'),
    before = aircraftPreviewGeometry(aircraft);
  const offset = { x: 0.01, y: 0.004, z: -0.005 };
  aircraft.geometry.centerOfMass = offset;
  for (const rotor of aircraft.geometry.rotors)
    for (const axis of ['x', 'y', 'z']) rotor.position[axis] -= offset[axis];
  const after = aircraftPreviewGeometry(aircraft);
  for (const key of ['width', 'length', 'radius'])
    assert.ok(Math.abs(before[key] - after[key]) < 1e-12);
  for (const axis of ['x', 'z']) {
    assert.ok(Math.abs(after.center[axis] - before.center[axis] + offset[axis]) < 1e-12);
    for (let i = 0; i < 4; i++)
      assert.ok(
        Math.abs(
          after.rotors[i][axis] - after.body[axis] - (before.rotors[i][axis] - before.body[axis]),
        ) < 1e-12,
      );
  }
});

test('Ukrainian preview describes orientation, physical size and estimate status', () => {
  const { figure, svg } = preview(listAircraftPresets()[0], 'uk');
  assert.match(svg.getAttribute('aria-label'), /Вигляд згори, передня частина вгорі/);
  assert.match(svg.getAttribute('aria-label'), /Габарити моделі/);
  assert.match(figure.textContent, /ПЕРЕД/);
  assert.match(figure.querySelector('figcaption').textContent, /Форма корпусу приблизна/);
});
