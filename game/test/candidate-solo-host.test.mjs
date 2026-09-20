import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

class CandidateImage {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
  }
}
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
    pictures: { Image: CandidateImage },
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
  p.$('shell-play').click();
  assert.equal(p.$('journey-cards').children.length, 17);
  [...p.$('journey-cards').children]
    .find((card) => card.dataset.missionId.endsWith('/long-way-home'))
    .click();
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
  p.$('shell-packs').click();
  const skipped = [...p.$('journey-cards').children].find((card) =>
    card.dataset.missionId.endsWith('/long-way-home'),
  );
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
  class HeldImage extends CandidateImage {
    async decode() {
      if (held) {
        entered = true;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
    }
    removeAttribute() {
      super.removeAttribute();
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
    assert.equal(p.rendered.run.rules.moveSpeed, 10);
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
  p.$('shell-packs').click();
  const card = p.$('journey-cards').children[0];
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
    const rows = JSON.parse(
      await readFile(new URL('./fixtures/horizon-greybox-routes.json', import.meta.url)),
    ).rows.slice(0, 9);
    if (route === 'authored')
      rows.push(
        ...JSON.parse(
          await readFile(new URL('./fixtures/border-clear-routes.json', import.meta.url)),
        )
          .sets.find(
            (set) => set.bonuses && set.difficulty === 'standard' && set.turnPolicy === 'immediate',
          )
          .rows.slice(0, 6),
      );
    const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
    for (const [id, , checkpoint, segments] of rows) {
      assert.equal(p.rendered.run.levelId, id);
      const reference = createRun(p.rendered.run.level, { seed: 1, classId: 'scout' });
      for (const [direction, ticks] of segments) {
        if (direction !== null) {
          p.key(keys[direction]);
          p.key(keys[direction], false);
        }
        let frameTicks = 0;
        for (let tick = 0; tick < ticks; tick++) {
          // Batch display frames, never simulation ticks. Stop exactly at each
          // reference closure so the next command is a deliberate fresh gesture.
          // The independently frozen checkpoint still verifies the actual host.
          stepRun(reference, { direction }, FIXED_DT);
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
      assert.equal(p.rendered.run.status, 'won', id);
      assert.equal(authoritativeCheckpoint(p.rendered.run).hash, checkpoint, id);
      assert.equal(p.$('game-overlay').dataset.kind, 'won');
      assert.equal(p.$('journey-chooser').open, false);
      if (id !== rows.at(-1)[0]) {
        p.$('next-button').click();
        await running(p, rows[rows.findIndex((row) => row[0] === id) + 1][0]);
      }
    }
    assert.match(p.$('next-button').textContent, /Journey complete/);
    p.$('next-button').click();
    assert.equal(p.$('journey-chooser').open, true);
    assert.equal(p.rendered.run.levelId, rows.at(-1)[0]);
    assert.equal(p.$('journey-cards').children.length, route === 'authored' ? 17 : 10);
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
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let tick = 0; tick < 414; tick++) p.frame();
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
