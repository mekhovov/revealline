// Local acceptance fixture only. Serve packaged bytes unchanged, except for a
// pre-app input shim injected into the Solo HTML response. No production edit.
/* global location, window, document */
import http from 'node:http';
import path from 'node:path';
import { open, readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

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

// Read bounded original members without an expanded site. The frozen publisher
// separately binds the archive to Git; this local fixture verifies its manifest,
// canonical ZIP headers, CRCs and each requested original before serving bytes.
const ARCHIVE_FORMAT = 'revealline-distribution-zip.v2';
const MAX_EXPANDED = 1024 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const checksum = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
const safeName = (name) =>
  typeof name === 'string' &&
  name &&
  !/[\\\x00-\x1f\x7f:]/.test(name) &&
  name.split('/').every((part) => part && part !== '.' && part !== '..' && !/[ .]$/.test(part));
const requireArchive = (ok, message) => {
  if (!ok) throw new Error(message);
};

export async function distributionArchive(file) {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat();
    requireArchive(size >= 22 && size <= 950_000_000, 'Archive byte bound exceeded.');
    const read = async (length, position) => {
      requireArchive(
        position >= 0 && length >= 0 && length <= size - position,
        'Archive member outside file.',
      );
      const bytes = Buffer.alloc(length);
      let offset = 0;
      while (offset < length) {
        const result = await handle.read(bytes, offset, length - offset, position + offset);
        requireArchive(result.bytesRead > 0, 'Truncated archive.');
        offset += result.bytesRead;
      }
      return bytes;
    };
    const end = await read(22, size - 22);
    const count = end.readUInt16LE(10),
      directorySize = end.readUInt32LE(12),
      directoryOffset = end.readUInt32LE(16);
    requireArchive(
      end.readUInt32LE(0) === 0x06054b50 &&
        end.readUInt32LE(4) === 0 &&
        end.readUInt16LE(20) === 0 &&
        count > 0 &&
        count <= 20001 &&
        count === end.readUInt16LE(8) &&
        directorySize <= 32 * 1024 * 1024 &&
        directoryOffset + directorySize === size - 22,
      'Unsupported ZIP64, trailing bytes or ZIP directory.',
    );
    const directory = await read(directorySize, directoryOffset),
      entries = new Map(),
      folded = new Set();
    let cursor = 0,
      offset = 0,
      expanded = 0;
    for (let index = 0; index < count; index++) {
      requireArchive(
        cursor + 46 <= directory.length && directory.readUInt32LE(cursor) === 0x02014b50,
        'Invalid ZIP central header.',
      );
      const header = directory.subarray(cursor, cursor + 46);
      const flags = header.readUInt16LE(8),
        method = header.readUInt16LE(10),
        crc = header.readUInt32LE(16),
        compressed = header.readUInt32LE(20),
        length = header.readUInt32LE(24),
        nameLength = header.readUInt16LE(28);
      requireArchive(
        header.readUInt16LE(4) === 20 &&
          header.readUInt16LE(6) === 20 &&
          flags === 0x800 &&
          [0, 8].includes(method) &&
          header.readUInt16LE(12) === 0 &&
          header.readUInt16LE(14) === 33 &&
          header.readUInt16LE(30) === 0 &&
          header.readUInt16LE(32) === 0 &&
          header.readUInt16LE(34) === 0 &&
          header.readUInt16LE(36) === 0 &&
          header.readUInt32LE(38) === 0 &&
          header.readUInt32LE(42) === offset &&
          compressed < 0xffffffff &&
          length < 0xffffffff &&
          cursor + 46 + nameLength <= directory.length &&
          (method === 0 ? compressed === length : compressed < length),
        'Unsupported or overlapping ZIP central member.',
      );
      const nameBytes = directory.subarray(cursor + 46, cursor + 46 + nameLength);
      const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
      requireArchive(
        safeName(name) && !folded.has(name.toLowerCase()),
        'Unsafe or duplicate ZIP path.',
      );
      folded.add(name.toLowerCase());
      expanded += length;
      requireArchive(expanded <= MAX_EXPANDED, 'Expanded ZIP bound exceeded.');
      const local = await read(30, offset);
      requireArchive(
        local.readUInt32LE(0) === 0x04034b50 &&
          local.readUInt16LE(4) === 20 &&
          local.readUInt16LE(6) === flags &&
          local.readUInt16LE(8) === method &&
          local.readUInt16LE(10) === 0 &&
          local.readUInt16LE(12) === 33 &&
          local.readUInt32LE(14) === crc &&
          local.readUInt32LE(18) === compressed &&
          local.readUInt32LE(22) === length &&
          local.readUInt16LE(26) === nameLength &&
          local.readUInt16LE(28) === 0 &&
          (await read(nameLength, offset + 30)).equals(nameBytes),
        'ZIP local and central records differ.',
      );
      const dataOffset = offset + 30 + nameLength;
      requireArchive(dataOffset + compressed <= directoryOffset, 'ZIP payload overlaps directory.');
      entries.set(name, { method, crc, compressed, length, dataOffset });
      offset = dataOffset + compressed;
      cursor += 46 + nameLength;
    }
    requireArchive(
      cursor === directory.length && offset === directoryOffset,
      'Hidden or missing ZIP bytes.',
    );
    const original = async (name, maxBytes) => {
      const entry = entries.get(name);
      if (!entry) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
      requireArchive(entry.length <= maxBytes, 'Requested ZIP member exceeds bound.');
      const encoded = await read(entry.compressed, entry.dataOffset);
      let bytes = encoded;
      if (entry.method === 8) {
        const inflated = inflateRawSync(encoded, {
          maxOutputLength: Math.max(1, entry.length),
          info: true,
        });
        requireArchive(
          inflated.engine.bytesWritten === encoded.length,
          'Trailing bytes inside deflate stream.',
        );
        bytes = inflated.buffer;
      }
      requireArchive(
        bytes.length === entry.length && checksum(bytes) === entry.crc,
        'ZIP original length or CRC differs.',
      );
      return bytes;
    };
    const manifestBytes = await original('manifest.json', 4 * 1024 * 1024);
    const manifest = JSON.parse(manifestBytes);
    const contract = manifest.distributionArchive;
    const admitted = Object.hasOwn(manifest, 'distributionArchive');
    requireArchive(
      !admitted ||
        (contract &&
          typeof contract === 'object' &&
          !Array.isArray(contract) &&
          Object.keys(contract).sort().join(',') === 'format,maxExpandedBytes' &&
          contract.format === ARCHIVE_FORMAT &&
          Number.isSafeInteger(contract.maxExpandedBytes) &&
          contract.maxExpandedBytes > 0 &&
          contract.maxExpandedBytes <= MAX_EXPANDED &&
          expanded <= contract.maxExpandedBytes),
      'Invalid archive format or expanded bound.',
    );
    requireArchive(
      admitted || [...entries.values()].every((entry) => entry.method === 0),
      'Unmarked archive must use STORE.',
    );
    requireArchive(
      manifest.formatVersion === 1 &&
        Array.isArray(manifest.files) &&
        manifest.files.length + 1 === entries.size,
      'Invalid archive manifest inventory.',
    );
    const descriptors = new Map();
    let total = 0;
    for (const row of manifest.files) {
      const entry = entries.get(row.path);
      requireArchive(
        safeName(row.path) &&
          !['manifest.json', 'distribution.zip'].includes(row.path) &&
          !descriptors.has(row.path) &&
          entry &&
          Number.isSafeInteger(row.bytes) &&
          row.bytes >= 0 &&
          row.bytes === entry.length &&
          /^[a-f0-9]{64}$/.test(row.sha256),
        'Manifest member differs from archive.',
      );
      descriptors.set(row.path, row);
      total += row.bytes;
    }
    requireArchive(
      total === manifest.totalBytes &&
        total + manifestBytes.length === expanded &&
        descriptors.has(manifest.entry) &&
        descriptors.has('game/build-info.json'),
      'Manifest total or entry differs.',
    );
    const reader = async (name) => {
      if (name === 'manifest.json') return manifestBytes;
      const row = descriptors.get(name);
      if (!row) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
      // The acceptance fixture serves at most one existing native-sized member.
      // Native total admission remains a separate, unchanged 768 MiB contract.
      const bytes = await original(name, Math.min(row.bytes, 64 * 1024 * 1024));
      requireArchive(digest(bytes) === row.sha256, 'Manifest member SHA-256 differs.');
      return bytes;
    };
    const build = JSON.parse(await reader('game/build-info.json'));
    requireArchive(
      build.formatVersion === 1 &&
        build.version === manifest.version &&
        build.sourceRevision === manifest.sourceRevision &&
        build.entry === manifest.entry &&
        Object.hasOwn(build, 'distributionArchive') === admitted &&
        (!admitted ||
          (build.distributionArchive?.format === contract.format &&
            build.distributionArchive?.maxExpandedBytes === contract.maxExpandedBytes &&
            Object.keys(build.distributionArchive).sort().join(',') === 'format,maxExpandedBytes')),
      'Build identity or archive marker differs.',
    );
    if (admitted) {
      const config = JSON.parse(await reader('game/build-config.json'));
      requireArchive(
        config.distributionArchive?.format === contract.format &&
          config.distributionArchive?.maxExpandedBytes === contract.maxExpandedBytes &&
          Object.keys(config.distributionArchive).sort().join(',') === 'format,maxExpandedBytes',
        'Source config archive marker differs.',
      );
    }
    reader.close = () => handle.close();
    return reader;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
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
  const readArchive = archive ? await distributionArchive(path.resolve(archive)) : null;
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
}
