import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { coverageClear } from './helpers/coop-route-search.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

// Actual Team markup, host, core and property handlers, exact prepared originals,
// finite DOM/Image and independent inert Canvas recorders. Not native pixels,
// CSS layout, physical input, offline or public-release acceptance.
const options = { nativeFocus: true, nativeVisibility: true, capturePaint: true };
const figure = (f) => {
  const node = f.$('coop-picture-preview');
  assert.ok(node, 'The Team lobby has an explicit artwork preview.');
  return node;
};
const previewState = (f) => figure(f).dataset.state;
const settle = (f, expected = 'ready') =>
  waitFor(
    () => f.$('coop-picture-status').dataset.state === expected,
    () => f.$('coop-picture-status').textContent,
  );
const flush = () => new Promise((resolve) => setImmediate(resolve));
const lastPreview = (f) => f.previewDrawImages.at(-1);
const lastArena = (f) => f.drawImages.at(-1);
function assertMysteryPreview(f) {
  const canvas = f.$('coop-preview-canvas'),
    image = lastPreview(f),
    width = canvas.width,
    height = canvas.height;
  // Interpret the finite Canvas trace at actual picture coordinates. This checks
  // visible centre/border outcomes, not browser rasterization or a method count.
  const points = [
    [width / 2, height / 2, '#000'],
    [16, 16, '#000'],
    [width - 16, height - 16, '#000'],
    [0.5, height / 2, image],
    [width - 0.5, height / 2, image],
    [width / 2, 0.5, image],
    [width / 2, height - 0.5, image],
  ];
  let state = {},
    pixels = points.map(() => null);
  for (const [name, ...args] of f.previewOperations) {
    if (name === 'resize') {
      state = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000' };
      pixels.fill(null);
      continue;
    }
    if (name === 'set') {
      state[args[0]] = args[1];
      continue;
    }
    if (!['drawImage', 'fillRect', 'clearRect'].includes(name)) continue;
    const [x, y, w, h] = name === 'drawImage' ? args.slice(1) : args;
    const value =
      name === 'drawImage'
        ? args[0]
        : name === 'clearRect'
          ? null
          : state.globalAlpha === 1 && state.globalCompositeOperation === 'source-over'
            ? state.fillStyle
            : 'not opaque';
    for (let index = 0; index < points.length; index++) {
      const [px, py] = points[index];
      if (px >= x && px < x + w && py >= y && py < y + h) pixels[index] = value;
    }
  }
  points.forEach(([x, y, expected], index) =>
    assert.equal(
      pixels[index],
      expected,
      `Lobby picture at ${x},${y} preserves the mystery border policy.`,
    ),
  );
  assert.match(f.$('coop-preview-caption').textContent, /win to reveal the full picture/i);
}

const previewClears = (f) =>
  f.previewOperations.filter(([name]) => name === 'clearRect' || name === 'resize').length;
function assertHiddenPreview(f, state) {
  assert.equal(previewState(f), state);
  assert.equal(f.$('coop-preview-canvas').hidden, true);
  assert.ok(previewClears(f) > 0, 'Non-ready artwork clears its previous pixels.');
}
function assertLobbyOwned(f) {
  const preview = figure(f);
  assert.equal(f.$('coop-menu').contains(preview), true);
  assert.equal(f.$('coop-tools').contains(preview), false);
  assert.equal(f.$('coop-overlay').contains(preview), false);
  const parent = f.$('coop-start').parentNode;
  assert.equal(preview.parentNode, parent, 'Preview and Start share their menu-copy container.');
  assert.equal(parent.classList.contains('menu-copy'), true);
  const children = [...parent.children];
  assert.ok(
    children.indexOf(preview) < children.indexOf(f.$('coop-start')),
    'Authored DOM order places the preview before Start; this is not a native CSS/layout claim.',
  );
}
function start(f) {
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  f.tick(4);
}

for (const [level, name, bindingIndex] of [
  ['relay-yard', 'Relay Yard', 1],
  ['first-connection', 'First Connection', 0],
])
  test(`${name} preview and arena borrow one exact prepared image without preview reads or automatic Start`, async (t) => {
    const f = await page(t, options);
    if (level !== 'relay-yard') await f.choose('coop-level', level);
    const expectedPreparations = level === 'relay-yard' ? 1 : 2;
    assertLobbyOwned(f);
    assert.equal(figure(f).tagName, 'FIGURE');
    assert.equal(figure(f).querySelectorAll('button,a,input,select,[tabindex]').length, 0);
    assert.equal(
      figure(f).getAttribute('aria-live'),
      null,
      'Existing readiness status owns announcements.',
    );
    assert.equal(f.$('coop-preview-canvas').getAttribute('aria-hidden'), 'true');
    assert.equal(f.$('coop-preview-canvas').getAttribute('width'), '576');
    assert.equal(f.$('coop-preview-canvas').getAttribute('height'), '288');
    assert.equal(f.$('coop-preview-canvas').width, 576);
    assert.equal(f.$('coop-preview-canvas').height, 288);
    assert.equal(f.$('coop-preview-canvas').hidden, false);
    assert.equal(previewState(f), 'ready');
    assert.match(f.$('coop-preview-caption').textContent, new RegExp(name, 'i'));
    assert.ok(f.$('coop-preview-message').textContent.length > 0);
    const image = lastPreview(f);
    const drawIndex = f.previewOperations.findLastIndex(([name]) => name === 'drawImage');
    const draw = f.previewOperations[drawIndex];
    assert.equal(draw[1], image);
    assert.deepEqual(
      draw.slice(2),
      [0, 0, 576, 288],
      'The exact original keeps its complete 2:1 mapping beneath the teaser mask.',
    );
    const smoothing = f.previewOperations
      .slice(0, drawIndex)
      .findLast(([name, property]) => name === 'set' && property === 'imageSmoothingEnabled');
    assert.deepEqual(
      smoothing,
      ['set', 'imageSmoothingEnabled', false],
      'Pixel preview uses nearest sampling.',
    );
    assert.equal(image.sha256, COOP_PICTURE_BINDINGS[bindingIndex].picture.sha256);
    assert.equal(f.artwork.calls.reads.length, expectedPreparations);
    assert.equal(f.artwork.calls.decodes.length, expectedPreparations);
    assert.equal(f.drawImages.length, 0, 'Preview cannot masquerade as an arena render.');
    f.tick(30);
    assert.equal(f.drawImages.length, 0, 'Ready does not start a run.');
    start(f);
    assert.equal(lastArena(f), image);
    assert.equal(f.artwork.calls.reads.length, expectedPreparations);
    assert.equal(f.artwork.calls.decodes.length, expectedPreparations);
    assertLobbyOwned(f);
  });

for (const [level, index] of [
  ['relay-yard', 1],
  ['first-connection', 0],
])
  test(`${level} ready lobby hides the picture centre until an earned win`, async (t) => {
    const f = await page(t, options);
    if (level !== 'relay-yard') await f.choose('coop-level', level);
    assertMysteryPreview(f);
    const image = lastPreview(f),
      reads = f.artwork.calls.reads.length;
    assert.equal(image.sha256, COOP_PICTURE_BINDINGS[index].picture.sha256);
    assert.equal(f.drawImages.length, 0, 'No run is invented for the teaser.');
    f.tick(30);
    assertMysteryPreview(f);
    assert.equal(f.drawImages.length, 0);
    start(f);
    assert.equal(lastArena(f), image);
    f.$('coop-pause').click();
    f.$('coop-lobby').click();
    f.$('coop-discard-confirm').click();
    assert.equal(f.$('coop-menu').hidden, false);
    assertMysteryPreview(f);
    assert.equal(lastPreview(f), image);
    assert.equal(f.artwork.calls.reads.length, reads);
  });

test('selecting another arena immediately hides and clears old lobby art until its owned read finishes', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    presentation: { read: ({ calls }) => (calls.reads.length === 2 ? gate.promise : undefined) },
  });
  const old = lastPreview(f),
    clears = previewClears(f);
  f.$('coop-level').focus();
  const changing = f.choose('coop-level', 'first-connection');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  assertHiddenPreview(f, 'preparing');
  assert.ok(previewClears(f) > clears);
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.drawImages.length, 0);
  gate.resolve();
  await changing;
  assert.equal(previewState(f), 'ready');
  assert.notEqual(lastPreview(f), old);
  assert.equal(lastPreview(f).sha256, COOP_PICTURE_BINDINGS[0].picture.sha256);
  assert.equal(f.doc.activeElement.id, 'coop-start');
});

test('held artwork completes behind Settings without reclaiming its selector or starting an arena', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    presentation: { read: ({ calls }) => (calls.reads.length === 2 ? gate.promise : undefined) },
  });
  const changing = f.choose('coop-level', 'first-connection');
  await waitFor(() => f.artwork.calls.reads.length === 2);
  assertHiddenPreview(f, 'preparing');
  f.$('coop-settings-open').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-options').open, true);
  const selector = f.$('coop-text-size');
  selector.focus();
  selector.value = 'large';
  selector.emit('change');
  assert.equal(f.doc.activeElement, selector);
  gate.resolve();
  await changing;
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.doc.activeElement, selector);
  assert.equal(selector.value, 'large');
  assertMysteryPreview(f);
  assert.equal(lastPreview(f).sha256, COOP_PICTURE_BINDINGS[0].picture.sha256);
  assert.equal(f.artwork.calls.reads.length, 2);
  assert.equal(f.artwork.calls.decodes.length, 2);
  assert.equal(f.drawImages.length, 0, 'Neither readiness nor Settings starts a flight.');
  f.$('coop-settings-close').click();
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.drawImages.length, 0);
});

test('late superseded read cannot draw or clear the newer arena preview or reclaim focus', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: { read: ({ calls }) => (calls.reads.length === 1 ? gate.promise : undefined) },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  assertHiddenPreview(f, 'preparing');
  await f.choose('coop-level', 'first-connection');
  f.$('coop-versus').focus();
  const image = lastPreview(f),
    operations = f.previewOperations.length;
  gate.resolve();
  await flush();
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(image.sha256, COOP_PICTURE_BINDINGS[0].picture.sha256);
  assert.equal(
    f.previewOperations.length,
    operations,
    'An obsolete completion cannot even clear current art.',
  );
  assert.equal(f.doc.activeElement.id, 'coop-versus');
  assert.equal(f.artwork.calls.decodes.length, 1);
});

test('cancelled decode clears preview; late completion cannot change a successful explicit Retry', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: {
      decode: ({ calls }) => (calls.decodes.length === 1 ? gate.promise : undefined),
    },
  });
  await waitFor(() => f.artwork.calls.decodes.length === 1);
  f.$('coop-picture-cancel').click();
  assertHiddenPreview(f, 'cancelled');
  assert.equal(f.$('coop-start').disabled, true);
  f.$('coop-picture-retry').click();
  await settle(f);
  const image = lastPreview(f),
    operations = f.previewOperations.length;
  gate.resolve();
  await flush();
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(f.previewOperations.length, operations);
  assert.equal(f.artwork.calls.decodes.length, 2);
  assert.equal(f.artwork.calls.releases.length, 1);
  start(f);
  assert.equal(lastArena(f), image);
});

test('required original decode failure shows no lobby art and Retry prepares the same exact slot', async (t) => {
  let refuse = true;
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: {
      decode: () => {
        if (refuse) throw new Error('Controlled required picture refusal');
      },
    },
  });
  await settle(f, 'error');
  assertHiddenPreview(f, 'error');
  assert.equal(f.previewDrawImages.length, 0);
  assert.equal(f.$('coop-start').disabled, true);
  refuse = false;
  f.$('coop-picture-retry').focus();
  f.tap('Enter');
  await settle(f);
  assert.equal(previewState(f), 'ready');
  assert.equal(f.artwork.calls.reads.length, 2);
  assert.equal(f.artwork.calls.reads[0].slot, f.artwork.calls.reads[1].slot);
  assert.equal(lastPreview(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  assert.equal(f.doc.activeElement.id, 'coop-start');
});

test('Pause and confirmed Change setup leave preview in the lobby and reuse the accepted image without another read', async (t) => {
  const f = await page(t, options),
    image = lastPreview(f);
  assert.ok(image);
  start(f);
  f.$('coop-pause').click();
  assert.equal(f.$('coop-overlay').hidden, false);
  assertLobbyOwned(f);
  assert.equal(f.$('coop-menu').hidden, true);
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(f.$('coop-preview-canvas').hidden, false);
  assert.equal(f.artwork.calls.reads.length, 1);
  assert.equal(f.artwork.calls.decodes.length, 1);
  assert.equal(f.artwork.calls.releases.length, 0);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assertLobbyOwned(f);
});

test('legacy procedural import clears artwork, loss keeps preview outside Results, and reset restores exact starter art', async (t) => {
  const f = await page(t, options),
    custom = structuredClone(COOP_STARTER_PACK);
  custom.id = 'preview-procedural';
  custom.name = 'Preview procedural fixture';
  custom.levels[0].enemies = [];
  await f.selectFile(JSON.stringify(custom));
  assertHiddenPreview(f, 'procedural');
  assert.equal(f.$('coop-start').disabled, false);
  assert.match(f.$('coop-preview-message').textContent, /procedural/i);
  assert.equal(f.artwork.calls.reads.length, 1);
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-start').click();
  f.tick(3);
  for (let loop = 0; loop < 2; loop++)
    for (const [first, second, ticks] of [
      ['KeyD', 'ArrowLeft', 30],
      ['KeyW', 'ArrowUp', 15],
      ['KeyD', 'ArrowLeft', 15],
      ['KeyS', 'ArrowDown', 15],
      ['KeyA', 'ArrowRight', 15],
    ]) {
      f.tap(first);
      f.tap(second);
      f.tick(ticks);
    }
  assert.equal(f.$('coop-overlay-kicker').textContent, 'ONE MORE SHARED PLAN');
  assert.equal(f.$('coop-overlay').hidden, false);
  assertLobbyOwned(f);
  assert.equal(f.$('coop-menu').hidden, true);
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-menu').hidden, false);
  f.$('coop-pack-reset').click();
  await settle(f);
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  assert.equal(f.artwork.calls.reads.length, 2);
});

test('persisted pagehide retains accepted preview; terminal cleanup clears it and late lifecycle events cannot redraw', async (t) => {
  const f = await page(t, options),
    image = lastPreview(f);
  assert.ok(image);
  f.win.emit('pagehide', { persisted: true });
  assert.equal(f.artwork.calls.releases.length, 0);
  f.win.emit('pageshow', { persisted: true });
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(f.artwork.calls.reads.length, 1);
  const clears = previewClears(f);
  f.win.emit('pagehide', { persisted: false });
  assert.equal(f.$('coop-preview-canvas').hidden, true);
  assert.ok(previewClears(f) > clears);
  assert.equal(f.artwork.calls.releases.length, 1);
  const operations = f.previewOperations.length;
  f.win.emit('pagehide', { persisted: false });
  f.win.emit('pageshow', { persisted: true });
  assert.equal(f.previewOperations.length, operations);
  assert.equal(f.artwork.calls.releases.length, 1);
});

test('lobby-only paint failure keeps Start ready and Retry preview repaints the same image without network, decode or focus theft', async (t) => {
  const f = await page(t, {
    ...options,
    beforeImport: ({ failNextPreviewPaint }) => failNextPreviewPaint(),
  });
  assertHiddenPreview(f, 'unavailable');
  assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-picture-retry').hidden, false);
  assert.match(f.$('coop-picture-retry').textContent, /retry preview/i);
  assert.equal(f.artwork.calls.reads.length, 1);
  assert.equal(f.artwork.calls.decodes.length, 1);
  const image = f.artwork.calls.decodes[0];
  f.$('coop-versus').focus();
  const attempts = f.focusAttempts.length;
  await f.$('coop-picture-retry').onclick();
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(f.artwork.calls.reads.length, 1);
  assert.equal(f.artwork.calls.decodes.length, 1);
  assert.equal(f.focusAttempts.length, attempts);
  assert.equal(f.doc.activeElement.id, 'coop-versus');
  assert.equal(f.$('coop-picture-retry').hidden, true);
  start(f);
  assert.equal(lastArena(f), image);
});

test('missing preview Canvas context never blocks a fully prepared playable arena', async (t) => {
  const f = await page(t, { ...options, previewContextAvailable: false });
  assert.ok(['error', 'unavailable'].includes(previewState(f)));
  assert.equal(f.$('coop-preview-canvas').hidden, true);
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.previewDrawImages.length, 0);
  assert.equal(f.artwork.calls.reads.length, 1);
  start(f);
  assert.equal(lastArena(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
});

test('fresh pointer intent during loading permits preview publication without adding a focus handoff', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: { read: () => gate.promise },
  });
  assertHiddenPreview(f, 'preparing');
  f.$('coop-intro').emit('pointerdown', { button: 0, pointerType: 'mouse' });
  const attempts = f.focusAttempts.length;
  gate.resolve();
  await settle(f);
  assert.equal(previewState(f), 'ready');
  assert.equal(f.focusAttempts.length, attempts);
  assert.equal(f.drawImages.length, 0);
});

test('earned First Connection victory keeps preview in the hidden lobby and Change setup reuses its exact lease', async (t) => {
  const f = await page(t, options);
  await f.choose('coop-level', 'first-connection');
  const image = lastPreview(f),
    reads = f.artwork.calls.reads.length;
  assert.ok(image);
  f.$('coop-start').focus();
  f.tap('Enter');
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
  const route = coverageClear('standard', { boost: true, cover: true });
  assert.equal(route.run.status, 'won');
  f.tick();
  for (const commands of route.log) {
    commands.forEach((command, seat) => {
      if (command.direction) f.tap(keys[seat][command.direction]);
      if (command.boost) f.press(keys[seat].boost);
      if (command.support) f.press(keys[seat].support);
    });
    f.tick();
    commands.forEach((command, seat) => {
      for (const action of ['boost', 'support'])
        if (command[action])
          f.doc.activeElement.emit('keyup', { key: keys[seat][action], code: keys[seat][action] });
    });
    if (!f.$('coop-overlay').hidden) break;
  }
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assertMysteryPreview(f); // The hidden lobby never turns into an unearned full-image gallery.
  assertLobbyOwned(f);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(lastArena(f), image);
  f.$('coop-lobby').click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.doc.activeElement.id, 'coop-start');
});

test('preview-only failure does not move Retry into play or Pause, and focused keyboard Retry returns to enabled Start', async (t) => {
  const f = await page(t, {
    ...options,
    beforeImport: ({ failNextPreviewPaint }) => failNextPreviewPaint(),
  });
  assertHiddenPreview(f, 'unavailable');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-picture-retry').hidden, false);
  const image = f.artwork.calls.decodes[0];
  start(f);
  assert.equal(lastArena(f), image);
  assert.equal(
    f.$('coop-picture-retry').hidden,
    true,
    'A lobby paint retry is not a flight action.',
  );
  f.$('coop-pause').click();
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(
    f.$('coop-picture-retry').hidden,
    true,
    'Moving shared tools to Pause cannot expose lobby Retry.',
  );
  assertLobbyOwned(f);
  f.failNextPreviewPaint();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  assertHiddenPreview(f, 'unavailable');
  assert.equal(f.$('coop-start').disabled, false);
  f.$('coop-picture-retry').focus();
  f.tap('Enter');
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f), image);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-menu').hidden, false, 'Retry preview cannot also start the arena.');
  assert.equal(f.$('coop-picture-retry').hidden, true);
  assert.equal(f.artwork.calls.reads.length, 1);
  assert.equal(f.artwork.calls.decodes.length, 1);
  assert.equal(f.artwork.calls.releases.length, 0);
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(lastArena(f), image);
});

test('required read failure and a changed starter identity each clear old preview before exposing recovery', async (t) => {
  const faults = [];
  t.mock.method(console, 'error', (...args) => faults.push(args));
  const f = await page(t, {
    ...options,
    presentation: {
      read: ({ calls }) => {
        if (calls.reads.length === 2) throw new Error('Controlled required picture read failure');
      },
    },
  });
  const old = lastPreview(f),
    clears = previewClears(f);
  assert.ok(old);
  await f.choose('coop-level', 'first-connection');
  await settle(f, 'error');
  assertHiddenPreview(f, 'error');
  assert.ok(previewClears(f) > clears);
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.artwork.calls.decodes.length, 1, 'Failed read must not reach the decoder.');
  assert.equal(
    f.previewDrawImages.length,
    1,
    'The old preview cannot stand in for failed required art.',
  );
  f.$('coop-picture-retry').focus();
  f.tap('Enter');
  await settle(f);
  assert.equal(previewState(f), 'ready');
  assert.equal(lastPreview(f).sha256, COOP_PICTURE_BINDINGS[0].picture.sha256);
  const reads = f.artwork.calls.reads.length,
    beforeImportClears = previewClears(f);
  const changed = structuredClone(COOP_STARTER_PACK);
  changed.name += ' changed';
  await f.selectFile(JSON.stringify(changed));
  await settle(f, 'error');
  assertHiddenPreview(f, 'error');
  assert.ok(previewClears(f) > beforeImportClears);
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(
    f.artwork.calls.reads.length,
    reads,
    'Changed starter identity fails before reading image bytes.',
  );
  assert.equal(
    f.$('coop-picture-status').textContent,
    'Team picture unavailable. Retry picture or choose another arena.',
  );
  assert.equal(faults.length, 2);
  assert.ok(faults.every(([prefix]) => prefix === 'Team picture preparation failed.'));
  assert.match(faults[0][1].message, /Controlled required picture read failure/);
  assert.match(faults[1][1].message, /No exact Team picture binding/);
  assert.equal(f.drawImages.length, 0);
});

test('preview reset failure cannot block a newly prepared arena or interrupt terminal image disposal', async (t) => {
  const f = await page(t, options);
  assert.equal(previewState(f), 'ready');
  const oldImage = lastPreview(f),
    operations = f.previewOperations.length;
  f.setPreviewResetFailure(true);
  await assert.doesNotReject(f.choose('coop-level', 'first-connection'));
  assert.equal(previewState(f), 'unavailable');
  assert.equal(f.$('coop-preview-canvas').hidden, true, 'Unclearable old pixels remain concealed.');
  assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.artwork.calls.reads.length, 2);
  assert.equal(f.artwork.calls.decodes.length, 2);
  assert.equal(lastPreview(f), oldImage, 'A failed reset cannot publish another canvas draw.');
  assert.ok(
    f.previewOperations.slice(operations).some(([name]) => name === 'resize'),
    'Record the attempted failing reset.',
  );
  assert.deepEqual(f.artwork.calls.releases, [f.artwork.calls.urls[0]]);
  const image = f.artwork.calls.decodes[1];
  assert.equal(image.sha256, COOP_PICTURE_BINDINGS[0].picture.sha256);
  start(f);
  assert.equal(
    lastArena(f),
    image,
    'The preview surface cannot invalidate the prepared gameplay original.',
  );
  assert.doesNotThrow(() => f.win.emit('pagehide', { persisted: false }));
  assert.doesNotThrow(() => f.win.emit('pagehide', { persisted: false }));
  assert.deepEqual(
    f.artwork.calls.releases,
    f.artwork.calls.urls,
    'Both old and current originals release exactly once despite reset failure.',
  );
  assert.equal(f.artwork.calls.closes, 1);
  assert.equal(f.$('coop-preview-canvas').hidden, true);
  f.setPreviewResetFailure(false);
});
