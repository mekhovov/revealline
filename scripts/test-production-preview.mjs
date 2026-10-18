import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { parsePreviewRange, startProductionPreview } from './serve-production-preview.mjs';
import { captureEmittedPreview } from './emitted-preview.mjs';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'solo-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, '.xonix-build.json'),
    JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }),
  );
  await writeFile(
    path.join(root, '_headers'),
    '/*\n' +
      Object.entries(PUBLIC_SECURITY_HEADERS)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n'),
  );
  await writeFile(
    path.join(root, 'index.html'),
    '<meta name="revealline-access-salt" content="original-salt"><meta name="revealline-access-verifier" content="original-verifier"><script src="./runtime.mjs"></script>',
  );
  await writeFile(path.join(root, 'runtime.mjs'), 'export const untouched = true;');
  await writeFile(path.join(root, 'recording.mp3'), '0123456789');
  const { emitted = false, ...previewOptions } = options;
  let emittedPreview;
  if (emitted) {
    const names = ['.xonix-build.json', '_headers', 'index.html', 'runtime.mjs', 'recording.mp3'];
    const entries = await Promise.all(
      names.map(async (name) => ({ name, bytes: await readFile(path.join(root, name)) })),
    );
    entries.find((entry) => entry.name === 'runtime.mjs').bytes = Buffer.from(
      'export const published = true;',
    );
    entries.push({
      name: 'nested/index.html',
      bytes: Buffer.from('<title>Published nested page</title>'),
    });
    entries.push({ name: 'service-worker.js', bytes: Buffer.from('/* exact emitted worker */') });
    const sourceRevision = 'a'.repeat(40);
    const fingerprint = { sha256: 'b'.repeat(64), files: 1, bytes: 1 };
    const descriptor = await captureEmittedPreview({
      directory: 'capture',
      root,
      entries,
      auditReportPath: 'audit.json',
      sourceRevision,
      sourceFingerprint: fingerprint,
      buildInputFingerprint: fingerprint,
    });
    await writeFile(
      path.join(root, 'audit.json'),
      JSON.stringify({
        complete: true,
        headStable: true,
        sourceStable: true,
        sourceRevision,
        sourceFingerprint: fingerprint,
        buildInputFingerprint: fingerprint,
        emittedPreview: descriptor,
      }),
    );
    await writeFile(
      path.join(root, 'audit.inventory.json'),
      JSON.stringify({
        sourceRevision,
        files: entries
          .sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)))
          .map(({ name, bytes }) => ({
            path: name,
            bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          })),
      }),
    );
    emittedPreview = descriptor.directory;
    await writeFile(path.join(root, 'omitted.mjs'), 'not published');
  }
  const preview = await startProductionPreview({
    root,
    port: 0,
    ...previewOptions,
    emittedPreview,
  });
  t.after(async () => {
    preview.server.closeAllConnections();
    await new Promise((done) => preview.server.close(done));
  });
  return preview;
}

test('local fixture changes only access metadata and keeps exact production policy', async (t) => {
  const original = await fixture(t);
  const source = await fetch(original.url);
  assert.match(await source.text(), /original-salt/);
  for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
    assert.equal(source.headers.get(key), value);
  const admitted = await fixture(t, { fixtureAccess: true, cache: 'revalidate' });
  const response = await fetch(admitted.url);
  const html = await response.text();
  assert.match(html, /cGVyZm9ybWFuY2UtZml4dHVyZQ/);
  assert.doesNotMatch(html, /original-(salt|verifier)/);
  for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
    if (key.toLowerCase() !== 'cache-control') assert.equal(response.headers.get(key), value);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(
    await (await fetch(admitted.url + 'runtime.mjs')).text(),
    'export const untouched = true;',
  );
  const cached = await fetch(admitted.url, {
    headers: { 'If-None-Match': response.headers.get('etag') },
  });
  assert.equal(cached.status, 304);
  assert.equal(await cached.text(), '');
});

test('streamed media supports bounded byte ranges and rejects malformed ranges', async (t) => {
  const preview = await fixture(t);
  for (const [range, body, contentRange] of [
    ['bytes=2-4', '234', 'bytes 2-4/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
  ]) {
    const response = await fetch(preview.url + 'recording.mp3', { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), contentRange);
    assert.equal(Number(response.headers.get('content-length')), body.length);
    assert.equal(await response.text(), body);
  }
  const invalid = await fetch(preview.url + 'recording.mp3', { headers: { Range: 'bytes=10-' } });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get('content-range'), 'bytes */10');
  const head = await fetch(preview.url + 'recording.mp3', {
    method: 'HEAD',
    headers: { Range: 'bytes=2-4' },
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '10');
  for (const range of [
    'bytes=-0',
    'bytes=-',
    'bytes=9-2',
    'bytes=0-1,3-4',
    'bytes=99999999999999999999-',
    'bytes=-99999999999999999999',
  ])
    assert.equal(parsePreviewRange(range, 10), null);
  assert.equal(parsePreviewRange('bytes=0-', 0), null);
  assert.deepEqual(parsePreviewRange('bytes=-100', 10), { start: 0, end: 9 });
});

test('preview remains loopback-only and refuses private files or policy drift', async (t) => {
  const preview = await fixture(t);
  assert.equal(preview.server.address().address, '127.0.0.1');
  assert.equal((await fetch(preview.url + '.xonix-build.json')).status, 403);
  await writeFile(
    path.join(preview.root, '_headers'),
    '/*\n  Content-Security-Policy: default-src *',
  );
  await assert.rejects(startProductionPreview({ root: preview.root, port: 0 }), /policy drift/);
});

test('captured preview serves exact emitted bytes, preserves HTTP behavior and rejects source drift', async (t) => {
  const preview = await fixture(t, { emitted: true, fixtureAccess: true, cache: 'revalidate' });
  assert.equal(preview.mode, 'generated-build');
  assert.match(preview.emittedPreview.manifestSHA256, /^[a-f0-9]{64}$/);
  const response = await fetch(preview.url);
  assert.match(await response.text(), /cGVyZm9ybWFuY2UtZml4dHVyZQ/);
  assert.equal(preview.fixtureResponses.length, 1);
  const [html] = preview.fixtureResponses;
  assert.equal(html.path, 'index.html');
  assert.notEqual(html.original.sha256, html.served.sha256);
  assert.equal(response.headers.get('etag'), `"${html.served.sha256}"`);
  assert.equal(
    response.headers.get('content-security-policy'),
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
  );
  assert.equal(
    await (await fetch(preview.url + 'runtime.mjs')).text(),
    'export const published = true;',
  );
  assert.equal(
    await (await fetch(preview.url + 'service-worker.js')).text(),
    '/* exact emitted worker */',
  );
  assert.equal((await fetch(preview.url + 'omitted.mjs')).status, 404);
  const redirect = await fetch(preview.url + 'nested?ready=1', { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/nested/?ready=1');
  assert.match(await (await fetch(preview.url + 'nested/')).text(), /Published nested page/);
  const ranged = await fetch(preview.url + 'recording.mp3', { headers: { Range: 'bytes=2-4' } });
  assert.equal(ranged.status, 206);
  assert.equal(await ranged.text(), '234');
  assert.equal(
    (await fetch(preview.url + 'recording.mp3', { method: 'HEAD' })).headers.get('content-length'),
    '10',
  );
  // Verify bytes even when a client offers the previously accepted validator.
  const original = await fetch(preview.url + 'recording.mp3');
  await original.arrayBuffer();
  await writeFile(path.join(preview.root, 'recording.mp3'), 'abcdefghij');
  assert.equal(
    (
      await fetch(preview.url + 'recording.mp3', {
        headers: { 'If-None-Match': original.headers.get('etag') },
      })
    ).status,
    403,
  );
  const manifest = JSON.parse(
    await readFile(path.join(preview.emittedPreview.directory, 'manifest.json')),
  );
  const module = manifest.files.find((file) => file.path === 'runtime.mjs');
  await writeFile(
    path.join(preview.emittedPreview.directory, 'blobs', module.sha256),
    'export const published = nope;',
  );
  assert.equal((await fetch(preview.url + 'runtime.mjs')).status, 403);
});
