import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadRuntimeContentProvider,
  editionStartupAssetIds,
} from '../runtime-content-provider.mjs';
import { companyEntryHref } from '../company-entry.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { PNGImage } from './helpers/png-image.mjs';

test('menu defers reveal-only bytes but retains their full receipt and exact acquisition checks', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const path = 'game/editions/assets/old-picture.png',
    bytes = f.binary.get(path),
    requests = [];
  const fetcher = (url, options) => {
    requests.push(new URL(url, 'http://localhost/game/').pathname);
    return f.fetcher(url, options);
  };
  const load = (presentation = null) =>
    loadRuntimeContentProvider({
      locationRef: {
        href: `http://localhost/game/index.html?edition=sample-public${presentation ? `&presentation=${presentation}` : ''}`,
      },
      documentRef: { documentElement: { dataset: {} } },
      fetcher,
    });
  const current = await load();
  assert.equal(
    requests.includes(`/${path}`),
    false,
    'Opening the menu does not download the reveal.',
  );
  assert.equal(current.authoredPresentationSha256, f.original.authoredPresentationSha256);
  assert.deepEqual(editionStartupAssetIds(current.bootstrap), []);
  const asset = current.route.source.assets[0];
  const acquire = (pin) =>
    acquireCandidatePicture(pin, {
      loadArtwork: (source, options) =>
        loadPreviewArtwork(source, { ...options, fetchAsset: fetcher }),
      ImageClass: PNGImage,
    });
  const picture = await acquire(asset);
  assert.equal(requests.includes(`/${path}`), true);
  assert.equal(picture.image.width, asset.width);
  picture.release();
  f.binary.set(path, Buffer.from(bytes).fill(0));
  assert.equal((await load()).authoredPresentationSha256, current.authoredPresentationSha256);
  await assert.rejects(acquire(asset), /digest differs/);
  f.binary.delete(path);
  await assert.rejects(acquire(asset), /failed to load/);
  // Retained artwork can open recovery UI, but this policy never authorizes
  // replacing a missing old picture with a later one.
  f.replacePicture();
  const retained = await load(f.descriptor.id);
  assert.equal(retained.authoredPresentationSha256, current.authoredPresentationSha256);
  assert.equal(retained.route.source.assets[0].id, 'old-picture');
  await assert.rejects(acquire(retained.route.source.assets[0]), /failed to load/);
});

for (const use of ['brand hero', 'edition root', 'actor body', 'dependency'])
  test(`mission picture reused as ${use} remains an eagerly verified dependency`, async () => {
    const f = await retainedEditionFixture({ originalArtwork: true });
    const picture = f.catalog.assets.find((asset) => asset.id === 'old-picture');
    if (use === 'brand hero') {
      f.catalog.brands[0].assetIds.push(picture.id);
      f.catalog.brands[0].heroAssetId = picture.id;
    } else if (use === 'edition root') f.catalog.editions[0].assetIds = [picture.id];
    else if (use === 'actor body')
      Object.values(f.data.presets.characters)[0].src = `../../${picture.path}`;
    else {
      f.catalog.assets.push({
        ...picture,
        id: 'identity-marker',
        path: 'game/editions/assets/identity-marker.png',
        dependencies: [picture.id],
      });
      f.catalog.brands[0].assetIds.push('identity-marker');
      f.binary.set('game/editions/assets/identity-marker.png', f.binary.get(picture.path));
    }
    const provider = await f.load();
    assert.ok(editionStartupAssetIds(provider.bootstrap).includes(picture.id));
    f.binary.delete(picture.path);
    await assert.rejects(f.load(), /could not be loaded/);
  });

test('deferred artwork still obeys the full budget, publication rules and exact catalog membership', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const snapshot = f.original.bootstrap;
  const changed = (mutate) => {
    const next = structuredClone(snapshot);
    mutate(next);
    return () => editionStartupAssetIds(next);
  };
  assert.throws(
    changed((b) => {
      b.source.assets[0].sha256 = 'f'.repeat(64);
    }),
    /asset closure/,
  );
  assert.throws(
    changed((b) => {
      b.catalog.assets[0].approved = false;
    }),
    /unavailable|approval/,
  );
  assert.throws(
    changed((b) => {
      b.catalog.assets[0].publication = 'restricted';
    }),
    /public|Restricted/,
  );
  assert.throws(
    changed((b) => {
      b.catalog.assets[0].dependencies = ['missing'];
    }),
    /missing|dependency/i,
  );
  assert.throws(
    changed((b) => {
      // Eager bytes alone meet the limit. The deferred picture must still count
      // against the unchanged complete-presentation budget.
      for (const suffix of ['one', 'two']) {
        const id = `large-identity-${suffix}`;
        b.catalog.assets.push({
          ...b.catalog.assets[0],
          id,
          path: `game/editions/assets/${id}.png`,
          bytes: 32 * 1024 * 1024,
        });
        b.catalog.brands[0].assetIds.push(id);
      }
    }),
    /offline budget/,
  );
});

test('ordinary Solo uses its current startup path without any edition fetch', async () => {
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: 'https://example.test/game/index.html' },
    documentRef: { documentElement: { dataset: {} } },
    fetcher: () => {
      throw new Error('unexpected network');
    },
  });
  assert.equal(provider, null);
});
test('edition content injects owned boot data and preserves audience and old saves', async () => {
  const f = await editionProviderFixture();
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: 'http://localhost/game/index.html?edition=sample-public' },
    documentRef: { documentElement: { dataset: {} } },
    fetcher: f.fetcher,
  });
  assert.equal(provider.route.source.policyId, 'journey-trail-impact-v3');
  assert.equal(provider.route.source.difficultyCatalogId, 'journey-difficulty-v2');
  assert.equal(provider.route.sessionKey, `${provider.legacySessionKey}.solo-v2`);
  provider.boot[1].themes[0].name = 'owned host copy';
  assert.notEqual(provider.bootstrap.boot.themes.themes[0].name, 'owned host copy');
  assert.equal(
    new URL(provider.href({ mission: 'first-return' })).searchParams.get('edition'),
    'sample-public',
  );
  assert.ok(f.requests.every((path) => f.files.has(path)));
  assert.equal(provider.context('DEV').editionId, 'sample-public');
});
test('compiled audience cannot be escaped by a query before network or activation', async () => {
  await assert.rejects(
    loadRuntimeContentProvider({
      locationRef: { href: 'https://example.test/game/index.html?edition=foreign' },
      documentRef: { documentElement: { dataset: { editionId: 'sample-public' } } },
      fetcher: () => {
        throw new Error('unexpected network');
      },
    }),
    /another audience/,
  );
});
test('presentation receipt is origin-independent and changes with selected palette or actor recipes', async () => {
  const f = await editionProviderFixture();
  const load = (href, dataset = {}) =>
    loadRuntimeContentProvider({
      locationRef: { href },
      documentRef: { documentElement: { dataset } },
      fetcher: f.fetcher,
    });
  const original = await load('http://localhost/game/index.html?edition=sample-public');
  const standalone = await load('https://example.test/game/index.html', {
    editionId: 'sample-public',
  });
  assert.equal(standalone.authoredPresentationSha256, original.authoredPresentationSha256);
  f.data.themes.themes[0].palette.accent = '#ff00ff';
  const changed = await load('http://localhost/game/index.html?edition=sample-public');
  assert.notEqual(changed.authoredPresentationSha256, original.authoredPresentationSha256);
  f.data.presets.characters[f.data.themes.themes[0].player].bodyMotion.radiansPerSecond = 1.5;
  const recipe = await load('http://localhost/game/index.html?edition=sample-public');
  assert.notEqual(recipe.authoredPresentationSha256, changed.authoredPresentationSha256);
});
test('generic company entry resolves the registry default rather than a company name in code', async () => {
  const f = await editionProviderFixture();
  const href = companyEntryHref('https://example.test/game/company.html');
  assert.equal(new URL(href).searchParams.get('company'), '1');
  assert.equal(new URL(href).searchParams.has('edition'), false);
  const provider = await loadRuntimeContentProvider({
    locationRef: { href },
    documentRef: { documentElement: { dataset: {} } },
    fetcher: f.fetcher,
  });
  assert.equal(provider.editionId, 'sample-public');
});
test('compatibility entry retains mission, input preferences and fragment on the common document', () => {
  const url = new URL(
    companyEntryHref(
      'https://example.test/game/company.html?edition=sample-public&mission=last&steering=smooth#picture',
    ),
  );
  assert.equal(url.pathname, '/game/index.html');
  assert.equal(url.searchParams.get('mission'), 'last');
  assert.equal(url.searchParams.get('steering'), 'smooth');
  assert.equal(url.hash, '#picture');
  assert.equal(
    new URL(companyEntryHref(url.href, 'locked-public')).searchParams.get('edition'),
    'locked-public',
  );
});
