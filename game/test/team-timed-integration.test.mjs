import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createTeamTestPack, createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop, resumeCoop } from '../coop/core.mjs';
import {
  coopBonusView,
  coopBonusDetails,
  coopBonusLive,
  drawCoopBonuses,
} from '../couch/coop-bonus-view.mjs';
import { page } from './helpers/coop-host.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';

const schedule = {
  id: 'team-detour',
  kind: 'player-speed',
  anchors: [
    { x: 20.5, y: 8.5 },
    { x: 51.5, y: 8.5 },
  ],
  initialDelayTicks: 0,
  announcementTicks: 120,
  availableTicks: 1200,
  cooldownTicks: 240,
  maxAppearances: 3,
  maxCollections: 1,
};
const edit = (source = createTeamOpeningCandidates()) =>
  editTimedBonus(source, 'twin-landings', {
    action: 'add',
    id: schedule.id,
    schedule,
  });
const idle = [
  { direction: null, boost: false, support: false },
  { direction: null, boost: false, support: false },
];
function advance(run, ticks) {
  for (let n = 0; n < ticks; n++) stepCoop(run, idle);
}
const runtime = () =>
  startCoop(createCoop(createTeamTestPack(edit(), 'twin-landings').levels[0], { seed: 17 }));

test('Team timed edit is an explicit immutable edition; export/import and undo retain exact rules', () => {
  const old = createTeamOpeningCandidates(),
    before = structuredClone(old),
    next = edit(old);
  assert.deepEqual(old, before);
  assert.deepEqual(next.maps, old.maps);
  assert.equal(old.missions[0].team.format, 'TeamMissionV1');
  assert.equal(next.missions[0].team.format, 'TeamMissionV4');
  const history = createDraftHistory(old);
  history.replace(next);
  assert.deepEqual(history.undo(), old);
  assert.deepEqual(history.redo(), next);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const pack = createTeamTestPack(next, 'twin-landings', difficulty);
    assert.equal(pack.version, 'revealline-coop-pack.v5');
    assert.equal(pack.ruleset, 'revealline-coop.v7');
    assert.equal(pack.levels[0].journeyDifficulty, difficulty);
    assert.equal(pack.levels[0].timedBonuses.version, 'timed-bonuses.v2');
    assert.deepEqual(pack.levels[0].timedBonuses.schedules, [schedule]);
    assert.equal(validateCoopPack(JSON.parse(JSON.stringify(pack))).valid, true);
    assert.equal(validateCoopPack({ ...pack, version: 'revealline-coop-pack.v4' }).valid, false);
    assert.equal(validateCoopPack({ ...pack, ruleset: 'revealline-coop.v6' }).valid, false);
  }
});

test('single mission Apply does not migrate neighboring missions or silently export mixed editions', () => {
  const source = createTeamOpeningCandidates(),
    other = structuredClone(source.missions[0]);
  other.id = 'unchanged-neighbor';
  source.missions.push(other);
  source.campaigns[0].missionIds.push(other.id);
  const next = edit(source);
  assert.deepEqual(next.missions[1], other);
  assert.throws(
    () => createTeamCampaignTestPack(next, source.campaigns[0].id),
    /one explicitly authored runtime edition/,
  );
});

test('Studio Team preview numbers the same possible anchors compiled for the real host', () => {
  const preview = prepareContentPreview(edit(), 'twin-landings', { mode: 'team' });
  assert.deepEqual(preview.manifest.level.timedBonuses.schedules, [schedule]);
  const calls = [],
    ctx = new Proxy(
      {},
      {
        get: (object, key) => object[key] ?? ((...args) => calls.push([key, ...args])),
      },
    );
  paintContentMap(ctx, preview, { showCapture: false });
  assert(calls.some(([method, label]) => method === 'fillText' && label === '>1.1'));
  assert(calls.some(([method, label]) => method === 'fillText' && label === '>1.2'));
});

test('Team projection is owned, pause-stable, and uses the shared countdown painter without mutation', () => {
  const run = runtime();
  advance(run, 1);
  let view = coopBonusView(run);
  assert.equal(view.timedBonuses[0].phase, 'announce');
  assert.match(coopBonusDetails(view), /arrives in 1.0s/);
  assert.equal(coopBonusLive(view), 'Pickup incoming');
  assert(Object.isFrozen(view.timedBonuses[0]));
  advance(run, 120);
  view = coopBonusView(run);
  assert.equal(view.powerups.length, 1);
  assert.match(coopBonusDetails(view), /expires in 10.0s/);
  assert.equal(coopBonusLive(view), '1 timed pickup available');
  pauseCoop(run);
  const before = structuredClone(run),
    paused = coopBonusDetails(view);
  advance(run, 500);
  assert.equal(coopBonusDetails(coopBonusView(run)), paused);
  const calls = [],
    ctx = new Proxy(
      {},
      { get: (object, key) => object[key] ?? ((...args) => calls.push([key, ...args])) },
    );
  drawCoopBonuses(ctx, view, { screenScale: 360 / 1152 });
  assert(calls.some(([method]) => method === 'arc'));
  assert(calls.some(([method, x, y]) => method === 'scale' && x === 1 / 16 && y === 1 / 16));
  assert.deepEqual(run, before);
  resumeCoop(run);
  advance(run, 1200);
  assert.equal(coopBonusView(run).powerups.length, 0);
});

test('malformed Team visual state rejects unknown editions, getters, oversized data, and mismatched windows', () => {
  const valid = runtime();
  advance(valid, 121);
  for (const mutate of [
    (r) => {
      r.ruleset = 'revealline-coop.v6';
    },
    (r) => {
      r.width = 36;
    },
    (r) => {
      r.bonuses.items[0].x += 1;
    },
    (r) => {
      r.bonuses.timed.clock = r.tick + 1;
    },
    (r) => {
      r.bonuses.effects['player-speed'].push({ from: 0, until: 0 });
    },
    (r) => {
      r.bonuses.timed.schedules[0].deadline = r.tick;
    },
    (r) => {
      r.bonuses.extra = 'x'.repeat(70000);
    },
    (r) => {
      Object.defineProperty(r, 'bonuses', {
        get() {
          throw new Error('getter must never run');
        },
        enumerable: true,
      });
    },
  ]) {
    const bad = structuredClone(valid);
    mutate(bad);
    assert.throws(
      () => coopBonusView(bad),
      (error) => !error.message.includes('getter must never run'),
    );
  }
  const old = createCoop(
    createTeamTestPack(createTeamOpeningCandidates(), 'twin-landings').levels[0],
  );
  assert.equal(coopBonusView(old), null);
});

test('a mid-pickup drawing fault restores every Team canvas scope and the next paint scale', () => {
  const run = runtime(),
    stack = [],
    boardScales = [];
  advance(run, 1);
  let scale = 1,
    fail = true;
  const ctx = new Proxy(
    {},
    {
      get(object, key) {
        if (key in object) return object[key];
        return (...args) => {
          if (key === 'save') stack.push(scale);
          if (key === 'restore') scale = stack.pop();
          if (key === 'scale') scale *= args[0];
          if (key === 'fillRect' && args[2] === 72 && args[3] === 36) boardScales.push(scale);
          if (key === 'arc' && args[2] === 16 && fail) {
            fail = false;
            throw new Error('countdown ring failed');
          }
        };
      },
    },
  );
  const painter = createCoopPainter({
    width: 1152,
    height: 576,
    clientWidth: 1152,
    getContext: () => ctx,
  });
  const before = structuredClone(run);
  assert.throws(() => painter.paint(run), /countdown ring failed/);
  assert.equal(stack.length, 0);
  assert.equal(scale, 1);
  painter.paint(run);
  assert.deepEqual(boardScales, [16, 16]);
  assert.equal(stack.length, 0);
  assert.equal(scale, 1);
  assert.deepEqual(run, before);
});

test('actual Team host imports the explicit edition, explains pickup ownership, pauses windows, and retries cleanly', async (t) => {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  const source = JSON.stringify(createTeamTestPack(edit(), 'twin-landings', 'expert'));
  await f.selectFile(source);
  assert.equal(f.$('coop-pack-status').dataset.state, 'ready', f.$('coop-pack-status').textContent);
  assert.match(f.$('coop-threat-help').textContent, /Enclosure does not collect/);
  assert.equal(f.$('coop-difficulty').value, 'expert');
  f.$('coop-start').click();
  f.tick(3);
  assert.equal(f.$('coop-bonus-live').textContent, 'Pickup incoming');
  f.$('coop-pause').click();
  assert.equal(f.$('coop-bonus-details').hidden, false);
  const paused = f.$('coop-bonus-detail-state').textContent;
  assert.match(paused, /arrives in/);
  assert.match(f.$('coop-bonus-help').textContent, /Speed affects the collector/);
  f.tick(200);
  assert.equal(f.$('coop-bonus-detail-state').textContent, paused);
  f.$('coop-resume').click();
  f.tick(125);
  assert.equal(f.$('coop-bonus-details').hidden, true);
  assert.equal(f.$('coop-bonus-live').textContent, '1 timed pickup available');
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  f.tick(3);
  assert.equal(f.$('coop-bonus-live').textContent, 'Pickup incoming');
  assert.equal(JSON.stringify(createTeamTestPack(edit(), 'twin-landings', 'expert')), source);
});

test('actual Team keyboard collection names the collector and exposes a bounded per-pilot effect', async (t) => {
  const f = await page(t, { nativeFocus: true, nativeVisibility: true });
  await f.selectFile(JSON.stringify(createTeamTestPack(edit(), 'twin-landings')));
  f.$('coop-start').click();
  f.tick(125);
  assert.equal(f.$('coop-bonus-live').textContent, '1 timed pickup available');
  f.tap('KeyW');
  f.tap('ArrowUp');
  f.tick(140);
  assert.match(f.$('coop-message').textContent, /collected pilot speed/);
  assert.match(f.$('coop-bonus-live').textContent, /^Pilot [12] speed [1-5]s$/);
  f.$('coop-pause').click();
  assert.match(f.$('coop-bonus-detail-state').textContent, /^Pilot [12] speed active [0-5]\.\ds$/);
  const paused = f.$('coop-bonus-detail-state').textContent;
  f.tick(1000);
  assert.equal(f.$('coop-bonus-detail-state').textContent, paused);
});
