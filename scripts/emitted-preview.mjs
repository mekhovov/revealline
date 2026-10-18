/** Exact emitted-file capture for bounded local product previews, never a new build. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fingerprintDemoSources } from './demo-source-fingerprint.mjs';

export const EMITTED_PREVIEW_LIMITS = Object.freeze({
  files: 20000,
  deltaFiles: 2000,
  bodyBytes: 64 * 1024 * 1024,
  deltaBytes: 256 * 1024 * 1024,
  manifestBytes: 8 * 1024 * 1024,
});
const format = 'RevealLineEmittedPreviewV1';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const missing = (name) =>
  Object.assign(new Error(`Unknown emitted path: ${name}`), { code: 'ENOENT' });
function relative(name) {
  assert.ok(typeof name === 'string' && name && !/[\\\x00-\x1f]/.test(name));
  assert.ok(!path.posix.isAbsolute(name) && !/^[A-Za-z]:/.test(name));
  assert.ok(name.split('/').every((part) => part && part !== '.' && part !== '..'));
  return name;
}
function inside(root, name) {
  const result = path.relative(root, name);
  assert.ok(
    result && result !== '..' && !result.startsWith(`..${path.sep}`) && !path.isAbsolute(result),
    'Preview path must stay within its source root.',
  );
  return result.split(path.sep).join('/');
}
async function localFile(root, name) {
  let file = root;
  for (const part of relative(name).split('/')) {
    file = path.join(file, part);
    assert.ok(!(await lstat(file)).isSymbolicLink(), `Symbolic links are not admitted: ${name}`);
  }
  const stat = await lstat(file);
  assert.ok(stat.isFile(), `Not a regular emitted file: ${name}`);
  return { file, stat };
}
async function readBounded(root, name, maximum) {
  const { file, stat } = await localFile(root, name);
  assert.ok(stat.size <= maximum, `Emitted file exceeds its byte bound: ${name}`);
  const bytes = await readFile(file);
  assert.ok(bytes.length <= maximum, `Emitted file grew beyond its byte bound: ${name}`);
  return bytes;
}
function pin(name, bytes) {
  return { path: relative(name), bytes: bytes.length, sha256: sha(bytes) };
}
function validPin(file) {
  relative(file.path);
  assert.ok(
    Number.isSafeInteger(file.bytes) && file.bytes >= 0 && /^[a-f0-9]{64}$/.test(file.sha256),
  );
}
const inventory = (files) => files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
function sourceIdentity({ sourceRevision, sourceFingerprint, buildInputFingerprint }) {
  assert.match(sourceRevision, /^[a-f0-9]{40}$/);
  for (const value of [sourceFingerprint, buildInputFingerprint]) {
    assert.match(value?.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(value.files) && value.files > 0);
    assert.ok(Number.isSafeInteger(value.bytes) && value.bytes >= 0);
  }
}

/** Returns only after the new owned directory has its complete manifest. */
export async function captureEmittedPreview({
  directory,
  root,
  entries,
  auditReportPath,
  sourceRevision,
  sourceFingerprint,
  buildInputFingerprint,
  limits = EMITTED_PREVIEW_LIMITS,
}) {
  root = await realpath(root);
  sourceIdentity({ sourceRevision, sourceFingerprint, buildInputFingerprint });
  for (const [key, maximum] of Object.entries(EMITTED_PREVIEW_LIMITS))
    assert.ok(
      Number.isSafeInteger(limits[key]) && limits[key] >= 0 && limits[key] <= maximum,
      `Invalid preview bound: ${key}`,
    );
  const target = path.resolve(root, directory);
  const relativeDirectory = inside(root, target);
  const reportPath = inside(root, path.resolve(root, auditReportPath));
  assert.ok(reportPath.endsWith('.json'));
  const items = [...(entries instanceof Map ? entries.values() : entries)].sort((a, b) =>
    Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)),
  );
  assert.ok(
    items.length > 0 && items.length <= limits.files,
    'Emitted inventory exceeds its file bound.',
  );
  const names = new Set();
  for (const item of items) {
    relative(item.name);
    assert.ok(Buffer.isBuffer(item.bytes), `Expected emitted bytes: ${item.name}`);
    assert.ok(!names.has(item.name), `Duplicate emitted path: ${item.name}`);
    names.add(item.name);
  }
  await mkdir(path.dirname(target), { recursive: true });
  const parent = await realpath(path.dirname(target));
  assert.equal(parent, path.dirname(target), 'Preview parent cannot traverse a symbolic link.');
  let owned = false;
  try {
    await mkdir(target);
    owned = true;
    await mkdir(path.join(target, 'blobs'));
    const files = [],
      blobs = new Set();
    let deltaFiles = 0,
      deltaBytes = 0;
    for (const item of items) {
      const descriptor = pin(item.name, item.bytes);
      let unchanged = false;
      try {
        const { file, stat } = await localFile(root, item.name);
        if (stat.size === descriptor.bytes)
          unchanged = sha(await readFile(file)) === descriptor.sha256;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (unchanged) {
        files.push({ ...descriptor, storage: 'source' });
        continue;
      }
      deltaFiles++;
      assert.ok(deltaFiles <= limits.deltaFiles, 'Emitted delta exceeds its file bound.');
      assert.ok(
        descriptor.bytes <= limits.bodyBytes,
        `Emitted delta body exceeds its byte bound: ${item.name}`,
      );
      if (!blobs.has(descriptor.sha256)) {
        deltaBytes += descriptor.bytes;
        assert.ok(deltaBytes <= limits.deltaBytes, 'Emitted delta exceeds its total byte bound.');
        await writeFile(path.join(target, 'blobs', descriptor.sha256), item.bytes, { flag: 'wx' });
        blobs.add(descriptor.sha256);
      }
      files.push({ ...descriptor, storage: 'blob' });
    }
    const inventorySHA256 = sha(JSON.stringify(inventory(files)));
    const manifest = {
      format,
      sourceRevision,
      sourceFingerprint,
      buildInputFingerprint,
      auditReportPath: reportPath,
      inventorySHA256,
      files,
      deltaFiles,
      deltaBlobs: blobs.size,
      deltaBytes,
      limits,
    };
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    assert.ok(
      bytes.length <= limits.manifestBytes,
      'Emitted preview manifest exceeds its byte bound.',
    );
    await writeFile(path.join(target, 'manifest.json'), bytes, { flag: 'wx' });
    return {
      complete: true,
      directory: relativeDirectory,
      manifestPath: `${relativeDirectory}/manifest.json`,
      manifestSHA256: sha(bytes),
      files: files.length,
      deltaFiles,
      deltaBlobs: blobs.size,
      deltaBytes,
      inventorySHA256,
    };
  } catch (error) {
    if (owned) {
      try {
        await rm(target, { recursive: true, force: true });
      } catch (cleanup) {
        error.previewCleanup = { directory: target, error: String(cleanup) };
      }
    }
    throw error;
  }
}

/** Unknown, omitted, changed, or unadmitted outputs never fall back to source. */
export async function openEmittedPreview(directory, { root, verifySource = false } = {}) {
  assert.equal(typeof verifySource, 'boolean');
  root = await realpath(root);
  const supplied = path.resolve(root, directory);
  const target = await realpath(supplied);
  assert.equal(target, supplied, 'Preview directory cannot traverse a symbolic link.');
  const relativeDirectory = inside(root, target);
  const bytes = await readBounded(target, 'manifest.json', EMITTED_PREVIEW_LIMITS.manifestBytes);
  const manifestSHA256 = sha(bytes),
    manifest = JSON.parse(bytes);
  assert.equal(manifest.format, format);
  sourceIdentity(manifest);
  assert.ok(
    Array.isArray(manifest.files) &&
      manifest.files.length > 0 &&
      manifest.files.length <= EMITTED_PREVIEW_LIMITS.files,
  );
  const files = new Map(),
    blobs = new Map();
  let deltaFiles = 0;
  for (const file of manifest.files) {
    validPin(file);
    assert.ok(!files.has(file.path), `Duplicate emitted path: ${file.path}`);
    assert.ok(['source', 'blob'].includes(file.storage));
    files.set(file.path, Object.freeze({ ...file }));
    if (file.storage === 'blob') {
      assert.ok(file.bytes <= EMITTED_PREVIEW_LIMITS.bodyBytes);
      assert.ok(!blobs.has(file.sha256) || blobs.get(file.sha256) === file.bytes);
      blobs.set(file.sha256, file.bytes);
      deltaFiles++;
    }
  }
  const deltaBytes = [...blobs.values()].reduce((n, value) => n + value, 0);
  assert.ok(
    deltaFiles <= EMITTED_PREVIEW_LIMITS.deltaFiles &&
      deltaBytes <= EMITTED_PREVIEW_LIMITS.deltaBytes,
  );
  assert.equal(manifest.deltaFiles, deltaFiles);
  assert.equal(manifest.deltaBlobs, blobs.size);
  assert.equal(manifest.deltaBytes, deltaBytes);
  assert.equal(manifest.inventorySHA256, sha(JSON.stringify(inventory(manifest.files))));
  const audit = JSON.parse(
    await readBounded(root, relative(manifest.auditReportPath), 32 * 1024 * 1024),
  );
  assert.equal(audit.complete, true, 'Only a completed emitted audit authorizes preview.');
  assert.equal(audit.headStable, true);
  assert.equal(audit.sourceStable, true);
  assert.equal(audit.sourceRevision, manifest.sourceRevision);
  assert.deepEqual(audit.sourceFingerprint, manifest.sourceFingerprint);
  assert.deepEqual(audit.buildInputFingerprint, manifest.buildInputFingerprint);
  assert.equal(audit.emittedPreview?.complete, true);
  assert.equal(audit.emittedPreview.directory, relativeDirectory);
  assert.equal(audit.emittedPreview.manifestPath, `${relativeDirectory}/manifest.json`);
  assert.equal(audit.emittedPreview.manifestSHA256, manifestSHA256);
  assert.equal(audit.emittedPreview.inventorySHA256, manifest.inventorySHA256);
  const published = JSON.parse(
    await readBounded(
      root,
      manifest.auditReportPath.replace(/\.json$/, '.inventory.json'),
      8 * 1024 * 1024,
    ),
  );
  assert.equal(published.sourceRevision, manifest.sourceRevision);
  assert.deepEqual(
    published.files,
    inventory(manifest.files),
    'Capture must cover the complete actual emitted inventory.',
  );
  let sourceVerification = null;
  if (verifySource) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    assert.equal(head, manifest.sourceRevision, 'Emitted capture belongs to a different HEAD.');
    const runtime = await fingerprintDemoSources(root);
    assert.deepEqual(
      runtime,
      manifest.sourceFingerprint,
      'Runtime differs from the emitted capture.',
    );
    const buildInput = await fingerprintDemoSources(root, ['scripts', 'authoring']);
    assert.deepEqual(
      buildInput,
      manifest.buildInputFingerprint,
      'Build inputs differ from the emitted capture.',
    );
    sourceVerification = { head, runtime, buildInput };
  }
  return {
    manifest,
    manifestSHA256,
    sourceVerification,
    has: (name) => files.has(name),
    async read(name) {
      const descriptor = files.get(name);
      if (!descriptor) throw missing(name);
      const body =
        descriptor.storage === 'source'
          ? await readBounded(root, name, descriptor.bytes)
          : await readBounded(target, `blobs/${descriptor.sha256}`, descriptor.bytes);
      assert.equal(body.length, descriptor.bytes, `Emitted length mismatch: ${name}`);
      assert.equal(sha(body), descriptor.sha256, `Emitted identity mismatch: ${name}`);
      return body;
    },
  };
}
