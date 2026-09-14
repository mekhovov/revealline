import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStudioPreviewRun } from '../../authoring/asset-studio/preview-fixture.mjs';
const packs = ['fpv-arcade-r5', 'classic-lab', 'sentinel-relay', 'fpv-arcade'].map((id) =>
  JSON.parse(readFileSync(new URL(`../content/packs/${id}.json`, import.meta.url))),
);

test('every actor slot resolves to a real normalized mission containing that role', () => {
  for (const kind of [
    'bouncer',
    'border-patrol',
    'contour-patrol',
    'claimed-rover',
    'eroder',
    'lane-boss',
    'relay-sentinel',
  ]) {
    const { run } = createStudioPreviewRun(packs, `enemy.${kind}`);
    assert.ok(
      run.enemies.some((enemy) => enemy.type === kind),
      `${kind} is present`,
    );
    assert.equal(run.tick, 12);
  }
});

test('terrain and pickup context fixtures validate without changing the built-in packs', () => {
  const before = JSON.stringify(packs);
  for (const id of [
    'terrain.wall',
    'terrain.slow',
    'terrain.lethal',
    'pickup.life',
    'pickup.speed',
    'pickup.slow',
    'pickup.freeze',
    'pickup.objective',
    'pickup.supply',
  ]) {
    const { run } = createStudioPreviewRun(packs, id);
    assert.equal(run.status, 'running', id);
    assert.ok(run.width > 0 && run.height > 0);
  }
  assert.equal(JSON.stringify(packs), before);
});

test('each preview owns an independent deterministic run', () => {
  const a = createStudioPreviewRun(packs, 'player.scout.compact').run;
  const b = createStudioPreviewRun(packs, 'player.scout.compact').run;
  assert.notEqual(a, b);
  assert.notEqual(a.cells, b.cells);
  assert.deepEqual(a.player, b.player);
  assert.deepEqual(a.cells, b.cells);
});
