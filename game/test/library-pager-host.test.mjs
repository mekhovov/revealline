// Actual Library presenter/markup, with native disabling/removal and focus events
// modeled locally. The full-Solo case also checks real flight and saved bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, importLibrary, recordLibraryCompletion, saveLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { captureOperationFocus } from '../ui/operation-focus.mjs';
import { BoardPainter } from '../ui/render.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'pager-fixture',
  revision: '1',
  classRecipes: CLASSES,
  levels: Array.from({ length: 25 }, (_, index) => ({
    version: 'xonix-level.v1',
    id: `pager-${index}`,
    revision: '1',
    name: `Pager picture ${String(index).padStart(2, '0')}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.2 },
  })),
};
let profile = emptyLibrary();
for (const level of campaign.levels) {
  const run = createRun(level, { seed: 1, classId: 'scout', classRecipes: CLASSES });
  for (let tick = 0; tick < 1000 && run.status === 'running'; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won', 'Each stored board/picture originates in a legal completion');
  profile = recordLibraryCompletion(profile, {
    campaign,
    result: getSummary(run),
    runId: level.id,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: '2026-09-15T12:00:00.000Z',
  });
}
const entry = {
  campaign,
  classRecipes: CLASSES,
  themes: [{ id: 'fpv', name: 'FPV' }],
  visualOverrides: {},
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function nativeControls(t) {
  const remove = SoloElement.prototype.remove;
  t.mock.method(SoloElement.prototype, 'remove', function () {
    if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement.blur();
    return remove.call(this);
  });
  const show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
  });
}
function instrument(control) {
  if (control.nativeDisabled) return;
  control.nativeDisabled = true;
  let disabled = control.disabled;
  Object.defineProperty(control, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && control.ownerDocument.activeElement === control) {
        control.blur();
        control.emit('blur', { bubbles: false });
      }
    },
  });
  const focus = control.focus;
  control.focusCalls = 0;
  control.revealCalls = [];
  control.scrollIntoView = (options) => control.revealCalls.push(options);
  control.focus = function (...args) {
    this.focusCalls++;
    return focus.apply(this, args);
  };
}
function activate(control) {
  control.focus();
  const down = control.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
  let result;
  if (!down.defaultPrevented) {
    const onclick = control.onclick;
    control.onclick = (...args) => (result = onclick(...args));
    try {
      control.click();
    } finally {
      control.onclick = onclick;
    }
  }
  control.emit('keyup', { key: 'Enter', code: 'Enter' });
  return result;
}
async function panelHost(t, { media = false, count = 25 } = {}) {
  nativeControls(t);
  const doc = new Document(),
    win = new Events();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  doc.documentElement = doc.createElement('html');
  doc.documentElement.parentNode = doc;
  doc.children = [doc.documentElement];
  doc.body = doc.createElement('body');
  doc.documentElement.append(doc.body);
  doc.activeElement = doc.body;
  doc.parentNode = win;
  doc.defaultView = win;
  const stack = [doc.body],
    html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const token of html
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!text.startsWith('<')) {
      stack.at(-1)._text += text.trim();
      continue;
    }
    const tag = text.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of text
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (name.startsWith('data-'))
        node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
  const f = media ? await earnedPictureFixture() : null;
  if (f) t.after(() => f.manager.close());
  const original = importLibrary({
    ...profile,
    gallery: profile.gallery.slice(0, count),
    scores: profile.scores.slice(0, count),
  });
  const library = f
    ? importLibrary({
        ...f.profile,
        campaigns: { ...original.campaigns, ...f.profile.campaigns },
        gallery: [...original.gallery, ...f.profile.gallery],
        scores: [...original.scores, ...f.profile.scores],
      })
    : original;
  const state = {
    library,
    packs: emptyPackLibrary(),
    presets: JSON.parse(
      await readFile(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
    ),
  };
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    fetch: async () => ({ json: async () => ({ packs: [] }) }),
    Image: class {
      naturalWidth = 1;
      naturalHeight = 1;
      decode() {
        return Promise.resolve();
      }
      removeAttribute() {}
    },
  })) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() =>
      before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key],
    );
  }
  t.mock.method(BoardPainter.prototype, 'drawGallery', () => {});
  const jobs = [];
  let held = false;
  const mediaValue = f && { metadata: f.metadata, store: f.store };
  const panel = attachLibraryPanel({
    get: () => state,
    pause() {},
    saved: () => null,
    attemptExportSource: () => ({ source: null, label: 'None', reason: 'Panel fixture' }),
    catalog: () => [entry, ...(f?.entries ?? [])],
    base: () => entry,
    ...(f
      ? {
          pictureMedia() {
            if (!held) return Promise.resolve(mediaValue);
            const job = deferred();
            jobs.push(job);
            return job.promise;
          },
        }
      : {}),
  });
  const $ = (id) => doc.getElementById(id);
  const controls = (kind) => {
    const nav = $(kind === 'gallery' ? 'gallery-pages' : 'score-pages');
    const previous = nav.children[0],
      next = nav.children[2];
    if (previous) {
      instrument(previous);
      instrument(next);
    }
    return { nav, previous, next, label: nav.children[1] };
  };
  const open = async (kind) => {
    if (kind === 'gallery') {
      $('collection-dialog').showModal();
      await panel.populateGallery();
    } else panel.open('scores');
    return controls(kind);
  };
  return {
    doc,
    win,
    $,
    panel,
    state,
    jobs,
    controls,
    open,
    hold: () => {
      held = true;
    },
    resolve(index = jobs.length - 1) {
      jobs[index].resolve(mediaValue);
    },
  };
}
for (const kind of ['score', 'gallery']) {
  test(`${kind}: interior pages retain the same focused control, endpoints use the enabled opposite`, async (t) => {
    const h = await panelHost(t),
      p = await h.open(kind),
      before = JSON.stringify(h.state.library);
    await activate(p.next);
    assert.match(p.label.textContent, /page 2 of 3/);
    assert.equal(h.controls(kind).next === p.next, true);
    assert.equal(h.doc.activeElement === p.next, true);
    assert.equal(p.next.focusCalls, 1, 'No extra focus call while Next remains eligible');
    await activate(p.next);
    assert.match(p.label.textContent, /page 3 of 3/);
    assert.equal(p.next.disabled, true);
    assert.equal(h.doc.activeElement === p.previous, true);
    await activate(p.previous);
    assert.equal(h.doc.activeElement === p.previous, true);
    await activate(p.previous);
    assert.equal(p.previous.disabled, true);
    assert.equal(h.doc.activeElement === p.next, true);
    assert.equal(JSON.stringify(h.state.library), before, 'Browsing writes no records');
  });
  test(`${kind}: an owned pager collapsing to one page returns to its matching search`, async (t) => {
    const h = await panelHost(t),
      p = await h.open(kind),
      search = h.$(`${kind === 'score' ? 'score' : 'gallery'}-search`);
    p.next.focus();
    search.value = 'Pager picture 00';
    await search.oninput();
    assert.equal(h.doc.activeElement === search, true);
    if (kind === 'gallery') assert.equal(p.nav.children.length, 0);
    else assert.equal(p.previous.disabled && p.next.disabled, true);
  });
  test(`${kind}: search filtering preserves the player's focus and does not focus a pager`, async (t) => {
    const h = await panelHost(t),
      p = await h.open(kind),
      search = h.$(`${kind === 'score' ? 'score' : 'gallery'}-search`);
    search.focus();
    search.value = 'Pager picture 00';
    search.emit('input');
    assert.equal(h.doc.activeElement === search, true);
    assert.equal(p.previous.focusCalls + p.next.focusCalls, 0);
  });
}
for (const kind of ['score', 'gallery'])
  test(`${kind}: reveals the same persistent pager after page growth and the opposite endpoint`, async (t) => {
    const h = await panelHost(t),
      p = await h.open(kind),
      nearest = { block: 'nearest', inline: 'nearest', behavior: 'auto' };
    await activate(p.next);
    await activate(p.next);
    assert.deepEqual(p.previous.revealCalls, [nearest]);
    p.previous.revealCalls.length = 0;
    // Returning from a short final page grows the content above this same node.
    await activate(p.previous);
    assert.equal(h.controls(kind).previous === p.previous, true);
    assert.equal(h.doc.activeElement === p.previous, true);
    assert.equal(
      p.previous.focusCalls,
      2,
      'The explicit activation focuses once; completion does not refocus',
    );
    assert.deepEqual(
      p.previous.revealCalls,
      [nearest],
      'Owned unchanged focus must still be revealed',
    );
    await activate(p.previous);
    assert.deepEqual(p.next.revealCalls, [nearest, nearest]);
  });
for (const decision of ['foreign-focus', 'blur-return', 'new-dialog', 'different-model'])
  test(`Collection: ${decision} during the focus callback vetoes pager reveal`, async (t) => {
    const h = await panelHost(t, { media: true, count: 13 }),
      p = await h.open('gallery');
    h.hold();
    const focus = p.previous.focus;
    p.previous.focus = function (...args) {
      focus.apply(this, args);
      if (decision === 'foreign-focus') {
        h.$('gallery-search').focus();
        h.doc.activeElement.blur();
      } else if (decision === 'blur-return') {
        h.doc.focused = false;
        h.win.emit('blur');
        h.doc.focused = true;
      } else if (decision === 'new-dialog') h.$('settings-dialog').showModal();
      else h.state.library = importLibrary(h.state.library);
    };
    const pending = activate(p.next);
    h.resolve();
    await pending;
    assert.equal(p.previous.focusCalls, 1, 'The current owner may first focus its logical target');
    assert.deepEqual(p.previous.revealCalls, [], 'The callback changed ownership before reveal');
  });
for (const failure of [false, true]) {
  test(`Collection: delayed metadata ${failure ? 'failure' : 'success'} hands an unavailable Next to Previous`, async (t) => {
    const h = await panelHost(t, { media: true, count: 13 }),
      p = await h.open('gallery');
    h.hold();
    const pending = activate(p.next);
    assert.equal(h.jobs.length, 1);
    assert.equal(h.doc.activeElement === p.next, true);
    if (failure) h.jobs[0].reject(new Error('Metadata unavailable'));
    else h.resolve();
    await pending;
    assert.equal(p.next.disabled, true);
    assert.equal(h.doc.activeElement === p.previous, true);
    if (failure) assert.match(h.$('gallery-load-status').textContent, /unavailable/);
  });
}
test('Collection: automatic supersession transfers existing live focus intent without losing the endpoint', async (t) => {
  const h = await panelHost(t, { media: true, count: 13 }),
    p = await h.open('gallery');
  h.hold();
  const first = activate(p.next),
    second = h.panel.populateGallery();
  assert.equal(h.jobs.length, 2);
  h.resolve(0);
  await first;
  assert.match(p.label.textContent, /page 1 of 2/, 'Stale read cannot publish');
  h.resolve(1);
  await second;
  assert.equal(p.next.disabled, true);
  assert.equal(
    h.doc.activeElement === p.previous,
    true,
    'Transfer the live lease, without recapturing it',
  );
});
for (const decision of [
  'focus-then-body',
  'blur-return',
  'hidden-return',
  'pagehide',
  'new-dialog',
  'close-reopen',
  'different-model',
]) {
  test(`Collection: ${decision} retires focus through delayed automatic supersession`, async (t) => {
    const h = await panelHost(t, { media: true, count: 13 }),
      p = await h.open('gallery');
    h.hold();
    const first = activate(p.next);
    if (decision === 'focus-then-body') {
      h.$('gallery-search').focus();
      h.doc.activeElement.blur();
    }
    if (decision === 'blur-return') {
      h.doc.focused = false;
      h.win.emit('blur');
      h.doc.focused = true;
    }
    if (decision === 'hidden-return') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
    }
    if (decision === 'pagehide') h.win.emit('pagehide');
    if (decision === 'new-dialog') h.$('settings-dialog').showModal();
    if (decision === 'close-reopen') {
      h.$('collection-dialog').close();
      h.$('collection-dialog').showModal();
    }
    const second = h.panel.populateGallery();
    if (decision === 'different-model') h.state.library = importLibrary(h.state.library);
    h.resolve(1);
    await second;
    h.resolve(0);
    await first;
    assert.equal(h.doc.activeElement === p.previous, false);
    assert.equal(h.doc.activeElement === h.$('gallery-search'), false);
    assert.equal(p.previous.focusCalls, 0);
    assert.deepEqual(p.previous.revealCalls, []);
    assert.deepEqual(p.next.revealCalls, []);
  });
}
test('Collection: a fresh explicit pager activation can establish new intent after a retired read', async (t) => {
  const h = await panelHost(t, { media: true, count: 13 }),
    p = await h.open('gallery');
  h.hold();
  const first = activate(p.next);
  h.$('gallery-search').focus();
  const second = activate(p.next);
  h.resolve(0);
  await first;
  h.resolve(1);
  await second;
  assert.equal(h.doc.activeElement === p.previous, true);
});
for (const retired of [false, true])
  test(`Collection: automatic collapse ${retired ? 'does not revive retired' : 'transfers live'} focus intent`, async (t) => {
    const h = await panelHost(t, { media: true, count: 13 }),
      p = await h.open('gallery');
    h.hold();
    const first = activate(p.next);
    if (retired) {
      h.$('gallery-search').focus();
      h.doc.activeElement.blur();
    }
    h.$('gallery-search').value = 'Pager picture 00';
    const second = h.panel.populateGallery();
    h.resolve(1);
    await second;
    h.resolve(0);
    await first;
    assert.equal(p.nav.hidden, true);
    assert.equal(p.nav.children.length, 0);
    assert.equal(h.doc.activeElement === h.$('gallery-search'), !retired);
    assert.equal(p.next.isConnected, false);
    h.$('gallery-search').focus();
    h.$('gallery-search').value = '';
    const expanded = h.panel.populateGallery();
    h.resolve();
    await expanded;
    assert.equal(h.controls('gallery').next === p.next, true, 'Expansion reuses the same pager');
    assert.equal(h.doc.activeElement === h.$('gallery-search'), true);
  });
for (const decision of ['foreign-focus', 'no-eligible-target', 'newer-read'])
  test(`Collection: ${decision} during native disable rechecks the current owner before fallback`, async (t) => {
    const h = await panelHost(t, { media: true, count: 13 }),
      p = await h.open('gallery');
    h.hold();
    const descriptor = Object.getOwnPropertyDescriptor(p.next, 'disabled');
    let fired = false,
      newer = null;
    Object.defineProperty(p.next, 'disabled', {
      ...descriptor,
      set(value) {
        descriptor.set(value);
        if (!value || fired) return;
        fired = true;
        if (decision === 'foreign-focus') {
          h.$('gallery-search').focus();
          h.doc.activeElement.blur();
        } else if (decision === 'no-eligible-target') {
          p.previous.disabled = true;
          h.$('gallery-search').disabled = true;
        } else newer = h.panel.populateGallery();
      },
    });
    const first = activate(p.next);
    h.resolve(0);
    await first;
    assert.equal(h.doc.activeElement === h.doc.body, true);
    assert.equal(p.previous.focusCalls, 0, 'An obsolete completion must not focus');
    if (newer) {
      h.resolve(1);
      await newer;
      assert.equal(h.doc.activeElement === p.previous, true, 'Only the current read settles');
    }
  });
for (const kind of ['score', 'gallery'])
  test(`full Solo: keyboard ${kind} paging preserves the paused flight and exact persisted records`, async (t) => {
    nativeControls(t);
    const storage = memoryStorage();
    assert.equal(saveLibrary(storage, 'revealline.library.dev.v1', profile).ok, true);
    const h = await soloPage(t, { storage, titleScreen: true });
    Object.assign(h.win, h.doc.defaultView);
    h.doc.defaultView = h.win;
    if (kind === 'score') {
      h.$('shell-workshop').click();
      h.$('shell-library').click();
    } else h.$('shell-gallery').click();
    const nav = h.$(kind === 'score' ? 'score-pages' : 'gallery-pages'),
      previous = nav.children[0],
      next = nav.children[2];
    instrument(previous);
    instrument(next);
    const run = h.rendered.run,
      checkpoint = authoritativeCheckpoint(run),
      raw = [...storage.map],
      writes = storage.writes.length;
    await activate(next);
    await activate(next);
    assert.equal(h.doc.activeElement === previous, true);
    assert.match(nav.children[1].textContent, /page 3 of 3/);
    h.frame(100);
    assert.equal(h.rendered.run === run, true);
    assert.equal(h.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual([...storage.map], raw);
    assert.equal(storage.writes.length, writes);
    assert.deepEqual(h.errors, []);
  });

for (const reveal of [false, true])
  test(`operation helper: reveal ${reveal} preserves same-target return semantics and one-shot ownership`, async (t) => {
    const h = await panelHost(t),
      p = await h.open('gallery');
    p.next.focus();
    const lease = captureOperationFocus(p.next, { document: h.doc, reveal });
    assert.equal(lease.restore(), false, 'An already focused target was not refocused');
    assert.equal(p.next.focusCalls, 1);
    assert.equal(p.next.revealCalls.length, reveal ? 1 : 0);
    assert.equal(lease.restore(), false);
    assert.equal(p.next.revealCalls.length, reveal ? 1 : 0);
  });
test('operation helper: reveal rejects recursive restoration from the current resolver', async (t) => {
  const h = await panelHost(t),
    p = await h.open('gallery');
  p.next.focus();
  let reads = 0;
  const lease = captureOperationFocus(p.next, {
    document: h.doc,
    reveal: true,
    resolveTarget() {
      reads++;
      assert.equal(lease.restore(), false);
      return p.next;
    },
  });
  p.next.blur();
  assert.equal(lease.restore(), true);
  assert.equal(reads, 2, 'Check authority before focus and once after its callbacks');
  assert.equal(p.next.focusCalls, 2);
  assert.equal(p.next.revealCalls.length, 1);
});
for (const failure of ['focus', 'scroll'])
  test(`operation helper: a throwing ${failure} retires every reveal listener`, async (t) => {
    const h = await panelHost(t),
      p = await h.open('gallery'),
      listeners = () =>
        [h.doc, h.win]
          .flatMap((node) => [...node.captureListeners.values()])
          .reduce((sum, set) => sum + set.size, 0);
    p.next.focus();
    const before = listeners(),
      lease = captureOperationFocus(p.next, { document: h.doc, reveal: true });
    assert.ok(listeners() > before);
    if (failure === 'focus') {
      p.next.blur();
      p.next.focus = () => {
        throw new Error('Modeled focus callback failure');
      };
    } else
      p.next.scrollIntoView = () => {
        throw new Error('Modeled reveal failure');
      };
    assert.throws(() => lease.restore(), /Modeled/);
    assert.equal(listeners(), before);
    assert.equal(lease.restore(), false);
  });
