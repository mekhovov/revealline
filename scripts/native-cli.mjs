#!/usr/bin/env node
/** Verify and stage a web distribution for a local native shell. Node built-ins only. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { safeRelative, safeVersion, PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';

export const NATIVE_MARKER = '.revealline-native.json';
const FORMAT = 'revealline-native-site.v1';
// The complete current distribution includes optional chapter and soundtrack
// originals. Match the desktop resource reader's bounded full-site inventory.
export const MAX_NATIVE_FILES = 4096;
export const MAX_NATIVE_SITE_BYTES = 768 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const within = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);
const fail = (message) => {
  throw new Error(message);
};
// WKWebView's bundled server does not read a static host's _headers file.
// frame-ancestors is a response-header directive and has no effect in a meta tag.
export const IOS_CSP = PUBLIC_SECURITY_HEADERS['Content-Security-Policy']
  .split(';')
  .map((part) => part.trim())
  .filter((part) => part && !/^frame-ancestors\b/i.test(part))
  .join('; ');
function policyDirectives(value) {
  const directives = new Map();
  for (const part of value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    if (directives.has(name) || !values.length) fail('Invalid or duplicate iOS CSP directive');
    directives.set(name, values);
  }
  return directives;
}
function compatiblePolicy(value) {
  const expected = policyDirectives(IOS_CSP),
    actual = policyDirectives(value);
  for (const name of actual.keys()) if (!expected.has(name)) return false;
  for (const [name, allowed] of expected) {
    // These directives have no default-src fallback. Requiring them explicitly
    // also avoids treating an ignored/unsupported policy as equivalent.
    const tokens =
      actual.get(name) ??
      (!['base-uri', 'form-action'].includes(name) ? actual.get('default-src') : null);
    if (!tokens?.length || tokens.some((token) => !allowed.includes(token))) return false;
  }
  return (
    actual.get('script-src')?.join(' ') === "'self'" &&
    actual.get('connect-src')?.join(' ') === "'self'"
  );
}
function attributes(tag) {
  const result = new Map();
  const source = tag.replace(/^<\s*[^\s/>]+/, '').replace(/\/?\s*>$/, '');
  const pattern = /([^\s=<>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>"'=]+)))?/gy;
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index++;
      continue;
    }
    pattern.lastIndex = index;
    const match = pattern.exec(source);
    if (!match) fail('Unsupported attributes in native HTML meta');
    const name = match[1].toLowerCase();
    if (result.has(name)) fail('Duplicate attributes in native HTML meta');
    result.set(name, match[2] ?? match[3] ?? match[4] ?? '');
    index = pattern.lastIndex;
  }
  return result;
}
/** Deliberately narrow transformation for reviewed first-party HTML documents.
 * Unexpected head structures or conflicting policies fail instead of guessing.
 */
export function iosHTMLPolicy(bytes, name = 'HTML') {
  let html;
  try {
    html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail(`Native HTML must be UTF-8: ${name}`);
  }
  // Preserve offsets while excluding comments and raw script/style bodies from
  // structural matching. Text resembling <head> inside code is not an element.
  const masked = html
    .replace(/<!--[\s\S]*?-->/g, (s) => ' '.repeat(s.length))
    .replace(
      /(<(?:script|style)\b[^>]*>)([\s\S]*?)(<\/(?:script|style)\s*>)/gi,
      (_, open, body, close) => open + ' '.repeat(body.length) + close,
    );
  const tags = [...masked.matchAll(/<(?:[^<>"']|"[^"]*"|'[^']*')*>/g)];
  const heads = tags.filter((tag) => /^<head(?:\s|>)/i.test(tag[0])),
    ends = tags.filter((tag) => /^<\/head\s*>/i.test(tag[0]));
  if (heads.length !== 1 || ends.length !== 1 || heads[0].index >= ends[0].index)
    fail(`Native HTML needs one explicit head: ${name}`);
  const headEnd = heads[0].index + heads[0][0].length;
  if (tags.some((tag) => /^<script(?:\s|>)/i.test(tag[0]) && tag.index < headEnd))
    fail(`Native HTML has a script before its head: ${name}`);
  const policies = [];
  for (const tag of tags.filter((tag) => /^<meta(?:\s|\/?>)/i.test(tag[0]))) {
    const attrs = attributes(tag[0]);
    if (/^content-security-policy(?:-report-only)?$/i.test(attrs.get('http-equiv') ?? '')) {
      if (
        attrs.get('http-equiv').toLowerCase() !== 'content-security-policy' ||
        !compatiblePolicy(attrs.get('content') ?? '')
      )
        fail(`Incompatible existing iOS CSP: ${name}`);
      policies.push(tag);
    }
  }
  if (policies.length > 1) fail(`Duplicate existing iOS CSP: ${name}`);
  const previous = policies[0];
  if (previous && (previous.index < headEnd || previous.index >= ends[0].index))
    fail(`Existing iOS CSP must be inside head: ${name}`);
  if (previous && !html.slice(headEnd, previous.index).trim()) return bytes;
  const meta = previous
    ? html.slice(previous.index, previous.index + previous[0].length)
    : `<meta http-equiv="Content-Security-Policy" content="${IOS_CSP}" />`;
  if (previous)
    html = html.slice(0, previous.index) + html.slice(previous.index + previous[0].length);
  return Buffer.from(html.slice(0, headEnd) + `\n    ${meta}` + html.slice(headEnd));
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
async function noLinks(root, relative = '') {
  let current = path.parse(path.resolve(root)).root;
  for (const piece of path
    .resolve(root, relative)
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, piece);
    if ((await fs.lstat(current)).isSymbolicLink())
      fail(`Symbolic link is not a native input: ${current}`);
  }
  return current;
}
async function boundedFile(target, maxBytes, expectedBytes) {
  const handle = await fs.open(target, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) fail(`Native input is not a file: ${target}`);
    if (info.size > maxBytes || (expectedBytes !== undefined && info.size !== expectedBytes))
      fail(`Native file size failed verification: ${target}`);
    // One extra byte detects a file that grows after stat without unbounded reads.
    const buffer = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== info.size) fail(`Native file changed during verification: ${target}`);
    return buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}
async function prepareParent(parent) {
  let existing = parent;
  while (!(await exists(existing))) existing = path.dirname(existing);
  // Check before mkdir: an existing symlink must not create directories elsewhere.
  await noLinks(existing);
  await fs.mkdir(parent, { recursive: true });
  await noLinks(parent);
}
async function filesAt(root, relative = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await filesAt(root, name)));
    else if (entry.isFile()) result.push(name);
    else fail(`Unsupported native file: ${name}`);
  }
  return result.sort();
}
export async function verifySite(site, { native = false } = {}) {
  site = await noLinks(path.resolve(site));
  const bytes = await boundedFile(await noLinks(site, 'manifest.json'), 1024 * 1024);
  const manifest = JSON.parse(bytes);
  if (manifest.formatVersion !== 1 || manifest.entry !== 'game/index.html')
    fail('Expected a Reveal Line web distribution');
  safeVersion(manifest.version);
  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > MAX_NATIVE_FILES
  )
    fail('Invalid native file inventory');
  const entries = [],
    names = new Set();
  let total = 0;
  for (const item of manifest.files) {
    safeRelative(item.path);
    if (names.has(item.path) || ['manifest.json', NATIVE_MARKER].includes(item.path))
      fail(`Invalid duplicate or reserved native path: ${item.path}`);
    names.add(item.path);
    if (
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 0 ||
      item.bytes > 64 * 1024 * 1024 ||
      !/^[0-9a-f]{64}$/.test(item.sha256)
    )
      fail(`Invalid native inventory record: ${item.path}`);
    total += item.bytes;
    if (total > MAX_NATIVE_SITE_BYTES) fail('Native site exceeds 768 MiB');
    const target = await noLinks(site, item.path);
    const content = await boundedFile(target, 64 * 1024 * 1024, item.bytes);
    if (content.length !== item.bytes || hash(content) !== item.sha256)
      fail(`Native asset failed verification: ${item.path}`);
    entries.push({ name: item.path, bytes: content });
  }
  if (!names.has(manifest.entry) || manifest.totalBytes !== total)
    fail('Incomplete native inventory');
  let marker = null;
  if (native) {
    marker = JSON.parse(await boundedFile(await noLinks(site, NATIVE_MARKER), 16384));
    if (
      marker.format !== FORMAT ||
      !['desktop', 'ios'].includes(marker.platform) ||
      marker.version !== manifest.version ||
      marker.entry !== manifest.entry ||
      marker.manifestSha256 !== hash(bytes)
    )
      fail('Native marker does not match its inventory');
    if (
      marker.scheme !== (marker.platform === 'desktop' ? 'revealline' : 'capacitor') ||
      marker.host !== (marker.platform === 'desktop' ? 'app' : 'localhost')
    )
      fail('Native origin mismatch');
    if (!/^[0-9a-f]{64}$/.test(marker.sourceManifestSha256))
      fail('Invalid source inventory identity');
    const expected = [...names, 'manifest.json', NATIVE_MARKER].sort();
    if (JSON.stringify(await filesAt(site)) !== JSON.stringify(expected))
      fail('Native stage has untracked files; preserve it and choose a new output');
  }
  return { site, manifest, manifestBytes: bytes, entries, marker, manifestSha256: hash(bytes) };
}

export async function stageNative({ site, out, platform, bridge, diagnostics, replace = false }) {
  if (!['desktop', 'ios'].includes(platform)) fail('Choose --platform desktop or ios');
  if (diagnostics && platform !== 'ios') fail('--diagnostics is only supported for iOS');
  if (!site || !out) fail('--site and --out are required');
  const verified = await verifySite(site);
  out = path.resolve(out);
  if (within(verified.site, out) || within(out, verified.site))
    fail('Native output must be separate from its source distribution');
  await prepareParent(path.dirname(out));
  let previous = false;
  if (await exists(out)) {
    if (!replace)
      fail('Native output exists. Use --replace only for an unchanged verified native stage');
    const old = await verifySite(out, { native: true });
    if (old.marker.platform !== platform) fail('Cannot replace a different native platform');
    previous = true;
  }
  const entries = verified.entries.slice();
  if (platform === 'ios') {
    if (!bridge) fail('iOS requires --bridge pointing to the bundled official plugin adapter');
    const bridgePath = await noLinks(path.resolve(bridge));
    const bytes = await boundedFile(bridgePath, 1024 * 1024);
    if (!bytes.length || bytes.length > 1024 * 1024)
      fail('Native bridge size must be between 1 byte and 1 MiB');
    if (entries.some((e) => e.name === 'native/bridge.mjs'))
      fail('Web source already contains a native bridge');
    entries.push({ name: 'native/bridge.mjs', bytes });
    if (diagnostics) {
      const directory = await noLinks(path.resolve(diagnostics));
      for (const file of ['index.html', 'page.js', 'probe.mjs', 'style.css']) {
        const name = `diagnostics/${file}`;
        if (entries.some((entry) => entry.name === name))
          fail(`Web source already contains native diagnostics: ${name}`);
        const bytes = await boundedFile(await noLinks(directory, file), 128 * 1024);
        if (!bytes.length) fail(`Native diagnostics must not be empty: ${file}`);
        entries.push({ name, bytes });
      }
    }
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (/\.html?$/i.test(entry.name))
        entries[index] = { ...entry, bytes: iosHTMLPolicy(entry.bytes, entry.name) };
    }
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const manifest = {
    ...verified.manifest,
    totalBytes: entries.reduce((sum, e) => sum + e.bytes.length, 0),
    files: entries.map((e) => ({ path: e.name, bytes: e.bytes.length, sha256: hash(e.bytes) })),
  };
  // Preserve exact manifest bytes when no native file was added.
  const manifestBytes =
    platform === 'desktop' ? verified.manifestBytes : Buffer.from(json(manifest));
  const marker = {
    format: FORMAT,
    platform,
    scheme: platform === 'desktop' ? 'revealline' : 'capacitor',
    host: platform === 'desktop' ? 'app' : 'localhost',
    entry: manifest.entry,
    version: manifest.version,
    manifestSha256: hash(manifestBytes),
    sourceManifestSha256: verified.manifestSha256,
  };
  const temp = await fs.mkdtemp(path.join(path.dirname(out), '.revealline-native-'));
  let movedOld = false;
  const backup = `${temp}-previous`;
  try {
    for (const entry of entries) {
      const target = path.join(temp, entry.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.bytes);
    }
    await fs.writeFile(path.join(temp, 'manifest.json'), manifestBytes);
    await fs.writeFile(path.join(temp, NATIVE_MARKER), json(marker));
    await verifySite(temp, { native: true });
    if (previous) {
      await fs.rename(out, backup);
      movedOld = true;
    }
    try {
      await fs.rename(temp, out);
    } catch (e) {
      if (movedOld) {
        await fs.rename(backup, out);
        movedOld = false;
      }
      throw e;
    }
    if (movedOld) await fs.rm(backup, { recursive: true });
    return { ...marker, out, files: entries.length, bytes: manifest.totalBytes };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

async function main(args) {
  const [command, ...rest] = args;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--replace') options.replace = true;
    else if (
      ['--site', '--out', '--platform', '--bridge', '--diagnostics'].includes(rest[i]) &&
      rest[i + 1] &&
      !rest[i + 1].startsWith('--')
    )
      options[rest[i++].slice(2)] = rest[i];
    else fail(`Unknown or incomplete option: ${rest[i]}`);
  }
  if (command === 'stage') process.stdout.write(json(await stageNative(options)));
  else if (command === 'verify' && options.site) {
    const v = await verifySite(options.site, { native: true });
    process.stdout.write(
      json({ ...v.marker, files: v.entries.length, bytes: v.manifest.totalBytes }),
    );
  } else
    fail(
      'Usage: node scripts/native-cli.mjs stage --platform desktop|ios --site <verified-web-site> --out <new-dir> [--bridge <ios-esm-bundle>] [--diagnostics <ios-diagnostics-dir>] [--replace]\n       node scripts/native-cli.mjs verify --site <native-stage>',
    );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`Native CLI error: ${e.message}\n`);
    process.exitCode = 1;
  });
}
