import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { includedChapterPage } from './helpers/included-chapter-host.mjs';
import { includedChapterFixture } from './fixtures/included-bundled.mjs';
import { verifyIndexedInstalledPack } from '../mission-library/pack-identity.mjs';
import { isIncludedBundledMission, INCLUDED_BUNDLED_PACK_MAX_BYTES } from '../mission-library/included-bundled-pack.mjs';
import { prepareMissionLibraryIndex } from '../mission-library/classic-source.mjs';
import { createPresentationResponses, loadPresentationResponses } from './helpers/presentation-responses.mjs';
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


test('unified Solo validates and directly launches the included late Classic', async (t) => {
  const { p, row } = await includedChapterPage(t);
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'Included fixture';
  p.$('journey-search').emit('input');
  assert.ok(row);
  const card = [...p.$('journey-cards').children].find(
    (button) => button.dataset.missionId === row.id,
  );
  assert.ok(card);
  assert.equal(card.dataset.availabilityState, 'included');
  assert.equal(card.querySelector('.journey-card-action').hidden, true);
  assert.equal(card.disabled, false);
  card.focus();
  card.click();
  await startPrepared(p, row.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('journey-search').value, 'Included fixture');
  assert.deepEqual(p.errors, []);
});

test('unified Solo failed included-chapter read retries inline and preserves the flight until retry succeeds', async (t) => {
  let available = false,
    requests = 0;
  const { p, row } = await includedChapterPage(t, {
    request: () => {
      requests++;
      if (!available) throw new TypeError('Download temporarily unavailable');
    },
  });
  const initial = p.rendered.run,
    checkpoint = authoritativeCheckpoint(initial);
  await open(p);
  p.$('journey-collection').value = 'Classic';
  p.$('journey-collection').emit('change');
  p.$('journey-search').value = 'Included fixture';
  p.$('journey-search').emit('input');
  const selected = () =>
    [...p.$('journey-cards').children].find((card) => card.dataset.missionId === row.id);
  const card = selected();
  assert.equal(card.dataset.availabilityState, 'included');
  assert.equal(card.querySelector('.journey-card-action').hidden, true);
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
  assert.equal(p.$('journey-search').value, 'Included fixture');
  assert.equal(p.doc.activeElement, selected());
  assertReadyCard(selected(), row.name);
  assert.deepEqual(p.errors, []);
});

test('procedural included chapter has actual bounded bytes and authenticated runtime owners', async () => {
  const fixture = await includedChapterFixture();
  assert.equal(INCLUDED_BUNDLED_PACK_MAX_BYTES, 65536);
  assert.ok(fixture.bytes.length > 0 && fixture.bytes.length <= INCLUDED_BUNDLED_PACK_MAX_BYTES);
  assert.equal(
    createHash('sha256').update(fixture.bytes).digest('hex'),
    fixture.rows[0].sourceFile.sha256,
  );
  assert.equal(fixture.rows[0].sourceFile.bytes, fixture.bytes.length);
  assert.equal(fixture.rows.length, 3);
  const index = prepareMissionLibraryIndex({
    format: 'revealline-mission-library-index.v1',
    missions: fixture.rows,
  });
  for (const row of index.missions) {
    assert.equal(isIncludedBundledMission(row), true);
    assert.equal(await verifyIndexedInstalledPack(fixture.pack, row), true);
    assert.deepEqual(row.modes, ['solo', 'versus']);
    assert.ok(row.difficultiesByMode.solo.includes('standard'));
  }
  assert.deepEqual(fixture.source.visualOverrides, {});
  assert.deepEqual(fixture.source.levelVisuals, []);
  assert.deepEqual(fixture.source.music, []);
});

test('included fixture refuses a false prepared-pack identity and a false byte classification', async () => {
  const fixture = await includedChapterFixture();
  const row = fixture.rows[2];
  assert.equal(
    await verifyIndexedInstalledPack(fixture.pack, {
      ...row,
      packIdentity: { ...row.packIdentity, sha256: '0'.repeat(64) },
    }),
    false,
  );
  assert.equal(
    isIncludedBundledMission({ ...row, sourceFile: { ...row.sourceFile, bytes: 65537 } }),
    false,
  );
  assert.equal(isIncludedBundledMission({ ...row, source: 'optional' }), false);
});

test('the real Night Shift source remains large and must not be classified as included', async () => {
  const bytes = await readFile(new URL('../content/packs/night-shift.json', import.meta.url));
  const index = JSON.parse(
    await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
  );
  const rows = index.missions.filter((row) => row.packId === 'night-shift');
  assert.ok(rows.length > 0);
  assert.ok(bytes.length > INCLUDED_BUNDLED_PACK_MAX_BYTES);
  for (const row of rows) {
    assert.equal(row.sourceFile.bytes, bytes.length);
    assert.equal(row.sourceFile.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(isIncludedBundledMission(row), false);
  }
});

const responsePath =
  '/game/presentation/compiled/assets/' +
  createHash('sha256')
    .update(new Uint8Array([1, 2, 3]))
    .digest('hex') +
  '.png';
const requestURL = `http://localhost${responsePath}`;
const entries = () => new Map([[responsePath, new Uint8Array([1, 2, 3])]]);

test('presentation fixture responses own byte copies, never mutable caller or prior response buffers', async () => {
  const input = new Uint8Array([1, 2, 3]);
  const fixture = createPresentationResponses(new Map([[responsePath, input]]));
  input[0] = 9;
  const first = new Uint8Array(await (await fixture.wrap()(requestURL)).arrayBuffer());
  assert.deepEqual([...first], [1, 2, 3]);
  first[1] = 9;
  assert.deepEqual(
    [...new Uint8Array(await (await fixture.wrap()(requestURL)).arrayBuffer())],
    [1, 2, 3],
  );
});
test('presentation fixture preserves explicit custom failures, values and callback argument identities', async () => {
  const fixture = createPresentationResponses(entries()),
    url = new URL(requestURL),
    controller = new AbortController();
  controller.abort();
  const options = { signal: controller.signal };
  const failure = new Response('Deliberate outage', { status: 503 });
  assert.equal(
    await fixture.wrap(async (path, init) => {
      assert.equal(path, url);
      assert.equal(init, options);
      return failure;
    })(url, options),
    failure,
  );
  assert.equal(await fixture.wrap(() => false)(url), false);
  const thrown = new Error('Deliberate request failure');
  await assert.rejects(
    fixture.wrap(() => {
      throw thrown;
    })(url),
    (error) => error === thrown,
  );
});
test('presentation fixture cannot bypass a held custom original request', async () => {
  const fixture = createPresentationResponses(entries());
  let release,
    entered = false,
    completed = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = fixture
    .wrap(async () => {
      entered = true;
      await gate;
    })(requestURL)
    .then((response) => {
      completed = true;
      return response;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(entered, true);
  assert.equal(completed, false);
  release();
  assert.deepEqual([...new Uint8Array(await (await pending).arrayBuffer())], [1, 2, 3]);
});
test('presentation fixture honors cancellation after an empty custom callback and before cached response', async () => {
  const fixture = createPresentationResponses(entries()),
    controller = new AbortController();
  const options = { signal: controller.signal };
  await assert.rejects(
    fixture.wrap(() => {
      controller.abort();
    })(requestURL, options),
    (error) => error.name === 'AbortError',
  );
});
test('presentation fixture falls through unknown resources and rejects a foreign origin for known bytes', async () => {
  const fixture = createPresentationResponses(entries());
  assert.equal(await fixture.wrap()('content/packs/night-shift.json'), undefined);
  assert.equal(await fixture.wrap()(requestURL + '?different=1'), undefined);
  await assert.rejects(fixture.wrap()('https://other.invalid' + responsePath), /origin/i);
  assert.throws(
    () => createPresentationResponses(new Map([['/outside', new Uint8Array([1])]])),
    /path/i,
  );
});
test('presentation fixture preloader rejects altered bytes rather than trusting the declared digest', async () => {
  let payloadReads = 0;
  await assert.rejects(
    loadPresentationResponses({
      read: async (url) => {
        const bytes = await readFile(url);
        if (new URL(url).pathname.endsWith('/runtime.json')) return bytes;
        payloadReads++;
        const altered = Buffer.from(bytes);
        altered[0] ^= 1;
        return altered;
      },
    }),
    /hash|digest/i,
  );
  assert.equal(payloadReads, 1);
});
