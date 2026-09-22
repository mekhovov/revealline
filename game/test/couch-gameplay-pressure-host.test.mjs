import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recoverGameplayTuning, GAMEPLAY_TUNING_STORAGE_KEY } from '../gameplay-tuning.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const settle = (predicate) => waitFor(predicate, { timeoutMs: 10000 });
function memory() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function apply(panel, values) {
  panel.querySelector('details').open = true;
  for (const [key, value] of Object.entries(values))
    panel.querySelector(`[data-tuning="${key}"]`).value = String(value);
  panel.querySelector('button').click();
}

test('Versus lobby difficulty uses one fresh pressure recipe for both boards and keeps Resume unchanged', async (t) => {
  const p = await couchPage(t, {
    storage: memory(),
    fetchResponse: async (path) =>
      path === '../content/packs/fpv-arcade-r5.json'
        ? new Response('Isolated Base fixture', { status: 503 })
        : undefined,
  });
  const difficulty = p.$('race-journey-difficulty');
  assert(p.$('race-main').contains(difficulty));
  assert.equal(difficulty.closest('[hidden]'), null);
  assert.equal(difficulty.value, 'standard');
  const preview = p.renders[0];
  assert.equal(recoverGameplayTuning(preview.level).difficulty, 'standard');
  difficulty.value = 'expert';
  difficulty.onchange();
  assert.strictEqual(p.renders[0], preview, 'The existing ready board is not mutated.');
  p.$('race-start').focus();
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return p.state() === 'running';
  });
  p.frame(0);
  const active = p.renders[0];
  assert.notStrictEqual(active, preview);
  assert.equal(recoverGameplayTuning(active.level).difficulty, 'expert');
  assert.deepEqual(active.level, p.renders[1].level);
  assert.equal(active.level.rules.moveSpeed, campaign.levels[0].rules.moveSpeed * 1.15);
  assert(active.level.enemies.length > campaign.levels[0].enemies.length);
  p.$('race-pause').click();
  p.frame(0);
  const checkpoint = p.checkpoint();
  apply(p.$('race-gameplay-tuning'), { enemySpeed: 1.25, playerSpeed: 1.1 });
  p.frame(0);
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.equal(recoverGameplayTuning(active.level).adminOverride, false);
  p.$('race-start').focus();
  p.$('race-start').click();
  p.frame(0);
  assert.strictEqual(p.renders[0], active, 'Resume retains the exact already-started attempt.');
  assert.equal(p.state(), 'running');
});

test('Versus stored admin pressure is visible and keeps identical boards without rewriting original content', async (t) => {
  const storage = memory();
  storage.setItem(
    GAMEPLAY_TUNING_STORAGE_KEY,
    JSON.stringify({
      version: 'gameplay-pressure.v1',
      overrides: { enemySpeed: 1.25, playerSpeed: 1.1, enemyDensity: 0 },
    }),
  );
  const source = structuredClone(campaign);
  const p = await couchPage(t, {
    campaign: source,
    storage,
    fetchResponse: async (path) =>
      path === '../content/packs/fpv-arcade-r5.json'
        ? new Response('Isolated Base fixture', { status: 503 })
        : undefined,
  });
  const tuning = recoverGameplayTuning(p.renders[0].level);
  assert.equal(tuning.adminOverride, true);
  assert.equal(tuning.enemySpeed, 2);
  assert.deepEqual(p.renders[0].level, p.renders[1].level);
  assert.deepEqual(source, campaign);
  assert.match(p.$('race-gameplay-tuning').textContent, /Playtest overrides enabled/);
  assert.match(p.$('race-summary').textContent, /ADMIN PLAYTEST/);
  assert.equal(
    p.$('race-gameplay-tuning').querySelector('[data-tuning="enemySpeed"]').type,
    'range',
  );
});

test('Team fresh tuning preserves its exact authored picture, pause state and explicit Retry', async (t) => {
  const { page: teamPage } = await import('./helpers/coop-host.mjs');
  const storage = memory();
  const p = await teamPage(t, {
    capturePaint: true,
    stablePaintImages: true,
    retainInitialDifficulty: true,
    beforeImport: ({ install }) => install('localStorage', { value: storage }),
  });
  assert.equal(p.$('coop-difficulty').closest('[hidden]'), null);
  assert.equal(p.$('coop-difficulty').value, 'standard');
  await p.choose('coop-difficulty', 'expert');
  const picture = p.previewDrawImages.at(-1);
  p.$('coop-start').click();
  p.tick();
  assert.equal(p.$('coop-overlay').hidden, true, 'The tuned attempt paints successfully.');
  assert(p.drawImages.includes(picture), 'The original prepared picture remains in use.');
  p.$('coop-pause').click();
  p.tick();
  const pausedPaint = p.lastPaint;
  apply(p.$('coop-gameplay-tuning'), { enemySpeed: 1.25, playerSpeed: 1.1 });
  p.tick();
  assert.equal(p.lastPaint, pausedPaint, 'Settings never alter a paused simulation.');
  assert.match(p.$('coop-gameplay-tuning').textContent, /Playtest overrides enabled/);
  p.$('coop-retry').click();
  assert.equal(p.$('coop-discard-dialog').open, true);
  p.$('coop-discard-stay').click();
  p.tick();
  assert.equal(p.lastPaint, pausedPaint, 'Stay keeps the exact old attempt.');
  p.$('coop-retry').click();
  p.$('coop-discard-confirm').click();
  p.tick();
  assert.equal(p.$('coop-overlay').hidden, true);
  assert.match(p.$('coop-stage').textContent, /ADMIN PLAYTEST/);
  assert.notEqual(p.lastPaint, pausedPaint);
  assert(p.drawImages.includes(picture));
});
