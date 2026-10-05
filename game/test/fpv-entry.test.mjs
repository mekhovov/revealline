import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { fpvLaunchURL, fpvReturnURL, appearanceLaunchURL } from '../fpv-entry.mjs';

test('SIM launch carries only a bounded cosmetic default without changing the return route', () => {
  const source = 'https://example.test/game/?edition=sample&campaign=one';
  const target = new URL(fpvLaunchURL(source, 'uk', { familyId: 'vyshyvanka', revision: 'r1' }));
  assert.equal(target.searchParams.get('appearanceFamily'), 'vyshyvanka');
  assert.equal(target.searchParams.get('appearanceRevision'), 'r1');
  assert.equal(fpvReturnURL(target.href), source);
  const invalid = new URL(
    appearanceLaunchURL(target.href, { familyId: '../private', revision: 'r1' }),
  );
  assert.equal(invalid.searchParams.has('appearanceFamily'), false);
  assert.equal(invalid.searchParams.has('appearanceRevision'), false);
  assert.equal(invalid.pathname, target.pathname);
  assert.equal(invalid.searchParams.get('game-return'), target.searchParams.get('game-return'));
});
import { OPTIONAL_PACKAGE_POLICIES } from '../../publishing/optional-package-policy.mjs';

test('bundled FPV launches and returns to the exact game entry across source, hosted and native roots', () => {
  for (const game of [
    'http://127.0.0.1:8777/game/?journey=legacy',
    'https://example.test/project/game/index.html?journey=legacy',
    'https://example.test/project/releases/v1.2.3/site/game/index.html',
    'https://example.test/project/editions/coupa/releases/v1.2.3/site/game/company.html',
    'capacitor://localhost/game/index.html',
    'file:///app/site/game/index.html',
  ]) {
    const launch = fpvLaunchURL(game, 'uk');
    assert.match(launch, /optional-practice\/civilian-fpv\/index.html/);
    assert.equal(new URL(launch).searchParams.get('lang'), 'uk');
    assert.equal(fpvReturnURL(launch), game);
  }
});

test('FPV return refuses foreign origins, credentials and unrelated paths', () => {
  const source = 'https://example.test/project/optional-practice/civilian-fpv/index.html';
  for (const target of [
    'https://evil.test/game/',
    '//evil.test/game/',
    '/other/game/',
    '/project/game/../admin',
    'https://user@example.test/project/game/',
  ]) {
    const url = new URL(source);
    url.searchParams.set('game-return', target);
    assert.equal(fpvReturnURL(url.href), null);
  }
  assert.equal(fpvReturnURL(source), null);
  assert.equal(fpvLaunchURL('https://example.test/admin'), null);
});

test('regular game build includes the simulator and all policy dependencies without an optional download', async () => {
  const config = JSON.parse(await readFile(new URL('../build-config.json', import.meta.url)));
  const policy = OPTIONAL_PACKAGE_POLICIES['civilian-fpv'];
  for (const name of [...policy.localFiles.map((n) => policy.root + n), ...policy.sharedFiles]) {
    assert.ok(
      config.include.some((root) => name === root || name.startsWith(root + '/')),
      name,
    );
  }
});

test('bundled FPV renderer vendor dependencies stay in the offline core', () => {
  const names = [
    'optional-practice/civilian-fpv/vendor/three.module.js',
    'optional-practice/civilian-fpv/vendor/three.core.js',
    'optional-practice/civilian-fpv/vendor/LICENSE.txt',
    'optional-practice/install-context.mjs',
  ];
  const entries = names.map((name) => ({ name, bytes: Buffer.from('') }));
  const result = selectOfflineCore(entries, new Set());
  for (const name of names) assert.ok(result.retained.has(name), name);
});
