import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('an imported flight under Journey has no Skip authority; choosing an owned mission restores it', async (t) => {
  const memory = managedIndexedDB();
  const p = await soloPage(t, {
    search: '?journey=1',
    titleScreen: true,
    journeyIndexedDB: memory.indexedDB,
  });
  const pack = JSON.parse(
    await readFile(new URL('../content/packs/classic-lab.json', import.meta.url)),
  );
  pack.campaigns[0].levels = [pack.campaigns[0].levels[0]];
  p.$('library-button').click();
  p.doc.querySelector('[data-library-panel="packs"]').click();
  p.$('pack-json').value = JSON.stringify(pack);
  p.$('install-pack').click();
  await settle(() => !p.$('install-pack').disabled);
  assert.match(p.$('pack-status').textContent, /Validated and installed/);
  const play = p
    .$('installed-packs')
    .querySelectorAll('button')
    .find((button) => button.textContent === `Play ${pack.campaigns[0].title}`);
  await play.onclick();
  await settle(
    () => p.$('pack-select').value === pack.id && p.doc.body.dataset.pictureState === 'ready',
  );
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  const original = p.rendered.run;
  const before = authoritativeCheckpoint(original);
  assert.equal(p.$('journey-skip').hidden, true);
  p.$('journey-skip').onclick(); // A queued retired control may still deliver an event.
  p.frame(0);
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  const profile = await createJourneyBackend(memory).read();
  assert.deepEqual(profile.skipped.solo, []);
  assert.equal(Object.keys(profile.clears.solo).length, 0);
  p.$('pause-button').click();
  const saved = p.storage.getItem('revealline.suspended.dev.v1');
  assert(saved);
  p.$('shell-packs').click();
  assert.equal(p.$('journey-chooser').open, true);
  p.$('journey-cards').children[0].click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run !== original;
  });
  assert.equal(p.$('journey-skip').hidden, false);
  assert.equal(p.$('journey-skip').textContent, 'Skip mission');
  p.$('pause-button').click();
  p.$('library-button').click();
  p.$('save-json').value = saved;
  p.$('import-save').click();
  await settle(() => !p.$('library-dialog').open);
  p.frame(0);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.equal(
    p.$('journey-skip').hidden,
    true,
    'restoring a Legacy attempt retires Journey-only controls',
  );
  p.$('journey-skip').onclick();
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});
