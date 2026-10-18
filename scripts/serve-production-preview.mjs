#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_ROOT, PUBLIC_SECURITY_HEADERS, readBuildConfig } from './game-cli.mjs';
import { openEmittedPreview } from './emitted-preview.mjs';

// Source previews validate runtime behavior under public production CSP. They
// are not generated-build or offline-install qualification. For those checks,
// point --root at the actual generated output; its _headers must match policy.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};
async function readOptional(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
function generatedHeaders(source) {
  const lines = source.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (lines.shift() !== '/*') throw new Error('Expected generated global /* header policy.');
  const result = {};
  for (const line of lines) {
    const match = /^\s+([A-Za-z0-9-]+):\s*(.+)$/.exec(line);
    if (!match || Object.hasOwn(result, match[1].toLowerCase()))
      throw new Error('Unsupported or repeated generated header rule.');
    result[match[1].toLowerCase()] = match[2];
  }
  const expected = Object.entries(PUBLIC_SECURITY_HEADERS);
  if (
    Object.keys(result).length !== expected.length ||
    expected.some(([name, value]) => result[name.toLowerCase()] !== value)
  )
    throw new Error(
      'Generated _headers differ from PUBLIC_SECURITY_HEADERS; refusing policy drift.',
    );
  return result;
}
async function regularPath(root, relative) {
  let file = root;
  for (const part of relative.split('/').filter(Boolean)) {
    file = path.join(file, part);
    if ((await lstat(file)).isSymbolicLink()) throw new Error('Symbolic links are not served.');
  }
  return file;
}
export function parsePreviewRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  if (match.slice(1).some((value) => value && !Number.isSafeInteger(Number(value)))) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    return null;
  return { start, end };
}
export async function startProductionPreview({
  root = PROJECT_ROOT,
  port = 8773,
  fixtureAccess = false,
  cache = 'policy',
  emittedPreview = null,
  verifyEmittedSource = false,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port.');
  if (typeof fixtureAccess !== 'boolean' || !['policy', 'no-store', 'revalidate'].includes(cache))
    throw new Error('Invalid preview fixture/cache options.');
  const fixtureVerifier = fixtureAccess
    ? pbkdf2Sync('fixture-password', 'performance-fixture', 150000, 32, 'sha256').toString(
        'base64url',
      )
    : null;
  root = await realpath(root);
  if (typeof verifyEmittedSource !== 'boolean' || (verifyEmittedSource && !emittedPreview))
    throw new Error('Source verification requires an emitted preview.');
  const emitted = emittedPreview
    ? await openEmittedPreview(emittedPreview, { root, verifySource: verifyEmittedSource })
    : null;
  const readMetadata = async (relative) =>
    emitted
      ? emitted.has(relative)
        ? (await emitted.read(relative)).toString('utf8')
        : null
      : readOptional(path.join(root, relative));
  const marker = await readMetadata('.xonix-build.json');
  const ownership = marker === null ? null : JSON.parse(marker);
  if (ownership && (ownership.tool !== 'xonix-game-cli' || ownership.formatVersion !== 1))
    throw new Error('Unrecognized generated build ownership.');
  const build = ownership !== null;
  if (emitted && !build) throw new Error('Emitted preview requires generated build ownership.');
  const sourceHeaders = await readMetadata('_headers');
  if (build && sourceHeaders === null) throw new Error('Generated builds require their _headers.');
  const headers = Object.fromEntries(
    Object.entries(
      sourceHeaders === null ? PUBLIC_SECURITY_HEADERS : generatedHeaders(sourceHeaders),
    ).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const config = build ? null : await readBuildConfig(root);
  const admitted = (relative) =>
    build || config.include.some((entry) => relative === entry || relative.startsWith(`${entry}/`));
  const fixtureResponses = new Map();
  const server = createServer(async (request, response) => {
    const send = (status, body, extra = {}) => {
      response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        ...headers,
        ...extra,
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method))
      return send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    try {
      const [raw, query] = (request.url ?? '/').split('?');
      let decoded;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        return send(400, 'Malformed URL');
      }
      if (!decoded.startsWith('/') || decoded.includes('\\') || /[\x00-\x1f]/.test(decoded))
        return send(400, 'Malformed path');
      const parts = decoded.split('/').filter(Boolean);
      if (parts.some((part) => part.startsWith('.') || part === 'node_modules'))
        return send(403, 'Private or unsafe path');
      let relative = parts.join('/');
      if (!relative && !build) return send(308, '', { Location: `/${config.entry}` });
      let file,
        stat,
        body = null;
      if (emitted) {
        const index = `${relative ? `${relative}/` : ''}index.html`;
        if (!emitted.has(relative) && emitted.has(index)) {
          if (!decoded.endsWith('/'))
            return send(308, '', {
              Location: `/${parts.map(encodeURIComponent).join('/')}/${query === undefined ? '' : `?${query}`}`,
            });
          relative = index;
        }
        if (!emitted.has(relative)) return send(404, 'Not found');
        // Verify the original emitted pin before the explicit HTML access fixture.
        // Source files omitted from publication cannot leak through this path.
        body = await emitted.read(relative);
        file = path.join(root, relative);
      } else {
        file = await regularPath(root, relative);
        stat = await lstat(file);
        if (stat.isDirectory()) {
          if (!decoded.endsWith('/'))
            return send(308, '', {
              Location: `/${parts.map(encodeURIComponent).join('/')}/${query === undefined ? '' : `?${query}`}`,
            });
          relative = `${relative ? `${relative}/` : ''}index.html`;
          file = await regularPath(root, relative);
          stat = await lstat(file);
        }
        if (!admitted(relative)) return send(403, 'Outside admitted public paths');
        if (!stat.isFile()) return send(404, 'Not found');
      }
      if (fixtureAccess && path.extname(file) === '.html') {
        // Explicit local-only access metadata fixture. Runtime bytes and public
        // CSP stay unchanged; no browser request interception disables caching.
        const original = body ?? (await readFile(file));
        const source = original.toString('utf8');
        body = Buffer.from(
          source
            .replace(
              /(name="revealline-access-salt"\s+content=")[^"]+/,
              '$1' + Buffer.from('performance-fixture').toString('base64url'),
            )
            .replace(
              /(name="revealline-access-verifier"\s+content=")[^"]+/,
              '$1' + fixtureVerifier,
            ),
        );
      }
      if (emitted && fixtureAccess && path.extname(file) === '.html') {
        const original = emitted.manifest.files.find((entry) => entry.path === relative);
        fixtureResponses.set(relative, {
          path: relative,
          original: { bytes: original.bytes, sha256: original.sha256 },
          served: { bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') },
          change: 'Local access salt and verifier only; not an offline HTML integrity proof.',
        });
      }
      const size = body?.length ?? stat.size;
      const etag = emitted
        ? `"${createHash('sha256').update(body).digest('hex')}"`
        : `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}-${fixtureAccess ? 'fixture-v1' : 'original'}"`;
      const fileHeaders = {
        ...headers,
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        ...(cache === 'policy'
          ? {}
          : {
              'cache-control':
                cache === 'revalidate' ? 'public, max-age=0, must-revalidate' : 'no-store',
            }),
        ...(cache === 'revalidate' ? { ETag: etag } : {}),
      };
      if (cache === 'revalidate' && request.headers['if-none-match'] === etag) {
        delete fileHeaders['Content-Length'];
        response.writeHead(304, fileHeaders);
        return response.end();
      }
      // Ignore If-Range without a strong validator; a full response is safe.
      const range =
        request.method === 'GET' && request.headers.range && !request.headers['if-range']
          ? parsePreviewRange(request.headers.range, size)
          : undefined;
      if (range === null)
        return send(416, 'Unsatisfiable byte range', { 'Content-Range': `bytes */${size}` });
      if (range) {
        fileHeaders['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
        fileHeaders['Content-Length'] = range.end - range.start + 1;
      }
      response.writeHead(range ? 206 : 200, fileHeaders);
      if (request.method === 'HEAD') return response.end();
      if (body) return response.end(range ? body.subarray(range.start, range.end + 1) : body);
      const stream = createReadStream(file, range);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      send(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 403, 'File unavailable');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    server,
    root,
    mode: build ? 'generated-build' : 'source',
    headers: sourceHeaders === null ? 'PUBLIC_SECURITY_HEADERS' : 'generated _headers (verified)',
    fixtureAccess,
    cache,
    ...(emitted
      ? {
          emittedPreview: {
            directory: path.resolve(root, emittedPreview),
            manifestSHA256: emitted.manifestSHA256,
            inventorySHA256: emitted.manifest.inventorySHA256,
            files: emitted.manifest.files.length,
            sourceRevision: emitted.manifest.sourceRevision,
            sourceFingerprint: emitted.manifest.sourceFingerprint,
            buildInputFingerprint: emitted.manifest.buildInputFingerprint,
            sourceVerified: !!emitted.sourceVerification,
            sourceVerification: emitted.sourceVerification,
          },
        }
      : {}),
    get fixtureResponses() {
      return [...fixtureResponses.values()];
    },
    url: `http://127.0.0.1:${server.address().port}/`,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {};
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--root=')) options.root = path.resolve(argument.slice(7));
    else if (/^--port=\d+$/.test(argument)) options.port = Number(argument.slice(7));
    else if (argument === '--fixture-access') options.fixtureAccess = true;
    else if (argument.startsWith('--cache=')) options.cache = argument.slice(8);
    else if (argument === '--verify-emitted-source') options.verifyEmittedSource = true;
    else if (argument.startsWith('--emitted-preview='))
      options.emittedPreview = path.resolve(argument.slice('--emitted-preview='.length));
    else
      throw new Error(
        'Usage: node scripts/serve-production-preview.mjs [--root=<path>] [--port=8773] [--fixture-access] [--cache=policy|no-store|revalidate] [--emitted-preview=<capture-directory>] [--verify-emitted-source]',
      );
  }
  const { server, ...preview } = await startProductionPreview(options);
  console.log(JSON.stringify(preview));
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      server.close();
      server.closeAllConnections();
    });
}
