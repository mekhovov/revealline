#!/usr/bin/env node
/** Deliberate test-only entry, separate from the shipped access-controlled pages. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeFPVNative, FPV_NATIVE_LIMITS } from './build-fpv-native.mjs';
import { verifySite } from './native-cli.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export async function writeFPVNativeSmoke({ out, base, version = 'fpv-native-test-fixture' }) {
  let result;
  if (base) {
    const verified = await verifySite(base);
    const original = verified.manifest;
    if (original.qualification !== 'simulators-only-development')
      throw new Error('Smoke fixture base must be an ordinary simulator-only qualification source');
    out = path.resolve(out);
    if ((await fs.realpath(path.dirname(out))) !== path.dirname(out))
      throw new Error('Choose an ordinary output parent without symbolic links');
    await fs.mkdir(out);
    // Copy only already-verified inventory bytes, never unlisted siblings or
    // symlinks that a source directory may contain outside the served closure.
    for (const entry of verified.entries) {
      await fs.mkdir(path.dirname(path.join(out, entry.name)), { recursive: true });
      await fs.writeFile(path.join(out, entry.name), entry.bytes, { flag: 'wx' });
    }
    await fs.writeFile(path.join(out, 'manifest.json'), verified.manifestBytes, { flag: 'wx' });
    result = { out, version, nativeRuntimeVerified: false };
  } else result = await writeFPVNative({ out, version });
  const source = path.join(out, 'optional-practice/fpv-worlds/index.html');
  const original = await fs.readFile(source, 'utf8');
  if ((original.match(/<!-- access-gate:start -->/g) ?? []).length !== 1)
    throw new Error('Expected one original access gate for the explicit test fixture');
  // Exactly the fixture boundary already used by smoke-fpv-advanced-regional.
  // The original page is retained verbatim and is still the production entry.
  const html = original
    .replace(/<!-- access-gate:start -->[\s\S]*?<!-- access-gate:end -->/, '')
    .replaceAll('data-access-state="locked"', 'data-access-state="unlocked"')
    .replaceAll('data-fpv-worlds="true"', 'data-fpv-worlds="false"')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(
      '<title>FPV / LINE · Simulator</title>',
      '<title>TEST FIXTURE · FPV native runtime qualification</title>',
    )
    .replace(
      '</head>',
      '<script src="../civilian-fpv/sim-boot.mjs" defer></script>\n<script type="module" src="../../platforms/desktop/test/fpv-smoke-harness.mjs"></script>\n</head>',
    );
  const entries = new Map([
    ['optional-practice/fpv-worlds/native-test-fixture.html', Buffer.from(html)],
    [
      'platforms/desktop/test/fpv-smoke-harness.mjs',
      await fs.readFile(path.join(root, 'platforms/desktop/test/fpv-smoke-harness.mjs')),
    ],
    [
      'authoring/fpv-worlds/regions/endurance-fixture.mjs',
      await fs.readFile(path.join(root, 'authoring/fpv-worlds/regions/endurance-fixture.mjs')),
    ],
    [
      'native/fpv-smoke-fixture.json',
      json({
        format: 'FpvNativeSmokeFixture.v1',
        testOnly: true,
        productionAccessGateModified: false,
        originalWorldEntrySha256: sha256(Buffer.from(original)),
        entry: 'optional-practice/fpv-worlds/native-test-fixture.html',
        scope:
          'Full production World host with a deterministic local Regional fixture. This does not qualify production authentication, signed distribution, iOS or other devices.',
      }),
    ],
  ]);
  const launcher = await fs.readFile(path.join(out, 'game/index.html'), 'utf8');
  entries.set(
    'game/index.html',
    Buffer.from(
      launcher.replace(
        '</nav>',
        '<a href="../optional-practice/fpv-worlds/native-test-fixture.html?lang=en">TEST FIXTURE · native runtime checks</a></nav>',
      ),
    ),
  );
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json')));
  manifest.version = version;
  manifest.qualification = 'simulators-only-explicit-test-fixture';
  const files = new Map(manifest.files.map((file) => [file.path, file]));
  for (const [name, bytes] of entries) {
    await fs.mkdir(path.dirname(path.join(out, name)), { recursive: true });
    await fs.writeFile(path.join(out, name), bytes);
    files.set(name, { path: name, bytes: bytes.length, sha256: sha256(bytes) });
  }
  manifest.files = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  manifest.totalBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  if (
    manifest.files.length > FPV_NATIVE_LIMITS.files ||
    manifest.totalBytes > FPV_NATIVE_LIMITS.bytes
  )
    throw new Error('Native smoke fixture exceeds the unchanged qualification source limits');
  await fs.writeFile(path.join(out, 'manifest.json'), json(manifest));
  await verifySite(out);
  if ((await fs.readFile(source, 'utf8')) !== original)
    throw new Error('Production access page unexpectedly changed');
  return {
    ...result,
    files: manifest.files.length,
    bytes: manifest.totalBytes,
    scope: manifest.qualification,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (!['--out', '--base'].includes(args[i]) || !args[i + 1])
      throw new Error(
        'Usage: node scripts/build-fpv-native-smoke.mjs --out <new-test-only-source> [--base <verified-simulator-source>]',
      );
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.out) throw new Error('Choose a new test-only --out directory');
  console.log(JSON.stringify(await writeFPVNativeSmoke(options), null, 2));
}
