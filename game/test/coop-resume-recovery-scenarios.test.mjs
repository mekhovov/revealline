import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { trial } from './helpers/coop-route-search.mjs';
import { replayTeamCommands } from './helpers/coop-win.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Recovered intentions from #757, adapted to current legal steering/native
// Settings. Existing coop-resume-down-warning.test.mjs remains unchanged.
function english(t) {
  const previous = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previous, { persist: false }));
}

async function arena(t, { supportFixture = false } = {}) {
  english(t);
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'resume-recovery-scenarios';
  pack.levels[0].id = 'resume-recovery-field';
  pack.levels[0].enemies = supportFixture
    ? [{ id: 'nearby-drifter', type: 'drifter', x: 69.5, y: 22.5, vx: 0.1, vy: 0, radius: 0.35 }]
    : [];
  if (supportFixture)
    pack.levels[0].walls = [
      { x: 67, y: 20, w: 4, h: 1 },
      { x: 67, y: 24, w: 4, h: 1 },
      { x: 67, y: 20, w: 1, h: 5 },
      { x: 70, y: 20, w: 1, h: 5 },
    ];
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-level', 'resume-recovery-field');
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').click();
  f.tick(3);
  return f;
}

function selfCross(f, seats = [0, 1]) {
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

function rescueAdvice(f, seat) {
  assert.match(f.$('coop-message').textContent, /An unfinished line crossed itself/);
  assert.match(
    f.$('coop-message').textContent,
    new RegExp(`${seat === 0 ? 'Sunflower' : 'Skyline'} needs a rescue\\. Hold Support nearby`),
  );
  assert.doesNotMatch(f.$('coop-message').textContent, /Choose fresh directions/);
}

function resume(f) {
  f.$('coop-pause').click();
  assert.equal(f.$('coop-overlay').hidden, false);
  f.$('coop-resume').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
}

function waitForRevival(f, seat) {
  // Bounded real frames, not a direct reserve/player/timer mutation.
  for (
    let frame = 0;
    frame < 1500 && /Down|Rescue/.test(f.$(`coop-state-${seat}`).textContent);
    frame++
  )
    f.tick();
  assert.doesNotMatch(f.$(`coop-state-${seat}`).textContent, /Down|Rescue/);
  assert.equal(f.$('coop-overlay').hidden, true);
}

for (const seat of [0, 1])
  test(`P${seat + 1} rescue guidance survives native Settings and a live locale round trip`, async (t) => {
    const f = await arena(t);
    selfCross(f);
    assert.equal(f.$('coop-reserves').textContent, '0 reserves');
    f.tick(240);
    selfCross(f, [seat]);
    assert.match(f.$(`coop-state-${seat}`).textContent, /Down.*free rescue available/);
    rescueAdvice(f, seat);
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
    f.$('coop-settings-open').click();
    assert.equal(f.$('coop-options').open, true);
    f.$('coop-settings-tab-accessibility').click();
    await f.choose('coop-text-size', 'large');
    await f.choose('coop-text-face', 'plain');
    f.tick(30);
    assert.deepEqual(snapshot(), before, 'Settings does not advance the rescue.');
    f.$('coop-settings-close').click();
    assert.equal(f.$('coop-options').open, false);
    f.$('coop-resume').click();
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.deepEqual(snapshot(), before);
    rescueAdvice(f, seat);
    setLocale('uk', { persist: false });
    assert.match(f.$('coop-message').textContent, /потрібен порятунок/);
    assert.doesNotMatch(f.$('coop-message').textContent, /needs a rescue/);
    assert.equal(f.$('coop-clock').textContent, before[0]);
    setLocale('en', { persist: false });
    assert.deepEqual(snapshot(), before);
    rescueAdvice(f, seat);
  });

test('Resume reconstructs a retained rescue cause after an actual Support pulse replaces the message', async (t) => {
  const f = await arena(t, { supportFixture: true });
  // Keep P2 beside the closed authored chamber. The fourth wall prevents the
  // drifter escaping during the ten-second revival; Support uses its ordinary
  // six-cell radius. Moving P2 through the wall would invalidate this fixture.
  selfCross(f, [0]);
  rescueAdvice(f, 0);
  waitForRevival(f, 0);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  f.tick(240);
  selfCross(f, [0]);
  assert.match(f.$('coop-state-0').textContent, /Down.*free rescue available/);
  rescueAdvice(f, 0);
  f.press('Enter');
  f.tick();
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  f.tick(2);
  assert.match(f.$('coop-message').textContent, /Skyline slowed the pressure/);
  assert.match(f.$('coop-state-0').textContent, /Down.*free rescue available/);
  resume(f);
  rescueAdvice(f, 0);
});

test('reserve revival retires the retained knockdown before a later Resume', async (t) => {
  const f = await arena(t);
  selfCross(f, [0]);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  rescueAdvice(f, 0);
  waitForRevival(f, 0);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.match(f.$('coop-message').textContent, /Sunflower is back/);
  resume(f);
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('completed contact rescue retires the retained cause without spending a reserve', async (t) => {
  english(t);
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  await f.choose('coop-level', 'relay-yard');
  await f.choose('coop-difficulty', 'standard');
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  // Reuse the current terminal-HUD test's legal public-command route. The
  // planner observes its own core instance; only keys/frames reach the host.
  const route = trial(
    applyGameplayTuning(RELAY_YARD, resolveGameplayTuning('standard')),
    'standard',
    {
      boost: false,
    },
  );
  const { run, stage, to, at } = route;
  assert.ok(
    stage(
      'approach above pillars',
      () => to('y', [13.5, 13.5]),
      () => at('y', [13.5, 13.5]),
    ),
  );
  assert.ok(
    stage(
      'bank a shared line',
      ['right', 'left'],
      () =>
        run.players.every((player) => !player.cutting) &&
        Math.abs(run.players[0].x - run.players[1].x) < 0.4,
    ),
  );
  stage('P1 exposes a new trail', ['up', null], () => run.players[0].status === 'downed');
  assert.ok(
    route.events.some(
      (event) =>
        event.type === 'player.downed' && event.player === 0 && event.cause === 'enemy-trail',
    ),
  );
  replayTeamCommands(f, route.log);
  assert.match(f.$('coop-state-0').textContent, /Rescue/);
  const reserves = f.$('coop-reserves').textContent;
  f.press('Enter');
  f.tick(60);
  assert.equal(f.$('coop-charge-1').textContent, 'Hold Support · rescuing');
  f.tick(60);
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  assert.match(f.$('coop-state-0').textContent, /Recovery shield/);
  assert.equal(f.$('coop-reserves').textContent, reserves);
  assert.match(f.$('coop-message').textContent, /Skyline rescued their partner/);
  resume(f);
  assert.equal(f.$('coop-message').textContent, 'Choose fresh directions when you are ready.');
});

test('specialist Resume retains the travelling-impact cause and correct rescue target', async (t) => {
  english(t);
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
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
  for (let frame = 0; frame < 360 && !/Rescue/.test(f.$('coop-state-0').textContent); frame++)
    f.tick();
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
