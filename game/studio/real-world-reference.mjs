import { authoringError } from '../content-design/authoring-error.mjs';

export const SYNEVYR_REFERENCE = Object.freeze({
  id: 'synevyr-rafts',
  name: 'Rafts on Synevyr Lake.jpg',
  path: 'content-design/assets/real-world-r1/synevyr-rafts.jpg',
  type: 'image/jpeg',
  bytes: 124649,
  sha256: '3ca8b4caf48a016e2e9c59afb8bcce45d5e93451a82496f099b644fe37837de8',
  width: 960,
  height: 540,
});

const failed = () =>
  authoringError(
    'The bundled reference could not be verified. Your current reference is intact.',
    'errors:studio.image.bundledFailed',
  );

/** Only the pinned local JPEG is fetched. The returned File still goes through
 * loadMapReference's image-header and decoded-dimension checks before acceptance. */
export async function loadBundledReference({
  signal,
  fetchAsset = (path, options) => fetch(new URL(path, new URL('../', import.meta.url)), options),
  digest = (bytes) => crypto.subtle.digest('SHA-256', bytes),
} = {}) {
  const pin = SYNEVYR_REFERENCE;
  const controller = new AbortController();
  let reader, timer, cancel;
  const stopped = new Promise((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException('Reference loading cancelled.', 'AbortError'));
    };
    timer = setTimeout(() => {
      controller.abort();
      reject(failed());
    }, 10000);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
  });
  const check = () => {
    if (controller.signal.aborted)
      throw new DOMException('Reference loading cancelled.', 'AbortError');
  };
  try {
    return await Promise.race([
      stopped,
      Promise.resolve().then(async () => {
        check();
        const response = await fetchAsset(pin.path, {
          signal: controller.signal,
          redirect: 'error',
          cache: 'no-store',
        });
        if (controller.signal.aborted) {
          void response.body?.cancel?.().catch(() => {});
          check();
        }
        reader = response.body?.getReader?.();
        if (
          !response.ok ||
          response.redirected ||
          !reader ||
          response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase() !== pin.type
        )
          throw failed();
        const bytes = new Uint8Array(pin.bytes);
        let length = 0;
        for (;;) {
          const { done, value } = await reader.read();
          check();
          if (done) break;
          if (!(value instanceof Uint8Array) || length + value.byteLength > bytes.length)
            throw failed();
          bytes.set(value, length);
          length += value.byteLength;
        }
        if (length !== pin.bytes) throw failed();
        const hash = Array.from(new Uint8Array(await digest(bytes)), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
        check();
        if (hash !== pin.sha256) throw failed();
        return new File([bytes], pin.name, { type: pin.type });
      }),
    ]);
  } catch (error) {
    if (error?.name === 'AbortError' && signal?.aborted) throw error;
    throw failed();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
    try {
      if (reader) void Promise.resolve(reader.cancel()).catch(() => {});
    } catch {
      // An already closed reader needs no further cleanup.
    }
  }
}
