import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dataIdentity } from '../data-json.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createRun } from '../core/index.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  recoverGameplayTuning,
} from '../gameplay-tuning.mjs';

const campaigns = [
  'ukraine-cities-symbols-time',
  'ukraine-colour-clay-spring',
  'ukraine-crimea-ornek',
  'ukraine-everyday-culture',
  'ukraine-threads',
  'ukraine-voices-travel',
];
const catalog = async (id) =>
  createContentExecutionCatalog(
    JSON.parse(await readFile(new URL(`../content/company-campaigns/${id}.json`, import.meta.url))),
    { mode: 'solo' },
  );
const identity = (level) => {
  const run = createRun(level);
  return dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes });
};

test('v4 preserves all 108 published Ukraine gameplay identities without relabelling rewards', async () => {
  const rows = [];
  for (const id of campaigns)
    for (const entry of (await catalog(id)).entries)
      for (const manifest of entry.manifests)
        rows.push({
          mission: manifest.missionId,
          difficulty: entry.difficulty,
          identity: identity(
            applyGameplayTuning(manifest.level, resolveGameplayTuning(entry.difficulty)),
          ),
        });
  assert.equal(rows.length, 108);
  // Oracle from the unchanged, admitted 4689753f6 Ukraine archive (Node/V8),
  // before the portability fix; includes Gentle, Standard and Expert.
  assert.equal(
    createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    'e033b42b684829861c1278fd50ef6f16feb772aa62e92667e5a5076305ac4984',
  );
});

test('Gentle normalization preserves exact serialized levels despite a native hypot rounding difference', async () => {
  const entry = (await catalog(campaigns[0])).entries.find((item) => item.difficulty === 'gentle');
  const source = entry.manifests[0].level,
    before = JSON.stringify(source),
    tuning = resolveGameplayTuning('gentle'),
    published = applyGameplayTuning(source, tuning),
    saved = JSON.parse(JSON.stringify(published)),
    nativeHypot = Math.hypot,
    component = 1.6970562748477138;
  assert.equal(identity(published), '97519dcde5323802');
  assert.equal(published.enemies[0].vx, -5.860147449083513);
  assert.equal(nativeHypot(component, component), 2.4);
  assert.equal(Math.sqrt(component * component + component * component), 2.3999999999999995);
  try {
    // The exact Firefox146 result from the admitted archive probe. Other
    // geometric hypot calls retain their normal semantics in this regression.
    Math.hypot = (...values) =>
      values.length === 2 && values.every((value) => Math.abs(value) === component)
        ? 2.3999999999999995
        : nativeHypot(...values);
    const portable = applyGameplayTuning(source, tuning);
    assert.deepEqual(portable, published);
    assert.equal(identity(portable), '97519dcde5323802');
    assert.deepEqual(recoverGameplayTuning(saved), tuning);
    assert.equal(identity(saved), '97519dcde5323802');
    assert.deepEqual(saved, JSON.parse(JSON.stringify(published)));
    assert.throws(() => applyGameplayTuning(saved, tuning), /exactly once/);
  } finally {
    Math.hypot = nativeHypot;
  }
  assert.equal(JSON.stringify(source), before);
});

test('finite zero and axial vectors retain the existing bounded normalization semantics', () => {
  for (const [vx, vy, expectedX, expectedY] of [
    [0, 0, 0, 0],
    [0, -2, 0, -8.287500000000001],
    [2, 0, 8.287500000000001, 0],
  ]) {
    const source = {
      version: 'xonix-level.v1',
      id: 'portable-pressure',
      revision: '1',
      width: 48,
      height: 36,
      spawn: { x: 24.5, y: 0.5 },
      goal: { coverage: 0.8 },
      enemies: [{ id: 'keeper', type: 'bouncer', x: 10.5, y: 10.5, vx, vy }],
    };
    const enemy = applyGameplayTuning(source, resolveGameplayTuning('gentle')).enemies[0];
    assert.equal(enemy.vx, expectedX);
    assert.equal(enemy.vy, expectedY);
  }
});
