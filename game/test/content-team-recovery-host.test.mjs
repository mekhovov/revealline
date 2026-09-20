import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';

async function lose(t) {
  const source = createTeamOpeningCandidates();
  source.maps[0].foundations = [];
  source.maps[0].spawns = [
    { id: 'west', x: 0.5, y: 18.5 },
    { id: 'east', x: 71.5, y: 18.5 },
  ];
  source.missions[0].actors = [];
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
  });
  await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-landings', 'expert')));
  f.$('coop-start').click();
  f.tick(3);
  const loop = (holdFinal = false) => {
    for (const [a, b, ticks] of [
      ['KeyD', 'ArrowLeft', 30],
      ['KeyW', 'ArrowUp', 15],
      ['KeyD', 'ArrowLeft', 15],
      ['KeyS', 'ArrowDown', 15],
      ['KeyA', 'ArrowRight', 15],
    ]) {
      const steer = holdFinal && a === 'KeyA' ? f.press : f.tap;
      steer(a);
      steer(b);
      f.tick(ticks);
    }
  };
  loop();
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  loop(true);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /unfinished line crossed itself/);
  return f;
}

test('new Team edition automatically retries the same exact mission without rereading art or carrying held directions', async (t) => {
  const f = await lose(t);
  const reads = f.artwork.calls.reads.length;
  f.tick(90);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.match(f.$('coop-message').textContent, /unfinished line crossed itself.*New attempt/);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.$('coop-level').value, 'twin-landings');
  f.tick(90);
  assert.equal(f.$('coop-state-0').textContent, 'On safe ground');
  assert.equal(f.$('coop-state-1').textContent, 'On safe ground');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
});

for (const action of [
  'focus',
  'focus-return',
  'hidden',
  'settings',
  'manual-retry',
  'disconnect',
]) {
  test(`Team automatic retry loses authority after ${action}`, async (t) => {
    const f = await lose(t);
    if (action === 'focus') f.$('coop-lobby').focus();
    if (action === 'focus-return') {
      f.$('coop-lobby').focus();
      f.$('coop-retry').focus();
    }
    if (action === 'disconnect') {
      f.pads.push({
        index: 5,
        id: 'Team test pad',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      });
      f.tick();
      f.pads[0].connected = false;
    }
    if (action === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
      f.win.emit('focus');
    }
    if (action === 'settings') f.$('coop-settings-open').click();
    if (action === 'manual-retry') {
      f.$('coop-retry').click();
      f.$('coop-pause').click();
    }
    const time = f.$('coop-clock').textContent;
    const imageReads = f.artwork.calls.reads.length;
    f.tick(150);
    assert.equal(f.$('coop-clock').textContent, time);
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.artwork.calls.reads.length, imageReads);
    if (action === 'settings') assert.equal(f.$('coop-options').open, true);
    assert.doesNotMatch(f.$('coop-overlay-copy').textContent, /starts shortly/);
  });
}

test('Team automatic retry stops after a painter failure instead of retrying in a loop', async (t) => {
  const f = await lose(t);
  const errors = [];
  t.mock.method(console, 'error', (error) => errors.push(error));
  f.failNextPaint();
  f.tick(150);
  assert.equal(f.$('coop-overlay-title').textContent, 'The arena needs a fresh start');
  assert.equal(f.$('coop-overlay').hidden, false);
  const time = f.$('coop-clock').textContent;
  f.tick(150);
  assert.equal(f.$('coop-clock').textContent, time);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Modeled Canvas paint failure/);
});
