import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { createTimedBonusEditor } from '../studio/timed-bonus-editor.mjs';
import { drawClassicPickups } from '../ui/classic-view.mjs';
import { foundationCompatibleView as classicView } from '../ui/foundation-view.mjs';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import { flightEventKind, flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { flightDetailsModel } from '../ui/flight-information-details.mjs';

const schedule = {
  id: 'detour-window',
  kind: 'enemy-slow',
  anchors: [
    { x: 8.5, y: 8.5 },
    { x: 24.5, y: 8.5 },
  ],
  initialDelayTicks: 0,
  announcementTicks: 120,
  availableTicks: 1200,
  cooldownTicks: 1440,
  maxAppearances: 3,
  maxCollections: 2,
};
const themes = JSON.parse(
  readFileSync(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
const add = (source = createStarterProject()) =>
  editTimedBonus(source, 'nearby-shore', { action: 'add', id: schedule.id, schedule });
const resolve = (source, options) =>
  resolveMission(compileContentProject(source), 'nearby-shore', options);
const context = () => {
  const calls = [];
  return {
    calls,
    ctx: new Proxy(
      {},
      {
        get(target, key) {
          return target[key] ?? ((...args) => calls.push([key, ...args]));
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        },
      },
    ),
  };
};
test('timed schedule CRUD compiles all modes/presets, preserves maps and fixed bonuses, and undoes exactly', () => {
  const old = createStarterProject(),
    before = structuredClone(old),
    next = add(old);
  assert.deepEqual(old, before);
  assert.deepEqual(next.maps, old.maps);
  assert.deepEqual(next.missions[0].bonuses, old.missions[0].bonuses);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const solo = resolve(next, { difficulty });
    assert.deepEqual(solo.level.classic.timedBonuses.schedules, [schedule]);
    assert.equal(solo.level.classic.timedBonuses.version, 'timed-bonuses.v2');
    assert.deepEqual(resolve(next, { difficulty, mode: 'versus' }).level, solo.level);
    assert.notEqual(resolve(old, { difficulty }).simulationIdentity, solo.simulationIdentity);
    assert.equal(solo.officialProgressEligible, false);
  }
  const history = createDraftHistory(old);
  history.replace(next);
  assert.deepEqual(history.undo(), old);
  assert.deepEqual(history.redo(), next);
  const replacement = editTimedBonus(next, 'nearby-shore', {
    action: 'replace',
    id: schedule.id,
    schedule: { ...schedule, availableTicks: 960 },
  });
  assert.equal(replacement.missions[0].timedBonuses.schedules[0].availableTicks, 960);
  const removed = editTimedBonus(replacement, 'nearby-shore', {
    action: 'remove',
    id: schedule.id,
  });
  assert.equal(Object.hasOwn(removed.missions[0], 'timedBonuses'), false);
  assert.equal(resolve(removed).simulationIdentity, resolve(old).simulationIdentity);
});
test('invalid schedule and Team imports fail closed, not silently dropping or publishing mechanics', () => {
  for (const bad of [
    { duration: 30 },
    { availableTicks: 1 },
    { kind: 'mandatory' },
    { anchors: [] },
    { id: 'keeper' },
  ])
    assert.throws(() =>
      editTimedBonus(createStarterProject(), 'nearby-shore', {
        action: 'add',
        id: bad.id ?? schedule.id,
        schedule: { ...schedule, ...bad },
      }),
    );
  const team = createTeamOpeningCandidates();
  assert.throws(
    () => editTimedBonus(team, 'twin-landings', { action: 'add', id: schedule.id, schedule }),
    /not yet qualified/,
  );
  team.missions[0].timedBonuses = { version: 'timed-bonuses.v1', schedules: [schedule] };
  assert.throws(() => compileContentProject(team), /not unqualified/);
  const imported = add();
  imported.missions[0].timedBonuses = null;
  assert.throws(() => compileContentProject(imported));
});
test('shared preview/transport preserves schedules, numbers possible anchors, and explains contact expiry', () => {
  const source = add(),
    preview = prepareContentPreview(source, 'nearby-shore', {
      theme: themes.find((theme) => theme.id === 'horizon'),
    });
  assert.deepEqual(preview.scenario.level.classic.timedBonuses.schedules, [schedule]);
  const { ctx, calls } = context();
  paintContentMap(ctx, preview, { showCapture: false });
  assert(calls.some(([name, text]) => name === 'fillText' && text === 'v1.1'));
  assert(calls.some(([name, text]) => name === 'fillText' && text === 'v1.2'));
  assert.match(JSON.stringify(missionBriefing(preview.manifest.level)), /Timed pickups/);
});
test('bounded view distinguishes hollow announcement and available countdown, independent of effects settings', () => {
  const run = createRun(resolve(add()).level);
  stepRun(run, { direction: null }, FIXED_DT);
  const announcement = classicView(run);
  assert(announcement);
  assert.equal(announcement.powerups.length, 0);
  assert.equal(announcement.timedBonuses[0].phase, 'announce');
  assert(Object.isFrozen(announcement.timedBonuses[0]));
  let { ctx, calls } = context();
  drawClassicPickups(ctx, announcement, { danger: '#f00' }, {}, { reduced: true });
  assert(calls.some(([name, text]) => name === 'fillText' && text === '+1s'));
  assert(calls.some(([name]) => name === 'setLineDash'));
  for (let i = 0; i < 120; i++) stepRun(run, { direction: null }, FIXED_DT);
  const available = classicView(run);
  assert.equal(available.powerups.length, 1);
  assert.equal(available.powerups[0].seconds, 10);
  assert.equal(available.powerups[0].remainingFraction, 1);
  ({ ctx, calls } = context());
  drawClassicPickups(ctx, available, { danger: '#f00' });
  assert(calls.some(([name, text]) => name === 'fillText' && text === '10s'));
  assert(calls.some(([name]) => name === 'arc'));
  run.status = 'won';
  assert.equal(classicView(run).timedBonuses.length, 0);
  assert.equal(classicView(run).powerups.length, 0);
});
test('paused field details explain upcoming/available pickups and do not classify known schedule events as unknown', () => {
  const run = createRun(resolve(add()).level);
  const describe = () =>
    flightDetailsModel(
      {
        snapshot: flightInformationSnapshot(run, { started: true, paused: true }),
        recentBatches: [],
        recentNotices: [],
      },
      {
        mission: 'Window',
        goal: 'Capture',
        steering: 'Steer',
        objectiveLabel: 'Objectives',
        actions: [],
      },
    );
  stepRun(run, { direction: null }, FIXED_DT);
  assert.match(JSON.stringify(describe()), /Hollow symbols cannot be collected/);
  for (let n = 0; n < 120; n++) stepRun(run, { direction: null }, FIXED_DT);
  assert.match(JSON.stringify(describe()), /touch before the ring expires/);
  for (const event of ['bonus.announced', 'bonus.appeared', 'bonus.expired', 'bonus.cancelled'])
    assert.equal(flightEventKind(event), 'ordinary', event);
  assert.equal(flightEventKind('bonus.unregistered'), 'unknown');
});

test('malformed timed view fails closed without executing a getter or mutating the run', () => {
  const run = createRun(resolve(add()).level);
  stepRun(run, { direction: null }, FIXED_DT);
  const before = structuredClone(run.classic);
  let called = false;
  Object.defineProperty(run.classic.timedBonuses.schedules[0], 'deadline', {
    get() {
      called = true;
      return 120;
    },
  });
  assert.equal(classicView(run), null);
  assert.equal(called, false);
  run.classic = before;
  run.classic.timedBonuses.clock = -1;
  assert.equal(classicView(run), null);
});

function uiFixture() {
  const nodes = new Map();
  const element = () => ({
    value: '',
    textContent: '',
    disabled: false,
    replaceChildren(...children) {
      this.children = children;
      this.value = children[0]?.value ?? '';
    },
  });
  const document = {
    createElement: element,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
  };
  let source = createStarterProject(),
    accept = true;
  const editor = createTimedBonusEditor({
    document,
    getSource: () => source,
    getMission: () => source.missions[0],
    apply(next) {
      if (!accept) return false;
      source = next;
      editor.sync();
      return true;
    },
  });
  editor.sync();
  const node = (id) => document.getElementById('timed-bonus-' + id);
  const fill = () => {
    node('id').value = schedule.id;
    node('kind').value = 'enemy-slow';
    node('anchors').value = '8.5, 8.5; 24.5, 8.5';
    for (const field of [
      'delay',
      'announce',
      'available',
      'cooldown',
      'appearances',
      'collections',
    ])
      node(field).value = String(node(field).value);
  };
  return {
    node,
    fill,
    source: () => source,
    update(next, sync = true) {
      source = next;
      if (sync) editor.sync();
    },
    reject() {
      accept = false;
    },
    submit() {
      node('form').onsubmit({ preventDefault() {} });
    },
  };
}
test('Studio adds, replaces and confirms removal; invalid/stale fields never partially apply', () => {
  const f = uiFixture();
  f.fill();
  f.submit();
  assert.match(f.node('result').textContent, /^Applied/);
  assert.equal(f.source().missions[0].timedBonuses.schedules[0].availableTicks, 1200);
  f.node('anchors').value = 'bad';
  f.submit();
  assert.match(f.node('result').textContent, /^Not applied/);
  assert.equal(f.source().missions[0].timedBonuses.schedules[0].anchors.length, 2);
  f.fill();
  f.node('available').value = '8';
  f.submit();
  assert.equal(f.source().missions[0].timedBonuses.schedules[0].availableTicks, 960);
  f.node('remove').onclick();
  assert.match(f.node('remove').textContent, /Confirm/);
  f.node('remove').onclick();
  assert.equal(f.source().missions[0].timedBonuses, undefined);
  f.fill();
  const changed = structuredClone(f.source());
  changed.maps[0].name = 'changed';
  f.update(changed, false);
  f.submit();
  assert.match(f.node('result').textContent, /draft changed/);
  f.update(createTeamOpeningCandidates());
  assert(f.node('tools').disabled);
  assert.match(f.node('result').textContent, /not yet qualified/);
});
