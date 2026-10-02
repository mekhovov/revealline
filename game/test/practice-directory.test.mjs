import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  validatePracticeDescription,
  validatePracticeDetails,
  loadPracticeDetails,
} from '../optional-practice-details.mjs';
import { mountOptionalPracticePanel } from '../ui/optional-practice-panel.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { installOptionalLauncher } from '../../optional-practice/launcher-template.mjs';
import {
  optionalInstallationKey,
  validateOptionalInstallationReference,
  inspectOptionalOffline,
} from '../../optional-practice/install-context.mjs';
import { frozenOptionalPackageOverlay } from '../../publishing/optional-package-promotion.mjs';
import { verifyPracticeSite } from '../../scripts/verify-practice-site.mjs';
import { mountPracticeNavigation } from '../../optional-practice/navigation.mjs';

const id = 'civilian-flight',
  indexURL = 'https://example.test/practice/index.json';
const entry = { id, name: 'Gym', href: `${id}/app/`, version: 'v1.2.3', revision: 'abc' };
const catalog = { format: 'revealline-optional-package-launchers.v1', packages: [entry] };
const description = JSON.parse(
  await readFile(
    new URL('../../optional-practice/civilian-flight/package-info.json', import.meta.url),
  ),
);
const detail = {
  id,
  revision: entry.revision,
  description,
  preview: `${id}/releases/v1.2.3/site/optional-practice/${id}/preview.png`,
  guide: `${id}/releases/v1.2.3/site/optional-practice/${id}/guide.html`,
  downloadBytes: 1000,
  offlineBytes: 2000,
};
const metadata = { format: 'revealline-practice-details.v1', packages: [detail] };

test('standard-controller menu edges move visible focus and activate once, never repeat a held confirm', () => {
  const doc = new Document();
  const first = doc.createElement('button'),
    second = doc.createElement('button');
  for (const button of [first, second]) {
    button.getClientRects = () => [{}];
    button.scrollIntoView = () => {};
    doc.body.append(button);
  }
  let clicks = 0,
    tick;
  second.onclick = () => clicks++;
  const pad = {
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  };
  const win = {
    setTimeout: (callback) => {
      tick = callback;
      return 1;
    },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const dispose = mountPracticeNavigation({
    document: doc,
    window: win,
    navigator: { getGamepads: () => [pad] },
  });
  const press = (index) => {
    pad.buttons[index].pressed = true;
    tick();
    pad.buttons[index].pressed = false;
    tick();
  };
  press(13);
  assert.equal(doc.activeElement, first);
  press(13);
  assert.equal(doc.activeElement, second);
  assert.equal(second.hasAttribute('data-practice-focus'), true);
  pad.buttons[0].pressed = true;
  tick();
  tick();
  assert.equal(clicks, 1);
  dispose();
  assert.equal(second.hasAttribute('data-practice-focus'), false);
});

test('bounded metadata binds to the authoritative catalogue and rejects executable redirects', async () => {
  assert.equal(validatePracticeDetails(metadata, [entry], indexURL).size, 1);
  assert.equal(
    validatePracticeDetails(metadata, [{ ...entry, revision: 'older' }], indexURL).size,
    0,
  );
  for (const change of [
    { preview: 'https://evil.test/image.png' },
    { guide: '../other/' },
    { offlineBytes: Infinity },
    { downloadBytes: -1 },
  ])
    assert.throws(() =>
      validatePracticeDetails(
        { ...metadata, packages: [{ ...detail, ...change }] },
        [entry],
        indexURL,
      ),
    );
  const bad = structuredClone(description);
  delete bad.copy.uk.inputs;
  assert.throws(() => validatePracticeDescription(bad, id));
  assert.throws(() =>
    validatePracticeDetails({ ...metadata, packages: [detail, detail] }, [entry], indexURL),
  );
  await assert.rejects(
    loadPracticeDetails(indexURL, [entry], {
      fetcher: async () => new Response(' '.repeat(98305)),
    }),
    /too large/,
  );
});

test('last-known catalogue stays dated on request failure and bad details keep basic v1 cards', async (t) => {
  const values = new Map(),
    doc = new Document(),
    container = doc.createElement('nav');
  doc.body.append(container);
  let failed = false,
    detailsBad = false;
  const requests = [];
  const panel = mountOptionalPracticePanel({
    document: doc,
    container,
    href: 'https://example.test/game/',
    pause() {},
    storage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) },
    fetcher: async (url) => {
      requests.push(url);
      if (failed) throw new Error('offline');
      return new Response(
        JSON.stringify(url.endsWith('details.json') ? (detailsBad ? {} : metadata) : catalog),
      );
    },
  });
  t.after(() => panel.dispose());
  panel.open();
  await waitFor(() => !doc.getElementById('optional-practice-refresh').disabled);
  assert.equal(requests.length, 2);
  assert.equal(doc.querySelectorAll('.optional-practice-packages img').length, 1);
  const saved = [...values.values()][0];
  failed = true;
  doc.getElementById('optional-practice-refresh').click();
  await waitFor(() => !doc.getElementById('optional-practice-refresh').disabled);
  assert.match(doc.querySelector('[role="status"]').textContent, /last checked/);
  assert.equal([...values.values()][0], saved);
  assert.equal(doc.querySelectorAll('.optional-practice-packages li').length, 1);
  failed = false;
  detailsBad = true;
  doc.getElementById('optional-practice-refresh').click();
  await waitFor(() => !doc.getElementById('optional-practice-refresh').disabled);
  assert.equal(doc.querySelectorAll('.optional-practice-packages li').length, 1);
  assert.equal(doc.querySelectorAll('.optional-practice-packages img').length, 0);
});

test('play intent keeps only a validated locale and destination, never forwards arbitrary query routes', async () => {
  for (const action of ['play', 'install', 'https://evil.test']) {
    const elements = new Map();
    let destination;
    const root = '/practice/civilian-flight/';
    const context = {
      URL,
      TextDecoder,
      Uint8Array,
      AbortController,
      setTimeout,
      clearTimeout,
      document: {
        documentElement: {},
        getElementById(id) {
          if (!elements.has(id)) elements.set(id, { hidden: true });
          return elements.get(id);
        },
      },
      navigator: { language: 'en' },
      localStorage: { getItem: () => null },
      location: {
        href: `https://example.test${root}app/?action=${encodeURIComponent(action)}&lang=uk&url=https://evil.test`,
        assign: (url) => {
          destination = url;
        },
      },
      fetch: async () =>
        new Response(
          JSON.stringify({
            id,
            version: 'v1.2.3',
            entry: `optional-practice/${id}/index.html`,
            scope: '../releases/v1.2.3/site/',
          }),
        ),
      optionalInstallationKey,
      validateOptionalInstallationReference,
    };
    await runInNewContext(
      `(${installOptionalLauncher.toString()})(${JSON.stringify({ packageId: id, root })}, { optionalInstallationKey, validateOptionalInstallationReference })`,
      context,
    );
    if (action === 'play')
      assert.equal(
        destination,
        'https://example.test/practice/civilian-flight/releases/v1.2.3/site/optional-practice/civilian-flight/index.html?lang=uk',
      );
    else assert.equal(destination, undefined);
  }
});

test('an installation without an exact owning worker is not ready offline', async () => {
  const base =
    'https://example.test/practice/civilian-flight/releases/v1.2.3/site/optional-practice/civilian-flight/';
  for (const registration of [
    null,
    { scope: 'https://example.test/', active: {} },
    { scope: base, active: { scriptURL: 'https://example.test/other-worker.js' } },
  ]) {
    assert.equal(
      await inspectOptionalOffline(base, {
        navigator: { serviceWorker: { getRegistration: async () => registration } },
      }),
      false,
    );
  }
});

test('an intentionally empty publication emits a catalogue, and a missing public catalogue fails verification', async () => {
  const output = await frozenOptionalPackageOverlay({
    format: 'revealline-optional-package-publication.v1',
    releases: [],
  });
  assert.deepEqual(JSON.parse(output.get('practice/index.json')).packages, []);
  assert(output.has('practice/directory.mjs'));
  assert.match(output.get('practice/index.html').toString(), /No reviewed packages/);
  await assert.rejects(
    verifyPracticeSite({
      baseURL: 'https://example.test/',
      expectedIds: [],
      fetcher: async () => new Response('', { status: 404 }),
    }),
    /unavailable/,
  );
  const result = await verifyPracticeSite({
    baseURL: 'https://example.test/',
    expectedIds: [],
    fetcher: async (url) => new Response(output.get(new URL(url).pathname.slice(1))),
  });
  assert.deepEqual(result.checked, []);
});
