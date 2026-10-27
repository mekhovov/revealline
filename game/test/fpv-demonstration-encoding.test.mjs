import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';

test('compact teaching examples decode to the exact historical recording data', () => {
  assert.equal(FLIGHT_DEMONSTRATIONS.length, 24);
  assert.equal(
    FLIGHT_DEMONSTRATIONS.reduce((total, proof) => total + proof.frames.length, 0),
    14847,
  );
  assert.equal(
    createHash('sha256').update(JSON.stringify(FLIGHT_DEMONSTRATIONS)).digest('hex'),
    'e85bdeed3f0cbf0c4febdd0274e6788c783844f5934b9dd0315ebaa3e51672de',
  );
});
