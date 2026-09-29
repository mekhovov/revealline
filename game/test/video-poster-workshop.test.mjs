import { mountToolReturnLinks } from '../ui/workshop-return.mjs';
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
      timingEvidence: observed === null ? 'playhead-estimate' : 'presented-frame',
      decodedFrame: observed === null ? null : { width: 1, height: 1 },
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
    /<(a|p|fieldset|input|select|button|section|img|h2)\b([^>]*?)id="([^"]+)"([^>]*)>/g,
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
      /(type|value|min|max|step|href|data-workshop-return)="([^"]*)"/g,
    )) {
      el[key] = value;
      el.setAttribute(key, value);
    }
    el.inert = /\binert\b/.test(rest);
    el.hidden = /\bhidden\b/.test(rest);
    el.disabled = /(?:^|\s)disabled(?=\s|=|$)/.test(rest);
    el.setAttribute('aria-label', id);
    main.append(el);
  }
  for (const id of ['image', 'download', 'evidence', 'preview-title'])
    map.get('video-poster-preview').append(map.get(`video-poster-${id}`));
  map.get('video-poster-controls').disabled = false; // Successful classic launcher default.
  map.get('video-poster-transform').value = 'source';
  mountToolReturnLinks({
    document: doc,
    href: 'https://example.test/authoring/video-poster/?journey=opening',
    id: 'video-poster',
  });
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
    ...(options.physicalTrim ? { physicalTrim: options.physicalTrim } : {}),
    async openSource(file, { signal }) {
      assert.ok(file instanceof Blob);
      if (options.openSource) return options.openSource(file, { signal });
      const s = {
        original: file,
        info: {
          mime: 'video/mp4',
          width: 640,
          height: 360,
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
  h.$('capture').focus();
  assert.equal(await h.$('capture').onclick(), true);
  assert.equal(h.doc.activeElement, h.$('download'));
  assert.equal(h.$('download').hidden, false);
  assert.equal(h.$('download').download, 'fpv-line-poster-2.png');
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
  assert.equal(h.$('step-back').disabled, true);
  assert.equal(h.$('step-forward').disabled, true);
});

test('presented-frame evidence enables bounded directional seek and publishes only changed decoded time', async (t) => {
  let initial = true;
  const h = await setup(t, {
    capture(time) {
      if (initial) {
        initial = false;
        return poster(time, 2);
      }
      return poster(time, time - 2 > 1 / 60 ? 2.04 : 2);
    },
  });
  await h.inspect();
  h.$('time').value = '2';
  await h.host.capture();
  assert.equal(h.$('step-forward').disabled, false);
  assert.equal(await h.host.stepFrame(1), true);
  assert.match(h.$('status').textContent, /moved from 2 s to 2.04 s/);
  assert.equal(h.$('time').value, '2.04');
  assert.match(h.$('evidence').textContent, /Observed frame timestamp: 2.04/);
  assert.equal(h.urls.size, 1, 'Superseded repeated-seek PNGs are never published as URLs.');
});

test('playback range stays separate from explicitly unavailable physical trim', async (t) => {
  const h = await setup(t, {
    physicalTrim: {
      support: async () => ({
        supported: false,
        formats: [],
        reason: 'No verified physical video converter is installed in this test build.',
      }),
    },
  });
  await h.inspect();
  h.$('playback-start').value = '1';
  h.$('playback-end').value = '4';
  assert.equal(h.host.applyPlaybackRange(), true);
  assert.match(h.$('playback-evidence').textContent, /1–4 s.*complete 100-byte original/i);
  assert.match(h.$('status').textContent, /No video bytes were trimmed/);
  assert.equal(await h.host.checkPhysicalTrim(), false);
  assert.match(h.$('trim-support').textContent, /No verified physical video converter/);
  assert.equal(h.$('trim').disabled, true);
  assert.equal(h.$('trim-download').hidden, true);
});

test('verified optional trim publishes the adapter output URL and explicit audio provenance', async (t) => {
  const output = new Blob(['trimmed'], { type: 'video/mp4' });
  const h = await setup(t, {
    physicalTrim: {
      support: async () => ({ supported: true, formats: ['video/mp4'], reason: '' }),
      trim: async (_original, _info, range) => {
        assert.equal(range.startSeconds, 1);
        assert.equal(range.endSeconds, 4);
        return {
          blob: output,
          info: {
            mime: 'video/mp4',
            width: 1,
            height: 1,
            durationSeconds: 3,
            bytes: output.size,
          },
          evidence: {
            outputSha256: 'c'.repeat(64),
            visual: {
              method: 'fresh-presented-frame-decoded-png-rgb-grid.v1',
              start: { meanAbsoluteRgbError: 0.002 },
              end: { meanAbsoluteRgbError: 0.003 },
            },
            audioSync: { status: 'unverified', note: 'No audio decoder evidence.' },
            transform: {
              targetVideoBitrate: null,
              observedContainerBitsPerSecond: 1234,
            },
          },
        };
      },
    },
  });
  await h.inspect();
  h.$('playback-start').value = '1';
  h.$('playback-end').value = '4';
  assert.equal(h.host.applyPlaybackRange(), true);
  assert.equal(await h.host.checkPhysicalTrim(), true);
  assert.equal(h.$('trim').disabled, false);
  assert.equal(await h.host.trimVideo(), true);
  assert.equal(h.$('trim-download').hidden, false);
  assert.equal(h.$('trim-download').download, 'fpv-line-transformed.mp4');
  assert.match(h.$('trim-evidence').textContent, /Visual boundaries: start error 0\.002/);
  assert.match(h.$('trim-evidence').textContent, /Audio synchronization: unverified/);
  assert.deepEqual(await h.urls.values().next().value.text(), 'trimmed');
  h.host.clear();
  assert.equal(h.urls.size, 0);
});

test('bounded resize/compression plan supports whole-video conversion and invalidates stale support', async (t) => {
  const output = new Blob(['resized'], { type: 'video/mp4' });
  let supportProfile = null,
    trimProfile = null;
  const h = await setup(t, {
    physicalTrim: {
      support: async (_info, options) => {
        supportProfile = options.transform;
        return { supported: true, formats: ['video/mp4'], reason: '' };
      },
      trim: async (_original, _info, range, options) => {
        trimProfile = options.transform;
        assert.deepEqual([range.startSeconds, range.endSeconds], [0, 6]);
        return {
          blob: output,
          info: {
            mime: 'video/mp4',
            width: 1,
            height: 1,
            durationSeconds: 6,
            bytes: output.size,
          },
          evidence: {
            outputSha256: 'd'.repeat(64),
            visual: {
              method: 'fresh-presented-frame-decoded-png-rgb-grid.v1',
              start: { meanAbsoluteRgbError: 0.001 },
              end: { meanAbsoluteRgbError: 0.001 },
            },
            audioSync: { status: 'not-present', note: 'No tracks.' },
            transform: {
              targetVideoBitrate: 900_000,
              observedContainerBitsPerSecond: 800_000,
            },
          },
        };
      },
    },
  });
  await h.inspect();
  assert.equal(h.$('trim').disabled, true, 'Source-size full-range rewrite is not offered.');
  h.$('transform').value = 'compact';
  h.$('transform').onchange();
  assert.match(h.$('transform-plan').textContent, /0\.9 Mbit\/s.*Upscaling is disabled/);
  assert.match(h.$('trim-support').textContent, /Output plan changed/);
  assert.equal(await h.host.checkPhysicalTrim(), true);
  assert.equal(supportProfile, 'compact');
  assert.equal(h.$('trim').disabled, false);
  assert.equal(await h.host.trimVideo(), true);
  assert.equal(trimProfile, 'compact');
  assert.match(h.$('trim-evidence').textContent, /0\.9 Mbit\/s target.*800,000 bit\/s/);
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
  assert.match(help.stdout, /--kind portrait-rotation/);
  const unknown = spawnSync(
    process.execPath,
    [script, '--out', '.cache/unused-orientation-fixture', '--kind', 'sideways'],
    { encoding: 'utf8' },
  );
  assert.equal(unknown.status, 2);
  assert.match(unknown.stdout, /portrait-rotation/);
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
  let time = 0;
  const press = (index, down) => {
    h.pad.buttons[index] = { pressed: down, value: Number(down) };
    h.frame(++time);
  };
  const tap = (index) => {
    press(index, true);
    press(index, false);
  };
  h.frame(++time);
  tap(0); // Deliberate join; no edit is activated.
  h.$('range').focus();
  tap(0);
  tap(15);
  tap(0);
  assert.equal(h.$('time').value, '0.1');
  h.$('capture').focus();
  tap(0);
  await flush();
  assert.equal(h.captures, 1);
  assert.equal(h.doc.activeElement, h.$('download'));
  h.frame(++time); // The async capture completion re-arms the existing neutral gate.
  tap(0);
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

test('Video Poster native Confirm is captured before a frame and cannot clear the newly captured result', async (t) => {
  const h = await setup(t);
  await h.inspect();
  h.frame(0);
  h.pad.buttons[0] = { pressed: true, value: 1 };
  h.frame(1);
  h.pad.buttons[0] = { pressed: false, value: 0 };
  h.frame(2);
  h.$('capture').focus();
  h.pad.buttons[0] = { pressed: true, value: 1 };
  assert.equal(
    h.$('capture').emit('keydown', { key: 'Enter', isTrusted: true }).defaultPrevented,
    true,
  );
  assert.equal(h.captures, 0);
  h.pad.buttons[0] = { pressed: false, value: 0 };
  h.$('capture').emit('keyup', { key: 'Enter', isTrusted: true });
  await flush();
  assert.equal(h.captures, 1);
  h.$('clear').emit('click', { isTrusted: true });
  assert.equal(
    h.sources[0].disposed,
    false,
    'the release echo cannot activate another result action',
  );
  h.frame(3);
  assert.equal(h.captures, 1);
});

// Explicitly model native disabled-button blur. The fake DOM does not claim to
// reproduce browser layout, codecs, downloads or focus behavior by itself.
function nativeDisabled(element) {
  let disabled = element.disabled;
  Object.defineProperty(element, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && element.ownerDocument.activeElement === element) element.blur();
    },
  });
}
function listenerCount(h) {
  return [h.doc, h.win].reduce(
    (total, node) =>
      total +
      [...node.listeners.values(), ...node.captureListeners.values()].reduce(
        (sum, listeners) => sum + listeners.size,
        0,
      ),
    0,
  );
}
for (const fail of [false, true]) {
  test(`native capture ${fail ? 'failure' : 'success'} owns Cancel and returns to an enabled action`, async (t) => {
    const gate = deferred();
    const h = await setup(t, { capture: () => gate.promise });
    await h.inspect();
    nativeDisabled(h.$('capture'));
    nativeDisabled(h.$('cancel'));
    h.$('capture').focus();
    const before = listenerCount(h);
    const pending = h.$('capture').onclick();
    assert.equal(h.doc.activeElement, h.$('cancel'));
    assert.equal(h.$('cancel').disabled, false);
    if (fail) gate.reject(new Error('Decoder refused capture'));
    else gate.resolve(poster(0));
    assert.equal(await pending, !fail);
    const target = h.$(fail ? 'capture' : 'download');
    assert.equal(h.doc.activeElement, target);
    assert.equal(target.disabled, false);
    assert.equal(listenerCount(h), before, 'Finished work releases focus ownership listeners');
    assert.equal(h.urls.size, fail ? 0 : 1);
  });
}
for (const decision of [
  'newer-focus',
  'body-key',
  'body-pointer',
  'window-blur',
  'hidden',
  'pagehide',
  'disconnected',
  'unowned',
]) {
  test(`late capture respects ${decision} instead of taking focus`, async (t) => {
    const gate = deferred();
    const h = await setup(t, { capture: () => gate.promise });
    await h.inspect();
    nativeDisabled(h.$('capture'));
    nativeDisabled(h.$('cancel'));
    (decision === 'unowned' ? h.$('back') : h.$('capture')).focus();
    const before = listenerCount(h);
    const pending = h.$('capture').onclick();
    if (decision === 'newer-focus') {
      h.$('back').focus();
      h.$('back').blur();
    } else if (decision === 'body-key') h.doc.body.emit('keydown', { key: 'x' });
    else if (decision === 'body-pointer') h.doc.body.emit('pointerdown');
    else if (decision === 'window-blur') h.win.emit('blur');
    else if (decision === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
    } else if (decision === 'pagehide') h.win.emit('pagehide', { persisted: true });
    else if (decision === 'disconnected') h.win.emit('gamepaddisconnected');
    const accepted = h.doc.activeElement;
    gate.resolve(poster(0));
    assert.equal(await pending, !['hidden', 'pagehide'].includes(decision));
    assert.notEqual(h.doc.activeElement, h.$('download'));
    assert.equal(h.doc.activeElement, accepted === h.$('cancel') ? h.doc.body : accepted);
    assert.equal(listenerCount(h), before);
  });
}
test('focused Cancel immediately restores Capture and fences the late result', async (t) => {
  const gate = deferred();
  const h = await setup(t, { capture: () => gate.promise });
  await h.inspect();
  nativeDisabled(h.$('capture'));
  nativeDisabled(h.$('cancel'));
  h.$('capture').focus();
  const pending = h.$('capture').onclick();
  assert.equal(h.doc.activeElement, h.$('cancel'));
  h.$('cancel').onclick();
  assert.equal(h.doc.activeElement, h.$('capture'));
  gate.resolve(poster(0));
  assert.equal(await pending, false);
  assert.equal(h.doc.activeElement, h.$('capture'));
  assert.equal(h.urls.size, 0);
});
for (const owned of [true, false]) {
  test(`Clear ${owned ? 'returns its owner to source' : 'preserves another owner'} while revoking PNG`, async (t) => {
    const h = await setup(t);
    await h.inspect();
    await h.host.capture();
    nativeDisabled(h.$('clear'));
    (owned ? h.$('clear') : h.$('back')).focus();
    h.$('clear').onclick();
    assert.equal(h.doc.activeElement, h.$(owned ? 'file' : 'back'));
    assert.equal(h.sources[0].disposed, true);
    assert.equal(h.urls.size, 0);
  });
}
for (const fail of [false, true]) {
  test(`source inspection ${fail ? 'failure' : 'success'} cannot steal a newer Return focus`, async (t) => {
    const gate = deferred();
    const h = await setup(t, { openSource: () => gate.promise });
    h.$('file').focus();
    const pending = h.inspect();
    assert.equal(h.doc.activeElement, h.$('cancel'));
    h.$('back').focus();
    if (fail) gate.reject(new Error('Video unsupported'));
    else
      gate.resolve({
        info: {
          mime: 'video/mp4',
          width: 640,
          height: 360,
          bytes: 100,
          durationSeconds: 6,
          sha256: 'a'.repeat(64),
        },
        dispose() {},
      });
    assert.equal(await pending, !fail);
    assert.equal(h.doc.activeElement, h.$('back'));
  });
}
test('failed frame step restores its opener and preserves the exact accepted PNG', async (t) => {
  const h = await setup(t, { capture: (time) => poster(time, 2) });
  await h.inspect();
  h.$('time').value = '2';
  await h.host.capture();
  const url = h.$('download').href;
  nativeDisabled(h.$('step-forward'));
  nativeDisabled(h.$('cancel'));
  h.$('step-forward').focus();
  assert.equal(await h.$('step-forward').onclick(), false);
  assert.equal(h.doc.activeElement, h.$('step-forward'));
  assert.equal(h.$('download').href, url);
  assert.equal(h.urls.size, 1);
});
for (const outcome of ['unsupported', 'failure']) {
  test(`conversion support ${outcome} restores its control without publishing a transform`, async (t) => {
    const h = await setup(t, {
      physicalTrim: {
        support: async () => {
          if (outcome === 'failure') throw new Error('Converter unavailable');
          return { supported: false, reason: 'Not available', formats: [] };
        },
      },
    });
    await h.inspect();
    nativeDisabled(h.$('check-trim'));
    nativeDisabled(h.$('cancel'));
    h.$('check-trim').focus();
    assert.equal(await h.$('check-trim').onclick(), false);
    assert.equal(h.doc.activeElement, h.$('check-trim'));
    assert.equal(h.$('trim-download').hidden, true);
  });
}
