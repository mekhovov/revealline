import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import {
  fpvLaunchURL,
  snakeLaunchURL,
  fpvReturnURL,
  fpvWorldLaunchURL,
  fpvWorldReturnURL,
  appearanceLaunchURL,
} from '../fpv-entry.mjs';

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

test('World SIM returns to the actual arcade mode, query and community without browser history', () => {
  for (const root of [
    'https://example.test/project/',
    'https://example.test/project/releases/v1.2.3/site/',
    'https://example.test/project/editions/coupa/releases/v1.2.3/site/',
    'capacitor://localhost/',
  ]) {
    for (const entry of [
      'game/',
      'game/index.html',
      'game/company.html',
      'game/couch/',
      'game/couch/relay-rescue.html',
      'game/snake/',
      'game/snake/index.html',
      'game/snake/play.html',
    ]) {
      const source = root + entry + '?journey=horizon#menu';
      const target = fpvWorldLaunchURL(source, 'uk', { familyId: 'tryzub', revision: 'r1' });
      assert.equal(new URL(target).hash, '#learn');
      assert.equal(new URL(target).searchParams.get('appearanceFamily'), 'tryzub');
      assert.equal(new URL(target).searchParams.get('appearanceRevision'), 'r1');
      assert.equal(fpvWorldReturnURL(target), source);
    }
  }
  const standalone =
    'https://example.test/project/practice/fpv-worlds/releases/v1.2.3/site/optional-practice/fpv-worlds/index.html';
  assert.equal(fpvWorldReturnURL(standalone), 'https://example.test/project/game/');
  const foreign = new URL('https://example.test/project/optional-practice/fpv-worlds/index.html');
  foreign.searchParams.set('game-return', 'https://evil.test/game/');
  assert.equal(fpvWorldReturnURL(foreign.href), 'https://example.test/project/game/');
});

test('Snake launch keeps the selected seats and bounded cosmetics within the current build', () => {
  for (const root of [
    'https://example.test/project/',
    'https://example.test/project/editions/coupa/releases/v1.2.3/site/',
    'capacitor://localhost/',
    'file:///app/site/',
  ]) {
    for (const mode of ['solo', 'versus', 'team']) {
      const launch = new URL(
        snakeLaunchURL(root + 'game/couch/', mode, 'uk', {
          familyId: 'tryzub',
          revision: 'r1',
        }),
      );
      assert.equal(launch.href.split('?')[0], root + 'game/snake/play.html');
      assert.equal(launch.searchParams.get('mode'), mode);
      assert.equal(launch.searchParams.get('lang'), 'uk');
      assert.equal(launch.searchParams.get('appearanceFamily'), 'tryzub');
      assert.equal(launch.searchParams.get('appearanceRevision'), 'r1');
      assert.equal(launch.searchParams.has('journey'), false);
    }
  }
  for (const href of [
    'invalid',
    'javascript:alert(1)',
    'https://user@example.test/game/',
    'https://example.test/admin',
    'https://example.test/game/snake/unknown.html',
  ])
    assert.equal(snakeLaunchURL(href), null, href);
  assert.equal(snakeLaunchURL('https://example.test/game/', 'unknown'), null);
});
