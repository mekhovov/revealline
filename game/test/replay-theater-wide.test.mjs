import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../replay-theater/index.html', import.meta.url), 'utf8');
function recording(wide, turnPolicy) {
  const level = {
    version: wide ? 'xonix-level.v3' : 'xonix-level.v1',
    id: wide ? 'wide' : 'legacy',
    name: wide ? 'Wide recording' : 'Legacy recording',
    revision: '1',
    width: wide ? 72 : 48,
    height: 36,
    ...(wide ? { encounter: null } : {}),
    spawn: { x: wide ? 60.5 : 36.5, y: 0.5 },
    goal: { coverage: 0.5 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 12.5, y: 18.5, vx: 0, vy: 0 }],
  };
  const options = { turnPolicy },
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'theater-size');
  for (let i = 0; i < 12; i++) {
    const input = { direction: 'down' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  return exportReplay(recorder, run);
}
async function until(predicate, label) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await setImmediate();
  }
  assert.fail(label);
}

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: actual theater adopts verified wide bitmap, preserves it through failed/stale loads and restores legacy size`, async (t) => {
    const doc = new Document(),
      main = new Element(doc, 'main');
    doc.body.append(main);
    // Mount the actual page's named controls. DOM layout, image decoding and
    // painting are boundary doubles; the entry handlers/player/verifier are real.
    for (const [, tag, attrs, id] of html.matchAll(
      /<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g,
    )) {
      const node = new Element(doc, tag, { id });
      for (const [, name, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g))
        node.setAttribute(name, value);
      main.append(node);
    }
    const $ = (id) => doc.getElementById(id),
      board = $('board'),
      stage = new Element(doc, 'div');
    stage.style.setProperty = (name, value) => {
      stage.style[name] = value;
    };
    board.remove();
    main.append(stage);
    stage.append(board);
    board.width = 768;
    board.height = 576;
    $('speed').value = '1';
    $('example').value = 'fieldcraft-01';
    const legacy = recording(false, turnPolicy),
      wide = recording(true, turnPolicy),
      paints = [];
    let frame;
    const globals = {
      document: doc,
      location: { href: 'https://example.test/game/replay-theater/' },
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: (callback) => {
        frame = callback;
        return 1;
      },
      fetch: async (path) => ({
        ok: true,
        headers: { get: () => null },
        json: async () =>
          path.includes('themes')
            ? read('../content/themes.json')
            : read('../../authoring/motion-lab/presets.json'),
        text: async () => JSON.stringify(legacy),
      }),
    };
    const previous = new Map();
    for (const [key, value] of Object.entries(globals)) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    t.after(() => {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    });
    t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
    t.mock.method(BoardPainter.prototype, 'draw', (_context, run) =>
      paints.push({
        width: board.width,
        height: board.height,
        runWidth: run.width,
        tick: run.tick,
        checkpoint: authoritativeCheckpoint(run),
      }),
    );
    await import(`../replay-theater/app.mjs?wide-theater=${turnPolicy}`);
    await until(
      () => $('recording-name').textContent === 'Legacy recording',
      $('import-status').textContent,
    );
    assert.equal(board.width, 768);
    assert.equal($('playback-phase').textContent, 'paused');
    const load = (source) => {
      $('replay-text').value = JSON.stringify(source);
      $('load-text').emit('click');
    };
    load(wide);
    await until(() => $('recording-name').textContent === 'Wide recording', 'wide must adopt');
    assert.equal(board.width, 1152);
    assert.equal(board.height, 576);
    assert.equal(stage.style['--board-ratio'], '2');
    assert.equal(stage.style['--board-width'], '1152px');
    frame(1000);
    assert.equal(paints.at(-1).runWidth, 72);
    assert.equal(paints.at(-1).tick, 0);
    $('step').emit('click');
    frame(1010);
    assert.equal(paints.at(-1).tick, 1);
    const checkpoint = paints.at(-1).checkpoint;
    load({ ...wide, version: 'xonix-replay.v4' });
    await until(
      () => $('import-status').textContent.startsWith('Could not load'),
      'invalid version must reject',
    );
    frame(1020);
    assert.equal(board.width, 1152);
    assert.deepEqual(paints.at(-1).checkpoint, checkpoint);
    let finishFile;
    $('replay-file').files = [
      {
        name: 'deferred.json',
        size: 100,
        text: () =>
          new Promise((resolve) => {
            finishFile = resolve;
          }),
      },
    ];
    $('replay-file').emit('change');
    await until(() => !!finishFile, 'deferred file started');
    assert.equal(board.width, 1152);
    load(legacy);
    await until(() => $('recording-name').textContent === 'Legacy recording', 'legacy must adopt');
    finishFile(JSON.stringify(wide));
    for (let i = 0; i < 5; i++) await setImmediate();
    frame(1030);
    assert.equal(board.width, 768);
    assert.equal(board.height, 576);
    assert.equal(stage.style['--board-width'], '768px');
    assert.equal(paints.at(-1).runWidth, 48);
    assert.equal(paints.at(-1).tick, 0);
    $('play-pause').emit('click');
    frame(1040);
    frame(1140);
    assert.equal($('playback-phase').textContent, 'complete');
    assert.deepEqual(paints.at(-1).checkpoint, legacy.checkpoint);
  });
