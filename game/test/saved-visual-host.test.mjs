import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { prepareCampaignVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
import { VISUAL_THEME_CATALOGUE_FORMAT } from '../presentation/visual-theme-catalogue.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
let fixturePromise;
function fixture() {
  fixturePromise ??= (async () => {
    const document = structuredClone(createDefaultThemeBundle());
    const bytes = new Uint8Array(
      await fs.readFile(
        new URL('../assets/field-kit/sprites/player-scout-compact.png', import.meta.url),
      ),
    );
    const hash = await hashPresentationBytes(bytes);
    const slot = document.slots.find((s) => s.id === 'player.scout.compact');
    const asset = {
      format: FORMATS.asset,
      id: 'host.test.sprite',
      revision: 1,
      kind: 'image',
      description: 'Exact generated native pixel sprite used as a host fixture.',
      provenance: {
        creator: 'Test',
        source: 'Field Kit pixel source',
        license: 'Project artwork',
        prompt: '',
        parent: null,
      },
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
      geometry: structuredClone(slot.geometry),
      recipe: null,
      quality: { stage: 'produced', evidence: [] },
    };
    document.assets.push(asset);
    document.themes[1].bindings[slot.id] = { id: asset.id, revision: 1 };
    const wave = new Uint8Array(46),
      view = new DataView(wave.buffer);
    for (const [offset, text] of [
      [0, 'RIFF'],
      [8, 'WAVE'],
      [12, 'fmt '],
      [36, 'data'],
    ])
      wave.set(new TextEncoder().encode(text), offset);
    for (const [offset, value] of [
      [4, 38],
      [16, 16],
      [24, 8000],
      [28, 16000],
      [40, 2],
    ])
      view.setUint32(offset, value, true);
    for (const [offset, value] of [
      [20, 1],
      [22, 1],
      [32, 2],
      [34, 16],
    ])
      view.setUint16(offset, value, true);
    const audioHash = await hashPresentationBytes(wave);
    const audio = {
      ...structuredClone(document.assets.find((row) => row.id === 'audio.capture.default')),
      id: 'host.test.cue',
      kind: 'audio',
      recipe: null,
      file: { sha256: audioHash, bytes: wave.length, mime: 'audio/wav', width: null, height: null },
    };
    document.assets.push(audio);
    document.themes[1].bindings['audio.capture'] = { id: audio.id, revision: 1 };
    const assets = new Map([
      [hash, new Blob([bytes])],
      [audioHash, new Blob([wave])],
    ]);
    const compiled = await compilePresentation(document, assets);
    return {
      ...compiled,
      document,
      hash,
      bytes,
      assets,
      audioHash,
      wave,
      manifest: JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json'))),
    };
  })();
  return fixturePromise;
}

const slot = 'revealline.suspended.dev.v1';
const ticks = (h, n) => {
  for (let i = 0; i < n; i++) h.frame();
};
const checkpoint = (h) => {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
};
async function setup() {
  const f = await fixture(),
    source = JSON.parse(await fs.readFile(new URL('../content/campaign.json', import.meta.url)));
  const classes = JSON.parse(
    await fs.readFile(new URL('../content/classes.json', import.meta.url)),
  );
  const themes = JSON.parse(
    await fs.readFile(new URL('../content/themes.json', import.meta.url)),
  ).themes;
  const campaign = {
    ...source,
    id: 'saved-visual-host',
    classRecipes: classes,
    briefs: [source.briefs[0]],
    levels: [
      {
        ...source.levels[0],
        enemies: [],
        rules: { lives: 1, timeLimitSeconds: 1 },
        goal: { coverage: 0.9 },
      },
    ],
  };
  const entry = createExecutionCatalog([{ campaign, themes }]).entries.find(
    (row) => row.difficulty === 'standard',
  );
  const content = await prepareCampaignVisualThemeContext({
    entry,
    level: entry.campaign.levels[0],
    association: { editionId: 'field-kit', contentThemeId: 'fpv', mode: 'solo' },
  });
  const sha256 = await hashPresentationBytes(f.files.get('runtime.json'));
  const presentation = {
    source: f.manifest.source,
    theme: { id: 'fpv', revision: 1 },
    collection: null,
    sha256,
  };
  const pin = {
    format: 'revealline-visual-theme-pin.v1',
    content,
    selection: { id: 'field-kit-fpv', revision: 1 },
    presentation,
  };
  const catalogue = {
    format: VISUAL_THEME_CATALOGUE_FORMAT,
    id: 'verified-fixture',
    revision: 1,
    entries: [
      { ...pin.selection, name: 'Fixture retained original', presentation, coverage: [content] },
    ],
  };
  const next = structuredClone(f.document);
  next.revision = 2;
  next.themes[1].revision = 2;
  next.selection.theme.revision = 2;
  next.themes[1].tokens.amber = '#ffcc00';
  const current = await compilePresentation(next, f.assets, {
    previousOutput: f.files,
  });
  return { ...f, campaign, pin, catalogue, current };
}
function environment(t, f, change = () => null) {
  const decoded = [],
    requests = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    writable: true,
    value: async () => {
      const image = {
        width: 32,
        height: 32,
        closes: 0,
        close() {
          this.closes++;
        },
      };
      decoded.push(image);
      return image;
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'createImageBitmap', original);
    else delete globalThis.createImageBitmap;
  });
  const fetchResponse = async (url, options) => {
    const path = String(url);
    if (!path.includes('/presentation/')) return undefined;
    requests.push(path);
    const override = await change(path, options);
    if (override) return override;
    if (path.endsWith('/visual-themes.json')) return new Response(JSON.stringify(f.catalogue));
    const bytes = f.current.files.get(path.split('/compiled/')[1]);
    return bytes ? new Response(bytes) : new Response(null, { status: 404 });
  };
  return { decoded, requests, fetchResponse };
}
async function seed(t, f, env, difficulty = 'standard') {
  const storage = memoryStorage();
  let before;
  await t.test('record an actual unfinished flight', async (t) => {
    const h = await soloPage(t, {
      campaign: f.campaign,
      storage,
      titleScreen: true,
      fetchResponse: env.fetchResponse,
    });
    await settle(
      () =>
        h.doc.documentElement.dataset.presentationRevision ===
        String(f.current.resolved.theme.revision),
    );
    if (difficulty !== 'standard') {
      h.change('difficulty-select', difficulty);
      await settle(() => h.doc.body.dataset.pictureState === 'ready');
    }
    h.$('shell-featured').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    h.key('ArrowDown');
    ticks(h, 12);
    h.key('ArrowDown', false);
    h.key('ArrowRight');
    ticks(h, 1);
    h.key('ArrowRight', false);
    h.$('pause-button').click();
    before = checkpoint(h);
  });
  const saved = JSON.parse(storage.getItem(slot));
  assert.equal(saved.themeId, 'fpv');
  saved.format = 'xonix-session.v5';
  saved.visualThemePin = f.pin;
  storage.setItem(slot, JSON.stringify(saved));
  return { storage, before, bytes: storage.getItem(slot) };
}
test('real Solo Continue restores an older decoded collection, saves it and retains it through Retry', async (t) => {
  const f = await setup(),
    env = environment(t, f),
    seeded = await seed(t, f, env);
  const h = await soloPage(t, {
    campaign: f.campaign,
    storage: seeded.storage,
    titleScreen: true,
    fetchResponse: env.fetchResponse,
  });
  await settle(() => env.decoded.length >= 2);
  h.$('shell-continue').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  assert.deepEqual(checkpoint(h), seeded.before);
  assert.equal(h.doc.documentElement.dataset.presentationManifest, f.pin.presentation.sha256);
  assert.equal(h.doc.documentElement.dataset.presentationRevision, '1');
  assert.equal(seeded.storage.getItem(slot), seeded.bytes);
  assert(env.requests.some((url) => url.endsWith(`runtime.${f.pin.presentation.sha256}.json`)));
  const restoredImage = env.decoded.at(-1);
  assert.equal(restoredImage.closes, 0);
  h.$('pause-button').click();
  assert.deepEqual(JSON.parse(seeded.storage.getItem(slot)).visualThemePin, f.pin);
  h.$('overlay-restart').click();
  assert.equal(h.$('restart-dialog').open, true);
  h.$('restart-confirm').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.frame(0);
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(restoredImage.closes, 0);
  h.$('pause-button').click();
  assert.deepEqual(JSON.parse(seeded.storage.getItem(slot)).visualThemePin, f.pin);
  h.$('start-button').click();
  ticks(h, 250);
  assert.equal(h.rendered.run.status, 'lost');
  const original = h.rendered.run;
  h.$('retry-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.frame(0);
  assert.notEqual(h.rendered.run, original);
  assert.equal(restoredImage.closes, 0);
  h.$('pause-button').click();
  assert.deepEqual(JSON.parse(seeded.storage.getItem(slot)).visualThemePin, f.pin);
  // A finished attempt can explicitly select a fresh mission through Missions.
  h.$('start-button').click();
  ticks(h, 250);
  assert.equal(h.rendered.run.status, 'lost');
  const ended = h.rendered.run;
  h.$('shell-menu').click();
  h.$('shell-packs').click();
  h.$('mission-picker-setup').open = true;
  h.$('level-select').value = f.campaign.levels[0].id;
  await h.$('level-select').onchange();
  h.frame(0);
  assert.notEqual(h.rendered.run, ended);
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(h.rendered.paused, true);
  assert.equal(restoredImage.closes, 1);
  assert.equal(h.doc.documentElement.dataset.presentationRevision, '2');
  assert.deepEqual(h.errors, []);
});
for (const outcome of ['cancel', 'corrupt', 'bad-image', 'bad-audio'])
  test(`retained collection ${outcome} keeps the current Solo attempt and original save`, async (t) => {
    const f = await setup();
    let armed = false,
      finish,
      started = false;
    const env = environment(t, f, async (path) => {
      if (outcome === 'bad-image' && armed && started && path.endsWith(`/assets/${f.hash}.png`))
        return new Response(new Uint8Array(f.bytes.length));
      if (
        outcome === 'bad-audio' &&
        armed &&
        started &&
        path.endsWith(`/assets/${f.audioHash}.wav`)
      )
        return new Response(new Uint8Array(f.wave.length));
      if (!armed || !path.endsWith(`runtime.${f.pin.presentation.sha256}.json`)) return null;
      started = true;
      if (outcome === 'corrupt') return new Response('{}');
      if (outcome === 'bad-image' || outcome === 'bad-audio')
        return new Response(f.files.get('runtime.json'));
      return new Promise((resolve) => {
        finish = () => resolve(new Response(f.files.get('runtime.json')));
      });
    });
    const seeded = await seed(t, f, env),
      h = await soloPage(t, {
        campaign: f.campaign,
        storage: seeded.storage,
        titleScreen: true,
        fetchResponse: env.fetchResponse,
      });
    const before = checkpoint(h);
    armed = true;
    h.$('shell-continue').click();
    await settle(() => started);
    if (outcome === 'cancel') {
      h.$('shell-flight-cancel').click();
      finish();
    }
    await settle(() => !h.$('shell-continue').disabled);
    assert.deepEqual(checkpoint(h), before);
    assert.equal(seeded.storage.getItem(slot), seeded.bytes);
    assert.equal(h.$('shell-home').open, true);
    assert.notEqual(h.doc.body.dataset.flightState, 'running');
    assert.deepEqual(h.errors, []);
  });

test('leaving the page writes the retained visual pin before closing its decoded resources', async (t) => {
  const f = await setup(),
    env = environment(t, f),
    seeded = await seed(t, f, env);
  let image;
  await t.test('restore and leave through actual pagehide', async (t) => {
    const h = await soloPage(t, {
      campaign: f.campaign,
      storage: seeded.storage,
      titleScreen: true,
      fetchResponse: env.fetchResponse,
    });
    h.$('shell-continue').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    image = env.decoded.at(-1);
    assert.equal(image.closes, 0);
    ticks(h, 3);
  });
  const saved = JSON.parse(seeded.storage.getItem(slot));
  assert.equal(saved.format, 'xonix-session.v5');
  assert.deepEqual(saved.visualThemePin, f.pin);
  assert.equal(image.closes, 1);
});

test('a missing pinned picture releases the staged theme without replacing the accepted page assets', async (t) => {
  const f = await setup(),
    env = environment(t, f),
    seeded = await seed(t, f, env);
  const saved = JSON.parse(seeded.bytes);
  const row = saved.presentationPins.choices.find(
    (row) => (row.picture ?? row).identity.themeId === 'fpv',
  );
  const choice = row.picture ?? row;
  Object.assign(choice, {
    kind: 'still',
    presentationId: 'missing-picture',
    presentationRevision: 1,
    assetId: 'missing-original',
    sha256: 'c'.repeat(64),
  });
  const bytes = JSON.stringify(saved);
  seeded.storage.setItem(slot, bytes);
  const h = await soloPage(t, {
      campaign: f.campaign,
      storage: seeded.storage,
      titleScreen: true,
      fetchResponse: env.fetchResponse,
    }),
    before = checkpoint(h);
  await settle(() => h.doc.documentElement.dataset.presentationRevision === '2');
  const accepted = env.decoded.at(-1);
  h.$('shell-continue').click();
  await settle(() => !h.$('shell-continue').disabled);
  assert.match(h.$('shell-flight-status').textContent, /unavailable|missing/i);
  assert.equal(env.decoded.length, 3);
  assert.equal(env.decoded.at(-1).closes, 1);
  assert.equal(accepted.closes, 0);
  assert.equal(h.doc.documentElement.dataset.presentationRevision, '2');
  assert.deepEqual(checkpoint(h), before);
  assert.equal(seeded.storage.getItem(slot), bytes);
  assert.equal(h.$('shell-home').open, true);
  assert.deepEqual(h.errors, []);
});

test('a late page presentation neither blocks nor replaces an independently restored theme', async (t) => {
  const f = await setup();
  let hold = false,
    finish,
    pageHeld = false;
  const env = environment(t, f, async (path) => {
    if (hold && !pageHeld && path.endsWith('/runtime.json')) {
      pageHeld = true;
      return new Promise((resolve) => {
        finish = () => resolve(new Response(f.current.files.get('runtime.json')));
      });
    }
    return null;
  });
  const seeded = await seed(t, f, env);
  hold = true;
  const h = await soloPage(t, {
    campaign: f.campaign,
    storage: seeded.storage,
    titleScreen: true,
    fetchResponse: env.fetchResponse,
    waitForPictures: false,
  });
  await settle(() => pageHeld);
  h.$('shell-continue').click();
  try {
    await settle(() => h.doc.body.dataset.flightState === 'running');
    assert.equal(h.doc.documentElement.dataset.presentationRevision, '1');
    const restored = env.decoded.at(-1);
    finish();
    await settle(() => env.decoded.length === 3);
    assert.equal(h.doc.documentElement.dataset.presentationManifest, f.pin.presentation.sha256);
    assert.equal(restored.closes, 0);
    assert.deepEqual(checkpoint(h), seeded.before);
    assert.deepEqual(h.errors, []);
  } finally {
    finish?.();
  }
});

test('a save matching the current release loads an independent owner without a redundant history file', async (t) => {
  const f = await setup();
  f.current = f;
  const env = environment(t, f),
    seeded = await seed(t, f, env);
  const h = await soloPage(t, {
    campaign: f.campaign,
    storage: seeded.storage,
    titleScreen: true,
    fetchResponse: env.fetchResponse,
  });
  h.$('shell-continue').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  assert.deepEqual(checkpoint(h), seeded.before);
  assert.equal(h.doc.documentElement.dataset.presentationManifest, f.pin.presentation.sha256);
  assert.equal(
    env.requests.some((url) => url.includes(`runtime.${f.pin.presentation.sha256}.json`)),
    false,
  );
  assert.equal(env.decoded.filter((image) => image.closes === 0).length, 2);
  assert.deepEqual(h.errors, []);
});

test('Gentle restoration verifies original art identity and preserves the transformed simulation', async (t) => {
  const f = await setup(),
    env = environment(t, f),
    seeded = await seed(t, f, env, 'gentle');
  const saved = JSON.parse(seeded.bytes);
  assert.notEqual(saved.replay.level.revision, f.pin.content.level.revision);
  const h = await soloPage(t, {
    campaign: f.campaign,
    storage: seeded.storage,
    titleScreen: true,
    fetchResponse: env.fetchResponse,
  });
  h.$('shell-continue').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  assert.deepEqual(checkpoint(h), seeded.before);
  assert.equal(h.doc.documentElement.dataset.presentationManifest, f.pin.presentation.sha256);
  h.$('pause-button').click();
  assert.deepEqual(JSON.parse(seeded.storage.getItem(slot)).visualThemePin, f.pin);
  assert.deepEqual(h.errors, []);
});
