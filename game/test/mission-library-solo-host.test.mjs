import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

import {
  journeyPage,
  assertReadyCard,
  settle,
  open,
  showAllLifecycles,
  startPrepared,
  model,
  lateBase,
} from './mission-library-solo-fixture.mjs';

test('Classic Solo mounts all 139 Journey and 296 retained Classic missions', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  assert.equal(p.$('journey-lifecycle').value, 'current');
  assert.equal(p.$('journey-cards').children.length, 240);
  showAllLifecycles(p);
  assert.equal(p.$('journey-cards').children.length, 435);
  assert.equal(p.$('journey-collection').value, '');
  const cards = [...p.$('journey-cards').children];
  assert.match(cards[0].textContent, /Journey/);
  assert.match(cards[0].textContent, /Arcade.*Band 1\/12 · Standard.*Optional challenge:/);
  assert.equal(
    cards.filter((card) => card.querySelector('.journey-card-tags').textContent.includes('Classic'))
      .length,
    296,
  );
  assertReadyCard(
    cards.find((card) => card.dataset.missionId === lateBase.id),
    lateBase.name,
  );
  assert.deepEqual(p.errors, []);
});

test('unified Solo retains native setup without a second mission picker', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  const steering = p.$('turn-select');
  await open(p);
  const setup = p.$('mission-picker-setup');
  assert.equal(p.$('journey-chooser').contains(setup), true);
  assert.equal(setup.open, false);
  assert.match(setup.querySelector('summary').textContent, /Current Solo flight setup/);
  assert.equal(p.$('turn-select'), steering, 'Existing guarded control, not a duplicate.');
  for (const id of ['pack-select', 'level-select', 'campaign-select'])
    assert.equal(p.$(id).closest('label').hidden, true);
  for (const id of ['difficulty-select', 'turn-select', 'body-select'])
    assert.equal(setup.contains(p.$(id)), true);
  assert.deepEqual(p.errors, []);
});

test('appearance opens the unified Solo setup and focuses its existing control', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  p.$('choose-appearance').focus();
  p.$('choose-appearance').click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  assert.equal(p.$('mission-picker-setup').open, true);
  assert.equal(p.doc.activeElement, p.$('body-select'));
  assert.equal(p.$('shell-missions').open, false);
  assert.deepEqual(p.errors, []);
});

test('Journey setup changes next preset and library details without replacing the controls', async (t) => {
  const p = await journeyPage(t, '?journey=whole-spatial-v5');
  await open(p);
  const difficulty = p.$('difficulty-select');
  p.$('mission-picker-setup').open = true;
  difficulty.focus();
  difficulty.value = 'expert';
  difficulty.emit('change');
  await settle(() => p.$('journey-cards').children[0].textContent.includes('Expert'));
  assert.equal(p.$('difficulty-select'), difficulty);
  assert.equal(p.doc.activeElement, difficulty);
  assert.equal(p.$('journey-chooser').open, true);
  assert.deepEqual(p.errors, []);
});

test('unified Solo validates and launches the explicitly downloaded late Classic', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'night';
  p.$('journey-search').emit('input');
  const row = model.missions.filter((mission) => mission.ownerId.includes('night-shift')).at(-1);
  assert.ok(row);
  const card = [...p.$('journey-cards').children].find(
    (button) => button.dataset.missionId === row.id,
  );
  assert.ok(card);
  assert.equal(card.dataset.availabilityState, 'download');
  assert.equal(Boolean(card.querySelector('.journey-card-action').hidden), false);
  assert.match(card.querySelector('.journey-card-action').textContent, /^Download & play · /);
  assert.equal(card.disabled, false);
  card.focus();
  card.click();
  await startPrepared(p, row.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('journey-search').value, 'night');
  assert.deepEqual(p.errors, []);
});

test('unified Solo failed downloadable-chapter read retries inline and preserves the flight until retry succeeds', async (t) => {
  let available = false,
    requests = 0;
  const p = await soloPage(t, {
    titleScreen: true,
    fetchResponse: async (path) => {
      if (path === 'content/packs/night-shift.json') {
        requests++;
        if (!available) throw new TypeError('Download temporarily unavailable');
      }
    },
  });
  const initial = p.rendered.run,
    checkpoint = authoritativeCheckpoint(initial);
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'night';
  p.$('journey-search').emit('input');
  const row = model.missions.filter((mission) => mission.ownerId.includes('night-shift')).at(-1),
    selected = () =>
      [...p.$('journey-cards').children].find((card) => card.dataset.missionId === row.id);
  const card = selected();
  assert.equal(card.dataset.availabilityState, 'download');
  assert.equal(Boolean(card.querySelector('.journey-card-action').hidden), false);
  assert.match(card.querySelector('.journey-card-action').textContent, /^Download & play · /);
  assert.equal(card.disabled, false);
  card.focus();
  card.click();
  await settle(() => /Could not prepare/.test(p.$('journey-chooser-status').textContent));
  assert.equal(requests, 1);
  assert.match(card.querySelector('.journey-card-action').textContent, /Unavailable.*Retry$/);
  assert.equal(card.disabled, false, 'The same visible card permits an explicit retry.');
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement, card);
  assert.equal(p.rendered.run, initial);
  assert.deepEqual(authoritativeCheckpoint(initial), checkpoint);
  available = true;
  card.click();
  await startPrepared(p, row.runtimeId);
  assert.equal(requests, 2);
  assert.equal(p.$('journey-chooser').open, false);
  assert.notEqual(p.rendered.run, initial);
  await open(p);
  assert.equal(p.$('journey-search').value, 'night');
  assert.equal(p.doc.activeElement, selected());
  assertReadyCard(selected(), row.name);
  assert.deepEqual(p.errors, []);
});

test('empty-profile Classic selection directly launches its exact late mission without awarding a clear', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  const card = [...p.$('journey-cards').children].find(
    (card) => card.dataset.missionId === lateBase.id,
  );
  card.click();
  await startPrepared(p, lateBase.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  const profile = JSON.parse(p.storage.getItem('revealline.library.dev.v1'));
  assert.ok(
    Object.values(profile?.campaigns ?? {}).every(
      (progress) => Object.keys(progress.clears).length === 0,
    ),
  );
  assert.deepEqual(p.errors, []);
});

