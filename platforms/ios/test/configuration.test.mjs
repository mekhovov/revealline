import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectConfiguration } from '../scripts/doctor.mjs';

const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url)));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));

test('scaffold retains the full distribution and pinned local native origin', () => {
  assert.deepEqual(inspectConfiguration(config, pkg), { valid: true, errors: [] });
  assert.equal(config.server.url, undefined);
  assert.equal(config.plugins, undefined);
});
test('remote URLs, broad navigation, asset relocation and dependency drift are rejected', () => {
  for (const change of [
    (value) => (value.server.url = 'https://example.com'),
    (value) => (value.server.allowNavigation = ['*']),
    (value) => (value.server.cleartext = true),
    (value) => (value.server.hostname = 'other'),
    (value) => (value.server.iosScheme = 'https'),
    (value) => (value.server.appStartPath = '/index.html'),
    (value) => (value.webDir = '../../game'),
    (value) => (value.ios.path = '../elsewhere'),
  ]) {
    const bad = structuredClone(config);
    change(bad);
    assert.equal(inspectConfiguration(bad, pkg).valid, false);
  }
  const mismatched = structuredClone(pkg);
  mismatched.dependencies['@capacitor/ios'] = '^8.0.0';
  assert.equal(inspectConfiguration(config, mismatched).valid, false);
});
test('generated app intentionally requires iOS 15.4 and includes the export privacy declaration', async () => {
  const project = await readFile(
    new URL('../native/App/App.xcodeproj/project.pbxproj', import.meta.url),
    'utf8',
  );
  const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map(
    (match) => match[1],
  );
  assert.equal(targets.length, 4);
  assert.equal(
    targets.every((target) => target === '15.4'),
    true,
  );
  assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
  const privacy = await readFile(
    new URL('../native/App/App/PrivacyInfo.xcprivacy', import.meta.url),
    'utf8',
  );
  assert.match(privacy, /NSPrivacyAccessedAPICategoryFileTimestamp/);
  assert.match(privacy, /C617\.1/);
});
test('SPM resolves all selected plugins through the isolated package tree', async () => {
  const swift = await readFile(
    new URL('../native/App/CapApp-SPM/Package.swift', import.meta.url),
    'utf8',
  );
  assert.match(swift, /exact: "8\.5\.2"/);
  for (const name of ['app', 'filesystem', 'share'])
    assert.equal(swift.includes(`../../../node_modules/@capacitor/${name}`), true);
});
test('MJS receives an imported JavaScript type declaration without adding a document handler', async () => {
  const plist = await readFile(new URL('../native/App/App/Info.plist', import.meta.url), 'utf8');
  assert.match(plist, /UTImportedTypeDeclarations/);
  assert.match(plist, /com\.netscape\.javascript-source/);
  assert.match(plist, /<string>mjs<\/string>/);
  assert.match(plist, /<string>text\/javascript<\/string>/);
  assert.doesNotMatch(plist, /CFBundleDocumentTypes|UTExportedTypeDeclarations/);
});
