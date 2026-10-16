import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { attachCreatorPlayerNavigation } from '../creator/player-navigation.mjs';
import { generateCreatorProject } from '../creator/templates.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { approveCreatorBundle, prepareCreatorBundle } from '../creator/bundle.mjs';
import {
  createCreatorStore,
  installPreparedCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import { creatorAttemptKey } from '../creator/runtime.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { REWARD_BOARD_SECONDS } from '../ui/reward-arrival.mjs';
import { createCelebration } from '../ui/celebration.mjs';

const html = await readFile(new URL('../creator/player.html', import.meta.url), 'utf8');
const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
let sequence = 0;

function pageBoundary() {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  mountCouch(doc, html);
  const $ = (id) => doc.getElementById(id),
    frames = new Map();
  let now = 1000,
    serial = 0,
    reads = 0,
    pad = null,
    onFrame = null;
  let locationURL = new URL('http://localhost/game/creator/player.html');
  Object.assign(win, {
    location: {
      get href() {
        return locationURL.href;
      },
      set href(value) {
        locationURL = new URL(value, locationURL);
      },
      get search() {
        return locationURL.search;
      },
      set search(value) {
        locationURL.search = value;
      },
      get origin() {
        return locationURL.origin;
      },
      get hash() {
        return locationURL.hash;
      },
    },
    navigator: {
      getGamepads: () => {
        reads++;
        return pad ? [pad] : [];
      },
    },
    performance: { now: () => now },
    File,
    DataTransfer: class {
      files = [];
      items = { add: (file) => this.files.push(file) };
    },
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  // This finite DOM supplies stable geometry; browser layout is checked separately.
  [...doc.querySelectorAll('button,a,select,input,summary')].forEach((node, index) => {
    node._rect = { x: 0, y: index * 60, width: 200, height: 44 };
  });
  for (const input of doc.querySelectorAll('input[type="file"]'))
    input.accept = input.getAttribute('accept');
  const frame = (ms = 16) => {
    now += ms;
    if (pad) pad.timestamp = now;
    if (onFrame) onFrame(now);
    else {
      const pending = [...frames];
      frames.clear();
      pending.forEach(([, callback]) => callback(now));
    }
  };
  const button = (index, pressed, sampled = true) => {
    pad.buttons[index] = { pressed, value: pressed ? 1 : 0 };
    if (sampled) frame();
  };
  const tap = (index) => {
    button(index, true);
    button(index, false);
  };
  const key = (value, pressed = true) => {
    const event = doc.activeElement.emit(pressed ? 'keydown' : 'keyup', {
      key: value,
      code:
        {
          Escape: 'Escape',
          Enter: 'Enter',
          ArrowUp: 'ArrowUp',
          ArrowDown: 'ArrowDown',
          ArrowLeft: 'ArrowLeft',
          ArrowRight: 'ArrowRight',
        }[value] || value,
      repeat: false,
    });
    if (pressed && value === 'Escape' && !event.defaultPrevented) {
      const dialog = [...doc.querySelectorAll('dialog[open]')].at(-1);
      if (dialog && !dialog.emit('cancel', { cancelable: true }).defaultPrevented) dialog.close();
    }
    return event;
  };
  return {
    doc,
    win,
    $,
    frames,
    frame,
    button,
    tap,
    key,
    reads: () => reads,
    startFrames(callback) {
      onFrame = callback;
    },
    connect() {
      pad = {
        id: 'Creator menu virtual pad',
        index: 0,
        mapping: 'standard',
        connected: true,
        timestamp: now,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      frame();
    },
    disconnect() {
      pad = null;
      frame();
    },
  };
}

test('custom menu owns controls and recovery dialogs, then yields all pad reads and arrows to flight', () => {
  const page = pageBoundary(),
    { doc, win, $, tap, frame } = page;
  let scope = 'creator-menu',
    starts = 0,
    imports = 0;
  $('start').disabled = false;
  $('creator-primary-actions').append($('start'));
  $('import-attempt').disabled = false;
  $('import-attempt').onchange = () => imports++;
  $('start').onclick = () => {
    starts++;
    scope = 'flight';
  };
  const host = attachCreatorPlayerNavigation({
    document: doc,
    window: win,
    getScope: () => scope,
    getDefaultFocus: () => $('start'),
  });
  page.startFrames((now) => host.update(now));
  page.connect();
  assert.equal(doc.activeElement, $('start'));
  page.button(0, true);
  assert.equal(starts, 0, 'Confirm waits for release');
  page.button(0, false);
  assert.equal(starts, 1);
  const reads = page.reads();
  frame();
  frame();
  assert.equal(page.reads(), reads, 'the gameplay adapter is the sole flight sampler');
  assert.equal(page.key('ArrowDown').defaultPrevented, false);
  assert.equal(
    page.key('Enter').defaultPrevented,
    true,
    'the just-released Start gesture still drains native echoes',
  );
  page.key('Enter', false);
  frame(1300);
  assert.equal(page.key('Enter').defaultPrevented, false);
  assert.equal(page.reads(), reads, 'native flight keys do not probe menu Confirm');
  scope = 'creator-menu';
  host.refresh({ focus: true });
  page.button(0, true);
  frame();
  page.button(0, false);
  assert.equal(starts, 1, 'held/first input after handoff requires neutral');
  const settings = $('creator-settings');
  settings.showModal();
  $('creator-panel-gameplay').hidden = true;
  $('creator-panel-data').hidden = false;
  $('import-attempt').focus();
  frame();
  tap(0);
  const dialog = doc.getElementById('creator-player-sources');
  assert.equal(dialog.open, true);
  assert.equal(doc.activeElement, dialog.querySelector('button'));
  frame(); // Observe neutral in the new modal scope before its first action.
  tap(1);
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, $('import-attempt'));
  assert.equal(imports, 0, 'Back never imports or touches the host save');
  frame();
  tap(1);
  assert.equal(settings.open, false);
  const beforeHidden = page.reads();
  doc.hidden = true;
  frame();
  assert.equal(page.reads(), beforeHidden);
  doc.hidden = false;
  doc.focused = false;
  frame();
  assert.equal(page.reads(), beforeHidden);
  host.destroy();
  assert.equal(doc.getElementById('creator-player-sources'), null);
  frame();
  assert.equal(page.reads(), beforeHidden);
});

test('creator menu captures a native Confirm tap between frames without a duplicate release action', () => {
  const page = pageBoundary(),
    { doc, win, $ } = page;
  let clicks = 0;
  $('start').disabled = false;
  $('creator-primary-actions').append($('start'));
  $('start').onclick = () => clicks++;
  const host = attachCreatorPlayerNavigation({
    document: doc,
    window: win,
    getScope: () => 'creator-menu',
    getDefaultFocus: () => $('start'),
  });
  page.startFrames((now) => host.update(now));
  try {
    page.connect();
    page.button(0, true, false);
    const down = $('start').emit('keydown', { key: 'Enter', isTrusted: true });
    assert.equal(down.defaultPrevented, true);
    assert.equal(clicks, 0);
    page.button(0, false, false);
    const up = $('start').emit('keyup', { key: 'Enter', isTrusted: true });
    assert.equal(up.defaultPrevented, true);
    assert.equal(clicks, 1, 'native release commits the captured target before the next frame');
    $('start').emit('click', { isTrusted: true });
    page.frame();
    assert.equal(clicks, 1, 'compatibility click and following frame cannot commit again');
  } finally {
    host.destroy();
  }
});

class Locks {
  held = new Set();
  async request(name, _options, work) {
    if (this.held.has(name)) return work(null);
    this.held.add(name);
    try {
      return await work({ name });
    } finally {
      this.held.delete(name);
    }
  }
}

async function installedFixture() {
  const databases = new Map();
  const indexedDB = {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
  const generated = generateCreatorProject({ id: 'player-menu', name: 'Menu route', seed: 8 });
  const project = structuredClone(generated.project);
  const blob = new Blob([pngBytes()], { type: 'image/png' });
  const sha256 = await creatorSHA256(await blob.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'Player menu fixture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  const pack = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: [generated.provenance],
      credits: {
        creator: 'Host fixture',
        picture: 'Original fixture',
        license: 'Fixture permission',
      },
    },
    [{ sha256, blob }],
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const store = createCreatorStore({ indexedDB }),
    approval = approveCreatorBundle(pack);
  await installPreparedCreatorBundle(
    store,
    pack,
    approval,
    await reviewCreatorInstallation(store, pack, approval),
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  store.close();
  const values = new Map(),
    writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      writes.push([key, value]);
    },
    removeItem: (key) => values.delete(key),
  };
  const route = pack.manifest.evidence.find(
    (row) => row.difficulty === 'standard' && row.turnPolicy === 'immediate',
  );
  return { pack, route, indexedDB, storage, writes };
}

async function playerHost(t, fixture, { invalidEdition = false, setLook = async () => {} } = {}) {
  const page = pageBoundary(),
    { doc, win, $ } = page;
  win.location.search = `?edition=${invalidEdition ? 'missing' : fixture.pack.editionId}`;
  win.navigator.locks = new Locks();
  let run = null,
    drawOptions = null;
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {});
  t.mock.method(BoardPainter.prototype, 'setLook', setLook);
  t.mock.method(BoardPainter.prototype, 'draw', function (_context, current, _dt, options) {
    run = current;
    drawOptions = options;
    if (current.status === 'won' && !this.celebration)
      this.celebration = createCelebration({ levelId: current.level.id, seed: current.seed });
  });
  // The board draw is modeled above; the earned overlay still runs its native
  // celebration against this finite Canvas API boundary (not a pixel review).
  const earnedContext = $('earned-confetti').getContext('2d');
  for (const name of ['beginPath', 'rect', 'clip', 'moveTo', 'lineTo', 'closePath', 'fill'])
    earnedContext[name] = () => {};
  const globals = {
    document: doc,
    window: win,
    navigator: win.navigator,
    location: win.location,
    indexedDB: fixture.indexedDB,
    localStorage: fixture.storage,
    performance: win.performance,
    Image: PNGImage,
    matchMedia: () => ({ matches: false }),
    fetch: async (path) =>
      new Response(await readFile(new URL(path, new URL('../creator/', import.meta.url)))),
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
  };
  const original = new Map();
  for (const [name, value] of Object.entries(globals)) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  Object.assign(win, { fetch: globals.fetch });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    win.emit('pagehide');
    assert.equal(page.frames.size, 0, 'one existing RAF is stopped at teardown');
    for (const [name, value] of original)
      if (value) Object.defineProperty(globalThis, name, value);
      else delete globalThis[name];
  };
  t.after(close);
  await import(`../creator/player.mjs?controller=${++sequence}`);
  assert.equal(page.frames.size, 1, 'menu and game share one scheduled frame');
  if (!invalidEdition) assert.equal($('start').disabled, false, $('status').textContent);
  return { ...page, close, run: () => run, drawOptions: () => drawOptions };
}

const settle = async (condition) => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert(condition(), 'the actual player operation completes');
};

test('installed custom player starts, pauses, saves and resumes through one controller menu owner', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture);
  const { $, doc } = page;
  page.connect();
  assert.equal(doc.activeElement, $('start'));
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  assert.equal(doc.activeElement, $('arena'));
  assert(page.run());
  page.frame();
  const before = page.run().tick;
  page.frame();
  assert(page.run().tick > before, 'flight continues through its original runtime input');
  page.tap(9);
  assert.equal(doc.activeElement, $('pause'));
  const checkpoint = authoritativeCheckpoint(page.run());
  const pausedTick = page.run().tick;
  const saved = fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId));
  assert(saved, 'pause retains an unfinished attempt through the original save handler');
  const writes = fixture.writes.length;
  page.frame();
  page.frame();
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  page.tap(13);
  assert.equal(doc.activeElement, $('creator-select-mission'));
  page.tap(0);
  assert.equal($('creator-missions').open, true);
  page.frame();
  page.tap(0);
  assert.equal($('creator-replace-attempt').open, true);
  assert.equal(doc.activeElement, $('creator-replace-cancel'));
  page.frame();
  page.tap(1);
  assert.equal($('creator-replace-attempt').open, false);
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  assert.equal(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)), saved);
  page.frame();
  page.tap(1);
  assert.equal($('creator-missions').open, false);
  page.frame();
  page.tap(1);
  assert.equal(doc.activeElement, $('pause'));
  assert.equal(fixture.writes.length, writes, 'menu traversal and Back do not save or restart');
  assert.equal(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)), saved);
  page.tap(0);
  page.frame();
  assert.equal(doc.activeElement, $('arena'));
  assert(page.run().tick > pausedTick);
});

test('installation errors retain a keyboard/controller exit menu without a running simulation', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture, { invalidEdition: true });
  assert.equal(page.$('status').classList.contains('error'), true);
  assert.equal(page.$('status').hidden, false, 'an installation failure remains visible on home');
  page.connect();
  assert.equal(page.doc.activeElement, page.$('creator-open-settings'));
  page.tap(0);
  page.$('creator-tab-help').focus();
  page.frame();
  page.tap(0);
  assert.equal(page.$('creator-panel-help').hidden, false);
  page.$('creator-back-library').focus();
  page.key('Escape');
  assert.equal(page.doc.activeElement, page.$('creator-open-settings'));
  assert.equal(page.run(), null);
});

test('a legally completed custom mission exposes result actions and keeps earned progress on menu traversal', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture);
  const { $, doc } = page;
  $('difficulty').value = 'standard';
  page.connect();
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  let held = null;
  const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  for (const segment of fixture.route.replay.segments) {
    if (segment.releaseBefore && held) {
      page.key(keyFor[held], false);
      held = null;
    }
    const direction = segment.input.direction;
    if (direction !== held) {
      if (held) page.key(keyFor[held], false);
      if (direction) page.key(keyFor[direction]);
      held = direction;
    }
    for (let tick = 0; tick < segment.ticks; tick++) page.frame(1000 / 120);
  }
  if (held) page.key(keyFor[held], false);
  assert.equal(page.run().status, 'won', 'only the verified route earns completion');
  await settle(() => !$('next').hidden && !$('next').disabled);
  // Verification enables Next before the native reward hold ends. Advance the
  // actual presentation clock instead of treating that control as panel readiness.
  const completed = authoritativeCheckpoint(page.run());
  assert.equal($('earned').hidden, true);
  assert.notEqual(doc.body.dataset.earnedView, 'on');
  for (let n = 0; n < Math.ceil(REWARD_BOARD_SECONDS / 0.1) + 1; n++) page.frame(100);
  assert.equal($('earned').hidden, false);
  assert.equal(doc.body.dataset.earnedView, 'on');
  assert.equal(doc.activeElement, $('earned-continue'));
  assert.deepEqual(authoritativeCheckpoint(page.run()), completed);
  page.tap(1);
  assert.equal(doc.body.dataset.earnedView, 'off');
  assert.equal(doc.activeElement, $('next'));
  assert.equal($('earned').hidden, true, 'Back dismisses the reward, not its verified progress.');
  assert.equal($('export-progress').disabled, false);
  assert.equal($('export-attempt').disabled, true);
  const checkpoint = authoritativeCheckpoint(page.run()),
    writes = fixture.writes.length;
  page.tap(13);
  assert.equal(doc.activeElement, $('creator-select-mission'));
  page.tap(1);
  assert.equal(doc.activeElement, $('next'));
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  assert.equal(fixture.writes.length, writes);
  assert.equal(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)), null);
  page.tap(0);
  assert.equal(
    page.win.location.hash,
    '#installed',
    'Next retains the original return-to-creations handler',
  );
});

test('the actual Custom mission picker starts an explicitly confirmed replacement without changing edition identity', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture),
    { $, doc } = page;
  page.connect();
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  page.frame();
  page.tap(9);
  const key = creatorAttemptKey(fixture.pack.editionId),
    before = JSON.parse(fixture.storage.getItem(key));
  $('creator-select-mission').focus();
  page.frame();
  page.tap(0);
  page.frame();
  page.tap(0);
  assert.equal($('creator-replace-attempt').open, true);
  $('creator-replace-confirm').focus();
  page.frame();
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  assert.equal(doc.activeElement, $('arena'));
  const after = JSON.parse(fixture.storage.getItem(key));
  assert.equal(after.editionId, before.editionId);
  assert.notEqual(
    after.session.runId,
    before.session.runId,
    'the approved action creates one fresh attempt',
  );
  assert.equal($('creator-missions').open, false);
  assert.equal($('creator-replace-attempt').open, false);
});

test('saved Custom attempts remain importable from Settings and malformed replacements keep the current run', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture),
    { $ } = page;
  page.connect();
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  page.frame();
  page.tap(9);
  assert.equal($('creator-home').hidden, false);
  const saved = fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId));
  const checkpoint = authoritativeCheckpoint(page.run());
  $('creator-open-settings').click();
  $('creator-tab-data').click();
  $('import-attempt').files = [new File([saved], 'attempt.json', { type: 'application/json' })];
  $('import-attempt').emit('change');
  await settle(() => !$('import-attempt').disabled);
  page.frame();
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  assert.equal($('creator-settings').open, true, 'restoration leaves its recovery surface open');
  const restoredSaved = fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId));
  assert.equal(JSON.parse(restoredSaved).session.runId, JSON.parse(saved).session.runId);
  const writes = fixture.writes.length;
  $('import-attempt').files = [new File(['{}'], 'invalid.json', { type: 'application/json' })];
  $('import-attempt').emit('change');
  await settle(() => !$('import-attempt').disabled);
  page.frame();
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  assert.equal(fixture.writes.length, writes);
  assert.equal($('status').classList.contains('error'), true);
  assert.equal(
    $('creator-settings-status').hidden,
    false,
    'recovery errors are visible inside the open dialog',
  );
  assert.equal(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)), restoredSaved);
});

test('fresh Custom home Continue verifies and resumes the exact saved attempt in one gesture', async (t) => {
  const fixture = await installedFixture(),
    first = await playerHost(t, fixture);
  first.connect();
  first.tap(0);
  await settle(() => !first.$('pause').disabled);
  first.frame();
  first.frame();
  first.tap(9);
  assert.equal(first.$('creator-home').hidden, false);
  const saved = JSON.parse(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)));
  const checkpoint = authoritativeCheckpoint(first.run());
  first.close();
  await Promise.resolve();
  const page = await playerHost(t, fixture);
  page.connect();
  assert.equal(page.doc.activeElement, page.$('resume'));
  page.button(0, true);
  assert.equal(page.run(), null, 'holding Continue does not restore or start a save');
  page.button(0, false);
  await settle(() => !page.$('pause').disabled);
  page.frame();
  assert.equal(page.$('creator-home').hidden, true);
  assert.equal(page.doc.activeElement, page.$('arena'));
  assert.deepEqual(
    authoritativeCheckpoint(page.run()),
    checkpoint,
    'resume begins at the exact verified checkpoint',
  );
  assert.equal(
    JSON.parse(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId))).session.runId,
    saved.session.runId,
  );
  page.frame();
  page.frame();
  assert(page.run().tick > saved.session.replay.ticks);
});

test('Custom Settings keyboard categories select the matching panel without a competing navigation owner', async (t) => {
  const page = await playerHost(t, await installedFixture()),
    { $, doc } = page;
  $('creator-open-settings').click();
  assert.equal(doc.activeElement, $('creator-tab-gameplay'));
  page.key('ArrowDown');
  assert.equal(doc.activeElement, $('creator-tab-display'));
  assert.equal($('creator-tab-display').getAttribute('aria-selected'), 'true');
  assert.equal($('creator-panel-display').hidden, false);
  assert.equal($('creator-panel-gameplay').hidden, true);
  page.key('End');
  assert.equal(doc.activeElement, $('creator-tab-help'));
  assert.equal($('creator-panel-help').hidden, false);
  page.key('Home');
  assert.equal(doc.activeElement, $('creator-tab-gameplay'));
  assert.equal($('creator-panel-gameplay').hidden, false);
});

test('Custom reduced effects preference reaches the original flight renderer', async (t) => {
  const page = await playerHost(t, await installedFixture()),
    { $ } = page;
  $('creator-open-settings').click();
  $('creator-tab-display').click();
  $('creator-reduced-effects').checked = true;
  $('creator-reduced-effects').emit('change');
  $('creator-settings-back').click();
  $('start').click();
  await settle(() => !$('pause').disabled);
  page.frame();
  assert.equal(
    page.drawOptions().reduced,
    true,
    'explicit setting applies even without OS reduction',
  );
  $('pause').click();
  $('creator-open-settings').click();
  $('creator-tab-display').click();
  $('creator-reduced-effects').checked = false;
  $('creator-reduced-effects').emit('change');
  $('creator-settings-back').click();
  $('pause').click();
  page.frame();
  assert.equal(page.drawOptions().reduced, false);
});

test('async saved Continue retains the verified attempt paused after its initiating owner changes', async (t) => {
  const fixture = await installedFixture(),
    first = await playerHost(t, fixture);
  first.$('start').click();
  await settle(() => !first.$('pause').disabled);
  first.frame();
  first.frame();
  first.$('pause').click();
  const checkpoint = authoritativeCheckpoint(first.run()),
    initialTick = first.run().tick,
    saved = fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId));
  first.close();
  for (const change of ['blur-and-return', 'hidden-and-return', 'settings']) {
    await t.test(change, async (t) => {
      fixture.storage.setItem(creatorAttemptKey(fixture.pack.editionId), saved);
      let entered = false,
        release;
      const pendingLook = new Promise((resolve) => {
        release = resolve;
      });
      const page = await playerHost(t, fixture, {
        setLook: () => {
          entered = true;
          return pendingLook;
        },
      });
      const { $, doc, win } = page;
      $('resume').focus();
      $('resume').click();
      await settle(() => entered);
      if (change === 'blur-and-return') {
        doc.focused = false;
        win.emit('blur');
        doc.focused = true;
        win.emit('focus');
      } else if (change === 'hidden-and-return') {
        doc.hidden = true;
        doc.emit('visibilitychange');
        doc.hidden = false;
        doc.emit('visibilitychange');
      } else $('creator-open-settings').click();
      const focus = doc.activeElement;
      release();
      await settle(() => !$('pause').disabled);
      page.frame();
      page.frame();
      assert.equal(
        $('creator-home').hidden,
        false,
        'completing verification does not reclaim flight',
      );
      assert.equal(doc.activeElement, focus, 'completion does not steal the changed owner focus');
      assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
      assert.equal($('creator-settings').open, change === 'settings');
      if (change === 'settings') $('creator-settings-back').click();
      $('pause').click();
      page.frame();
      page.frame();
      assert.equal(
        $('creator-home').hidden,
        true,
        'a fresh explicit Resume still starts the retained attempt',
      );
      assert(page.run().tick > initialTick);
    });
  }
});

test('async mission selection also stays paused if the player opens Settings while it loads', async (t) => {
  let entered = false,
    release;
  const pendingLook = new Promise((resolve) => {
    release = resolve;
  });
  const page = await playerHost(t, await installedFixture(), {
    setLook: () => {
      entered = true;
      return pendingLook;
    },
  });
  const { $, doc } = page;
  $('creator-select-mission').click();
  $('creator-mission-list').querySelector('button').click();
  await settle(() => entered);
  $('creator-open-settings').click();
  const focused = doc.activeElement;
  release();
  await settle(() => !$('pause').disabled);
  page.frame();
  const checkpoint = authoritativeCheckpoint(page.run());
  page.frame();
  page.frame();
  assert.equal($('creator-settings').open, true);
  assert.equal(doc.activeElement, focused);
  assert.equal($('creator-home').hidden, false);
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
});
