import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { attachProfileRecoveryView } from '../ui/profile-recovery.mjs';

const markup = readFileSync(new URL('../profile-recovery.html', import.meta.url), 'utf8');
const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const encode = (value = {}) => JSON.stringify({ ...defaults, ...value });
let serial = 0;
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
};
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

// Actual named markup and entries; layout, storage, file downloads and input
// hardware remain modeled boundaries. No application source is rewritten.
function mountMarkup(doc) {
  const stack = [doc.body];
  for (const [token] of markup
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      const parent = stack.at(-1);
      parent._text = (parent._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (['type', 'value', 'src'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'checked'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}

async function harness(t, { stored = encode(), reduced = false, denied = false } = {}) {
  const doc = new Document(),
    win = new Events(),
    media = Object.assign(new Events(), { matches: reduced }),
    build = deferred(),
    requests = [],
    reads = [],
    writes = [],
    frames = new Map(),
    navigations = [];
  let raw = stored,
    next = 0,
    profileInspections = 0;
  const storage = {
    getItem(key) {
      reads.push(key);
      assert.equal(key, DISPLAY_PREFERENCES_KEY, 'Loading must not inspect profile values.');
      if (denied) throw new Error('Display storage denied');
      return raw;
    },
    setItem(...args) {
      writes.push(args);
      throw new Error('Recovery must not save preferences or profile data.');
    },
    get length() {
      profileInspections++;
      throw new Error('Explicit Find has not been requested.');
    },
  };
  Object.assign(win, doc.defaultView);
  doc.defaultView = win;
  win.localStorage = storage;
  win.matchMedia = () => media;
  mountMarkup(doc);
  const saved = new Map();
  const values = {
    document: doc,
    window: win,
    localStorage: storage,
    location: { origin: 'https://recovery.test', assign: (url) => navigations.push(url) },
    navigator: {
      locks: {
        request() {
          profileInspections++;
          throw new Error('Loading cannot lock profiles.');
        },
      },
    },
    fetch: async (url, options = {}) => {
      requests.push({ url: String(url), signal: options.signal, display: { ...doc.body.dataset } });
      if (String(url).endsWith('/build-info.json')) return build.promise;
      throw new Error('No additional fetch is expected while loading.');
    },
    requestAnimationFrame(fn) {
      const id = ++next;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    build.resolve(new Response('unavailable', { status: 503 }));
    await settle();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const scripts = [...markup.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)];
  const display = scripts.find((entry) => entry[1].endsWith('/tool-display-entry.mjs'));
  const application = scripts.find((entry) => entry[1] === './profile-recovery.mjs');
  assert.ok(application, 'Use the actual Recovery application entry.');
  if (display) {
    assert.ok(display.index < application.index, 'Reading policy precedes the Recovery graph.');
    await import(
      new URL(
        `${display[1]}?recovery-display=${++serial}`,
        new URL('../profile-recovery.html', import.meta.url),
      )
    );
  }
  let started = false;
  return {
    doc,
    win,
    media,
    requests,
    reads,
    writes,
    frames,
    navigations,
    $: (id) => doc.getElementById(`profile-recovery-${id}`),
    profileInspections: () => profileInspections,
    async start() {
      assert.equal(started, false);
      started = true;
      await import(
        new URL(
          `${application[1]}?recovery-display=${++serial}`,
          new URL('../profile-recovery.html', import.meta.url),
        )
      );
    },
    rejectBuild() {
      build.resolve(new Response('unavailable', { status: 503 }));
    },
    share(value) {
      raw = encode(value);
      win.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: storage, newValue: raw });
    },
    miss(value) {
      raw = encode(value);
    },
  };
}
const display = (h) => ({
  textFace: h.doc.body.dataset.textFace,
  textSize: h.doc.body.dataset.textSize,
  effects: h.doc.body.dataset.effects,
});

test('Recovery adopts saved reading settings and system reduction before held release information', async (t) => {
  const h = await harness(t, {
    stored: encode({ textFace: 'plain', textSize: 'large' }),
    reduced: true,
  });
  await h.start();
  const expected = { textFace: 'plain', textSize: 'large', effects: 'reduced' };
  assert.deepEqual(display(h), expected);
  assert.deepEqual(h.requests[0].display, expected);
  assert.equal(h.$('find').disabled, true);
  h.$('back').focus();
  h.share({ reducedEffects: true });
  assert.deepEqual(display(h), { textFace: 'pixel', textSize: 'standard', effects: 'reduced' });
  assert.equal(h.doc.activeElement, h.$('back'));
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].signal.aborted, false);
  assert.equal(h.frames.size, 1, 'Loading retains its controller escape actions.');
  assert.equal(h.profileInspections(), 0);
  assert.deepEqual(h.writes, []);
});

test('Recovery reading policy survives application loading failure and the existing Back remains usable', async (t) => {
  const h = await harness(t);
  await h.start();
  h.rejectBuild();
  await settle();
  const issue = h.$('status').textContent;
  assert.match(issue, /built release/);
  h.$('back').focus();
  h.share({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.equal(h.$('status').textContent, issue);
  assert.equal(h.doc.activeElement, h.$('back'));
  h.$('back').click();
  await waitFor(() => h.navigations.length === 1, { message: 'Back finishes owned cleanup.' });
  assert.deepEqual(h.navigations, ['./index.html']);
  assert.equal(h.profileInspections(), 0);
  assert.deepEqual(h.writes, []);
});

test('Recovery display entry works independently of an unavailable application graph and never writes denied storage', async (t) => {
  const h = await harness(t, { denied: true, reduced: true });
  // No application evaluation, as when its dependency graph cannot be fetched.
  assert.deepEqual(display(h), { textFace: 'pixel', textSize: 'standard', effects: 'reduced' });
  h.media.matches = false;
  h.media.emit('change');
  assert.equal(display(h).effects, 'full');
  assert.equal(h.requests.length, 0);
  assert.equal(h.profileInspections(), 0);
  assert.deepEqual(h.writes, []);
});

test('shared updates preserve Recovery selection, prepared original bytes, live reads and focused actions', async (t) => {
  const h = await harness(t),
    pending = deferred(),
    channel = { id: 'release-v0.41.0', version: 'v0.41.0' },
    original = {
      asset: { id: 'selected', width: 2, height: 1, bytes: 4, sha256: 'a'.repeat(64) },
      references: [],
      availability: 'available-unverified',
    },
    blob = new Blob([new Uint8Array([1, 2, 3, 4])]),
    allocated = [],
    revoked = [],
    calls = [];
  let verificationSignal;
  const view = attachProfileRecoveryView({
    document: h.doc,
    supportedChannels: [channel.id],
    reader: {
      discover: async () => ({ channels: [channel], diagnostics: [] }),
      review: async () => ({
        channel,
        profile: { status: 'valid-structure', completedLevels: 1, pictures: 1, scores: 1 },
        saved: { status: 'stored-unverified' },
        diagnostics: [],
      }),
      reviewOriginals: async () => ({ originals: [original], diagnostics: [] }),
      verifyOriginal: (_selected, { signal }) => {
        calls.push('verify');
        verificationSignal = signal;
        return pending.promise;
      },
      exportOriginalComponent: async () => {
        calls.push('export');
        return { blob, filename: 'selected.png' };
      },
      close: async () => calls.push('close'),
    },
    createURL(value) {
      allocated.push(value);
      return 'blob:preserved-original';
    },
    revokeURL: (url) => revoked.push(url),
  });
  t.after(() => view.close());
  await h.$('find').onclick();
  await h.$('review').onclick();
  await h.$('originals-review').onclick();
  const selected = h.$('original').value;
  const checking = h.$('original-verify').onclick();
  h.$('cancel').focus();
  const busy = h.$('status').textContent;
  h.share({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.equal(h.$('original').value, selected);
  assert.equal(h.$('status').textContent, busy);
  assert.equal(h.doc.activeElement, h.$('cancel'));
  assert.equal(verificationSignal.aborted, false);
  pending.resolve({ asset: original.asset, verified: true });
  await checking;
  h.$('original-file').focus();
  await h.$('original-file').onclick();
  const download = h.$('original-download'),
    summary = h.$('original-summary').textContent,
    prepared = h.$('status').textContent;
  assert.equal(h.doc.activeElement, download);
  h.share({});
  assert.equal(h.doc.activeElement, download);
  assert.equal(download.href, 'blob:preserved-original');
  assert.equal(download.hidden, false);
  assert.equal(h.$('original').value, selected);
  assert.equal(h.$('original-summary').textContent, summary);
  assert.equal(h.$('status').textContent, prepared);
  assert.deepEqual(allocated, [blob]);
  assert.deepEqual(revoked, []);
  assert.deepEqual(calls, ['verify', 'export']);
  assert.deepEqual(h.writes, []);
});

test('Recovery display lifecycle rereads missed settings once and terminal exit retires the owner', async (t) => {
  const h = await harness(t);
  h.$('back').focus();
  h.win.emit('pagehide', { persisted: true });
  h.miss({ textFace: 'plain', textSize: 'large' });
  h.media.matches = true;
  h.win.emit('pageshow', { persisted: true });
  await settle();
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.equal(h.doc.activeElement, h.$('back'));
  h.win.emit('pageshow', { persisted: true });
  await settle();
  assert.equal(h.win.listeners.get('storage').size, 1);
  assert.equal(h.media.listeners.get('change').size, 1);
  h.win.emit('pagehide', { persisted: false });
  h.share({});
  h.media.matches = false;
  h.media.emit('change');
  h.win.emit('pageshow', { persisted: true });
  await settle();
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.equal(h.win.listeners.get('storage').size, 0);
  assert.equal(h.media.listeners.get('change').size, 0);
  assert.equal(h.requests.length, 0, 'Display return never initiates recovery data reads.');
  assert.deepEqual(h.writes, []);
});
