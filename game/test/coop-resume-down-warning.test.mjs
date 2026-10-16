import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

async function emptyArena(t) {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'resume-rescue-advice';
  pack.levels[0].id = 'resume-rescue-advice-coverage';
  pack.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').click();
  f.tick(3);
  return f;
}

function selfCross(f, seats = [0, 1]) {
  // Use the current terminal-HUD regression's legal keyboard route. No run
  // state, player position, collision or reserve count is injected.
  for (const [first, second, ticks] of [
    ['KeyD', 'ArrowLeft', 30],
    ['KeyW', 'ArrowUp', 15],
    ['KeyD', 'ArrowLeft', 15],
    ['KeyS', 'ArrowDown', 15],
    ['KeyA', 'ArrowRight', 15],
  ]) {
    if (seats.includes(0)) f.tap(first);
    if (seats.includes(1)) f.tap(second);
    f.tick(ticks);
  }
}

async function zeroReserveDown(t, seat) {
  const f = await emptyArena(t);
  selfCross(f);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  f.tick(240);
  selfCross(f, [seat]);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.match(f.$(`coop-state-${seat}`).textContent, /Down.*free rescue available/);
  assert.equal(f.$(`coop-charge-${seat}`).textContent, 'Crawl to your partner');
  assert.match(f.$('coop-message').textContent, /An unfinished line crossed itself/);
  assert.match(
    f.$('coop-message').textContent,
    new RegExp(`${seat === 0 ? 'Sunflower' : 'Skyline'} needs a rescue\\. Hold Support nearby`),
  );
  return f;
}

for (const seat of [0, 1])
  test(`P${seat + 1} rescue cause and advice survive explicit Pause and Resume`, async (t) => {
    const f = await zeroReserveDown(t, seat);
    const advice = f.$('coop-message').textContent;
    const snapshot = () =>
      [
        'coop-clock',
        'coop-coverage',
        'coop-reserves',
        `coop-state-${seat}`,
        `coop-charge-${seat}`,
      ].map((id) => f.$(id).textContent);
    const before = snapshot();
    f.$('coop-pause').click();
    assert.equal(f.$('coop-overlay').hidden, false);
    f.tick(30);
    assert.deepEqual(snapshot(), before, 'The paused rescue does not advance.');
    f.$('coop-resume').click();
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.deepEqual(snapshot(), before, 'Resume changes neither the rescue nor the checkpoint.');
    assert.equal(f.$('coop-message').textContent, advice);
    assert.doesNotMatch(f.$('coop-message').textContent, /Choose fresh directions/);
  });

test('ordinary Resume with both players active keeps the fresh-direction instruction', async (t) => {
  const f = await emptyArena(t);
  f.$('coop-pause').click();
  f.$('coop-resume').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('confirmed Retry cannot restore a retired knockdown warning on Resume', async (t) => {
  const f = await zeroReserveDown(t, 0);
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  f.tick(3);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.doesNotMatch(f.$('coop-state-0').textContent, /Down|Rescue/);
  f.$('coop-pause').click();
  f.$('coop-resume').click();
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});
