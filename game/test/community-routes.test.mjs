import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  COMMUNITY_ROUTES,
  communityRouteFromURL,
  communityEntryURL,
  communityHref,
  gameDocumentURL,
} from '../community-routes.mjs';
import { editionIdentityId } from '../edition-context.mjs';
import { mountEditionNavigation } from '../ui/edition-navigation.mjs';

const roots = [
  'http://localhost:8768/',
  'https://owner.github.io/revealline/',
  'https://owner.github.io/revealline/releases/v0.142.3/site/',
  'file:///downloaded-game/',
];

test('friendly community manifest covers every public brand and edition without merging identities', async () => {
  const catalog = JSON.parse(await readFile(new URL('../editions/catalog.json', import.meta.url)));
  const publicBrands = catalog.brands.filter((brand) => brand.publication === 'public');
  assert.deepEqual(
    COMMUNITY_ROUTES.map((route) => route.brandId).sort(),
    publicBrands.map((brand) => brand.id).sort(),
  );
  for (const route of COMMUNITY_ROUTES) {
    assert.ok(Object.isFrozen(route));
    assert.ok(Object.isFrozen(route.editionIds));
    assert.ok(route.editionIds.includes(route.editionId));
    assert.deepEqual(
      [...route.editionIds].sort(),
      catalog.editions
        .filter((edition) => edition.publication === 'public' && edition.brandId === route.brandId)
        .map((edition) => edition.id)
        .sort(),
    );
  }
  assert.equal(COMMUNITY_ROUTES.find((route) => route.slug === 'droneaid').brandId, 'droneaid-nl');
  assert.equal(
    COMMUNITY_ROUTES.find((route) => route.slug === 'droneaid-community').brandId,
    'droneaid',
  );
});

test('friendly routes resolve slash, index and slashless entries within local and frozen roots', () => {
  for (const root of roots)
    for (const route of COMMUNITY_ROUTES)
      for (const suffix of ['', '/', '/index.html']) {
        const href = `${root}game/communities/${route.slug}${suffix}?mission=first#picture`;
        const resolved = communityRouteFromURL(href);
        assert.equal(resolved.editionId, route.editionId);
        assert.equal(resolved.pathname, new URL(`${root}game/communities/${route.slug}/`).pathname);
        assert.equal(gameDocumentURL(href).href, `${root}game/index.html?mission=first#picture`);
        const entry = communityEntryURL(href);
        assert.equal(entry.pathname, new URL(`${root}game/index.html`).pathname);
        assert.equal(editionIdentityId(entry.searchParams.get('edition')), route.editionId);
        assert.equal(entry.searchParams.get('mission'), 'first');
        assert.equal(entry.hash, '#picture');
      }
});

test('friendly entry preserves own campaign, controls and fragment but refuses foreign or ambiguous editions', () => {
  for (const route of COMMUNITY_ROUTES)
    for (const edition of route.editionIds) {
      const entry = communityEntryURL(
        `https://example.test/game/communities/${route.slug}/?edition=${edition}&campaign=chosen&mission=first&steering=smooth#details`,
      );
      assert.equal(editionIdentityId(entry.searchParams.get('edition')), edition);
      assert.equal(entry.searchParams.get('campaign'), 'chosen');
      assert.equal(entry.searchParams.get('steering'), 'smooth');
      assert.equal(entry.hash, '#details');
    }
  const coupa = 'https://example.test/game/communities/coupa/';
  for (const query of [
    'edition=droneaid',
    'edition=droneaid-community',
    'edition=coupa-forged',
    'edition=',
    'edition=coupa-all&edition=coupa-culture',
  ])
    assert.throws(() => communityEntryURL(`${coupa}?${query}`));
  assert.throws(() => communityRouteFromURL('https://example.test/game/communities/unknown/'));
  assert.equal(communityRouteFromURL('https://example.test/game/communities/'), null);
  assert.equal(
    communityRouteFromURL('https://example.test/game/index.html?edition=coupa-all'),
    null,
  );
});

test('share URLs omit aggregate query, retain narrower edition identity and never change the release root', () => {
  for (const root of roots)
    for (const route of COMMUNITY_ROUTES)
      for (const editionId of route.editionIds) {
        const url = communityHref(`${root}game/index.html?edition=old#old`, {
          brandId: route.brandId,
          editionId,
        });
        assert.equal(url.pathname, new URL(`${root}game/communities/${route.slug}/`).pathname);
        assert.equal(url.hash, '');
        assert.equal(url.searchParams.has('edition'), editionId !== route.editionId);
        assert.equal(
          editionIdentityId(communityEntryURL(url).searchParams.get('edition')),
          editionId,
        );
      }
  assert.equal(
    communityHref('https://example.test/game/', { brandId: 'custom', editionId: 'custom-public' }),
    null,
  );
  assert.throws(() =>
    communityHref('https://example.test/game/', {
      brandId: 'coupa',
      editionId: 'droneaid-community',
    }),
  );
});

test('friendly company navigation keeps owned links and tool parameters in the shared release root', () => {
  const root = 'https://example.test/revealline/releases/v0.142.3/site/';
  const address = `${root}game/communities/coupa/`;
  for (const absolute of [false, true]) {
    const paths = [
      './?edition=droneaid&presentation=foreign&mission=first#details',
      'controller-lab/',
      'replay-theater/',
      'downloads.html',
      'couch/',
      '../authoring/motion-lab/',
    ];
    const links = paths.map((path) => {
      const href = absolute ? new URL(path, `${root}game/index.html`).href : path;
      return { href, textContent: 'Tool', getAttribute: (name) => (name === 'href' ? href : null) };
    });
    const provider = {
      editionId: 'coupa-all',
      rootURL: root,
      retainedPresentationId: 'retained',
      selection: { brand: { name: 'Coupa' } },
      href: () => `${address}?presentation=retained`,
    };
    const doc = { querySelectorAll: (selector) => (selector === 'a[href]' ? links : []) };
    mountEditionNavigation({ provider, document: doc, href: address });
    assert.equal(links[0].href, `${address}?presentation=retained&mission=first#details`);
    assert.equal(
      links[1].href,
      `${root}game/controller-lab/?edition=coupa-all&presentation=retained`,
    );
    assert.equal(
      links[2].href,
      `${root}game/replay-theater/?edition=coupa-all&presentation=retained`,
    );
    assert.equal(links[3].href, `${address}?presentation=retained#settings-data`);
    assert.equal(links[4].hidden, true);
    assert.equal(links[5].href, 'https://mekhovov.github.io/revealline/authoring/motion-lab/');
    assert.equal(links[5].target, '_blank');
    assert.equal(links[5].rel, 'noopener noreferrer');
  }
});
