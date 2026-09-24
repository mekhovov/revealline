import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, authoritativeCheckpoint } from '../replay.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { prepareCampaignVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
import { ACTOR_APPEARANCE_RELEASES } from '../presentation/actor-appearance-lease.mjs';
import {
  exportReplayPresentation,
  MAX_REPLAY_PRESENTATION_BYTES,
} from '../replay-presentation.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { installActorAppearanceTransport } from './helpers/actor-appearance-transport.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';

const html = await readFile(new URL('../replay-theater/index.html', import.meta.url), 'utf8');
const readJSON = async (url) => JSON.parse(await readFile(url, 'utf8'));
let serial = 0;

async function recording() {
  const baseCampaign = await readJSON(new URL('../content/campaign.json', import.meta.url));
  baseCampaign.classRecipes = await readJSON(new URL('../content/classes.json', import.meta.url));
  const context = createDifficultyContext(baseCampaign),
    level = context.campaign.levels[0],
    options = {
      seed: 1,
      turnPolicy: 'immediate',
      classId: 'scout',
      classRecipes: context.campaign.classRecipes,
    },
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'recorded-actors-theater-test');
  for (let i = 0; i < 24; i++) {
    const input = i === 0 ? { switchClass: 'carrier' } : {};
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  const content = await prepareCampaignVisualThemeContext({
    entry: {
      ...context,
      baseCampaign,
      difficulty: context.mode,
      executionKey: context.campaignKey,
    },
    level,
    association: { editionId: 'field-kit', contentThemeId: 'fpv', mode: 'solo' },
  });
  return exportReplayPresentation({
    execution: { campaignKey: context.campaignKey, sourcePackId: null },
    actorAppearancePin: {
      format: 'revealline-actor-appearance-pin.v1',
      rendererPolicy: 'actor-style.v1',
      style: 'fpv',
      content,
      presentation: ACTOR_APPEARANCE_RELEASES[0].presentation,
    },
    replay: exportReplay(recorder, run),
  });
}
async function until(predicate, label) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail(typeof label === 'function' ? label() : label);
}

async function page(t, { beforeActorRequest = async () => {}, source: suppliedSource } = {}) {
  const doc = new Document(),
    win = new Events(),
    main = new Element(doc, 'main'),
    source = suppliedSource ?? (await recording());
  doc.parentNode = win;
  doc.defaultView = win;
  doc.body.append(main);
  for (const [, tag, attrs, id] of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node = new Element(doc, tag, { id });
    for (const [, name, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g))
      node.setAttribute(name, value);
    main.append(node);
  }
  const $ = (id) => doc.getElementById(id),
    stage = new Element(doc, 'div'),
    board = $('board'),
    frames = new Map(),
    paints = [],
    previous = new Map(),
    reads = [];
  board.remove();
  main.append(stage);
  stage.append(board);
  stage.style.setProperty = (name, value) => (stage.style[name] = value);
  $('example').value = 'fieldcraft-01';
  $('speed').value = '1';
  let frameId = 0,
    holdLook = null;
  const install = (key, descriptor) => {
    if (!previous.has(key)) previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  };
  const base = new URL('https://example.test/game/replay-theater/');
  const upstream = async (input) => {
    const url = new URL(input, base);
    if (url.pathname.endsWith('.replay.json')) return new Response(JSON.stringify(source.replay));
    try {
      return new Response(
        await readFile(
          url.protocol === 'file:'
            ? url
            : new URL(`../../${url.pathname.slice(1)}`, import.meta.url),
        ),
      );
    } catch {
      return new Response('', { status: 404 });
    }
  };
  const storage = {
    getItem(key) {
      reads.push(key);
      // Deliberately different from the recorded FPV choice. Theater must never
      // consult this preference or any profile/suspended-flight record.
      return key.includes('actor') ? JSON.stringify({ actorStyle: 'campaign' }) : null;
    },
    setItem() {
      assert.fail('Playback must not write player storage.');
    },
  };
  win.localStorage = storage;
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    localStorage: storage,
    location: { href: base.href },
    navigator: { getGamepads: () => [] },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  }))
    install(key, { value, writable: true });
  const transport = installActorAppearanceTransport({
    install,
    baseURL: new URL('../presentation/compiled/', base).href,
    upstream,
    beforeRequest: beforeActorRequest,
  });
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {
    if (holdLook) await holdLook();
  });
  t.mock.method(BoardPainter.prototype, 'draw', (_context, run, _dt, options) =>
    paints.push({
      checkpoint: authoritativeCheckpoint(run),
      tick: run.tick,
      classId: run.activeClassId,
      actorAppearance: options.actorAppearance,
    }),
  );
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    await delay(10);
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  await import(`../replay-theater/app.mjs?recorded-actors=${++serial}`);
  await until(
    () => $('playback-phase').textContent === 'paused',
    () => `${$('boot-status').textContent} ${$('import-status').textContent}`,
  );
  return {
    $,
    win,
    source,
    reads,
    transport,
    load(value) {
      $('replay-text').value = typeof value === 'string' ? value : JSON.stringify(value);
      $('load-text').emit('click');
    },
    async loaded() {
      await until(
        () => $('playback-phase').textContent === 'paused',
        () => $('import-status').textContent,
      );
      assert.match($('import-status').textContent, /verified and loaded/);
    },
    async failed() {
      await until(
        () => $('import-status').textContent.startsWith('Could not load'),
        () => $('import-status').textContent,
      );
    },
    holdLook(value) {
      holdLook = value;
    },
    frame(now = 1000) {
      const next = frames.entries().next().value;
      assert(next, 'Theater owns an animation frame.');
      frames.delete(next[0]);
      next[1](now);
      return paints.at(-1);
    },
  };
}

test('recorded FPV actors survive preview changes, class switches, playback and restart; raw behavior remains separate', async (t) => {
  const p = await page(t);
  assert.equal(p.frame().actorAppearance, null);
  assert.match(p.$('recorded-appearance').textContent, /Raw replay/);
  p.load(p.source);
  await p.loaded();
  const appearance = p.frame().actorAppearance;
  assert.equal(appearance.style, 'fpv');
  assert.equal(appearance.snapshot.manifestSha256, p.source.actorAppearancePin.presentation.sha256);
  assert.match(p.$('recorded-appearance').textContent, /Recorded FPV actors/);
  const actors = [...p.transport.decoded];
  assert(actors.length > 0);
  const requestCount = p.transport.requests.length;
  p.$('step').emit('click');
  const switched = p.frame();
  assert.equal(switched.classId, 'carrier');
  assert.equal(switched.actorAppearance.snapshot, appearance.snapshot);
  p.$('theme').value = 'ukraine';
  p.$('theme').emit('change');
  assert.deepEqual(p.frame().checkpoint, switched.checkpoint);
  assert.match(p.$('transport-status').textContent, /Recorded FPV actors.*unchanged/);
  p.$('speed').value = '2';
  p.$('speed').emit('change');
  p.$('play-pause').emit('click');
  for (let time = 1020; time < 1540; time += 100) p.frame(time);
  assert.equal(p.$('playback-phase').textContent, 'complete');
  assert.equal(p.frame().actorAppearance.snapshot, appearance.snapshot);
  p.$('restart').emit('click');
  assert.equal(p.frame().tick, 0);
  p.win.emit('pagehide', { persisted: true });
  assert(actors.every((image) => image.closes === 0));
  p.win.emit('pageshow', { persisted: true });
  assert.equal(p.frame().actorAppearance.snapshot, appearance.snapshot);
  assert.equal(p.transport.requests.length, requestCount);
  assert(actors.every((image) => image.closes === 0));
  assert(!p.reads.some((key) => /actor|profile|suspended/.test(key)));
  p.load(p.source.replay);
  await p.loaded();
  assert.equal(p.frame().actorAppearance, null);
  assert(actors.every((image) => image.closes === 1));
});

test('wrong owner, exact source, asset bytes and oversized inputs preserve accepted recording and live actors', async (t) => {
  let badAsset = false;
  const p = await page(t, {
    beforeActorRequest: async ({ relative }) =>
      badAsset && relative.startsWith('assets/') ? new Response('bad bytes') : undefined,
  });
  p.load(p.source);
  await p.loaded();
  p.$('step').emit('click');
  const before = p.frame(),
    live = [...p.transport.decoded];
  for (const mutate of [
    (value) => {
      value.execution.campaignKey = 'unavailable-owner';
    },
    (value) => {
      value.actorAppearancePin.presentation.sha256 = '0'.repeat(64);
    },
    (value) => {
      value.actorAppearancePin.content.level.sha256 = '0'.repeat(64);
    },
  ]) {
    const bad = structuredClone(p.source);
    mutate(bad);
    p.load(bad);
    await p.failed();
    const after = p.frame();
    assert.deepEqual(after.checkpoint, before.checkpoint);
    assert.equal(after.actorAppearance.snapshot, before.actorAppearance.snapshot);
    assert(live.every((image) => image.closes === 0));
  }
  badAsset = true;
  p.load(p.source);
  await p.failed();
  assert.deepEqual(p.frame().checkpoint, before.checkpoint);
  assert(live.every((image) => image.closes === 0));
  let read = false;
  p.$('replay-file').files = [
    {
      name: 'too-large.json',
      size: MAX_REPLAY_PRESENTATION_BYTES + 1,
      text() {
        read = true;
      },
    },
  ];
  p.$('replay-file').emit('change');
  await p.failed();
  assert.equal(read, false);
  p.load(' '.repeat(MAX_REPLAY_PRESENTATION_BYTES + 1));
  await p.failed();
  assert.deepEqual(p.frame().checkpoint, before.checkpoint);
  p.win.emit('pagehide', { persisted: false });
  assert(live.every((image) => image.closes === 1));
});

test('cancel, supersede and close release staged actors once without replacing the accepted snapshot', async (t) => {
  const p = await page(t);
  p.load(p.source);
  await p.loaded();
  const before = p.frame(),
    live = [...p.transport.decoded];
  for (const action of ['cancel', 'supersede', 'close']) {
    let finishLook,
      entered = false;
    const gate = new Promise((resolve) => {
      finishLook = resolve;
    });
    p.holdLook(async () => {
      entered = true;
      await gate;
    });
    const count = p.transport.decoded.length;
    p.load(p.source);
    await until(
      () => entered,
      () => p.$('import-status').textContent,
    );
    const staged = p.transport.decoded.slice(count);
    assert(staged.length > 0);
    assert(staged.every((image) => image.closes === 0));
    p.holdLook(null);
    if (action === 'cancel') p.$('cancel-load').emit('click');
    else if (action === 'supersede') p.load({ format: 'unsupported' });
    else p.win.emit('pagehide', { persisted: false });
    assert(staged.every((image) => image.closes === 1));
    finishLook();
    await delay(10);
    if (action !== 'close') {
      if (action === 'supersede') await p.failed();
      const after = p.frame();
      assert.deepEqual(after.checkpoint, before.checkpoint);
      assert.equal(after.actorAppearance.snapshot, before.actorAppearance.snapshot);
      assert(live.every((image) => image.closes === 0));
    }
    assert(staged.every((image) => image.closes === 1));
  }
  assert(live.every((image) => image.closes === 1));
});

test('actual Solo Journey export loads in Theater with exact actors and completes/restarts the recorded input stream', async (t) => {
  let exported;
  await t.test('capture the real Solo download, not a fabricated Journey envelope', async (t) => {
    const sourceBytes = async (relative) => {
      try {
        return await readFile(new URL(`../../${relative}`, import.meta.url));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return execFileSync('git', ['show', `HEAD:${relative}`], {
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          maxBuffer: 12 * 1024 * 1024,
        });
      }
    };
    const solo = await soloPage(t, {
      titleScreen: true,
      search: '?journey=whole-spatial-v5',
      journeyIndexedDB: managedIndexedDB().indexedDB,
      pictures: { Image: PNGImage },
      fetchResponse: async (input) => {
        const presentation = String(input).match(/(?:^|\/)presentation\/(.+)$/),
          artwork = String(input).match(/(?:^|\/)content-design\/assets\/(.+)$/);
        if (presentation)
          return new Response(await sourceBytes(`game/presentation/${presentation[1]}`));
        if (artwork)
          return new Response(await sourceBytes(`game/content-design/assets/${artwork[1]}`));
        return undefined;
      },
    });
    solo.$('shell-featured').click();
    await settle(() => solo.doc.body.dataset.flightState === 'running');
    solo.key('ArrowDown');
    for (let i = 0; i < 12; i++) solo.frame();
    solo.key('ArrowDown', false);
    const downloads = [],
      timers = [],
      URLImpl = globalThis.URL,
      createURL = URLImpl.createObjectURL.bind(URLImpl),
      timeout = globalThis.setTimeout;
    t.mock.method(URLImpl, 'createObjectURL', (blob) => {
      const url = createURL(blob);
      if (blob.type === 'application/json') downloads.push({ blob, url });
      return url;
    });
    t.mock.method(globalThis, 'setTimeout', (callback, milliseconds, ...args) => {
      const timer = timeout(callback, milliseconds, ...args);
      if (milliseconds === 60000) {
        timer.unref();
        timers.push(timer);
      }
      return timer;
    });
    t.after(() => {
      timers.forEach(clearTimeout);
      downloads.forEach(({ url }) => URLImpl.revokeObjectURL(url));
    });
    await solo.$('export-replay').onclick();
    assert(downloads.length > 0, solo.$('replay-operation-status').textContent);
    exported = JSON.parse(await downloads.at(-1).blob.text());
    assert.deepEqual(exported, JSON.parse(solo.$('replay-json').value));
    assert.equal(exported.actorAppearancePin.content.owner.kind, 'journey');
    assert.deepEqual(exported.replay.checkpoint, authoritativeCheckpoint(solo.rendered.run));
    assert.deepEqual(solo.errors, []);
  });
  assert(exported);
  await t.test(
    'actual Theater resolves the shipped Journey owner and retains the download pin',
    async (t) => {
      const p = await page(t, { source: exported });
      p.load(exported);
      await p.loaded();
      const initial = p.frame(),
        appearance = initial.actorAppearance;
      assert.equal(
        appearance.snapshot.manifestSha256,
        exported.actorAppearancePin.presentation.sha256,
      );
      p.$('play-pause').emit('click');
      for (
        let time = 1100;
        time < 2000 && p.$('playback-phase').textContent !== 'complete';
        time += 100
      )
        p.frame(time);
      assert.equal(p.$('playback-phase').textContent, 'complete');
      const final = p.frame();
      assert.deepEqual(final.checkpoint, exported.replay.checkpoint);
      assert.equal(final.actorAppearance.snapshot, appearance.snapshot);
      p.$('restart').emit('click');
      const restarted = p.frame();
      assert.equal(restarted.tick, 0);
      assert.deepEqual(restarted.checkpoint, initial.checkpoint);
      assert.equal(restarted.actorAppearance.snapshot, appearance.snapshot);
      assert(!p.reads.some((key) => /actor|profile|suspended/.test(key)));
    },
  );
});
