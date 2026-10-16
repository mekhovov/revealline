import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryLocker } from '@tus/server';
import { createCommunityClient } from '../../../game/community/client.mjs';
import { createTusBrowserUpload } from '../../../game/community/tus-upload.mjs';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import { PACKAGE_MEDIA_TYPE, packageBlobKey } from '../src/domain.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';
import { createCommunityTusServer } from '../src/tus-server.mjs';
import { TusUploadTransportBoundary } from '../src/upload-transport.mjs';
import { startTusFaultProxy } from './tus-fault-proxy.mjs';

const OWNER = 'creator/fault-proxy';
const TOKEN = 'fault-proxy-token';
const bearer = () => ({ authorization: `Bearer ${TOKEN}` });

const collect = async (body) => {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const bounded = async (promise, timeoutMs) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Acceptance exceeded ${timeoutMs}ms.`)),
          timeoutMs,
        );
        timer.unref();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export async function runTusResumeAcceptance({
  payload = Buffer.from(
    'RevealLine tus recovery acceptance bytes: 0123456789 abcdefghijklmnopqrstuvwxyz.',
  ),
  dropAfterBytes = 17,
  chunkBytes = 48,
  timeoutMs = 10_000,
} = {}) {
  assert.ok(Buffer.isBuffer(payload) && payload.length > chunkBytes);
  assert.ok(dropAfterBytes > 0 && dropAfterBytes < chunkBytes);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'revealline-tus-fault-'));
  const repository = new MemoryCommunityRepository();
  const blobStore = new MemoryBlobStore();
  const authenticator = createTokenAuthenticator({ [TOKEN]: OWNER });
  const tus = createCommunityTusServer({
    directory: temporaryRoot,
    authenticator,
    repository,
    blobStore,
    maxPackageBytes: 1024 * 1024,
    locker: new MemoryLocker(),
    expirationMs: 60_000,
    cleanupIntervalMs: 60_000,
  });
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator,
    maxPackageBytes: 1024 * 1024,
    uploadTransport: new TusUploadTransportBoundary({ endpoint: '/v1/uploads' }),
    tus,
  });
  let proxy = null;
  try {
    await app.ready();
    const upstreamOrigin = await app.listen({ host: '127.0.0.1', port: 0 });
    proxy = await startTusFaultProxy({
      upstreamURL: upstreamOrigin,
      dropAfterBytes,
      maximumRequestBytes: 1024 * 1024,
      requestTimeoutMs: Math.min(timeoutMs, 5_000),
    });

    const retained = new Map();
    const resumableUpload = createTusBrowserUpload({
      baseURL: proxy.origin,
      fetchImpl: fetch,
      chunkBytes,
      storage: {
        getItem: (key) => retained.get(key) ?? null,
        setItem: (key, value) => retained.set(key, value),
        removeItem: (key) => retained.delete(key),
      },
    });
    const client = createCommunityClient({
      baseURL: proxy.origin,
      fetchImpl: fetch,
      authHeaders: bearer,
      resumableUpload,
    });
    const packageSha256 = createHash('sha256').update(payload).digest('hex');
    const created = await client.createSubmission({
      slug: 'tus-fault-proxy',
      title: 'Tus fault proxy acceptance',
      description: 'Local resumable upload recovery proof.',
      version: '1.0.0',
      packageSha256,
      packageSize: payload.length,
    });
    const blob = new Blob([payload], { type: PACKAGE_MEDIA_TYPE });
    const firstProgress = [];
    await assert.rejects(
      bounded(
        client.uploadSubmission(created, blob, {
          onProgress: ({ uploaded }) => firstProgress.push(uploaded),
        }),
        timeoutMs,
      ),
      /Upload interrupted at 0 bytes/u,
    );
    assert.equal(retained.size, 1, 'Interrupted upload URL must remain available for recovery.');

    const resumedProgress = [];
    const uploaded = await bounded(
      client.uploadSubmission(created, blob, {
        onProgress: ({ uploaded: offset }) => resumedProgress.push(offset),
      }),
      timeoutMs,
    );
    assert.equal(uploaded.uploaded, payload.length);
    assert.equal(resumedProgress[0], dropAfterBytes, 'Client must begin at the HEAD offset.');
    assert.equal(retained.size, 0, 'Completed upload must remove its retained URL.');

    const queued = await client.submit(created.submission.id);
    assert.equal(queued.submission.status, 'queued');
    const stored = await blobStore.open(packageBlobKey(packageSha256));
    assert.ok(stored, 'Completed package bytes were not admitted.');
    const storedBytes = await collect(stored.body);
    assert.deepEqual(storedBytes, payload, 'Resumed upload changed or duplicated package bytes.');

    const network = proxy.snapshot();
    assert.equal(network.submissionCreates, 1, 'Recovery created another submission.');
    assert.equal(network.uploadCreates, 1, 'Recovery created another tus resource.');
    assert.equal(network.faultInjected, true);
    assert.equal(network.committedBeforeDrop, dropAfterBytes);
    assert.deepEqual(network.headOffsets, [dropAfterBytes]);
    const expectedPatchOffsets = [0];
    for (let offset = dropAfterBytes; offset < payload.length; offset += chunkBytes)
      expectedPatchOffsets.push(offset);
    assert.deepEqual(network.patchOffsets, expectedPatchOffsets);

    return Object.freeze({
      passed: true,
      submissionId: created.submission.id,
      packageSha256,
      payloadBytes: payload.length,
      firstProgress: Object.freeze(firstProgress),
      resumedProgress: Object.freeze(resumedProgress),
      network,
      finalStatus: queued.submission.status,
      bytesMatch: true,
    });
  } finally {
    if (proxy) await proxy.close();
    await app.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const result = await runTusResumeAcceptance();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
