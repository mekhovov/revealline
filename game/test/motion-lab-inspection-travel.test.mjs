import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { inspectionTravelRatio } from '../../authoring/motion-lab/inspection-travel.mjs';

test('Inspection response uses authored multipliers without writing state or presets', () => {
  const state = Object.freeze({ visualSpeed: 6, x: 4, y: 7 }),
    motion = Object.freeze({ cruiseSpeed: 10, boostMultiplier: 1.7, slowMultiplier: 0.42 });
  assert.equal(inspectionTravelRatio('follow', state, motion), 0.6);
  assert.equal(inspectionTravelRatio('idle', state, motion), 0);
  assert.equal(inspectionTravelRatio('cruise', state, motion), 1);
  assert.equal(inspectionTravelRatio('boost', state, motion), 1.7);
  assert.equal(inspectionTravelRatio('slow', state, motion), 0.42);
  assert.equal(inspectionTravelRatio('unavailable', state, motion), 0.6);
  assert.equal(inspectionTravelRatio('follow', { visualSpeed: Infinity }, motion), 0);
  assert.equal(inspectionTravelRatio('follow', { visualSpeed: -1 }, motion), 0);
  assert.equal(inspectionTravelRatio('follow', { visualSpeed: 100 }, motion), 4);
});

test('Inspection response is delivered with the lab and has matching EN/UK control copy', async () => {
  const root = new URL('../../', import.meta.url),
    files = await collectBuildFiles(fileURLToPath(root)),
    html = await readFile(new URL('authoring/motion-lab/index.html', root), 'utf8'),
    keys = [...html.matchAll(/data-i18n="tools:(motionLab\.inspectionTravel\.[^"]+)"/g)].map(
      (match) => match[1],
    );
  assert.equal(keys.length, 7);
  assert.equal(new Set(keys).size, 7);
  assert.ok(files.includes('authoring/motion-lab/inspection-travel.mjs'));
  for (const locale of ['en', 'uk']) {
    const messages = JSON.parse(await readFile(new URL(`game/locales/${locale}/tools.json`, root)));
    for (const key of keys) assert.ok(messages[key]?.length > 0, `${locale}: ${key}`);
  }
});
