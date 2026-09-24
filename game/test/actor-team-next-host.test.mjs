import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { trial } from './helpers/coop-route-search.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { ACTOR_STYLE_PREFERENCES_KEY } from '../actor-style-preferences.mjs';
import { ACTOR_APPEARANCE_RELEASES } from '../presentation/actor-appearance-lease.mjs';

// Legacy Team First Connection -> Relay Yard, not the Journey Twin Landings
// edition. Actual production core, host input and actor transport; finite DOM /
// Canvas and modeled image decoding, not native or typical-player evidence.
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', boost: 'ShiftLeft', support: 'KeyQ' },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    boost: 'ShiftRight',
    support: 'Enter',
  },
];
const actorsPainted = (f) =>
  f.drawImages.filter((image) => f.actorTransport.decoded.includes(image));
const hud = (f) =>
  ['coop-stage', 'coop-clock', 'coop-coverage', 'coop-reserves', 'coop-message'].map(
    (id) => f.$(id).textContent,
  );

function tunedRoute() {
  // This is exactly the fresh Standard recipe used by the Legacy Team host.
  // The earlier coop-win helper uses the untuned authored level; preserve that
  // failed-route evidence rather than reclassifying it as this gp4 clear.
  const level = applyGameplayTuning(FIRST_CONNECTION, resolveGameplayTuning('standard'));
  const route = trial(level, 'standard', { cover: true, boost: true, coverDrifters: false });
  const { run } = route;
  route.tick([null, null]); // Host's mandatory initial release tick.
  const stage = (name, directions, finished) =>
    assert.equal(route.stage(name, directions, finished, 1500), true, name);
  stage('upper return row', ['up', 'up'], () => run.players[0].y <= 12.5);
  stage('joint cross-field cut', ['right', 'left'], () => run.claimedCount > 0);
  stage('spread along banked row', ['left', 'right'], () => run.players[0].x <= 14.5);
  stage('bank lower flanks', ['down', 'down'], () => run.players.every((p) => p.y >= 35));
  stage('bank upper flanks', ['up', 'up'], () => run.players.every((p) => p.y <= 1));
  stage('short finishing row', ['down', 'down'], () => run.players.every((p) => p.y >= 4.5));
  stage('return outward', ['left', 'right'], () => run.status === 'won');
  assert.equal(run.status, 'won');
  assert.equal(
    route.events.some((event) => event.type === 'player.downed'),
    false,
  );
  return route;
}

function replayInputs(f, route) {
  f.tick(); // First requestAnimationFrame establishes elapsed-time origin.
  let ticks = 0;
  for (const commands of route.log) {
    for (const [seat, command] of commands.entries()) {
      if (command.direction) f.tap(keys[seat][command.direction]);
      if (command.boost) f.press(keys[seat].boost);
      if (command.support) f.press(keys[seat].support);
    }
    f.tick();
    ticks++;
    for (const [seat, command] of commands.entries())
      for (const action of ['boost', 'support'])
        if (command[action])
          f.doc.activeElement.emit('keyup', { key: keys[seat][action], code: keys[seat][action] });
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    'A WORLD YOU REVEALED TOGETHER',
    JSON.stringify({ hud: hud(f), ticks }),
  );
  assert.equal(f.$('coop-next').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-next');
  assert.ok(parseFloat(f.$('coop-coverage').textContent) >= 65);
  return ticks;
}

for (const nextStyle of ['fpv', 'campaign'])
  test(`earned Legacy Team Next starts Relay Yard with ${nextStyle} actors and the accepted difficulty`, async (t) => {
    const values = new Map([[ACTOR_STYLE_PREFERENCES_KEY, JSON.stringify({ actorStyle: 'fpv' })]]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      beforeImport: ({ install }) => install('localStorage', { value: storage }),
    });
    f.$('coop-experiment').value = 'full';
    f.$('coop-start').focus();
    f.tap('Enter');
    const route = tunedRoute();
    const ticks = replayInputs(f, route);
    const firstActors = [...new Set(actorsPainted(f))];
    assert.ok(firstActors.length > 0);
    assert.ok(firstActors.every((image) => image.closes === 0));
    const before = [...f.actorTransport.requests];
    const actorHash = ACTOR_APPEARANCE_RELEASES[0].presentation.sha256;
    assert.ok(before.some((request) => request.relative === `runtime.${actorHash}.json`));
    const reserves = f.$('coop-reserves').textContent;
    if (nextStyle !== 'fpv') {
      const newValue = JSON.stringify({ actorStyle: nextStyle });
      storage.setItem(ACTOR_STYLE_PREFERENCES_KEY, newValue);
      f.win.emit('storage', { key: ACTOR_STYLE_PREFERENCES_KEY, newValue, storageArea: storage });
    }
    assert.ok(
      firstActors.every((image) => image.closes === 0),
      'Results retains its actors.',
    );
    f.$('coop-difficulty').value = 'expert'; // Hidden draft cannot change accepted difficulty.
    f.drawImages.length = 0;
    f.$('coop-next').focus();
    f.tap('Enter');
    await waitFor(
      () => f.$('coop-overlay').hidden,
      () => f.$('coop-next-status').textContent,
    );
    assert.equal(f.$('coop-level').value, 'relay-yard');
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.doc.activeElement.id, 'coop-canvas');
    assert.equal(f.$('coop-clock').textContent, '0:00');
    assert.equal(f.$('coop-coverage').textContent, '0.0%');
    assert.equal(f.$('coop-reserves').textContent, reserves);
    assert.ok(firstActors.every((image) => image.closes === 1));
    if (nextStyle === 'fpv') {
      assert.ok(
        actorsPainted(f).length > 0,
        'Next first paint includes its newly prepared actors.',
      );
      assert.ok(actorsPainted(f).every((image) => !firstActors.includes(image)));
      assert.ok(f.actorTransport.requests.length > before.length);
    } else {
      assert.equal(actorsPainted(f).length, 0);
      assert.equal(f.actorTransport.requests.length, before.length);
    }
    assert.deepEqual(f.visits, []);
    t.diagnostic(
      JSON.stringify({
        boundary: 'actual tuned Legacy Team core and keyboard host; modeled DOM/Canvas/decode',
        tuning: route.run.level.revision,
        seed: route.run.seed,
        routeTicks: route.log.length,
        hostTicks: ticks,
        coreCoverage: route.run.coverage,
        pageTheme: f.artwork.snapshot.resolved.theme,
        actorPresentation: ACTOR_APPEARANCE_RELEASES[0].presentation,
        nextStyle,
      }),
    );
  });
