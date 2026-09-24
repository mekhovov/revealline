import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

async function setup(t, route = 'authored') {
  const memory = managedIndexedDB();
  const p = await soloPage(t, {
    search: `?journey=${route}`,
    titleScreen: true,
    journeyIndexedDB: memory.indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  return { p, backend: createJourneyBackend(memory) };
}
async function open(p, id) {
  const opener = p.$(id);
  opener.focus();
  opener.click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(
    p.doc.activeElement,
    [...p.$('journey-cards').children].find((card) => !card.disabled),
  );
  return opener;
}
function back(p, method, t) {
  if (method === 'controller') {
    let now = 1000;
    t.mock.method(performance, 'now', () => now);
    const pad = {
      index: 0,
      id: 'Journey return controller',
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    navigator.getGamepads = () => [pad];
    const frame = () => {
      now += 20;
      p.frame(20);
    };
    frame();
    pad.buttons[1] = { pressed: true, value: 1 };
    frame();
    pad.buttons[1] = { pressed: false, value: 0 };
    frame();
    assert.equal(p.$('journey-chooser').open, false);
    return;
  }
  if (method === 'button') p.$('journey-back').click();
  else assert.equal(p.$('journey-chooser').emit('cancel').defaultPrevented, true);
  assert.equal(p.$('journey-chooser').open, false);
}
for (const route of ['1', 'opening', 'authored'])
  for (const method of ['button', 'cancel', 'controller'])
    test(`${route} title Missions ${method} restores Home and its exact opener`, async (t) => {
      const { p, backend } = await setup(t, route);
      const before = await backend.read();
      const opener = await open(p, 'shell-play');
      assert.equal(p.$('journey-back').textContent, 'Back to menu');
      back(p, method, t);
      assert.equal(p.$('shell-home').open, true);
      assert.equal(p.doc.activeElement, opener);
      assert.deepEqual(await backend.read(), before, 'Browsing and returning grants no progress.');
      assert.notEqual(p.doc.body.dataset.flightState, 'running');
      assert.deepEqual(p.errors, []);
    });

test('choosing a mission from Home leaves its parent and starts only the selected mission', async (t) => {
  const { p } = await setup(t);
  await open(p, 'shell-play');
  p.$('journey-search').value = 'Choose your share';
  p.$('journey-search').emit('input');
  const cards = p.$('journey-cards').children;
  assert.equal(cards.length, 1);
  cards[0].click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  assert.equal(p.rendered.run.levelId, 'choose-your-share');
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

for (const origin of ['field', 'home'])
  test(`paused ${origin} Missions and nested backup return retain the exact flight and opener`, async (t) => {
    const { p, backend } = await setup(t);
    const primary = p.$('shell-continue').hidden ? p.$('shell-featured') : p.$('shell-continue');
    primary.click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.frame(0);
    p.$('pause-button').click();
    p.frame(0);
    const run = p.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    const before = await backend.read();
    if (origin === 'home') p.$('overlay-menu').click();
    const opener = await open(p, origin === 'home' ? 'shell-play' : 'shell-packs');
    assert.equal(
      p.$('journey-back').textContent,
      origin === 'home' ? 'Back to menu' : 'Back to game',
    );
    p.$('journey-search').value = 'Two keepers';
    p.$('journey-search').emit('input');
    p.$('journey-backup-open').click();
    assert.equal(p.$('journey-backup').open, true);
    p.$('journey-backup-back').click();
    assert.equal(p.doc.activeElement, p.$('journey-backup-open'));
    back(p, 'cancel');
    assert.equal(p.$('shell-home').open, origin === 'home');
    assert.equal(p.doc.activeElement, opener);
    p.frame(1000);
    assert.equal(p.doc.body.dataset.flightState, 'paused');
    assert.equal(p.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(await backend.read(), before);
    await open(p, opener.id);
    assert.equal(p.$('journey-search').value, 'Two keepers');
    assert.equal(p.$('journey-cards').children.length, 1);
    back(p, 'button');
    assert.equal(p.doc.activeElement, opener);
    assert.deepEqual(p.errors, []);
  });
