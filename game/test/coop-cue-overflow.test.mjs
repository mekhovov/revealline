import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { coopCueOverflowEntries, hasCoopCueOverflow } from '../couch/coop-cue-overflow.mjs';
import { setLocale } from '../i18n/index.mjs';

test('overflow admission requires an actual compact unplaced result', () => {
  for (const layout of [
    null,
    {},
    { compact: true },
    { compact: true, unplaced: [] },
    { compact: false, unplaced: [0] },
  ])
    assert.equal(hasCoopCueOverflow(layout), false);
  assert.equal(
    hasCoopCueOverflow({ compact: true, unplaced: [0], strategy: 'visible-fallback' }),
    true,
  );
});

test('complete overflow text retains seats, actual locked target, slowdown and core/anchor identity without writes', () => {
  const run = createCoop(RELAY_YARD);
  startCoop(run);
  run.players[0].status = 'downed';
  run.team.reserves = 0;
  const hunters = run.enemies.filter((enemy) => enemy.type === 'hunter');
  for (const enemy of hunters) {
    enemy.phase = 'warning';
    enemy.target = 1;
    enemy.targetPoint = { x: 22.5, y: 14.5 };
    enemy.speedScale = 0.5;
    enemy.slowUntil = 2;
  }
  run.strongholds[0].anchors[0].captured = true;
  const before = structuredClone(run),
    entries = coopCueOverflowEntries(run);
  assert.equal(entries.length, 2 + run.enemies.length + run.strongholds.length);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  assert.match(entries.find((entry) => entry.id === 'player:0').state, /Down.*free rescue.*Crawl/);
  assert.match(entries.find((entry) => entry.id === 'player:1').name, /^2 Skyline$/);
  for (const enemy of hunters) {
    const entry = entries.find((item) => item.id === `enemy:${enemy.id}`);
    assert.match(entry.state, /Target locked: 2 Skyline.*SLOWED/);
    assert.ok(Object.isFrozen(entry));
  }
  assert.match(
    entries.find((entry) => entry.id.startsWith('core:')).state,
    /SHIELD.*A: SECURED.*B: CAPTURE/,
  );
  assert.deepEqual(run, before);
  assert.ok(Object.isFrozen(entries));
});

test('phase and half-open status expiry remain truthful while paused and translate through the current locale', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  const run = createCoop(RELAY_YARD);
  startCoop(run);
  run.status = 'paused';
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  hunter.phase = 'recovery';
  hunter.speedScale = 0.5;
  hunter.slowUntil = 1;
  const row = () => coopCueOverflowEntries(run).find((entry) => entry.id === `enemy:${hunter.id}`);
  assert.match(row().state, /RECOVER.*SLOWED/);
  run.time = 1;
  assert.equal(row().state, 'RECOVER');
  setLocale('uk', { persist: false });
  assert.equal(row().state, 'ВІДНОВЛЕННЯ');
  for (const status of ['ready', 'won', 'lost']) {
    run.status = status;
    assert.deepEqual(coopCueOverflowEntries(run), []);
  }
});
