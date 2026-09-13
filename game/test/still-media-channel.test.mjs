import test from 'node:test';
import assert from 'node:assert/strict';
import { readStillWorkshopChannel } from '../ui/still-media-host.mjs';
import {
  createStillAuthoringCatalog,
  stillAuthoringKeys,
  STILL_AUTHORING_KEYS,
} from '../ui/still-media-catalog.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { workshop } from './helpers/still-workshop.mjs';

test('source default keys stay exact and release versions preserve the game’s leading-v channel spelling', () => {
  assert.deepEqual(stillAuthoringKeys(), STILL_AUTHORING_KEYS);
  assert.deepEqual(STILL_AUTHORING_KEYS, {
    writer: 'revealline.library.dev.v1.writer',
    lock: 'revealline.library.dev.v1.backup-lock',
    journal: 'revealline.library.dev.v1.backup-journal',
    packs: 'revealline.packs.dev.v1',
  });
  for (const channel of ['release-v0.32.0', 'release-0.32.0']) {
    const keys = stillAuthoringKeys(channel);
    assert.equal(keys.packs, `revealline.packs.${channel}.v1`);
    assert.equal(keys.writer, `revealline.library.${channel}.v1.writer`);
    assert.equal(keys.lock, `revealline.library.${channel}.v1.backup-lock`);
    assert.equal(keys.journal, `revealline.library.${channel}.v1.backup-journal`);
  }
  for (const channel of [
    '',
    null,
    {},
    '../dev',
    'release-01.2.3',
    'release-v0.32.0/other',
    'release-v0.32.0-beta',
    'release-v100000.0.0',
  ]) {
    assert.throws(() => stillAuthoringKeys(channel), /channel/);
    assert.throws(() => createStillAuthoringCatalog({ channel }), /channel/);
  }
});

test('workshop channel comes from module-relative build-info and only an actual 404 selects dev', async () => {
  const expected = new URL(
    '../build-info.json',
    new URL('../ui/still-media-host.mjs', import.meta.url),
  ).href;
  for (const version of ['v0.32.0', '0.32.0']) {
    let calls = 0;
    assert.equal(
      await readStillWorkshopChannel({
        fetchImpl: async (url) => {
          ++calls;
          assert.equal(url.href, expected);
          return { ok: true, json: async () => ({ version, buildId: 'fixture' }) };
        },
      }),
      `release-${version}`,
    );
    assert.equal(calls, 1);
  }
  assert.equal(
    await readStillWorkshopChannel({
      fetchImpl: async () => ({
        status: 404,
        json() {
          throw Error('404 body must not be parsed');
        },
      }),
    }),
    'dev',
  );
  for (const response of [
    { ok: false, status: 500 },
    { ok: false, status: 0 },
    { ok: true, json: async () => null },
    { ok: true, json: async () => ({ version: 'garbage' }) },
    { ok: true, json: async () => ({}) },
    {
      ok: true,
      json: async () => {
        throw Error('invalid JSON');
      },
    },
  ]) {
    await assert.rejects(readStillWorkshopChannel({ fetchImpl: async () => response }));
  }
  await assert.rejects(
    readStillWorkshopChannel({
      fetchImpl: async () => {
        throw Error('Network unavailable');
      },
    }),
    /Network unavailable/,
  );
});

test('cancelled build-info fetch or delayed JSON cannot silently choose any channel', async () => {
  const early = new AbortController();
  early.abort();
  let calls = 0;
  await assert.rejects(
    readStillWorkshopChannel({
      signal: early.signal,
      fetchImpl: async () => {
        ++calls;
        return { status: 404 };
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
  for (const afterJSON of [false, true]) {
    const controller = new AbortController(),
      gate = deferred(),
      entered = deferred();
    const pending = readStillWorkshopChannel({
      signal: controller.signal,
      fetchImpl: async () => {
        if (!afterJSON) {
          entered.resolve();
          await gate.promise;
          return { status: 404 };
        }
        return {
          ok: true,
          json: async () => {
            entered.resolve();
            await gate.promise;
            return { version: '0.32.0' };
          },
        };
      },
    });
    await entered.promise;
    controller.abort();
    gate.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
  }
});

for (const explicit of [false, true])
  test(`actual host uses ${explicit ? 'configured' : 'build-derived'} release channel for all catalog locks and rows`, async (t) => {
    const channel = explicit ? 'release-0.32.0' : 'release-v0.32.0';
    const h = await workshop(t, { channel: 'release-v0.32.0', host: explicit ? { channel } : {} });
    h.rows.set(STILL_AUTHORING_KEYS.packs, 'invalid foreign dev data');
    await h.open();
    const keys = stillAuthoringKeys(channel);
    assert.deepEqual(
      new Set(h.reads),
      new Set([
        keys.lock,
        keys.journal,
        keys.packs,
        `revealline.library.${channel}.v1.external-chapter-index.v1`,
        `revealline.library.${channel}.v1.external-chapter-journal.v1`,
      ]),
    );
    assert.deepEqual(new Set(h.locks), new Set([keys.writer, keys.lock]));
    assert.match(h.hostNode('status').textContent, new RegExp(channel.replaceAll('.', '\\.')));
    await h.upload();
    assert.equal((await h.store().read()).document.library.assets.length, 1);
    assert.equal(
      h.reads.some((key) => key.includes('.dev.')),
      false,
    );
  });

test('failed build-info and unsupported source channel stop before creating a media manager', async (t) => {
  for (const readBase of [
    async () => {
      await readStillWorkshopChannel({ fetchImpl: async () => ({ ok: false, status: 503 }) });
    },
    async () => ({ channel: '../../dev' }),
  ]) {
    const h = await workshop(t, { host: { readBase } });
    assert.equal(await h.host.open(), false);
    assert.equal(h.managers.length, 0);
    assert.equal(h.memory.openCount, 0);
    assert.match(h.hostNode('status').textContent, /channel|build information/i);
  }
});
