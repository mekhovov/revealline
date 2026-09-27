import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineDownloadAccess } from '../offline-download-access.mjs';

const hash = 'a'.repeat(64);
const file = { path: 'picture.png', sha256: hash, bytes: 12, kind: 'gameplay' };
const catalogue = {
  format: 'revealline-offline-content.v2',
  version: 'test',
  files: [file],
  missions: [
    { routeId: 'current', missionId: 'first', modes: ['solo'], groups: ['solo:horizon-starter'] },
  ],
  groups: [
    {
      id: 'solo:horizon-starter',
      kind: 'gameplay',
      current: true,
      modes: ['solo'],
      category: 'starter',
      requires: [],
      files: ['picture.png'],
    },
  ],
};
const availability = {
  available: true,
  packageConsent: true,
  version: 'test',
  scope: 'https://game.test/site/',
};

test('unprepared chapter requests confirmation before it can prepare a mission', async () => {
  let ready = false,
    prompts = 0,
    requests = 0;
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async (url) => {
      requests++;
      assert.equal(url.href, 'https://game.test/site/offline-content.json');
      return Response.json(catalogue);
    },
    store: {
      inspect: async (files, options) => {
        assert.equal(options.verify, true);
        assert.deepEqual(files, [file]);
        return { ready };
      },
    },
    requestPackage: async ({ groupId }) => {
      assert.equal(groupId, 'solo:horizon-starter');
      prompts++;
      ready = true;
    },
  });
  await access.ensure('solo:horizon-starter');
  await access.ensureMission({ routeId: 'current', missionId: 'first', mode: 'solo' });
  assert.equal(prompts, 1);
  assert.equal(
    requests,
    1,
    'only the small catalogue is fetched; artwork transfer belongs to the consent UI',
  );
});

test('UI readiness alone cannot authorize an incomplete or corrupt chapter', async () => {
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(catalogue),
    store: { inspect: async () => ({ ready: false }) },
    requestPackage: async () => {},
  });
  await assert.rejects(access.ensure('solo:horizon-starter'), /not ready offline/);
});

test('closing or aborting a package request preserves the existing attempt', async () => {
  const controller = new AbortController();
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(catalogue),
    store: { inspect: async () => ({ ready: false }) },
    requestPackage: async () => controller.abort(),
  });
  await assert.rejects(access.ensure('solo:horizon-starter', { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('development and legacy editions do not fetch a new catalogue', async () => {
  const access = createOfflineDownloadAccess({
    availability: { available: true },
    fetch: () => {
      throw new Error('unexpected request');
    },
  });
  await access.ensure('solo:horizon-starter');
});

test('passive previews never open a download prompt for missing assets', async () => {
  let prompts = 0;
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(catalogue),
    store: { inspect: async () => ({ ready: false }) },
    requestPackage: async () => {
      prompts++;
    },
  });
  await assert.rejects(
    access.ensureMission(
      { routeId: 'current', missionId: 'first', mode: 'solo' },
      { prompt: false },
    ),
    /Download this chapter/,
  );
  assert.equal(prompts, 0);
});

test('a reused original cannot substitute another mission edition package', async () => {
  const previous = 'archive:journey:previous';
  const value = structuredClone(catalogue);
  value.groups.push({ ...value.groups[0], id: previous, category: 'archive', current: false });
  value.missions.push({
    routeId: 'previous',
    missionId: 'first',
    modes: ['solo'],
    groups: [previous],
  });
  let ready = false;
  const requested = [];
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(value),
    store: { inspect: async () => ({ ready }) },
    requestPackage: async ({ groupId }) => {
      requested.push(groupId);
      ready = true;
    },
  });
  await access.ensureMission({ routeId: 'previous', missionId: 'first', mode: 'solo' });
  assert.deepEqual(requested, [previous]);
  await assert.rejects(
    access.ensureMission({ routeId: 'previous', missionId: 'first', mode: 'versus' }),
    /exact mission edition/,
  );
});

test('optional tool URLs resolve only their published tooling group', async () => {
  const value = structuredClone(catalogue),
    tool = {
      path: 'authoring/studio/index.html',
      sha256: 'b'.repeat(64),
      bytes: 10,
      kind: 'gameplay',
    };
  value.files.push(tool);
  value.groups.push({
    id: 'tooling:workshop',
    kind: 'gameplay',
    category: 'tooling',
    requires: [],
    files: [tool.path],
  });
  let ready = false;
  const requested = [];
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(value),
    store: { inspect: async () => ({ ready }) },
    requestPackage: async ({ groupId }) => {
      requested.push(groupId);
      ready = true;
    },
  });
  await access.ensureURL('https://elsewhere.test/authoring/studio/');
  await access.ensureURL('https://game.test/site/authoring/studio/?review=1');
  assert.deepEqual(requested, ['tooling:workshop']);
});

test('a stalled catalogue can be cancelled and does not block the next mission request', async () => {
  const controller = new AbortController();
  let requests = 0,
    firstSignal;
  const access = createOfflineDownloadAccess({
    availability,
    fetch: (_url, { signal }) => {
      requests++;
      if (requests > 1) return Promise.resolve(Response.json(catalogue));
      firstSignal = signal;
      return new Promise(() => {});
    },
    store: { inspect: async () => ({ ready: true }) },
  });
  const pending = access.ensure('solo:horizon-starter', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(firstSignal.aborted, true);
  await access.ensure('solo:horizon-starter');
  assert.equal(requests, 2);
});

test('an online network blackhole times out and can retry without reopening the app', async () => {
  let requests = 0,
    firstSignal;
  const access = createOfflineDownloadAccess({
    availability,
    catalogueTimeout: 10,
    fetch: (_url, { signal }) => {
      requests++;
      if (requests > 1) return Promise.resolve(Response.json(catalogue));
      firstSignal = signal;
      return new Promise(() => {});
    },
    store: { inspect: async () => ({ ready: true }) },
  });
  await assert.rejects(access.ensure('solo:horizon-starter'), /catalogue timed out/);
  assert.equal(firstSignal.aborted, true);
  await access.ensure('solo:horizon-starter');
  assert.equal(requests, 2);
});

function destinationFixture() {
  const value = structuredClone(catalogue);
  const ids = ['runtime:versus', 'versus:horizon', 'versus:border', 'classic:base'];
  ids.forEach((id, index) => {
    const asset = { ...file, path: `${id}.json`, sha256: String(index + 1).repeat(64) };
    value.files.push(asset);
    value.groups.push({ ...value.groups[0], id, files: [asset.path] });
  });
  const destination = {
    path: 'game/couch/',
    mode: 'versus',
    routeId: 'whole-spatial-v11',
    runtimeGroups: ['runtime:versus'],
    groups: ['runtime:versus', 'versus:horizon'],
  };
  value.destinations = [
    destination,
    {
      ...destination,
      libraryId: '["exact published owner"]',
      groups: ['runtime:versus', 'versus:border'],
    },
    {
      ...destination,
      routeId: 'legacy',
      groups: ['runtime:versus', 'classic:base'],
    },
  ];
  const requested = [],
    ready = new Set();
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(value),
    store: { inspect: async ([asset]) => ({ ready: ready.has(asset.path) }) },
    requestPackage: async ({ groupId }) => {
      requested.push(groupId);
      ready.add(`${groupId}.json`);
    },
  });
  return { access, requested };
}

test('mode navigation prepares the exact published destination and rejects guessed owners', async () => {
  const { access, requested } = destinationFixture();
  const url = new URL('https://game.test/site/game/couch/index.html');
  url.searchParams.set('library-mission', '["exact published owner"]');
  await access.ensureDestination(url);
  assert.deepEqual(requested, ['runtime:versus', 'versus:border']);
  url.searchParams.set('library-mission', '["similar imported owner"]');
  await assert.rejects(access.ensureDestination(url), /exact destination/);
  await assert.rejects(access.ensureDestination(`${url}&library-mission=extra`), /invalid/);
  assert.equal(requested.length, 2, 'rejected owners never prepare a fallback chapter');
  await access.ensureDestination('https://game.test/site/game/couch/');
  assert.deepEqual(requested, ['runtime:versus', 'versus:border', 'versus:horizon']);
});

test('local imported/return ownership only prepares its receiving runtime', async () => {
  const { access, requested } = destinationFixture();
  await access.ensureDestination('https://game.test/site/game/couch/?pack=local-copy');
  await access.ensureDestination(
    'https://game.test/site/game/couch/?journey=legacy&library-mission=import',
    { runtimeOnly: true },
  );
  await access.ensureDestination('https://elsewhere.test/game/couch/');
  assert.deepEqual(requested, ['runtime:versus']);
});

test('deliberate mission admission retains the verified runtime and artwork dependency closure', async () => {
  const value = structuredClone(catalogue),
    runtime = { ...file, path: 'runtime.mjs', sha256: 'd'.repeat(64) };
  value.files.push(runtime);
  value.groups.push({ id: 'runtime:solo', kind: 'gameplay', requires: [], files: [runtime.path] });
  value.groups[0].requires.push('runtime:solo');
  let ready = false;
  const pins = [];
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(value),
    store: {
      inspect: async () => ({ ready }),
      pin: async (value) => {
        assert.equal(ready, true);
        pins.push(value);
      },
    },
    requestPackage: async () => {
      ready = true;
    },
  });
  const mission = { routeId: 'current', missionId: 'first', mode: 'solo' };
  await access.ensureMission(mission);
  assert.equal(pins.length, 0, 'download and preview do not create played owners');
  await access.ensureMission(mission, { retain: true });
  assert.equal(pins.length, 1);
  assert.equal(pins[0].edition, availability.scope);
  assert.equal(pins[0].group, 'solo:horizon-starter');
  assert.deepEqual(
    new Set(pins[0].files.map((item) => item.path)),
    new Set([file.path, runtime.path]),
  );
});

test('cancellation after verification does not retain or admit a mission', async () => {
  const controller = new AbortController();
  let pins = 0;
  const access = createOfflineDownloadAccess({
    availability,
    fetch: async () => Response.json(catalogue),
    store: {
      inspect: async () => {
        controller.abort();
        return { ready: true };
      },
      pin: async () => {
        pins++;
      },
    },
  });
  await assert.rejects(
    access.ensure('solo:horizon-starter', { retain: true, signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(pins, 0);
});
