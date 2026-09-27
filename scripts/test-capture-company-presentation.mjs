import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCompanyPresentations } from './capture-company-presentation.mjs';

test('company presentation capture is deterministic and validates requested IDs', async () => {
  const options = {
    editionIds: ['droneaid-nl-parts-in-motion'],
    suffix: 'fixture',
    write: false,
  };
  const first = await captureCompanyPresentations(options);
  const second = await captureCompanyPresentations(options);
  assert.deepEqual(first, second);
  assert.match(first[0].id, /^[a-f0-9]{64}$/);
  assert.match(first[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(first[0].path, 'game/editions/retained/droneaid-nl-parts-in-motion-fixture.json');
  await assert.rejects(
    captureCompanyPresentations({ ...options, editionIds: ['../outside'] }),
    /Choose one or more/,
  );
  await assert.rejects(
    captureCompanyPresentations({ ...options, suffix: '../outside' }),
    /safe snapshot suffix/,
  );
});
