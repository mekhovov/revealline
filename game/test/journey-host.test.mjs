import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { journeyMissionId } from '../journey/catalog.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'journey-fixture',
  revision: '1',
  title: 'Journey flow fixture',
  levels: Array.from({ length: 11 }, (_, i) => ({
    ...retryFixture('self-contact').level,
    id: `cut-${i + 1}`,
    name: `Cut ${i + 1}`,
    goal: { coverage: 0.1 },
    rules: { lives: 1 },
  })),
};
const running = (p, levelId) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === levelId;
  });
async function setup(t, options = {}) {
  const memory = managedIndexedDB();
  const p = await soloPage(t, {
    campaign,
    search: '?journey=1',
    titleScreen: true,
    journeyIndexedDB: memory.indexedDB,
    ...options,
  });
  p.$('shell-featured').click();
  await running(p, 'cut-1');
  return { p, backend: createJourneyBackend(memory) };
}
function win(p) {
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  assert.equal(p.$('next-button').hidden, false);
  assert.equal(p.$('skip-celebration').hidden, true);
}

test('Journey ten consecutive mission clears need only Next and retain exact progress', async (t) => {
  const { p, backend } = await setup(t);
  for (let i = 1; i <= 10; i++) {
    win(p);
    assert.equal(p.$('journey-chooser').open, false);
    p.$('next-button').click();
    await running(p, `cut-${i + 1}`);
    assert.equal(p.$('game-overlay').hidden, true);
    assert.equal(p.$('shell-home').open, false);
    assert.equal(p.$('shell-missions').open, false);
  }
  const profile = await backend.read();
  assert.equal(Object.keys(profile.clears.solo).length, 10);
  assert.equal(
    profile.cursors.solo,
    journeyMissionId({ campaignId: campaign.id, levelId: 'cut-11' }),
  );
  assert.deepEqual(p.errors, []);
});

test('Journey Skip is two activations, grants no clear, and the global chooser can return', async (t) => {
  const { p, backend } = await setup(t);
  p.$('journey-skip').click();
  p.frame(0);
  assert.equal(p.rendered.run.levelId, 'cut-1');
  assert.equal(p.$('journey-skip').textContent, 'Confirm skip');
  p.$('journey-skip').click();
  await running(p, 'cut-2');
  await settle(() => p.$('journey-skip').textContent === 'Skip mission');
  await new Promise((resolve) => setImmediate(resolve));
  const profile = await backend.read();
  assert.equal(Object.keys(profile.clears.solo).length, 0);
  assert.equal(profile.skipped.solo.length, 1);
  p.$('shell-packs').click();
  assert.equal(p.$('journey-chooser').open, true);
  p.$('journey-search').emit('cancel');
  assert.equal(p.$('journey-chooser').open, true, 'a child cancellation cannot close the chooser');
  p.$('journey-search').value = 'Cut 1';
  p.$('journey-search').emit('input');
  const card = p
    .$('journey-cards')
    .children.find((node) => node.dataset.missionId.endsWith('/cut-1'));
  assert.ok(card);
  card.click();
  await running(p, 'cut-1');
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('Journey Continue uses stable progress with no release-specific bookmark or saved flight', async (t) => {
  const memory = managedIndexedDB();
  const backend = createJourneyBackend(memory);
  const missionId = journeyMissionId({ campaignId: campaign.id, levelId: 'cut-3' });
  await backend.commit([
    { type: 'select', mode: 'solo', missionId },
    {
      type: 'complete',
      mode: 'solo',
      missionId,
      runId: 'previous-edition-run',
      gameplayId: 'previous-edition-gameplay',
      difficulty: 'standard',
    },
  ]);
  const p = await soloPage(t, {
    campaign,
    search: '?journey=1',
    titleScreen: true,
    journeyIndexedDB: memory.indexedDB,
  });
  assert.equal(p.$('continue-saved').hidden, true);
  assert.equal(p.$('shell-continue').hidden, false);
  p.$('shell-continue').click();
  await running(p, 'cut-4');
  assert.equal((await backend.read()).clears.solo[missionId].runId, 'previous-edition-run');
  assert.deepEqual(p.errors, []);
});

test('Journey storage failure reports session-only progress without preventing Skip and play', async (t) => {
  const { p } = await setup(t, {
    journeyIndexedDB: {
      open() {
        throw new Error('Storage denied by browser');
      },
    },
  });
  assert.equal(p.$('journey-save-status').hidden, false);
  assert.match(p.$('journey-save-message').textContent, /session-only/);
  p.$('journey-skip').click();
  p.$('journey-skip').click();
  await running(p, 'cut-2');
  assert.equal(p.$('journey-save-status').hidden, false);
  assert.deepEqual(p.errors, []);
});

test('Journey total defeat starts a fresh attempt without a menu confirmation', async (t) => {
  const { p } = await setup(t);
  const original = p.rendered.run;
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 30; i++) p.frame();
  p.key('ArrowUp');
  p.key('ArrowUp', false);
  for (let i = 0; i < 5; i++) p.frame();
  assert.equal(original.status, 'lost');
  for (let i = 0; i < 100; i++) p.frame();
  await running(p, 'cut-1');
  assert.notEqual(p.rendered.run, original);
  assert.equal(p.rendered.run.lives, 1);
  assert.equal(p.$('game-overlay').hidden, true);
  assert.deepEqual(p.errors, []);
});

for (const cancel of ['button', 'Escape'])
  test(`Journey cold-load ${cancel} cancellation is immediate and a late failure cannot replace a newer choice`, async (t) => {
    let resolveDownload;
    const { p } = await setup(t, {
      fetchResponse: (url) => {
        if (url === 'content/packs/fpv-arcade-r5.json')
          return new Promise((resolve) => {
            resolveDownload = resolve;
          });
      },
    });
    const original = p.rendered.run;
    p.$('shell-packs').click();
    p.$('journey-search').value = 'Orchard Crossing';
    p.$('journey-search').emit('input');
    p.$('journey-cards').children[0].click();
    await settle(() => !!resolveDownload);
    assert.equal(p.$('flight-preparation-cancel').hidden, false);
    if (cancel === 'button') p.$('flight-preparation-cancel').click();
    else {
      p.key('Escape');
      p.key('Escape', false);
    }
    p.frame(0);
    assert.equal(p.rendered.run, original);
    p.$('shell-packs').click();
    p.$('journey-search').value = 'Cut 3';
    p.$('journey-search').emit('input');
    p.$('journey-cards').children[0].click();
    await running(p, 'cut-3');
    const next = p.rendered.run;
    const warning = p.$('run-message').textContent;
    resolveDownload({ ok: false, status: 503 });
    await new Promise((resolve) => setImmediate(resolve));
    p.frame(0);
    assert.equal(p.rendered.run, next);
    assert.equal(p.$('run-message').textContent, warning);
    assert.equal(p.$('flight-preparation-cancel').hidden, true);
    assert.deepEqual(p.errors, []);
  });

test('Journey campaign-boundary Next keeps a result on failed download and retries into the next pack', async (t) => {
  let failing = true;
  // Models only image decode completion; browser/pixel evidence is separate.
  class Picture {
    constructor() {
      this.naturalWidth = this.naturalHeight = 1;
    }
    set src(value) {
      this.url = value;
      if (value?.startsWith('data:')) {
        const header = inspectImageDataUrl(value);
        this.naturalWidth = header.width;
        this.naturalHeight = header.height;
      }
      if (value) queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this.url;
    }
    decode() {
      return Promise.resolve();
    }
    removeAttribute() {
      this.url = '';
    }
  }
  const { p } = await setup(t, {
    pictures: { Image: Picture },
    fetchResponse: (url) => {
      if (url === 'content/packs/fpv-arcade-r5.json' && failing) return { ok: false, status: 503 };
    },
  });
  p.$('shell-packs').click();
  p.$('journey-search').value = 'Cut 11';
  p.$('journey-search').emit('input');
  p.$('journey-cards').children[0].click();
  await running(p, 'cut-11');
  win(p);
  const result = p.rendered.run;
  p.$('next-button').click();
  await settle(() => p.$('run-message').textContent.includes('Could not open the next mission'));
  p.frame(0);
  assert.equal(p.rendered.run, result);
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  failing = false;
  p.$('next-button').click();
  try {
    // This cold boundary includes the original-picture inventory verification,
    // observed still active after the ordinary 5s host wait. Not a warm UX claim.
    await waitFor(
      () => {
        p.frame(0);
        return p.rendered.run !== result && p.doc.body.dataset.flightState === 'running';
      },
      { timeoutMs: 30000, message: 'Cold cross-pack original verification did not finish.' },
    );
  } catch (error) {
    error.message += JSON.stringify({
      state: p.doc.body.dataset.flightState,
      run: p.rendered.run.levelId,
      message: p.$('run-message').textContent,
      preparation: p.$('flight-preparation-status').textContent,
      content: p.$('content-select-status').textContent,
      errors: p.errors.map(String),
    });
    throw error;
  }
  assert.equal(p.$('pack-select').value, 'fpv-arcade-r5');
  assert.equal(p.$('game-overlay').hidden, true);
  assert.deepEqual(p.errors, []);
});
