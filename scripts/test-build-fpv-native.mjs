import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { buildFPVNative, writeFPVNative, FPV_NATIVE_LIMITS } from './build-fpv-native.mjs';
import { stageNative, verifySite, IOS_CSP } from './native-cli.mjs';
import { loadNativeSite } from '../platforms/desktop/resources.mjs';
import { writeFPVNativeSmoke } from './build-fpv-native-smoke.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const built = buildFPVNative({ root, version: 'fpv-native-test' });
async function directory(t) {
  const result = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'fpv-native-test-')));
  t.after(() => fs.rm(result, { recursive: true, force: true }));
  return result;
}

test('simulator qualification build retains both complete package closures, identities and access gates', async () => {
  const result = await built;
  const files = new Map(result.entries.map((entry) => [entry.name, entry.bytes]));
  assert.ok(result.manifest.totalBytes < FPV_NATIVE_LIMITS.bytes);
  assert.ok(result.manifest.files.length < FPV_NATIVE_LIMITS.files);
  assert.equal(result.manifest.sourceRevision, null, 'uncommitted input is never a frozen release');
  assert.equal(result.manifest.qualification, 'simulators-only-development');
  for (const packageId of ['civilian-fpv', 'fpv-worlds']) {
    const source = JSON.parse(files.get(`native/source-packages/${packageId}.json`));
    for (const file of source.files)
      assert.equal(files.get(file.path)?.length, file.bytes, file.path);
    assert.match(files.get(source.entry).toString(), /data-access-state="locked"/);
    assert.match(files.get(source.entry).toString(), /revealline-access-verifier/);
  }
  for (const module of [
    'sim-boot.mjs',
    'advanced-worker.mjs',
    'advanced-controller.mjs',
    'vendor/rapier/rapier.mjs',
  ])
    assert.ok(files.has(`optional-practice/civilian-fpv/${module}`), module);
  assert.ok(files.has('game/platform.mjs'));
  assert.ok(
    !result.entries.some(({ name }) =>
      /^authoring\/|game\/(?:test|content\/packs|editions)\//.test(name),
    ),
  );
  const qualification = JSON.parse(files.get('native/fpv-qualification.json'));
  assert.equal(qualification.nativeRuntimeVerified, false);
  assert.equal(qualification.advancedScored, false);
  assert.match(files.get('game/index.html').toString(), /game-return=%2Fgame%2Findex.html/);
});

test('explicit native smoke fixture keeps production access pages unchanged and uses normal native policy', async (t) => {
  const temp = await directory(t),
    base = path.join(temp, 'base'),
    source = path.join(temp, 'smoke'),
    stage = path.join(temp, 'stage');
  await writeFPVNative({ out: base });
  await fs.writeFile(path.join(base, 'unlisted-development-note.txt'), 'not a served asset');
  const result = await writeFPVNativeSmoke({ base, out: source });
  assert.equal(result.scope, 'simulators-only-explicit-test-fixture');
  assert.equal(result.nativeRuntimeVerified, false);
  await assert.rejects(fs.stat(path.join(source, 'unlisted-development-note.txt')), {
    code: 'ENOENT',
  });
  for (const page of ['civilian-fpv', 'fpv-worlds'])
    assert.deepEqual(
      await fs.readFile(path.join(source, `optional-practice/${page}/index.html`)),
      await fs.readFile(path.join(base, `optional-practice/${page}/index.html`)),
    );
  const fixture = await fs.readFile(
    path.join(source, 'optional-practice/fpv-worlds/native-test-fixture.html'),
    'utf8',
  );
  assert.match(fixture, /TEST FIXTURE/);
  assert.match(fixture, /src="\.\.\/\.\.\/platforms\/desktop\/test\/fpv-smoke-harness.mjs"/);
  assert.ok(!fixture.includes('revealline-access-verifier'));
  const metadata = JSON.parse(
    await fs.readFile(path.join(source, 'native/fpv-smoke-fixture.json')),
  );
  assert.equal(metadata.testOnly, true);
  assert.equal(metadata.productionAccessGateModified, false);
  await stageNative({ site: source, out: stage, platform: 'desktop' });
  const native = await loadNativeSite(stage);
  const response = await native.handle(
    new Request('revealline://app/optional-practice/fpv-worlds/native-test-fixture.html'),
  );
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('Content-Security-Policy'),
    /script-src 'self' 'wasm-unsafe-eval';/,
  );
  assert.match(response.headers.get('Content-Security-Policy'), /connect-src 'self';/);
  await assert.rejects(
    writeFPVNativeSmoke({ base: source, out: path.join(temp, 'again') }),
    /ordinary simulator-only/,
  );
});

test('all simulator HTML uses external executable scripts and no inline handlers under native CSP', async () => {
  const result = await built;
  const visit = (node, name) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    assert.ok(
      Object.keys(attrs).every((attribute) => !/^on/i.test(attribute)),
      name,
    );
    if (node.tagName === 'script') {
      const type = attrs.type ?? '';
      if (['', 'module', 'application/x-revealline-locked'].includes(type))
        assert.ok(attrs.src, `External executable script required: ${name}`);
    }
    for (const child of node.childNodes ?? []) visit(child, name);
  };
  for (const entry of result.entries.filter(({ name }) => name.endsWith('.html')))
    visit(parse(entry.bytes.toString()), entry.name);
});

test('external SIM bootstrap reports load errors and binds reload/back without inline handlers', async () => {
  let reloads = 0,
    backs = 0;
  const controls = new Map(
    ['[data-sim-reload]', '[data-sim-back]'].map((name) => [
      name,
      { addEventListener: (_type, listener) => (controls.get(name).click = listener) },
    ]),
  );
  const listeners = new Map();
  let delayed;
  const status = { textContent: '' };
  const document = {
    documentElement: { dataset: {} },
    getElementById: () => status,
    querySelectorAll: (selector) => [controls.get(selector)],
  };
  vm.runInNewContext(
    await fs.readFile(path.join(root, 'optional-practice/civilian-fpv/sim-boot.mjs'), 'utf8'),
    {
      document,
      window: {
        addEventListener: (type, listener) => listeners.set(type, listener),
        setTimeout: (fn) => (delayed = fn),
      },
      location: { reload: () => reloads++ },
      history: { back: () => backs++ },
    },
  );
  assert.equal(document.documentElement.dataset.modeShellPending, 'true');
  delayed();
  assert.match(status.textContent, /Still loading/);
  listeners.get('error')();
  assert.match(status.textContent, /Could not start/);
  let prevented = false;
  controls.get('[data-sim-reload]').click({ preventDefault: () => (prevented = true) });
  controls.get('[data-sim-back]').click();
  assert.ok(prevented);
  assert.equal(reloads, 1);
  assert.equal(backs, 1);
  delete document.documentElement.dataset.modeShellPending;
  status.textContent = 'Flight ready';
  delayed();
  assert.equal(status.textContent, 'Flight ready');
});

test('qualification source stages with unchanged desktop policy, exact worker hashes and tamper rejection', async (t) => {
  const temp = await directory(t),
    site = path.join(temp, 'source'),
    out = path.join(temp, 'desktop');
  const report = await writeFPVNative({ root, out: site, version: 'fpv-native-test' });
  assert.equal(report.nativeRuntimeVerified, false);
  await assert.rejects(writeFPVNative({ root, out: site }), /already exists/);
  await stageNative({ site, out, platform: 'desktop' });
  const native = await loadNativeSite(out);
  for (const name of [
    'game/index.html',
    'optional-practice/civilian-fpv/index.html',
    'optional-practice/fpv-worlds/index.html',
    'optional-practice/civilian-fpv/advanced-worker.mjs',
    'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
  ]) {
    const response = await native.handle(new Request(`revealline://app/${name}`));
    assert.equal(response.status, 200, name);
    assert.match(
      response.headers.get('Content-Security-Policy'),
      /script-src 'self' 'wasm-unsafe-eval';/,
    );
    assert.match(response.headers.get('Content-Security-Policy'), /connect-src 'self';/);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      await fs.readFile(path.join(site, name)),
    );
  }
  await fs.appendFile(
    path.join(out, 'optional-practice/civilian-fpv/advanced-worker.mjs'),
    '\n// changed',
  );
  await assert.rejects(verifySite(out, { native: true }), /verification/);
  await assert.rejects(loadNativeSite(out), /checksum/);
});

test('qualification builder rejects symlink roots and output parents without writing through them', async (t) => {
  const temp = await directory(t),
    link = path.join(temp, 'linked-source');
  await fs.symlink(root, link, 'dir');
  await assert.rejects(buildFPVNative({ root: link }), /ordinary source/);
  await assert.rejects(
    writeFPVNative({ out: path.join(link, 'must-not-be-created') }),
    /ordinary source/,
  );
  await assert.rejects(fs.lstat(path.join(root, 'must-not-be-created')), { code: 'ENOENT' });
});

test('qualification iOS stage applies strict CSP and preserves source metadata; stub bridge does not qualify runtime', async (t) => {
  const temp = await directory(t),
    site = path.join(temp, 'source'),
    out = path.join(temp, 'ios');
  await writeFPVNative({ root, out: site });
  const bridge = path.join(temp, 'bridge.mjs');
  await fs.writeFile(bridge, 'export const fixtureOnly = true;\n');
  await stageNative({
    site,
    out,
    platform: 'ios',
    bridge,
    diagnostics: path.join(root, 'platforms/ios/diagnostics'),
  });
  const verified = await verifySite(out, { native: true });
  assert.notEqual(verified.marker.manifestSha256, verified.marker.sourceManifestSha256);
  assert.match(
    await fs.readFile(path.join(out, 'game/index.html'), 'utf8'),
    /Content-Security-Policy/,
  );
  assert.ok(
    (
      await fs.readFile(path.join(out, 'optional-practice/civilian-fpv/index.html'), 'utf8')
    ).includes(IOS_CSP),
  );
  const diagnostics = await fs.readFile(path.join(out, 'diagnostics/index.html'), 'utf8');
  assert.match(diagnostics, /script-src 'self';/);
  assert.doesNotMatch(diagnostics, /wasm-unsafe-eval|unsafe-inline|unsafe-eval/);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(out, 'native/fpv-qualification.json'), 'utf8'))
      .nativeRuntimeVerified,
    false,
  );
});
