import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  APP_ORIGIN,
  SCHEME_PRIVILEGES,
  WEB_PREFERENCES,
  SESSION_PARTITION,
  resourcePathForURL,
  safeAssetPath,
  isAppBlobURL,
  isAllowedRequestURL,
  isNavigationAllowed,
  desktopDirectories,
  downloadDecision,
  MAX_DOWNLOAD_BYTES,
} from '../policy.mjs';

test('fixed custom origin enables standard secure storage without privilege bypasses', () => {
  assert.equal(APP_ORIGIN, 'revealline://app/');
  assert.equal(SESSION_PARTITION, 'persist:revealline');
  assert.equal(SCHEME_PRIVILEGES.standard, true);
  assert.equal(SCHEME_PRIVILEGES.secure, true);
  assert.equal(SCHEME_PRIVILEGES.supportFetchAPI, true);
  assert.equal(SCHEME_PRIVILEGES.corsEnabled, true);
  assert.equal(SCHEME_PRIVILEGES.bypassCSP, false);
  assert.equal(SCHEME_PRIVILEGES.allowServiceWorkers, false);
  assert.equal(SCHEME_PRIVILEGES.allowExtensions, false);
  assert.equal(WEB_PREFERENCES.sandbox, true);
  assert.equal(WEB_PREFERENCES.contextIsolation, true);
  assert.equal(WEB_PREFERENCES.nodeIntegration, false);
  assert.equal(WEB_PREFERENCES.nodeIntegrationInSubFrames, false);
  assert.equal(WEB_PREFERENCES.nodeIntegrationInWorker, false);
  assert.equal(WEB_PREFERENCES.webSecurity, true);
  assert.equal(WEB_PREFERENCES.allowRunningInsecureContent, false);
  assert.equal(WEB_PREFERENCES.webviewTag, false);
  assert.equal(Object.hasOwn(WEB_PREFERENCES, 'preload'), false);
});

test('routes retain local directory semantics and queries without redirects', () => {
  assert.equal(resourcePathForURL(APP_ORIGIN), 'index.html');
  assert.equal(resourcePathForURL(`${APP_ORIGIN}game/?practice=1#controls`), 'game/index.html');
  assert.equal(resourcePathForURL(`${APP_ORIGIN}game/app.mjs?v=1`), 'game/app.mjs');
  assert.equal(resourcePathForURL(`${APP_ORIGIN}images/My%20Drone.png`), 'images/My Drone.png');
  assert.equal(resourcePathForURL(`${APP_ORIGIN}game`), 'game');
});

test('raw traversal, encoded separators, credentials, ports and lookalike origins are denied', () => {
  const blocked = [
    'https://app/game/',
    'file:///etc/passwd',
    'revealline://app.evil/game/',
    'revealline://evil@/game/',
    'revealline://app@evil/game/',
    'revealline://user@app/game/',
    'revealline://app:80/game/',
    'revealline://app./game/',
    'revealline://APP/game/',
    `${APP_ORIGIN}../private.json`,
    `${APP_ORIGIN}game/../../private.json`,
    `${APP_ORIGIN}%2e%2e/private.json`,
    `${APP_ORIGIN}game/%252e%252e/private.json`,
    `${APP_ORIGIN}game%2findex.html`,
    `${APP_ORIGIN}game%5cindex.html`,
    `${APP_ORIGIN}game\\index.html`,
    `${APP_ORIGIN}game//index.html`,
    `${APP_ORIGIN}game/%00name.json`,
    `${APP_ORIGIN}game/%0Aname.json`,
    `${APP_ORIGIN}.git/config`,
    `${APP_ORIGIN}C:/Users/private.json`,
    `${APP_ORIGIN}game/%`,
    `${APP_ORIGIN}game/CON.json`,
    `\n${APP_ORIGIN}game/`,
    `${APP_ORIGIN}game/${'a'.repeat(9000)}`,
  ];
  for (const url of blocked) assert.equal(resourcePathForURL(url), null, url);
  for (const filename of ['../private', '/root', 'foo//bar', 'nul.txt', 'foo.', 'foo ', '.env'])
    assert.equal(safeAssetPath(filename), false, filename);
});

test('HTML navigation is restricted to inventoried pages, including local preview targets', () => {
  const files = new Set(['game/index.html', 'game/playground/index.html', 'game/app.mjs']);
  const has = (relative) => files.has(relative);
  assert.equal(isNavigationAllowed(`${APP_ORIGIN}game/?practice=1`, has), true);
  assert.equal(isNavigationAllowed(`${APP_ORIGIN}game/playground/`, has), true);
  for (const url of [
    `${APP_ORIGIN}game/missing.html`,
    `${APP_ORIGIN}game/app.mjs`,
    'https://example.com/',
    'javascript:alert(1)',
    'blob:revealline://app/export',
  ])
    assert.equal(isNavigationAllowed(url, has), false);
  // Node does not recognize an Electron-registered custom origin. Never compare .origin alone.
  assert.equal(new URL(APP_ORIGIN).origin, 'null');
  assert.equal(new URL('other://evil/').origin, 'null');
});

test('network policy admits local assets and bounded media schemes, never remote/file resources', () => {
  assert.equal(isAllowedRequestURL(`${APP_ORIGIN}game/app.mjs`, 'script'), true);
  assert.equal(isAllowedRequestURL('data:image/png;base64,YQ==', 'image'), true);
  assert.equal(isAllowedRequestURL('blob:revealline://app/abc-123', 'image'), true);
  assert.equal(isAllowedRequestURL('blob:revealline://app/abc-123', 'other'), true);
  for (const [url, kind] of [
    ['https://example.com/a.js', 'script'],
    ['http://127.0.0.1:80/a', 'xhr'],
    ['file:///etc/passwd', 'other'],
    ['data:text/html,<script></script>', 'mainFrame'],
    ['data:image/svg+xml,<svg></svg>', 'script'],
    ['blob:revealline://app/a', 'script'],
    ['blob:revealline://app/a', 'mainFrame'],
    ['blob:https://example.com/a', 'image'],
  ])
    assert.equal(isAllowedRequestURL(url, kind), false);
  assert.equal(isAppBlobURL('blob:revealline://app.evil/a'), false);
  assert.equal(isAppBlobURL('blob:null/a'), false);
});

test('storage identity stays stable while install paths and versions move', () => {
  const appData = path.resolve('test-app-data');
  const a = desktopDirectories({ appData, appPath: path.resolve('release-one') });
  const b = desktopDirectories({ appData, appPath: path.resolve('release-two') });
  assert.notEqual(a.site, b.site);
  assert.equal(a.userData, b.userData);
  const custom = desktopDirectories({
    appData,
    appPath: path.resolve('release-one'),
    siteOverride: path.resolve('staged-site'),
    userDataOverride: path.resolve('isolated-profile'),
  });
  assert.equal(custom.site, path.resolve('staged-site'));
  assert.equal(custom.userData, path.resolve('isolated-profile'));
  for (const value of ['', 'relative/site', 'https://example.com/', '\0'])
    assert.throws(
      () =>
        desktopDirectories({ appData, appPath: path.resolve('release-one'), siteOverride: value }),
      /absolute local/,
    );
});

test('only user-initiated same-window local JSON or ZIP exports reach the native save dialog', () => {
  const valid = {
    url: 'blob:revealline://app/1234-5678',
    pageURL: `${APP_ORIGIN}game/`,
    filename: 'revealline-complete-backup.json',
    mimeType: 'application/json',
    bytes: 4000,
    userGesture: true,
    ownsWindow: true,
  };
  assert.equal(downloadDecision(valid).allowed, true);
  assert.equal(
    downloadDecision({ ...valid, filename: 'packs.zip', mimeType: 'application/zip' }).allowed,
    true,
  );
  const invalid = [
    { userGesture: false },
    { ownsWindow: false },
    { pageURL: 'https://example.com/' },
    { url: 'https://example.com/packs.json' },
    { url: 'blob:null/1234' },
    { filename: '../private.json' },
    { filename: 'C:\\private.json' },
    { filename: '.hidden.json' },
    { filename: 'backup.html' },
    { mimeType: 'text/html' },
    { filename: 'archive.zip', mimeType: 'application/json' },
    { bytes: MAX_DOWNLOAD_BYTES + 1 },
    { bytes: -1 },
    { bytes: NaN },
  ];
  for (const changes of invalid)
    assert.equal(
      downloadDecision({ ...valid, ...changes }).allowed,
      false,
      JSON.stringify(changes),
    );
});
