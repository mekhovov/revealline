import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { validateCompletionRewards } from '../rewards/model.mjs';
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
import { createHash } from 'node:crypto';
import { captureEditionPresentation } from '../editions/retained-presentation.mjs';
import { editionDepartureDestinationAllowed } from '../editions/departure-destination.mjs';

async function friendlyProviderFixture(prefix = '/') {
  const fixture = await editionProviderFixture();
  const catalog = structuredClone(fixture.catalog);
  catalog.brands[0].id = 'coupa';
  catalog.campaigns[0].brandId = 'coupa';
  catalog.editions[0].brandId = 'coupa';
  catalog.editions[0].id = 'coupa-all';
  catalog.editions.push({ ...catalog.editions[0], id: 'coupa-culture', name: 'Culture' });
  catalog.defaultEditionId = 'coupa-all';
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    fixture.files.set(path, catalog);
  const base = `https://example.test${prefix}`;
  const requests = [];
  const load = (suffix, compiled = false) =>
    loadRuntimeContentProvider({
      locationRef: { href: `${base}${suffix}` },
      documentRef: { documentElement: { dataset: compiled ? { editionId: 'coupa-all' } : {} } },
      fetcher(value) {
        const url = new URL(value);
        requests.push(url.href);
        assert.ok(url.pathname.startsWith(prefix));
        return fixture.fetcher(`https://example.test/${url.pathname.slice(prefix.length)}`);
      },
    });
  return { ...fixture, catalog, base, requests, load };
}

test('friendly community host resolves shared files and preserves canonical save and artwork identity', async () => {
  for (const prefix of ['/', '/revealline/', '/revealline/releases/v0.142.3/site/']) {
    const f = await friendlyProviderFixture(prefix);
    const canonical = await f.load('game/index.html?edition=coupa-all');
    for (const suffix of ['', '/', '/index.html']) {
      const friendly = await f.load(`game/communities/coupa${suffix}?mission=first#details`);
      assert.equal(friendly.editionId, canonical.editionId);
      assert.deepEqual(friendly.context('0.142.3'), canonical.context('0.142.3'));
      assert.equal(friendly.route.profileKey, canonical.route.profileKey);
      assert.equal(friendly.route.sessionKey, canonical.route.sessionKey);
      assert.equal(friendly.authoredPresentationSha256, canonical.authoredPresentationSha256);
      assert.equal(friendly.rootURL, f.base);
      assert.equal(friendly.href(), `${f.base}game/communities/coupa/`);
      assert.equal(
        friendly.href({ edition: 'coupa-culture', mission: 'first' }),
        `${f.base}game/communities/coupa/?edition=coupa-culture&mission=first`,
      );
      assert.throws(() => friendly.href({ edition: 'droneaid' }), /another company/);
    }
    assert.ok(f.requests.every((request) => !request.includes('/communities/')));
    const narrower = await f.load('game/communities/coupa/?edition=coupa-culture');
    assert.equal(narrower.editionId, 'coupa-culture');
    assert.equal(narrower.href({ edition: 'coupa-all' }), `${f.base}game/communities/coupa/`);
    assert.equal(canonical.href(), `${f.base}game/communities/coupa/`);
    const installed = await f.load('game/index.html', true);
    assert.equal(installed.href(), `${f.base}game/index.html?edition=coupa-all`);
  }
});

test('friendly path rejects foreign and duplicate selectors before fetching or opening another company', async () => {
  const f = await friendlyProviderFixture();
  for (const query of ['edition=droneaid', 'edition=coupa-all&edition=coupa-culture'])
    await assert.rejects(f.load(`game/communities/coupa/?${query}`), /community|selector/);
  assert.equal(f.requests.length, 0);
  f.catalog.brands[0].id = 'another-company';
  f.catalog.campaigns[0].brandId = 'another-company';
  for (const edition of f.catalog.editions) edition.brandId = 'another-company';
  await assert.rejects(f.load('game/communities/coupa/'), /another company/);
});

test('friendly retained artwork navigation keeps its exact original and departure validation', async () => {
  const f = await friendlyProviderFixture('/revealline/releases/v0.142.3/site/');
  const original = await f.load('game/index.html?edition=coupa-all');
  const snapshot = await captureEditionPresentation(original.bootstrap);
  const bytes = Buffer.from(JSON.stringify(snapshot));
  const descriptor = {
    id: snapshot.authoredPresentationSha256,
    path: `game/editions/retained/${snapshot.authoredPresentationSha256}.json`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  f.files.set(descriptor.path, snapshot);
  f.catalog.editions[0].presentationHistory = [descriptor];
  f.data.themes.themes[0].palette.accent = '#ff00ff';
  const retained = await f.load(`game/communities/coupa/?presentation=${descriptor.id}`);
  assert.equal(retained.authoredPresentationSha256, original.authoredPresentationSha256);
  assert.equal(retained.href(), `${f.base}game/communities/coupa/?presentation=${descriptor.id}`);
  assert.equal(retained.href({ presentation: null }), `${f.base}game/communities/coupa/`);
  const ticket = { kind: 'catalogue', destinationEditionId: 'coupa-culture' };
  const target = retained.href({ edition: 'coupa-culture', presentation: null });
  assert.equal(editionDepartureDestinationAllowed(retained, ticket, target, retained.href()), true);
  for (const foreign of [
    target.replace('/coupa/', '/droneaid/'),
    target.replace('coupa-culture', 'droneaid-community'),
    target.replace('example.test', 'foreign.test'),
  ])
    assert.equal(
      editionDepartureDestinationAllowed(retained, ticket, foreign, retained.href()),
      false,
    );
});

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
test('artwork URLs stay inside the selected company receipt while retained originals remain available', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const originalAsset = f.catalog.assets.find((asset) => asset.id === 'old-picture');
  const foreign = {
    ...originalAsset,
    id: 'another-company-logo',
    path: 'game/editions/assets/another-company-logo.png',
  };
  f.catalog.assets.push(foreign);
  f.catalog.brands.push({
    ...f.catalog.brands[0],
    id: 'another-company',
    name: 'Another company',
    logoAssetId: foreign.id,
    assetIds: [foreign.id],
  });
  const current = await f.load();
  assert.ok(current.catalog.assets.some((asset) => asset.id === foreign.id));
  assert.ok(current.assetURL(originalAsset.id).endsWith(originalAsset.path));
  assert.throws(() => current.assetURL(foreign.id), /does not contain/);
  assert.equal(current.authoredPresentationSha256, f.original.authoredPresentationSha256);
  f.replacePicture();
  const retained = await f.load(f.descriptor.id);
  assert.ok(retained.assetURL(originalAsset.id).endsWith(originalAsset.path));
  assert.throws(() => retained.assetURL(foreign.id), /does not contain/);
  assert.equal(retained.authoredPresentationSha256, f.original.authoredPresentationSha256);
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

test('each runtime source load owns an immutable reward catalogue without freezing later authoring', async () => {
  const f = await editionProviderFixture();
  const catalog = structuredClone(f.catalog);
  const campaign = catalog.campaigns[0];
  campaign.rewardPath = 'game/content/sample/rewards.json';
  const mission = createRewardMissionBindings(f.source)[0];
  const locales = (value) => ({ en: structuredClone(value), uk: structuredClone(value) });
  const rewards = [
    {
      format: 'revealline-completion-reward.v1',
      id: 'first-discovery',
      revision: '1',
      brandId: catalog.brands[0].id,
      campaignId: campaign.id,
      scope: { kind: 'mission', id: mission.missionId },
      locales: locales({ title: 'Discovery', teaser: 'A useful explanation' }),
      requirements: {
        missions: [{ missionId: mission.missionId, bindings: mission.bindings }],
        learning: [],
        mastery: [],
      },
      payloads: [
        {
          id: 'knowledge',
          type: 'knowledge',
          locales: locales({ title: 'Discovery', paragraphs: ['The first explanation.'] }),
        },
      ],
    },
  ];
  f.files.set('game/editions/catalog.json', catalog);
  f.files.set('edition-catalog.json', catalog);
  f.files.set(campaign.rewardPath, rewards);
  const load = () =>
    loadRuntimeContentProvider({
      locationRef: { href: 'http://localhost/game/index.html?edition=sample-public' },
      documentRef: { documentElement: { dataset: {} } },
      fetcher: f.fetcher,
    });
  const first = await load();
  assert.equal(validateCompletionRewards(first.rewards), first.rewards);
  assert(Object.isFrozen(first.rewards[0].payloads[0].locales.en.paragraphs));
  rewards[0].revision = '2';
  rewards[0].payloads[0].locales.en.paragraphs[0] = 'The second explanation.';
  const second = await load();
  assert.notEqual(first.rewards, second.rewards);
  assert.equal(first.rewards[0].revision, '1');
  assert.equal(second.rewards[0].revision, '2');
  rewards[0].payloads[0].type = 'unapproved';
  await assert.rejects(load(), /Unknown reward payload/);
});
