import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { journeyMissionId } from '../journey/catalog.mjs';
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
const known = journeyMissionId({
  source: 'candidate',
  packId: 'journey-opening',
  campaignId: 'prologue',
  levelId: 'first-return',
});
async function setup(t, { route = 'opening', events = [], denied = false, readPads } = {}) {
  const memory = managedIndexedDB(),
    backend = createJourneyBackend(memory);
  if (events.length) await backend.commit(events);
  const before = await backend.read();
  const p = await soloPage(t, {
    search: `?journey=${route}`,
    titleScreen: true,
    ...(readPads ? { readPads } : {}),
    storage: memoryStorage(),
    journeyIndexedDB: denied
      ? {
          open() {
            throw Error('Storage denied');
          },
        }
      : memory.indexedDB,
    pictures: { Image: CandidateImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  return { p, backend, before };
}
async function activate(p, id, level) {
  assert.equal(p.$(id).hidden, false, 'The primary action must actually be visible.');
  p.$(id).focus();
  p.$(id).click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  assert.equal(p.rendered.run.levelId, level);
  assert.equal(p.$('shell-home').open, false);
  assert.equal(p.$('shell-missions').open, false);
  assert.deepEqual(p.errors, []);
}
for (const route of ['opening', 'authored'])
  test(`${route}: fresh Journey offers Start and starts the named mission directly`, async (t) => {
    const { p, backend, before } = await setup(t, { route });
    assert.equal(p.$('shell-featured').hidden, false);
    assert.equal(p.$('shell-continue').hidden, true);
    assert.equal(p.doc.activeElement, p.$('shell-featured'), 'Boot focuses Start, not Difficulty.');
    assert.match(p.$('shell-destination').textContent, /Start · First return/);
    assert.deepEqual(await backend.read(), before, 'Rendering a fresh title grants no progress.');
    await activate(p, 'shell-featured', 'first-return');
  });
for (const completed of [false, true])
  test(`known ${completed ? 'completed' : 'selected'} Solo progress remains Continue`, async (t) => {
    const events = [{ type: 'select', mode: 'solo', missionId: known }];
    if (completed)
      events.push({
        type: 'complete',
        mode: 'solo',
        missionId: known,
        runId: 'retained-run',
        gameplayId: 'retained-gameplay',
        difficulty: 'standard',
      });
    const { p, backend, before } = await setup(t, { events });
    assert.equal(p.$('shell-featured').hidden, true);
    assert.equal(p.$('shell-continue').hidden, false);
    assert.equal(p.doc.activeElement, p.$('shell-continue'), 'Boot focuses the retained Continue.');
    assert.deepEqual(await backend.read(), before);
    await activate(p, 'shell-continue', completed ? 'choose-your-share' : 'first-return');
    if (completed) assert.equal((await backend.read()).clears.solo[known].runId, 'retained-run');
  });
test('unknown retained cursor is preserved without falsely presenting fallback as Continue', async (t) => {
  const { p, backend, before } = await setup(t, {
    events: [{ type: 'select', mode: 'solo', missionId: 'future/unknown/mission' }],
  });
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.deepEqual(await backend.read(), before);
  await activate(p, 'shell-featured', 'first-return');
});
test('Versus progress alone does not turn a first Solo visit into Continue', async (t) => {
  const { p, backend, before } = await setup(t, {
    events: [{ type: 'select', mode: 'versus', missionId: known }],
  });
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.deepEqual(await backend.read(), before);
  await activate(p, 'shell-featured', 'first-return');
  assert.equal((await backend.read()).cursors.versus, known);
});
test('denied Journey storage still offers truthful one-action Start', async (t) => {
  const { p } = await setup(t, { denied: true });
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.equal(p.$('journey-save-status').hidden, false);
  await activate(p, 'shell-featured', 'first-return');
});

for (const route of ['opening', 'authored'])
  test(`${route}: cold controller discovery and fresh A launch the actual Journey entry`, async (t) => {
    const pad = {
      index: 0,
      id: 'Steam Deck Controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    let connected = false;
    const { p, backend, before } = await setup(t, {
      route,
      readPads: () => (connected ? [pad] : []),
    });
    const release = () => {
      for (const b of pad.buttons) {
        b.pressed = false;
        b.value = 0;
      }
      p.frame();
      p.frame();
    };
    const press = (index) => {
      release();
      pad.buttons[index].pressed = true;
      pad.buttons[index].value = 1;
      p.frame();
    };
    connected = true;
    pad.buttons[0].pressed = true;
    pad.buttons[0].value = 1;
    p.frame();
    assert.equal(p.$('shell-home').open, true, 'A held during discovery cannot launch');
    assert.deepEqual(await backend.read(), before, 'Discovery cannot grant progress');
    press(0);
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    assert.equal(p.$('shell-home').open, false);
    assert.equal(p.rendered.run.levelId, 'first-return');
    assert.equal(p.rendered.run.player.speed, 0, 'Confirm does not become a flight command');
    press(9);
    assert.equal(p.doc.body.dataset.flightState, 'paused');
    const tick = p.rendered.run.tick;
    release();
    p.frame();
    assert.equal(p.rendered.run.tick, tick);
    press(0);
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    assert.equal(p.rendered.run.levelId, 'first-return');
    assert.deepEqual(p.errors, []);
  });

test('reveal progress retains explicit percent units and updates after a real capture', async (t) => {
  const { p } = await setup(t);
  await activate(p, 'shell-featured', 'first-return');
  const meter = p.$('coverage');
  assert.equal(meter.getAttribute('role'), 'progressbar');
  assert.equal(meter.getAttribute('aria-label'), 'Picture revealed');
  assert.equal(meter.getAttribute('aria-valuemin'), '0');
  assert.equal(meter.getAttribute('aria-valuemax'), '100');
  assert.equal(Number(meter.getAttribute('aria-valuenow')), 0);
  assert.match(meter.getAttribute('aria-valuetext'), /0\.0 percent revealed; target \d+ percent/);
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let frame = 0; frame < 600 && p.rendered.run.coverage === 0; frame++) p.frame();
  assert.ok(p.rendered.run.coverage > 0, 'The real command closes a cut');
  const revealed = (p.rendered.run.coverage * 100).toFixed(1);
  assert.equal(meter.getAttribute('aria-valuenow'), revealed);
  assert.ok(meter.getAttribute('aria-valuetext').startsWith(`${revealed} percent revealed;`));
  assert.equal(meter.textContent, `${revealed}%`);
  assert.deepEqual(p.errors, []);
});

// Drive actual captures and results using only fresh modeled controller edges.
test('controller-only authored win, Retry, second win and Next retain one deliberate activation per scope', async (t) => {
  const pad = {
    index: 0,
    id: 'Steam Deck Controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const { p, backend } = await setup(t, { readPads: () => [pad] });
  const release = () => {
    pad.axes.fill(0);
    for (const b of pad.buttons) {
      b.pressed = false;
      b.value = 0;
    }
    p.frame();
    p.frame();
  };
  const press = (i) => {
    release();
    pad.buttons[i].pressed = true;
    pad.buttons[i].value = 1;
    p.frame();
  };
  const advance = async () => {
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
  };
  const win = async () => {
    press(13);
    release();
    for (let i = 0; i < 600 && p.rendered.run.status !== 'won'; i++) p.frame();
    assert.equal(
      p.rendered.run.status,
      'won',
      'A single direction command completes the real opening capture',
    );
    for (
      let i = 0;
      i < 3 && (p.$('game-overlay').hidden || p.$('game-overlay').dataset.kind !== 'won');
      i++
    ) {
      press(0);
      release();
      await new Promise((resolve) => setImmediate(resolve));
    }
    await settle(() => {
      p.frame(0);
      return !p.$('game-overlay').hidden && p.$('game-overlay').dataset.kind === 'won';
    });
    release();
  };
  press(0);
  await advance();
  release();
  assert.equal(p.rendered.run.levelId, 'first-return');
  await win();
  for (let i = 0; i < 10 && p.doc.activeElement !== p.$('retry-button'); i++) press(13);
  assert.equal(p.doc.activeElement, p.$('retry-button'), 'D-pad reaches Retry');
  press(0);
  await advance();
  assert.equal(p.rendered.run.levelId, 'first-return');
  assert.equal(p.rendered.run.coverage, 0);
  assert.equal(p.rendered.run.player.speed, 0, 'Held Confirm never becomes flight movement');
  release();
  await win();
  for (let i = 0; i < 10 && p.doc.activeElement !== p.$('next-button'); i++) press(12);
  assert.equal(p.doc.activeElement, p.$('next-button'), 'D-pad reaches Next');
  press(0);
  await advance();
  assert.equal(p.rendered.run.levelId, 'choose-your-share');
  assert.equal(p.rendered.run.coverage, 0);
  assert.equal(p.rendered.run.player.speed, 0);
  assert.ok((await backend.read()).clears.solo[known]);
  assert.deepEqual(p.errors, []);
});
