/** Streamed HTTP/MIME core adapted from the independently reviewed Archive09 auditor. */
import path from 'node:path';
import { createHash } from 'node:crypto';
export const BASE = 'https://mekhovov.github.io/revealline/';
const base = new URL(BASE);
export function expectedTypes(file) {
  const extension = path.extname(file).toLowerCase();
  if (['.nojekyll', '_headers'].includes(path.basename(file)))
    return ['application/octet-stream', 'text/plain'];
  const types = {
    '.html': ['text/html'],
    '.css': ['text/css'],
    '.js': ['text/javascript', 'application/javascript'],
    '.mjs': ['text/javascript', 'application/javascript'],
    '.json': ['application/json'],
    '.webmanifest': ['application/manifest+json', 'application/json'],
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.svg': ['image/svg+xml'],
    '.woff': ['font/woff', 'application/font-woff'],
    '.woff2': ['font/woff2'],
    '.mp3': ['audio/mpeg'],
    '.wav': ['audio/wav', 'audio/x-wav'],
    '.mp4': ['video/mp4'],
    '.webm': ['video/webm'],
    '.ttf': ['font/ttf', 'application/x-font-ttf', 'application/font-sfnt'],
    '.md': ['text/markdown', 'text/plain'],
    '.txt': ['text/plain'],
    '.pb': ['application/octet-stream'],
    '.rlmedia': ['application/octet-stream'],
    '.rlstory': ['application/octet-stream'],
    '.sha256': ['application/octet-stream', 'text/plain'],
  }[extension];
  if (!types) throw new Error(`Unreviewed artifact Content-Type category: ${file}`);
  return types;
}

export async function inspect(file, attempt, { fetchImpl = fetch } = {}) {
  const url = new URL(file.path.split('/').map(encodeURIComponent).join('/'), base).href;
  const row = {
    path: file.path,
    url,
    attempt,
    expectedBytes: file.bytes,
    expectedSha256: file.sha256,
    startedAt: new Date().toISOString(),
  };
  let response, reader;
  try {
    response = await fetchImpl(url, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(300_000),
    });
    row.status = response.status;
    row.contentType = response.headers.get('content-type');
    row.contentEncoding = response.headers.get('content-encoding');
    row.etag = response.headers.get('etag');
    row.retryAfter = response.headers.get('retry-after');
    if (response.status !== 200 || response.redirected || response.type === 'opaque') {
      await response.body?.cancel();
      throw new Error(`Expected direct HTTP 200, received ${response.status}`);
    }
    const allowed = expectedTypes(file.path),
      type = (row.contentType || '').split(';')[0].trim().toLowerCase();
    const hash = createHash('sha256');
    let length = 0;
    if (response.body) {
      reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > file.bytes)
          throw new Error(`Decoded body exceeds expected ${file.bytes} bytes`);
        hash.update(value);
      }
    }
    row.bytes = length;
    row.sha256 = hash.digest('hex');
    row.bytesMatch = length === file.bytes;
    row.hashMatch = row.sha256 === file.sha256;
    row.contentTypeAccepted = allowed.includes(type);
    row.ok = row.bytesMatch && row.hashMatch && row.contentTypeAccepted !== false;
    if (!row.ok) row.error = 'Body size/hash or required runtime Content-Type mismatch';
  } catch (error) {
    row.ok = false;
    row.error = `${error.name}: ${error.message}`;
    row.transportError =
      !response || ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name);
    try {
      if (reader) await reader.cancel();
      else await response?.body?.cancel();
    } catch {}
  } finally {
    reader?.releaseLock();
  }
  row.finishedAt = new Date().toISOString();
  return row;
}
