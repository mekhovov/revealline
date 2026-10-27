import { readFile } from 'node:fs/promises';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import { duelExpeditionLibrarySources } from '../mission-library/multiplayer-expeditions.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { preparePack } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
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
  currentPressure,
  installedAssets,
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

for (const [collection, route] of [
  ['Journey', 'team-cultural-specialist-originals-2'],
  ['Journey', 'team-expedition-v1'],
  ['Classic', 'legacy'],
])
  test(`Solo Team filter hands an exact ${collection} mission from ${route} to its Team host`, async (t) => {
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
    const exact =
      route === 'team-expedition-v1'
        ? admitted.find((mission) => mission.ownerId === 'journey:team-expedition-v1')
        : retainedMissions.find((mission) => mission.collection === collection);
    assert.ok(exact);
    const targetOwner =
      route === 'team-expedition-v1'
        ? 'journey:team-expedition-v1'
        : collection === 'Journey'
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
    assert.equal(destination.searchParams.get('journey'), route);
    assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
    assert.deepEqual(p.errors, []);
  });



// Original head scenarios retained in the current split handoff owner.
test('incoming opaque Classic handoff briefs its exact late mission without another picker', async (t) => {
  const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
  const p = await soloPage(t, { titleScreen: true, search: `?${search}` });
  await startPrepared(p, lateBase.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

test('incoming Current-rules Classic handoff retains its original picture owner', async (t) => {
  assert.ok(currentPressure);
  const source = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url), 'utf8'),
  );
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  const assets = await installedAssets(pack);
  const search = new URLSearchParams({
    journey: 'legacy',
    'library-mission': currentPressure.id,
  });
  const p = await soloPage(t, {
    titleScreen: true,
    search: `?${search}`,
    assetIndexedDB: assets.indexedDB,
  });
  await startPrepared(p, currentPressure.runtimeId);
  assert.equal(p.rendered.run.level.classic.lineImpact.version, 'line-impact.v1');
  assert.ok(Math.abs(p.rendered.run.level.classic.lineImpact.speed - 38.4) < 1e-9);
  assert.equal(p.$('journey-chooser').open, false);
  assert.doesNotMatch(p.$('run-message').textContent, /Picture choice.*execution catalog/);
  assert.deepEqual(p.errors, []);
});

for (const transition of ['finish', 'newer input', 'failed initial picture'])
  test(`incoming Classic handoff serializes initial picture preparation: ${transition}`, async (t) => {
    const compiled = JSON.parse(
      await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
    );
    const pictureHash = (level) =>
      Object.values(compiled.resolved.assets).find(
        (asset) => asset.kind === 'image' && asset.description === `scene-${level}`,
      ).file.sha256;
    const initialHash = pictureHash('signal-01'),
      targetHash = pictureHash(lateBase.runtimeId);
    let release,
      initialRequested = false,
      targetRequests = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
    const page = soloPage(t, {
      titleScreen: true,
      search: `?${search}`,
      waitForPictures: false,
      fetchResponse: async (path) => {
        if (String(path).includes(targetHash)) targetRequests++;
        if (!String(path).includes(initialHash)) return;
        initialRequested = true;
        await gate;
        if (transition === 'failed initial picture')
          return new Response('Deliberate initial picture outage', { status: 503 });
      },
    });
    await settle(
      () => initialRequested && globalThis.document.getElementById('journey-collection'),
    );
    const doc = globalThis.document;
    assert.notEqual(doc.body.dataset.flightState, 'running');
    assert.equal(
      targetRequests,
      0,
      'The requested original waits for the captured initial writer.',
    );
    if (transition === 'newer input') {
      doc.getElementById('start-button').emit('pointerdown');
      doc.getElementById('start-button').focus();
    }
    const focused = doc.activeElement;
    release();
    const p = await page;
    if (transition === 'newer input') {
      await settle(() => p.doc.body.dataset.pictureState === 'ready');
      await new Promise((resolve) => setImmediate(resolve));
      p.frame(0);
      assert.equal(
        targetRequests,
        0,
        'A retired incoming action must never prepare its destination.',
      );
      assert.equal(p.rendered.run.levelId, 'signal-01');
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.paused, true);
      assert.equal(p.doc.activeElement, focused);
      assert.notEqual(p.doc.body.dataset.flightState, 'running');
    } else {
      await startPrepared(p, lateBase.runtimeId);
      assert.ok(targetRequests > 0);
      assert.equal(p.$('shell-home').open, false);
    }
    assert.equal(p.$('journey-chooser').open, false);
    assert.deepEqual(p.errors, []);
  });

test('unknown incoming identity reports failure and never starts a different mission', async (t) => {
  const p = await soloPage(t, {
    titleScreen: true,
    search: '?journey=legacy&library-mission=unknown',
  });
  await settle(() => p.$('run-message').textContent.includes('exact mission edition'));
  p.frame(0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

test('incoming Journey selection briefs exactly its requested mission without another picker', async (t) => {
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
