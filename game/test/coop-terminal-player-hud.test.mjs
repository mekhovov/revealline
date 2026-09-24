import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { page } from './helpers/coop-host.mjs';
import { earnTeamVictory, replayTeamCommands, teamImage } from './helpers/coop-win.mjs';
import { trial } from './helpers/coop-route-search.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';

const options = { nativeFocus: true, nativeVisibility: true, capturePaint: true };
const terminalMessage = (outcome) =>
  outcome === 'lost'
    ? 'Team attempt ended. Choose Retry or Change setup.'
    : 'Team objective complete. Your shared result is ready.';
const loop = [
  ['KeyD', 'ArrowLeft', 30],
  ['KeyW', 'ArrowUp', 15],
  ['KeyD', 'ArrowLeft', 15],
  ['KeyS', 'ArrowDown', 15],
  ['KeyA', 'ArrowRight', 15],
];
const players = (f) =>
  [0, 1].map((seat) => ({
    state: f.$(`coop-state-${seat}`).textContent,
    compactState: f.$(`coop-state-${seat}`).dataset.compact,
    charge: f.$(`coop-charge-${seat}`).textContent,
    compactCharge: f.$(`coop-charge-${seat}`).dataset.compact,
    support: f.$(`coop-support-${seat}`).textContent,
  }));
function recordMessages(t, f) {
  const element = f.$('coop-message'),
    own = Object.getOwnPropertyDescriptor(element, 'textContent');
  let prototype = element;
  while (!Object.getOwnPropertyDescriptor(prototype, 'textContent'))
    prototype = Object.getPrototypeOf(prototype);
  const original = Object.getOwnPropertyDescriptor(prototype, 'textContent'),
    tick = f.tick,
    writes = [],
    terminalWrites = [];
  Object.defineProperty(element, 'textContent', {
    configurable: true,
    get() {
      return original.get.call(this);
    },
    set(value) {
      writes.push(String(value));
      original.set.call(this, value);
    },
  });
  f.tick = (count = 1) => {
    for (let frame = 0; frame < count; frame++) {
      const before = writes.length;
      tick();
      if (!f.$('coop-overlay').hidden && f.$('coop-resume').hidden)
        terminalWrites.push(...writes.slice(before));
    }
  };
  t.after(() => {
    if (own) Object.defineProperty(element, 'textContent', own);
    else delete element.textContent;
  });
  return { writes, terminalWrites };
}
function snapshot(f) {
  return {
    players: players(f),
    message: f.$('coop-message').textContent,
    clock: f.$('coop-clock').textContent,
    coverage: f.$('coop-coverage').textContent,
    reserves: f.$('coop-reserves').textContent,
    progress: f.$('coop-progress').value,
    paint: f.lastPaint,
  };
}
function selfCross(f, seats = [0, 1]) {
  for (const [first, second, ticks] of loop) {
    if (seats.includes(0)) f.tap(first);
    if (seats.includes(1)) f.tap(second);
    f.tick(ticks);
  }
}
async function emptyArena(t) {
  const f = await page(t, options),
    pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'terminal-player-hud';
  pack.levels[0].id = 'terminal-player-hud-coverage';
  pack.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(pack));
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').focus();
  f.tap('Enter');
  f.tick(3);
  return f;
}
function assertFinishedPlayers(f, outcome) {
  assert.equal(f.$('coop-controls').hidden, true, 'Terminal results keep flight controls hidden.');
  assert.ok(f.touchPads.every((pad) => pad.hidden));
  assert.equal(f.$('coop-message').textContent, terminalMessage(outcome));
  for (const player of players(f)) {
    assert.match(player.state, outcome === 'lost' ? /ended/i : /complete/i);
    assert.match(player.compactState, outcome === 'lost' ? /ended/i : /complete/i);
    for (const value of Object.values(player))
      assert.doesNotMatch(value, /rescue|crawl|hold support|support ready|recharging/i);
    assert.match(player.charge, /result/i);
    assert.match(player.compactCharge, /result/i);
    assert.match(player.support, /Retry/i);
  }
}

test('legal shared loss ends both full and compact player instructions until an explicit keyboard Retry', async (t) => {
  const f = await emptyArena(t),
    initial = players(f),
    image = teamImage(f),
    messages = recordMessages(t, f);
  selfCross(f);
  assert.equal(f.$('coop-reserves').textContent, '0 reserves');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.match(f.$('coop-message').textContent, /Both craft are back\. One team reserve used/);
  selfCross(f);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /unfinished line crossed itself/);
  assertFinishedPlayers(f, 'lost');
  assert.deepEqual(messages.terminalWrites, [terminalMessage('lost')]);
  const terminal = snapshot(f);
  f.tick(120);
  assert.deepEqual(snapshot(f), terminal);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  f.tap('Enter');
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.deepEqual(players(f), initial);
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.$('coop-level').value, 'terminal-player-hud-coverage');
  assert.equal(teamImage(f), image);
  assert.notEqual(f.$('coop-message').textContent, terminalMessage('lost'));
});

for (const downed of [0, 1])
  test(`P${downed + 1} alone with zero reserves retains rescue guidance and keyboard Help returns without resuming`, async (t) => {
    const f = await emptyArena(t);
    selfCross(f);
    f.tick(240);
    selfCross(f, [downed]);
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.$('coop-reserves').textContent, '0 reserves');
    const status = players(f);
    assert.match(status[downed].state, /Down.*free rescue available/);
    assert.equal(status[downed].compactState, 'Free rescue');
    assert.equal(status[downed].charge, 'Crawl to your partner');
    assert.equal(status[downed].compactCharge, 'Crawl to ally');
    assert.match(status[downed].support, /Crawl along safe ground/);
    assert.equal(status[1 - downed].state, 'On safe ground');
    assert.equal(status[1 - downed].charge, 'Support ready');
    assert.match(
      f.$('coop-message').textContent,
      new RegExp(`${downed === 0 ? 'Sunflower' : 'Skyline'} needs a rescue\\. Hold Support nearby`),
    );
    f.tap('Escape');
    const paused = snapshot(f);
    f.disclose('coop-help');
    f.$('coop-help-read').focus();
    f.tap('Enter');
    assert.equal(f.doc.activeElement.id, 'coop-help-reading');
    f.tap('Escape');
    assert.equal(f.doc.activeElement.id, 'coop-help-read');
    f.tap('Escape');
    assert.equal(f.doc.activeElement.id, 'coop-help-toggle');
    f.tap('Escape');
    assert.equal(f.doc.activeElement.id, 'coop-resume');
    f.tick(120);
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.deepEqual(snapshot(f), paused);
    f.tap('Enter');
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.deepEqual(players(f), status);
  });

for (const level of ['first-connection', 'relay-yard'])
  test(`${level}: an earned Team victory shows finished player states and Retry restores active guidance`, async (t) => {
    const f = await page(t, options);
    await f.choose('coop-level', level);
    f.$('coop-difficulty').value = 'standard';
    f.$('coop-experiment').value = 'full';
    f.$('coop-start').focus();
    f.tap('Enter');
    const initial = players(f),
      initialMessage = f.$('coop-message').textContent,
      image = teamImage(f),
      messages = recordMessages(t, f);
    earnTeamVictory(t, f, level);
    assert.equal(f.$('coop-resume').hidden, true);
    assertFinishedPlayers(f, 'won');
    assert.deepEqual(messages.terminalWrites, [terminalMessage('won')]);
    assert.ok(messages.writes.some((text) => /Joint Cut! Both lines are banked/.test(text)));
    const terminal = snapshot(f);
    f.tick(60);
    assert.deepEqual(snapshot(f), terminal);
    f.$('coop-retry').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.deepEqual(players(f), initial);
    assert.equal(teamImage(f), image);
    assert.equal(f.$('coop-message').textContent, initialMessage);
  });

for (const outcome of ['loss', 'win'])
  test(`the ordinary UI-importable QA ${outcome} arena reaches its terminal result through keyboard play`, async (t) => {
    const f = await page(t, options);
    await f.selectFile(
      await readFile(new URL('./fixtures/team-terminal-hud-qa.json', import.meta.url), 'utf8'),
    );
    if (outcome === 'win') await f.choose('coop-level', 'qa-terminal-win');
    await f.choose('coop-difficulty', 'expert');
    f.$('coop-experiment').value = 'full';
    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(3);
    if (outcome === 'loss') {
      for (let attempt = 0; attempt < 2; attempt++) {
        f.tap('KeyD');
        f.tap('ArrowLeft');
        f.tick(60);
        if (attempt === 0) {
          assert.equal(f.$('coop-reserves').textContent, '0 reserves');
          assert.equal(f.$('coop-overlay').hidden, true);
        }
      }
      assert.match(f.$('coop-overlay-copy').textContent, /roaming enemy caught/);
    } else {
      f.tap('KeyD');
      // v4 applies the shared craft speed to imported authored recipes too.
      // Keep steering until the actual boundary capture, within ten seconds.
      for (let frame = 0; frame < 1200 && f.$('coop-overlay').hidden; frame++) f.tick();
    }
    assert.equal(f.$('coop-overlay').hidden, false);
    assertFinishedPlayers(f, outcome === 'loss' ? 'lost' : 'won');
  });

test('a legal active Relay Yard contact rescue retains its player-specific guidance and shared reserves', async (t) => {
  const f = await page(t, options);
  await f.choose('coop-level', 'relay-yard');
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  const messages = recordMessages(t, f);
  // Rehearse current-speed legal steering on the unchanged arena: a joint cut
  // creates a shared safe line, then an authored drifter catches P1's new trail
  // beneath the shielded core. P2 remains beside the actual rescue anchor.
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
  assert.match(players(f)[0].state, /Rescue/);
  assert.ok(messages.writes.some((text) => /Sunflower needs a rescue/.test(text)));
  const reserves = f.$('coop-reserves').textContent;
  f.press('Enter');
  f.tick(60);
  assert.equal(players(f)[1].charge, 'Hold Support · rescuing');
  assert.match(players(f)[1].support, /Rescuing partner/);
  f.tick(60);
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  assert.ok(messages.writes.some((text) => /Skyline rescued their partner/.test(text)));
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-reserves').textContent, reserves);
  assert.match(players(f)[0].state, /Recovery shield/);
  assert.doesNotMatch(players(f)[1].charge, /rescuing/);
  // The approach used a real Support pulse against the hunters. Rescue finishes
  // before that pulse recharges; its ordinary cooldown must still reach Ready.
  for (let frame = 0; frame < 240 && players(f)[1].charge !== 'Support ready'; frame++) f.tick();
  assert.equal(players(f)[1].charge, 'Support ready');
  assert.deepEqual(messages.terminalWrites, []);
});
