import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { dataIdentity } from '../data-json.mjs';
import { expectedRouteEvidence, assertRouteEvidence } from './helpers/route-evidence.mjs';

const authoredRoute = createAuthoredJourneyRoute('authored');
const authoredProject = compileContentProject(authoredRoute.source);
const {
  rows: tunedRoutes,
  optional: optionalRoutes,
  evidence,
} = JSON.parse(
  await readFile(new URL('./fixtures/candidate-solo-tuned-host-routes.json', import.meta.url)),
);
async function setup(t, { difficulty = 'standard', storage = memoryStorage(), ...options } = {}) {
  storage.setItem(
    JOURNEY_PREFERENCES_KEY,
    JSON.stringify({ format: 'JourneyPreferencesV1', difficulty }),
  );
  const memory = managedIndexedDB();
  const p = await soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    storage,
    journeyIndexedDB: memory.indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
    ...options,
  });
  return { p, storage, backend: createJourneyBackend(memory) };
}
const running = (p, levelId) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === levelId;
  });
async function openMissions(p, opener = 'shell-play') {
  p.$(opener).click();
  await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  p.change('journey-collection', 'Journey');
}
function missionCard(p, route, levelId) {
  return [...p.$('journey-cards').children].find((card) => {
    const [owner, edition, , mission] = JSON.parse(card.dataset.missionId);
    return owner === `journey:${route}` && edition === route && mission.endsWith(`/${levelId}`);
  });
}
function tunedLevel(levelId, difficulty = 'standard') {
  return applyGameplayTuning(
    resolveMission(authoredProject, levelId, { difficulty }).level,
    resolveGameplayTuning(difficulty),
  );
}
function playRoute(p, [id, authoredIdentity, gameplayIdentity, , segments]) {
  assert.equal(p.rendered.run.levelId, id);
  const manifest = resolveMission(authoredProject, id);
  assert.equal(manifest.simulationIdentity, authoredIdentity);
  assert.equal(p.rendered.backdrop.kind, 'candidate-picture');
  assert.deepEqual(p.rendered.backdrop.assetRevision, manifest.background);
  const level = tunedLevel(id);
  assert.deepEqual(p.rendered.run.level, level);
  assert.equal(
    dataIdentity({ ruleset: p.rendered.run.ruleset, level, classes: CLASSES }),
    gameplayIdentity,
  );
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const reference = createRun(level, options),
    recorder = createRecorder(level, options);
  const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
  for (const [direction, ticks] of segments) {
    if (direction !== null) {
      p.key(keys[direction]);
      p.key(keys[direction], false);
    }
    let frameTicks = 0;
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(reference.status, 'running', `${id}: route outlived the reference`);
      recordInput(recorder, { direction });
      stepRun(reference, { direction }, FIXED_DT);
      assert.equal(reference.lives, 3, `${id}: renewed route must remain lossless`);
      frameTicks++;
      const closure = reference.events.some((event) => event.type === 'capture.stopped');
      if (closure || frameTicks === 12 || tick === ticks - 1) {
        p.frame(frameTicks * FIXED_DT * 1000);
        frameTicks = 0;
        if (closure && tick < ticks - 1 && p.rendered.run.status !== 'won') {
          assert.equal(p.rendered.run.player.speed, 0);
          p.key(keys[direction]);
          p.key(keys[direction], false);
        }
      }
    }
  }
  assert.equal(reference.status, 'won', id);
  assert.equal(p.rendered.run.status, 'won', id);
  const referenceCheckpoint = authoritativeCheckpoint(reference),
    hostCheckpoint = authoritativeCheckpoint(p.rendered.run);
  assert.deepEqual(hostCheckpoint, referenceCheckpoint, `${id}: host and reference must agree`);
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true, `${id}: public replay`);
  assertRouteEvidence(reference, expectedRouteEvidence(evidence, id), id);
}

test('the final authored core mission offers Find missions without recording a fictitious skip', async (t) => {
  const { p, backend } = await setup(t);
  await openMissions(p);
  missionCard(p, 'opening', 'long-way-home').click();
  await running(p, 'long-way-home');
  const original = p.rendered.run;
  assert.equal(p.$('journey-skip').hidden, false);
  assert.equal(p.$('journey-skip').textContent, 'Find missions');
  p.$('journey-skip').click();
  await settle(() => p.$('journey-chooser').open);
  p.frame(0);
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.rendered.run, original);
  assert.deepEqual((await backend.read()).skipped.solo, []);
  p.$('journey-back').click();
  p.frame(0);
  assert.equal(p.$('journey-skip').textContent, 'Find missions');
  assert.deepEqual(p.errors, []);
});

for (const [missionId, expected] of [
  ['first-return', 'Next: Choose your share'],
  ['two-keepers', 'Next campaign: Horizon School'],
])
  test(`Solo result for ${missionId} names its owned continuation`, async (t) => {
    const { p } = await setup(t);
    await openMissions(p);
    missionCard(p, 'opening', missionId).click();
    await running(p, missionId);
    p.$('pause-button').click();
    p.rendered.run.status = 'won';
    p.$('show-result').click();
    assert.equal(p.$('next-button').textContent, expected);
    assert.deepEqual(p.errors, []);
  });

test('cross-pack Skip failure keeps Horizon intact, then retries into Border without awarding a clear', async (t) => {
  let refuseBorder = false;
  const { p, backend, storage } = await setup(t, {
    search: '?journey=authored',
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/')) {
        if (refuseBorder && String(path).includes('/border-r1/'))
          return new Response('Unavailable', { status: 503 });
        return new Response(await readFile(path));
      }
    },
  });
  await openMissions(p);
  assert.equal(p.$('journey-cards').children.length, 17);
  missionCard(p, 'authored', 'long-way-home').click();
  await running(p, 'long-way-home');
  const previous = p.rendered.run,
    picture = p.rendered.backdrop;
  refuseBorder = true;
  p.$('journey-skip').click();
  assert.equal(p.$('journey-skip').textContent, 'Confirm skip');
  p.$('journey-skip').click();
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  p.frame(0);
  assert.equal(p.rendered.run, previous);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  refuseBorder = false;
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await running(p, 'behind-the-patrol');
  assert.equal(p.rendered.backdrop.assetRevision.id, 'border-behind-the-patrol');
  assert.equal(p.rendered.run.player.speed, 0, 'Transition does not reuse the activation input.');
  p.$('pause-button').click();
  const saved = JSON.parse(storage.getItem('revealline.suspended.journey-authored.v1'));
  assert.equal(saved.themeId, 'border-bloom');
  assert.equal(storage.getItem('revealline.suspended.journey-opening.v1'), null);
  const profile = await backend.read();
  assert.equal(Object.keys(profile.clears.solo).length, 0);
  assert(profile.skipped.solo.some((id) => id.endsWith('/long-way-home')));
  await openMissions(p, 'shell-packs');
  const skipped = missionCard(p, 'authored', 'long-way-home');
  assert.match(skipped.textContent, /Skipped/);
  assert.doesNotMatch(skipped.textContent, /Cleared/);
  skipped.click();
  await running(p, 'long-way-home');
  assert.equal(p.rendered.run.coverage, 0);
  assert.deepEqual(p.errors, []);
});

test('failed authored next-picture load retains the exact paused flight and can retry Skip', async (t) => {
  let refuse = false;
  const { p } = await setup(t, {
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/')) {
        if (refuse) return new Response('Unavailable', { status: 503 });
        return new Response(await readFile(path));
      }
    },
  });
  p.$('shell-featured').click();
  await running(p, 'first-return');
  const run = p.rendered.run,
    picture = p.rendered.backdrop;
  refuse = true;
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
  p.frame(0);
  assert.equal(p.rendered.run, run);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  assert.equal(p.$('picture-use-legacy').hidden, true);
  refuse = false;
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await running(p, 'choose-your-share');
  assert.deepEqual(p.errors, []);
});

test('difficulty intent during candidate decode cancels adoption and releases late pixels', async (t) => {
  let held = false,
    release,
    entered = false,
    released = 0;
  class HeldImage extends PNGImage {
    async decode() {
      await super.decode();
      if (held) {
        entered = true;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
    }
    removeAttribute(name) {
      super.removeAttribute(name);
      released++;
    }
  }
  const { p } = await setup(t, { pictures: { Image: HeldImage } });
  p.$('shell-featured').click();
  await running(p, 'first-return');
  const run = p.rendered.run,
    picture = p.rendered.backdrop;
  held = true;
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await settle(() => entered);
  const baseline = released;
  p.change('difficulty-select', 'expert');
  release();
  await settle(() => released > baseline);
  p.frame(0);
  assert.equal(p.rendered.run, run);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.rendered.run.lives, 3);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  assert.equal(p.$('difficulty-select').value, 'expert');
  held = false;
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await running(p, 'choose-your-share');
  assert.equal(p.rendered.run.lives, 2);
  assert.deepEqual(p.errors, []);
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`authored Solo boot and one-action title start preserve ${difficulty} rules and original picture`, async (t) => {
    const { p } = await setup(t, { difficulty });
    assert.equal(p.rendered.run.levelId, 'first-return');
    assert.deepEqual(p.rendered.run.level, tunedLevel('first-return', difficulty));
    assert.equal(p.rendered.run.rules.moveSpeed, 8.84);
    assert.equal(p.rendered.run.lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
    assert.match(p.$('shell-title-edition').textContent, /UNVALIDATED/);
    assert.equal(p.$('journey-artwork-availability').hidden, false);
    p.$('shell-featured').click();
    await running(p, 'first-return');
    assert.equal(p.doc.body.dataset.pictureState, 'ready');
    assert.equal(p.rendered.run.classId, 'scout');
    assert.equal(p.$('difficulty-select').value, difficulty);
    assert.deepEqual(p.errors, []);
  });

test('failed difficulty save offers truthful export and retry without replacing the current flight', async (t) => {
  const { p, storage } = await setup(t);
  p.$('shell-featured').click();
  await running(p, 'first-return');
  const run = p.rendered.run,
    picture = p.rendered.backdrop,
    saved = storage.getItem(JOURNEY_PREFERENCES_KEY),
    setItem = storage.setItem.bind(storage);
  let refuse = true,
    exportFailure = true,
    exported;
  storage.setItem = (key, value) => {
    if (refuse && key === JOURNEY_PREFERENCES_KEY) throw new Error('Quota test.');
    setItem(key, value);
  };
  t.mock.method(URL, 'createObjectURL', (blob) => {
    if (exportFailure) throw new Error('Download test.');
    exported = blob;
    return 'blob:journey-difficulty';
  });
  p.change('difficulty-select', 'expert');
  assert.equal(p.$('journey-preferences-recovery').hidden, false);
  assert.match(p.$('journey-preferences-message').textContent, /only to this session.*Quota test/);
  assert.equal(storage.getItem(JOURNEY_PREFERENCES_KEY), saved);
  p.$('journey-preferences-export').click();
  await settle(() => p.$('journey-preferences-message').textContent.includes('Export failed'));
  assert.match(p.$('journey-preferences-message').textContent, /choice is still here/);
  exportFailure = false;
  p.$('journey-preferences-export').click();
  await settle(() => p.$('journey-preferences-message').textContent.includes('Download requested'));
  assert.deepEqual(JSON.parse(await exported.text()), {
    format: 'JourneyPreferencesV1',
    difficulty: 'expert',
  });
  assert.equal(
    p.$('journey-preferences-recovery').hidden,
    false,
    'Export does not imply saved preference',
  );
  refuse = false;
  p.$('journey-preferences-retry').click();
  assert.equal(p.$('journey-preferences-recovery').hidden, true);
  assert.equal(JSON.parse(storage.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'expert');
  p.frame(0);
  assert.equal(p.rendered.run, run);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.rendered.run.lives, 3);
  assert.match(
    p.$('difficulty-note').textContent,
    /This flight: standard. Next fresh attempt: expert/,
  );
  assert.deepEqual(p.errors, []);
});

test('cross-tab difficulty intent refreshes controls but preserves the current attempt', async (t) => {
  const { p, storage } = await setup(t);
  p.$('shell-featured').click();
  await running(p, 'first-return');
  const run = p.rendered.run,
    picture = p.rendered.backdrop;
  await openMissions(p, 'shell-packs');
  const card = missionCard(p, 'opening', 'first-return');
  assert.match(card.textContent, /Band 1\/12.*Standard.*Optional challenge/);
  card.focus();
  const raw = JSON.stringify({ format: 'JourneyPreferencesV1', difficulty: 'gentle' });
  storage.setItem(JOURNEY_PREFERENCES_KEY, raw);
  p.win.emit('storage', { key: JOURNEY_PREFERENCES_KEY, newValue: raw, storageArea: storage });
  p.frame(0);
  assert.equal(p.$('difficulty-select').value, 'gentle');
  assert.match(p.$('journey-cards').children[0].textContent, /Band 1\/12.*Gentle/);
  assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
  assert.equal(p.rendered.run, run);
  assert.equal(p.rendered.backdrop, picture);
  assert.equal(p.rendered.run.lives, 3);
  assert.match(
    p.$('difficulty-note').textContent,
    /This flight: standard. Next fresh attempt: gentle/,
  );
  assert.deepEqual(p.errors, []);
});

for (const route of ['opening', 'authored'])
  test(`${route} Solo clears continue across all campaigns without Legacy awards or forced Remixes`, async (t) => {
    const { p, storage, backend } = await setup(t, { search: `?journey=${route}` });
    p.$('shell-featured').click();
    await running(p, 'first-return');
    const rows = route === 'authored' ? tunedRoutes : tunedRoutes.slice(0, 9);
    assert.equal(rows.length, route === 'authored' ? 15 : 9);
    for (const row of rows) {
      const [id] = row;
      playRoute(p, row);
      assert.equal(p.$('game-overlay').dataset.kind, 'won');
      assert.equal(p.$('journey-chooser').open, false);
      if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
      await settle(() => !p.$('next-button').disabled);
      if (id !== rows.at(-1)[0]) {
        p.$('next-button').click();
        await running(p, rows[rows.findIndex((row) => row[0] === id) + 1][0]);
      }
    }
    assert.equal(p.$('next-button').textContent, 'Browse missions →');
    const completed = p.rendered.run,
      picture = p.rendered.backdrop,
      checkpoint = authoritativeCheckpoint(completed);
    p.$('next-button').click();
    await settle(() => p.$('journey-chooser').open && p.$('journey-collection'));
    assert.equal(p.$('journey-chooser').open, true);
    p.change('journey-collection', 'Journey');
    assert.equal(p.rendered.run.levelId, rows.at(-1)[0]);
    assert.equal(p.$('journey-cards').children.length, route === 'authored' ? 17 : 10);
    assert.equal(p.rendered.run, completed);
    assert.equal(p.rendered.backdrop, picture);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    p.$('journey-back').click();
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement, p.$('next-button'));
    assert.equal(p.$('game-overlay').dataset.kind, 'won');
    assert.equal(p.rendered.run, completed);
    // Completion intentionally does not block Next on its IndexedDB transaction.
    // Bound the asynchronous persistence check instead of treating a Promise as
    // a synchronous waitFor predicate or asserting before the final commit.
    let persisted;
    for (let attempt = 0; attempt < 200; attempt++) {
      persisted = await backend.read();
      if (Object.keys(persisted.clears.solo).length === rows.length) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(Object.keys(persisted.clears.solo).length, rows.length);
    for (const [id, , gameplayIdentity] of rows) {
      const receipt = Object.entries(persisted.clears.solo).find(([missionId]) =>
        missionId.endsWith(`/${id}`),
      )?.[1];
      assert(receipt, `${id}: exact completed mission has a durable receipt`);
      assert.equal(receipt.gameplayId, gameplayIdentity, id);
      assert.equal(receipt.difficulty, 'standard', id);
    }
    assert.equal(
      new Set(Object.values(persisted.clears.solo).map((r) => r.runId)).size,
      rows.length,
    );
    if (route === 'authored')
      assert.equal(storage.getItem('revealline.suspended.journey-opening.v1'), null);
    assert(
      !storage.writes.some(
        ([key]) => key === 'revealline.library.dev.v1' || key === 'revealline.suspended.dev.v1',
      ),
    );
    const library = JSON.parse(storage.getItem('revealline.library.dev.v1') || '{}');
    assert.equal(library.gallery?.length ?? 0, 0);
    assert.equal(Object.keys(library.campaigns ?? {}).length, 0);
    assert.deepEqual(p.errors, []);
  });

for (const row of optionalRoutes)
  test(`${row[0]} optional ending offers Browse missions and preserves its exact result`, async (t) => {
    const { p, backend } = await setup(t, { search: '?journey=authored' });
    await openMissions(p);
    missionCard(p, 'authored', row[0]).click();
    await running(p, row[0]);
    playRoute(p, row);
    assert.equal(p.$('next-button').textContent, 'Browse missions →');
    const completed = p.rendered.run,
      picture = p.rendered.backdrop,
      checkpoint = authoritativeCheckpoint(completed);
    p.$('next-button').click();
    await settle(() => p.$('journey-chooser').open);
    assert.equal(p.rendered.run, completed);
    assert.equal(p.rendered.backdrop, picture);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    p.$('journey-back').click();
    assert.equal(p.doc.activeElement, p.$('next-button'));
    assert.equal(p.$('game-overlay').dataset.kind, 'won');
    assert.equal(p.rendered.run, completed);
    const profile = await backend.read();
    assert.equal(Object.keys(profile.clears.solo).length, 1);
    assert.deepEqual(profile.skipped.solo, []);
    const [missionId, receipt] = Object.entries(profile.clears.solo)[0];
    assert(missionId.endsWith(`/${row[0]}`));
    assert.equal(receipt.gameplayId, row[2]);
    assert.equal(receipt.difficulty, 'standard');
    assert.deepEqual(p.errors, []);
  });

test('candidate Skip takes two actions, uses next-attempt Expert intent, and restores exact paused saved media', async (t) => {
  const { p, storage, backend } = await setup(t);
  p.$('shell-featured').click();
  await running(p, 'first-return');
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 24; i++) p.frame();
  p.$('pause-button').click();
  const retained = p.rendered.run;
  const checkpoint = authoritativeCheckpoint(retained);
  const savedRaw = storage.getItem('revealline.suspended.journey-opening.v1');
  assert(savedRaw);
  const saved = JSON.parse(savedRaw);
  assert.equal(saved.themeId, 'horizon');
  assert.equal(saved.presentationPins, undefined);
  assert.equal(verifyReplay(saved.replay).match, true);
  p.change('difficulty-select', 'expert');
  assert.equal(p.rendered.run, retained);
  assert.equal(retained.lives, 3);
  p.$('journey-skip').click();
  assert.equal(p.rendered.run, retained);
  assert.equal(p.$('journey-skip').textContent, 'Confirm skip');
  p.$('journey-skip').click();
  await running(p, 'choose-your-share');
  assert.equal(p.rendered.run.lives, 2);
  assert.equal(p.rendered.backdrop.kind, 'candidate-picture');
  const profile = await backend.read();
  assert.equal(Object.keys(profile.clears.solo).length, 0);
  assert(profile.skipped.solo.some((id) => id.endsWith('/first-return')));
  p.$('pause-button').click();
  p.$('library-button').click();
  p.$('save-json').value = savedRaw;
  p.$('import-save').click();
  await settle(() => !p.$('library-dialog').open).catch((error) => {
    throw new Error(
      `${error.message} ${p.$('flight-preparation-status').textContent} ${p.$('save-status').textContent} ${JSON.stringify(p.errors)}`,
    );
  });
  p.frame(0);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  assert.equal(p.rendered.run.levelId, 'first-return');
  assert.equal(p.rendered.run.lives, 3);
  assert.equal(authoritativeCheckpoint(p.rendered.run).hash, checkpoint.hash);
  assert.equal(p.rendered.backdrop.assetRevision.id, 'horizon-first-return');
  assert.equal(p.$('difficulty-select').value, 'expert');
  assert.deepEqual(p.errors, []);
});

test('authored result Retry applies Expert without managed-media pins or changing the clear receipt', async (t) => {
  const { p, backend } = await setup(t);
  p.$('shell-featured').click();
  await running(p, 'first-return');
  playRoute(p, tunedRoutes[0]);
  assert.equal(p.rendered.run.status, 'won');
  const picture = p.rendered.backdrop;
  p.change('difficulty-select', 'expert');
  p.$('retry-button').click();
  await running(p, 'first-return');
  assert.equal(p.rendered.run.lives, 2);
  assert.equal(p.rendered.run.seed, 1);
  assert.equal(p.rendered.backdrop.kind, 'candidate-picture');
  assert.deepEqual(p.rendered.backdrop.assetRevision, picture.assetRevision);
  assert.equal(p.rendered.backdrop.pin, undefined);
  const receipts = Object.values((await backend.read()).clears.solo);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].difficulty, 'standard');
  assert.deepEqual(p.errors, []);
});
