#!/usr/bin/env node
/** Local browser-game tooling. Node built-ins only; no package install needed. */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '.xonix-build.json';
const FORMAT_VERSION = 1;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.md': 'text/plain; charset=utf-8',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const fail = (message) => {
  throw new Error(message);
};
const within = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);
const html = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function safeVersion(value) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value) ||
    value.includes('..')
  )
    fail(
      'Version must be 1–64 letters, digits, dots, underscores or hyphens, start with a letter/digit, and contain no ..',
    );
  return value;
}

export function safeRelative(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    /[\x00-\x1f]/.test(value) ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  )
    fail(`Unsafe relative path: ${String(value)}`);
  const parts = value.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) fail(`Unsafe relative path: ${value}`);
  return value;
}

async function exists(p) {
  try {
    await fs.lstat(p);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
}
async function noSymlinkPath(root, relative) {
  let current = root;
  for (const part of relative.split('/').filter(Boolean)) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink())
      fail(`Symbolic links are not copied or served: ${relative}`);
  }
  return current;
}

async function regularFiles(root, relative, result = []) {
  safeRelative(relative);
  const source = await noSymlinkPath(root, relative);
  const stat = await fs.lstat(source);
  if (stat.isDirectory()) {
    for (const name of (await fs.readdir(source)).sort())
      await regularFiles(root, `${relative}/${name}`, result);
  } else if (stat.isFile()) result.push(relative);
  else fail(`Unsupported file type: ${relative}`);
  return result;
}

export async function readBuildConfig(root = PROJECT_ROOT) {
  const config = JSON.parse(await fs.readFile(path.join(root, 'game/build-config.json'), 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config))
    fail('Build config must be an object');
  const unknown = Object.keys(config).filter((k) => !['version', 'entry', 'include'].includes(k));
  if (unknown.length) fail(`Unknown build-config fields: ${unknown.join(', ')}`);
  safeVersion(config.version);
  safeRelative(config.entry);
  if (!config.entry.endsWith('.html')) fail('Build entry must be an HTML file');
  if (!Array.isArray(config.include) || !config.include.length)
    fail('Build include must contain explicit relative paths');
  for (const included of config.include) {
    safeRelative(included);
    if (
      included
        .split('/')
        .some((p) => p.startsWith('.') || ['node_modules', 'dist', 'releases'].includes(p))
    )
      fail(`Build include contains a private/generated path: ${included}`);
  }
  return config;
}

export async function collectBuildFiles(root = PROJECT_ROOT, config) {
  config ??= await readBuildConfig(root);
  const files = new Set();
  for (const included of config.include) {
    for (const file of await regularFiles(root, included)) {
      if (file.startsWith('game/test/')) continue;
      if (file.split('/').some((p) => p.startsWith('.') || p === 'node_modules'))
        fail(`Private path in build: ${file}`);
      files.add(file);
    }
  }
  if (!files.has(config.entry)) fail(`Build include does not contain entry ${config.entry}`);
  if (files.has('manifest.json') || files.has('distribution.zip') || files.has(MARKER))
    fail('Build inputs overlap generated files');
  return [...files].sort();
}

function resolveReference(from, reference) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return null;
  const clean = reference.split(/[?#]/)[0];
  if (!clean || clean.startsWith('/'))
    return clean ? fail(`Root-absolute reference is not portable: ${from} → ${reference}`) : null;
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    fail(`Malformed URL: ${from} → ${reference}`);
  }
  let resolved = path.posix
    .normalize(path.posix.join(path.posix.dirname(from), decoded))
    .replace(/\/+$/, '');
  if (resolved === '.') resolved = 'index.html';
  safeRelative(resolved);
  return resolved;
}

/** Checks literal imports and HTML resources; dynamic runtime bindings still need browser review. */
export async function validateBuildReferences(root, files) {
  const available = new Set(files);
  const missing = [],
    navigationWarnings = [];
  const included = (resolved) =>
    !resolved || available.has(resolved) || available.has(`${resolved}/index.html`);
  for (const file of files) {
    if (file.endsWith('.json')) {
      JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
      continue;
    }
    if (!/\.(html|m?js|css)$/.test(file)) continue;
    const source = await fs.readFile(path.join(root, file), 'utf8');
    const refs = [];
    if (file.endsWith('.html'))
      for (const tag of source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi))
        for (const m of tag[0].matchAll(/\b(src|href)\s*=\s*["']([^"']+)["']/gi)) {
          if (tag[1].toLowerCase() === 'a' && m[1].toLowerCase() === 'href') {
            try {
              if (!included(resolveReference(file, m[2])))
                navigationWarnings.push(`${file} → ${m[2]}`);
            } catch {
              navigationWarnings.push(`${file} → ${m[2]}`);
            }
          } else refs.push(m[2]);
        }
    if (/\.m?js$/.test(file))
      for (const m of source.matchAll(
        /(?:^|[;\r\n])\s*(?:import\b\s*(?:[^;"']*?\bfrom\s*)?|export\b[^;"']*?\bfrom\s*)["']([^"']+)["']/g,
      )) {
        if (m[1].startsWith('.')) refs.push(m[1]);
        else if (!m[1].includes(':'))
          fail(`Browser build has an unresolved bare import: ${file} → ${m[1]}`);
      }
    if (file.endsWith('.css'))
      for (const m of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) refs.push(m[1].trim());
    for (const ref of refs) {
      const resolved = resolveReference(file, ref);
      if (!included(resolved)) missing.push(`${file} → ${ref}`);
    }
  }
  if (missing.length) fail(`Missing distribution references:\n${missing.join('\n')}`);
  return { literalReferencesValid: true, navigationWarnings };
}

let crcTable;
export function crc32(buffer) {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deterministic, uncompressed ZIP: fixed 1980 date, UTF-8, no host metadata or clock. */
export function createZip(entries) {
  if (entries.length > 65535) fail('ZIP64 is not supported');
  const local = [],
    central = [];
  let offset = 0;
  for (const { name, bytes } of [...entries].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    safeRelative(name);
    const filename = Buffer.from(name),
      data = Buffer.from(bytes),
      crc = crc32(data);
    if (filename.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff)
      fail('ZIP64 is not supported');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  if (offset + centralSize > 0xffffffff) fail('ZIP64 is not supported');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

async function assertOutput(root, out, inputs) {
  if (out === root || within(out, root))
    fail('Build output cannot replace the source directory or its parent');
  for (const input of inputs) {
    const source = path.join(root, input);
    if (within(source, out) || within(out, source)) fail(`Build output overlaps source: ${input}`);
  }
  let parent = path.dirname(out);
  while (!(await exists(parent))) parent = path.dirname(parent);
  if ((await fs.realpath(parent)) !== parent)
    fail('Build output parent may not traverse symbolic links');
  if (await exists(out)) {
    if (!(await fs.lstat(out)).isDirectory() || (await fs.lstat(out)).isSymbolicLink())
      fail('Build output must be a real directory');
    if ((await fs.readdir(out)).length) {
      let marker;
      try {
        marker = JSON.parse(await fs.readFile(path.join(out, MARKER), 'utf8'));
      } catch {
        fail('Refusing to replace a nonempty directory not owned by this build tool');
      }
      if (marker.tool !== 'xonix-game-cli' || marker.formatVersion !== FORMAT_VERSION)
        fail('Unrecognized build ownership marker');
    }
  }
}

export async function buildProject({
  root = PROJECT_ROOT,
  out = path.join(root, 'dist'),
  version,
  sourceRevision = null,
} = {}) {
  root = await fs.realpath(root);
  out = path.resolve(out);
  const config = await readBuildConfig(root);
  version = safeVersion(version ?? config.version);
  if (sourceRevision !== null && !/^[0-9a-f]{40,64}$/.test(sourceRevision))
    fail('Source revision must be a full commit hash or null');
  const files = await collectBuildFiles(root, config);
  await assertOutput(root, out, config.include);
  await validateBuildReferences(root, files);
  if (files.includes('game/content/campaign.json')) await validateLevels(root);
  if (files.includes('game/content/themes.json')) await validateThemes(root);
  if (files.includes('game/content/classes.json')) await validateClasses(root);
  await fs.mkdir(path.dirname(out), { recursive: true });
  const staging = await fs.mkdtemp(path.join(path.dirname(out), '.xonix-build-'));
  let old;
  try {
    const entries = [];
    for (const name of files)
      entries.push({ name, bytes: await fs.readFile(path.join(root, name)) });
    const info = { formatVersion: FORMAT_VERSION, version, sourceRevision, entry: config.entry };
    const replace = (name, bytes) => {
      const found = entries.find((e) => e.name === name);
      if (found) found.bytes = Buffer.from(bytes);
      else entries.push({ name, bytes: Buffer.from(bytes) });
    };
    replace('game/build-info.json', json(info));
    if (!entries.some((e) => e.name === 'index.html'))
      replace(
        'index.html',
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Xonix ${html(version)}</title><meta http-equiv="refresh" content="0;url=./${html(config.entry)}"><a href="./${html(config.entry)}">Play ${html(version)}</a></html>\n`,
      );
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const manifest = {
      ...info,
      totalBytes: entries.reduce((n, e) => n + e.bytes.length, 0),
      files: entries.map((e) => ({ path: e.name, bytes: e.bytes.length, sha256: sha256(e.bytes) })),
    };
    entries.push({ name: 'manifest.json', bytes: Buffer.from(json(manifest)) });
    const zip = createZip(entries);
    for (const entry of entries) {
      const target = path.join(staging, entry.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.bytes);
    }
    await fs.writeFile(path.join(staging, 'distribution.zip'), zip);
    await fs.writeFile(
      path.join(staging, 'distribution.zip.sha256'),
      `${sha256(zip)}  distribution.zip\n`,
    );
    await fs.writeFile(
      path.join(staging, MARKER),
      json({ tool: 'xonix-game-cli', formatVersion: FORMAT_VERSION }),
    );
    if (await exists(out)) {
      old = `${staging}-previous`;
      await fs.rename(out, old);
    }
    try {
      await fs.rename(staging, out);
    } catch (e) {
      if (old) await fs.rename(old, out);
      throw e;
    }
    if (old) await fs.rm(old, { recursive: true, force: true });
    return { out, version, files: manifest.files.length, sha256: sha256(zip), sourceRevision };
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export async function startServer({ root = PROJECT_ROOT, port = 8768, host = '127.0.0.1' } = {}) {
  root = await fs.realpath(root);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    fail('Port must be an integer from 0 to 65535');
  const server = createServer(async (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      respond(405, 'Method not allowed');
      return;
    }
    try {
      let requestPath;
      try {
        requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      } catch {
        respond(400, 'Malformed URL');
        return;
      }
      if (
        !requestPath.startsWith('/') ||
        requestPath.includes('\\') ||
        /[\x00-\x1f]/.test(requestPath)
      ) {
        respond(400, 'Malformed path');
        return;
      }
      const parts = requestPath.split('/').filter(Boolean);
      if (parts.some((p) => p === '..' || p.startsWith('.'))) {
        respond(403, 'Private or unsafe path');
        return;
      }
      const relative = parts.join('/');
      let target = relative ? await noSymlinkPath(root, relative) : root;
      let stat = await fs.stat(target);
      if (stat.isDirectory()) {
        if (!requestPath.endsWith('/')) {
          res.writeHead(308, {
            Location: `/${parts.map(encodeURIComponent).join('/')}/${(req.url || '').includes('?') ? `?${req.url.split('?')[1]}` : ''}`,
          });
          res.end();
          return;
        }
        target = await noSymlinkPath(root, `${relative ? `${relative}/` : ''}index.html`);
        stat = await fs.stat(target);
      }
      if (!stat.isFile()) {
        respond(404, 'Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') res.end();
      else {
        const stream = createReadStream(target);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      }
    } catch (e) {
      respond(e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 404 : 403, 'File unavailable');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return {
    server,
    root,
    url: `http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}/`,
  };
}

/** Parse Git's tar output without allowing links, traversal, or arbitrary extraction. */
export function readTarEntries(archive) {
  const entries = [],
    names = new Set();
  let pax = {};
  const field = (block, start, length) =>
    block
      .subarray(start, start + length)
      .toString('utf8')
      .split('\0')[0];
  for (let offset = 0; offset + 512 <= archive.length; ) {
    const block = archive.subarray(offset, offset + 512);
    if (block.every((byte) => byte === 0)) break;
    const expected = parseInt(field(block, 148, 8).trim(), 8);
    const sum = block.reduce((n, b, i) => n + (i >= 148 && i < 156 ? 32 : b), 0);
    if (expected !== sum) fail('Invalid archive header checksum');
    const size = parseInt(field(block, 124, 12).trim() || '0', 8),
      type = field(block, 156, 1) || '0';
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > archive.length)
      fail('Truncated archive entry');
    const bytes = archive.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'g' || type === 'x') {
      const attributes = {};
      for (let cursor = 0; cursor < bytes.length; ) {
        const space = bytes.indexOf(32, cursor),
          length = Number(bytes.subarray(cursor, space).toString());
        if (
          space < 0 ||
          !Number.isInteger(length) ||
          length <= space - cursor + 1 ||
          cursor + length > bytes.length
        )
          fail('Malformed archive extended header');
        const record = bytes.subarray(space + 1, cursor + length - 1).toString('utf8'),
          equal = record.indexOf('=');
        if (equal > 0) attributes[record.slice(0, equal)] = record.slice(equal + 1);
        cursor += length;
      }
      if (type === 'x') pax = attributes;
      continue;
    }
    const prefix = field(block, 345, 155),
      name = (pax.path || `${prefix ? `${prefix}/` : ''}${field(block, 0, 100)}`).replace(
        /\/$/,
        '',
      );
    pax = {};
    safeRelative(name);
    if (name.split('/').includes('.git')) fail('Git metadata is forbidden in source archives');
    if (!['0', '5'].includes(type)) fail(`Unsupported archive entry type ${type}: ${name}`);
    if (type === '5') continue;
    if (names.has(name)) fail(`Duplicate archive entry: ${name}`);
    names.add(name);
    entries.push({ name, bytes });
  }
  if (!entries.length) fail('Source archive contains no files');
  return entries;
}

function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    ...options,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    fail(
      `${path.basename(binary)} ${args[0]} failed: ${(result.stderr || '').trim() || `exit ${result.status}`}`,
    );
  return result.stdout;
}

export async function releaseSnapshot({ root = PROJECT_ROOT, ref, version } = {}) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\x00-\x1f]/.test(ref))
    fail('Provide a trusted local commit, branch or tag with --ref');
  safeVersion(version);
  if (['index.html', 'index.json'].includes(version.toLowerCase()))
    fail('Release label conflicts with the version index');
  root = await fs.realpath(root);
  const commit = command('git', ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], {
    cwd: root,
  }).trim();
  if (!/^[0-9a-f]{40,64}$/.test(commit)) fail('Git did not resolve a full commit hash');
  const releases = path.join(root, 'releases'),
    destination = path.join(releases, version);
  if (await exists(destination))
    fail(`Release ${version} already exists; choose a new immutable label`);
  await fs.mkdir(releases, { recursive: true });
  if ((await fs.realpath(releases)) !== releases) fail('Release folder may not be a symbolic link');
  const lock = path.join(releases, '.snapshot-lock');
  try {
    await fs.mkdir(lock);
  } catch (e) {
    if (e.code === 'EEXIST')
      fail('Another snapshot owns releases/.snapshot-lock; inspect it before retrying');
    throw e;
  }
  // Node resolves an entry module's URL through directory symlinks. Older frozen
  // CLIs compare that URL with argv[1], so pass the canonical path even when the
  // temporary root is an alias such as macOS /var -> /private/var.
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'xonix-snapshot-')));
  const staging = await fs.mkdtemp(path.join(releases, '.snapshot-'));
  try {
    const archivePath = path.join(temporary, 'source.tar');
    command('git', ['archive', '--format=tar', `--output=${archivePath}`, commit], { cwd: root });
    const archive = await fs.readFile(archivePath),
      source = path.join(temporary, 'source');
    await fs.mkdir(source);
    for (const entry of readTarEntries(archive)) {
      const target = path.join(source, entry.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.bytes);
    }
    const frozenCli = path.join(source, 'scripts/game-cli.mjs');
    if (!(await exists(frozenCli)))
      fail('Selected ref predates the playable build CLI; keep it as a source reference instead');
    command(
      process.execPath,
      [
        frozenCli,
        'build',
        '--out',
        path.join(staging, 'site'),
        '--version',
        version,
        '--revision',
        commit,
      ],
      { cwd: source },
    );
    const zip = await fs.readFile(path.join(staging, 'site/distribution.zip'));
    const manifest = await fs.readFile(path.join(staging, 'site/manifest.json'));
    const release = {
      formatVersion: FORMAT_VERSION,
      version,
      sourceRevision: commit,
      sourceArchiveSha256: sha256(archive),
      distributionSha256: sha256(zip),
      manifestSha256: sha256(manifest),
      play: `${version}/site/game/`,
      download: `${version}/site/distribution.zip`,
    };
    await fs.copyFile(archivePath, path.join(staging, 'source.tar'));
    await fs.writeFile(path.join(staging, 'release.json'), json(release));
    // Only snapshot-owned labels enter the index. Invalid neighboring folders fail loudly.
    const prior = [];
    for (const name of (await fs.readdir(releases))
      .filter((name) => !name.startsWith('.'))
      .sort()) {
      if (['index.html', 'index.json'].includes(name)) continue;
      if (await exists(path.join(releases, name, 'release.json')))
        prior.push(
          JSON.parse(await fs.readFile(path.join(releases, name, 'release.json'), 'utf8')),
        );
    }
    const records = [...prior, release].sort((a, b) =>
      a.version < b.version ? -1 : a.version > b.version ? 1 : 0,
    );
    await fs.rename(staging, destination);
    await fs.writeFile(
      path.join(releases, '.index.json.tmp'),
      json({ formatVersion: FORMAT_VERSION, releases: records }),
    );
    await fs.writeFile(
      path.join(releases, '.index.html.tmp'),
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Playable versions</title><style>body{font:18px system-ui;max-width:860px;margin:3rem auto;padding:1rem}li{margin:1.5rem 0}code{font-size:12px}a{margin-right:1rem}</style><h1>Playable versions</h1><p>Archived source builds. Each label retains its own files; compare saves in separate browser origins.</p><ul>${records.map((r) => `<li><strong>${html(r.version)}</strong> <code>${html(r.sourceRevision)}</code><p><a href="./${html(r.play)}">Play</a><a href="./${html(r.download)}">Download ZIP</a><a href="./${html(r.version)}/release.json">Manifest</a></p></li>`).join('')}</ul></html>\n`,
    );
    await fs.rename(path.join(releases, '.index.json.tmp'), path.join(releases, 'index.json'));
    await fs.rename(path.join(releases, '.index.html.tmp'), path.join(releases, 'index.html'));
    return { ...release, directory: destination };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rm(lock, { recursive: true, force: true });
  }
}

export function parseArguments(argv) {
  let [action = 'help', ...rest] = argv;
  if (action === '--help' || action === '-h') action = 'help';
  const allowed = {
    help: [],
    serve: ['root', 'port', 'host'],
    build: ['out', 'version', 'revision'],
    validate: [],
    test: [],
    generate: ['seed', 'out'],
    'release-snapshot': ['ref', 'version'],
  };
  if (!Object.hasOwn(allowed, action)) fail(`Unknown command: ${action}`);
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i].startsWith('--') ? rest[i].slice(2) : '';
    if (!allowed[action].includes(name)) fail(`Unknown option for ${action}: ${rest[i]}`);
    if (Object.hasOwn(options, name)) fail(`Duplicate option: --${name}`);
    if (i + 1 >= rest.length || rest[i + 1].startsWith('--') || !rest[i + 1])
      fail(`Missing value for --${name}`);
    options[name] = rest[i + 1];
  }
  return { action, options };
}

export async function main(argv = process.argv.slice(2)) {
  const { action, options } = parseArguments(argv);
  if (action === 'help') {
    process.stdout.write(
      'Xonix game CLI (Node built-ins)\n  serve [--root DIR] [--host 127.0.0.1] [--port 8768]\n  build [--out dist] [--version LABEL]\n  validate\n  test\n  generate --seed TEXT --out FILE.json\n  release-snapshot --ref REF --version LABEL\n',
    );
    return;
  }
  if (action === 'serve') {
    const { server, url, root } = await startServer({
      root: path.resolve(options.root ?? PROJECT_ROOT),
      port: options.port === undefined ? 8768 : Number(options.port),
      host: options.host ?? '127.0.0.1',
    });
    process.stdout.write(`Serving ${root}\n${url}\n`);
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.once(signal, () => server.close(() => process.exit(0)));
  } else if (action === 'build')
    process.stdout.write(
      json(
        await buildProject({
          out: options.out ? path.resolve(options.out) : undefined,
          version: options.version,
          sourceRevision: options.revision ?? null,
        }),
      ),
    );
  else if (action === 'release-snapshot')
    process.stdout.write(
      json(await releaseSnapshot({ ref: options.ref, version: options.version })),
    );
  else if (action === 'test') {
    const files = [];
    for (const directory of ['scripts', 'game', 'authoring/motion-lab'])
      if (await exists(path.join(PROJECT_ROOT, directory)))
        for (const file of await regularFiles(PROJECT_ROOT, directory))
          if (/(?:^|\/)(?:test-[^/]+|[^/]+\.test)\.mjs$/.test(file)) files.push(file);
    if (!files.length) fail('No test files found');
    const result = spawnSync(process.execPath, ['--test', ...files.sort()], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) fail(`Tests failed with exit ${result.status}`);
  } else if (action === 'validate') {
    const config = await readBuildConfig();
    const files = await collectBuildFiles(PROJECT_ROOT, config);
    const references = await validateBuildReferences(PROJECT_ROOT, files);
    process.stdout.write(
      json({
        version: config.version,
        files: files.length,
        ...references,
        ...(await validateLevels()),
        ...(await validateThemes()),
        ...(await validateClasses()),
      }),
    );
  } else if (action === 'generate') {
    if (!options.seed || !options.out) fail('Generate requires --seed and --out');
    const level = await generateLevel(options.seed);
    const target = path.resolve(options.out);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, json(level), { flag: 'wx' });
    process.stdout.write(json({ out: target, seed: options.seed, id: level.id }));
  }
}

async function coreValidator(root = PROJECT_ROOT) {
  const { validateLevel } = await import(
    pathToFileURL(path.join(root, 'game/core/index.mjs')).href
  );
  if (typeof validateLevel !== 'function') fail('Core does not export validateLevel');
  return validateLevel;
}

export async function validateLevels(root = PROJECT_ROOT) {
  const validateLevel = await coreValidator(root);
  const campaign = JSON.parse(
    await fs.readFile(path.join(root, 'game/content/campaign.json'), 'utf8'),
  );
  if (
    campaign.version !== 'xonix-campaign.v1' ||
    typeof campaign.id !== 'string' ||
    !campaign.id ||
    typeof campaign.revision !== 'string' ||
    !campaign.revision ||
    !Array.isArray(campaign.levels) ||
    !campaign.levels.length
  )
    fail('Campaign must have version xonix-campaign.v1, id, revision and nonempty levels');
  const ids = new Set();
  for (const level of campaign.levels) {
    const result = validateLevel(level);
    if (!result.valid)
      fail(`Invalid campaign level ${level.id ?? '(unnamed)'}: ${JSON.stringify(result.errors)}`);
    if (ids.has(level.id)) fail(`Duplicate campaign level ID: ${level.id}`);
    ids.add(level.id);
  }
  return { campaign: campaign.id, levels: campaign.levels.length };
}

export async function validateThemes(root = PROJECT_ROOT) {
  const { validateTheme } = await import(pathToFileURL(path.join(root, 'game/content.mjs')).href);
  if (typeof validateTheme !== 'function') fail('Content module does not export validateTheme');
  const document = JSON.parse(
    await fs.readFile(path.join(root, 'game/content/themes.json'), 'utf8'),
  );
  if (
    document.version !== 'xonix-themes.v1' ||
    !Array.isArray(document.themes) ||
    !document.themes.length
  )
    fail('Theme document must have version xonix-themes.v1 and nonempty themes');
  const ids = new Set();
  for (const theme of document.themes) {
    const result = validateTheme(theme);
    if (!result.valid)
      fail(`Invalid theme ${theme?.id ?? '(unnamed)'}: ${JSON.stringify(result.errors)}`);
    if (!theme.id || ids.has(theme.id)) fail(`Missing or duplicate theme ID: ${theme.id}`);
    ids.add(theme.id);
  }
  return { themes: document.themes.length };
}

export async function validateClasses(root = PROJECT_ROOT) {
  const { validateClassRecipes } = await import(
    pathToFileURL(path.join(root, 'game/core/index.mjs')).href
  );
  if (typeof validateClassRecipes !== 'function') fail('Core does not export validateClassRecipes');
  const recipes = JSON.parse(
    await fs.readFile(path.join(root, 'game/content/classes.json'), 'utf8'),
  );
  const result = validateClassRecipes(recipes);
  if (!result.valid) fail(`Invalid class recipes: ${JSON.stringify(result.errors)}`);
  return { classes: recipes.length };
}

/** Delegate to the exact browser generator; this wrapper owns no second algorithm. */
export async function generateLevel(seed, { root = PROJECT_ROOT } = {}) {
  const generator = await import(pathToFileURL(path.join(root, 'game/generator.mjs')).href);
  return generator.generateLevel(seed);
}

async function isDirectEntry() {
  if (!process.argv[1]) return false;
  try {
    const [entry, module] = await Promise.all([
      fs.realpath(path.resolve(process.argv[1])),
      fs.realpath(fileURLToPath(import.meta.url)),
    ]);
    return entry === module;
  } catch {
    return false;
  }
}

if (await isDirectEntry())
  main().catch((error) => {
    process.stderr.write(`Game CLI error: ${error.message}\n`);
    process.exitCode = 1;
  });
