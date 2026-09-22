import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  recoverGameplayTuning,
  resolveGameplayTuning,
  gameplayTuningDescription,
  GAMEPLAY_TUNING_STORAGE_KEY,
} from '../gameplay-tuning.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';

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
  assert(
    p
      .$('race-journey-difficulty-note')
      .textContent.includes(gameplayTuningDescription(resolveGameplayTuning('standard'))),
  );
  assert.equal(preview.level.enemies.length, campaign.levels[0].enemies.length);
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
  assert.equal(
    active.level.rules.moveSpeed,
    Math.min(campaign.levels[0].width - 2, campaign.levels[0].height - 2) * 0.26,
  );
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
  assert.equal(tuning.enemySpeed, 1.25);
  assert.deepEqual(p.renders[0].level, p.renders[1].level);
  assert.deepEqual(source, campaign);
  assert.match(p.$('race-gameplay-tuning').textContent, /Playtest overrides enabled/);
  assert.match(p.$('race-summary').textContent, /ADMIN PLAYTEST/);
  assert(p.$('race-gameplay-tuning').textContent.includes(gameplayTuningDescription(tuning)));
  assert(
    p.$('race-journey-difficulty-note').textContent.includes(gameplayTuningDescription(tuning)),
  );
  assert.equal(
    p
      .$('race-gameplay-tuning')
      .querySelector('[data-tuning="enemyDensity"]')
      .getAttribute('aria-label'),
    'Enemy count factor (authored minimum)',
  );
  assert.equal(
    p.$('race-gameplay-tuning').querySelector('[data-tuning="enemySpeed"]').type,
    'range',
  );
});

test('current Versus Journey notes use actual lives and reference pacing, not old percentage descriptions', async (t) => {
  const storage = memory();
  storage.setItem(
    JOURNEY_PREFERENCES_KEY,
    JSON.stringify({ format: 'JourneyPreferencesV1', difficulty: 'standard' }),
  );
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=whole-spatial-v5',
    initialLevel: null,
    storage,
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
  });
  const note = p.$('race-journey-difficulty-note');
  assert.match(note.textContent, /3 mission lives/);
  assert.match(note.textContent, /Reference-paced targets/);
  assert.doesNotMatch(note.textContent, /40%|75%|faster than base/);
  p.$('race-journey-difficulty').value = 'expert';
  p.$('race-journey-difficulty').onchange();
  await settle(() => !p.$('race-start').disabled);
  assert.match(note.textContent, /2 mission lives/);
  assert.doesNotMatch(note.textContent, /40%|75%|faster than base/);
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
  assert(
    p
      .$('coop-level-note')
      .textContent.includes(gameplayTuningDescription(resolveGameplayTuning('expert'))),
  );
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
  const adminDescription = gameplayTuningDescription(
    resolveGameplayTuning('expert', {
      enemySpeed: 1.25,
      playerSpeed: 1.1,
    }),
  );
  assert(p.$('coop-level-note').textContent.includes(adminDescription));
  assert(p.$('coop-gameplay-tuning').textContent.includes(adminDescription));
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
