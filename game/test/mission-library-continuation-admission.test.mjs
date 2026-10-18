import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createSpatialNextEditionSources } from '../mission-library/spatial-next-editions.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { readPublishedSnapshot } from '../content-design/route-snapshot.mjs';
import { createSoloRouteHost } from '../content-design/solo-route-host.mjs';

const retired = new DOMException('Retired catalogue test owner', 'AbortError');
const bytes = new TextEncoder().encode('{deliberately invalid JSON');
const descriptor = {
  path: 'runtime/held-catalogue.json',
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};

test('retired authored import stops before route construction, and a fresh request retains exact definition', async () => {
  let current = true;
  const pending = loadAuthoredJourneyRoute('opening', {
    assertCurrent() {
      if (!current) throw retired;
    },
  });
  current = false;
  await assert.rejects(pending, (error) => error === retired);
  const first = await loadAuthoredJourneyRoute('opening');
  const second = await loadAuthoredJourneyRoute('opening', { assertCurrent() {} });
  assert.deepEqual(second, first);
  assert.notEqual(second, first);
});

test('retirement after published fetch cancels its actual body before allocating/reading/parsing it', async () => {
  let current = true,
    cancelled = false,
    readers = 0;
  await assert.rejects(
    readPublishedSnapshot(descriptor, {
      assertCurrent() {
        if (!current) throw retired;
      },
      fetchAsset: async () => {
        current = false;
        return {
          ok: true,
          redirected: false,
          body: {
            getReader() {
              readers++;
              throw new Error('Must not acquire reader');
            },
            async cancel() {
              cancelled = true;
            },
          },
        };
      },
    }),
    (error) => error === retired,
  );
  assert.equal(cancelled, true);
  assert.equal(readers, 0);
});

test('retirement on a published read releases reader ownership and does not decode invalid JSON', async () => {
  let current = true,
    cancelled = 0,
    unlocked = 0;
  await assert.rejects(
    readPublishedSnapshot(descriptor, {
      assertCurrent() {
        if (!current) throw retired;
      },
      fetchAsset: async () => ({
        ok: true,
        redirected: false,
        body: {
          getReader() {
            return {
              async read() {
                current = false;
                return { done: false, value: bytes };
              },
              async cancel() {
                cancelled++;
              },
              releaseLock() {
                unlocked++;
              },
            };
          },
        },
      }),
    }),
    (error) => error === retired,
  );
  assert.equal(cancelled, 1);
  assert.equal(unlocked, 1);
});

test('retirement during integrity verification is checked before synchronous decode', async (t) => {
  let current = true;
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    const result = await digest(...args);
    current = false;
    return result;
  });
  await assert.rejects(
    readPublishedSnapshot(descriptor, {
      assertCurrent() {
        if (!current) throw retired;
      },
      fetchAsset: async () => new Response(bytes),
    }),
    (error) => error === retired,
  );
});

test('route host rejects retired construction before touching authored source', async () => {
  let sourceReads = 0;
  await assert.rejects(
    createSoloRouteHost(
      {
        get source() {
          sourceReads++;
          throw new Error('No source authority');
        },
      },
      {
        assertCurrent() {
          throw retired;
        },
      },
    ),
    (error) => error === retired,
  );
  assert.equal(sourceReads, 0);
});

test('a retired prior-edition import never continues the selector compilation loop', async () => {
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  let current = true;
  const pending = createSpatialNextEditionSources({
    activeRouteId: 'whole-spatial-v10',
    originalThemes: themes,
    launch() {},
    assertCurrent() {
      if (!current) throw retired;
    },
  });
  current = false;
  await assert.rejects(pending, (error) => error === retired);
});
