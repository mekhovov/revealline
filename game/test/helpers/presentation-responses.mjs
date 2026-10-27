import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LIMITS } from '../../presentation/model.mjs';
import { validateCompiledPresentation } from '../../presentation/host.mjs';
import { soloPage as originalSoloPage } from './solo-dom.mjs';

const prefix = '/game/presentation/compiled/';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Opt-in immutable fixture network responses, not page/DOM/store/ready caches.
 * The caller's request hook always runs first, including held/failed originals.
 * The host still validates and decodes each requested response normally. */
export function createPresentationResponses(entries) {
  const files = new Map();
  let total = 0;
  for (const [path, source] of entries) {
    assert.equal(typeof path, 'string', 'Use a compiled fixture path.');
    const asset = path.match(
      /^\/game\/presentation\/compiled\/assets\/([a-f0-9]{64})\.(png|jpg|webp|ttf|otf|woff2|wav|ogg|mp3)$/,
    );
    assert(path === prefix + 'runtime.json' || asset, 'Use a compiled fixture path.');
    assert(!files.has(path), 'No duplicate compiled fixture paths.');
    assert(source instanceof Uint8Array, 'Use exact fixture byte arrays.');
    const bytes = new Uint8Array(source);
    if (asset) assert.equal(digest(bytes), asset[1], 'Compiled fixture hash mismatch.');
    total += bytes.length;
    assert(
      total <= LIMITS.bundleBytes + LIMITS.manifestBytes,
      'Compiled fixture exceeds the existing byte budget.',
    );
    files.set(path, bytes);
    assert(
      files.size <= LIMITS.slots + 1,
      'Compiled fixture exceeds the existing resource budget.',
    );
  }
  return Object.freeze({
    wrap(custom) {
      return async (path, options) => {
        const response = await custom?.(path, options);
        if (response !== undefined && response !== null) return response;
        const url = new URL(String(path), 'http://localhost/game/');
        const bytes = files.get(url.pathname);
        if (!bytes) return;
        assert.equal(url.origin, 'http://localhost', 'Compiled fixture request origin differs.');
        if (url.search || url.hash) return;
        if (options?.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
        return new Response(new Uint8Array(bytes));
      };
    },
  });
}

export async function loadPresentationResponses({ read = readFile } = {}) {
  const base = new URL('../../presentation/compiled/', import.meta.url);
  const runtime = await read(new URL('runtime.json', base));
  assert(
    runtime.length <= LIMITS.manifestBytes,
    'Compiled fixture manifest exceeds its byte budget.',
  );
  const manifest = validateCompiledPresentation(
    new TextDecoder('utf-8', { fatal: true }).decode(runtime),
  );
  const facts = new Map(
    Object.values(manifest.resolved.assets)
      .filter((asset) => asset.file)
      .map((asset) => [asset.file.sha256, asset.file]),
  );
  const files = new Map([[prefix + 'runtime.json', runtime]]);
  for (const [hash, relative] of Object.entries(manifest.urls)) {
    const bytes = await read(new URL(relative, base));
    assert.equal(bytes.length, facts.get(hash).bytes, 'Compiled fixture byte length mismatch.');
    assert.equal(digest(bytes), hash, 'Compiled fixture hash mismatch.');
    files.set(prefix + relative.slice(2), bytes);
  }
  return createPresentationResponses(files);
}

let compiledFixture;
/** Only immutable source host tests opt in. All original per-page options and
 * request hooks remain authoritative; no test deadline or app rule changes. */
export async function presentationSoloPage(t, options = {}) {
  const responses = await (compiledFixture ??= loadPresentationResponses());
  return originalSoloPage(t, { ...options, fetchResponse: responses.wrap(options.fetchResponse) });
}
