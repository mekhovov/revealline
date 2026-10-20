import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { buildNeonMosaic } from '../../scripts/build-neon-mosaic.mjs';

test('remaining Neon layouts reproduce their original geometry and settings after catalog retirement', async () => {
  const frozen = JSON.parse(await readFile(new URL('./fixtures/retained-neon-layouts.json', import.meta.url)));
  const sources = await buildNeonMosaic();
  const actual = sources.map(({ design, scenario }) => ({
    id: design.id,
    sha256: createHash('sha256').update(canonicalJSON({ level: scenario.level, settings: scenario.settings })).digest('hex'),
  }));
  assert.deepEqual(actual, frozen.entries);
});
