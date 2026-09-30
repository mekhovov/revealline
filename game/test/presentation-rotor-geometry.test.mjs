import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, validateAssetRevision } from '../presentation/model.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { FIELD_KIT_PLAYER_HUBS } from '../presentation/pixel-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../presentation/rotor-candidate-art.mjs';

function asset(rotorAnchors) {
  return {
    format: FORMATS.asset,
    id: 'test.rotor-geometry',
    revision: 2,
    kind: 'image',
    description: 'Rotor metadata fixture; not production artwork.',
    provenance: {
      creator: 'Test',
      source: 'In-memory validation fixture',
      license: 'Test-only',
      prompt: '',
      parent: { id: 'test.rotor-geometry', revision: 1 },
    },
    file: { sha256: 'a'.repeat(64), bytes: 100, mime: 'image/png', width: 32, height: 32 },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width: 32, height: 32 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: structuredClone(rotorAnchors),
      nineSlice: null,
    },
    quality: { stage: 'produced', evidence: [] },
  };
}
const anchor = { x: 0.5, y: 0.5, radius: 0.1, blades: 3 };

test('all historical player rigs preserve exact index-based conversion without adding stored fields', () => {
  for (const [id, anchors] of Object.entries(FIELD_KIT_PLAYER_HUBS)) {
    const source = asset(anchors),
      before = structuredClone(source),
      validated = validateAssetRevision(source);
    assert.deepEqual(validated, before, id);
    assert.deepEqual(
      imagePresentation(source).rotors,
      anchors.map((a, i) => ({
        x: a.x - 0.5,
        y: a.y - 0.5,
        radiusScale: a.radius / 0.16,
        direction: i % 2 ? -1 : 1,
        phaseDegrees: i * 23,
        bladeCount: a.blades,
      })),
      id,
    );
    assert.deepEqual(source, before, `${id}: conversion never mutates the original`);
  }
});

test('all candidate rigs pass the production adapter with their authored direction, phase and blade count', () => {
  for (const [id, anchors] of Object.entries(FIELD_KIT_CANDIDATE_RIGS)) {
    const source = asset(anchors),
      before = structuredClone(source),
      result = imagePresentation(source);
    assert.deepEqual(
      result.rotors,
      anchors.map((a) => ({
        x: a.x - 0.5,
        y: a.y - 0.5,
        radiusScale: a.radius / 0.16,
        direction: a.direction,
        phaseDegrees: a.phaseDegrees,
        bladeCount: a.blades,
      })),
      id,
    );
    assert.deepEqual(source, before, `${id}: caller metadata stays untouched`);
    assert.ok(Object.isFrozen(result.rotors[0]));
    assert.deepEqual(imagePresentation(JSON.stringify(source)), result);
  }
});

test('motion fields are independently optional and an explicit zero phase is retained', () => {
  const source = asset([
      { ...anchor, x: 0.2, direction: -1 },
      { ...anchor, x: 0.4, phaseDegrees: 0 },
      { ...anchor, x: 0.6, phaseDegrees: 359.999 },
      { ...anchor, x: 0.8, direction: 1, phaseDegrees: 0.5 },
    ]),
    rotors = imagePresentation(source).rotors;
  assert.deepEqual(
    rotors.map((a) => a.direction),
    [-1, -1, 1, 1],
  );
  assert.deepEqual(
    rotors.map((a) => a.phaseDegrees),
    [0, 0, 359.999, 0.5],
  );
  const validated = validateAssetRevision(source);
  source.geometry.rotorAnchors[0].direction = 1;
  assert.equal(validated.geometry.rotorAnchors[0].direction, -1, 'accepted records own their data');
});

test('invalid signs, phases, unknown fields and omitted required fields fail visibly', () => {
  for (const direction of [0, -0, 2, -2, 0.5, '1', null, false, Infinity, NaN])
    assert.throws(() => imagePresentation(asset([{ ...anchor, direction }])), /direction|finite/i);
  for (const phaseDegrees of [-0.1, 360, 720, '0', null, false, Infinity, NaN])
    assert.throws(() => imagePresentation(asset([{ ...anchor, phaseDegrees }])), /phase|finite/i);
  assert.throws(
    () => imagePresentation(asset([{ ...anchor, speed: 20 }])),
    /rotor anchor\.speed is not supported/i,
  );
  for (const name of ['x', 'y', 'radius', 'blades']) {
    const missing = { ...anchor, direction: 1, phaseDegrees: 0 };
    delete missing[name];
    assert.throws(() => imagePresentation(asset([missing])), /missing fields/);
  }
});

test('extended motion fields do not relax frame, radius, blade, duplicate or list limits', () => {
  const extended = { ...anchor, direction: -1, phaseDegrees: 180 };
  for (const change of [
    { x: 0 },
    { y: 1 },
    { radius: 0 },
    { radius: 0.51 },
    { blades: 1 },
    { blades: 5 },
  ])
    assert.throws(() => imagePresentation(asset([{ ...extended, ...change }])), /rotor/i);
  assert.throws(() => imagePresentation(asset([extended, extended])), /Duplicate rotor/);
  assert.throws(() => imagePresentation(asset(Array(9).fill(extended))), /rotor anchor list/);
});
