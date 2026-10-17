import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineDownloadAccess } from '../offline-download-access.mjs';
import { memoryCaches } from './helpers/official-caches.mjs';
import { ensureVersusEntryPackage } from '../couch/versus-package-readiness.mjs';

const availability = {
  available: true,
  packageConsent: true,
  version: 'test',
  scope: 'https://game.test/site/',
};
const file = { path: 'mission.json', bytes: 12, sha256: 'a'.repeat(64), kind: 'gameplay' };
const catalogue = {
  format: 'revealline-offline-content.v2',
  version: 'test',
  files: [file],
  groups: [{ id: 'chapter', kind: 'gameplay', requires: [], files: [file.path] }],
  missions: ['solo', 'versus', 'team'].map((mode) => ({
    routeId: 'current',
    missionId: mode,
    modes: [mode],
    groups: ['chapter'],
  })),
};
async function fixture({ ready = false, pin = async () => {} } = {}) {
  const caches = memoryCaches();
  await (
    await caches.open('core')
  ).put(`${availability.scope}offline-content.json`, Response.json(catalogue));
  return createOfflineDownloadAccess({
    availability,
    caches,
    fetch: () => assert.fail('play must not fetch the offline catalogue'),
    requestPackage: () => assert.fail('play must not open a download prompt'),
    store: { inspect: async () => ({ ready }), pin },
  });
}

test('all modes play without a prepared package, including passive previews and navigation', async () => {
  const access = await fixture();
  for (const mode of ['solo', 'versus', 'team']) {
    const mission = { routeId: 'current', missionId: mode, mode };
    await access.ensureMission(mission, { prompt: false });
    await access.ensureMission(mission, { retain: true });
  }
  await access.ensureClassic('unprepared');
  await access.ensureURL('https://game.test/site/authoring/');
  await access.ensureDestination('https://game.test/site/game/couch/');
});

test('no gameplay entry point requests a package even when a legacy host supplies a prompt callback', async () => {
  const caches = memoryCaches();
  await (
    await caches.open('core')
  ).put(`${availability.scope}offline-content.json`, Response.json(catalogue));
  const requests = [];
  const access = createOfflineDownloadAccess({
    availability,
    caches,
    store: { inspect: async () => ({ ready: false }) },
    fetch: async () => {
      requests.push('catalogue network fetch');
      return Response.json(catalogue);
    },
    requestPackage: async () => requests.push('download popup'),
  });
  for (const retain of [false, true]) {
    const options = { prompt: true, retain };
    await access.ensure('chapter', options);
    await access.ensureClassic('unprepared', options);
    for (const mode of ['solo', 'versus', 'team'])
      await access.ensureMission({ routeId: 'current', missionId: mode, mode }, options);
    await access.ensureURL('https://game.test/site/authoring/studio/', options);
    for (const path of ['game/', 'game/couch/', 'game/couch/relay-rescue.html'])
      await access.ensureDestination(`https://game.test/site/${path}`, options);
  }
  // Assert outside the best-effort helper: an assertion thrown by a callback
  // could otherwise be swallowed as a storage failure.
  assert.deepEqual(requests, []);
});

test('Versus current, shipped, imported and Creator entries need no offline package', async () => {
  const entry = { level: { id: 'versus' } },
    creatorOwner = {},
    pack = { id: 'unprepared' };
  const downloads = await fixture();
  for (const kind of ['current', 'shipped', 'official-import', 'user-import', 'creator']) {
    await ensureVersusEntryPackage(entry, {
      options: { retain: true, signal: new AbortController().signal },
      packageConsent: true,
      creatorOwnerFor: () => (kind === 'creator' ? creatorOwner : null),
      candidateJourney: { owns: () => kind === 'current' },
      authoredRouteId: 'current',
      shippedMaps: kind === 'shipped' ? [entry] : [],
      downloads,
      reader: { presentationOwner: () => ({ pack }) },
      isOfficialPack: () => kind === 'official-import',
    });
  }
});

test('prepared chapters retain exact dependencies without new transfers or dialogs', async () => {
  const pins = [];
  const access = await fixture({ ready: true, pin: async (value) => pins.push(value) });
  await access.ensureMission(
    { routeId: 'current', missionId: 'solo', mode: 'solo' },
    { retain: true },
  );
  assert.equal(pins.length, 1);
  assert.equal(pins[0].edition, availability.scope);
  assert.equal(pins[0].group, 'chapter');
  assert.deepEqual(pins[0].files, [file]);
});

test('denied storage, missing local catalogue and failed retention cannot block play', async () => {
  for (const caches of [
    undefined,
    {
      keys: async () => {
        throw Error('denied');
      },
    },
  ]) {
    const access = createOfflineDownloadAccess({ availability, caches });
    await access.ensure('chapter', { retain: true });
  }
  const access = await fixture({
    ready: true,
    pin: async () => {
      throw Error('quota');
    },
  });
  await access.ensure('chapter', { retain: true });
});

test('stalled optional storage work is bounded and cancellation remains authoritative', async () => {
  const access = createOfflineDownloadAccess({
    availability,
    retentionTimeout: 5,
    caches: { keys: () => new Promise(() => {}) },
  });
  await access.ensure('chapter', { retain: true });
  const controller = new AbortController();
  const pending = access.ensure('chapter', { retain: true, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(access.ensure('chapter', { signal: controller.signal }), {
    name: 'AbortError',
  });
});

for (const cancellation of ['abort', 'deadline']) {
  for (const delayedStage of ['keys', 'open', 'match-hit', 'match-miss']) {
    test(`optional retention stops after ${cancellation} during cache ${delayedStage} and can retry`, async () => {
      const controller = new AbortController();
      let release, entered;
      const started = new Promise((resolve) => (entered = resolve));
      const held = new Promise((resolve) => (release = resolve));
      const calls = { keys: 0, open: 0, match: 0, parse: 0, inspect: 0, pin: 0 };
      let delayed = true;
      const pauseAt = (stage, value) => {
        if (delayed && delayedStage.startsWith(stage)) {
          delayed = false;
          entered();
          return held;
        }
        return Promise.resolve(value);
      };
      const response = {
        ok: true,
        json: async () => {
          calls.parse++;
          return catalogue;
        },
      };
      const cache = {
        match: () => {
          calls.match++;
          return pauseAt('match', response);
        },
      };
      const names = ['first', 'second'];
      const access = createOfflineDownloadAccess({
        availability,
        retentionTimeout: cancellation === 'deadline' ? 5 : 10000,
        caches: {
          keys: () => {
            calls.keys++;
            return pauseAt('keys', names);
          },
          open: () => {
            calls.open++;
            return pauseAt('open', cache);
          },
        },
        store: {
          inspect: async () => {
            calls.inspect++;
            return { ready: true };
          },
          pin: async () => {
            calls.pin++;
          },
        },
      });
      const pending = access.ensure('chapter', { retain: true, signal: controller.signal });
      await started;
      if (cancellation === 'abort') {
        controller.abort();
        await assert.rejects(pending, { name: 'AbortError' });
      } else await pending;
      const atCancellation = { ...calls };
      release(
        delayedStage === 'keys'
          ? names
          : delayedStage === 'open'
            ? cache
            : delayedStage === 'match-hit'
              ? response
              : undefined,
      );
      await new Promise(setImmediate);
      assert.deepEqual(
        calls,
        atCancellation,
        'cancelled work starts no further cache or parse work',
      );
      assert.equal(calls.parse, 0);
      assert.equal(calls.inspect, 0);
      assert.equal(calls.pin, 0);
      await access.ensure('chapter', { retain: true });
      assert.equal(calls.parse, 1, 'fresh retention reads its own catalogue');
      assert.equal(calls.inspect, 1);
      assert.equal(calls.pin, 1, 'fresh verified retention remains available');
    });
  }
}
