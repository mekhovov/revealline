import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { prepareTeamEventSlots } from '../presentation/team-event-slots.mjs';
import { STUDIO_INVENTORY_HISTORY_KEY as KEY } from '../../authoring/asset-studio/inventory-history.mjs';

const scout = 'player.scout.detailed';
const published = prepareTeamEventSlots(createDefaultThemeBundle());
const flush = () => new Promise((resolve) => setImmediate(resolve));
function mount(doc, html) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      if (stack.at(-1).tagName === 'OPTION' && !stack.at(-1).hasAttribute('value'))
        stack.at(-1).value = token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      element = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name.startsWith('data-'))
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) element[name] = true;
    }
    stack.at(-1).append(element);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(element);
  }
}
function historyEntry(state = { foreign: { retained: true } }) {
  const entries = [{ state, url: 'https://example.test/authoring/asset-studio/' }];
  let index = 0;
  return {
    get state() {
      return entries[index].state;
    },
    set state(value) {
      entries[index].state = value;
    },
    get href() {
      return entries[index].url;
    },
    get length() {
      return entries.length;
    },
    calls: [],
    replaceState(next, ...rest) {
      this.calls.push([structuredClone(next), ...rest]);
      entries[index].state = structuredClone(next);
    },
    pushState() {
      assert.fail('Studio must not add an entry for view navigation.');
    },
    // Only an uncancelled native link creates a null-state fragment entry.
    nativeFragment(url) {
      const oldURL = this.href;
      entries.splice(index + 1);
      entries.push({ state: null, url });
      index++;
      return { oldURL, newURL: url };
    },
  };
}
let visit = 0;
async function studio(
  t,
  {
    history = historyEntry(),
    gate = null,
    document = published,
    fail = false,
    restoredQuery = null,
  } = {},
) {
  const doc = new Document(),
    win = new Events(),
    db = memoryIndexedDB();
  win.history = history;
  win.location = {
    get href() {
      return history.href;
    },
  };
  let mounted = true,
    writes = 0;
  class StudioElement extends Element {
    constructor(doc, tag) {
      super(doc, tag);
      this.style.getPropertyValue = (name) => this.style[name] || '';
      this.style.removeProperty = (name) => delete this.style[name];
    }
    append(...nodes) {
      // Native single selects retain a selected empty-value "All" option when
      // more options are appended. The finite base helper otherwise picks one.
      const selected = this.tagName === 'SELECT' && this.options.length ? this.value : null;
      super.append(...nodes);
      if (selected !== null && this.options.some((option) => option.value === selected))
        this.value = selected;
    }
    getContext() {
      return new Proxy({}, { get: () => () => {} });
    }
  }
  doc.createElement = (tag) => new StudioElement(doc, tag);
  doc.createDocumentFragment = () => new StudioElement(doc, 'fragment');
  const matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  win.matchMedia = matchMedia;
  const globals = {
    document: doc,
    window: win,
    indexedDB: db.indexedDB,
    matchMedia,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {
        writes++;
        assert.fail('Inventory view must not write player/global preferences.');
      },
    },
    fetch: async () => {
      if (gate) await gate;
      return fail ? new Response('', { status: 503 }) : new Response(JSON.stringify(document));
    },
    cancelAnimationFrame() {},
    requestAnimationFrame() {
      return 1;
    },
    createImageBitmap: async () => {
      throw Error('Source recipes need no image decode.');
    },
  };
  const prior = Object.fromEntries(Object.keys(globals).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  mount(
    doc,
    await readFile(new URL('../../authoring/asset-studio/index.html', import.meta.url), 'utf8'),
  );
  const $ = (id) => doc.getElementById(id);
  if (restoredQuery !== null) $('filter-search').value = restoredQuery;
  await import(`../../authoring/asset-studio/studio.mjs?cold-return=${++visit}`);
  const wait = () =>
    waitFor(() => !doc.querySelector('.inventory').inert, {
      message: 'Studio did not finish initial loading.',
    });
  const close = () => {
    if (!mounted) return;
    win.emit('pagehide', { persisted: false });
    mounted = false;
    Object.assign(globalThis, prior);
  };
  t.after(close);
  return { $, doc, win, history, db, wait, close, writes: () => writes };
}
const selectedRow = (h) => h.$('asset-list').querySelector('button[aria-pressed="true"]');
const rowFor = (h, id) =>
  [...h.$('asset-list').querySelectorAll('button')].find((button) =>
    button.querySelector('small').textContent.startsWith(id + ' ·'),
  );
const search = (h, text) => {
  h.$('filter-search').value = text;
  h.$('filter-search').emit('input');
};

test('actual cold Back restores matching inventory and exact selected inspector without saving a workspace', async (t) => {
  const history = historyEntry();
  const first = await studio(t, { history });
  await first.wait();
  search(first, 'player');
  rowFor(first, scout).click();
  const count = first.$('slot-count').textContent;
  assert.equal(first.$('slot-id').textContent, scout);
  const beforeStore = structuredClone(first.db.contents());
  const beforeLeave = history.calls.length;
  first.close();
  assert.equal(history.calls.length, beforeLeave, 'Departure never writes a traversing entry.');
  const second = await studio(t, { history, restoredQuery: 'player' });
  await second.wait();
  // The finite host restores native form data before the new module starts.
  second.$('studio-game-return').focus();
  second.win.emit('pageshow', { persisted: false });
  assert.equal(second.$('filter-search').value, 'player');
  assert.equal(second.$('slot-count').textContent, count);
  assert.equal(second.$('slot-id').textContent, scout);
  assert.equal(selectedRow(second), rowFor(second, scout));
  assert.equal(second.doc.activeElement, second.$('studio-game-return'));
  assert.deepEqual(history.state.foreign, { retained: true });
  assert.deepEqual(first.db.contents(), beforeStore);
  assert.equal(first.writes() + second.writes(), 0);
  assert.deepEqual(first.db.allPuts, []);
  assert.deepEqual(second.db.allPuts, []);
  assert.match(second.$('workspace-summary').textContent, /local save none/);
});

test('actual restored view retains a valid inspector outside its filters; removed slots fall back coherently', async (t) => {
  for (const id of [scout, 'removed.slot']) {
    const h = await studio(t, {
      history: historyEntry({
        [KEY]: {
          version: 1,
          selected: id,
          query: 'panel',
          screen: 'removed-screen',
          state: 'removed-state',
          kind: 'not-a-kind',
        },
      }),
    });
    await h.wait();
    assert.equal(h.$('filter-search').value, 'panel');
    for (const field of ['screen', 'state', 'kind']) assert.equal(h.$('filter-' + field).value, '');
    if (id === scout) {
      assert.equal(h.$('slot-id').textContent, scout);
      assert.equal(selectedRow(h), null);
    } else {
      assert.ok(selectedRow(h));
      assert.equal(
        h.$('slot-id').textContent,
        selectedRow(h).querySelector('small').textContent.split(' ·')[0],
      );
    }
    h.close();
  }
});

test('actual BFCache return keeps unsaved workspace/selection and ignores a changed history hint', async (t) => {
  const h = await studio(t);
  await h.wait();
  search(h, 'player');
  rowFor(h, scout).click();
  h.$('review-evidence').value = 'Bounded fixture view check, not publication approval.';
  h.$('record-review').click();
  await waitFor(() => !h.doc.querySelector('.inventory').inert);
  assert.match(h.$('workspace-summary').textContent, /unsaved changes/);
  const summary = h.$('workspace-summary').textContent,
    contract = h.$('slot-contract').textContent;
  h.win.emit('pagehide', { persisted: true });
  h.history.state[KEY] = { version: 1, selected: 'panel.frame', query: 'panel' };
  h.$('studio-game-return').focus();
  h.win.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(h.$('filter-search').value, 'player');
  assert.equal(h.$('slot-id').textContent, scout);
  assert.equal(h.$('slot-contract').textContent, contract);
  assert.equal(h.$('workspace-summary').textContent, summary);
  assert.equal(h.doc.activeElement, h.$('studio-game-return'));
  assert.equal(h.writes(), 0);
});

test('late startup after departure cannot rewrite history or focus a newer page', async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const history = historyEntry({
    [KEY]: { version: 1, selected: scout, query: 'player' },
    foreign: 2,
  });
  const h = await studio(t, { history, gate });
  const initial = structuredClone(history.state),
    count = history.calls.length;
  h.win.emit('pagehide', { persisted: false });
  h.$('studio-game-return').focus();
  release();
  await flush();
  await flush();
  assert.deepEqual(history.state, initial);
  assert.equal(history.calls.length, count);
  assert.equal(h.doc.activeElement, h.$('studio-game-return'));
});

test('restoration waits for actual published slots, while newer view input wins over late cold pageshow', async (t) => {
  const selected = 'team.event.joint-capture';
  assert.ok(!createDefaultThemeBundle().slots.some((slot) => slot.id === selected));
  const h = await studio(t, {
    history: historyEntry({
      [KEY]: {
        version: 1,
        selected,
        query: 'team.event.',
        screen: 'couch',
        state: 'default',
        kind: 'recipe',
        quality: 'unfinished',
      },
    }),
  });
  await h.wait();
  assert.equal(h.$('slot-id').textContent, selected);
  assert.equal(selectedRow(h), rowFor(h, selected));
  assert.equal(h.$('slot-count').textContent.split(' / ')[0], '2');
  search(h, 'newer unmatched search');
  h.$('filter-search').focus();
  h.win.emit('pageshow', { persisted: false });
  assert.equal(h.$('filter-search').value, 'newer unmatched search');
  assert.equal(h.$('slot-id').textContent, selected);
  assert.equal(h.doc.activeElement, h.$('filter-search'));
  assert.deepEqual(h.db.allPuts, []);
});

function activateSkip(h, extra = {}) {
  const link = h.doc.querySelector('a[href="#inspector"]');
  assert.ok(link, 'Use the actual shipped Skip inventory anchor.');
  link.focus();
  const click = link.emit('click', { button: 0, ...extra });
  if (
    !click.defaultPrevented &&
    !extra.ctrlKey &&
    !extra.metaKey &&
    !extra.shiftKey &&
    !extra.altKey &&
    !(extra.button > 0) &&
    !link.hasAttribute('download') &&
    !link.getAttribute('target')
  ) {
    const next = new URL(link.getAttribute('href'), h.history.href).href;
    if (next !== h.history.href) {
      const urls = h.history.nativeFragment(next);
      h.win.emit('popstate', { state: null });
      h.win.emit('hashchange', urls);
    }
    h.$('inspector').focus();
  }
  return click;
}

test('Skip inventory followed by cold Back retains the exact selected asset without adding a fragment entry', async (t) => {
  const history = historyEntry();
  const first = await studio(t, { history });
  await first.wait();
  search(first, 'player');
  rowFor(first, scout).click();
  // Match the observed native journey: reversible workspace selection followed
  // by Undo leaves the clean accepted revision and the inspector selected.
  const originalTheme = first.$('filter-theme').value;
  const otherTheme = first
    .$('filter-theme')
    .options.find((option) => option.value !== originalTheme);
  assert.ok(otherTheme);
  first.$('filter-theme').value = otherTheme.value;
  first.$('filter-theme').emit('change');
  await waitFor(() => !first.doc.querySelector('.inventory').inert);
  first.$('undo-draft').focus();
  first.$('undo-draft').click();
  await waitFor(() => !first.doc.querySelector('.inventory').inert);
  assert.equal(first.$('filter-theme').value, originalTheme);
  assert.doesNotMatch(first.$('workspace-summary').textContent, /unsaved changes/);
  const count = first.$('slot-count').textContent;
  activateSkip(first);
  const beforeLeave = history.calls.length;
  first.close();
  assert.equal(history.calls.length, beforeLeave, 'No pagehide history mutation.');
  const second = await studio(t, { history, restoredQuery: 'player' });
  await second.wait();
  second.$('studio-game-return').focus();
  second.win.emit('pageshow', { persisted: false });
  assert.equal(second.$('slot-id').textContent, scout);
  assert.equal(second.$('slot-count').textContent, count);
  assert.equal(selectedRow(second), rowFor(second, scout));
  assert.equal(second.doc.activeElement, second.$('studio-game-return'));
  assert.equal(history.length, 1, 'Focus-only skip adds no Back/Forward step.');
  assert.equal(history.href, 'https://example.test/authoring/asset-studio/');
  assert.deepEqual(history.state.foreign, { retained: true });
  assert.deepEqual(first.db.allPuts, []);
  assert.deepEqual(second.db.allPuts, []);
  assert.equal(first.writes() + second.writes(), 0);
});

test('Skip inventory owns only ordinary same-tab focus, preserving modifiers, direct fragments and drafts', async (t) => {
  const h = await studio(t);
  await h.wait();
  search(h, 'player');
  rowFor(h, scout).click();
  const link = h.doc.querySelector('a[href="#inspector"]');
  for (const mode of [
    'ctrl',
    'meta',
    'shift',
    'alt',
    'middle',
    'download',
    'target',
    'prevented',
  ]) {
    link.removeAttribute('download');
    link.removeAttribute('target');
    if (mode === 'download') link.setAttribute('download', 'asset');
    if (mode === 'target') link.setAttribute('target', '_blank');
    const event = activateSkip(h, {
      button: mode === 'middle' ? 1 : 0,
      ctrlKey: mode === 'ctrl',
      metaKey: mode === 'meta',
      shiftKey: mode === 'shift',
      altKey: mode === 'alt',
      defaultPrevented: mode === 'prevented',
    });
    assert.equal(event.defaultPrevented, mode === 'prevented', mode);
    assert.equal(h.doc.activeElement, link, mode);
  }
  link.removeAttribute('download');
  link.removeAttribute('target');
  h.$('review-evidence').value = 'Local draft retained across accessible focus navigation.';
  h.$('record-review').click();
  await waitFor(() => !h.doc.querySelector('.inventory').inert);
  const summary = h.$('workspace-summary').textContent;
  const contract = h.$('slot-contract').textContent;
  const state = structuredClone(h.history.state),
    calls = h.history.calls.length;
  const event = activateSkip(h);
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.doc.activeElement, h.$('inspector'));
  assert.equal(h.history.calls.length, calls);
  assert.deepEqual(h.history.state, state);
  assert.equal(h.history.length, 1);
  assert.equal(h.$('workspace-summary').textContent, summary);
  assert.equal(h.$('slot-contract').textContent, contract);
  assert.equal(h.$('slot-id').textContent, scout);
  // Direct deep-link/history traversal remains browser-owned. No new generic
  // popstate/hashchange handler can overwrite that destination or live draft.
  const urls = h.history.nativeFragment(h.history.href + '#inspector');
  h.history.state = {
    foreign: 'older entry',
    [KEY]: { version: 1, selected: 'ui.panel', query: 'panel' },
  };
  const destination = structuredClone(h.history.state);
  h.win.emit('popstate', { state: h.history.state });
  h.win.emit('hashchange', urls);
  assert.deepEqual(h.history.state, destination);
  assert.equal(h.$('slot-contract').textContent, contract);
  assert.equal(activateSkip(h).defaultPrevented, true);
  assert.equal(h.history.length, 2, 'An existing direct fragment receives no duplicate entry.');
  assert.equal(h.history.href, urls.newURL);
  assert.equal(h.$('slot-id').textContent, scout);
  assert.deepEqual(h.db.allPuts, []);
});
