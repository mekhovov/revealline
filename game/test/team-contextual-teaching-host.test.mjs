import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { page } from './helpers/coop-host.mjs';
import { trial } from './helpers/coop-route-search.mjs';
import { replayTeamCommands } from './helpers/coop-win.mjs';

function locales(context) {
  const original = getLocale();
  context.after(() => setLocale(original, { persist: false }));
  setLocale('en', { persist: false });
}

function packWith(level, id) {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = id;
  pack.name = `Teaching ${id}`;
  pack.levels = [{ ...level, id: `${id}-arena`, name: `Teaching ${id}` }];
  return pack;
}

function firstCutCommands(level) {
  const route = trial(applyGameplayTuning(level, resolveGameplayTuning('standard')), 'standard', {
    boost: false,
    cover: false,
  });
  const move = (axis, targets) =>
    route.stage(
      `safe waypoint ${axis}`,
      () => route.to(axis, targets),
      () => route.at(axis, targets),
    );
  assert.ok(move('y', [14.5, 14.5]));
  assert.ok(
    route.stage(
      'join the first cuts',
      ['right', 'left'],
      () =>
        route.run.players.every((player) => !player.cutting) &&
        Math.abs(route.run.players[0].x - route.run.players[1].x) < 0.4,
    ),
  );
  assert.ok(route.run.events.some((event) => event.type === 'cut.joint'));
  return route.log;
}

async function selectPack(f, pack) {
  const source = JSON.stringify(pack);
  f.$('coop-pack-file').closest('details').open = true;
  f.$('coop-pack-file').files = [new Blob([source], { type: 'application/json' })];
  await f.$('coop-pack-file').onchange();
  assert.equal(
    f.$('coop-level').value,
    pack.levels[0].id,
    JSON.stringify({
      status: f.$('coop-pack-status').textContent,
      picture: f.$('coop-picture-status').textContent,
    }),
  );
  assert.equal(f.$('coop-start').disabled, false);
}

async function importAndStart(context, pack) {
  const f = await page(context, { nativeFocus: true });
  await selectPack(f, pack);
  f.$('coop-start').focus();
  f.$('coop-start').click();
  assert.equal(f.$('coop-menu').hidden, true);
  return f;
}

test('real Team cut keeps mission guidance, teaches Support after success, and retains it through empty pulse and Retry', async (context) => {
  locales(context);
  const level = structuredClone(FIRST_CONNECTION);
  level.enemies = [
    {
      id: 'distant-drifter',
      type: 'drifter',
      x: 36,
      y: 2,
      vx: 0.1,
      vy: 0,
      radius: 0.35,
    },
  ];
  const f = await importAndStart(context, packWith(level, 'empty-support'));
  assert.match(f.$('coop-message').textContent, /small loop/i, 'authored guidance remains visible');
  assert.equal(f.$('coop-teaching-message').getAttribute('role'), 'status');
  assert.equal(f.$('coop-teaching-message').getAttribute('aria-live'), 'polite');
  assert.match(f.$('coop-teaching-message').textContent, /^FIRST CUT/);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');

  replayTeamCommands(f, firstCutCommands(level));
  assert.equal(
    f.$('coop-teaching').dataset.kind,
    'support',
    JSON.stringify({
      hidden: f.$('coop-teaching').hidden,
      cue: f.$('coop-teaching-message').textContent,
      message: f.$('coop-message').textContent,
      coverage: f.$('coop-coverage').textContent,
      state0: f.$('coop-state-0').textContent,
      state1: f.$('coop-state-1').textContent,
    }),
  );
  assert.match(f.$('coop-teaching-message').textContent, /^SUPPORT READY/);
  assert.equal(f.doc.activeElement.id, 'coop-canvas', 'a cue never steals play focus');

  const readyBeforeEmpty = f.$('coop-support-0').textContent;
  f.press('KeyQ');
  f.tick(3);
  f.doc.activeElement.emit('keyup', { key: 'KeyQ', code: 'KeyQ' });
  assert.equal(f.$('coop-teaching').hidden, false, 'an empty pulse does not dismiss Support');
  assert.notEqual(
    f.$('coop-support-0').textContent,
    readyBeforeEmpty,
    'the actual empty pulse enters cooldown',
  );

  setLocale('uk', { persist: false });
  assert.match(f.$('coop-teaching-message').textContent, /^ПІДТРИМКА ГОТОВА/);
  assert.doesNotMatch(f.$('coop-teaching-message').textContent, /[A-Za-z]/u);
  assert.equal(f.doc.activeElement.id, 'coop-canvas', 'locale refresh does not move focus');
  setLocale('en', { persist: false });

  f.$('coop-pause').click();
  f.$('coop-retry').click();
  if (f.$('coop-discard-dialog').open) f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-teaching').dataset.kind, 'support');
  assert.match(f.$('coop-teaching-message').textContent, /^SUPPORT READY/);
  f.$('coop-pause').click();
  assert.equal(f.$('coop-teaching').parentNode.id, 'coop-pause-teaching');
  const pad = {
    index: 0,
    id: 'Teaching controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const pulse = (button) => {
    pad.buttons[button] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[button] = { pressed: false, value: 0 };
    f.tick();
  };
  f.tick(2);
  pulse(0);
  for (let count = 0; count < 30 && f.doc.activeElement.id !== 'coop-teaching-dismiss'; count++)
    pulse(13);
  assert.equal(f.doc.activeElement.id, 'coop-teaching-dismiss');
  pulse(0);
  assert.equal(f.$('coop-teaching').hidden, true, 'explicit acknowledgement dismisses the cue');
  assert.equal(f.doc.activeElement.id, 'coop-resume', 'acknowledgement returns to Pause');
});

test('real Team Support completes teaching only when a moving threat is actually slowed', async (context) => {
  locales(context);
  const level = structuredClone(FIRST_CONNECTION);
  level.enemies = [
    {
      id: 'coach-drifter',
      type: 'drifter',
      x: 60,
      y: 5,
      vx: 0.1,
      vy: 0,
      radius: 0.35,
    },
  ];
  const f = await importAndStart(context, packWith(level, 'effective-support'));
  replayTeamCommands(f, firstCutCommands(level));
  assert.equal(f.$('coop-teaching').dataset.kind, 'support');
  f.press('KeyQ');
  f.tick(3);
  f.doc.activeElement.emit('keyup', { key: 'KeyQ', code: 'KeyQ' });
  assert.equal(
    f.$('coop-teaching').hidden,
    true,
    JSON.stringify({
      cue: f.$('coop-teaching-message').textContent,
      message: f.$('coop-message').textContent,
      state0: f.$('coop-state-0').textContent,
    }),
  );
  assert.match(f.$('coop-message').textContent, /slowed the pressure/i);
});

test('real Team downing preempts the cut cue and a completed hold-to-rescue dismisses rescue teaching', async (context) => {
  locales(context);
  const level = structuredClone(FIRST_CONNECTION);
  level.spawns = [
    { x: 0.5, y: 17.5 },
    { x: 0.5, y: 19.5 },
  ];
  level.enemies = [
    {
      id: 'coach-drifter',
      type: 'drifter',
      x: 3.5,
      y: 17.5,
      vx: -3.2,
      vy: 0,
      radius: 0.35,
    },
  ];
  const f = await importAndStart(context, packWith(level, 'live-rescue'));
  f.$('coop-teaching-dismiss').click();
  assert.equal(f.$('coop-teaching').hidden, true);
  f.tap('KeyD');
  for (let tick = 0; tick < 60 && f.$('coop-teaching').hidden; tick++) f.tick();
  assert.equal(f.$('coop-teaching').dataset.kind, 'rescue');
  assert.match(f.$('coop-teaching-message').textContent, /^RESCUE/);
  assert.match(f.$('coop-message').textContent, /needs a rescue/i);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');

  f.press('Enter');
  f.tick(125);
  f.doc.activeElement.emit('keyup', { key: 'Enter', code: 'Enter' });
  assert.equal(f.$('coop-teaching').hidden, true);
  assert.match(f.$('coop-message').textContent, /rescued/i);
  assert.match(f.$('coop-state-0').textContent, /safe ground/i);
});

test('real Team setup changes hide pending Support in a calm arena and restore it with a valid target', async (context) => {
  locales(context);
  const pressure = structuredClone(FIRST_CONNECTION);
  pressure.enemies = [
    {
      id: 'context-drifter',
      type: 'drifter',
      x: 36,
      y: 2,
      vx: 0.1,
      vy: 0,
      radius: 0.35,
    },
  ];
  const pressurePack = packWith(pressure, 'context-pressure');
  const f = await importAndStart(context, pressurePack);
  replayTeamCommands(f, firstCutCommands(pressure));
  assert.equal(f.$('coop-teaching').dataset.kind, 'support');

  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  const calm = structuredClone(FIRST_CONNECTION);
  calm.enemies = [];
  const calmPack = packWith(calm, 'context-calm');
  await selectPack(f, calmPack);
  f.$('coop-start').click();
  assert.equal(f.$('coop-teaching').hidden, true, 'calm arena does not invent a Support target');

  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  await selectPack(f, pressurePack);
  f.$('coop-start').click();
  assert.equal(f.$('coop-teaching').hidden, false);
  assert.equal(f.$('coop-teaching').dataset.kind, 'support');
  assert.match(f.$('coop-teaching-message').textContent, /^SUPPORT READY/);
});
