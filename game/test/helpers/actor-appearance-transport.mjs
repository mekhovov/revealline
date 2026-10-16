import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = new URL('../../presentation/compiled/', import.meta.url);
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const cache = new Map();
async function bytesFor(relative) {
  if (!cache.has(relative))
    cache.set(
      relative,
      (async () => {
        try {
          return await readFile(new URL(relative, directory));
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          // Read omitted sparse-checkout fixtures verbatim, never synthesize an
          // approved source or create a second asset collection on disk.
          return execFileSync('git', ['show', `HEAD:game/presentation/compiled/${relative}`], {
            cwd: repository,
            maxBuffer: 2 * 1024 * 1024,
          });
        }
      })(),
    );
  return cache.get(relative);
}

/** Real manifest/asset bytes and production hash checks, modeled bitmap decode.
 * Intercepts only this compiled directory; all other host requests retain their
 * previous transport. This is not native image decoding or visual acceptance.
 */
export function installActorAppearanceTransport({
  install,
  baseURL,
  beforeRequest = async () => {},
  upstream = globalThis.fetch,
} = {}) {
  const base = new URL(baseURL).href,
    requests = [],
    decoded = [];
  const fetch = async (input, options = {}) => {
    const url = new URL(input, base).href;
    if (!url.startsWith(base)) return upstream(input, options);
    const relative = url.slice(base.length);
    if (
      !/^(runtime(?:\.[a-f0-9]{64})?\.json|assets\/[a-f0-9]{64}\.(png|jpg|webp|ttf|otf|woff2))$/.test(
        relative,
      )
    )
      return upstream(input, options);
    requests.push({ relative, options });
    const replacement = await beforeRequest({ relative, options, requests });
    if (options.signal?.aborted) throw new DOMException('Cancelled fixture request.', 'AbortError');
    if (replacement !== undefined) return replacement;
    return new Response(await bytesFor(relative));
  };
  const decode = async (source, ...crop) => {
    let width, height, sha256;
    if (source instanceof Blob) {
      const bytes = Buffer.from(await source.arrayBuffer());
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
        throw new Error('Actor fixture only models PNG bitmap headers.');
      width = bytes.readUInt32BE(16);
      height = bytes.readUInt32BE(20);
      sha256 = createHash('sha256').update(bytes).digest('hex');
    } else {
      width = crop[2];
      height = crop[3];
      sha256 = source.sha256;
    }
    const image = {
      width,
      height,
      sha256,
      closes: 0,
      close() {
        this.closes++;
      },
    };
    decoded.push(image);
    return image;
  };
  install('fetch', { value: fetch, writable: true });
  install('createImageBitmap', { value: decode, writable: true });
  return { requests, decoded };
}
