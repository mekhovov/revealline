import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const encode = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export function bindAppearanceMetadata({
  identityBytes,
  mainBytes,
  checksumBytes,
  manifestBytes,
  sourceRevision,
  runURL,
  artifactID,
  artifactURL,
  artifactDigest,
}) {
  for (const bytes of [identityBytes, mainBytes, checksumBytes])
    assert(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 256 * 1024);
  assert(Buffer.isBuffer(manifestBytes) && manifestBytes.length <= 2 * 1024 ** 2);
  assert.match(sourceRevision, /^[a-f0-9]{40}$/);
  assert.match(String(artifactID), /^[1-9][0-9]*$/);
  assert(Number.isSafeInteger(Number(artifactID)));
  assert.match(artifactDigest, /^[a-f0-9]{64}$/);
  const run = new URL(runURL);
  assert.equal(run.origin, 'https://github.com');
  assert.match(run.pathname, /^\/mekhovov\/revealline\/actions\/runs\/[1-9][0-9]*$/);
  assert.equal(artifactURL, `${runURL}/artifacts/${artifactID}`);
  const identity = JSON.parse(identityBytes),
    main = JSON.parse(mainBytes),
    manifest = JSON.parse(manifestBytes);
  assert.equal(identity.format, 'AppearancePreview.v1');
  assert.equal(identity.sourceRevision, sourceRevision);
  assert.match(identity.sourceTree, /^[a-f0-9]{40}$/);
  assert.equal(identity.workflowRun, runURL);
  assert.equal(identity.node, 'v22.13.1');
  assert.equal(identity.deployed, false);
  assert.equal(identity.releaseQualified, false);
  assert.equal(main.sourceRevision, sourceRevision);
  assert.equal(manifest.sourceRevision, sourceRevision);
  assert.equal(manifest.formatVersion, 1);
  const packages = identity.artifacts.filter((row) => row.path === 'distribution.zip');
  assert.equal(packages.length, 1);
  const inner = packages[0];
  assert.equal(main.sha256, inner.sha256);
  assert.match(inner.sha256, /^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(inner.bytes) && inner.bytes > 0 && inner.bytes <= 2 * 1024 ** 3);
  const checksums = new Map();
  for (const line of checksumBytes.toString('utf8').trim().split('\n')) {
    const match = /^([a-f0-9]{64})  ([a-zA-Z0-9._-]+)$/.exec(line);
    assert(match && !checksums.has(match[2]), 'Unique exact full-package checksum required');
    checksums.set(match[2], match[1]);
  }
  assert.equal(checksums.get('distribution.zip'), inner.sha256);
  assert.equal(checksums.get('main-build.json'), hash(mainBytes));
  assert.equal(checksums.get('preview-identity.json'), hash(identityBytes));
  const binding = {
    format: 'AppearancePreviewMetadataV1',
    status: 'bound-to-uploaded-package',
    sourceRevision,
    sourceTree: identity.sourceTree,
    workflowRun: runURL,
    node: identity.node,
    fullArtifact: { id: Number(artifactID), url: artifactURL, sha256: artifactDigest },
    inner: { bytes: inner.bytes, sha256: inner.sha256 },
    manifest: { bytes: manifestBytes.length, sha256: hash(manifestBytes), sourceRevision },
    focusedTests: identity.focusedTests,
    testPolicy: identity.testPolicy,
    qualification:
      'Metadata binding only; require successful exact workflow/artifact API metadata and remote full ZIP/member/source/CSP verification before use. No test, release, offline or performance verdict added.',
  };
  const files = {
    'preview-identity.json': identityBytes,
    'main-build.json': mainBytes,
    SHA256SUMS: checksumBytes,
    'package-binding.json': encode(binding),
  };
  files['METADATA-SHA256SUMS'] = Buffer.from(
    Object.entries(files)
      .map(([name, bytes]) => `${hash(bytes)}  ${name}`)
      .join('\n') + '\n',
  );
  assert(Object.values(files).reduce((n, bytes) => n + bytes.length, 0) <= 1024 ** 2);
  return files;
}
export async function writeAppearanceMetadata({ root, destination, manifest, ...context }) {
  const read = async (path, maximum) => {
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink() && info.size <= maximum);
    const bytes = await readFile(path);
    assert.equal(bytes.length, info.size);
    return bytes;
  };
  const files = bindAppearanceMetadata({
    ...context,
    identityBytes: await read(join(root, 'preview-identity.json'), 256 * 1024),
    mainBytes: await read(join(root, 'main-build.json'), 256 * 1024),
    checksumBytes: await read(join(root, 'SHA256SUMS'), 256 * 1024),
    manifestBytes: await read(manifest, 2 * 1024 ** 2),
  });
  await mkdir(destination); // independent fresh small output, outside playable artifact
  for (const [name, bytes] of Object.entries(files)) {
    const path = join(destination, name);
    await writeFile(path, bytes, { flag: 'wx' });
    assert.equal(hash(await readFile(path)), hash(bytes));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await writeAppearanceMetadata({
    root: '.cache/appearance-preview',
    destination: '.cache/appearance-preview-metadata',
    manifest: '.cache/appearance-game/manifest.json',
    sourceRevision: process.env.PREVIEW_HEAD_SHA,
    runURL: process.env.PREVIEW_RUN_URL,
    artifactID: process.env.PREVIEW_ARTIFACT_ID,
    artifactURL: process.env.PREVIEW_ARTIFACT_URL,
    artifactDigest: process.env.PREVIEW_ARTIFACT_DIGEST,
  });
