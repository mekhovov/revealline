// Local acceptance fixture only. Serve packaged bytes unchanged, except for a
// pre-app input shim injected into the Solo HTML response. No production edit.
/* global location, window, document */
import http from 'node:http';
import path from 'node:path';
import { open, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function browserFixture() {
  const params = new URLSearchParams(location.search),
    requested = params.get('fixture') || 'native-events',
    mode = ['native-events', 'neutral-native', 'native-first'].includes(requested)
      ? requested
      : 'native-events',
    duration = (name, fallback, maximum) => {
      const value = Number(params.get(name));
      return params.has(name) && Number.isFinite(value) && value >= 0
        ? Math.min(maximum, value)
        : fallback;
    },
    holdMs = duration('holdMs', 250, 10000),
    lagMs = duration('lagMs', 40, 200),
    pad = {
      index: 0,
      id: 'Steam Deck acceptance fixture (STANDARD GAMEPAD)',
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    },
    events = [],
    nativeRAF = window.requestAnimationFrame.bind(window),
    nativeCancelRAF = window.cancelAnimationFrame.bind(window),
    callbacks = new Map();
  let held = false,
    sequence = 0,
    callbackSequence = 0,
    phase = 'ready',
    panel = null,
    output = null,
    publishing = false;

  const state = () => ({
    build: document.documentElement.dataset.buildVersion || '',
    boot: document.documentElement.dataset.bootState || '',
    focus: document.activeElement?.id || '',
    flight: document.body?.dataset.flightState || '',
    homeSound: document.getElementById('shell-sound')?.getAttribute('aria-pressed') ?? null,
    pauseSound: document.getElementById('overlay-sound')?.getAttribute('aria-pressed') ?? null,
    settings: document.getElementById('settings-dialog')?.open ?? false,
    home: document.getElementById('shell-home')?.open ?? false,
    dialogs: [...document.querySelectorAll('dialog[open]')].map((element) => element.id),
  });
  const publish = () => {
    if (!document.body || publishing) return;
    publishing = true;
    if (!output) {
      output = document.createElement('script');
      output.type = 'application/json';
      output.id = 'deck-fixture-results';
      document.body.append(output);
      panel = document.createElement('aside');
      panel.id = 'deck-fixture-status';
      panel.setAttribute('role', 'status');
      panel.style.cssText =
        'position:fixed;top:0;left:0;z-index:2147483647;padding:3px 7px;' +
        'background:#17212be6;color:#fff;font:11px/1.3 monospace;pointer-events:none';
      document.body.append(panel);
    }
    document.body.dataset.deckFixture = mode;
    document.body.dataset.deckFixtureHeld = String(held);
    document.body.dataset.deckFixturePhase = phase;
    output.textContent = JSON.stringify({
      fixture: 'controller-confirm-browser',
      mode,
      holdMs,
      lagMs,
      held,
      phase,
      deferredAnimationFrames: [...callbacks.values()].filter((entry) => entry.deferred).length,
      state: state(),
      events,
    });
    panel.textContent = `LOCAL INPUT FIXTURE · ${mode} · A ${held ? 'down' : 'up'} · ${phase} · events ${events.length}`;
    publishing = false;
  };
  const record = (kind, details = {}) => {
    events.push({
      sequence: ++sequence,
      time: Math.round(performance.now() * 10) / 10,
      kind,
      ...details,
      state: state(),
    });
    if (events.length > 256) events.splice(0, events.length - 256);
    publish();
  };
  const scheduleFrame = (id, entry) => {
    entry.handle = nativeRAF((time) => {
      if (mode === 'native-events' && held) {
        entry.deferred = true;
        record('raf-deferred');
        return;
      }
      callbacks.delete(id);
      entry.callback(time);
    });
  };
  window.requestAnimationFrame = (callback) => {
    const id = ++callbackSequence,
      entry = { callback, deferred: false, handle: null };
    callbacks.set(id, entry);
    scheduleFrame(id, entry);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const entry = callbacks.get(id);
    if (!entry) return;
    if (entry.handle !== null) nativeCancelRAF(entry.handle);
    callbacks.delete(id);
  };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  const setHeld = (pressed, reason) => {
    if (held === pressed) return;
    held = pressed;
    pad.timestamp = performance.now();
    pad.buttons[0] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
    phase = pressed ? 'held' : 'released';
    record(pressed ? 'gamepad-down' : 'gamepad-up', { reason });
    if (!pressed)
      for (const [id, entry] of callbacks)
        if (entry.deferred) {
          entry.deferred = false;
          scheduleFrame(id, entry);
        }
  };
  const relevant = (event) =>
    event.type.startsWith('key')
      ? ['Enter', ' '].includes(event.key)
      : (event.button == null || event.button === 0 || event.button === -1) &&
        (event.type === 'click' || event.isPrimary !== false);
  const describe = (event) => ({
    type: event.type,
    isTrusted: event.isTrusted,
    defaultPrevented: event.defaultPrevented,
    targetId: event.target?.id || '',
    ...(event.type.startsWith('key')
      ? { key: event.key, repeat: !!event.repeat }
      : {
          pointerType: event.pointerType || '',
          pointerId: event.pointerId,
          isPrimary: event.isPrimary,
          button: event.button,
        }),
  });
  for (const type of [
    'keydown',
    'keypress',
    'keyup',
    'pointerdown',
    'pointerup',
    'pointercancel',
    'mousedown',
    'mouseup',
    'click',
  ])
    window.addEventListener(
      type,
      (event) => {
        if (!relevant(event)) return;
        record('native-before', describe(event));
        if (event.isTrusted && mode === 'native-events') {
          if (type === 'pointerdown' || (type === 'keydown' && !event.repeat)) setHeld(true, type);
          if (['pointerup', 'pointercancel', 'keyup'].includes(type)) setHeld(false, type);
        }
        // Run after the document guard and the browser's normal activation.
        setTimeout(() => {
          record('native-after', describe(event));
          if (
            event.isTrusted &&
            type === 'click' &&
            mode === 'native-first' &&
            !event.defaultPrevented
          ) {
            phase = 'native-winner-pending-gamepad';
            record('script-scheduled', { lagMs, holdMs });
            setTimeout(() => {
              setHeld(true, 'delayed-native-first');
              setTimeout(() => setHeld(false, 'delayed-native-first-release'), holdMs);
            }, lagMs);
          }
        }, 0);
        if (type === 'click') setTimeout(() => record('settled-after-click'), 350);
      },
      { capture: true },
    );
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      document.title = `[LOCAL INPUT FIXTURE] ${document.title}`;
      record('fixture-ready');
    },
    { once: true },
  );
  window.addEventListener('blur', () => {
    setHeld(false, 'window-blur');
    record('window-blur');
  });
  // Refresh read-only diagnostics after async application state changes. The
  // fixture never focuses a control, dispatches native events, or calls click.
  setInterval(publish, 100);
}

// Release distribution.zip uses STORE entries. Read only the requested member,
// avoiding a second 700+ MiB extracted site on constrained acceptance machines.
async function storedArchive(file) {
  const handle = await open(file, 'r'),
    { size } = await handle.stat();
  const read = async (length, position) => {
    if (position < 0 || length < 0 || position + length > size)
      throw new Error('Archive member is outside the file.');
    const bytes = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const result = await handle.read(bytes, offset, length - offset, position + offset);
      if (!result.bytesRead) throw new Error('Truncated archive.');
      offset += result.bytesRead;
    }
    return bytes;
  };
  const tail = await read(Math.min(size, 65557), Math.max(0, size - 65557));
  let end = tail.length - 22;
  while (
    end >= 0 &&
    (tail.readUInt32LE(end) !== 0x06054b50 ||
      end + 22 + tail.readUInt16LE(end + 20) !== tail.length)
  )
    end--;
  if (end < 0 || tail.readUInt32LE(end + 4) !== 0)
    throw new Error('Expected a single-disk ZIP archive.');
  const count = tail.readUInt16LE(end + 10),
    directorySize = tail.readUInt32LE(end + 12),
    directoryOffset = tail.readUInt32LE(end + 16);
  if (
    count === 65535 ||
    count !== tail.readUInt16LE(end + 8) ||
    directorySize > 32 * 1024 * 1024 ||
    directoryOffset + directorySize !== size - tail.length + end
  )
    throw new Error('Unsupported ZIP directory.');
  const directory = await read(directorySize, directoryOffset),
    entries = new Map();
  let cursor = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error('Invalid ZIP member.');
    const flags = directory.readUInt16LE(cursor + 8),
      method = directory.readUInt16LE(cursor + 10),
      compressed = directory.readUInt32LE(cursor + 20),
      length = directory.readUInt32LE(cursor + 24),
      nameLength = directory.readUInt16LE(cursor + 28),
      extraLength = directory.readUInt16LE(cursor + 30),
      commentLength = directory.readUInt16LE(cursor + 32),
      offset = directory.readUInt32LE(cursor + 42),
      next = cursor + 46 + nameLength + extraLength + commentLength,
      name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (
      flags & 1 ||
      method !== 0 ||
      compressed !== length ||
      next > directory.length ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      entries.has(name)
    )
      throw new Error('Expected unique unencrypted STORE entries.');
    entries.set(name, { offset, length });
    cursor = next;
  }
  if (cursor !== directory.length) throw new Error('Unexpected ZIP directory bytes.');
  return async (name) => {
    const entry = entries.get(name);
    if (!entry) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    const header = await read(30, entry.offset);
    if (header.readUInt32LE(0) !== 0x04034b50 || header.readUInt16LE(8) !== 0)
      throw new Error('Invalid ZIP local header.');
    const nameLength = header.readUInt16LE(26),
      extraLength = header.readUInt16LE(28),
      dataOffset = entry.offset + 30 + nameLength + extraLength;
    if (
      (await read(nameLength, entry.offset + 30)).toString('utf8') !== name ||
      dataOffset + entry.length > directoryOffset
    )
      throw new Error('ZIP member does not match directory.');
    return read(entry.length, dataOffset);
  };
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  args = process.argv.slice(2),
  option = (name, fallback) => {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
  },
  root = path.resolve(projectRoot, option('--root', 'dist')),
  archive = option('--archive', null),
  port = Number(option('--port', '8879')),
  types = {
    '.html': 'text/html; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
  };
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid fixture port.');
const readArchive = archive ? await storedArchive(path.resolve(archive)) : null;
if (readArchive) await readArchive('game/index.html');
else await stat(path.join(root, 'game/index.html'));
const injection = `<script id="deck-fixture-bootstrap">(${browserFixture.toString()})();</script>`;
http
  .createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const url = new URL(request.url, `http://127.0.0.1:${port}`),
        pathname = decodeURIComponent(url.pathname),
        relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname,
        file = path.resolve(root, `.${relative}`);
      if (!file.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      let body = readArchive ? await readArchive(relative.slice(1)) : await readFile(file);
      if (relative === '/game/index.html')
        body = Buffer.from(
          body.toString('utf8').replace(/<head\b[^>]*>/u, (head) => `${head}\n${injection}`),
        );
      response.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'X-Controller-Input-Fixture':
          relative === '/game/index.html' ? 'injected' : 'packaged-byte',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response
        .writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500, {
          'Content-Type': 'text/plain; charset=utf-8',
        })
        .end(error.code === 'ENOENT' ? 'Not found' : 'Fixture request failed');
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Controller fixture serving ${archive ? path.resolve(archive) : root}`);
    console.log(`http://127.0.0.1:${port}/game/?fixture=native-events&controllerTrace=1`);
  });
