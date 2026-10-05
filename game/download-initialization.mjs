import { validateDownloadCatalogue } from './download-catalogue.mjs';

const failure = (key) =>
  Object.assign(new Error(key), { localization: { key: `interface:downloads.${key}` } });

/** Load both manifests before exposing any download actions. A failed/late load
 * never changes the installed edition, checkpoints or downloaded bytes. */
export async function loadDownloadMetadata({
  baseURL,
  buildId,
  updating = false,
  fetch: request = globalThis.fetch,
  timeoutMs = 30000,
  signal,
}) {
  const controller = new AbortController();
  let timer, onAbort;
  try {
    signal?.throwIfAborted();
    const stopped = new Promise((_, reject) => {
      onAbort = () => {
        controller.abort();
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        reject(failure('loadingTimedOut'));
        controller.abort();
      }, timeoutMs);
    });
    const loaded = Promise.all(
      ['offline-content.json', 'offline-cache.json'].map(async (path) => {
        const response = await request(new URL(path, baseURL), {
          signal: controller.signal,
          ...(updating ? { cache: 'no-store' } : {}),
        });
        if (!response.ok) throw failure('catalogueMissing');
        return response.json();
      }),
    );
    const [catalogue, core] = await Promise.race([loaded, stopped]);
    validateDownloadCatalogue(catalogue);
    if (
      core?.buildId !== buildId ||
      !Array.isArray(core.files) ||
      !core.files.length ||
      core.files.some(
        (file) =>
          typeof file?.path !== 'string' ||
          !file.path.length ||
          !Number.isSafeInteger(file.bytes) ||
          file.bytes < 0 ||
          !/^[a-f0-9]{64}$/.test(file.sha256),
      )
    )
      throw failure('publishedBuildChanged');
    return { catalogue, core };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    controller.abort();
  }
}
