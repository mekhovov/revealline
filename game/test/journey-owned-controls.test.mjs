import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';

test('historical Journey restores Skip only for its owned saved flight and keeps Classic departure explicit', async (t) => {
  const memory = managedIndexedDB();
  const p = await soloPage(t, {
    search: '?journey=1',
    pictures: { Image: PNGImage },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
    titleScreen: true,
    journeyIndexedDB: memory.indexedDB,
  });
  p.$('shell-featured').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 12; i++) p.frame();
  assert.equal(p.rendered.run.player.cutting, true);
  p.$('pause-button').click();
  const ownedSaved = p.storage.getItem('revealline.suspended.dev.v1');
  assert(ownedSaved);
  const ownedCheckpoint = authoritativeCheckpoint(p.rendered.run);
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
  play.click();
  await settle(
    () => p.$('mission-replace-dialog').open && !p.$('mission-replace-confirm').disabled,
  );
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), ownedCheckpoint);
  p.$('mission-replace-confirm').click();
  await settle(
    () => p.$('pack-select').value === pack.id && p.doc.body.dataset.pictureState === 'ready',
  );
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 12; i++) p.frame();
  assert.equal(p.rendered.run.player.cutting, true);
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
  await openMissionLibrary(p, 'shell-packs');
  const owned = [...p.$('journey-cards').children].filter((card) => {
    const [owner, , , levelId] = JSON.parse(card.dataset.missionId);
    return owner === JSON.stringify(['classic', 'base', null]) && levelId === 'signal-01';
  });
  assert.equal(owned.length, 1, 'The unified gallery contains one exact Classic base opening.');
  owned[0].click();
  await settle(
    () =>
      p.$('mode-leave-dialog').open &&
      p.$('mode-leave-dialog').textContent.includes('saved and verified'),
  );
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.match(
    p.$('mode-leave-dialog').textContent,
    /original rules and progression remain separate/,
  );
  p.$('mode-leave-stay').click();
  await settle(() => p.$('journey-chooser').open);
  assert.equal(p.doc.activeElement, owned[0]);
  assert.equal(p.$('journey-skip').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  const { savedAt: oldSavedAt, ...oldSaved } = JSON.parse(saved);
  const { savedAt: newSavedAt, ...newSaved } = JSON.parse(
    p.storage.getItem('revealline.suspended.dev.v1'),
  );
  assert.deepEqual(newSaved, oldSaved);
  assert(newSavedAt >= oldSavedAt);
  p.$('journey-back').click();
  p.$('library-button').click();
  p.$('save-json').value = ownedSaved;
  p.$('import-save').click();
  await settle(() => !p.$('library-dialog').open);
  p.frame(0);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), ownedCheckpoint);
  assert.equal(p.$('journey-skip').hidden, false);
  assert.equal(p.$('journey-skip').textContent, 'Skip mission');
  p.$('library-button').click();
  p.$('save-json').value = saved;
  p.$('import-save').click();
  await settle(() => !p.$('library-dialog').open);
  p.frame(0);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.equal(p.$('journey-skip').hidden, true);
  p.$('journey-skip').onclick();
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.deepEqual(p.errors, []);
});
