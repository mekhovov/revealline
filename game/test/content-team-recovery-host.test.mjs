import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { candidateTeamPictureTransport } from './helpers/candidate-team-picture-transport.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';

const installCandidatePicture = await candidateTeamPictureTransport(
  createTeamJourneyCandidates({ artwork: true }),
);

const expertStorage = {
  getItem(key) {
    return key === JOURNEY_PREFERENCES_KEY
      ? JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty: 'expert' })
      : null;
  },
  setItem() {},
};

async function lose(t) {
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-originals',
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    retainInitialDifficulty: true,
    beforeImport({ install }) {
      installCandidatePicture(install);
      install('localStorage', { value: expertStorage });
    },
  });
  f.$('coop-start').click();
  f.tick(3);
  f.startingReserves = Number.parseInt(f.$('coop-reserves').textContent, 10);
  const loop = (holdFinal = false) => {
    for (const [a, b, ticks] of [
      ['KeyD', 'ArrowLeft', 60],
      ['KeyW', 'ArrowDown', 30],
      ['KeyA', 'ArrowRight', 18],
      ['KeyS', 'ArrowUp', 30],
    ]) {
      const steer = holdFinal && a === 'KeyS' ? f.press : f.tap;
      steer(a);
      steer(b);
      f.tick(ticks);
    }
  };
  for (let cycle = 0; cycle < 2; cycle++) {
    loop(cycle === 1);
    if (cycle === 0) f.tick(180);
  }
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /unfinished line crossed itself/);
  return f;
}

test('new Team edition waits at terminal failure, then deliberate Retry preserves exact art and clears held directions', async (t) => {
  const f = await lose(t);
  const reads = f.artwork.calls.reads.length,
    ended = {
      clock: f.$('coop-clock').textContent,
      coverage: f.$('coop-coverage').textContent,
      reserves: f.$('coop-reserves').textContent,
    };
  f.tick(90);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  assert.deepEqual(
    {
      clock: f.$('coop-clock').textContent,
      coverage: f.$('coop-coverage').textContent,
      reserves: f.$('coop-reserves').textContent,
    },
    ended,
  );
  assert.doesNotMatch(f.$('coop-overlay-copy').textContent, /starts shortly/);
  assert.equal(f.artwork.calls.reads.length, reads);
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(
    f.$('coop-reserves').textContent,
    `${f.startingReserves} reserve${f.startingReserves === 1 ? '' : 's'}`,
  );
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.$('coop-stage').textContent, 'TWIN LANDINGS');
  f.tick(90);
  assert.equal(f.$('coop-state-0').textContent, 'On reclaimed ground');
  assert.equal(f.$('coop-state-1').textContent, 'On reclaimed ground');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
});

test('held controller Confirm at terminal failure cannot restart or block a later keyboard Retry', async (t) => {
  const f = await lose(t),
    pad = {
      index: 5,
      id: 'Team terminal test pad',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
  f.pads.push(pad);
  pad.buttons[0] = { pressed: true, value: 1 };
  f.tick(150);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  pad.buttons[0] = { pressed: false, value: 0 };
  f.tick(2);
  f.$('coop-retry').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(
    f.$('coop-reserves').textContent,
    `${f.startingReserves} reserve${f.startingReserves === 1 ? '' : 's'}`,
  );
  t.diagnostic(
    'Held modeled-controller safety only. Fresh modeled-controller Retry and physical-controller qualification remain separate.',
  );
});

test('deliberate Team Retry stops safely after a painter failure instead of retrying in a loop', async (t) => {
  const f = await lose(t);
  const errors = [];
  t.mock.method(console, 'error', (error) => errors.push(error));
  f.failNextPaint();
  f.tap('Enter');
  assert.equal(f.$('coop-overlay-title').textContent, 'The arena needs a fresh start');
  assert.equal(f.$('coop-overlay').hidden, false);
  const time = f.$('coop-clock').textContent;
  f.tick(150);
  assert.equal(f.$('coop-clock').textContent, time);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Modeled Canvas paint failure/);
});
