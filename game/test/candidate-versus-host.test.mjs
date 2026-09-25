import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend, JOURNEY_PROFILE_DATABASE } from '../journey/profile.mjs';
import { CLASSES } from '../core/index.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { expectedRouteEvidence } from './helpers/route-evidence.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

async function setup(t, difficulty = 'standard', options = {}) {
  const memory = managedIndexedDB();
  const databases = new Map([[JOURNEY_PROFILE_DATABASE, memory]]);
  const storage = memoryStorage({
    [JOURNEY_PREFERENCES_KEY]: JSON.stringify({ format: 'JourneyPreferencesV1', difficulty }),
  });
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    assetDatabase: {
      open(name, ...args) {
        if (!databases.has(name)) databases.set(name, managedIndexedDB());
        return databases.get(name).indexedDB.open(name, ...args);
      },
    },
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
async function openMissions(p) {
  p.$('race-journey-find').click();
  try {
    await waitFor(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  } catch (error) {
    error.message += ` ${p.$('race-message').textContent}`;
    throw error;
  }
  p.$('journey-collection').value = 'Journey';
  p.$('journey-collection').emit('change');
}

test('Versus save warning uses existing pause and recovery without changing either board', async (t) => {
  const p = await setup(t, 'standard', { assetDatabase: undefined });
  const reveals = [];
  t.mock.method(p.$('race-start'), 'scrollIntoView', (options) => reveals.push(options));
  assert.equal(p.$('race-journey-save').parentNode, p.$('race-main'));
  assert.equal(p.$('race-journey-save').hidden, false);
  assert.equal(p.$('race-journey-save-options').hidden, false);
  assert.equal(p.$('race-pause').dataset.journeyUnsaved, 'true');
  p.$('race-start').focus();
  p.key('Escape');
  p.key('Escape', false);
  assert.deepEqual(reveals.at(-1), { block: 'nearest', inline: 'nearest', behavior: 'auto' });
  p.$('race-start').click();
  await waitFor(() => {
    p.frame();
    return !p.$('race-pause').disabled;
  });
  assert.equal(p.$('race-main').hidden, true);
  p.$('race-pause').click();
  p.frame(0);
  assert.deepEqual(reveals.at(-1), { block: 'center', inline: 'nearest', behavior: 'auto' });
  const previous = [...p.renders],
    checkpoint = p.checkpoint();
  p.$('race-journey-save-options').click();
  assert.equal(p.doc.activeElement, p.$('race-journey-save-retry'));
  assert.equal(p.state(), 'paused');
  p.$('race-journey-save-retry').click();
  await waitFor(() => !p.$('race-journey-save').hidden);
  assert.deepEqual(p.renders, previous);
  p.frames(30);
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.equal(p.state(), 'paused');
  p.$('race-start').click();
  p.frame();
  assert.equal(p.renders[0].status, 'running');
  assert.equal(p.renders[1].status, 'running');
});

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
    assert.equal(p.$('race-clock').dataset.compact, '∞');
    assert.equal(p.$('race-summary').textContent, 'One race · First return');
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

test('cross-campaign theme controls commit with the accepted picture, never a failed preparation', async (t) => {
  let refuse = true;
  const p = await setup(t, 'standard', {
    href: 'http://localhost/game/couch/?journey=authored',
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) {
        if (refuse && String(url).includes('/border-'))
          return new Response('Offline', { status: 503 });
        return new Response(await readFile(url));
      }
    },
  });
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  const previous = [...p.renders],
    picture = p.drawOptions[0].backdrop;
  const chooseBorder = async () => {
    await openMissions(p);
    p.$('journey-cards')
      .children.find((card) => JSON.parse(card.dataset.missionId)[3].endsWith('/behind-the-patrol'))
      .click();
    await waitFor(() => p.$('race-library-replace')?.open);
    p.$('race-library-play').click();
  };
  assert.equal(p.$('race-theme').value, 'horizon');
  await chooseBorder();
  await waitFor(() => p.$('race-preparation').dataset.state === 'error');
  p.frame(0);
  assert.equal(p.renders[0], previous[0]);
  assert.equal(p.renders[1], previous[1]);
  assert.equal(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('race-theme').value, 'horizon');
  assert.deepEqual(
    p.$('race-theme').children.map((option) => option.value),
    ['horizon'],
  );
  refuse = false;
  await chooseBorder();
  await waitFor(() => {
    p.frame(0);
    return p.renders[0].levelId === 'behind-the-patrol' && !p.$('race-pause').disabled;
  });
  assert.equal(p.renders[1].levelId, 'behind-the-patrol');
  assert.equal(p.$('race-theme').value, 'border-bloom');
  assert.deepEqual(
    p.$('race-theme').children.map((option) => option.value),
    ['border-bloom'],
  );
  assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
  assert.notEqual(p.drawOptions[0].backdrop, picture);
  assert.equal(p.$('journey-chooser').open, false);
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
  await openMissions(p);
  assert.equal(p.$('journey-chooser').open, true);
  const cards = p.$('journey-cards').children;
  assert.equal(cards.length, 10);
  assert.match(cards[0].textContent, /Skipped/);
  assert.doesNotMatch(cards[0].textContent, /Cleared/);
  const island = [...cards].find((card) =>
    JSON.parse(card.dataset.missionId)[3].endsWith('/nearby-shore'),
  );
  island.click();
  await waitFor(() => p.$('race-library-replace')?.open);
  p.$('race-library-play').click();
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
  await waitFor(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  p.frame(); // The asynchronously mounted scope observes a neutral controller frame.
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(
    p.$('journey-cards').children.length,
    198,
    'the complete 66-mission opening catalogue exposes all three difficulty cards',
  );
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
  assert.equal(p.$('race-clock').dataset.compact, '∞');
  assert.doesNotMatch(p.$('race-message').textContent, /Time/);
  assert.equal(p.$('race-journey-next').hidden, true);
  await openMissions(p);
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

for (const route of ['opening', 'authored'])
  test(`${route} Versus races continue across all campaigns with equal checkpoints and separate receipts`, async (t) => {
    const p = await setup(t, 'standard', { href: `http://localhost/game/couch/?journey=${route}` });
    p.$('race-start').click();
    await waitFor(() => {
      p.frame(0);
      return !p.$('race-pause').disabled;
    });
    const fixture = JSON.parse(
      await readFile(new URL('./fixtures/candidate-solo-tuned-host-routes.json', import.meta.url)),
    );
    const rows = fixture.rows.slice(0, route === 'opening' ? 9 : 15);
    const project = compileContentProject(createAuthoredJourneyRoute(route).source);
    for (const [id, authoredIdentity, gameplayIdentity, , segments] of rows) {
      assert.equal(p.renders[0].levelId, id);
      const manifest = resolveMission(project, id);
      assert.equal(manifest.simulationIdentity, authoredIdentity);
      const level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
      for (const run of p.renders) {
        assert.deepEqual(run.level, level);
        assert.equal(
          dataIdentity({ ruleset: run.ruleset, level, classes: CLASSES }),
          gameplayIdentity,
        );
      }
      assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
      assert.deepEqual(p.drawOptions[0].backdrop.assetRevision, manifest.background);
      playKeyboardRoute(
        p,
        () => p.renders,
        [
          { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
          { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
        ],
        {
          seed: 1,
          turnPolicy: 'immediate',
          evidence: expectedRouteEvidence(fixture.evidence, id),
          segments: segments.map(([direction, ticks]) => ({ direction, ticks })),
        },
      );
      assert.equal(p.renders[0].status, 'won', id);
      assert.equal(p.renders[1].status, 'won', id);
      assert.equal(
        authoritativeCheckpoint(p.renders[0]).hash,
        authoritativeCheckpoint(p.renders[1]).hash,
        id,
      );
      assert.equal(p.$('journey-chooser')?.open ?? false, false);
      if (id !== rows.at(-1)[0]) {
        const previous = p.renders[0];
        p.$('race-journey-next').click();
        await waitFor(() => {
          p.frame(0);
          return p.renders[0] !== previous && !p.$('race-pause').disabled;
        });
      }
    }
    assert.equal(p.$('race-journey-next').hidden, false);
    assert.equal(p.$('race-journey-next').textContent, 'Browse missions');
    assert.equal(p.renders[0].levelId, rows.at(-1)[0]);
    assert.match(
      p.$('race-message').textContent,
      /End of the main Journey.*Browse missions.*Rematch/,
    );
    let persisted;
    for (let attempt = 0; attempt < 200; attempt++) {
      persisted = await p.journeyBackend.read();
      if (Object.keys(persisted.clears.versus).length === rows.length) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(Object.keys(persisted.clears.versus).length, rows.length);
    assert.equal(Object.keys(persisted.clears.solo).length, 0);
    assert.equal(Object.keys(persisted.clears.team).length, 0);
    const receipts = Object.entries(persisted.clears.versus);
    for (const [id, , gameplayIdentity] of rows) {
      const [, receipt] = receipts.find(([missionId]) => missionId.endsWith('/' + id));
      assert.equal(receipt.gameplayId, gameplayIdentity);
      assert.equal(receipt.difficulty, 'standard');
    }
    assert.equal(new Set(receipts.map(([, receipt]) => receipt.runId)).size, rows.length);
    assert.deepEqual(persisted.skipped.versus, []);
    const previous = [...p.renders],
      pictures = p.drawOptions.map((options) => options.backdrop),
      checks = p.checkpoint();
    p.$('race-journey-next').focus();
    p.$('race-journey-next').click();
    await waitFor(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
    p.frame(0);
    assert(p.renders.every((run, index) => run === previous[index]));
    assert.deepEqual(p.checkpoint(), checks);
    assert(p.drawOptions.every((options, index) => options.backdrop === pictures[index]));
    p.$('journey-back').click();
    assert.equal(p.doc.activeElement, p.$('race-journey-next'));
    assert.deepEqual((await p.journeyBackend.read()).clears, persisted.clears);
  });
