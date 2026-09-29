import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { earnTeamVictory, teamHud, teamImage } from './helpers/coop-win.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

const won = 'Team objective complete. Your shared result is ready.';
const lost = 'Team attempt ended. Choose Retry or Change setup.';
const options = { nativeFocus: true, nativeVisibility: true, capturePaint: true };

function messages(t, f) {
  const node = f.$('coop-message-text');
  const own = Object.getOwnPropertyDescriptor(node, 'textContent');
  let prototype = node;
  while (!Object.getOwnPropertyDescriptor(prototype, 'textContent'))
    prototype = Object.getPrototypeOf(prototype);
  const original = Object.getOwnPropertyDescriptor(prototype, 'textContent');
  const writes = [],
    terminalFrames = [];
  Object.defineProperty(node, 'textContent', {
    configurable: true,
    get() {
      return original.get.call(this);
    },
    set(value) {
      writes.push(String(value));
      original.set.call(this, value);
    },
  });
  t.after(() => {
    if (own) Object.defineProperty(node, 'textContent', own);
    else delete node.textContent;
  });
  const tick = f.tick;
  f.tick = (...args) => {
    const start = writes.length;
    tick(...args);
    if (!f.$('coop-overlay').hidden && f.$('coop-resume').hidden)
      terminalFrames.push(writes.slice(start));
  };
  return { writes, terminalFrames };
}

for (const level of ['first-connection', 'relay-yard']) {
  test(`${level}: earned win replaces active captions before announcing Results; Retry restores active guidance`, async (t) => {
    const f = await page(t, options);
    if (level !== 'first-connection') await f.choose('coop-level', level);
    f.$('coop-difficulty').value = 'standard';
    f.$('coop-experiment').value = 'full';
    f.$('coop-start').focus();
    f.tap('Enter');
    const initial = {
      hud: teamHud(f),
      text: f.$('coop-message-text').textContent,
      image: teamImage(f),
    };
    const history = messages(t, f);
    earnTeamVictory(t, f, level);
    assert.equal(f.$('coop-message-text').textContent, won);
    assert.equal(f.$('coop-event-art').hidden, true);
    assert.ok(
      history.writes.some((text) => /Joint Cut!.*Choose your next route together/.test(text)),
      'Active joint feedback remains available before the terminal tick.',
    );
    assert.deepEqual(
      history.terminalFrames.flat(),
      [won],
      'The terminal tick never briefly writes another flight instruction into the live region.',
    );
    const terminal = { hud: teamHud(f), text: f.$('coop-message-text').textContent };
    f.tick(60);
    assert.deepEqual({ hud: teamHud(f), text: f.$('coop-message-text').textContent }, terminal);
    f.$('coop-retry').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.deepEqual(teamHud(f), initial.hud);
    assert.equal(teamImage(f), initial.image);
    assert.equal(f.$('coop-message-text').textContent, initial.text);
    assert.notEqual(initial.text, won);
  });
}

test('an earned loss replaces rescue instructions and a deliberate Retry restores its original guidance', async (t) => {
  const f = await page(t, options),
    pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'terminal-guidance-loss';
  pack.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(pack));
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-start').focus();
  f.tap('Enter');
  const initial = {
    hud: teamHud(f),
    text: f.$('coop-message-text').textContent,
    image: teamImage(f),
  };
  const history = messages(t, f);
  f.tick(3);
  for (let loop = 0; loop < 2; loop++)
    for (const [first, second, ticks] of [
      ['KeyD', 'ArrowLeft', 30],
      ['KeyW', 'ArrowUp', 15],
      ['KeyD', 'ArrowLeft', 15],
      ['KeyS', 'ArrowDown', 15],
      ['KeyA', 'ArrowRight', 15],
    ]) {
      f.tap(first);
      f.tap(second);
      for (let frame = 0; frame < ticks; frame++) f.tick();
    }
  assert.equal(f.$('coop-overlay-kicker').textContent, 'ONE MORE SHARED PLAN');
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.$('coop-message-text').textContent, lost);
  assert.equal(f.$('coop-event-art').hidden, true);
  assert.deepEqual(history.terminalFrames.flat(), [lost]);
  assert.match(f.$('coop-overlay-copy').textContent, /No team reserves remain/);
  const terminal = { hud: teamHud(f), text: f.$('coop-message-text').textContent };
  f.tick(60);
  assert.deepEqual({ hud: teamHud(f), text: f.$('coop-message-text').textContent }, terminal);
  f.$('coop-retry').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.deepEqual(teamHud(f), initial.hud);
  assert.equal(f.$('coop-message-text').textContent, initial.text);
  assert.equal(teamImage(f), initial.image);
});
