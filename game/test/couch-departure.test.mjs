import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCouchShell } from '../couch/couch-shell.mjs';
import { createDuel, pauseDuel, resumeDuel } from '../multiplayer.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const press = (f, key, extra = {}) => {
  const target = f.doc.activeElement;
  const event = target.emit('keydown', { key, code: key, repeat: false, ...extra });
  // This finite DOM does not synthesize native activation. Preserve the shared
  // handler's actual prevention, then model only a focused anchor's Enter default.
  if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'A') target.click();
  return event;
};
const pad = () => ({
  index: 0,
  id: 'Departure pad',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
});
const routes = [
  ['race-coop', 'relay-rescue.html?return=versus'],
  ['race-solo-return', '../'],
];

for (const [id, href] of routes) {
  test(`paused ${id} requires a fresh fixed decision and Stay retains both flights`, async (t) => {
    const f = await couchPage(t, { turnPolicy: 'grid-center' });
    f.$('race-start').click();
    f.frame();
    f.key('KeyD');
    f.key('ArrowLeft');
    f.frames(5);
    f.key('KeyS');
    f.key('ArrowUp');
    f.$('race-pause').click();
    const before = f.checkpoint();
    const refs = [...f.renders];
    f.focus(id);
    press(f, 'Enter');
    assert.equal(f.$('race-leave-panel').hidden, false);
    assert.equal(f.doc.activeElement.id, 'race-leave-back');
    assert.match(f.$('race-leave-copy').textContent, /not saved.*paused.*discards/);
    f.frames(12, 100);
    assert.deepEqual(f.checkpoint(), before);
    assert.ok(f.renders.every((run, i) => run === refs[i]));
    press(f, 'Tab');
    assert.equal(f.doc.activeElement.id, 'race-leave');
    assert.equal(f.$('race-leave').getAttribute('href'), href);
    assert.equal(press(f, 'Enter', { repeat: true }).defaultPrevented, true);
    press(f, 'Escape');
    assert.equal(f.doc.activeElement.id, id);
    assert.equal(f.$('race-leave-panel').hidden, true);
    assert.equal(
      f.$('race-leave').emit('click').defaultPrevented,
      true,
      'closed decision cannot depart',
    );
    assert.deepEqual(f.checkpoint(), before);
    f.$(id).click();
    f.$('race-leave').setAttribute('href', 'https://untrusted.invalid/');
    assert.equal(f.$('race-leave').emit('click').defaultPrevented, false);
    assert.equal(
      f.$('race-leave').getAttribute('href'),
      href,
      'native default uses only the fixed route',
    );
    assert.deepEqual(
      f.checkpoint(),
      before,
      'permitted native navigation does not change either core',
    );
    f.$('race-leave-back').click();
    f.$('race-start').click();
    f.frame();
    assert.equal(f.state(), 'running', 'only a separate Resume resumes');
  });
}

test('controller Team departure has its own neutral boundary and East returns to the in-panel opener', async (t) => {
  const f = await couchPage(t, { pads: [pad()] });
  f.$('race-start').click();
  f.frame();
  f.frames(3);
  f.$('race-pause').click();
  f.join(0);
  f.focus('race-coop');
  f.button(0, 0, true);
  f.frame();
  assert.equal(f.$('race-leave-panel').hidden, false);
  assert.equal(f.doc.activeElement.id, 'race-leave-back');
  const before = f.checkpoint();
  let permitted = 0;
  f.$('race-leave').addEventListener('click', (event) => {
    if (!event.defaultPrevented) permitted++;
  });
  f.frames(20);
  assert.equal(permitted, 0);
  assert.deepEqual(f.checkpoint(), before);
  f.button(0, 0, false);
  f.frame();
  f.pulse(0, 1);
  assert.equal(f.doc.activeElement.id, 'race-coop');
  assert.equal(f.state(), 'paused');
  f.pulse(0, 0);
  f.focus('race-leave');
  f.pulse(0, 0);
  assert.equal(permitted, 1, 'fresh explicit Confirm reaches the fixed native anchor');
  assert.deepEqual(f.checkpoint(), before);
});

for (const reason of ['blur', 'hidden', 'pagehide', 'controller-loss']) {
  test(`${reason} invalidates pending Versus departure without resuming or choosing a destination`, async (t) => {
    const f = await couchPage(t, { pads: [pad()] });
    f.$('race-start').click();
    f.frame();
    f.frames(4);
    f.$('race-pause').click();
    f.$('race-coop').click();
    const before = f.checkpoint();
    if (reason === 'blur') {
      f.doc.focused = false;
      f.win.emit('blur');
    } else if (reason === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    } else if (reason === 'pagehide') f.win.emit('pagehide', { persisted: true });
    else f.win.emit('gamepaddisconnected', { gamepad: f.pads()[0] });
    assert.equal(f.$('race-leave-panel').hidden, true);
    assert.equal(f.$('race-leave').emit('click').defaultPrevented, true);
    f.frames(8);
    assert.deepEqual(f.checkpoint(), before);
    assert.equal(f.state(), 'paused');
  });
}

test('a real terminal draw keeps both destination links direct and does not start another round', async (t) => {
  const campaign = JSON.parse(
    await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  );
  campaign.levels = [retryFixture('enemy-player').level];
  const f = await couchPage(t, { campaign });
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.key('ArrowRight');
  f.frames(60);
  assert.equal(f.state(), 'finished');
  const before = f.checkpoint();
  for (const [id, href] of routes) {
    assert.equal(f.$(id).emit('click').defaultPrevented, false);
    assert.equal(f.$(id).getAttribute('href'), href);
    assert.equal(f.$('race-leave-panel').hidden, true);
    assert.deepEqual(f.checkpoint(), before);
  }
});

// Inject only the host identity reader for adversarial currentness. The shell
// mounts real HTML and observes a real duel; it cannot replace the host's core.
async function shellFixture(t) {
  const doc = new Document();
  mountCouch(doc, await readFile(new URL('../couch/index.html', import.meta.url), 'utf8'));
  const level = retryFixture('enemy-player').level;
  let match = createDuel(level),
    generation = 1;
  resumeDuel(match);
  pauseDuel(match);
  const shell = createCouchShell({
    document: doc,
    getDepartureState: () => ({ match, generation }),
  });
  shell.update({ match, summary: 'Identity fixture', won: [0, 0] });
  t.after(() => shell.destroy());
  return {
    doc,
    shell,
    $: (id) => doc.getElementById(id),
    replace() {
      const next = createDuel(level);
      resumeDuel(next);
      pauseDuel(next);
      match = next;
    },
    advanceGeneration() {
      generation++;
    },
    resume() {
      resumeDuel(match);
    },
  };
}
for (const change of ['replace', 'advanceGeneration', 'resume']) {
  test(`confirmation re-reads actual ${change} before allowing native departure`, async (t) => {
    const f = await shellFixture(t);
    f.$('race-coop').click();
    assert.equal(f.shell.scope(), 'leave');
    f[change]();
    assert.equal(f.$('race-leave').emit('click').defaultPrevented, true);
    assert.equal(f.$('race-leave-panel').hidden, true);
  });
}
