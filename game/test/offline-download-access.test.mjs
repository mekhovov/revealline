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
