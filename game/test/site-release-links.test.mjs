import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archivedPlayHref,
  releaseHistoryHref,
  archivedPlayHrefFromCatalog,
} from '../../site/release-links.mjs';
import { publishedReleaseIndex } from '../../scripts/build-pages.mjs';
import { releaseExplorerHref } from '../release-explorer.mjs';

test('release explorer resolves to the shared catalog from source and frozen game URLs', () => {
  assert.equal(
    releaseExplorerHref('https://mekhovov.github.io/revealline/game/?pack=fpv'),
    'https://mekhovov.github.io/revealline/releases/',
  );
  assert.equal(
    releaseExplorerHref('https://mekhovov.github.io/revealline/releases/v0.51.0/site/game/'),
    'https://mekhovov.github.io/revealline/releases/',
  );
  assert.equal(
    releaseExplorerHref('http://127.0.0.1:8768/preview/releases/v0.51.0/site/game/index.html'),
    'http://127.0.0.1:8768/preview/releases/',
  );
  assert.equal(
    releaseExplorerHref('https://mekhovov.github.io/revealline/game/couch/'),
    'https://mekhovov.github.io/revealline/releases/',
  );
  assert.equal(
    releaseExplorerHref(
      'https://mekhovov.github.io/revealline/releases/v0.110.1/site/game/couch/relay-rescue.html',
    ),
    'https://mekhovov.github.io/revealline/releases/',
  );
});

test('About accepts actual local and canonical archived play records without double-prefixing', () => {
  const versions = ['v0.1.0', 'v0.28.0'];
  const records = versions.map((version) => ({
    version,
    sourceRevision: 'a'.repeat(40),
    play: `${version}/site/game/`,
    download: `${version}/site/distribution.zip`,
  }));
  const canonical = 'https://mekhovov.github.io/revealline-archive-01/releases/v0.1.0/site/';
  const { json } = publishedReleaseIndex(records, 'mekhovov/revealline', 'v0.28.0', {
    'v0.1.0': canonical,
  });
  assert.equal(
    archivedPlayHref(json.releases.find((r) => r.version === 'v0.1.0').canonicalPlay),
    `${canonical}game/`,
  );
  assert.equal(
    archivedPlayHref(json.releases.find((r) => r.version === 'v0.28.0').play),
    '../releases/v0.28.0/site/game/',
  );
  assert.equal(
    archivedPlayHref('v0.28.0/site/game/index.html'),
    '../releases/v0.28.0/site/game/index.html',
  );
});

test('archive links reject script schemes, credentials, traversal and non-game destinations', () => {
  for (const play of [
    undefined,
    null,
    {},
    '',
    'javascript:alert(1)',
    'data:text/html,game',
    'http://example.test/releases/v1/site/game/',
    '//example.test/releases/v1/site/game/',
    '/releases/v1/site/game/',
    '../v1/site/game/',
    'v1/site/elsewhere/',
    'https://user:password@example.test/releases/v1/site/game/',
    'https://example.test/phishing/',
    'https://example.test/releases/v1/site/game/?next=https://other.test',
    'https://example.test/releases/v1/site/game/#secret',
    'https://example.test/x/../releases/v1/site/game/',
    'https://example.test/x/%2e%2e/releases/v1/site/game/',
    'https://example.test\\@elsewhere.test/releases/v1/site/game/',
    ' https://example.test/releases/v1/site/game/',
    'v1/site/game/\n',
    'x'.repeat(2049),
  ])
    assert.equal(archivedPlayHref(play), null, String(play));
});

test('About history resolves the shared catalog from source and frozen sibling game routes', () => {
  for (const [page, expected] of [
    [
      'https://mekhovov.github.io/revealline/site/about.html#versions',
      'https://mekhovov.github.io/revealline/releases/',
    ],
    [
      'https://mekhovov.github.io/revealline/releases/v0.51.0/site/site/about.html?view=history#versions',
      'https://mekhovov.github.io/revealline/releases/',
    ],
    [
      'http://127.0.0.1:8768/preview/releases/v0.51.0/site/site/about.html',
      'http://127.0.0.1:8768/preview/releases/',
    ],
  ])
    assert.equal(releaseHistoryHref(page), expected);
});

test('About rebases only validated local archive records against the fetched catalog URL', () => {
  const canonical = 'https://mekhovov.github.io/revealline-archive-01/releases/v0.1.0/site/game/';
  for (const index of [
    'https://mekhovov.github.io/revealline/releases/index.json',
    'http://127.0.0.1:8768/preview/releases/index.json',
  ]) {
    assert.equal(
      archivedPlayHrefFromCatalog('v0.28.0/site/game/', index),
      new URL('v0.28.0/site/game/', index).href,
    );
    assert.equal(
      archivedPlayHrefFromCatalog('v0.28.0/site/game/index.html', index),
      new URL('v0.28.0/site/game/index.html', index).href,
    );
    assert.equal(archivedPlayHrefFromCatalog(canonical, index), canonical);
  }
  for (const rejected of [
    undefined,
    null,
    {},
    '',
    '../v1/site/game/',
    '//example.test/releases/v1/site/game/',
    'javascript:alert(1)',
    'https://user:password@example.test/releases/v1/site/game/',
    'https://example.test/releases/v1/site/game/?next=https://other.test',
    'https://example.test/x/%2e%2e/releases/v1/site/game/',
  ]) {
    assert.equal(
      archivedPlayHrefFromCatalog(rejected, 'https://example.test/releases/index.json'),
      null,
    );
  }
  assert.equal(
    archivedPlayHrefFromCatalog(
      'javascript:alert(1)',
      'https://example.test/releases/index.json',
    ) ??
      archivedPlayHrefFromCatalog('v0.28.0/site/game/', 'https://example.test/releases/index.json'),
    'https://example.test/releases/v0.28.0/site/game/',
    'Invalid canonical metadata still permits a separately validated local record.',
  );
});

test('only this project’s HTTPS immutable archive About routes use the canonical JSON catalogue', () => {
  for (const number of ['01', '21'])
    assert.equal(
      releaseHistoryHref(
        `https://mekhovov.github.io/revealline-archive-${number}/releases/v0.61.3/site/site/about.html?view=history#versions`,
      ),
      'https://mekhovov.github.io/revealline/releases/',
    );
  for (const page of [
    'http://mekhovov.github.io/revealline-archive-21/releases/v0.61.3/site/site/about.html',
    'https://example.test/revealline-archive-21/releases/v0.61.3/site/site/about.html',
    'https://mekhovov.github.io.example.test/revealline-archive-21/releases/v0.61.3/site/site/about.html',
    'https://mekhovov.github.io/revealline-archive-21-extra/releases/v0.61.3/site/site/about.html',
    'https://mekhovov.github.io/another-game-archive-21/releases/v0.61.3/site/site/about.html',
    'https://mekhovov.github.io/revealline-archive-21/site/about.html',
    'https://mekhovov.github.io/revealline-archive-21/releases/version-next/site/site/about.html',
  ])
    assert.equal(
      releaseHistoryHref(page),
      releaseExplorerHref(new URL('../game/', page).href),
      `Keep generic routing for ${page}`,
    );
});
