#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROJECT_ROOT, PUBLIC_SECURITY_HEADERS, readBuildConfig } from './game-cli.mjs';

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
export async function startProductionPreview({ root = PROJECT_ROOT, port = 8773 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port.');
  root = await realpath(root);
  const marker = await readOptional(path.join(root, '.xonix-build.json'));
  const ownership = marker === null ? null : JSON.parse(marker);
  if (ownership && (ownership.tool !== 'xonix-game-cli' || ownership.formatVersion !== 1))
    throw new Error('Unrecognized generated build ownership.');
  const build = ownership !== null;
  const sourceHeaders = await readOptional(path.join(root, '_headers'));
  if (build && sourceHeaders === null) throw new Error('Generated builds require their _headers.');
  const headers =
    sourceHeaders === null ? PUBLIC_SECURITY_HEADERS : generatedHeaders(sourceHeaders);
  const config = build ? null : await readBuildConfig(root);
  const admitted = (relative) =>
    build || config.include.some((entry) => relative === entry || relative.startsWith(`${entry}/`));
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
      let file = await regularPath(root, relative);
      let stat = await lstat(file);
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
      response.writeHead(200, {
        ...headers,
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
        'Content-Length': stat.size,
      });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(file);
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
    url: `http://127.0.0.1:${server.address().port}/`,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {};
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--root=')) options.root = path.resolve(argument.slice(7));
    else if (/^--port=\d+$/.test(argument)) options.port = Number(argument.slice(7));
    else
      throw new Error(
        'Usage: node scripts/serve-production-preview.mjs [--root=<path>] [--port=8773]',
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
