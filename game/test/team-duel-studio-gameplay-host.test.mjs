import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodePresentationDocument } from '../presentation/document-codec.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { Element } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

// Actual Team/Duel markup, input handlers, RAF, engines, presentation loader and
// audio dispatch. DOM/Canvas, audio-clock delivery and decoding are finite Node
// adapters. This is a compiled candidate-release transport: saving/importing a
// Studio workspace does not install an arbitrary theme into the public game.
// No engine command, event, player position, run state or audio cache is seeded.
const digest = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'font/woff2': 'woff2' };
const slots = { capture: 'confirm', failure: 'pickup', victory: 'focus' };
const originalPins = {
  capture: '52f084b9648ccd970891996c7ccdabb796dcd33c0a6d4a420bb70e51daef9bf1',
  failure: '653402de8b13a5e6031b36bd79e26e60376718acc55383ee81303019ad211629',
  victory: '0eb2a24d7e17e79c6d2b4dc4c1be57ba0622d2e3e8e177999c12eb18c54d3256',
};
const teamSource = createTeamJourneyCandidates({ artwork: true });
async function imageBoundary(source) {
  const bytes =
    typeof source === 'string'
      ? Buffer.from(source.split(',')[1], 'base64')
      : Buffer.from(await source.arrayBuffer());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    naturalWidth: bytes.readUInt32BE(16),
    naturalHeight: bytes.readUInt32BE(20),
    close() {},
  };
}
let candidate;
async function restoredCandidate() {
  if (!candidate)
    candidate = (async () => {
      const base = decodePresentationDocument(
        await readFile(new URL('../presentation/compiled/studio.json', import.meta.url), 'utf8'),
      );
      assert.equal(
        resolvePresentation(base).theme.revision,
        104,
        'Keep the reviewed fixture baseline explicit.',
      );
      const bytes = new Map();
      for (const asset of base.assets) {
        if (!asset.file || bytes.has(asset.file.sha256)) continue;
        assert.ok(extension[asset.file.mime], 'The fixture admits only known shipped originals.');
        const original = await readFile(
          new URL(
            `../presentation/compiled/assets/${asset.file.sha256}.${extension[asset.file.mime]}`,
            import.meta.url,
          ),
        );
        assert.equal(digest(original), asset.file.sha256);
        bytes.set(asset.file.sha256, new Blob([original], { type: asset.file.mime }));
      }
      const assets = [],
        bindings = {},
        originals = new Map(),
        hashes = {};
      for (const [slot, file] of Object.entries(slots)) {
        const original = await readFile(new URL(`../audio/effects/${file}.wav`, import.meta.url)),
          hash = digest(original);
        assert.equal(hash, originalPins[slot], 'Use the exact existing licensed fixture original.');
        hashes[slot] = hash;
        originals.set(hash, original);
        const asset = {
          ...structuredClone(resolvePresentation(base).assets[`audio.${slot}`]),
          id: `studio-gameplay.${slot}`,
          revision: 1,
          kind: 'audio',
          recipe: null,
          description: `Existing project ${file} original for gameplay transfer verification.`,
          provenance: {
            creator: 'RevealLine',
            source: `game/audio/effects/${file}.wav`,
            license: 'Project-authored audio',
            prompt: '',
            parent: null,
          },
          file: {
            sha256: hash,
            bytes: original.length,
            mime: 'audio/wav',
            width: null,
            height: null,
          },
          quality: { stage: 'produced', evidence: [] },
        };
        assets.push(asset);
        bindings[`audio.${slot}`] = { id: asset.id, revision: 1 };
        bytes.set(hash, new Blob([original], { type: 'audio/wav' }));
      }
      const document = reviseStudioTheme(base, { assets, bindings }),
        source = createStudioStore({ indexedDB: managedIndexedDB().indexedDB }),
        target = createStudioStore({ indexedDB: managedIndexedDB().indexedDB });
      try {
        await source.save(document, bytes);
        const stored = await source.load(),
          exported = await exportThemeBundle(stored.document, stored.assets),
          imported = await importThemeBundle(exported, { decodeImage: imageBoundary });
        await target.save(imported.document, imported.assets);
        const recovered = await target.load();
        assert.deepEqual(recovered.document, document);
        for (const [hash, blob] of bytes)
          assert.deepEqual(
            await recovered.assets.get(hash).arrayBuffer(),
            await blob.arrayBuffer(),
          );
        const compiled = await compilePresentation(recovered.document, recovered.assets);
        const runtime = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json')));
        assert.equal(
          runtime.resolved.theme.revision,
          105,
          'A Studio revision never impersonates104.',
        );
        for (const [slot, reference] of Object.entries(bindings))
          assert.deepEqual(runtime.resolved.bindings[slot], reference);
        return { ...compiled, hashes, originals, bindings };
      } finally {
        source.close();
        target.close();
      }
    })();
  return candidate;
}

function storage() {
  const values = new Map([[AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: false, volume: 0.65 })]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

async function boundary(t, { hold = null } = {}) {
  const compiled = await restoredCandidate(),
    h = audioHarness(),
    started = [],
    deliveries = [],
    decoded = new Map(),
    outputs = new Set(),
    pending = [];
  await h.soundscape.dispose(); // Only the actual host below owns a Soundscape.
  h.context.state = 'suspended';
  const createNode = h.context.createOscillator.bind(h.context);
  const makeSource = () => {
    const source = createNode();
    source.playbackRate = {
      value: 1,
      setValueAtTime(value) {
        this.value = value;
      },
    };
    source.start = (when = h.context.currentTime, offset = 0, duration) => {
      source.started = true;
      source.end = source.loop
        ? Infinity
        : when + (duration ?? source.buffer?.duration ?? Infinity) / source.playbackRate.value;
      started.push(source);
    };
    source.stop = (when = h.context.currentTime) => {
      source.end = Math.min(source.end ?? Infinity, when);
    };
    return source;
  };
  h.context.createOscillator = makeSource;
  h.context.createBufferSource = makeSource;
  h.context.decodeAudioData = async (input) => {
    const hash = digest(input),
      original = compiled.originals.get(hash);
    if (original)
      assert.deepEqual(Buffer.from(input), original, 'Exact restored original at decoder.');
    const buffer = { duration: 0.2, length: 1600, numberOfChannels: 1, sha256: hash };
    if (original && hold === hash) await new Promise((resolve) => pending.push(resolve));
    decoded.set(hash, buffer);
    return buffer;
  };
  const events = Soundscape.prototype.events;
  const configure = Soundscape.prototype.configure;
  t.mock.method(Soundscape.prototype, 'configure', function (...args) {
    outputs.add(this);
    return configure.apply(this, args);
  });
  t.mock.method(Soundscape.prototype, 'events', function (values, run, theme, options = {}) {
    outputs.add(this);
    const before = started.length;
    const result = events.call(this, values, run, theme, options);
    deliveries.push({
      events: structuredClone(values),
      board: options.board ?? 'solo',
      mode: options.mode,
      status: run.status,
      tick: run.tick,
      players: structuredClone(run.players ?? [run.player].filter(Boolean)),
      sources: started.slice(before),
      voices: [...this.voices].filter((voice) => started.slice(before).includes(voice.source)),
    });
    return result;
  });
  const baseURL = 'https://studio-gameplay.test/compiled/';
  const createHost = ({ document } = {}) =>
    createPresentationHost({
      baseURL,
      document,
      fetch: async (input, { signal } = {}) => {
        signal?.throwIfAborted();
        const name = new URL(input).href.slice(baseURL.length);
        assert.ok(compiled.files.has(name), `Only actual compiled candidate members: ${name}`);
        return new Response(compiled.files.get(name));
      },
      decodeImage: imageBoundary,
      cropImage: async (_, frame) => ({ width: frame.w, height: frame.h, close() {} }),
      fontFactory: () => ({
        async load() {
          return this;
        },
      }),
    });
  const native = new Map();
  for (const name of ['reveal-small', 'reveal-medium', 'reveal-large', 'impact', 'loss', 'win']) {
    const bytes = await readFile(new URL(`../audio/effects/${name}.wav`, import.meta.url));
    native.set(name, bytes);
  }
  const fetchAudio = async (input) => {
    const path = String(input),
      name = path.match(/\/audio\/effects\/([^/]+)\.wav$/)?.[1];
    return new Response(name && native.has(name) ? native.get(name) : null, {
      status: name && native.has(name) ? 200 : 503,
    });
  };
  const audio = {
    Context: class {
      constructor() {
        return h.context;
      }
    },
    createElement(doc) {
      const mediaBoundary = audioHarness();
      void mediaBoundary.soundscape.dispose();
      const media = mediaBoundary.media,
        element = new Element(doc, 'audio');
      for (const [key, value] of Object.entries(element))
        if (!Object.hasOwn(media, key)) media[key] = value;
      Object.setPrototypeOf(media, Object.getPrototypeOf(element));
      return media;
    },
  };
  t.after(async () => {
    pending.splice(0).forEach((resolve) => resolve());
    for (const output of outputs) await output.dispose();
  });
  return {
    ...compiled,
    ...h,
    audio,
    createHost,
    fetchAudio,
    started,
    deliveries,
    decoded,
    pending,
    outputs,
    advance(seconds = 1 / 120) {
      h.context.currentTime += seconds;
      for (const source of h.sources)
        if (source.started && !source.ended && source.end <= h.context.currentTime) {
          source.ended = true;
          source.onended?.();
        }
    },
    custom(slot) {
      return started.filter((source) => source.buffer?.sha256 === compiled.hashes[slot]);
    },
  };
}

async function team(t, { legacy = false, ...options } = {}) {
  const h = await boundary(t, options);
  let pageWindow;
  // Keep this fixture's globals alive until pagehide's cancellation jobs unwind.
  // A native document remains available during those jobs; coop-host otherwise
  // restores its synthetic globals synchronously, including after setup failure.
  t.after(async () => {
    pageWindow?.emit('pagehide', { persisted: false });
    await new Promise((resolve) => setImmediate(resolve));
  });
  const f = await teamPage(t, {
    href: `http://localhost/game/couch/relay-rescue.html?journey=${legacy ? 'legacy' : 'team-originals'}`,
    retainInitialDifficulty: true,
    waitPicture: !legacy,
    presentation: { createHost: ({ document }) => h.createHost({ document }) },
    beforeImport({ doc, win, install }) {
      pageWindow = win;
      install('AudioContext', { value: h.audio.Context });
      install('localStorage', { value: storage() });
      install('indexedDB', { value: managedIndexedDB().indexedDB });
      const upstream = globalThis.fetch;
      install('fetch', {
        value: async (input, options = {}) => {
          options.signal?.throwIfAborted();
          if (String(input).includes('/audio/')) return h.fetchAudio(input);
          const asset = teamSource.assets.find((row) => String(input).endsWith('/' + row.path));
          if (asset) {
            const bytes = await readFile(new URL('../' + asset.path, import.meta.url), {
              signal: options.signal,
            });
            options.signal?.throwIfAborted();
            return new Response(bytes);
          }
          return upstream(input, options);
        },
      });
      const BaseImage = globalThis.Image;
      install('Image', {
        value: class extends BaseImage {
          async decode() {
            if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
            Object.assign(this, await imageBoundary(this.source));
          }
        },
      });
      const create = doc.createElement.bind(doc);
      doc.createElement = (tag) => (tag === 'audio' ? h.audio.createElement(doc) : create(tag));
    },
  });
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      h.advance();
      f.tick();
    }
  };
  return { ...h, f: { ...f, tick }, tick };
}

function selfCross(h) {
  for (const [first, second, ticks] of [
    ['KeyD', 'ArrowLeft', 60],
    ['KeyW', 'ArrowUp', 30],
    ['KeyD', 'ArrowLeft', 30],
    ['KeyS', 'ArrowDown', 30],
    ['KeyA', 'ArrowRight', 30],
  ]) {
    h.f.tap(first);
    h.f.tap(second);
    h.tick(ticks);
  }
}

async function duel(t, { coverage = 0.95, enemies = true, ...options } = {}) {
  const h = await boundary(t, options),
    campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
  campaign.id = 'studio-gameplay';
  campaign.levels = [campaign.levels[0]];
  campaign.briefs = [];
  campaign.levels[0].id = 'studio-gameplay-arena';
  campaign.levels[0].goal.coverage = coverage;
  campaign.levels[0].enemies = enemies
    ? [{ ...campaign.levels[0].enemies[0], x: 40.5, y: 28.5, vx: 0, vy: 0 }]
    : [];
  let lease;
  const f = await couchPage(t, {
    campaign,
    seconds: '180',
    audio: h.audio,
    storage: storage(),
    assetDatabase: managedIndexedDB().indexedDB,
    fetchResponse(input) {
      if (String(input).includes('/audio/')) return h.fetchAudio(input);
    },
    beforeImport({ document, window }) {
      lease = mountPresentationPage({
        document,
        window,
        createHost: () => h.createHost({ document }),
      });
    },
  });
  await lease.ready;
  t.after(() => lease.close());
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      h.advance(1 / 60);
      f.frame(1000 / 60);
    }
  };
  const move = (first, second, count) => {
    f.key(first);
    f.key(second);
    tick(count);
    f.key(first, false);
    f.key(second, false);
  };
  return { ...h, f, tick, move };
}

async function startDuel(h) {
  await h.f.$('race-start').onclick();
  h.tick(3);
  await waitFor(() => h.context.state === 'running');
  await waitFor(() =>
    [...h.outputs].some((sound) => sound.feedbackDirector.buffers.has('reveal-small')),
  );
}

test('actual Duel keyboard captures use restored originals on both boards after a cold first cut', async (t) => {
  const h = await duel(t);
  await startDuel(h);
  h.move('KeyS', 'ArrowDown', 60);
  h.move('KeyD', 'ArrowRight', 60);
  h.move('KeyW', 'ArrowUp', 65);
  const captures = () =>
    h.deliveries.filter((row) => row.events.some((event) => event.type === 'cells.claimed'));
  assert.equal(captures().length, 2);
  await waitFor(() => h.decoded.has(h.hashes.capture));
  assert.equal(h.custom('capture').length, 0, 'Readiness cannot replay the cold first cut.');
  h.move('KeyS', 'ArrowDown', 90);
  h.move('KeyA', 'ArrowLeft', 120);
  h.move('KeyW', 'ArrowUp', 95);
  assert.equal(captures().length, 4);
  assert.equal(h.custom('capture').length, 2);
  const ready = captures().slice(-2);
  assert.deepEqual(
    ready.map((row) => row.board),
    [0, 1],
  );
  assert.deepEqual(
    ready.flatMap((row) =>
      row.voices.filter((voice) => voice.name === 'capture').map((voice) => voice.board),
    ),
    [0, 1],
  );
  for (const row of ready)
    assert.equal(
      row.sources.find((source) => source.buffer?.sha256 === h.hashes.capture)?.buffer,
      h.decoded.get(h.hashes.capture),
    );
  assert.ok(h.f.renders.every((run) => run.status === 'running'));
  h.f.$('race-pause').click();
  const paused = h.f.checkpoint(),
    count = h.custom('capture').length;
  h.move('KeyS', 'ArrowDown', 20);
  assert.deepEqual(h.f.checkpoint(), paused, 'Paused keyboard input cannot generate another cut.');
  assert.equal(h.custom('capture').length, count);
});

test('closing the actual Duel host retires a pending restored decode without replay or cache adoption', async (t) => {
  const h = await duel(t, { hold: originalPins.capture });
  await startDuel(h);
  h.move('KeyS', 'ArrowDown', 60);
  h.move('KeyD', 'ArrowRight', 60);
  h.move('KeyW', 'ArrowUp', 65);
  await waitFor(() => h.pending.length > 0);
  const owner = [...h.outputs].find((sound) => sound.publishedAudio),
    cache = owner.publishedAudio,
    count = h.started.length;
  assert.equal(cache.has('capture'), false);
  h.f.win.emit('pagehide', { persisted: false });
  assert.equal(owner.disposed, true);
  h.pending.splice(0).forEach((resolve) => resolve());
  await waitFor(() => h.decoded.has(h.hashes.capture));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.started.length, count, 'The complete late delivery window starts no new source.');
  assert.equal(cache.has('capture'), false, 'A disposed host cannot adopt the late buffer.');
  assert.equal(h.context.state, 'closed');
});

test('actual Duel self-crossings preserve two failure owners and one terminal result owner', async (t) => {
  const h = await duel(t);
  await startDuel(h);
  const cross = () => {
    h.move('KeyS', 'ArrowDown', 60);
    h.move('KeyD', 'ArrowRight', 30);
    h.move('KeyW', 'ArrowUp', 30);
    h.move('KeyA', 'ArrowLeft', 35);
  };
  cross();
  assert.equal(
    h.deliveries.filter((row) => row.events.some((event) => event.type === 'player.failed')).length,
    2,
  );
  await waitFor(() => h.decoded.has(h.hashes.failure));
  assert.equal(h.custom('failure').length, 0);
  h.tick(60);
  cross();
  assert.equal(h.custom('failure').length, 2);
  const failures = h.deliveries
    .filter((row) => row.events.some((event) => event.type === 'player.failed'))
    .slice(-2);
  assert.deepEqual(
    failures.map((row) => row.board),
    [0, 1],
  );
  for (const row of failures) {
    const voice = row.voices.find((value) => value.name === 'failure');
    assert.equal(voice.board, row.board);
    assert.equal(voice.source.buffer, h.decoded.get(h.hashes.failure));
  }
  h.tick(60);
  cross();
  const result = h.deliveries.filter((row) => row.board === 'duel-result');
  assert.equal(result.length, 1);
  assert.equal(result[0].events[0].status, 'lost');
  assert.deepEqual(
    result[0].voices.filter((voice) => voice.name === 'failure').map((voice) => voice.board),
    ['duel-result'],
  );
  assert.equal(result[0].sources[0].buffer, h.decoded.get(h.hashes.failure));
  h.tick(30);
  assert.equal(h.deliveries.filter((row) => row.board === 'duel-result').length, 1);
});

test('Team Originals twin-landings admits restored fpv105 and plays custom captures and one victory through its legal route', async (t) => {
  const h = await team(t),
    { f } = h;
  assert.equal(f.$('coop-level').value, 'twin-landings');
  f.$('coop-start').click();
  await waitFor(() => h.context.state === 'running');
  playCurrentTeamRoute(f, teamSource, 'twin-landings');
  await waitFor(() => h.decoded.has(h.hashes.capture) && h.decoded.has(h.hashes.victory));
  assert.equal(h.custom('capture').length, 0);
  assert.equal(h.custom('victory').length, 0, 'Decode alone cannot replay an earned result.');
  f.$('coop-retry').click();
  playCurrentTeamRoute(f, teamSource, 'twin-landings');
  const readyCaptures = h.deliveries
    .filter(
      (row) =>
        row.events.some((event) => event.type === 'cells.claimed') && row.status === 'running',
    )
    .filter((row) => row.sources.some((source) => source.buffer?.sha256 === h.hashes.capture));
  assert.ok(
    readyCaptures.length >= 2,
    'Several natural nonterminal captures use the restored cue.',
  );
  assert.ok(
    readyCaptures.every(
      (row) =>
        row.sources.find((source) => source.buffer?.sha256 === h.hashes.capture)?.buffer ===
        h.decoded.get(h.hashes.capture),
    ),
  );
  assert.equal(h.custom('victory').length, 1);
  const terminal = h.deliveries.findLast((row) =>
    row.events.some((event) => event.type === 'run.completed'),
  );
  assert.deepEqual(
    terminal.voices.filter((voice) => voice.name === 'victory').map((voice) => voice.board),
    ['solo'],
  );
  assert.equal(
    terminal.sources.find((source) => source.buffer?.sha256 === h.hashes.victory)?.buffer,
    h.decoded.get(h.hashes.victory),
  );
  h.tick(30);
  assert.equal(h.custom('victory').length, 1);
});

test('legacy Team keeps its reviewed picture admission guard for a genuine restored fpv105 candidate', async (t) => {
  t.mock.method(console, 'error', () => {});
  const h = await team(t, { legacy: true });
  await waitFor(() => h.f.$('coop-picture-status').dataset.state === 'error');
  assert.equal(h.f.$('coop-start').disabled, true);
  assert.match(h.f.$('coop-picture-status').textContent, /picture unavailable/);
  assert.equal(h.deliveries.length, 0);
});

test('actual Team keyboard downing remains warning; retry defeat uses the exact restored failure once', async (t) => {
  const h = await team(t),
    { f } = h;
  await f.choose('coop-difficulty', 'expert');
  f.$('coop-start').click();
  await waitFor(() => h.context.state === 'running');
  h.tick(3);
  selfCross(h);
  assert.ok(
    h.deliveries.some((row) => row.events.some((event) => event.type === 'player.downed')),
    JSON.stringify({
      last: h.deliveries.at(-1),
      message: f.$('coop-message').textContent,
      overlay: f.$('coop-overlay').hidden,
    }),
  );
  assert.equal(h.custom('failure').length, 0, 'Recoverable downing is not terminal failure.');
  selfCross(h);
  assert.equal(f.$('coop-resume').hidden, true);
  await waitFor(() => h.decoded.has(h.hashes.failure));
  assert.equal(h.custom('failure').length, 0, 'First cold result is not replayed on decode.');
  f.$('coop-retry').click();
  h.tick(3);
  selfCross(h);
  selfCross(h);
  const terminal = h.deliveries.filter((row) =>
    row.events.some((event) => event.type === 'run.completed'),
  );
  assert.equal(terminal.length, 2);
  assert.equal(h.custom('failure').length, 1);
  assert.equal(
    terminal.at(-1).sources.find((source) => source.buffer?.sha256 === h.hashes.failure)?.buffer,
    h.decoded.get(h.hashes.failure),
  );
  assert.deepEqual(
    terminal
      .at(-1)
      .voices.filter((voice) => voice.name === 'failure')
      .map((voice) => voice.board),
    ['solo'],
  );
  assert.match(f.$('coop-overlay-copy').textContent, /unfinished line crossed itself/);
  h.tick(20);
  assert.equal(h.custom('failure').length, 1, 'Stopped host frames cannot duplicate the result.');
});
