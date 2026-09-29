import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { COOP_RULESET } from '../coop/core.mjs';
import { COOP_PACK_VERSION } from '../coop/recipes.mjs';
import { yardOpening } from './helpers/coop-route-search.mjs';
const activate = (f, id) => {
  f.$(id).focus();
  f.tap('Enter');
};
const held = (f) =>
  ['coop-clock', 'coop-coverage', 'coop-reserves', 'coop-state-0', 'coop-state-1'].map(
    (id) => f.$(id).textContent,
  );
async function fixture(t, options = {}) {
  const diagrams = [];
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    ...options,
    beforeImport({ $ }) {
      for (const id of [
        'coop-objectives-detail',
        'coop-objectives-location',
        'coop-relay-a-symbol',
        'coop-relay-core-symbol',
        'coop-relay-b-symbol',
      ])
        $(id).getContext = () =>
          new Proxy(
            {},
            {
              get: (o, k) => o[k] || ((...args) => diagrams.push([id, k, ...args])),
              set: (o, k, v) => ((o[k] = v), true),
            },
          );
    },
  });
  return Object.assign(f, { diagrams });
}
function pack() {
  const level = structuredClone(FIRST_CONNECTION);
  level.walls = [];
  level.strongholds = [
    {
      id: 'west',
      core: { x: 10.5, y: 10.5 },
      anchors: [
        { x: 6.5, y: 7.5 },
        { x: 14.5, y: 13.5 },
      ],
    },
    {
      id: 'east',
      core: { x: 61.5, y: 25.5 },
      anchors: [
        { x: 57.5, y: 22.5 },
        { x: 65.5, y: 28.5 },
      ],
    },
  ];
  level.goal = { cores: ['west', 'east'] };
  return JSON.stringify({
    version: COOP_PACK_VERSION,
    ruleset: COOP_RULESET,
    id: 'objectives-test',
    revision: 1,
    name: 'Objectives test',
    levels: [level],
  });
}
test('optional lobby inspector handles actual imported relays, keyboard selection and native Escape without launching or decoding artwork', async (t) => {
  const f = await fixture(t);
  await f.selectFile(pack());
  const images = f.drawImages.length,
    earned = f.earnedDrawImages.length;
  activate(f, 'coop-objectives-open');
  assert.equal(f.$('coop-objectives-dialog').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-objectives-close');
  const buttons = f.$('coop-objectives-list').querySelectorAll('button');
  assert.equal(buttons.length, 2);
  assert.match(buttons[0].textContent, /Relay 1 · shielded · A available · B available/);
  buttons[1].focus();
  f.tap('Enter');
  assert.equal(f.doc.activeElement, buttons[1]);
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.match(f.$('coop-objectives-description').textContent, /Relay 2 in the lower right/);
  assert.ok(f.diagrams.some((c) => c[1] === 'fillText' && c[2] === '2'));
  f.$('coop-start').onclick();
  assert.equal(f.$('coop-play').hidden, true, 'No cross-modal launch');
  f.tap('Escape');
  assert.equal(f.$('coop-objectives-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-objectives-open');
  f.tick(30);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.drawImages.length, images);
  assert.equal(f.earnedDrawImages.length, earned);
  await f.choose('coop-level', 'first-connection'); // Imported identity remains selected.
});
test('paused selection retains core, picture, input release and explicit Resume', async (t) => {
  const f = await fixture(t);
  await f.selectFile(pack());
  activate(f, 'coop-start');
  f.tick(2);
  assert.equal(f.$('coop-objectives-open').hidden, true);
  f.$('coop-objectives-open').onclick();
  assert.equal(f.$('coop-objectives-dialog').open, false);
  activate(f, 'coop-pause');
  const before = held(f),
    image = f.drawImages.at(-1),
    earned = f.earnedDrawImages.length;
  activate(f, 'coop-objectives-open');
  const second = f.$('coop-objectives-list').querySelectorAll('button')[1];
  second.focus();
  f.tap('Enter');
  assert.match(f.$('coop-objective').textContent, /Relay 2 in the lower right/);
  f.$('coop-resume').onclick();
  f.$('coop-retry').onclick();
  f.$('coop-settings-open').onclick();
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.$('coop-discard-dialog').open, false);
  f.tick(30);
  assert.deepEqual(held(f), before);
  assert.equal(f.drawImages.at(-1), image);
  activate(f, 'coop-objectives-close');
  assert.equal(f.doc.activeElement.id, 'coop-objectives-open');
  f.tick(60);
  assert.deepEqual(held(f), before);
  assert.equal(f.earnedDrawImages.length, earned);
  activate(f, 'coop-resume');
  f.tick(2);
  assert.equal(f.$('coop-overlay').hidden, true);
});
for (const kind of ['blur', 'persisted', 'terminal'])
  test(`${kind} retires inspector callbacks without focus theft or implicit resume`, async (t) => {
    const f = await fixture(t);
    activate(f, 'coop-start');
    f.tick(2);
    activate(f, 'coop-pause');
    activate(f, 'coop-objectives-open');
    const old = f.$('coop-objectives-list').querySelectorAll('button')[0],
      before = held(f);
    if (kind === 'blur') f.win.emit('blur');
    else f.win.emit('pagehide', { persisted: kind === 'persisted' });
    assert.equal(f.$('coop-objectives-dialog').open, false);
    f.$('coop-home').focus();
    const count = f.focusAttempts.length;
    old.onclick?.();
    f.$('coop-objectives-dialog').emit('close', { bubbles: false });
    f.win.emit('pageshow', { persisted: true });
    f.win.emit('focus');
    if (kind !== 'terminal') f.tick(3);
    assert.equal(f.focusAttempts.length, count);
    assert.equal(f.doc.activeElement.id, 'coop-home');
    assert.deepEqual(held(f), before);
    assert.equal(f.$('coop-overlay').hidden, false);
  });
test('controller closes inspector only after neutral ownership and keeps Resume explicit', async (t) => {
  const f = await fixture(t);
  activate(f, 'coop-start');
  f.tick(2);
  activate(f, 'coop-pause');
  activate(f, 'coop-objectives-open');
  const pad = {
    index: 0,
    id: 'Objectives controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const button = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick();
  };
  f.pads.push(pad);
  f.tick(2);
  button(0); // join does not activate Close
  assert.equal(f.$('coop-objectives-dialog').open, true);
  button(13);
  assert.ok(f.$('coop-objectives-dialog').contains(f.doc.activeElement));
  button(1);
  assert.equal(f.$('coop-objectives-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-objectives-open');
  assert.equal(f.$('coop-overlay').hidden, false);
});
test('coverage arenas hide optional Objectives, and an inspector failure preserves the attempt', async (t) => {
  const f = await fixture(t);
  await f.choose('coop-level', 'first-connection');
  assert.equal(f.$('coop-objectives-open').hidden, true);
  await f.choose('coop-level', 'relay-yard');
  activate(f, 'coop-start');
  f.tick(2);
  activate(f, 'coop-pause');
  const before = held(f);
  t.mock.method(f.$('coop-objectives-dialog'), 'showModal', () => {
    throw new Error('dialog failed');
  });
  activate(f, 'coop-objectives-open');
  assert.equal(f.$('coop-objectives-dialog').open, false);
  assert.match(f.$('coop-message').textContent, /Objectives view unavailable/);
  f.tick(2);
  assert.deepEqual(held(f), before);
});

test('queued close and old relay actions cannot overwrite a reopened inspector or changed lobby selection', async (t) => {
  const f = await fixture(t);
  await f.selectFile(pack());
  activate(f, 'coop-objectives-open');
  const stale = f.$('coop-objectives-list').querySelectorAll('button')[1];
  activate(f, 'coop-objectives-close');
  activate(f, 'coop-objectives-open');
  f.$('coop-objectives-dialog').emit('close', { bubbles: false });
  stale.onclick();
  assert.equal(f.$('coop-objectives-dialog').open, true);
  assert.match(f.$('coop-objectives-description').textContent, /Relay 1 in the upper left/);
  activate(f, 'coop-objectives-close');
  f.$('coop-pack-reset').click();
  // Reset preparation is asynchronous, but opening Objectives must remain optional.
  activate(f, 'coop-objectives-open');
  assert.equal(f.$('coop-objectives-dialog').open, true);
  const retired = f.$('coop-objectives-list').querySelectorAll('button')[0];
  await f.choose('coop-level', 'first-connection');
  assert.equal(f.$('coop-objectives-dialog').open, false);
  assert.equal(f.$('coop-objectives-open').hidden, true);
  const focused = f.doc.activeElement;
  retired.onclick();
  f.$('coop-objectives-dialog').emit('close', { bubbles: false });
  assert.equal(f.doc.activeElement, focused);
  assert.equal(f.$('coop-play').hidden, true);
});

test('optional imported strongholds retain coverage victory guidance and a diagram failure leaves readable objectives', async (t) => {
  const f = await fixture(t);
  const imported = JSON.parse(pack());
  imported.levels[0].goal = { coverage: 0.65 };
  await f.selectFile(JSON.stringify(imported));
  activate(f, 'coop-start');
  f.tick(2);
  activate(f, 'coop-pause');
  assert.match(f.$('coop-objective').textContent, /^Reveal 65% together · Optional Relay/);
  f.$('coop-objectives-detail').getContext = () => null;
  activate(f, 'coop-objectives-open');
  assert.equal(f.$('coop-objectives-dialog').open, true);
  assert.match(f.$('coop-objectives-list').querySelector('button').textContent, /^Optional Relay/);
  assert.match(f.$('coop-objectives-diagram-status').textContent, /Diagram unavailable/);
  assert.match(f.$('coop-objectives-description').textContent, /A available, above and left/);
  activate(f, 'coop-objectives-close');
  assert.equal(f.doc.activeElement.id, 'coop-objectives-open');
});

const relayHud = (f) =>
  ['a', 'core', 'b'].map((role) => f.$(`coop-relay-${role}-state`).textContent);
const hudPaints = (f) =>
  f.diagrams.filter((call) => call[0].startsWith('coop-relay-') && call[1] === 'setTransform');
function textSize(f, value) {
  activate(f, 'coop-settings-open');
  activate(f, 'coop-settings-tab-display');
  f.choose('coop-text-size', value);
  f.tick(2);
  activate(f, 'coop-settings-close');
}
test('Large selected A/Core/B HUD preserves actual required subsets, optional selection, pause and Standard restoration', async (t) => {
  const f = await fixture(t);
  const imported = JSON.parse(pack());
  imported.levels[0].goal = { cores: ['east'] };
  await f.selectFile(JSON.stringify(imported));
  activate(f, 'coop-start');
  f.tick(2);
  activate(f, 'coop-pause');
  const before = held(f),
    standard = f.$('coop-objective').textContent,
    image = f.drawImages.at(-1);
  assert.match(standard, /^Relay 2/);
  textSize(f, 'large');
  assert.equal(f.$('coop-objective-area').dataset.relayHud, 'true');
  assert.equal(f.$('coop-relay-hud').hidden, false);
  assert.equal(f.$('coop-objective').textContent, 'Relay 2 · 0/1 required secured');
  assert.deepEqual(relayHud(f), ['Needed', 'Shielded', 'Needed']);
  assert.deepEqual(
    f
      .$('coop-relay-hud')
      .querySelectorAll('dt')
      .map((n) => n.textContent.trim()),
    ['A', 'Core', 'B'],
  );
  assert.equal(
    f.$('coop-relay-hud').querySelector('button,input,select,a[href],[tabindex]'),
    null,
    'The HUD adds no compulsory input or focus stop.',
  );
  const paintCount = hudPaints(f).length;
  assert.equal(paintCount, 3, 'The actual helper paints three separate state symbols.');
  const focusCount = f.focusAttempts.length;
  f.tick(20);
  assert.equal(hudPaints(f).length, paintCount, 'Stable frames do not repaint passive symbols.');
  assert.equal(f.focusAttempts.length, focusCount);
  assert.deepEqual(held(f), before);
  textSize(f, 'standard');
  assert.equal(f.$('coop-relay-hud').hidden, true);
  assert.equal(f.$('coop-objective-area').dataset.relayHud, 'false');
  assert.equal(f.$('coop-objective').textContent, standard);
  textSize(f, 'large');
  assert.equal(
    hudPaints(f).length,
    paintCount,
    'Unchanged state can reuse its decorative symbol backing.',
  );
  activate(f, 'coop-objectives-open');
  const optional = f.$('coop-objectives-list').querySelectorAll('button')[0];
  optional.focus();
  f.tap('Enter');
  assert.equal(f.$('coop-objective').textContent, 'Optional Relay 1 · 0/1 required secured');
  assert.deepEqual(relayHud(f), ['Needed', 'Shielded', 'Needed']);
  assert.equal(hudPaints(f).length, paintCount + 3);
  activate(f, 'coop-objectives-close');
  assert.equal(f.doc.activeElement.id, 'coop-objectives-open');
  f.tick(20);
  assert.deepEqual(held(f), before);
  assert.equal(f.drawImages.at(-1), image);
  assert.equal(f.$('coop-overlay').hidden, false);
});

test('Large coverage missions keep their victory target, optional relay states and graceful symbol failure', async (t) => {
  const f = await fixture(t);
  const imported = JSON.parse(pack());
  imported.levels[0].goal = { coverage: 0.65 };
  await f.selectFile(JSON.stringify(imported));
  activate(f, 'coop-start');
  f.tick(2);
  activate(f, 'coop-pause');
  const before = held(f);
  f.$('coop-relay-a-symbol').getContext = () => null;
  f.$('coop-relay-core-symbol').getContext = () => {
    throw new Error('decorative context unavailable');
  };
  textSize(f, 'large');
  assert.equal(f.$('coop-objective').textContent, 'Reveal 65% together · Optional Relay 1');
  assert.deepEqual(relayHud(f), ['Needed', 'Shielded', 'Needed']);
  assert.equal(f.$('coop-relay-a-symbol').hidden, true);
  assert.equal(f.$('coop-relay-core-symbol').hidden, true);
  assert.equal(f.$('coop-relay-b-symbol').hidden, false);
  assert.equal(f.$('coop-resume').hidden, false, 'Decorative failure cannot stop the arena.');
  assert.doesNotMatch(f.$('coop-message').textContent, /stopped|unavailable/);
  f.tick(20);
  assert.deepEqual(held(f), before);
});

test('Large coverage-only arena introduces no empty objective strip', async (t) => {
  const f = await fixture(t);
  await f.choose('coop-level', 'first-connection');
  textSize(f, 'large');
  activate(f, 'coop-start');
  f.tick(2);
  assert.equal(f.$('coop-relay-hud').hidden, true);
  assert.equal(f.$('coop-objective-area').dataset.relayHud, 'false');
  assert.equal(f.$('coop-objective').textContent, 'Reveal 65% together');
  assert.equal(hudPaints(f).length, 0);
});

test('ordinary Relay Yard commands update Large A/Core/B through exposure and earned victory without changing artwork ownership', async (t) => {
  const f = await fixture(t);
  textSize(f, 'large');
  activate(f, 'coop-start');
  f.tick(2);
  const image = f.drawImages.at(-1),
    initialReads = f.artwork.calls.reads.length;
  assert.deepEqual(relayHud(f), ['Needed', 'Shielded', 'Needed']);
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
  const route = yardOpening('standard', { boost: true, cover: true });
  assert.equal(
    route.run.status,
    'won',
    'Only the existing validated public-command route is replayed.',
  );
  const seen = new Set([relayHud(f).join('|')]);
  for (const commands of route.log) {
    commands.forEach((command, seat) => {
      if (command.direction) f.tap(keys[seat][command.direction]);
      if (command.boost) f.press(keys[seat].boost);
      if (command.support) f.press(keys[seat].support);
    });
    f.tick();
    seen.add(relayHud(f).join('|'));
    commands.forEach((command, seat) => {
      for (const name of ['boost', 'support'])
        if (command[name])
          f.doc.activeElement.emit('keyup', { key: keys[seat][name], code: keys[seat][name] });
    });
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.ok(seen.has('Captured|Exposed|Captured'), JSON.stringify([...seen]));
  assert.ok(seen.has('Captured|Secured|Captured'), JSON.stringify([...seen]));
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-objective').textContent, 'Relay 1 · 1/1 required secured');
  assert.equal(f.$('coop-resume').hidden, true);
  assert.equal(f.drawImages.at(-1), image);
  assert.equal(f.artwork.calls.reads.length, initialReads);
  const won = held(f),
    paintCount = hudPaints(f).length;
  f.tick(20);
  assert.deepEqual(held(f), won);
  assert.equal(hudPaints(f).length, paintCount);
  activate(f, 'coop-view-picture');
  assert.deepEqual(f.earnedDrawImages.at(-1), [image, 0, 0, 1152, 576]);
  activate(f, 'coop-picture-return');
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  assert.deepEqual(held(f), won);
  t.diagnostic(
    JSON.stringify({
      boundary:
        'Actual host/public keyboard commands; finite Canvas, not native or human qualification',
      referenceTicks: route.log.length,
      observedStates: [...seen],
    }),
  );
});
