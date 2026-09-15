import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, symlink, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachVideoPosterWorkshop } from '../ui/video-poster-workshop.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { deferred, pngBytes } from './helpers/media-fixtures.mjs';

const html = await readFile(
  new URL('../../authoring/video-poster/index.html', import.meta.url),
  'utf8',
);
const bytes = pngBytes();
const flush = () => new Promise((resolve) => setImmediate(resolve));
function poster(time, observed = time) {
  return {
    blob: new Blob([bytes], { type: 'image/png' }),
    asset: { width: 1, height: 1, bytes: bytes.length, sha256: 'b'.repeat(64) },
    capture: {
      requestedTime: time,
      observedMediaTime: observed,
      playheadTime: time,
      sourceSha256: 'a'.repeat(64),
    },
  };
}
async function setup(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  const main = doc.createElement('main');
  main.id = 'video-poster-main';
  doc.body.append(main);
  const map = new Map([[main.id, main]]);
  for (const [, tag, attrs, id, rest] of html.matchAll(
    /<(a|p|fieldset|input|button|section|img|h2)\b([^>]*?)id="([^"]+)"([^>]*)>/g,
  )) {
    const el = doc.createElement(tag);
    el.id = id;
    map.set(id, el);
    if (tag === 'a')
      Object.defineProperty(el, 'href', {
        get() {
          return this.getAttribute('href') || '';
        },
        set(value) {
          this.setAttribute('href', value);
        },
      }); // Native HTMLAnchorElement href assignment reflects its content attribute.
    for (const [, key, value] of (attrs + rest).matchAll(
      /(type|value|min|max|step|href)="([^"]*)"/g,
    )) {
      el[key] = value;
      el.setAttribute(key, value);
    }
    el.hidden = /\bhidden\b/.test(rest);
    el.disabled = /\bdisabled\b/.test(rest);
    el.setAttribute('aria-label', id);
    main.append(el);
  }
  for (const id of ['image', 'download', 'evidence', 'preview-title'])
    map.get('video-poster-preview').append(map.get(`video-poster-${id}`));
  map.get('video-poster-controls').disabled = false; // Successful classic launcher default.
  const win = new Events(),
    frames = new Map(),
    urls = new Map(),
    sources = [];
  let nextFrame = 0,
    nextURL = 0,
    captures = 0,
    padReads = 0;
  win.requestAnimationFrame = (fn) => {
    frames.set(++nextFrame, fn);
    return nextFrame;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  Object.defineProperties(win, {
    localStorage: {
      get() {
        assert.fail('No profile read');
      },
    },
    indexedDB: {
      get() {
        assert.fail('No media database');
      },
    },
  });
  const pad = {
    id: 'Standard pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const host = attachVideoPosterWorkshop({
    document: doc,
    window: win,
    readPads: () => {
      padReads++;
      return [pad];
    },
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:poster-${++nextURL}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        assert.ok(urls.has(url));
        urls.delete(url);
      },
    },
    async openSource(file, { signal }) {
      assert.ok(file instanceof Blob);
      if (options.openSource) return options.openSource(file, { signal });
      const s = {
        info: {
          mime: 'video/mp4',
          width: 1,
          height: 1,
          bytes: 100,
          durationSeconds: 6,
          sha256: 'a'.repeat(64),
        },
        disposed: false,
        dispose() {
          this.disposed = true;
        },
        async capture(time, metadata, config) {
          captures++;
          assert.equal(metadata.provenance.kind, 'original');
          if (options.capture) return options.capture(time, config);
          return poster(time, options.fallback ? null : time - 0.033);
        },
      };
      sources.push(s);
      return s;
    },
  });
  t.after(() => host.dispose());
  return {
    doc,
    win,
    host,
    pad,
    frames,
    urls,
    sources,
    get captures() {
      return captures;
    },
    get padReads() {
      return padReads;
    },
    $(id) {
      return map.get(`video-poster-${id}`);
    },
    async inspect() {
      this.$('file').files = [new Blob(['owned video'])];
      return this.$('file').onchange();
    },
    frame(time = 0) {
      const first = frames.entries().next().value;
      assert.ok(first);
      frames.delete(first[0]);
      first[1](time);
    },
  };
}

test('standalone entry has native file/time controls, dark local styles and file failure before modules', async () => {
  assert.match(html, /type="file"[^>]*accept="video\/mp4,video\/webm/);
  assert.match(html, /type="number"/);
  assert.match(html, /type="range"/);
  assert.match(html, /fieldset id="video-poster-controls" disabled/);
  assert.match(html, /No|does not save/);
  const script = await readFile(
    new URL('../../authoring/video-poster/launch.js', import.meta.url),
    'utf8',
  );
  const status = { textContent: '' },
    controls = { disabled: true };
  runInNewContext(script, {
    document: { getElementById: (id) => (id.endsWith('status') ? status : controls) },
    location: { protocol: 'file:' },
  });
  assert.equal(controls.disabled, true);
  assert.match(status.textContent, /localhost.*No game or media storage/);
});

test('actual workshop handlers inspect/select/capture and retain exact PNG until native explicit download', async (t) => {
  const h = await setup(t);
  assert.equal(h.$('capture').disabled, true);
  assert.equal(await h.inspect(), true);
  assert.equal(h.doc.activeElement, h.$('time'));
  assert.match(h.$('metadata').textContent, /Original SHA-256/);
  h.$('time').value = '2';
  h.$('time').emit('input');
  assert.equal(h.$('range').value, '2');
  assert.equal(await h.$('capture').onclick(), true);
  assert.equal(h.doc.activeElement, h.$('download'));
  assert.equal(h.$('download').hidden, false);
  assert.equal(h.$('download').download, 'RevealLine-poster-2.png');
  assert.match(
    h.$('evidence').textContent,
    /Requested seek: 2 s.*\nObserved frame timestamp: 1.967/,
  );
  assert.equal(h.urls.size, 1);
  assert.deepEqual(Buffer.from(await h.urls.values().next().value.arrayBuffer()), bytes);
  assert.match(h.$('status').textContent, /explicitly Download/);
  h.$('download').click();
  assert.match(h.$('status').textContent, /download requested.*retry/i);
  assert.equal(h.urls.size, 1);
  h.host.clear();
  assert.equal(h.urls.size, 0);
  assert.equal(h.sources[0].disposed, true);
});

test('fallback timing is explicitly unavailable, never substituted with requested time', async (t) => {
  const h = await setup(t, { fallback: true });
  await h.inspect();
  h.$('time').value = '3';
  await h.host.capture();
  assert.match(h.$('evidence').textContent, /Frame timestamp unavailable.*Approximate playhead: 3/);
  assert.doesNotMatch(h.$('evidence').textContent, /Observed frame timestamp/);
});

test('invalid numeric times do not clamp, allocate or disturb an existing poster', async (t) => {
  const h = await setup(t);
  await h.inspect();
  h.$('time').value = '1';
  await h.host.capture();
  const url = h.$('download').href;
  for (const value of ['', '-1', '9', 'not-a-number']) {
    h.$('time').value = value;
    assert.equal(await h.host.capture(), false);
  }
  assert.equal(h.captures, 1);
  assert.equal(h.$('download').href, url);
  assert.equal(h.urls.size, 1);
});

test('cancelled late inspection is disposed and cannot enable capture', async (t) => {
  const late = deferred();
  let signal;
  const h = await setup(t, {
    openSource(_file, opts) {
      signal = opts.signal;
      return late.promise;
    },
  });
  const opening = h.inspect();
  assert.equal(h.$('status').dataset.state, 'busy');
  assert.match(h.$('status').textContent, /Inspecting video metadata/);
  assert.equal(h.$('cancel').disabled, false);
  h.host.cancel();
  const cancelledText = h.$('status').textContent;
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.equal(signal.aborted, true);
  const source = {
    disposeCount: 0,
    dispose() {
      this.disposeCount++;
    },
  };
  late.resolve(source);
  assert.equal(await opening, false);
  assert.equal(h.$('status').textContent, cancelledText);
  assert.equal(source.disposeCount, 1);
  assert.equal(h.$('capture').disabled, true);
  assert.equal(h.urls.size, 0);
});

test('older inspection completion cannot replace a newer successfully inspected source', async (t) => {
  const first = deferred(),
    second = deferred();
  let calls = 0,
    oldDisposed = 0;
  const h = await setup(t, { openSource: () => (++calls === 1 ? first.promise : second.promise) });
  const old = h.inspect(),
    next = h.inspect();
  second.resolve({
    info: {
      mime: 'video/mp4',
      width: 2,
      height: 1,
      bytes: 200,
      durationSeconds: 4,
      sha256: 'c'.repeat(64),
    },
    capture: async (time) => poster(time),
    dispose() {},
  });
  assert.equal(await next, true);
  const newerText = h.$('status').textContent;
  assert.equal(h.$('status').dataset.state, 'ready');
  first.resolve({
    dispose() {
      oldDisposed++;
    },
  });
  assert.equal(await old, false);
  assert.equal(h.$('status').textContent, newerText);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(oldDisposed, 1);
  assert.match(h.$('metadata').textContent, /2 × 1.*4 s/);
  assert.equal(h.$('time').max, '4');
  assert.equal(await h.host.capture(), true);
});

test('fixture generator explains usage and refuses output outside its exclusive cache boundary', () => {
  const script = fileURLToPath(
    new URL('../../authoring/video-poster/generate-fixture.mjs', import.meta.url),
  );
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /NEW_FIXTURE_DIRECTORY/);
  const refused = spawnSync(process.execPath, [script, '--out', 'game/test'], { encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /new directory under.*cache/);
});

test('fixture generator refuses symlink ancestors before writing outside its cache and preserves existing directories', async (t) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const cache = path.join(root, '.cache');
  await mkdir(cache, { recursive: true });
  const inside = await mkdtemp(path.join(cache, 'video-generator-test-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'revealline-video-generator-'));
  t.after(async () => {
    await rm(inside, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  const script = fileURLToPath(
    new URL('../../authoring/video-poster/generate-fixture.mjs', import.meta.url),
  );
  const nested = path.join(inside, 'ordinary');
  await mkdir(nested);
  await symlink(outside, path.join(nested, 'linked'), 'dir');
  const refused = spawnSync(
    process.execPath,
    [script, '--out', path.join(nested, 'linked', 'escape')],
    {
      encoding: 'utf8',
      env: { ...process.env, PATH: '' },
    },
  );
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /never symbolic links/);
  await assert.rejects(stat(path.join(outside, 'escape')), { code: 'ENOENT' });
  const existing = spawnSync(process.execPath, [script, '--out', nested], {
    encoding: 'utf8',
    env: { ...process.env, PATH: '' },
  });
  assert.equal(existing.status, 1);
  assert.match(existing.stderr, /EEXIST/);
  assert.equal((await stat(nested)).isDirectory(), true);
  await assert.rejects(stat(path.join(nested, 'fixture.json')), { code: 'ENOENT' });
});

test('Cancel and source change reject late capture publication while retaining prior result only for same source', async (t) => {
  let late = null,
    signal;
  const h = await setup(t, {
    capture(time, opts) {
      if (late) {
        signal = opts.signal;
        return late.promise;
      }
      return poster(time);
    },
  });
  await h.inspect();
  h.$('time').value = '1';
  await h.host.capture();
  const first = h.$('download').href;
  late = deferred();
  const pending = h.host.capture();
  h.host.cancel();
  assert.equal(signal.aborted, true);
  late.resolve(poster(2));
  assert.equal(await pending, false);
  assert.equal(h.$('download').href, first);
  late = deferred();
  const old = h.host.capture();
  await h.inspect();
  assert.equal(h.urls.size, 0);
  assert.equal(h.$('download').hidden, true);
  late.resolve(poster(3));
  assert.equal(await old, false);
  assert.equal(h.urls.size, 0);
});

test('failed capture preserves exact prior preview and allows retry', async (t) => {
  let fails = false;
  const h = await setup(t, {
    capture(time) {
      if (fails) throw new Error('Decoder timed out');
      return poster(time);
    },
  });
  await h.inspect();
  h.$('time').value = '1';
  await h.host.capture();
  const old = h.$('download').href;
  fails = true;
  assert.equal(await h.host.capture(), false);
  assert.equal(h.$('download').href, old);
  assert.match(h.$('status').textContent, /timed out.*previous captured poster is unchanged/);
  assert.equal(h.$('capture').disabled, false);
  fails = false;
  await h.host.capture();
  assert.equal(h.urls.size, 1);
});

test('native file-picker blur keeps selection while hidden/pagehide cancels and releases work', async (t) => {
  const late = deferred();
  let signal;
  const h = await setup(t, {
    capture(_time, config) {
      signal = config.signal;
      return late.promise;
    },
  });
  await h.inspect();
  h.win.emit('blur');
  assert.equal(h.$('capture').disabled, false);
  const pending = h.host.capture();
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(signal.aborted, true);
  late.resolve(poster(0));
  assert.equal(await pending, false);
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.sources[0].disposed, true);
  assert.equal(h.frames.size, 0);
  h.doc.hidden = false;
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 1);
  assert.equal(h.$('capture').disabled, true);
  assert.equal(h.urls.size, 0);
});

test('controller native range editing and confirmation reaches explicit PNG action without mouse', async (t) => {
  const h = await setup(t);
  await h.inspect();
  h.$('range').focus();
  h.host.navigation.handle({ confirm: true });
  h.host.navigation.handle({ direction: 'right' });
  h.host.navigation.handle({ confirm: true });
  assert.equal(h.$('time').value, '0.1');
  h.$('capture').focus();
  h.host.navigation.handle({ confirm: true });
  await flush();
  assert.equal(h.captures, 1);
  assert.equal(h.doc.activeElement, h.$('download'));
  h.host.navigation.handle({ confirm: true });
  assert.match(h.$('status').textContent, /download requested/i);
});

test('native keyboard editing/activation preserves input defaults and no repeated capture during work', async (t) => {
  const gate = deferred(),
    h = await setup(t, { capture: () => gate.promise });
  await h.inspect();
  h.$('time').focus();
  assert.equal(h.$('time').emit('keydown', { key: 'ArrowRight' }).defaultPrevented, false);
  h.$('capture').focus();
  const event = h.$('capture').emit('keydown', { key: 'Enter' });
  assert.equal(event.defaultPrevented, false); // Browser native click is modeled separately.
  const pending = h.$('capture').onclick();
  assert.equal(await h.host.capture(), false);
  gate.resolve(poster(0));
  await pending;
  assert.equal(h.captures, 1);
});

test('focused page owns polling; held pad must neutralize after native input and focus loss', async (t) => {
  const h = await setup(t);
  h.frame(0);
  h.pad.buttons[0] = { pressed: true, value: 1 };
  h.frame(20);
  h.pad.buttons[0] = { pressed: false, value: 0 };
  h.frame(40);
  h.$('back').focus();
  h.pad.buttons[13] = { pressed: true, value: 1 };
  h.frame(60);
  h.$('file').focus();
  h.$('file').emit('pointerdown');
  h.frame(700);
  assert.equal(h.doc.activeElement, h.$('file'));
  const reads = h.padReads;
  h.doc.focused = false;
  h.frame(800);
  assert.equal(h.padReads, reads);
  h.doc.focused = true;
  h.frame(900);
  assert.equal(h.doc.activeElement, h.$('file'));
});

test('disposal revokes prepared PNG and late callbacks cannot restart the standalone page', async (t) => {
  const h = await setup(t);
  await h.inspect();
  await h.host.capture();
  assert.equal(h.urls.size, 1);
  h.host.dispose();
  assert.equal(h.urls.size, 0);
  assert.equal(h.frames.size, 0);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(await h.host.capture(), false);
});

test('classic video workshop exposes loading immediately after its title', async () => {
  const html = await readFile(
    new URL('../../authoring/video-poster/index.html', import.meta.url),
    'utf8',
  );
  assert.ok(html.indexOf('id="video-poster-back"') < html.indexOf('</h1>'));
  assert.ok(html.indexOf('</h1>') < html.indexOf('id="video-poster-status"'));
  assert.ok(html.indexOf('id="video-poster-status"') < html.indexOf('Inspect your own video'));
});
