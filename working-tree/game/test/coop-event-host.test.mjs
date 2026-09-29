import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';

const directionKeys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];
const shifts = ['ShiftLeft', 'ShiftRight'];

async function eventPage(t, { arena = 'first-connection', reduced = false } = {}) {
  const images = new Map(
    ['joint-capture', 'team-recovery'].map((kind) => [kind, { kind, width: 32, height: 32 }]),
  );
  const paints = [],
    stack = [];
  let state = { globalAlpha: 1 };
  const context = new Proxy(
    {},
    {
      get(_, key) {
        if (key in state) return state[key];
        return (...args) => {
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') state = stack.pop();
          if (key === 'drawImage') paints.push({ args, state: { ...state } });
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  const f = await page(t, {
    presentation: {
      load({ snapshot }) {
        const frames = new Map();
        for (const [kind, image] of images) {
          const id = `team.event.${kind}`,
            asset = { id: `${id}.host-test`, revision: 1, kind: 'image' };
          snapshot.resolved.assets[id] = asset;
          frames.set(id, {
            asset,
            image,
            geometry: { frame: { x: 0, y: 0, width: 32, height: 32 }, pivot: { x: 0.5, y: 0.5 } },
          });
        }
        snapshot.image = (id) => frames.get(id) ?? null;
      },
    },
    beforeImport({ $ }) {
      $('coop-event-art').getContext = () => context;
    },
  });
  if (arena !== 'first-connection') await f.choose('coop-level', arena);
  f.$('coop-reduced').checked = reduced;
  f.$('coop-reduced').onchange();
  f.$('coop-start').click();
  f.tick(2); // Establish RAF origin and consume the host's neutral input-release tick.
  assert.equal(f.$('coop-overlay').hidden, true);
  return { ...f, images, paints, stack };
}
function keyup(f, code) {
  f.doc.activeElement.emit('keyup', { key: code, code });
}
function segment(f, count, a, b, { boost = true, support = false, stepsPerFrame = 1 } = {}) {
  for (const key of shifts) keyup(f, key);
  if (boost) for (const key of shifts) f.press(key);
  for (const [index, direction] of [a, b].entries())
    if (direction) f.tap(directionKeys[index][direction]);
  if (support) {
    f.press('KeyQ');
    f.press('Enter');
  }
  const frames = Math.floor(count / stepsPerFrame);
  if (frames) f.tick(frames, { stepsPerFrame });
  if (count % stepsPerFrame) f.tick(1, { stepsPerFrame: count % stepsPerFrame });
  if (support) {
    keyup(f, 'KeyQ');
    keyup(f, 'Enter');
  }
}
function capture(f, arena = 'first-connection') {
  segment(f, 60, 'up', 'up');
  segment(f, arena === 'first-connection' ? 150 : 230, 'right', 'left');
  segment(f, 1, 'right', 'left', { support: true });
  segment(f, arena === 'first-connection' ? 203 : 123, 'right', 'left');
}
const caption = (f) => f.$('coop-message-text').textContent;
const icon = (f) => f.$('coop-event-art');

for (const arena of ['first-connection', 'relay-yard'])
  test(`${arena}: real keyboard joint capture draws accepted event art`, async (t) => {
    const f = await eventPage(t, { arena });
    capture(f, arena);
    assert.match(caption(f), /^Joint Cut!/);
    assert.equal(icon(f).hidden, false);
    assert.equal(f.paints.at(-1).args[0], f.images.get('joint-capture'));
    assert.equal(f.paints.at(-1).state.globalAlpha, 1);
    assert.equal(f.paints.at(-1).state.imageSmoothingEnabled, false);
    assert.equal(f.stack.length, 0);
    const text = caption(f);
    segment(f, 8, null, null, { boost: false, stepsPerFrame: 8 });
    assert.equal(caption(f), text);
    assert.equal(icon(f).hidden, false, 'later accumulator steps must not discard the event');
    assert.equal(f.paints.at(-1).args[0], f.images.get('joint-capture'));
  });

test('event earned early inside a multi-step paint remains visible at the final substep', async (t) => {
  const f = await eventPage(t);
  segment(f, 60, 'up', 'up');
  segment(f, 150, 'right', 'left');
  segment(f, 1, 'right', 'left', { support: true });
  segment(f, 200, 'right', 'left');
  const before = f.paints.length;
  f.tick(1, { stepsPerFrame: 8 });
  assert.match(caption(f), /^Joint Cut!/);
  assert.equal(icon(f).hidden, false);
  assert.equal(f.paints.length, before + 1, 'one paint after eight real simulation steps');
  assert.equal(f.paints.at(-1).args[0], f.images.get('joint-capture'));
});

test('expiry hides only artwork; pause holds timing and Retry clears accepted event', async (t) => {
  const f = await eventPage(t, { reduced: true });
  capture(f);
  assert.equal(icon(f).hidden, false);
  assert.deepEqual(
    f.paints.at(-1).args.slice(1),
    [0, 0, 32, 32],
    'reduced effects uses a still full-size icon',
  );
  const text = caption(f);
  f.$('coop-pause').click();
  const painted = f.paints.at(-1).args;
  f.tick(180);
  assert.equal(caption(f), text);
  assert.equal(icon(f).hidden, false);
  assert.deepEqual(f.paints.at(-1).args, painted);
  f.$('coop-resume').click();
  // Resume intentionally replaces the event caption with fresh-input guidance.
  assert.match(caption(f), /Choose fresh directions/);
  assert.equal(
    icon(f).hidden,
    true,
    'new authoritative status must remove old artwork immediately',
  );
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(icon(f).hidden, true);
  assert.doesNotMatch(caption(f), /Joint Cut!/);
  f.tick(2);
  capture(f);
  assert.equal(icon(f).hidden, false, 'new attempt can independently earn its own event');
  const secondText = caption(f);
  segment(f, 160, null, null, { boost: false });
  assert.equal(icon(f).hidden, true);
  assert.equal(caption(f), secondText, 'expiry must not rewrite the authoritative caption');
});

test('actual shared reserve recovery uses its own artwork and retains exact reserve HUD', async (t) => {
  const f = await eventPage(t, { arena: 'relay-yard' });
  for (const [ticks, a, b, boost = true] of [
    [140, 'right', 'left'],
    [70, 'up', 'up'],
    [214, 'right', 'left'],
    [1, null, null, false],
    [24, 'left', 'right'],
    [35, 'up', 'up'],
  ])
    segment(f, ticks, a, b, { boost });
  assert.match(caption(f), /Both craft are back\. One team reserve used/);
  assert.equal(f.$('coop-reserves').textContent, '2 reserves');
  assert.equal(icon(f).hidden, false);
  assert.equal(f.paints.at(-1).args[0], f.images.get('team-recovery'));
  segment(f, 8, null, null, { boost: false, stepsPerFrame: 8 });
  assert.equal(icon(f).hidden, false);
  assert.equal(f.paints.at(-1).args[0], f.images.get('team-recovery'));
});
