#!/usr/bin/env node
/** Measure small, frozen metadata files; never download the full game archive. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildPackageReport, packageReportMarkdown } from './report-offline-packages.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const NAMES = ['offline-content.json', 'offline-cache.json', 'app/service-worker.js'];

export async function readPinnedPackageFile(url, pin, { fetchImpl = fetch } = {}) {
  assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 16 * 1024 ** 2);
  const response = await fetchImpl(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.ok && response.body, `Cannot read published metadata: ${url}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert.ok(size <= pin.bytes, `Published metadata exceeds pinned size: ${url}`);
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  assert.equal(size, pin.bytes, `Published metadata size differs: ${url}`);
  assert.equal(digest(bytes), pin.sha256, `Published metadata hash differs: ${url}`);
  return bytes;
}

export async function publishedPackageReport(version, { root = ROOT, fetchImpl = fetch } = {}) {
  assert.match(version, /^v\d+\.\d+\.\d+$/, 'Use an existing frozen stable version.');
  const directory = path.join(root, 'publishing/pages-controller/metadata', version);
  const [release, manifestBytes, checksum] = await Promise.all([
    fs.readFile(path.join(directory, 'release.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(directory, 'manifest.json')),
    fs.readFile(path.join(directory, 'distribution.zip.sha256'), 'utf8'),
  ]);
  assert.equal(release.version, version);
  assert.equal(digest(manifestBytes), release.manifestSha256, 'Frozen manifest differs.');
  assert.equal(checksum.trim().split(/\s+/)[0], release.distributionSha256);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.version, version);
  assert.equal(manifest.sourceRevision, release.sourceRevision);
  const baseURL = `https://mekhovov.github.io/revealline/releases/${version}/site/`;
  const pins = NAMES.map((name) => {
    const matches = manifest.files.filter((file) => file.path === name);
    assert.equal(matches.length, 1, `Frozen metadata pin missing or ambiguous: ${name}`);
    return matches[0];
  });
  const [catalogueBytes, coreBytes, workerBytes] = await Promise.all(
    pins.map((pin) => readPinnedPackageFile(baseURL + pin.path, pin, { fetchImpl })),
  );
  const config = workerBytes.toString('utf8').match(/^const CONFIG = (\{.*\});$/m)?.[1];
  assert.ok(config, 'Cannot read exact published launcher configuration.');
  const catalogue = JSON.parse(catalogueBytes);
  const core = JSON.parse(coreBytes);
  assert.equal(catalogue.version, version);
  assert.equal(core.version, version);
  const report = buildPackageReport({
    catalogue,
    core,
    manifest,
    launcher: JSON.parse(config),
    archiveSHA256: release.distributionSha256,
  });
  report.evidence = {
    kind: 'published-metadata',
    baseURL,
    manifestSha256: release.manifestSha256,
    verifiedFiles: pins,
    scope:
      'The three published metadata files match the frozen manifest. Package sizes are declared payload bytes; individual gameplay assets, the archive and installed-device storage were not re-downloaded or verified by this report.',
  };
  return report;
}

async function main(args) {
  assert.ok(
    args.length === 4 && args[0] === '--version' && args[2] === '--out',
    'Usage: report-published-offline-packages.mjs --version vX.Y.Z --out output-prefix',
  );
  const version = args[1],
    output = args[3];
  const report = await publishedPackageReport(version);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(`${output}.json`, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(
    `${output}.md`,
    packageReportMarkdown(report, {
      command: `node scripts/report-published-offline-packages.mjs --version ${version} --out ${output}`,
    }),
  );
  console.log(
    JSON.stringify({ version, packages: report.packages, evidence: report.evidence }, null, 2),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2));
