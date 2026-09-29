import test from 'node:test';
import assert from 'node:assert/strict';
import { archivedPlayHref } from '../../site/release-links.mjs';
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
