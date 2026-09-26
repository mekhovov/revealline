import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { companyEntryHref } from '../company-entry.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';

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
