import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPresentationHost, ACTOR_PRESENTATION_SLOTS } from '../presentation/host.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import {
  ACTOR_APPEARANCE_RELEASES,
  ACTOR_APPEARANCE_REQUIRED_SLOTS,
  prepareActorAppearanceLease,
  prepareRetainedActorAppearanceLease,
} from '../presentation/actor-appearance-lease.mjs';

const directory = new URL('../presentation/compiled/', import.meta.url);
const baseURL = 'https://game.test/releases/exact/game/presentation/compiled/';
const presentation = ACTOR_APPEARANCE_RELEASES[0].presentation;
const currentBytes = new Uint8Array(await readFile(new URL('runtime.json', directory)));
const bytes = new Uint8Array(
  await readFile(new URL(`runtime.${presentation.sha256}.json`, directory)),
);
const manifest = JSON.parse(new TextDecoder().decode(bytes));
const hash = await hashPresentationBytes(bytes);
function content(mode = 'solo', journey = false) {
  return {
    editionId: journey ? 'journey-pressure' : 'field-kit',
    contentThemeId: 'ukraine',
    mode,
    owner: journey
      ? {
          kind: 'journey',
          projectId: 'journey',
          projectRevision: 1,
          projectSha256: 'c'.repeat(64),
          packId: 'horizon',
          campaignId: 'horizon',
          baseCampaignKey: 'actual-journey-key',
          policyId: 'journey-policy',
        }
      : mode === 'team'
        ? { kind: 'team-pack', id: 'actual-pack', revision: 1, sha256: 'd'.repeat(64) }
        : { kind: 'campaign', baseCampaignKey: 'actual-accepted-key' },
    level: {
      id: 'actual-map',
      revision: 'original',
      sha256: 'e'.repeat(64),
      ...(journey ? { simulationIdentity: '1234567890abcdef' } : {}),
    },
  };
}
function environment({
  currentBytes: current = currentBytes,
  historical = true,
  hostOptions = {},
  decode,
} = {}) {
  const requests = [],
    decoded = [],
    hosts = [],
    options = [];
  const fetch = async (url) => {
    const relative = url.slice(baseURL.length);
    requests.push(relative);
    if (relative === 'runtime.json') return new Response(current);
    if (relative === `runtime.${hash}.json`)
      return historical ? new Response(bytes) : new Response(null, { status: 404 });
    if (!relative.startsWith('assets/')) return new Response(null, { status: 404 });
    try {
      return new Response(await readFile(new URL(relative, directory)));
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Sparse test checkouts omit generated assets. Read the same committed
        // bytes without creating files or substituting a synthetic picture.
        const committed = execFileSync(
          'git',
          ['show', `HEAD:game/presentation/compiled/${relative}`],
          {
            cwd: fileURLToPath(new URL('../../', import.meta.url)),
            maxBuffer: 2 * 1024 * 1024,
          },
        );
        return new Response(committed);
      }
      throw error;
    }
  };
  const createHost = (source) => {
    options.push(source);
    const host = createPresentationHost({
      ...source,
      fetch,
      decodeImage: async (blob) => {
        const data = new DataView(await blob.arrayBuffer());
        const image = {
          width: data.getUint32(16),
          height: data.getUint32(20),
          closes: 0,
          close() {
            this.closes++;
          },
        };
        decoded.push(image);
        if (decode) await decode(image);
        return image;
      },
      document: new Proxy(
        {},
        {
          get() {
            assert.fail('Actor profile must not read the live document.');
          },
        },
      ),
      fontFactory() {
        assert.fail('Actor profile must not open fonts.');
      },
      createObjectURL() {
        assert.fail('Actor profile needs no CSS object URLs.');
      },
      ...hostOptions,
    });
    hosts.push(host);
    return host;
  };
  return { requests, decoded, hosts, options, createHost, fetch };
}
const prepare = (env, input = {}, options = {}) =>
  prepareActorAppearanceLease(
    { content: content(), scope: 'builtin', ...input },
    { baseURL, createHost: env.createHost, ...options },
  );

test('approved actor registry binds exact accepted compiled62 bytes, not a current-name alias', () => {
  assert.equal(hash, presentation.sha256);
  assert.deepEqual(manifest.source, presentation.source);
  assert.deepEqual(
    { id: manifest.resolved.theme.id, revision: manifest.resolved.theme.revision },
    presentation.theme,
  );
  assert.equal(manifest.resolved.collection, presentation.collection);
  assert.equal(ACTOR_APPEARANCE_RELEASES[0].scope, 'actors');
  assert.equal(ACTOR_APPEARANCE_REQUIRED_SLOTS.solo.length, 28);
  assert.equal(ACTOR_APPEARANCE_REQUIRED_SLOTS.versus.length, 28);
  assert.equal(ACTOR_APPEARANCE_REQUIRED_SLOTS.team.length, 39);
});

test('fixed actors loader uses the existing verified image path and has no other presentation authority', async () => {
  const env = environment({ currentBytes: bytes, historical: false }),
    host = env.createHost({ profile: 'actors', baseURL }),
    snapshot = await host.load({ expectedManifestSha256: hash });
  const expected = new Set(
    ACTOR_PRESENTATION_SLOTS.map((id) => manifest.resolved.assets[id])
      .filter((asset) => asset?.kind === 'image')
      .map((asset) => manifest.urls[asset.file.sha256].slice(2)),
  );
  assert.deepEqual(new Set(env.requests), new Set(['runtime.json', ...expected]));
  assert.equal(env.decoded.length, expected.size);
  assert.ok(snapshot.image('player.scout.compact'));
  assert.equal(snapshot.image('terrain.wall'), null);
  assert.equal(snapshot.image('ui.button.default'), null);
  assert.throws(() => host.apply({}), /actor-only/);
  await assert.rejects(host.readPicture('scene.reveal.wide'), /actor-only/);
  await assert.rejects(host.readAudio('audio.music'), /actor-only/);
  host.close();
  host.close();
  assert.ok(env.decoded.every((image) => image.closes === 1));
});

test('only full or fixed actors profiles are allowed', () => {
  for (const profile of ['custom', ['player.scout.compact'], null])
    assert.throws(() => createPresentationHost({ profile, baseURL }), /registered.*profile/);
});

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode}: actor-only lease keeps actual non-FPV content and immutable resources separate`, async () => {
    const env = environment(),
      owner = content(mode, mode !== 'solo'),
      statuses = [],
      lease = await prepare(
        env,
        { content: owner, scope: mode === 'solo' ? 'builtin' : 'journey' },
        { onStatus: (status) => statuses.push(status) },
      );
    assert.deepEqual(Object.keys(lease).sort(), ['pin', 'release', 'snapshot']);
    assert.deepEqual(lease.pin().content, owner);
    assert.equal(lease.pin().style, 'fpv');
    assert.deepEqual(lease.pin().presentation, presentation);
    assert.equal(lease.snapshot.fonts, undefined);
    assert.equal(lease.snapshot.canvas, undefined);
    assert.equal(lease.snapshot.resolved.tokens, undefined);
    assert.equal(lease.snapshot.resolved.assets['terrain.wall'], undefined);
    assert.equal(lease.snapshot.image('terrain.wall'), null);
    assert.equal(statuses.filter((status) => status.status === 'ready').length, 1);
    assert.ok(env.options.every((option) => option.profile === 'actors'));
    lease.release();
    lease.release();
    assert.ok(env.decoded.every((image) => image.closes === 1));
    assert.throws(() => lease.pin(), /released/);
    assert.throws(() => lease.snapshot.image('player.scout.compact'), /released/);
  });

test('explicit Campaign style acquires no extra resources and validates trusted host scope', async () => {
  const env = environment(),
    lease = await prepare(env, { style: 'campaign' });
  assert.equal(env.hosts.length, 0);
  assert.equal(lease.snapshot, null);
  assert.equal(lease.pin().presentation, null);
  assert.equal(lease.pin().style, 'campaign');
  lease.release();
  assert.throws(() => lease.pin(), /released/);
  // scope is supplied by trusted integration after registry/ownership checks,
  // not by this structural content fixture or a future imported actor pin.
  for (const scope of [undefined, 'custom', 'team-pack', 'journey'])
    await assert.rejects(prepare(env, { scope }), /code-owned actor content scope/);
  assert.equal(env.hosts.length, 0);
});

test('unapproved source/hash and malformed current hash cannot acquire a host', async () => {
  const env = environment();
  for (const changed of [
    { ...presentation, sha256: 'f'.repeat(64) },
    { ...presentation, source: { ...presentation.source, revision: 63 } },
    { ...presentation, collection: { id: 'different', revision: 1 } },
  ])
    await assert.rejects(prepare(env, { presentation: changed }), /not approved/);
  await assert.rejects(prepare(env, {}, { currentManifestSha256: 'latest' }), /exact current/);
  assert.equal(env.hosts.length, 0);
});

test('retained appearance is exact-content bound and ignores future preference changes', async () => {
  const original = environment(),
    lease = await prepare(original),
    pin = lease.pin();
  lease.release();
  const env = environment(),
    restored = await prepareRetainedActorAppearanceLease(
      { pin, content: content(), scope: 'builtin' },
      { baseURL, createHost: env.createHost },
    );
  assert.deepEqual(restored.pin(), pin);
  restored.release();
  const wrong = content();
  wrong.mode = 'versus';
  await assert.rejects(
    prepareRetainedActorAppearanceLease(
      { pin, content: wrong, scope: 'builtin' },
      { baseURL, createHost: env.createHost },
    ),
    /different accepted content/,
  );
  assert.equal(
    env.hosts.length,
    2,
    'current lookup and exact retained lookup use separate staged hosts after compiler drift',
  );
});

test('retained history checks same exact bytes after current manifest drift, never latest assets', async () => {
  const env = environment({
      currentBytes: new TextEncoder().encode(' ' + new TextDecoder().decode(bytes)),
      historical: true,
    }),
    lease = await prepare(env);
  assert.deepEqual(env.requests.slice(0, 2), ['runtime.json', `runtime.${hash}.json`]);
  assert.equal(env.hosts.length, 2);
  await assert.rejects(env.hosts[0].load(), /closed/);
  assert.equal(lease.pin().presentation.sha256, hash);
  lease.release();
  const missing = environment({
    currentBytes: new TextEncoder().encode(' ' + new TextDecoder().decode(bytes)),
    historical: false,
  });
  await assert.rejects(prepare(missing), /unavailable/);
  assert.deepEqual(missing.requests, ['runtime.json', `runtime.${hash}.json`]);
  assert.equal(missing.decoded.length, 0);
});

test('late cancellation disposes staging while another live host remains usable', async () => {
  const active = environment(),
    live = await prepare(active),
    stop = new AbortController();
  let open, arrived;
  const reached = new Promise((resolve) => {
    arrived = resolve;
  });
  const env = environment({
    decode: () =>
      new Promise((resolve) => {
        open = resolve;
        arrived();
      }),
  });
  const pending = prepare(env, {}, { signal: stop.signal });
  await reached;
  stop.abort();
  open();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.ok(env.decoded.every((image) => image.closes === 1));
  assert.ok(active.decoded.every((image) => image.closes === 0));
  assert.ok(live.snapshot.image('player.scout.compact'));
  live.release();
});

test('post-transfer cancellation and throwing observers cannot dispose an adopted lease', async () => {
  const env = environment(),
    stop = new AbortController(),
    lease = await prepare(
      env,
      {},
      {
        signal: stop.signal,
        onStatus() {
          throw new Error('observer');
        },
      },
    );
  stop.abort();
  assert.ok(lease.snapshot.image('player.scout.compact'));
  assert.ok(env.decoded.every((image) => image.closes === 0));
  lease.release();
});

test('an accidentally supplied live owner is rejected without closing or reloading it', async () => {
  const env = environment(),
    lease = await prepare(env),
    count = env.requests.length;
  await assert.rejects(
    prepareActorAppearanceLease(
      { content: content(), scope: 'builtin' },
      { baseURL, createHost: () => env.hosts.at(-1) },
    ),
    /fresh presentation host/,
  );
  assert.equal(env.requests.length, count);
  assert.ok(lease.snapshot.image('player.scout.compact'));
  lease.release();
});

test('required actor readiness rejects an absent body even when trusted loader identity matches', async () => {
  const env = environment(),
    statuses = [];
  await assert.rejects(
    prepareActorAppearanceLease(
      { content: content(), scope: 'builtin' },
      {
        baseURL,
        onStatus: (status) => statuses.push(status),
        createHost: (options) => {
          const host = env.createHost(options);
          return {
            ...host,
            async load(options) {
              const snapshot = await host.load(options);
              return {
                ...snapshot,
                image: (slot) => (slot === 'player.carrier.detailed' ? null : snapshot.image(slot)),
              };
            },
          };
        },
      },
    ),
    /not decoded: player.carrier.detailed/,
  );
  assert.ok(env.decoded.every((image) => image.closes === 1));
  assert.equal(
    statuses.some((status) => status.status === 'ready'),
    false,
  );
  assert.equal(statuses.at(-1).status, 'error');
});
