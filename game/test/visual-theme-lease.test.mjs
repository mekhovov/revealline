import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import {
  createVisualThemeCatalogue,
  VISUAL_THEME_CATALOGUE_FORMAT,
} from '../presentation/visual-theme-catalogue.mjs';
import {
  prepareVisualThemeLease,
  prepareRetainedVisualThemeLease,
} from '../presentation/visual-theme-lease.mjs';

const baseURL = 'https://game.test/releases/v1/game/presentation/compiled/';
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
    const compiled = await compilePresentation(document, new Map([[hash, new Blob([bytes])]]));
    return {
      ...compiled,
      hash,
      bytes,
      manifest: JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json'))),
    };
  })();
  return fixturePromise;
}
function environment(f, overrides = {}) {
  const requests = [],
    decoded = [],
    urls = [],
    revoked = [];
  let serial = 0;
  const host = createPresentationHost({
    baseURL,
    fetch: async (url, options) => {
      requests.push({ url, options });
      const key = url.slice(baseURL.length),
        bytes = f.files.get(key);
      return bytes ? new Response(bytes) : new Response(null, { status: 404 });
    },
    decodeImage: async () => {
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
    createObjectURL: (blob) => {
      const url = `blob:host-${serial++}`;
      urls.push({ url, blob });
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
    ...overrides,
  });
  return { host, requests, decoded, urls, revoked };
}

const content = {
  editionId: 'field-kit',
  contentThemeId: 'fpv',
  mode: 'solo',
  owner: { kind: 'campaign', baseCampaignKey: 'accepted/1/original' },
  level: { id: 'first-signal', revision: '1', sha256: 'b'.repeat(64) },
};
async function setup(change = () => {}) {
  const f = await fixture();
  const compiled = f.manifest;
  const source = {
    format: VISUAL_THEME_CATALOGUE_FORMAT,
    id: 'approved',
    revision: 1,
    entries: [
      {
        id: 'field-kit',
        revision: 1,
        name: 'Field Kit',
        coverage: [content],
        presentation: {
          source: compiled.source,
          theme: { id: compiled.resolved.theme.id, revision: compiled.resolved.theme.revision },
          collection: compiled.resolved.collection,
          sha256: await hashPresentationBytes(f.files.get('runtime.json')),
        },
      },
    ],
  };
  change(source);
  return {
    f,
    request: {
      catalogue: createVisualThemeCatalogue(source),
      selection: { id: 'field-kit', revision: 1 },
      content,
      requiredSlots: ['player.scout.compact'],
    },
  };
}

test('verified catalogue selection produces an independently owned exact presentation lease', async () => {
  const { f, request } = await setup(),
    env = environment(f),
    statuses = [];
  const lease = await prepareVisualThemeLease(request, {
    createHost: () => env.host,
    onStatus: (status) => statuses.push(status),
  });
  assert.equal(lease.kind, 'prepared-presentation');
  assert.equal(lease.snapshot, env.host.current());
  assert.equal(lease.snapshot.manifestSha256, lease.match.presentation.sha256);
  assert.equal(statuses[0].stage, 'reading');
  assert.equal(statuses.filter((status) => status.status === 'ready').length, 1);
  assert.equal(statuses.at(-1).status, 'ready');
  assert(Object.isFrozen(lease));
  assert.equal(env.decoded[0].closes, 0);
  lease.release();
  lease.release();
  assert.equal(env.decoded[0].closes, 1);
  assert.throws(() => lease.apply({}), /released/);
});

test('declared manifest pin mismatch releases the staging host before acquiring assets', async () => {
  const { f, request } = await setup((source) => {
    source.entries[0].presentation.sha256 = '0'.repeat(64);
  });
  const env = environment(f);
  await assert.rejects(
    prepareVisualThemeLease(request, { createHost: () => env.host }),
    /pinned release/,
  );
  assert.equal(env.requests.length, 1);
  assert.equal(env.decoded.length, 0);
  await assert.rejects(env.host.load(), /closed/);
});

test('matching manifest bytes cannot excuse mismatched source, theme or collection declarations', async () => {
  for (const change of [
    (presentation) => {
      presentation.source = { ...presentation.source, revision: presentation.source.revision + 1 };
    },
    (presentation) => {
      presentation.theme = { ...presentation.theme, revision: presentation.theme.revision + 1 };
    },
    (presentation) => {
      presentation.collection = { id: 'other', revision: 1 };
    },
  ]) {
    const { f, request } = await setup((source) => change(source.entries[0].presentation));
    const env = environment(f),
      statuses = [];
    await assert.rejects(
      prepareVisualThemeLease(request, {
        createHost: () => env.host,
        onStatus: (value) => statuses.push(value),
      }),
      /exact declared revision/,
    );
    assert.equal(env.decoded[0].closes, 1);
    assert.equal(
      statuses.some((value) => value.status === 'ready'),
      false,
    );
    assert.equal(statuses.at(-1).status, 'error');
    assert.equal(env.host.current(), null);
  }
});

test('missing required roles fail without publishing readiness or touching the live attempt', async () => {
  const { f, request } = await setup(),
    live = environment(f),
    stage = environment(f);
  const current = await live.host.load();
  const statuses = [];
  await assert.rejects(
    prepareVisualThemeLease(
      { ...request, requiredSlots: ['missing.required.role'] },
      { createHost: () => stage.host, onStatus: (value) => statuses.push(value) },
    ),
    /missing/,
  );
  assert.equal(
    statuses.some((value) => value.status === 'ready'),
    false,
  );
  assert.equal(stage.decoded[0].closes, 1);
  assert.equal(live.host.current(), current);
  assert.equal(live.decoded[0].closes, 0);
  live.host.close();
});

test('unavailable, unsupported and campaign-style choices return explicit outcomes without acquiring a host', async () => {
  const { request } = await setup();
  const createHost = () => {
    throw new Error('Must not acquire a host.');
  };
  assert.equal(
    (await prepareVisualThemeLease({ ...request, selection: null }, { createHost })).kind,
    'campaign-style',
  );
  assert.equal(
    (
      await prepareVisualThemeLease(
        { ...request, selection: { id: 'field-kit', revision: 99 } },
        { createHost },
      )
    ).kind,
    'unavailable',
  );
  const result = await prepareVisualThemeLease(
    { ...request, content: { ...content, mode: 'versus' } },
    { createHost },
  );
  assert.equal(result.kind, 'unsupported');
  assert.equal(result.alternative, 'campaign-style');
});

test('malformed required slots fail before host creation and valid slots are owned before awaits', async () => {
  const { f, request } = await setup();
  const createHost = () => {
    throw new Error('Must not create.');
  };
  for (const requiredSlots of [
    [],
    ['player.scout.compact', 'player.scout.compact'],
    ['bad slot'],
    null,
  ])
    await assert.rejects(prepareVisualThemeLease({ ...request, requiredSlots }, { createHost }));
  const slots = ['player.scout.compact'],
    env = environment(f);
  const pending = prepareVisualThemeLease(
    { ...request, requiredSlots: slots },
    { createHost: () => env.host },
  );
  slots[0] = 'missing.required.role';
  const lease = await pending;
  lease.release();
});

test('an accidentally supplied live page host is rejected without closing or reloading it', async () => {
  const { f, request } = await setup(),
    env = environment(f);
  const before = await env.host.load();
  const count = env.requests.length;
  await assert.rejects(
    prepareVisualThemeLease(request, { createHost: () => env.host }),
    /fresh presentation host/,
  );
  assert.equal(env.host.current(), before);
  assert.equal(env.requests.length, count);
  assert.equal(env.decoded[0].closes, 0);
  env.host.close();
});

test('cancellation during a late decode releases its owned bitmap and publishes no readiness', async () => {
  const { f, request } = await setup();
  let finish, began;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const started = new Promise((resolve) => {
    began = resolve;
  });
  const image = {
    width: 32,
    height: 32,
    closes: 0,
    close() {
      this.closes++;
    },
  };
  const env = environment(f, {
    decodeImage: async () => {
      began();
      await gate;
      return image;
    },
  });
  const stop = new AbortController(),
    statuses = [];
  const pending = prepareVisualThemeLease(request, {
    createHost: () => env.host,
    signal: stop.signal,
    onStatus: (value) => statuses.push(value),
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started;
  stop.abort();
  finish();
  await rejected;
  assert.equal(image.closes, 1);
  assert.equal(
    statuses.some((value) => value.status === 'ready'),
    false,
  );
  await assert.rejects(env.host.load(), /closed/);
});

test('ownership transfer detaches preparation cancellation and closes only on explicit release', async () => {
  const { f, request } = await setup(),
    env = environment(f),
    stop = new AbortController();
  const lease = await prepareVisualThemeLease(request, {
    createHost: () => env.host,
    signal: stop.signal,
  });
  stop.abort();
  assert.equal(env.host.current(), lease.snapshot);
  assert.equal(env.decoded[0].closes, 0);
  lease.release();
  assert.equal(env.decoded[0].closes, 1);
  assert.throws(() => lease.readPicture('scene.reveal.wide'), /released/);
  assert.throws(() => lease.readAudio('music.title'), /released/);
});

test('an observer exception cannot own the attempt; abort from final readiness still rejects safely', async () => {
  const { f, request } = await setup(),
    env = environment(f);
  const lease = await prepareVisualThemeLease(request, {
    createHost: () => env.host,
    onStatus: () => {
      throw new Error('observer');
    },
  });
  lease.release();
  const stop = new AbortController(),
    other = environment(f);
  await assert.rejects(
    prepareVisualThemeLease(request, {
      createHost: () => other.host,
      signal: stop.signal,
      onStatus: (status) => {
        if (status.status === 'ready') stop.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(other.decoded[0].closes, 1);
});

test('retained lease restores original manifest after current bytes change and owns its resources independently', async () => {
  const { f, request } = await setup();
  const old = environment(f);
  const first = await prepareVisualThemeLease(request, { createHost: () => old.host });
  const pin = first.pin();
  first.release();
  const files = new Map(f.files);
  files.set(`runtime.${pin.presentation.sha256}.json`, files.get('runtime.json'));
  files.set('runtime.json', new TextEncoder().encode('a later, unrelated current manifest'));
  const env = environment({ ...f, files }, { retainedManifestSha256: pin.presentation.sha256 });
  const signalOwner = new AbortController();
  const restored = await prepareRetainedVisualThemeLease(
    { ...request, pin },
    {
      createHost: () => env.host,
      signal: signalOwner.signal,
    },
  );
  try {
    assert.deepEqual(restored.pin(), pin);
    assert.equal(restored.snapshot.manifestSha256, pin.presentation.sha256);
    assert.equal(env.requests[0].url, baseURL + `runtime.${pin.presentation.sha256}.json`);
    assert.equal(
      env.requests.some((request) => request.url === baseURL + 'runtime.json'),
      false,
    );
    signalOwner.abort();
    assert.equal(env.host.current(), restored.snapshot);
    assert.equal(env.decoded[0].closes, 0);
    assert.equal(old.decoded[0].closes, 1);
  } finally {
    restored.release();
  }
  assert.equal(env.decoded[0].closes, 1);
});

test('missing retained release leaves another accepted owner usable and disposes only its staging host', async () => {
  const { f, request } = await setup();
  const live = environment(f);
  const accepted = await prepareVisualThemeLease(request, { createHost: () => live.host });
  const pin = accepted.pin();
  const stage = environment(f, { retainedManifestSha256: pin.presentation.sha256 });
  try {
    await assert.rejects(
      prepareRetainedVisualThemeLease({ ...request, pin }, { createHost: () => stage.host }),
      /unavailable/,
    );
    assert.equal(stage.requests.length, 1);
    assert.equal(stage.decoded.length, 0);
    await assert.rejects(
      stage.host.load({ expectedManifestSha256: pin.presentation.sha256 }),
      /closed/,
    );
    assert.equal(live.host.current(), accepted.snapshot);
    assert.deepEqual(accepted.pin(), pin);
    assert.equal(live.decoded[0].closes, 0);
  } finally {
    accepted.release();
  }
  assert.equal(live.decoded[0].closes, 1);
});
