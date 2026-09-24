import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';

const nearest = { block: 'nearest', inline: 'nearest', behavior: 'instant' };
const offscreen = { x: 118, y: 1080, width: 300, height: 47 };
const inside = { x: 118, y: 180, width: 300, height: 47 };

// Actual host/controls/confirmation with finite layout inputs from the observed
// 844×390 lobby. Browser scroll position and hit testing remain native checks.
async function returning(t, rect = offscreen) {
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport({ doc, win }) {
      Object.assign(win, doc.defaultView, { innerWidth: 844, innerHeight: 390 });
      doc.defaultView = win;
      doc.documentElement.clientWidth = 844;
      doc.documentElement.clientHeight = 390;
    },
  });
  f.$('coop-start').focus();
  f.tap('Enter');
  f.tick(120);
  f.$('coop-pause').click();
  f.$('coop-lobby').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').focus();
  const target = f.$('coop-start'),
    calls = [],
    picture = f.drawImages.findLast((image) => image.sha256),
    reads = f.artwork.calls.reads.length,
    urls = [...f.artwork.calls.urls],
    releases = [...f.artwork.calls.releases];
  target._rect = rect;
  t.mock.method(target, 'scrollIntoView', (options) => {
    calls.push({
      options,
      active: f.doc.activeElement.id,
      ready: f.$('coop-picture-status').dataset.state,
      menuVisible: !f.$('coop-menu').hidden,
      teaserVisible: !f.$('coop-preview-canvas').hidden,
    });
  });
  const listeners = [f.doc, f.win].map((node) => ({
    node,
    before: new Map([...node.captureListeners].map(([type, values]) => [type, new Set(values)])),
  }));
  const finish = () => {
    f.tap('Enter');
    for (const { node, before } of listeners)
      for (const [type, values] of node.captureListeners)
        for (const listener of values)
          assert.ok(
            before.get(type)?.has(listener),
            'The synchronous handoff retires every observer',
          );
  };
  return { ...f, target, calls, picture, reads, urls, releases, finish };
}

function unchangedPicture(f) {
  assert.ok(f.picture?.sha256, 'The retained picture is the decoded artwork, not an actor sprite.');
  assert.equal(f.artwork.calls.reads.length, f.reads);
  assert.deepEqual(f.artwork.calls.urls, f.urls);
  assert.deepEqual(f.artwork.calls.releases, f.releases);
  assert.equal(f.previewDrawImages.at(-1), f.picture);
}

test('confirmed Change setup reveals the offscreen focused Start after rendering its retained teaser', async (t) => {
  const f = await returning(t);
  f.finish();
  assert.equal(f.doc.activeElement, f.target);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.$('coop-play').hidden, true);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.deepEqual(f.calls, [
    {
      options: nearest,
      active: 'coop-start',
      ready: 'ready',
      menuVisible: true,
      teaserVisible: true,
    },
  ]);
  unchangedPicture(f);
  const clock = f.$('coop-clock').textContent;
  f.tick(120);
  assert.equal(
    f.$('coop-clock').textContent,
    clock,
    'Returning to setup does not start an attempt',
  );
  assert.equal(f.calls.length, 1, 'No delayed scroll task survives the handoff');
  f.tap('Enter');
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(
    f.drawImages.findLast((image) => image.sha256),
    f.picture,
  );
});

test('return to an already visible Start preserves the current viewport', async (t) => {
  const f = await returning(t, inside);
  f.finish();
  assert.equal(f.doc.activeElement, f.target);
  assert.deepEqual(f.calls, []);
  unchangedPicture(f);
});

for (const newer of [
  'focus',
  'focus-then-body',
  'settings',
  'start',
  'blur-return',
  'hidden-return',
  'pagehide',
  'pointer-intent',
  'key-intent',
])
  test(`a newer ${newer} during the lobby focus handoff vetoes its reveal`, async (t) => {
    const f = await returning(t);
    let changed = false;
    f.target.addEventListener('focusin', () => {
      if (changed) return;
      changed = true;
      if (newer === 'focus' || newer === 'focus-then-body') f.$('coop-level').focus();
      if (newer === 'focus-then-body') f.doc.body.focus();
      if (newer === 'settings') f.$('coop-settings-open').click();
      if (newer === 'start') f.target.click();
      if (newer === 'blur-return') {
        f.win.emit('blur');
        f.win.emit('focus');
      }
      if (newer === 'hidden-return') {
        f.doc.hidden = true;
        f.doc.emit('visibilitychange');
        f.doc.hidden = false;
        f.doc.emit('visibilitychange');
      }
      if (newer === 'pagehide') f.win.emit('pagehide');
      if (newer === 'pointer-intent') f.doc.body.emit('pointerdown', { pointerId: 9, button: 0 });
      if (newer === 'key-intent') f.doc.body.emit('keydown', { key: 'F9', code: 'F9' });
    });
    f.finish();
    assert.equal(changed, true);
    assert.deepEqual(f.calls, []);
    if (newer === 'focus') assert.equal(f.doc.activeElement.id, 'coop-level');
    if (newer === 'focus-then-body') assert.equal(f.doc.activeElement, f.doc.body);
    if (newer === 'settings') assert.equal(f.$('coop-options').open, true);
    if (newer === 'start') {
      assert.equal(f.$('coop-play').hidden, false);
      assert.equal(f.doc.activeElement.id, 'coop-canvas');
    }
  });

test('a newer selection during layout prevents the lobby from taking focus back', async (t) => {
  const f = await returning(t);
  const read = f.target.getBoundingClientRect.bind(f.target);
  let changed = false;
  t.mock.method(f.target, 'getBoundingClientRect', () => {
    if (!changed) {
      changed = true;
      f.$('coop-level').focus();
    }
    return read();
  });
  f.finish();
  assert.equal(changed, true);
  assert.equal(f.doc.activeElement.id, 'coop-level');
  assert.deepEqual(f.calls, []);
});

for (const invalid of ['disabled', 'hidden', 'invalid-viewport'])
  test(`an ${invalid} lobby target is not revealed`, async (t) => {
    const f = await returning(t);
    const original = f.target.focus.bind(f.target);
    t.mock.method(f.target, 'focus', (...args) => {
      original(...args);
      if (invalid === 'disabled') f.target.disabled = true;
      if (invalid === 'hidden') f.target.hidden = true;
      if (invalid === 'invalid-viewport') {
        f.doc.documentElement.clientHeight = Number.NaN;
        f.win.innerHeight = Number.NaN;
      }
    });
    f.finish();
    assert.deepEqual(f.calls, []);
  });
