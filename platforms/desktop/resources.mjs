import path from 'node:path';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  APP_ORIGIN,
  APP_SCHEME,
  APP_HOST,
  NATIVE_MARKER,
  NATIVE_FORMAT,
  SECURITY_HEADERS,
  MIME_TYPES,
  safeAssetPath,
  resourcePathForURL,
  isNavigationAllowed,
} from './policy.mjs';

export const MAX_SITE_BYTES = 768 * 1024 * 1024;
export const MAX_RESOURCE_BYTES = 64 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => {
  throw new Error(`Native site: ${message}`);
};

async function localFile(root, relative, limit) {
  const parts = relative.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\\\0]/.test(part)))
    fail('Invalid local path.');
  let target = root;
  for (let index = 0; index < parts.length; index++) {
    target = path.join(target, parts[index]);
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory()))
      fail('Symbolic links and non-directory ancestors are not allowed.');
  }
  const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit)
      fail('Resource is not a regular file within its size limit.');
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const next = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!next.bytesRead) fail('Resource changed while reading.');
      offset += next.bytesRead;
    }
    if ((await handle.read(Buffer.alloc(1), 0, 1, offset)).bytesRead)
      fail('Resource changed while reading.');
    return bytes;
  } finally {
    await handle.close();
  }
}

export function validateNativeInventory(markerBytes, manifestBytes) {
  if (markerBytes.byteLength > 8192 || manifestBytes.byteLength > 2 * 1024 * 1024)
    fail('Metadata exceeds its size limit.');
  let marker, manifest;
  try {
    marker = JSON.parse(markerBytes.toString('utf8'));
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    fail('Marker and manifest must contain valid JSON.');
  }
  if (
    !plain(marker) ||
    marker.format !== NATIVE_FORMAT ||
    marker.platform !== 'desktop' ||
    marker.scheme !== APP_SCHEME ||
    marker.host !== APP_HOST ||
    marker.manifestSha256 !== digest(manifestBytes)
  )
    fail('Missing or mismatched desktop bundle marker.');
  const markerKeys = ['format', 'platform', 'scheme', 'host', 'entry', 'version', 'manifestSha256'];
  if (Object.hasOwn(marker, 'sourceManifestSha256')) {
    if (!/^[a-f0-9]{64}$/.test(marker.sourceManifestSha256))
      fail('Invalid source manifest digest.');
    markerKeys.push('sourceManifestSha256');
  }
  if (
    Object.keys(marker).length !== markerKeys.length ||
    Object.keys(marker).some((key) => !markerKeys.includes(key))
  )
    fail('Unsupported desktop marker fields.');
  if (
    !plain(manifest) ||
    manifest.formatVersion !== 1 ||
    marker.version !== manifest.version ||
    marker.entry !== manifest.entry ||
    typeof marker.version !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(marker.version) ||
    marker.version.includes('..') ||
    !safeAssetPath(marker.entry) ||
    !marker.entry.endsWith('.html')
  )
    fail('Marker and site identity do not agree.');
  if (!Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > 4096)
    fail('Invalid manifest inventory size.');
  const inventory = new Map(),
    portableNames = new Set();
  let total = 0;
  for (const file of manifest.files) {
    if (
      !plain(file) ||
      !safeAssetPath(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > MAX_RESOURCE_BYTES ||
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      fail('Invalid resource inventory entry.');
    const portable = file.path.toLowerCase();
    if (portableNames.has(portable)) fail('Duplicate or case-colliding resource path.');
    portableNames.add(portable);
    inventory.set(
      file.path,
      Object.freeze({ path: file.path, bytes: file.bytes, sha256: file.sha256 }),
    );
    total += file.bytes;
  }
  if (total > MAX_SITE_BYTES || manifest.totalBytes !== total || !inventory.has(marker.entry))
    fail('Incomplete or oversized resource inventory.');
  return { marker: Object.freeze(marker), inventory };
}

export function byteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] && match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start ||
    (!match[1] && Number(match[2]) === 0)
  )
    return null;
  end = Math.min(end, size - 1);
  return { start, end, partial: true };
}

/** Only hashed inventory assets can reach the renderer; the root itself is not a file server. */
export async function loadNativeSite(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory))
    fail('Site directory must be absolute.');
  const root = path.resolve(directory);
  if ((await fs.realpath(root)) !== root || !(await fs.lstat(root)).isDirectory())
    fail('Site root must be a real directory without symbolic links.');
  const [markerBytes, manifestBytes] = await Promise.all([
    localFile(root, NATIVE_MARKER, 8192),
    localFile(root, 'manifest.json', 2 * 1024 * 1024),
  ]);
  const { marker, inventory } = validateNativeInventory(markerBytes, manifestBytes);
  async function readResource(relative) {
    const expected = inventory.get(relative);
    if (!expected) fail('Resource is outside the inventory.');
    const bytes = await localFile(root, relative, MAX_RESOURCE_BYTES);
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256)
      fail('Resource does not match its manifest checksum.');
    return bytes;
  }
  for (const relative of inventory.keys()) await readResource(relative);
  const hasResource = (relative) => inventory.has(relative);
  const answer = (status, text, extra = {}) =>
    new Response(text, {
      status,
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extra },
    });
  return Object.freeze({
    root,
    version: marker.version,
    entry: marker.entry,
    entryURL: APP_ORIGIN + marker.entry,
    manifestSha256: marker.manifestSha256,
    fileCount: inventory.size,
    hasResource,
    isNavigationAllowed: (url) => isNavigationAllowed(url, hasResource),
    async handle(request) {
      if (!['GET', 'HEAD'].includes(request.method))
        return answer(405, 'Method not allowed.', { Allow: 'GET, HEAD' });
      const relative = resourcePathForURL(request.url);
      if (!relative) return answer(400, 'Invalid local app URL.');
      if (!inventory.has(relative)) return answer(404, 'This resource is not included in the app.');
      const mime =
        MIME_TYPES[path.extname(relative).toLowerCase()] ||
        (relative === '_headers' ? 'text/plain; charset=utf-8' : null);
      if (!mime) return answer(415, 'This resource type is not supported.');
      try {
        const bytes = await readResource(relative);
        const range = byteRange(request.headers.get('range'), bytes.length);
        if (!range)
          return answer(416, 'Requested range is unavailable.', {
            'Content-Range': `bytes */${bytes.length}`,
          });
        const body = bytes.subarray(range.start, range.end + 1);
        const headers = {
          ...SECURITY_HEADERS,
          'Content-Type': mime,
          'Content-Length': String(body.length),
          'Accept-Ranges': 'bytes',
        };
        if (range.partial)
          headers['Content-Range'] = `bytes ${range.start}-${range.end}/${bytes.length}`;
        return new Response(request.method === 'HEAD' ? null : body, {
          status: range.partial ? 206 : 200,
          headers,
        });
      } catch {
        return answer(503, 'The local resource is unavailable or failed its integrity check.');
      }
    },
  });
}
