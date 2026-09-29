import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { setLocale } from '../i18n/index.mjs';

function english(t) {
  setLocale('en', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
}

async function zeroReserveDown(t, seat, { supportFixture = false } = {}) {
  english(t);
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  if (supportFixture) {
    const pack = structuredClone(COOP_STARTER_PACK);
    pack.id = 'resume-support-advisory';
    pack.name = 'Resume Support advisory';
    pack.levels[0].id = 'resume-support-field';
    // Authored/imported drifter in P2 Support range, outside the self-cut route.
    // All knockdowns, recovery and Support below use the actual host inputs.
    pack.levels[0].enemies = [
      { id: 'nearby-drifter', type: 'drifter', x: 69.5, y: 22.5, vx: 0.1, vy: 0, radius: 0.35 },
    ];
    // A small authored chamber keeps the moving enemy in pulse range even
    // when the current gameplay policy normalizes its authored velocity.
    pack.levels[0].walls = [
      { x: 67, y: 20, w: 4, h: 1 },
      { x: 67, y: 24, w: 4, h: 1 },
      { x: 67, y: 20, w: 1, h: 5 },
    ];
    await f.selectFile(JSON.stringify(pack));
    await f.choose('coop-level', 'resume-support-field');
  } else await f.choose('coop-level', 'first-connection');
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').click();
  f.tick(3);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(30);
  f.tap('KeyA');
  f.tap('ArrowRight');
  f.tick(12);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.match(f.$('coop-message').textContent, /Both craft are back/);
  f.tick(300); // Expire recovery protection through normal frames.
  f.tap(seat === 0 ? 'KeyD' : 'ArrowLeft');
  f.tick(30);
  f.tap(seat === 0 ? 'KeyA' : 'ArrowRight');
  f.tick(12);
  assert.equal(f.$('coop-state-' + seat).textContent, 'Down · free rescue available');
  assert.equal(f.$('coop-charge-' + seat).textContent, 'Crawl to your partner');
  assert.equal(f.$('coop-overlay').hidden, true);
  assertRescueAdvice(f, seat);
  return f;
}

function assertRescueAdvice(f, seat) {
  assert.match(f.$('coop-message').textContent, /An unfinished line crossed itself\./);
  assert.match(
    f.$('coop-message').textContent,
    seat === 0
      ? /Sunflower needs a rescue\. Hold Support nearby/
      : /Skyline needs a rescue\. Hold Support nearby/,
  );
  assert.doesNotMatch(f.$('coop-message').textContent, /Choose fresh directions/);
}

function resume(f) {
  f.$('coop-pause').click();
  f.$('coop-resume').click();
}

for (const seat of [0, 1])
  test(`P${seat + 1} rescue guidance survives Pause → Settings → Resume with no world advance`, async (t) => {
    const f = await zeroReserveDown(t, seat);
    const clock = f.$('coop-clock').textContent;
    const coverage = f.$('coop-coverage').textContent;
    f.$('coop-pause').click();
    f.$('coop-settings-open').click();
    assert.equal(f.$('coop-options').open, true);
    f.$('coop-settings-tab-display').click();
    await f.choose('coop-text-size', 'large');
    await f.choose('coop-text-face', 'plain');
    f.$('coop-settings-close').click();
    assert.equal(f.$('coop-overlay').hidden, false);
    assertRescueAdvice(f, seat);
    f.$('coop-resume').click();
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.$('coop-state-' + seat).textContent, 'Down · free rescue available');
    assert.equal(f.$('coop-charge-' + seat).textContent, 'Crawl to your partner');
    assert.equal(f.$('coop-clock').textContent, clock);
    assert.equal(f.$('coop-coverage').textContent, coverage);
    assert.equal(f.$('coop-reserves').textContent, '0 reserves');
    assertRescueAdvice(f, seat);
    setLocale('uk', { persist: false });
    assert.match(f.$('coop-message').textContent, /потрібен порятунок/);
    assert.doesNotMatch(f.$('coop-message').textContent, /needs a rescue/);
    assert.equal(f.$('coop-clock').textContent, clock);
    setLocale('en', { persist: false });
    assertRescueAdvice(f, seat);
  });

test('ordinary Resume keeps the fresh-direction instruction when both players are active', async (t) => {
  english(t);
  const f = await page(t, { nativeFocus: true });
  f.$('coop-start').click();
  f.tick(3);
  resume(f);
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('Resume reconstructs current rescue guidance after a real Support pulse replaces the advisory', async (t) => {
  const f = await zeroReserveDown(t, 0, { supportFixture: true });
  f.press('Enter');
  f.tick();
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.tick(2);
  assert.match(f.$('coop-message').textContent, /Skyline slowed the pressure/);
  assert.equal(f.$('coop-state-0').textContent, 'Down · free rescue available');
  resume(f);
  assertRescueAdvice(f, 0);
});

test('reserve revival retires a retained knockdown before a later Resume', async (t) => {
  english(t);
  const f = await page(t, { nativeFocus: true });
  await f.choose('coop-level', 'first-connection');
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').click();
  f.tick(3);
  f.tap('KeyD');
  f.tick(30);
  f.tap('KeyA');
  f.tick(12);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  assertRescueAdvice(f, 0);
  f.tick(1300);
  assert.doesNotMatch(f.$('coop-state-0').textContent, /Down|Rescue/);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.match(f.$('coop-message').textContent, /Sunflower is back/);
  resume(f);
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('confirmed Retry cannot restore a previous attempt knockdown on Resume', async (t) => {
  const f = await zeroReserveDown(t, 0);
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  f.tick(3);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.doesNotMatch(f.$('coop-state-0').textContent, /Down|Rescue/);
  resume(f);
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('a completed partner rescue retires the old cause without spending a reserve', async (t) => {
  english(t);
  const f = await page(t, { nativeFocus: true });
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'resume-partner-rescue';
  pack.levels[0].id = 'resume-partner-rescue-field';
  pack.levels[0].spawns[1] = { x: 0.5, y: 20.5 };
  pack.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-level', 'resume-partner-rescue-field');
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').click();
  f.tick(3);
  f.tap('KeyD');
  f.tick(30);
  f.tap('KeyA');
  f.tick(12);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  assertRescueAdvice(f, 0);
  f.press('Enter');
  f.tick(150);
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.tick(2);
  assert.doesNotMatch(f.$('coop-state-0').textContent, /Down|Rescue/);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.match(f.$('coop-message').textContent, /Skyline rescued their partner/);
  resume(f);
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('current-rules specialist Resume retains the travelling-impact cause and the correct rescue target', async (t) => {
  english(t);
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  // A normal imported v7 authoring fixture exercises the same current-rules
  // preparation path as gameplay, without assigning simulation state.
  const pack = {
    version: 'revealline-coop-pack.v7',
    ruleset: 'revealline-coop.v9',
    id: 'resume-specialist-impact',
    revision: 'resume-1',
    name: 'Resume specialist impact',
    levels: [
      {
        version: 'revealline-coop-level.v7',
        id: 'resume-specialist-field',
        revision: 'resume-1',
        name: 'Resume specialist field',
        width: 72,
        height: 36,
        spawns: [
          { x: 20.5, y: 0.5 },
          { x: 30.5, y: 0.5 },
        ],
        walls: [],
        safeRects: [],
        terrain: [],
        enemies: [
          {
            id: 'trail-crossing-drifter',
            type: 'drifter',
            x: 12.5,
            y: 2.5,
            vx: 3,
            vy: 0,
            radius: 0.2,
          },
        ],
        goal: { coverage: 0.99 },
        rules: { moveSpeed: 10, boostMultiplier: 1.5 },
        journeyDifficulty: 'standard',
        lineImpact: { version: 'team-line-impact.v2', speed: 24 },
        supportRoles: ['interceptor', 'disruptor'],
      },
    ],
  };
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-level', 'resume-specialist-field');
  f.$('coop-start').click();
  f.tick(3);
  f.tap('KeyS');
  f.tick(120);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  assert.equal(f.$('coop-charge-1').dataset.supportRole, 'disruptor');
  assert.match(f.$('coop-message').textContent, /A travelling spark reached an unfinished cut\./);
  resume(f);
  assert.match(f.$('coop-message').textContent, /A travelling spark reached an unfinished cut\./);
  assert.match(f.$('coop-message').textContent, /Sunflower needs a rescue\. Hold Support nearby/);
  assert.doesNotMatch(
    f.$('coop-message').textContent,
    /Skyline needs a rescue|Choose fresh directions/,
  );
});
