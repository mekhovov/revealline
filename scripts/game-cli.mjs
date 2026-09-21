#!/usr/bin/env node
/** Local browser-game tooling. Node built-ins only; no package install needed. */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  readPackIndexes,
  packNavigationSummary,
  validateNavigationCatalogs,
} from './pack-indexes.mjs';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '.xonix-build.json';
const FORMAT_VERSION = 1;
export const PUBLIC_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cache-Control': 'no-cache',
});
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
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
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
  const unknown = Object.keys(config).filter(
    (k) =>
      ![
        'version',
        'entry',
        'include',
        'optionalOffline',
        'optionalChapters',
        'externalChapters',
        'optionalArtwork',
      ].includes(k),
  );
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
  if (config.optionalOffline !== undefined) {
    const optional = config.optionalOffline;
    if (
      !Array.isArray(optional) ||
      optional.length > 12 ||
      new Set(optional).size !== optional.length
    )
      fail('optionalOffline must list at most 12 unique indexed pack JSON paths');
    const index = await readPackIndexes(root);
    const indexed = new Set(
      index.all.map((entry) => `game/content/packs/${safeRelative(entry.path)}`),
    );
    for (const name of optional) {
      safeRelative(name);
      if (
        !/^game\/content\/packs\/[a-z0-9][a-z0-9-]*\.json$/.test(name) ||
        ['index.json', 'archive-index.json', 'catalog.json', 'archive-catalog.json'].some(
          (file) => name === `game/content/packs/${file}`,
        ) ||
        !indexed.has(name)
      )
        fail(`optionalOffline is not an indexed pack JSON: ${name}`);
      const file = await noSymlinkPath(root, name);
      if (!(await fs.stat(file)).isFile())
        fail(`optionalOffline must name a regular file: ${name}`);
    }
  }
  if (config.optionalChapters !== undefined) {
    const { validateOptionalDistributionConfig } = await import('./optional-distribution.mjs');
    validateOptionalDistributionConfig(config.optionalChapters);
  }
  if (config.externalChapters !== undefined) {
    const { validateExternalDistributionConfig } = await import('./external-distribution.mjs');
    validateExternalDistributionConfig(config.externalChapters);
  }
  if (config.optionalArtwork !== undefined) {
    const { validateOptionalArtworkConfig } = await import('./optional-artwork.mjs');
    validateOptionalArtworkConfig(config.optionalArtwork);
  }
  return config;
}

export async function collectBuildFiles(root = PROJECT_ROOT, config) {
  config ??= await readBuildConfig(root);
  const files = new Set();
  for (const included of config.include) {
    for (const file of await regularFiles(root, included)) {
      if (file.startsWith('game/test/') || file === 'game/offline/service-worker.template.js')
        continue;
      if (file.split('/').some((p) => p.startsWith('.') || p === 'node_modules'))
        fail(`Private path in build: ${file}`);
      files.add(file);
    }
  }
  if (!files.has(config.entry)) fail(`Build include does not contain entry ${config.entry}`);
  for (const name of config.optionalOffline ?? [])
    if (!files.has(name)) fail(`optionalOffline pack is not shipped: ${name}`);
  if (
    [
      'manifest.json',
      'distribution.zip',
      MARKER,
      'service-worker.js',
      'offline-cache.json',
      'manifest.webmanifest',
      '_headers',
      'privacy.html',
      'credits.html',
    ].some((name) => files.has(name)) ||
    [...files].some((name) => name.startsWith('icons/'))
  )
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

function publicPage(title, body, fieldKit = false, compiled = false) {
  const styles = fieldKit
    ? ['fonts', 'tokens', 'components', 'surfaces']
        .map((part) => `<link rel="stylesheet" href="./game/ui/field-kit-${part}.css">`)
        .join('')
    : '';
  const presentation = compiled
    ? '<link rel="stylesheet" href="./game/ui/field-kit-compiled.css"><script type="module" src="./game/presentation/page-entry.mjs"></script>'
    : '';
  const content = fieldKit ? body.replaceAll('<h1>', '<h1 class="field-kit-display">') : body;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${html(title)} · Reveal Line</title><style>body{margin:0;background:#091324;color:#edf2e8;font:17px/1.7 system-ui}main{max-width:760px;margin:8vh auto;padding:24px}a{color:#7fdbeb}h1{font-size:clamp(32px,6vw,58px);line-height:1.1}nav{display:flex;gap:16px;flex-wrap:wrap;margin:32px 0}nav a{padding:10px 16px;border:1px solid #456071;border-radius:8px;text-decoration:none}small{color:#adc1ca}code{overflow-wrap:anywhere}li{margin:12px 0}</style>${styles}${presentation}</head><body${fieldKit ? ' class="field-kit field-kit-support"' : ''}><main>${content}</main></body></html>\n`;
}
function addPublicEntries(entries, info) {
  const displayVersion = info.version.startsWith('v') ? info.version : `v${info.version}`;
  const has = (name) => entries.some((e) => e.name === name);
  const fieldKit = ['fonts', 'tokens', 'components', 'surfaces'].every((part) =>
    has(`game/ui/field-kit-${part}.css`),
  );
  const compiled =
    fieldKit && has('game/ui/field-kit-compiled.css') && has('game/presentation/page-entry.mjs');
  const links = [
    `<a href="./${html(info.entry)}">Play solo</a>`,
    ...(has('game/couch/index.html') ? ['<a href="./game/couch/">Couch duel</a>'] : []),
    ...(has('game/replay-theater/index.html')
      ? ['<a href="./game/replay-theater/">Replay Theater</a>']
      : []),
    ...(has('game/playground/index.html') ? ['<a href="./game/playground/">Playground</a>'] : []),
  ];
  const landing = entries.find((e) => e.name === 'site/index.html');
  if (landing) {
    const rendered = landing.bytes
      .toString()
      .replaceAll('__REVEALLINE_VERSION__', html(displayVersion))
      .replaceAll('href="./landing.css"', 'href="./site/landing.css"')
      .replaceAll('src="./landing.mjs"', 'src="./site/landing.mjs"')
      .replaceAll('src="./launch.mjs"', 'src="./site/launch.mjs"')
      .replaceAll('href="../game/boot.css"', 'href="./game/boot.css"')
      .replaceAll('href="../game/ui/field-kit-', 'href="./game/ui/field-kit-')
      .replaceAll('href="../game/"', 'href="./game/"');
    entries.splice(entries.indexOf(landing), 1);
    entries.push({ name: 'index.html', bytes: Buffer.from(rendered) });
    const about = entries.find((entry) => entry.name === 'site/about.html');
    if (about)
      about.bytes = Buffer.from(
        about.bytes.toString().replaceAll('__REVEALLINE_VERSION__', html(displayVersion)),
      );
  } else if (!has('index.html'))
    entries.push({
      name: 'index.html',
      bytes: Buffer.from(
        publicPage(
          'Play',
          `<small>REVEAL LINE · ${html(info.version)}</small><h1>Clear a path.<br>Reveal a world.</h1><p>Close a line through changing worlds, collect the pictures you uncover and try a new route. Play with keys, touch or a compatible controller.</p><nav>${links.join('')}</nav><p><a href="./privacy.html">Privacy and local storage</a> · <a href="./credits.html">Credits and notices</a></p><small>${info.sourceRevision ? `Saved source <code>${html(info.sourceRevision)}</code>` : 'Development distribution — source revision not recorded.'}</small>`,
          fieldKit,
          compiled,
        ),
      ),
    });
  const game = entries.find((entry) => entry.name === 'game/index.html');
  if (game)
    game.bytes = Buffer.from(
      game.bytes.toString().replaceAll('__REVEALLINE_VERSION__', html(displayVersion)),
    );
  entries.push({
    name: 'privacy.html',
    bytes: Buffer.from(
      publicPage(
        'Privacy and local storage',
        '<p><a href="./">← Game home</a></p><h1>Your game stays here.</h1><p>This build has no account system, analytics SDK, advertising tracker, cloud scoreboard or multiplayer server. The game code does not upload your pictures, imported packs, replay files or player library.</p><p>The browser stores preferences, achievements, local scores and a suspended flight locally. Imported image packs and uploaded MP3 libraries use IndexedDB. Custom soundtrack backups contain the original audio bytes; the player-library JSON alone is not a complete media backup. The playground uses session storage to pass its configuration to the preview. If you explicitly prepare offline play, the service worker saves this version’s shipped files in the browser cache.</p><p>Export the player library, packs and suspended flight when you want a portable backup. Clearing site data removes local data; private browsing, storage limits or browser cleanup can also remove it. There is no server backup or cross-device sync.</p><p>A public hosting provider receives ordinary page and asset requests and may keep access logs. This game cannot promise the host keeps no logs. The publisher is responsible for disclosing any hosting-specific collection or additional services it adds.</p><p>Imported content is treated as bounded data and media. Installed packs cannot provide executable game scripts or contacts with remote services. Local scores are editable local records, not authenticated competitive results.</p>',
        fieldKit,
        compiled,
      ),
    ),
  });
  entries.push({
    name: 'credits.html',
    bytes: Buffer.from(
      publicPage(
        'Credits and notices',
        '<p><a href="./">← Game home</a></p><h1>Credits and notices</h1><p>Reveal Line is an original territory-capture game inspired by the Xonix/Qix tradition. Reference games informed design research; their proprietary music, pictures, code and logos are not bundled as game assets.</p><p>The included Phaser engine retains its <a href="./game/vendor/PHASER-LICENSE.md">MIT license and copyright notice</a>. Built-in music uses original procedural score recipes. Uploaded MP3s retain their author-supplied metadata and source records.</p><p>The worlds, backgrounds and character rigs are changeable. FPV gameplay is a fictional arcade abstraction. The business-spend theme is a design concept and does not claim endorsement or actual business-product functionality.</p><p>The Telegram emoji collection researched for inspiration is not included as imported artwork. A pack author must supply appropriate attribution and rights for every asset they distribute; importing a file is not a redistribution license.</p>' +
          (has('game/ui/fonts/field-kit/provenance.json')
            ? '<p>Display type: Handjet by the Handjet Project Authors (<a href="./game/ui/fonts/field-kit/Handjet-OFL.txt">OFL 1.1</a>), instantiated at weight 600, element shape 2 and element grid 1. Interface type: Exo 2 by the Exo 2 Project Authors (<a href="./game/ui/fonts/field-kit/Exo2-OFL.txt">OFL 1.1</a>), retaining weights 400–600. Numeric type: IBM Plex Mono by IBM Corp. (<a href="./game/ui/fonts/field-kit/IBMPlexMono-OFL.txt">OFL 1.1</a>), weight 500. All are self-hosted WOFF2 with full English and Ukrainian letter coverage. <a href="./game/ui/fonts/field-kit/provenance.json">Source versions, build recipe and file checksums</a>.</p>'
            : ''),
        fieldKit,
        compiled,
      ),
    ),
  });
  entries.push({
    name: '_headers',
    bytes: Buffer.from(
      '/*\n' +
        Object.entries(PUBLIC_SECURITY_HEADERS)
          .map(([name, value]) => `  ${name}: ${value}`)
          .join('\n') +
        '\n',
    ),
  });
}

/** Original pixel emblem. Fixed integer geometry; no source images are modified. */
export function offlineIcons(sizes = [180, 192, 512]) {
  if (
    !Array.isArray(sizes) ||
    sizes.length > 16 ||
    sizes.some((size) => !Number.isSafeInteger(size) || size < 16 || size > 4096)
  )
    throw new Error('Icon sizes must be integers between 16 and 4096 pixels.');
  const palette = ['#091324', '#203852', '#53c7e8', '#f1cd6f', '#eef4df'];
  const grid = Array.from({ length: 32 }, () => Array(32).fill(0));
  const box = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[j][i] = c;
  };
  box(6, 6, 20, 20, 1);
  box(8, 8, 16, 16, 0);
  box(8, 8, 8, 16, 2);
  box(16, 8, 8, 7, 1);
  box(16, 8, 2, 16, 4);
  box(16, 22, 8, 2, 4);
  box(22, 15, 2, 9, 4);
  box(21, 12, 4, 4, 3);
  box(22, 11, 2, 6, 3);
  box(20, 13, 6, 2, 3);
  const rectangles = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (grid[y][x])
        rectangles.push(
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[grid[y][x]]}"/>`,
        );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="${palette[0]}"/>${rectangles.join('')}</svg>\n`;
  const chunk = (kind, data) => {
    const type = Buffer.from(kind),
      header = Buffer.alloc(4),
      sum = Buffer.alloc(4);
    header.writeUInt32BE(data.length);
    sum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([header, type, data, sum]);
  };
  const png = (size) => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 2;
    const rows = Buffer.alloc((size * 3 + 1) * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const color = palette[grid[Math.floor((y * 32) / size)][Math.floor((x * 32) / size)]];
        const offset = y * (size * 3 + 1) + 1 + x * 3;
        for (let c = 0; c < 3; c++)
          rows[offset + c] = parseInt(color.slice(1 + c * 2, 3 + c * 2), 16);
      }
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(rows, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  };
  return [
    { name: 'icons/icon.svg', bytes: Buffer.from(svg) },
    ...sizes.map((size) => ({ name: `icons/icon-${size}.png`, bytes: png(size) })),
  ];
}

/** Adds a content-addressed offline app only when this source has its explicit UI helper. */
async function addOfflineEntries(
  root,
  entries,
  info,
  buildConfig,
  optionalDownloads = [],
  excludedBodyPaths = [],
  optionalArtwork = null,
) {
  if (!entries.some((e) => e.name === 'game/offline.mjs')) return;
  if (optionalArtwork) {
    const { verifyOptionalArtworkEntries } = await import('./optional-artwork.mjs');
    verifyOptionalArtworkEntries(optionalArtwork, entries);
  }
  const template = await fs.readFile(
    path.join(root, 'game/offline/service-worker.template.js'),
    'utf8',
  );
  if (!template.includes('__XONIX_OFFLINE_CONFIG__'))
    fail('Offline worker template has no configuration marker');
  entries.push(...offlineIcons());
  const optional = new Set([...(buildConfig.optionalOffline ?? []), ...optionalDownloads]);
  const optionalPacks = entries
    .filter((entry) => optional.has(entry.name))
    .map((entry) => {
      const pack = JSON.parse(entry.bytes);
      return { path: entry.name, id: pack.id, name: pack.name };
    });
  const manifest = {
    id: './',
    name: 'Reveal Line',
    short_name: 'Reveal Line',
    description: 'A territory-capture arcade game with interchangeable worlds and characters.',
    start_url: './game/',
    scope: './',
    // Android supports an installed game without browser or system chrome.
    // Browsers that cannot offer that (notably desktop and iPadOS) follow the
    // standards fallback to the native-feeling standalone app window instead.
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#091324',
    theme_color: '#091324',
    lang: 'en',
    icons: [
      { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: './icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
  entries.push({ name: 'manifest.webmanifest', bytes: Buffer.from(json(manifest)) });
  const placeholder = '0'.repeat(64),
    injected = [];
  for (const entry of entries.filter(
    (e) => e.name.endsWith('.html') && e.name.startsWith('game/'),
  )) {
    const relativeRoot = path.posix.relative(path.posix.dirname(entry.name), '.') || '.';
    const marker = {
      format: 'revealline-offline.v1',
      version: info.version,
      buildId: placeholder,
      scope: `${relativeRoot}/`,
      worker: `${relativeRoot}/service-worker.js`,
      ...(optionalPacks.length ? { optionalPacks } : {}),
      ...(optionalArtwork ? { optionalArtwork } : {}),
    };
    const source = entry.bytes.toString();
    const appMode = source.includes('name="apple-mobile-web-app-capable"')
      ? ''
      : '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">';
    const head = `<link rel="manifest" href="${relativeRoot}/manifest.webmanifest"><link rel="apple-touch-icon" href="${relativeRoot}/icons/icon-180.png"><meta name="theme-color" content="#091324">${appMode}<meta name="revealline-offline" content='${html(JSON.stringify(marker))}'>`;
    entry.bytes = Buffer.from(
      source.includes('</head>') ? source.replace('</head>', `${head}</head>`) : head + source,
    );
    injected.push(entry);
  }
  // Placeholder metadata prevents a circular hash; all other shipped bytes,
  // generated icon/manifest bytes and the worker logic participate in identity.
  const buildId = sha256(
    Buffer.from(
      json({
        info,
        template,
        files: [...entries]
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          .map((e) => [e.name, sha256(e.bytes)]),
      }),
    ),
  );
  for (const entry of injected)
    entry.bytes = Buffer.from(entry.bytes.toString().replace(placeholder, buildId));
  const excluded = new Set([
    ...optional,
    ...excludedBodyPaths,
    ...(optionalArtwork?.files.map((file) => file.path) ?? []),
  ]);
  const files = [...entries]
    .filter((entry) => entry.name !== '_headers' && !excluded.has(entry.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((e) => ({ path: e.name, bytes: e.bytes.length, sha256: sha256(e.bytes) }));
  if (files.length > 2000 || files.reduce((n, f) => n + f.bytes, 0) > 64 * 1024 * 1024)
    fail('Offline distribution exceeds 2000 files or 64 MiB; split optional content into packs');
  const config = {
    format: 'revealline-offline.v1',
    version: info.version,
    buildId,
    files,
    ...(optionalPacks.length ? { optionalPacks } : {}),
    ...(optionalArtwork ? { optionalArtwork } : {}),
  };
  entries.push({ name: 'offline-cache.json', bytes: Buffer.from(json(config)) });
  entries.push({
    name: 'service-worker.js',
    bytes: Buffer.from(template.replace('__XONIX_OFFLINE_CONFIG__', JSON.stringify(config))),
  });
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
  const optionalArtwork =
    config.optionalArtwork === undefined
      ? null
      : await (
          await import('./optional-artwork.mjs')
        ).readOptionalArtwork(root, config.optionalArtwork, files);
  await assertOutput(root, out, config.include);
  await validateBuildReferences(root, files);
  if (files.includes('game/coop/library.mjs')) await validateCoopContent(root);
  if (files.includes('game/content/campaign.json')) await validateLevels(root);
  if (files.includes('game/content/themes.json')) await validateThemes(root);
  if (files.includes('game/content/classes.json')) await validateClasses(root);
  if (
    files.includes('game/content/packs/index.json') ||
    files.includes('game/content/packs/archive-index.json')
  )
    await validatePacks(root);
  const optionalEntries =
    config.optionalChapters === undefined
      ? []
      : await (
          await import('./optional-distribution.mjs')
        ).readOptionalDistributionEntries(root, config.optionalChapters);
  if (optionalEntries.some((entry) => files.includes(entry.name)))
    fail('Optional chapter bodies must remain outside automatic build includes');
  if (config.optionalChapters && !files.includes(config.optionalChapters.catalog))
    fail('Optional chapter catalog must be included in the core build');
  const externalEntries =
    config.externalChapters === undefined
      ? []
      : await (
          await import('./external-distribution.mjs')
        ).readExternalDistributionEntries(root, config.externalChapters);
  if (config.externalChapters && !files.includes(config.externalChapters.catalog))
    fail('External chapter catalog must be included in the core build');
  const declared = new Set([...files, ...optionalEntries.map((entry) => entry.name)]);
  for (const entry of externalEntries) {
    if (declared.has(entry.name))
      fail(
        'External chapter bodies must remain outside automatic build includes and other downloads',
      );
    declared.add(entry.name);
  }
  let verifyRetainedEntries;
  if (files.includes('game/couch/coop-owned-presentation.mjs')) {
    const { readRetainedTeamPresentation, verifyRetainedTeamPresentationEntries } = await import(
      './retained-team-presentation.mjs'
    );
    const retainedPresentation = await readRetainedTeamPresentation(root, files, {
      excluded: [
        ...(config.optionalOffline ?? []),
        ...optionalEntries.map((entry) => entry.name),
        ...externalEntries.map((entry) => entry.name),
        ...(optionalArtwork?.files.map((file) => file.path) ?? []),
      ],
    });
    verifyRetainedEntries = (entries) =>
      verifyRetainedTeamPresentationEntries(retainedPresentation, entries);
  }
  await fs.mkdir(path.dirname(out), { recursive: true });
  const staging = await fs.mkdtemp(path.join(path.dirname(out), '.xonix-build-'));
  let old;
  try {
    const entries = [];
    for (const name of files)
      entries.push({ name, bytes: await fs.readFile(path.join(root, name)) });
    entries.push(...optionalEntries, ...externalEntries);
    verifyRetainedEntries?.(entries);
    const info = { formatVersion: FORMAT_VERSION, version, sourceRevision, entry: config.entry };
    const replace = (name, bytes) => {
      const found = entries.find((e) => e.name === name);
      if (found) found.bytes = Buffer.from(bytes);
      else entries.push({ name, bytes: Buffer.from(bytes) });
    };
    replace('game/build-info.json', json(info));
    addPublicEntries(entries, info);
    await addOfflineEntries(
      root,
      entries,
      info,
      config,
      optionalEntries.map((entry) => entry.name),
      externalEntries.map((entry) => entry.name),
      optionalArtwork,
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
  let publicHeaders = {};
  try {
    const ownership = JSON.parse(await fs.readFile(path.join(root, MARKER), 'utf8'));
    if (ownership.tool === 'xonix-game-cli' && ownership.formatVersion === FORMAT_VERSION)
      publicHeaders = PUBLIC_SECURITY_HEADERS;
  } catch {}
  const server = createServer(async (req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        ...publicHeaders,
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
        ...publicHeaders,
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

// Both paths belong to one snapshot. Reserve the fixed destination exclusively
// before replacing it, so an existing file or symlink is never overwritten.
export async function transferSnapshotArchive(
  archivePath,
  staging,
  { rename = fs.rename, copyFile = fs.copyFile, unlink = fs.unlink } = {},
) {
  const destination = path.join(staging, 'source.tar');
  const reservation = await fs.open(destination, 'wx');
  try {
    await reservation.close();
    try {
      await rename(archivePath, destination);
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
      await copyFile(archivePath, destination);
      await unlink(archivePath);
    }
  } catch (error) {
    await fs.rm(destination, { force: true });
    throw error;
  }
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
    await transferSnapshotArchive(archivePath, staging);
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
    'inspect-goals': ['pack', 'out'],
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
      'Xonix game CLI (Node built-ins)\n  serve [--root DIR] [--host 127.0.0.1] [--port 8768]\n  build [--out dist] [--version LABEL]\n  validate\n  test\n  generate --seed TEXT --out FILE.json\n  inspect-goals --pack FILE.json [--out REPORT.json]\n  release-snapshot --ref REF --version LABEL\n',
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
    for (const directory of [
      'scripts',
      'game',
      'authoring/motion-lab',
      'platforms/desktop/test',
      'platforms/ios/test',
    ])
      if (await exists(path.join(PROJECT_ROOT, directory)))
        for (const file of await regularFiles(PROJECT_ROOT, directory))
          if (/(?:^|\/)(?:test-[^/]+|[^/]+\.test)\.mjs$/.test(file)) files.push(file);
    if (!files.length) fail('No test files found');
    const concurrency = Math.min(4, Math.max(1, os.availableParallelism() - 1));
    const result = spawnSync(
      process.execPath,
      ['--test', `--test-concurrency=${concurrency}`, ...files.sort()],
      {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      },
    );
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
        ...(await validatePacks()),
        ...(await validateCoopContent()),
      }),
    );
  } else if (action === 'inspect-goals') {
    if (!options.pack) fail('Inspect-goals requires --pack');
    const report = await inspectGoals({ packPath: options.pack });
    if (options.out) {
      const target = path.resolve(options.out);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, json(report), { flag: 'wx' });
    }
    process.stdout.write(json(report));
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

export async function validateCoopContent(root = PROJECT_ROOT) {
  if (!(await exists(path.join(root, 'game/coop/library.mjs')))) return {};
  const { COOP_STARTER_PACK } = await import(
    pathToFileURL(path.join(root, 'game/coop/library.mjs')).href
  );
  const { validateCoopPack } = await import(
    pathToFileURL(path.join(root, 'game/coop/recipes.mjs')).href
  );
  const result = validateCoopPack(COOP_STARTER_PACK);
  if (!result.valid) fail(`Invalid co-op library: ${result.errors.join(' ')}`);
  return { coopPacks: 1, coopLevels: COOP_STARTER_PACK.levels.length };
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

async function boundedJSONFile(filename, maxBytes) {
  if (!(await fs.lstat(filename)).isFile()) fail('JSON input must be a regular file, not a link');
  const handle = await fs.open(filename, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) fail(`JSON input exceeds ${maxBytes} bytes`);
    const chunks = [];
    let size = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(65536, maxBytes + 1 - size));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > maxBytes) fail(`JSON input exceeds ${maxBytes} bytes`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    const bytes = Buffer.concat(chunks);
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } finally {
    await handle.close();
  }
}

// Import from the chosen source tree only when needed: old miniature/frozen builds
// without a pack index retain their existing CLI dependency boundary.
async function packTooling(root) {
  const module = (name) => import(pathToFileURL(path.join(root, 'game', name)).href);
  const [packs, catalog, library, level, registry, data] = await Promise.all([
    module('packs.mjs'),
    module('mastery-catalog.mjs'),
    module('library.mjs'),
    module('core/level.mjs'),
    module('core/registry.mjs'),
    module('data-json.mjs'),
  ]);
  return { ...packs, ...catalog, ...library, ...level, ...registry, ...data };
}

function packCatalogEntries(pack, tooling) {
  return pack.campaigns.map((source) => ({
    campaign: {
      ...source,
      classRecipes: pack.classRecipes.filter(
        (recipe) => !source.classIds || source.classIds.includes(recipe.id),
      ),
    },
    sourcePackId: pack.id,
    sourcePackFormat: pack.format,
    ...([
      tooling.MASTERY_PACK_VERSION,
      tooling.ENCOUNTER_PACK_VERSION,
      tooling.WIDE_PACK_VERSION,
      tooling.CLASSIC_PACK_VERSION,
    ].includes(pack.format)
      ? { masteries: pack.masteries.filter((definition) => definition.campaignId === source.id) }
      : {}),
  }));
}

async function readCheckedPack(filename, tooling) {
  const { bytes, value: pack } = await boundedJSONFile(filename, tooling.PACK_LIMITS.maxBytes);
  const checked = tooling.validatePack(pack);
  if (!checked.valid) fail(`Invalid pack ${path.basename(filename)}: ${checked.errors.join('; ')}`);
  return { pack, bytes, warnings: checked.warnings };
}

/** Structural/reference inspection only; neither image decode nor simulated play occurs. */
export async function inspectGoals({ packPath, root = PROJECT_ROOT } = {}) {
  if (typeof packPath !== 'string' || !packPath) fail('Inspect-goals requires --pack');
  const tooling = await packTooling(root);
  const { pack, bytes, warnings } = await readCheckedPack(path.resolve(packPath), tooling);
  const entries = packCatalogEntries(pack, tooling);
  const catalog = tooling.createMasteryCatalog(entries);
  return {
    format: 'xonix-goal-inspection.v1',
    pack: {
      id: pack.id,
      version: pack.version,
      format: pack.format,
      name: pack.name,
      bytes: bytes.length,
      sha256: sha256(bytes),
    },
    checks: {
      structure: 'valid',
      references: 'valid',
      installedLibrary: 'not-checked',
      imageDecoding: 'not-run',
      solvability: 'not-tested',
      awardAuthority: false,
    },
    campaigns: entries.map(({ campaign }) => {
      const key = tooling.campaignKey(campaign);
      return {
        id: campaign.id,
        title: campaign.title,
        campaignKey: key,
        rosterHash: tooling.rosterHash(campaign.classRecipes),
        classIds: campaign.classRecipes.map((recipe) => recipe.id),
        maps: campaign.levels.map((level) => {
          const registration = catalog.get(key, level.id);
          return {
            id: level.id,
            name: level.name,
            revision: level.revision,
            levelIdentity: `${level.version === 'xonix-level.v2' ? 'level-v2' : 'level-v1'}-${tooling.dataIdentity(tooling.normalizedLevel(level))}`,
            themeId: level.themeId ?? campaign.themeId ?? pack.themes[0].id,
            musicId: level.musicId ?? campaign.musicId ?? null,
            goalSource: registration
              ? pack.format === tooling.MASTERY_PACK_VERSION
                ? 'authored'
                : 'built-in-fallback'
              : 'none',
            definitionIdentity: registration?.definitionIdentity ?? null,
            definition: registration?.definition ?? null,
          };
        }),
      };
    }),
    warnings,
  };
}

/** Validate every indexed expansion, including co-installation goal conflicts, before building. */
export async function validatePacks(root = PROJECT_ROOT) {
  const relative = 'game/content/packs/index.json';
  if (!(await exists(path.join(root, relative)))) {
    if (await exists(path.join(root, 'game/content/packs/archive-index.json')))
      fail('Archive pack index requires the active pack index.');
    return {};
  }
  const index = await readPackIndexes(root);
  const tooling = await packTooling(root);
  const ids = new Set(),
    paths = new Set(),
    entries = [],
    summaries = new Map();
  const basePath = 'game/content/campaign.json';
  if (await exists(path.join(root, basePath))) {
    const { value: campaign } = await boundedJSONFile(
      await noSymlinkPath(root, basePath),
      tooling.PACK_LIMITS.maxBytes,
    );
    const classesPath = 'game/content/classes.json';
    const classRecipes = (await exists(path.join(root, classesPath)))
      ? (
          await boundedJSONFile(
            await noSymlinkPath(root, classesPath),
            tooling.PACK_LIMITS.maxBytes,
          )
        ).value
      : tooling.CLASSES;
    entries.push({ campaign: { ...campaign, classRecipes }, sourcePackId: null });
  }
  let levels = 0;
  for (const entry of index.all) {
    if (
      !tooling.plainObject(entry) ||
      !tooling.stableId(entry.id) ||
      typeof entry.path !== 'string' ||
      Object.keys(entry).some((key) => !['id', 'path'].includes(key))
    )
      fail('Invalid pack index entry');
    safeRelative(entry.path);
    if (!entry.path.endsWith('.json') || ids.has(entry.id) || paths.has(entry.path))
      fail('Pack index paths and IDs must be unique JSON files');
    ids.add(entry.id);
    paths.add(entry.path);
    const file = await noSymlinkPath(root, `game/content/packs/${entry.path}`);
    const { pack } = await readCheckedPack(file, tooling);
    if (pack.id !== entry.id) fail(`Pack index ID ${entry.id} does not match ${pack.id}`);
    summaries.set(entry.id, packNavigationSummary(entry, pack));
    entries.push(...packCatalogEntries(pack, tooling));
    levels += pack.campaigns.reduce((count, campaign) => count + campaign.levels.length, 0);
  }
  const catalog = tooling.createMasteryCatalog(entries);
  await validateNavigationCatalogs(root, index, summaries);
  return { packs: ids.size, packLevels: levels, packGoals: catalog.registrations.length };
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
