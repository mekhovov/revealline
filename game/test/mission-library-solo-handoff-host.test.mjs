import { readFile } from 'node:fs/promises';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import { duelExpeditionLibrarySources } from '../mission-library/multiplayer-expeditions.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { MULTIPLAYER_EXPANSION_LAYOUTS } from '../content-design/multiplayer-expansion-layouts.mjs';

import {
  journeyPage,
  assertReadyCard,
  settle,
  open,
  showAllLifecycles,
  startPrepared,
  running,
  model,
  lateBase,
} from './mission-library-solo-fixture.mjs';

test('default Journey mounts435 missions and hands the exact Classic selection to its own host', async (t) => {
  const p = await journeyPage(t);
  await open(p);
  showAllLifecycles(p);
  assert.equal(p.$('journey-cards').children.length, 435);
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === lateBase.id).click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.searchParams.get('journey'), 'legacy');
  assert.equal(destination.searchParams.get('library-mission'), lateBase.id);
  assert.equal(destination.pathname, '/game/');
  assert.deepEqual(p.errors, []);
});

test('Classic hands a Journey card directly to its new-edition host', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  const card = p.$('journey-cards').children[1],
    id = card.dataset.missionId;
  card.click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v25');
  assert.equal(destination.searchParams.get('library-mission'), id);
  assert.deepEqual(p.errors, []);
});

test('Solo mode filter exposes the same qualified Journey identities in Versus without duplicates', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  await open(p);
  showAllLifecycles(p);
  const original = [...p.$('journey-cards').children].map((card) => card.dataset.missionId);
  p.$('journey-mode').value = 'versus';
  p.$('journey-mode').emit('change');
  const cards = [...p.$('journey-cards').children];
  const owner = (card) => JSON.parse(card.dataset.missionId)[0];
  const additions = new Set(['journey:humanoid-hunt-v1', 'journey:duel-expedition-v1']);
  assert.deepEqual(
    cards.filter((card) => !additions.has(owner(card))).map((card) => card.dataset.missionId),
    original,
    'Every previously qualified shared identity retains its order and receiving owner.',
  );
  assert.equal(new Set(original).size, 435);
  assert.equal(new Set(cards.map((card) => card.dataset.missionId)).size, cards.length);
  assert.equal(cards.filter((card) => owner(card) === 'journey:humanoid-hunt-v1').length, 6);
  assert.equal(
    cards.filter((card) => owner(card) === 'journey:duel-expedition-v1').length,
    MULTIPLAYER_EXPANSION_LAYOUTS.filter((row) => row.mode === 'versus').length,
  );
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const sources = duelExpeditionLibrarySources({ themes, launch: () => true });
  assert.deepEqual(
    sources.map((source) => source.id),
    ['journey:humanoid-hunt-v1', 'journey:duel-expedition-v1'],
  );
  const admitted = createMissionLibrary(sources).missions;
  assert.ok(admitted.every((mission) => mission.modes.includes('versus')));
  const expected = [...original, ...admitted.map((mission) => mission.id)];
  assert.equal(
    new Set(expected).size,
    expected.length,
    'Registered owners do not alias Solo rows.',
  );
  assert.deepEqual(cards.map((card) => card.dataset.missionId).sort(), expected.sort());
  const target = cards.find((card) => card.dataset.missionId === original[1]);
  assert.match(target.textContent, /Journey.*Band 1\/12/);
  assertReadyCard(target);
  target.click();
  await settle(() => globalThis.location.href.includes('library-mission='));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.pathname, '/game/couch/');
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v25');
  assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
  assert.deepEqual(p.errors, []);
});

for (const collection of ['Journey', 'Classic'])
  test(`Solo Team filter hands an exact ${collection} mission to its Team host`, async (t) => {
    const p = await soloPage(t, { titleScreen: true });
    await open(p);
    p.$('journey-mode').value = 'team';
    p.$('journey-mode').emit('change');
    const cards = [...p.$('journey-cards').children];
    const owner = (card) => JSON.parse(card.dataset.missionId)[0];
    const retained = new Set([
      'journey:team-cultural-specialist-originals-2',
      'team-classic:relay-rescue-starter',
    ]);
    assert.equal(cards.filter((card) => retained.has(owner(card))).length, 14);
    assert.equal(cards.filter((card) => owner(card) === 'team-journey:humanoid-hunt-v1').length, 6);
    const expeditionCount = MULTIPLAYER_EXPANSION_LAYOUTS.filter(
      (row) => row.mode === 'team',
    ).length;
    assert.equal(
      cards.filter((card) => owner(card) === 'journey:team-expedition-v1').length,
      expeditionCount,
    );
    assert.equal(cards.length, 14 + 6 + expeditionCount);
    assert.equal(new Set(cards.map((card) => card.dataset.missionId)).size, cards.length);
    const sources = createRemoteTeamLibrarySources({ launch: () => true });
    assert.deepEqual(
      sources.map((source) => source.id),
      [
        'journey:team-expedition-v1',
        'team-journey:humanoid-hunt-v1',
        'journey:team-cultural-specialist-originals-2',
        'team-classic:relay-rescue-starter',
      ],
    );
    const admitted = createMissionLibrary(sources).missions;
    assert.ok(admitted.every((mission) => mission.modes.includes('team')));
    assert.deepEqual(
      cards.map((card) => card.dataset.missionId).sort(),
      admitted.map((mission) => mission.id).sort(),
    );
    const retainedMissions = admitted.filter((mission) => retained.has(mission.ownerId));
    assert.equal(retainedMissions.length, 14, 'Every original Team Journey and Classic identity remains.');
    const exact = retainedMissions.find((mission) => mission.collection === collection);
    assert.ok(exact);
    const targetOwner =
      collection === 'Journey'
        ? 'journey:team-cultural-specialist-originals-2'
        : 'team-classic:relay-rescue-starter';
    const target = cards.find((card) => owner(card) === targetOwner);
    assert.match(target.querySelector('.journey-card-tags').textContent, new RegExp(collection));
    assert.equal(target.dataset.missionId, exact.id, 'The current receiving owner is the authored source mission.');
    assertReadyCard(target);
    target.click();
    await settle(() => globalThis.location.href.includes('library-mission='));
    const destination = new URL(globalThis.location.href);
    assert.equal(destination.pathname, '/game/couch/relay-rescue.html');
    assert.equal(
      destination.searchParams.get('journey'),
      collection === 'Journey' ? 'team-cultural-specialist-originals-2' : 'legacy',
    );
    assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
    assert.deepEqual(p.errors, []);
  });

test('incoming Journey selection launches exactly its requested mission without another picker', async (t) => {
  const id = JSON.stringify([
    'journey:whole-spatial-v5',
    'whole-spatial-v5',
    JSON.stringify(['candidate', 'journey-opening', 'prologue']),
    'candidate/journey-opening/prologue/choose-your-share',
    '',
  ]);
  const search = new URLSearchParams({ journey: 'whole-spatial-v5', 'library-mission': id });
  const p = await journeyPage(t, `?${search}`);
  await startPrepared(p, 'choose-your-share');
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('unfinished Classic attempt keeps its exact cut through Stay and returns to the selected card', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  p.$('shell-featured').click();
  await running(p, model.missions[0].runtimeId);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) p.frame();
  assert.equal(p.rendered.run.player.cutting, true);
  p.$('shell-menu').click();
  await open(p);
  const old = p.rendered.run,
    checkpoint = authoritativeCheckpoint(old);
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === lateBase.id).click();
  await settle(
    () => p.$('mission-replace-dialog').open && !p.$('mission-replace-confirm').disabled,
  );
  assert.equal(p.$('journey-chooser').open, false);
  p.$('mission-replace-stay').click();
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement.dataset.missionId, lateBase.id);
  p.frame(0);
  assert.equal(p.rendered.run, old);
  assert.deepEqual(authoritativeCheckpoint(old), checkpoint);
  assert.deepEqual(p.errors, []);
});
