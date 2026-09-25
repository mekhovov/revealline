/** Official, immutable downloads. User imports and profile data never live here. */
export const OFFICIAL_CACHE = 'revealline-official-content-v1';
export const DOWNLOAD_STATE_CACHE = 'revealline-official-downloads-v1';
export const OFFICIAL_ORIGINAL_INDEX = 'revealline-official-original-index-v1';
export const OFFICIAL_REFERENCE_MIME = 'application/x-revealline-official-reference';
const hashPattern = /^[a-f0-9]{64}$/;
const limit = 32 * 1024 * 1024;
export const officialAssetURL = (hash, origin = globalThis.location?.origin) => {
  if (!hashPattern.test(hash)) throw new Error('Invalid official asset identity.');
  return new URL(`/.revealline-official/sha256/${hash}`, origin).href;
};
export async function assetDigest(bytes, cryptoRef = globalThis.crypto) {
  return [...new Uint8Array(await cryptoRef.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
function checkFile(file) {
  if (
    !hashPattern.test(file?.sha256) ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 1 ||
    file.bytes > limit
  )
    throw new Error('Invalid official download descriptor.');
  return file;
}
function aborted(signal) {
  signal?.throwIfAborted();
}
/** Allocate at most one declared file; refuse redirects, partial and opaque responses. */
export async function verifiedDownload(
  file,
  url,
  { fetch: request = globalThis.fetch, signal, onBytes = () => {} } = {},
) {
  checkFile(file);
  const response = await request(url, { signal, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok || response.status === 206 || response.redirected || response.type === 'opaque')
    throw new Error(`Download failed: ${file.path || file.sha256} (HTTP ${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('This browser cannot read a download safely.');
  const buffer = new Uint8Array(file.bytes);
  let length = 0;
  try {
    for (;;) {
      aborted(signal);
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > file.bytes) throw new Error('Download exceeds its declared size.');
      buffer.set(value, length - value.byteLength);
      onBytes(length);
    }
    if (length !== file.bytes || (await assetDigest(buffer)) !== file.sha256)
      throw new Error('Downloaded file does not match its published hash and size.');
    aborted(signal);
    return new Blob([buffer], {
      type: file.mime || response.headers.get('Content-Type') || 'application/octet-stream',
    });
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function createOfficialDownloads({
  caches: cacheStorage = globalThis.caches,
  origin = globalThis.location?.origin,
  locks = globalThis.navigator?.locks,
  storage = globalThis.navigator?.storage,
  fetch: request = globalThis.fetch,
} = {}) {
  const key = (hash) => officialAssetURL(hash, origin);
  const stateKey = (edition, group) =>
    new URL(
      `/.revealline-official/groups/${encodeURIComponent(edition)}/${encodeURIComponent(group)}`,
      origin,
    ).href;
  const locked = (run, signal) => {
    if (!locks?.request) throw new Error('Safe downloads require a browser with Web Locks.');
    return locks.request('revealline.official-downloads.v1', { signal }, run);
  };
  async function read(hash, { verify = true } = {}) {
    if (!cacheStorage) return null;
    const cache = await cacheStorage.open(OFFICIAL_CACHE);
    const response = await cache.match(key(hash));
    if (!response || response.status !== 200) return null;
    const blob = await response.blob();
    if (blob.size > limit || (verify && (await assetDigest(await blob.arrayBuffer())) !== hash))
      return null;
    return blob;
  }
  async function states() {
    const cache = await cacheStorage.open(DOWNLOAD_STATE_CACHE);
    const result = [];
    for (const entry of await cache.keys()) {
      try {
        result.push(await (await cache.match(entry)).json());
      } catch {
        /* An incomplete checkpoint is not readiness evidence. */
      }
    }
    return result;
  }
  async function inspect(files, { verify = false, signal } = {}) {
    const cache = await cacheStorage.open(OFFICIAL_CACHE);
    const unique = [...new Map(files.map((file) => [checkFile(file).sha256, file])).values()];
    const missing = [],
      corrupt = [];
    let readyBytes = 0;
    for (const file of unique) {
      aborted(signal);
      const hit = await cache.match(key(file.sha256));
      if (!hit) {
        missing.push(file);
        continue;
      }
      if (
        hit.status !== 200 ||
        Number(hit.headers.get('Content-Length')) !== file.bytes ||
        (verify && (await assetDigest(await hit.arrayBuffer())) !== file.sha256)
      ) {
        corrupt.push(file);
      } else readyBytes += file.bytes;
    }
    const totalBytes = unique.reduce((sum, file) => sum + file.bytes, 0);
    return {
      ready: missing.length === 0 && corrupt.length === 0,
      totalBytes,
      readyBytes,
      remainingBytes: totalBytes - readyBytes,
      missing,
      corrupt,
    };
  }
  async function estimate(files, report = null) {
    report ||= await inspect(files);
    const space = await storage?.estimate?.().catch(() => null);
    // Browser accounting/compression varies. A file can coexist with its response and transaction.
    const largest = Math.max(
      0,
      ...[...report.missing, ...report.corrupt].map((file) => file.bytes),
    );
    return {
      ...report,
      temporaryBytes: largest,
      requiredBytes: report.remainingBytes + largest,
      availableBytes:
        space?.quota === undefined ? null : Math.max(0, space.quota - (space.usage || 0)),
    };
  }
  async function download({
    edition,
    group,
    files,
    baseURL,
    signal,
    acquire,
    readExisting,
    selection,
    onProgress = () => {},
  }) {
    const unique = [...new Map(files.map((file) => [checkFile(file).sha256, file])).values()];
    return locked(async () => {
      aborted(signal);
      const data = await cacheStorage.open(OFFICIAL_CACHE),
        metadata = await cacheStorage.open(DOWNLOAD_STATE_CACHE);
      const checkpoint = {
        edition,
        group,
        hashes: unique.map((file) => file.sha256),
        complete: false,
        ...(selection ? { selection } : {}),
      };
      await metadata.put(stateKey(edition, group), new Response(JSON.stringify(checkpoint)));
      let report = await inspect(unique, { verify: true, signal });
      onProgress({ ...report, status: 'downloading', currentBytes: 0 });
      const space = await estimate(unique, report);
      if (space.availableBytes !== null && space.requiredBytes > space.availableBytes)
        throw new Error(
          'Not enough estimated storage. Remove an optional download or free device space; your working game and saves are kept.',
        );
      let completedBytes = report.readyBytes;
      for (const file of [...report.missing, ...report.corrupt]) {
        aborted(signal);
        let blob = await readExisting?.(file);
        if (
          blob &&
          (blob.size !== file.bytes ||
            (await assetDigest(await blob.arrayBuffer())) !== file.sha256)
        )
          blob = null;
        if (!blob)
          blob = acquire
            ? await acquire(file, { signal })
            : await verifiedDownload(file, new URL(file.path, baseURL), {
                fetch: request,
                signal,
                onBytes: (currentBytes) =>
                  onProgress({
                    ...report,
                    status: 'downloading',
                    readyBytes: completedBytes,
                    remainingBytes: report.totalBytes - completedBytes - currentBytes,
                    currentBytes,
                    file: file.path,
                  }),
              });
        aborted(signal);
        if (
          !(blob instanceof Blob) ||
          blob.size !== file.bytes ||
          (await assetDigest(await blob.arrayBuffer())) !== file.sha256
        )
          throw new Error('Downloaded file failed final integrity verification.');
        // Each put is atomic and is the durable completed-file checkpoint. Never roll back good files.
        await data.put(
          key(file.sha256),
          new Response(blob, {
            headers: {
              'Content-Type': blob.type || file.mime || 'application/octet-stream',
              'Content-Length': String(file.bytes),
            },
          }),
        );
        completedBytes += file.bytes;
        onProgress({
          ...report,
          status: 'downloading',
          readyBytes: completedBytes,
          remainingBytes: report.totalBytes - completedBytes,
          currentBytes: 0,
        });
      }
      report = await inspect(unique, { verify: true, signal });
      if (!report.ready)
        throw new Error('Some downloaded files are missing or damaged. Resume to repair them.');
      await metadata.put(
        stateKey(edition, group),
        new Response(JSON.stringify({ ...checkpoint, complete: true })),
      );
      onProgress({ ...report, status: 'ready', currentBytes: 0 });
      return report;
    }, signal);
  }
  async function remove(edition, group) {
    return locked(async () => {
      const metadata = await cacheStorage.open(DOWNLOAD_STATE_CACHE);
      const previous = await metadata.match(stateKey(edition, group));
      if (!previous) return;
      const removed = await previous.json();
      await metadata.delete(stateKey(edition, group));
      const used = new Set((await states()).flatMap((state) => state.hashes || []));
      const data = await cacheStorage.open(OFFICIAL_CACHE);
      for (const hash of removed.hashes) if (!used.has(hash)) await data.delete(key(hash));
    });
  }
  async function retain({ edition, group, files, selection }) {
    return locked(async () => {
      const metadata = await cacheStorage.open(DOWNLOAD_STATE_CACHE);
      const previous = await metadata.match(stateKey(edition, group));
      if (!previous) return;
      const old = await previous.json();
      const hashes = [...new Set(files.map((file) => checkFile(file).sha256))];
      const health = await inspect(files, { verify: true });
      await metadata.put(
        stateKey(edition, group),
        new Response(JSON.stringify({ edition, group, selection, hashes, complete: health.ready })),
      );
      const used = new Set((await states()).flatMap((state) => state.hashes || []));
      const data = await cacheStorage.open(OFFICIAL_CACHE);
      for (const hash of old.hashes) if (!used.has(hash)) await data.delete(key(hash));
    });
  }
  return Object.freeze({ read, inspect, estimate, download, remove, retain, states });
}

/** Fail closed if browser storage is unavailable; never turn a local miss into a request. */
export async function readOfficialRecording(hash) {
  try {
    return await createOfficialDownloads().read(hash);
  } catch {
    return null;
  }
}
/** A prepared save/reference owns these bytes independently of the download selection. */
export async function pinOfficialFile(hash, owner) {
  if (!globalThis.caches) return;
  if (!globalThis.navigator?.locks)
    throw new Error('Keeping official save references requires Web Locks.');
  await navigator.locks.request('revealline.official-downloads.v1', async () => {
    if (!(await createOfficialDownloads().read(hash)))
      throw new Error('Download the matching chapter before restoring its saved reference.');
    const cache = await caches.open(DOWNLOAD_STATE_CACHE);
    const url = new URL(
      `/.revealline-official/owners/${encodeURIComponent(owner)}`,
      location.origin,
    );
    await cache.put(
      url.href,
      new Response(
        JSON.stringify({
          edition: 'saved-references',
          group: owner,
          hashes: [hash],
          complete: true,
        }),
      ),
    );
  });
}

/** Read an original directly from its verified bundle, without copying it into the import budget. */
export async function readOfficialOriginal(hash, { pin = false } = {}) {
  if (!globalThis.caches || !hashPattern.test(hash)) return null;
  const key = officialAssetURL(hash);
  const reference = await (await caches.open(OFFICIAL_ORIGINAL_INDEX)).match(key);
  if (!reference) return null;
  const file = await reference.json();
  if (
    file.sha256 !== hash ||
    !hashPattern.test(file.parent) ||
    !Number.isSafeInteger(file.offset) ||
    file.offset < 12 ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 1 ||
    file.bytes > limit
  )
    return null;
  const parent = await createOfficialDownloads().read(file.parent);
  if (!parent || file.offset + file.bytes > parent.size) return null;
  const blob = parent.slice(file.offset, file.offset + file.bytes, file.mime);
  if ((await assetDigest(await blob.arrayBuffer())) !== hash) return null;
  if (pin) await pinOfficialFile(file.parent, `original:${hash}`);
  return blob;
}

export async function localOfficialRecordingIds(catalogue) {
  try {
    const store = createOfficialDownloads(),
      ids = [];
    for (const track of catalogue.tracks)
      if ((await store.inspect([track.asset])).ready) ids.push(track.id);
    return ids;
  } catch {
    return [];
  }
}

/** Optional audio yields to gameplay and foreground lifecycle in every download surface. */
export async function withOptionalMusicDownload(
  signal,
  work,
  {
    document: doc = globalThis.document,
    BroadcastChannel: Channel = globalThis.BroadcastChannel,
  } = {},
) {
  const controller = new AbortController(),
    channel = Channel ? new Channel('revealline.game-activity.v1') : null;
  const abort = () => controller.abort();
  const visibility = () => {
    if (doc?.hidden) abort();
  };
  signal?.addEventListener('abort', abort, { once: true });
  doc?.addEventListener('visibilitychange', visibility);
  if (signal?.aborted || doc?.hidden) abort();
  if (channel)
    channel.onmessage = (event) => {
      if (event.data?.active || event.data?.gameplayDownload) abort();
    };
  try {
    channel?.postMessage({ probe: true });
    if (channel) await new Promise((resolve) => setTimeout(resolve, 100));
    controller.signal.throwIfAborted();
    return await work(controller.signal);
  } finally {
    signal?.removeEventListener('abort', abort);
    doc?.removeEventListener('visibilitychange', visibility);
    channel?.close();
  }
}
