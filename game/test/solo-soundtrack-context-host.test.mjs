import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignKey } from '../library.mjs';
import { prepareScenario } from '../imports.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

test('Solo samples input without rebuilding the unchanged music identity and refreshes accepted mission contexts', async (t) => {
  const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
  const source = JSON.parse(
    await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
  );
  const scenario = (await prepareScenario(source)).scenario;
  const audio = { ...audioHarness(), URLImpl: undefined };
  const page = await soloPage(t, {
    search: '?practice=1',
    previewStorage: memoryStorage({
      'revealline.playground.current': JSON.stringify(scenario),
    }),
    audio,
    fetchResponse: async (path) =>
      path === 'content/campaign.json' ? { ok: true, json: async () => campaign } : undefined,
  });
  await settle(() => !page.$('soundtrack-open').disabled, 'The actual shared player must be ready');
  const key = campaignKey(campaign);
  let normalizations = 0;
  const map = campaign.levels.map;
  // Observe the actual host's original campaign, without changing its data or
  // the shared identity implementation. A general cache of mutable inputs would
  // hide later validation; the host only needs a full identity at adoption.
  Object.defineProperty(campaign.levels, 'map', {
    configurable: true,
    value(...args) {
      normalizations++;
      return map.apply(this, args);
    },
  });
  const stringify = JSON.stringify,
    contexts = [];
  JSON.stringify = function (value, ...args) {
    if (Array.isArray(value) && value.length === 4 && value[0] === key) contexts.push([...value]);
    return stringify.call(this, value, ...args);
  };
  t.after(() => {
    delete campaign.levels.map;
    JSON.stringify = stringify;
  });

  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert(
    contexts.some(
      (value) => value[1] === scenario.level.id && value[2] === scenario.level.revision,
    ),
    'Entering gameplay must still construct the exact prepared practice identity',
  );
  normalizations = 0;
  contexts.length = 0;
  const tick = page.rendered.run.tick,
    reads = page.padReads;
  for (let i = 0; i < 24; i++) page.frame(1000 / 120);
  assert.equal(normalizations, 0, 'Stable gameplay must not normalize the whole campaign');
  assert.deepEqual(contexts, [], 'Unchanged scene must not reconstruct unused map keys');
  assert(page.rendered.run.tick > tick, 'The authoritative simulation keeps advancing');
  assert(page.padReads >= reads + 24, 'Native controller polling retains every frame');

  page.$('pause-button').click();
  // A real dated practice activity makes the authored campaign selection a
  // genuine replacement, without bypassing locked-level or saved-run gates.
  page.$('library-button').click();
  page.doc.querySelector('[data-library-panel="challenges"]').click();
  page.$('challenge-date').value = '2026-09-12';
  page.change('challenge-kind', 'calm');
  page.$('launch-challenge').click();
  await settle(() => page.$('mission-replace-dialog').open || !page.$('library-dialog').open);
  if (page.$('mission-replace-dialog').open) {
    await settle(() => !page.$('mission-replace-confirm').disabled);
    page.$('mission-replace-confirm').click();
  }
  await settle(() => !page.$('library-dialog').open);
  assert.notEqual(page.$('campaign-select').value, key);
  contexts.length = 0;
  page.change('campaign-select', key);
  const replacement = campaign.levels[0];
  await settle(() => page.rendered.run.levelId === replacement.id);
  assert(
    contexts.some(
      (value) =>
        value[0] === key &&
        value[1] === replacement.id &&
        value[2] === replacement.revision &&
        value[3] === page.$('theme-select').value,
    ),
    'The accepted replacement must use its fresh exact mission and theme identity',
  );
  assert.deepEqual(page.errors, []);
});
