import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

const full = (f, id) =>
  f.$(id).querySelector('.coop-full-copy')?.textContent ?? f.$(id).textContent;
const short = (f, id) => f.$(id).querySelector('.coop-compact-copy')?.textContent;
async function zeroReserveDown(t, seat, { supportFixture = false } = {}) {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  if (supportFixture) {
    const pack = structuredClone(COOP_STARTER_PACK);
    pack.id = 'support-advisory-probe';
    pack.name = 'Support advisory probe';
    pack.levels[0].id = 'support-advisory-field';
    // Ordinary authored/imported moving drifter in Support range of P2;
    // no run-state assignment and no collision with the self-cut route.
    pack.levels[0].enemies = [
      { id: 'nearby-drifter', type: 'drifter', x: 69.5, y: 20.5, vx: 0.1, vy: 0, radius: 0.35 },
    ];
    await f.selectFile(JSON.stringify(pack));
    await f.choose('coop-level', 'support-advisory-field');
  } else await f.choose('coop-level', 'first-connection');
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-start').click();
  f.tick(3);
  // Both craft deliberately reverse on their own fresh cuts. Public input
  // downs both and consumes the sole Expert reserve through team recovery.
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(30);
  f.tap('KeyA');
  f.tap('ArrowRight');
  f.tick(12);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.match(full(f, 'coop-message'), /Both craft are back/);
  f.tick(300); // Let the earned recovery shields expire through actual ticks.
  f.tap(seat === 0 ? 'KeyD' : 'ArrowLeft');
  f.tick(30);
  f.tap(seat === 0 ? 'KeyA' : 'ArrowRight');
  f.tick(12);
  assert.equal(full(f, 'coop-state-' + seat), 'Down · free rescue available');
  assert.equal(full(f, 'coop-charge-' + seat), 'Crawl to your partner');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.match(full(f, 'coop-message'), /unfinished line crossed itself/);
  assert.match(full(f, 'coop-message'), /needs a rescue\. Hold Support nearby/);
  return f;
}

for (const seat of [0, 1])
  test(`P${seat + 1} zero-reserve down advice survives Pause → Settings → explicit Resume`, async (t) => {
    const f = await zeroReserveDown(t, seat);
    const advice = full(f, 'coop-message'),
      brief = short(f, 'coop-message'),
      clock = f.$('coop-clock').textContent,
      coverage = f.$('coop-coverage').textContent;
    f.$('coop-pause').click();
    f.$('coop-settings-open').click();
    assert.equal(f.$('coop-options').open, true);
    f.$('coop-settings-tab-display').click();
    f.choose('coop-text-size', 'large');
    f.choose('coop-text-face', 'plain');
    f.$('coop-settings-close').click();
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(
      full(f, 'coop-message'),
      advice,
      'Settings did not replace the still-relevant cause.',
    );
    assert.equal(f.$('coop-detail-message').textContent, advice);
    f.$('coop-resume').click();
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(full(f, 'coop-state-' + seat), 'Down · free rescue available');
    assert.equal(full(f, 'coop-charge-' + seat), 'Crawl to your partner');
    assert.equal(f.$('coop-clock').textContent, clock);
    assert.equal(f.$('coop-coverage').textContent, coverage);
    assert.equal(f.$('coop-reserves').textContent, '0 reserves');
    assert.equal(
      full(f, 'coop-message'),
      advice,
      'Resume should reconstruct the current downed player cause and rescue advice.',
    );
    assert.equal(short(f, 'coop-message'), brief);
    assert.equal(f.$('coop-help-message').textContent, advice);
  });

test('ordinary Resume with both players active keeps the fresh-steering instruction', async (t) => {
  const f = await page(t, { nativeFocus: true });
  f.$('coop-start').click();
  f.tick(3);
  f.$('coop-pause').click();
  f.$('coop-resume').click();
  assert.equal(full(f, 'coop-message'), 'Choose fresh directions when you are ready.');
  assert.equal(short(f, 'coop-message'), 'Choose a fresh\ndirection.');
});

test('Resume rebuilds current down advice after a real Support pulse overwrites the last advisory', async (t) => {
  const f = await zeroReserveDown(t, 0, { supportFixture: true });
  const advice = full(f, 'coop-message'),
    brief = short(f, 'coop-message');
  // P2 Support slows the moving authored drifter while P1 remains down.
  f.press('Enter');
  f.tick();
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.tick(2);
  assert.match(full(f, 'coop-message'), /Skyline slowed the pressure/);
  assert.equal(full(f, 'coop-state-0'), 'Down · free rescue available');
  f.$('coop-pause').click();
  f.$('coop-resume').click();
  assert.equal(full(f, 'coop-message'), advice);
  assert.equal(short(f, 'coop-message'), brief);
});

test('a reserve revival retires the retained cause before later Resume', async (t) => {
  const f = await page(t, { nativeFocus: true });
  await f.choose('coop-level', 'first-connection');
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-start').click();
  f.tick(3);
  f.tap('KeyD');
  f.tick(30);
  f.tap('KeyA');
  f.tick(12);
  assert.match(full(f, 'coop-state-0'), /Rescue/);
  assert.match(full(f, 'coop-message'), /Sunflower needs a rescue/);
  f.tick(1300);
  assert.doesNotMatch(full(f, 'coop-state-0'), /Down|Rescue/);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.match(full(f, 'coop-message'), /Sunflower is back/);
  f.$('coop-pause').click();
  f.$('coop-resume').click();
  assert.equal(full(f, 'coop-message'), 'Choose fresh directions when you are ready.');
});

test('confirmed Retry starts an active fresh attempt and cannot restore an old knockdown on Resume', async (t) => {
  const f = await zeroReserveDown(t, 0);
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  f.tick(3);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.doesNotMatch(full(f, 'coop-state-0'), /Down|Rescue/);
  f.$('coop-pause').click();
  f.$('coop-resume').click();
  assert.equal(full(f, 'coop-message'), 'Choose fresh directions when you are ready.');
});
