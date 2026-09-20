import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

async function setup(t, difficulty = 'standard', options = {}) {
  const memory = managedIndexedDB();
  const storage = memoryStorage({
    [JOURNEY_PREFERENCES_KEY]: JSON.stringify({ format: 'JourneyPreferencesV1', difficulty }),
  });
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    assetDatabase: memory.indexedDB,
    seconds: '90',
    storage,
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
    ...options,
  });
  p.journeyBackend = createJourneyBackend(memory);
  p.preferencesStorage = storage;
  return p;
}

for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`real paired-board host loads the authored ${difficulty} opening with one original and equal rules`, async (t) => {
    const p = await setup(t, difficulty);
    assert.equal(p.$('race-journey-note').hidden, false);
    assert.equal(p.renders[0].levelId, 'first-return');
    assert.notEqual(p.renders[0], p.renders[1]);
    assert.equal(p.renders[0].lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
    assert.deepEqual(p.renders[0], p.renders[1]);
    assert.equal(p.renders[0].classId, 'scout');
    assert.equal(p.renders[0].level.rules.timeLimitSeconds, 0);
    assert.equal(p.$('race-time-field').hidden, true);
    assert.equal(p.$('race-clock').textContent, 'No countdown');
    assert.match(p.$('race-summary').textContent, /No race countdown/);
    assert.match(p.$('race-format-help').textContent, /No race countdown/);
    assert.doesNotMatch(p.$('race-format-help').textContent, /At the time limit/);
    assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
    assert.equal(p.drawOptions[0].backdrop.kind, 'candidate-picture');
    assert.equal(p.drawOptions[0].backdrop.assetRevision.id, 'horizon-first-return');
    p.$('race-start').click();
    await waitFor(() => {
      p.frame();
      return p.renders[0].status === 'running';
    });
    p.key('KeyS');
    p.key('ArrowDown');
    for (let tick = 0; tick < 1000 && p.renders[0].status !== 'won'; tick++) p.frame();
    p.key('KeyS', false);
    p.key('ArrowDown', false);
    assert.equal(p.renders[0].status, 'won');
    assert.equal(p.renders[1].status, 'won');
    assert.equal(p.renders[0].coverage, p.renders[1].coverage);
    assert.match(p.$('race-message').textContent, /Draw.*First clear/);
    const previous = p.renders[0],
      picture = p.drawOptions[0].backdrop;
    assert.equal(p.$('race-journey-next').hidden, false);
    p.$('race-journey-next').click();
    await waitFor(() => {
      p.frame();
      return p.renders[0] !== previous && p.renders[0].status === 'running';
    });
    assert.equal(p.renders[0].levelId, 'choose-your-share');
    assert.equal(p.renders[1].levelId, 'choose-your-share');
    assert.equal(
      p.$('race-preparation').hidden,
      true,
      'successful Next retires its checking message',
    );
    assert.equal(p.renders[0].lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
    assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
    assert.notEqual(p.drawOptions[0].backdrop, picture);
    assert.equal(p.drawOptions[0].backdrop.assetRevision.id, 'horizon-choose-your-share');
  });

test('authored Versus preserves both previous boards and original when Next artwork fails', async (t) => {
  let refuse = false;
  const p = await setup(t, 'standard', {
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/'))
        return refuse
          ? new Response('Unavailable', { status: 503 })
          : new Response(await readFile(url));
    },
  });
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  p.key('KeyS');
  p.key('ArrowDown');
  for (let tick = 0; tick < 1000 && p.renders[0].status !== 'won'; tick++) p.frame();
  p.key('KeyS', false);
  p.key('ArrowDown', false);
  const previous = [...p.renders],
    picture = p.drawOptions[0].backdrop;
  refuse = true;
  p.$('race-journey-next').click();
  await waitFor(() => p.$('race-preparation').dataset.state === 'error');
  p.frame(0);
  assert.equal(p.renders[0], previous[0]);
  assert.equal(p.renders[1], previous[1]);
  assert.equal(p.drawOptions[0].backdrop, picture);
  refuse = false;
  p.$('race-journey-next').click();
  await waitFor(() => {
    p.frame(0);
    return p.renders[0] !== previous[0] && !p.$('race-pause').disabled;
  });
  assert.equal(p.renders[0].levelId, 'choose-your-share');
});

test('Versus Skip requires two actions and flat chooser can launch an island mission', async (t) => {
  const p = await setup(t);
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  const previous = p.renders[0];
  p.$('race-journey-skip').click();
  p.frame(0);
  assert.equal(p.renders[0], previous);
  assert.equal(p.$('race-journey-skip').textContent, 'Confirm skip');
  p.$('race-journey-skip').click();
  await waitFor(() => {
    p.frame(0);
    return p.renders[0] !== previous && !p.$('race-pause').disabled;
  });
  assert.equal(p.renders[0].levelId, 'choose-your-share');
  p.$('race-journey-find').click();
  assert.equal(p.$('journey-chooser').open, true);
  const cards = p.$('journey-cards').children;
  assert.equal(cards.length, 10);
  assert.match(cards[0].textContent, /Skipped/);
  assert.doesNotMatch(cards[0].textContent, /Cleared/);
  const island = [...cards].find((card) => card.dataset.missionId.endsWith('/nearby-shore'));
  island.click();
  await waitFor(() => {
    p.frame(0);
    return p.renders[0].levelId === 'nearby-shore' && !p.$('race-pause').disabled;
  });
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.renders[0].coverage, 0);
  assert.equal(p.renders[1].coverage, 0);
});

test('controller can open and leave the flat chooser without starting or clearing a race', async (t) => {
  const controller = {
    index: 0,
    id: 'Journey controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
  };
  const p = await setup(t, 'standard', { pads: [controller] });
  p.join(0);
  p.focus('race-journey-find');
  p.pulse(0, 0);
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.$('journey-cards').children.length, 10);
  const card = p.$('journey-cards').children[0];
  assert.match(card.textContent, /Band 1\/12.*Standard.*Optional challenge/);
  card.focus();
  const raw = JSON.stringify({ format: 'JourneyPreferencesV1', difficulty: 'expert' });
  p.preferencesStorage.setItem(JOURNEY_PREFERENCES_KEY, raw);
  p.win.emit('storage', {
    key: JOURNEY_PREFERENCES_KEY,
    newValue: raw,
    storageArea: p.preferencesStorage,
  });
  assert.match(p.$('journey-cards').children[0].textContent, /Band 1\/12.*Expert/);
  assert.equal(p.doc.activeElement, p.$('journey-cards').children[0]);
  p.pulse(0, 1);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement, p.$('race-journey-find'));
  assert.equal(p.renders[0].tick, 0);
  assert.equal(p.renders[1].tick, 0);
});

test('authored races ignore the Legacy timer and do not mint an idle clear after ninety seconds', async (t) => {
  const p = await setup(t);
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  p.frames(451, 200);
  assert(p.renders.every((run) => run.status === 'running' && run.time > 90));
  assert.equal(p.$('race-clock').textContent, 'No countdown');
  assert.doesNotMatch(p.$('race-message').textContent, /Time/);
  assert.equal(p.$('race-journey-next').hidden, true);
  p.$('race-journey-find').click();
  assert.doesNotMatch(p.$('journey-cards').children[0].textContent, /Cleared/);
  assert.equal(p.renders[0].levelId, 'first-return');
});

test('Versus difficulty has truthful session-only export and retry without changing current boards', async (t) => {
  const p = await setup(t);
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  p.$('race-pause').click();
  const previous = [...p.renders],
    picture = p.drawOptions[0].backdrop;
  const storage = p.preferencesStorage,
    setItem = storage.setItem.bind(storage);
  let refuse = true,
    exported,
    exportFailure = true;
  storage.setItem = (key, value) => {
    if (refuse && key === JOURNEY_PREFERENCES_KEY) throw new Error('Quota test.');
    setItem(key, value);
  };
  t.mock.method(URL, 'createObjectURL', (blob) => {
    if (exportFailure) throw new Error('Download test.');
    exported = blob;
    return 'blob:journey-difficulty';
  });
  p.$('race-journey-difficulty').value = 'expert';
  p.$('race-journey-difficulty').onchange();
  assert.equal(p.$('race-journey-preferences-recovery').hidden, false);
  assert.match(
    p.$('race-journey-preferences-message').textContent,
    /only to this session.*Quota test/,
  );
  assert.equal(JSON.parse(storage.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'standard');
  p.$('race-journey-preferences-export').click();
  await waitFor(() =>
    p.$('race-journey-preferences-message').textContent.includes('Export failed'),
  );
  exportFailure = false;
  p.$('race-journey-preferences-export').click();
  await waitFor(() =>
    p.$('race-journey-preferences-message').textContent.includes('Download requested'),
  );
  assert.deepEqual(JSON.parse(await exported.text()), {
    format: 'JourneyPreferencesV1',
    difficulty: 'expert',
  });
  assert.equal(p.$('race-journey-preferences-recovery').hidden, false);
  refuse = false;
  p.$('race-journey-preferences-retry').focus();
  p.$('race-journey-preferences-retry').click();
  assert.equal(p.$('race-journey-preferences-recovery').hidden, true);
  assert.equal(p.doc.activeElement, p.$('race-journey-difficulty'));
  assert.equal(JSON.parse(storage.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'expert');
  p.frame(0);
  assert.equal(p.renders[0], previous[0]);
  assert.equal(p.renders[1], previous[1]);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.renders[0].lives, 3);
});

test('changed next-preset intent cancels a held race decode without retiring either active board', async (t) => {
  let held = false,
    entered = false,
    release;
  const images = [];
  class HeldImage {
    constructor() {
      images.push(this);
    }
    set src(value) {
      const bytes = Buffer.from(value.split(',')[1], 'base64');
      this.width = this.naturalWidth = bytes.readUInt32BE(16);
      this.height = this.naturalHeight = bytes.readUInt32BE(20);
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      if (held) {
        entered = true;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
    }
    removeAttribute() {
      this.released = (this.released ?? 0) + 1;
    }
  }
  const p = await setup(t, 'standard', { ImageClass: HeldImage });
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  const previous = [...p.renders],
    picture = p.drawOptions[0].backdrop;
  held = true;
  p.$('race-journey-skip').click();
  p.$('race-journey-skip').click();
  await waitFor(() => entered);
  const raw = JSON.stringify({ format: 'JourneyPreferencesV1', difficulty: 'expert' });
  p.preferencesStorage.setItem(JOURNEY_PREFERENCES_KEY, raw);
  p.win.emit('storage', {
    key: JOURNEY_PREFERENCES_KEY,
    newValue: raw,
    storageArea: p.preferencesStorage,
  });
  held = false;
  release();
  await waitFor(() => images.at(-1).released === 1);
  p.frame(0);
  assert.equal(p.renders[0], previous[0]);
  assert.equal(p.renders[1], previous[1]);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(picture.image.released, undefined);
  p.$('race-journey-skip').click();
  p.$('race-journey-skip').click();
  await waitFor(() => {
    p.frame(0);
    return p.renders[0] !== previous[0] && !p.$('race-pause').disabled;
  });
  assert.equal(p.renders[0].levelId, 'choose-your-share');
  assert.equal(p.renders[0].lives, 2);
  assert.equal(p.renders[1].lives, 2);
  assert.equal(picture.image.released, 1);
});

test('all nine authored Versus races continue directly, retain equal checkpoints and separate durable receipts', async (t) => {
  const p = await setup(t);
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  const rows = JSON.parse(
    await readFile(new URL('./fixtures/horizon-greybox-routes.json', import.meta.url)),
  ).rows;
  const keys = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  };
  const gesture = (direction) => {
    for (const key of keys[direction] ?? []) {
      p.key(key);
      p.key(key, false);
    }
  };
  for (const [id, , , segments] of rows.slice(0, 9)) {
    assert.equal(p.renders[0].levelId, id);
    const reference = createRun(p.renders[0].level, { seed: 1, classId: 'scout' });
    // Starting the paired-board host consumes one neutral input tick equally.
    stepRun(reference, { direction: null }, FIXED_DT);
    p.frame(FIXED_DT * 1000);
    for (const [direction, ticks] of segments) {
      gesture(direction);
      let frameTicks = 0;
      for (let tick = 0; tick < ticks; tick++) {
        stepRun(reference, { direction }, FIXED_DT);
        frameTicks++;
        const closure = reference.events.some((event) => event.type === 'capture.stopped');
        if (closure || frameTicks === 12 || tick === ticks - 1) {
          p.frame(frameTicks * FIXED_DT * 1000);
          frameTicks = 0;
          if (closure && tick < ticks - 1 && reference.status !== 'won') gesture(direction);
        }
      }
    }
    assert.equal(p.renders[0].status, 'won', id);
    assert.equal(p.renders[1].status, 'won', id);
    assert.equal(
      authoritativeCheckpoint(p.renders[0]).hash,
      authoritativeCheckpoint(reference).hash,
      id,
    );
    assert.equal(
      authoritativeCheckpoint(p.renders[0]).hash,
      authoritativeCheckpoint(p.renders[1]).hash,
      id,
    );
    assert.equal(p.$('journey-chooser').open, false);
    if (id !== 'long-way-home') {
      const previous = p.renders[0];
      p.$('race-journey-next').click();
      await waitFor(() => {
        p.frame(0);
        return p.renders[0] !== previous && !p.$('race-pause').disabled;
      });
    }
  }
  assert.equal(p.$('race-journey-next').hidden, true);
  assert.equal(p.renders[0].levelId, 'long-way-home');
  let persisted;
  for (let attempt = 0; attempt < 200; attempt++) {
    persisted = await p.journeyBackend.read();
    if (Object.keys(persisted.clears.versus).length === 9) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(Object.keys(persisted.clears.versus).length, 9);
  assert.equal(Object.keys(persisted.clears.solo).length, 0);
  assert.equal(Object.keys(persisted.clears.team).length, 0);
});
