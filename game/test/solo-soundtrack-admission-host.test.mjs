import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { SOUNDTRACK_CATALOGUE } from '../content/soundtrack-catalogue.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const microtasks = () => new Promise((resolve) => setImmediate(resolve));

for (const retire of [false, true])
  test(`late official-music lookup cannot create the soundtrack panel during Solo gameplay${retire ? ' or after teardown' : ''}`, async (t) => {
    const hashes = new Set(SOUNDTRACK_CATALOGUE.tracks.map((track) => track.asset.sha256));
    const observed = new Set();
    let releaseLookup;
    const page = await soloPage(t, {
      search: '?journey=opening',
      audio: {},
      pictures: { Image: PNGImage },
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: async (path) =>
        String(path).includes('/content-design/assets/')
          ? new Response(await readFile(path))
          : undefined,
      browserSetup({ globals }) {
        const cache = {
          async match(url) {
            const hash = String(url).split('/').at(-1);
            if (!hashes.has(hash)) return undefined;
            observed.add(hash);
            if (!releaseLookup)
              await new Promise((resolve) => {
                releaseLookup = resolve;
              });
            return undefined;
          },
          keys: async () => [],
        };
        globals.caches = {
          open: async () => cache,
          keys: async () => [],
          match: async () => undefined,
        };
      },
    });
    await settle(
      () => typeof releaseLookup === 'function',
      'The official music lookup must be waiting',
    );
    assert.equal(page.$('soundtrack-dialog'), null);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Start cannot wait for optional music UI',
      { timeoutMs: 20000 },
    );
    page.frame(0);
    const before = authoritativeCheckpoint(page.rendered.run);
    releaseLookup();
    await settle(() => observed.size === hashes.size, 'All official music metadata lookups finish');
    await microtasks();
    assert.equal(
      page.$('soundtrack-dialog'),
      null,
      'Late media lookup cannot build the panel while playing',
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    if (retire) {
      page.win.emit('pagehide', { persisted: false });
      await microtasks();
      assert.equal(page.$('soundtrack-dialog'), null);
      assert.deepEqual(page.errors, []);
      return;
    }
    page.$('pause-button').click();
    await settle(
      () => !!page.$('soundtrack-dialog') && !page.$('soundtrack-open').disabled,
      'Pause admits the queued player and panel creation',
      { timeoutMs: 20000 },
    );
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    assert.deepEqual(page.errors, []);
  });
