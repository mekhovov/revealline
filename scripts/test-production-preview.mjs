import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { parsePreviewRange, startProductionPreview } from './serve-production-preview.mjs';

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
  const preview = await startProductionPreview({ root, port: 0, ...options });
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
