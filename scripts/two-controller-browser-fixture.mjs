// Local acceptance fixture. Production modules/assets are served unchanged.
// Only ?fixture=two-pads couch HTML receives a pre-app Gamepad shim.
/* global document, window, navigator */
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function installFixture() {
  const make = (index, id, mapping = 'standard') => ({
    index,
    id,
    mapping,
    connected: true,
    timestamp: 0,
    axes: [0, 0, 0, 0, 0, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })),
  });
  const pads = [
    make(2, 'Identical fixture pad'),
    make(5, 'Identical fixture pad'),
    make(7, 'EdgeTX fixture radio', ''),
    make(9, 'Extra fixture pad'),
  ];
  pads[2].axes[2] = -1;
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => {
      const snapshot = [];
      for (const pad of pads) if (pad.connected) snapshot[pad.index] = structuredClone(pad);
      return snapshot;
    },
  });
  const changeConnection = (pad, connected) => {
    pad.connected = connected;
    pad.axes.fill(0);
    for (const b of pad.buttons) {
      b.pressed = false;
      b.value = 0;
    }
    const event = new Event(connected ? 'gamepadconnected' : 'gamepaddisconnected');
    Object.defineProperty(event, 'gamepad', { value: pad });
    window.dispatchEvent(event);
  };
  const pulse = (pad, index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    setTimeout(() => {
      pad.buttons[index] = { pressed: false, value: 0 };
    }, 250);
  };
  const actions = {
    'Join P1': () => pulse(pads[0], 3),
    'Join P2': () => pulse(pads[1], 3),
    'P1 right': () => {
      pads[0].axes[0] = 1;
    },
    'P2 left': () => {
      pads[1].axes[0] = -1;
    },
    'Release all': () => {
      for (const pad of pads) {
        pad.axes.fill(0);
        for (const b of pad.buttons) {
          b.pressed = false;
          b.value = 0;
        }
      }
      pads[2].axes[2] = -1;
    },
    'P2 pause': () => pulse(pads[1], 9),
    'Disconnect P1': () => changeConnection(pads[0], false),
    'Reconnect P1': () => changeConnection(pads[0], true),
    'Disconnect extra': () => changeConnection(pads[3], false),
    'Radio axis 6': () => {
      pads[2].axes[6] = pads[2].axes[6] ? 0 : 1;
    },
    'Radio switch 23': () => {
      const value = pads[2].buttons[23].value ? 0 : 1;
      pads[2].buttons[23] = { pressed: !!value, value };
    },
  };
  // Isolate fixture controls from the production input/Confirm listeners. The
  // game receives only the raw hardware snapshot and normal connection events.
  for (const type of [
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'keydown',
    'keyup',
  ])
    document.addEventListener(
      type,
      (event) => {
        const control = event.target.closest?.('[data-fixture-action]');
        if (!control) return;
        event.stopImmediatePropagation();
        if (type === 'click') {
          event.preventDefault();
          actions[control.dataset.fixtureAction]();
        }
      },
      true,
    );
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.createElement('details');
    panel.open = true;
    panel.id = 'two-pad-fixture';
    panel.style.cssText =
      'position:fixed;z-index:2147483647;bottom:0;left:0;right:0;background:#112;color:white;padding:6px;font:12px sans-serif;max-height:25vh;overflow:auto';
    const summary = document.createElement('summary');
    summary.textContent = 'SIMULATED CONTROLLERS — local test only';
    panel.append(summary);
    for (const label of Object.keys(actions)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.fixtureAction = label;
      button.textContent = label;
      button.style.cssText = 'min-height:32px;margin:3px;padding:4px 8px;font:12px sans-serif';
      panel.append(button);
    }
    document.body.append(panel);
  });
}

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
const root = path.resolve(
  option('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist')),
);
const port = Number(option('--port', '8878'));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const types = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};
const shim = Buffer.from(`(${installFixture.toString()})();`);
const hosts = new Set(['/game/couch/index.html', '/game/couch/relay-rescue.html']);
http
  .createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405).end();
        return;
      }
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let relative = decodeURIComponent(url.pathname);
      if (relative.endsWith('/')) relative += 'index.html';
      const file = path.resolve(root, `.${relative}`);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      let body = relative === '/__controller-fixture.mjs' ? shim : await readFile(file);
      const injected = hosts.has(relative) && url.searchParams.get('fixture') === 'two-pads';
      if (injected)
        body = Buffer.from(
          body
            .toString()
            .replace(
              /<head\b[^>]*>/u,
              (head) => `${head}\n<script src="/__controller-fixture.mjs"></script>`,
            ),
        );
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'X-Controller-Fixture': injected ? 'injected' : 'unchanged',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Fixture request failed');
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(`http://127.0.0.1:${port}/game/couch/?journey=legacy&fixture=two-pads`),
  );
