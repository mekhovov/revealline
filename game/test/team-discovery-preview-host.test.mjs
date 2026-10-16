import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { File } from 'node:buffer';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { earnTeamVictory } from './helpers/coop-win.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { canonicalJSON } from '../data-json.mjs';

// Actual Team host, picture reader and authenticated PNG originals; only DOM,
// image decode and Canvas rasterization are finite boundaries. These assertions
// do not qualify browser layout, decoded pixels, physical input or public play.
const first = COOP_PICTURE_BINDINGS[0],
  yard = COOP_PICTURE_BINDINGS[1];
const flush = () => new Promise((resolve) => setImmediate(resolve));
const dialog = (f) => f.$('journey-chooser');
const viewer = (f) => f.$('coop-discovery-preview');
const previewStatus = (f) => f.$('coop-discovery-preview-status');
const fullCanvas = (f) => f.$('coop-discovery-preview-canvas');
const playButtons = (f) => [...f.$('journey-cards').querySelectorAll('.journey-card')];
const fullTrace = (f) => f.traces.get(fullCanvas(f));
const lastDraw = (trace) => trace.operations.findLast((entry) => entry.name === 'drawImage');
const previewButton = async (f, title, last = false) => {
  const choices = playButtons(f).filter(
    (button) => button.querySelector('strong').textContent === title,
  );
  const play = last ? choices.at(-1) : choices[0];
  assert.ok(play, `Play card exists for ${title}`);
  play.focus();
  play.emit('focus', { bubbles: false });
  await flush();
  const button = f.$('coop-library-preview');
  assert.ok(button, `${title} has a separate Preview action`);
  return button;
};
function enter(f, element) {
  assert.equal(element.disabled, false);
  assert.equal(element.closest('[hidden],[inert]'), null);
  element.focus();
  f.tap('Enter');
}
async function open(f, paused = false) {
  enter(f, f.$(paused ? 'coop-discovery-paused' : 'coop-discovery-open'));
  await waitFor(() => dialog(f)?.open);
}
const ready = (f, state = 'ready') =>
  waitFor(
    () => previewStatus(f).dataset.state === state,
    () => previewStatus(f).textContent,
  );
async function browsingReady(f, count = 2) {
  assert.equal(playButtons(f).length, count + 12);
  assert.equal(
    f.$('journey-cards').querySelectorAll('canvas').length,
    0,
    'Browsing does not prepare reward-picture teasers',
  );
  await flush();
}

function canvasRecorder(canvas) {
  const operations = [],
    stack = [];
  const defaults = () => ({
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    imageSmoothingEnabled: true,
  });
  let state = defaults();
  for (const key of ['width', 'height']) {
    let value = Number(canvas.getAttribute(key)) || 0;
    Object.defineProperty(canvas, key, {
      configurable: true,
      get: () => value,
      set(next) {
        value = Number(next);
        state = defaults();
        stack.length = 0;
        operations.push({ name: 'resize', args: [key, value], state: { ...state } });
      },
    });
  }
  const context = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          operations.push({ name, args, state: { ...state } });
          if (name === 'save') stack.push({ ...state });
          if (name === 'restore') state = stack.pop() || defaults();
          if (name === 'measureText') return { width: String(args[0]).length * 8 };
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  canvas.getContext = () => context;
  return { canvas, operations };
}

async function fixture(t, extra = {}) {
  const traces = new Map(),
    writes = [];
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    stablePaintImages: true,
    ...extra,
    beforeImport({ $, doc, install }) {
      const create = doc.createElement.bind(doc);
      doc.createElement = (tag) => {
        const node = create(tag);
        if (String(tag).toLowerCase() === 'canvas') traces.set(node, canvasRecorder(node));
        return node;
      };
      const canvas = $('coop-discovery-preview-canvas');
      assert.ok(canvas, 'Authored expanded preview Canvas is present');
      traces.set(canvas, canvasRecorder(canvas));
      // Record attempted durable mutations, even if production would catch an
      // unavailable-storage exception. Preview must not mutate any game store.
      for (const store of ['localStorage', 'sessionStorage']) {
        const values = new Map();
        install(store, {
          value: {
            getItem: (key) => values.get(key) ?? null,
            setItem(key, value) {
              if (!key.startsWith('revealline.mission-library.selector.v1.'))
                writes.push([store, 'setItem', key]);
              values.set(key, String(value));
            },
            removeItem(key) {
              writes.push([store, 'removeItem', key]);
              values.delete(key);
            },
            clear() {
              writes.push([store, 'clear']);
              values.clear();
            },
          },
        });
      }
      install('indexedDB', {
        get() {
          writes.push(['indexedDB', 'access']);
          throw new Error('Preview must not access Solo media');
        },
      });
    },
  });
  return Object.assign(f, { traces, writes });
}

function pixelAt(trace, x, y) {
  let value = null;
  for (const { name, args, state } of trace.operations) {
    if (name === 'resize') {
      value = null;
      continue;
    }
    if (!['drawImage', 'fillRect', 'clearRect'].includes(name)) continue;
    const rect = name === 'drawImage' ? args.slice(args.length === 9 ? 5 : 1) : args;
    const [left, top, width, height] = rect;
    if (x < left || x >= left + width || y < top || y >= top + height) continue;
    value =
      name === 'clearRect'
        ? null
        : name === 'drawImage'
          ? args[0]
          : {
              colour: state.fillStyle,
              opaque: state.globalAlpha === 1 && state.globalCompositeOperation === 'source-over',
            };
  }
  return value;
}
function assertFullPreview(f, hash) {
  const canvas = fullCanvas(f),
    trace = fullTrace(f),
    draw = lastDraw(trace);
  assert.equal(canvas.hidden, false);
  assert.equal(canvas.width, 1152);
  assert.equal(canvas.height, 576);
  assert.equal(draw.args[0].sha256, hash);
  assert.equal(draw.state.imageSmoothingEnabled, false);
  for (const [x, y] of [
    [95, 288],
    [1056, 288],
    [576, 95],
    [576, 480],
  ])
    assert.equal(
      pixelAt(trace, x, y),
      draw.args[0],
      'Full preview retains the same authenticated source border',
    );
  for (const [x, y] of [
    [96, 96],
    [576, 288],
    [1055, 479],
  ])
    assert.equal(
      pixelAt(trace, x, y),
      draw.args[0],
      'Explicit preview shows the exact picture centre without awarding it',
    );
  assert.match(
    previewStatus(f).textContent,
    /Full picture preview.*does not complete an arena or earn a picture/i,
  );
  assert.match(f.$('coop-discovery-preview-title').textContent, /Picture preview/);
}

function retained(f) {
  return {
    hud: [
      'coop-stage',
      'coop-clock',
      'coop-coverage',
      'coop-reserves',
      'coop-objective',
      'coop-state-0',
      'coop-state-1',
    ].map((id) => f.$(id).textContent),
    progress: f.$('coop-progress').value,
    image: f.drawImages.at(-1),
    paint: f.lastPaint,
  };
}

test('Team cards browse without artwork; explicit full preview returns directly without awards', async (t) => {
  const f = await fixture(t),
    writes = [...f.writes];
  await open(f);
  await browsingReady(f);
  const origin = await previewButton(f, 'Relay Yard');
  enter(f, origin);
  assert.equal(viewer(f).hidden, false);
  assert.equal(previewStatus(f).dataset.state, 'busy');
  assert.equal(fullCanvas(f).hidden, true);
  assert.equal(f.$('journey-back').textContent, 'Back to game');
  await ready(f);
  assertFullPreview(f, yard.picture.sha256);
  enter(f, f.$('journey-back'));
  assert.equal(viewer(f).hidden, true);
  assert.equal(dialog(f).open, false);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  f.tick(20);
  assert.equal(f.drawImages.length, 0);
  assert.equal(f.earnedDrawImages.length, 0);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.deepEqual(f.writes, writes);
});

test('previewing a different arena keeps the paused attempt, original picture and explicit Resume intact', async (t) => {
  const f = await fixture(t);
  enter(f, f.$('coop-start'));
  f.tick(2);
  f.tap('KeyD');
  f.tick(24);
  f.tap('Escape');
  const before = retained(f),
    writes = [...f.writes],
    acceptedURL = before.image.src;
  await open(f, true);
  await browsingReady(f);
  enter(f, await previewButton(f, 'Relay Yard'));
  await ready(f);
  assertFullPreview(f, yard.picture.sha256);
  f.tick(20);
  assert.deepEqual(retained(f), before);
  assert.equal(f.$('coop-overlay').hidden, false);
  enter(f, f.$('journey-back'));
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.deepEqual(retained(f), before);
  assert.equal(f.artwork.calls.releases.includes(acceptedURL), false);
  assert.deepEqual(f.writes, writes);
  enter(f, f.$('coop-resume'));
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.drawImages.at(-1), before.image);
});

test('Back cancels a held full decode immediately; late completion cannot paint or steal the card focus', async (t) => {
  const gate = deferred();
  let hold = false,
    held = null,
    url;
  const f = await fixture(t, {
    presentation: {
      decode: async ({ image }) => {
        if (hold && image.sha256 === yard.picture.sha256) {
          held = image;
          url = image.src;
          await gate.promise;
        }
      },
    },
  });
  await open(f);
  await browsingReady(f);
  hold = true;
  const origin = await previewButton(f, 'Relay Yard');
  enter(f, origin);
  await waitFor(() => held);
  assert.equal(previewStatus(f).dataset.state, 'busy');
  enter(f, f.$('journey-back'));
  assert.equal(viewer(f).hidden, true);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  const operations = fullTrace(f).operations.length;
  gate.resolve();
  await waitFor(() => f.artwork.calls.releases.includes(url));
  assert.equal(f.artwork.calls.releases.filter((entry) => entry === url).length, 1);
  assert.equal(fullTrace(f).operations.length, operations);
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  assert.equal(f.drawImages.length, 0);
});

test('required preview read failure offers an exact Retry without starting play or replacing setup', async (t) => {
  let fail = false;
  const f = await fixture(t, {
    presentation: {
      read: ({ slot }) => {
        if (fail && slot === yard.picture.slot) throw new Error('Modeled preview read outage');
      },
    },
  });
  await open(f);
  await browsingReady(f);
  fail = true;
  const original = f.previewDrawImages.at(-1);
  enter(f, await previewButton(f, 'Relay Yard'));
  await ready(f, 'error');
  assert.equal(fullCanvas(f).hidden, true);
  assert.equal(pixelAt(fullTrace(f), 576, 288), null);
  const retry = f.$('coop-discovery-preview-retry');
  assert.equal(retry.hidden, false);
  assert.equal(retry.disabled, false);
  assert.equal(f.previewDrawImages.at(-1), original);
  assert.equal(f.$('coop-level').value, 'first-connection');
  fail = false;
  enter(f, retry);
  await ready(f);
  assertFullPreview(f, yard.picture.sha256);
  assert.equal(f.doc.activeElement === retry, true);
  assert.equal(f.drawImages.length, 0);
  assert.equal(f.artwork.calls.reads.at(-1).slot, yard.picture.slot);
});

test('a newer Back focus survives expanded preview readiness without automatic navigation', async (t) => {
  const gate = deferred();
  let hold = false,
    held = false;
  const f = await fixture(t, {
    presentation: {
      read: async ({ slot }) => {
        if (hold && slot === yard.picture.slot) {
          held = true;
          await gate.promise;
        }
      },
    },
  });
  await open(f);
  await browsingReady(f);
  hold = true;
  enter(f, await previewButton(f, 'Relay Yard'));
  await waitFor(() => held);
  f.$('journey-back').focus();
  gate.resolve();
  await ready(f);
  assertFullPreview(f, yard.picture.sha256);
  assert.equal(f.doc.activeElement.id, 'journey-back');
  assert.equal(dialog(f).open, true);
  assert.equal(viewer(f).hidden, false);
});

test('a cancelled old visit cannot overwrite a newer expanded preview or its focus', async (t) => {
  const gate = deferred();
  let hold = false,
    held = false;
  const f = await fixture(t, {
    presentation: {
      read: async ({ slot }) => {
        if (hold && !held && slot === yard.picture.slot) {
          held = true;
          await gate.promise;
        }
      },
    },
  });
  await open(f);
  await browsingReady(f);
  hold = true;
  enter(f, await previewButton(f, 'Relay Yard'));
  await waitFor(() => held);
  enter(f, f.$('journey-back'));
  await open(f);
  gate.resolve();
  await flush();
  enter(f, await previewButton(f, 'First Connection'));
  f.$('journey-back').focus();
  await ready(f);
  assertFullPreview(f, first.picture.sha256);
  assert.equal(f.doc.activeElement.id, 'journey-back');
  assert.equal(f.drawImages.length, 0);
  assert.equal(f.$('coop-level').value, 'first-connection');
});

async function swappedOriginalBundle() {
  const compiled = JSON.parse(
    await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  const pictures = await Promise.all(
    COOP_PICTURE_BINDINGS.map(async ({ picture }) => ({
      ...picture,
      body: await readFile(
        new URL(`../presentation/compiled/${compiled.urls[picture.sha256]}`, import.meta.url),
      ),
    })),
  );
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const pack = structuredClone(COOP_STARTER_PACK);
  const assets = pictures
    .map((picture) => {
      assert.equal(hash(picture.body), picture.sha256);
      return {
        sha256: picture.sha256,
        bytes: picture.body.length,
        mime: 'image/png',
        width: 1152,
        height: 576,
        provenance: {
          kind: 'user-supplied',
          attribution: 'Existing approved test originals',
          source: 'In-memory swapped-image identity fixture',
        },
      };
    })
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
  const manifest = {
    format: 'revealline-team-presentation-envelope.v1',
    pack,
    packSha256: hash(canonicalJSON(pack)),
    presentation: {
      id: 'local.preview-identity',
      revision: 1,
      theme: {
        id: compiled.resolved.theme.id,
        revision: compiled.resolved.theme.revision,
        collection: null,
      },
      levels: pack.levels.map((level, index) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: hash(canonicalJSON(level)),
        pictureSha256: pictures[1 - index].sha256,
      })),
      assets,
    },
  };
  const json = Buffer.from(JSON.stringify(manifest)),
    header = Buffer.alloc(12);
  header.write('RLTEAM1\n', 'ascii');
  header.writeUInt32BE(json.length, 8);
  return new File(
    [
      header,
      json,
      ...assets.map((asset) => pictures.find((picture) => picture.sha256 === asset.sha256).body),
    ],
    'swapped-originals.rlteam',
    { type: 'application/vnd.revealline.team-presentation' },
  );
}

test('local .rlteam artwork with exact starter IDs keeps its own teaser and full original without a compiled substitute', async (t) => {
  const f = await fixture(t),
    file = await swappedOriginalBundle();
  const input = f.$('coop-pack-file');
  input.closest('details').open = true;
  input.focus();
  input.files = [file];
  await input.onchange();
  assert.equal(f.$('coop-pack-status').dataset.state, 'ready', f.$('coop-pack-status').textContent);
  assert.equal(f.previewDrawImages.at(-1).sha256, yard.picture.sha256);
  await open(f);
  await browsingReady(f, 4);
  const origin = await previewButton(f, 'First Connection', true);
  const reads = f.artwork.calls.reads.length,
    writes = [...f.writes];
  enter(f, origin);
  await ready(f);
  assertFullPreview(f, yard.picture.sha256);
  assert.equal(
    f.artwork.calls.reads.length,
    reads,
    'The owned local bytes do not read compiled artwork',
  );
  enter(f, f.$('journey-back'));
  assert.equal(f.doc.activeElement.id, 'coop-discovery-open');
  assert.equal(f.drawImages.length, 0);
  assert.equal(f.earnedDrawImages.length, 0);
  assert.deepEqual(f.writes, writes);
});

test('an earned Team result survives another arena preview and its original Next still starts the accepted successor', async (t) => {
  const f = await fixture(t);
  f.$('coop-experiment').value = 'full';
  enter(f, f.$('coop-start'));
  earnTeamVictory(t, f, 'first-connection');
  const earned = retained(f),
    imageURL = earned.image.src,
    title = f.$('coop-overlay-title').textContent,
    copy = f.$('coop-overlay-copy').textContent,
    nextLabel = f.$('coop-next').textContent,
    writes = [...f.writes];
  assert.equal(f.$('coop-next').hidden, false);
  assert.equal(f.$('coop-next').disabled, false);
  assert.equal(earned.image.sha256, first.picture.sha256);
  await open(f, true);
  await browsingReady(f);
  const origin = await previewButton(f, 'Relay Yard');
  enter(f, origin);
  await ready(f);
  assertFullPreview(f, yard.picture.sha256);
  f.tick(20);
  assert.deepEqual(retained(f), earned);
  enter(f, f.$('journey-back'));
  assert.equal(f.doc.activeElement.id, 'coop-discovery-paused');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.equal(f.$('coop-overlay-title').textContent, title);
  assert.equal(f.$('coop-overlay-copy').textContent, copy);
  assert.equal(f.$('coop-next').textContent, nextLabel);
  assert.equal(f.$('coop-next').hidden, false);
  assert.equal(f.$('coop-next').disabled, false);
  assert.equal(f.$('coop-resume').hidden, true);
  assert.deepEqual(retained(f), earned);
  assert.equal(f.artwork.calls.releases.includes(imageURL), false);
  assert.deepEqual(f.writes, writes);
  enter(f, f.$('coop-view-picture'));
  assert.equal(f.$('coop-earned-picture').open, true);
  const earnedDraw = f.earnedDrawImages.at(-1);
  assert.equal(
    earnedDraw[0] === earned.image,
    true,
    'Earned view keeps the accepted full original',
  );
  assert.deepEqual(earnedDraw.slice(1), [0, 0, 1152, 576]);
  enter(f, f.$('coop-picture-return'));
  assert.equal(f.doc.activeElement.id, 'coop-view-picture');
  assert.deepEqual(retained(f), earned);
  assert.deepEqual(f.writes, writes);
  enter(f, f.$('coop-next'));
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  f.drawImages.length = 0;
  f.tick(1);
  const nextPicture = f.drawImages[0];
  assert.ok(f.artwork.calls.decodes.includes(nextPicture));
  assert.equal(nextPicture.sha256, yard.picture.sha256);
  assert.equal(f.drawImages.filter((image) => image === nextPicture).length, 1);
  assert.ok(f.drawImages.length > 1, 'Prepared actors follow the accepted successor picture');
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
});
