import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildProject,
  collectBuildFiles,
  crc32,
  createZip,
  generateLevel,
  parseArguments,
  readBuildConfig,
  readTarEntries,
  releaseSnapshot,
  safeRelative,
  safeVersion,
  startServer,
  validateBuildReferences,
  validateLevels,
  validateThemes,
  validateClasses,
} from './game-cli.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'xonix-tool-test-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'project');
  await fs.mkdir(path.join(root, 'game'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'game/index.html'),
    '<link href="./style.css" rel="stylesheet"><script type="module" src="./app.mjs"></script>',
  );
  await fs.writeFile(path.join(root, 'game/style.css'), 'body{color:navy}');
  await fs.writeFile(
    path.join(root, 'game/app.mjs'),
    'import { value } from "./core.mjs";\nexport const result = value;\n',
  );
  await fs.writeFile(path.join(root, 'game/core.mjs'), 'export const value = 3;\n');
  await fs.writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: '0.1.0', entry: 'game/index.html', include: ['game'] }),
  );
  return { root, directory, out: path.join(directory, 'dist') };
}

test('strict command parsing rejects typos, duplicates and absent values', () => {
  assert.deepEqual(parseArguments(['build', '--version', '0.1.0']), {
    action: 'build',
    options: { version: '0.1.0' },
  });
  assert.equal(parseArguments(['--help']).action, 'help');
  for (const args of [
    ['deploy'],
    ['toString'],
    ['__proto__'],
    ['build', '--force', 'yes'],
    ['build', '--version'],
    ['serve', '--root', '.', '--root', 'other'],
    ['test', '--seed', 'one'],
    ['generate', '--seed', '--out', 'x'],
  ])
    assert.throws(() => parseArguments(args));
});

test('version and relative-path rules exclude traversal and command-like labels', () => {
  for (const v of ['0.1.0', 'round-09', 'v1.0.0-beta.1']) assert.equal(safeVersion(v), v);
  for (const v of [
    '../one',
    '.hidden',
    '--version',
    'a..b',
    'a/b',
    'x y',
    'x\n',
    '',
    'x'.repeat(65),
  ])
    assert.throws(() => safeVersion(v));
  for (const p of ['../one', '/etc/passwd', 'a/../b', 'a//b', 'C:/tmp', 'a\\b', 'a\0b'])
    assert.throws(() => safeRelative(p));
  assert.equal(safeRelative('game/my file.png'), 'game/my file.png');
});

test('snapshot rejects unsafe refs and index-conflicting labels before any Git command', async () => {
  await assert.rejects(releaseSnapshot({ ref: '--help', version: '1.0' }), /trusted local/);
  await assert.rejects(releaseSnapshot({ ref: 'HEAD', version: 'INDEX.HTML' }), /version index/);
  await assert.rejects(releaseSnapshot({ ref: 'HEAD', version: 'index.json' }), /version index/);
});

test('build is byte-reproducible and each manifest checksum covers exact output bytes', async (t) => {
  const { root, out, directory } = await fixture(t);
  const first = await buildProject({ root, out });
  const secondOut = path.join(directory, 'comparison');
  const second = await buildProject({ root, out: secondOut });
  assert.equal(first.sha256, second.sha256);
  assert.deepEqual(
    await fs.readFile(path.join(out, 'distribution.zip')),
    await fs.readFile(path.join(secondOut, 'distribution.zip')),
  );
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8'));
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(path.join(out, entry.path));
    assert.equal(hash(bytes), entry.sha256);
    assert.equal(bytes.length, entry.bytes);
  }
  assert.equal(
    manifest.totalBytes,
    manifest.files.reduce((sum, f) => sum + f.bytes, 0),
  );
  assert.equal(
    JSON.parse(await fs.readFile(path.join(out, 'game/build-info.json'), 'utf8')).version,
    '0.1.0',
  );
  assert.match(await fs.readFile(path.join(out, 'index.html'), 'utf8'), /\.\/game\/index.html/);
  assert.equal(
    await fs.readFile(path.join(root, 'game/core.mjs'), 'utf8'),
    'export const value = 3;\n',
  );
});

test('owned rebuild replaces old outputs and changes checksums when source changes', async (t) => {
  const { root, out } = await fixture(t);
  const first = await buildProject({ root, out });
  await fs.writeFile(path.join(out, 'obsolete.txt'), 'generated old output');
  await fs.writeFile(path.join(root, 'game/core.mjs'), 'export const value = 4;');
  const second = await buildProject({ root, out, version: '0.1.1' });
  assert.notEqual(first.sha256, second.sha256);
  await assert.rejects(fs.access(path.join(out, 'obsolete.txt')));
  assert.equal(
    JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8')).version,
    '0.1.1',
  );
});

test('build refuses unrelated output, overlapping source and malformed revision', async (t) => {
  const { root, out } = await fixture(t);
  await fs.mkdir(out);
  await fs.writeFile(path.join(out, 'user.txt'), 'keep');
  await assert.rejects(buildProject({ root, out }), /not owned/);
  assert.equal(await fs.readFile(path.join(out, 'user.txt'), 'utf8'), 'keep');
  await assert.rejects(buildProject({ root, out: root }), /source directory/);
  await assert.rejects(buildProject({ root, out: path.join(root, 'game/output') }), /overlaps/);
  await assert.rejects(buildProject({ root, out, sourceRevision: 'HEAD' }), /full commit/);
});

test('missing dependencies and invalid JSON fail before replacing a working build', async (t) => {
  const { root, out } = await fixture(t);
  const result = await buildProject({ root, out });
  await fs.writeFile(path.join(root, 'game/app.mjs'), 'import "./missing.mjs";');
  await assert.rejects(buildProject({ root, out }), /Missing distribution references/);
  assert.equal(hash(await fs.readFile(path.join(out, 'distribution.zip'))), result.sha256);
  await fs.writeFile(path.join(root, 'game/app.mjs'), 'import "some-package";');
  await assert.rejects(buildProject({ root, out }), /bare import/);
  await fs.writeFile(path.join(root, 'game/app.mjs'), 'export {};');
  await fs.writeFile(path.join(root, 'game/bad.json'), '{');
  await assert.rejects(buildProject({ root, out }), SyntaxError);
});

test('build excludes private include paths and rejects symbolic source links', async (t) => {
  const { root, directory } = await fixture(t);
  await fs.writeFile(path.join(directory, 'secret.txt'), 'private');
  await fs.symlink(path.join(directory, 'secret.txt'), path.join(root, 'game/link.txt'));
  await assert.rejects(collectBuildFiles(root), /Symbolic links/);
  await fs.rm(path.join(root, 'game/link.txt'));
  await fs.writeFile(path.join(root, 'game/.env'), 'private');
  await assert.rejects(collectBuildFiles(root), /Private path/);
  await fs.writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: '0.1', entry: 'game/index.html', include: ['.git'] }),
  );
  await assert.rejects(readBuildConfig(root), /private\/generated/);
});

test('runtime builds omit source-only game tests while retaining ordinary game files', async (t) => {
  const { root, out } = await fixture(t);
  await fs.mkdir(path.join(root, 'game/test'));
  await fs.writeFile(
    path.join(root, 'game/test/source.test.mjs'),
    'import "../../scripts/source-only.mjs";',
  );
  await buildProject({ root, out });
  await assert.rejects(fs.access(path.join(out, 'game/test/source.test.mjs')));
  await fs.access(path.join(out, 'game/core.mjs'));
});

test('portable resource checks resolve nested relative imports and reject root-only URLs', async (t) => {
  const { root } = await fixture(t);
  const files = await collectBuildFiles(root);
  await validateBuildReferences(root, files);
  await fs.writeFile(
    path.join(root, 'game/index.html'),
    '<a href="./">Game</a><a href="../docs/research.md">Source notes</a>',
  );
  assert.deepEqual((await validateBuildReferences(root, files)).navigationWarnings, [
    'game/index.html → ../docs/research.md',
  ]);
  await fs.writeFile(path.join(root, 'game/index.html'), '<script src="/game/app.mjs"></script>');
  await assert.rejects(validateBuildReferences(root, files), /not portable/);
});

test('ZIP uses standard CRC, sorted names, fixed timestamps and stored data', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entries = [
    { name: 'b.txt', bytes: Buffer.from('B') },
    { name: 'a.txt', bytes: Buffer.from('A') },
  ];
  assert.deepEqual(createZip(entries), createZip(entries.toReversed()));
  const zip = createZip(entries);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(8), 0);
  assert.equal(zip.readUInt16LE(10), 0);
  assert.equal(zip.readUInt16LE(12), 33);
  assert.equal(zip.subarray(30, 35).toString(), 'a.txt');
  assert.equal(zip[35], 65);
  assert.throws(() => createZip([{ name: '../escape', bytes: Buffer.from('x') }]), /Unsafe/);
});

function getRaw(base, requested, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(base),
      req = request(
        { hostname: url.hostname, port: url.port, path: requested, method },
        (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks).toString(),
            }),
          );
        },
      );
    req.on('error', reject);
    req.end();
  });
}

test('static server supports portable nested paths, ESM MIME and HEAD', async (t) => {
  const { root } = await fixture(t);
  const { server, url } = await startServer({ root, port: 0 });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const page = await getRaw(url, '/game/');
  assert.equal(page.status, 200);
  assert.match(page.body, /app.mjs/);
  const script = await getRaw(url, '/game/app.mjs');
  assert.match(script.headers['content-type'], /javascript/);
  const head = await getRaw(url, '/game/app.mjs', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);
  const redirect = await getRaw(url, '/game');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/game/');
  assert.equal((await getRaw(url, '//game')).headers.location, '/game/');
  assert.equal((await getRaw(url, '/game/', 'POST')).status, 405);
});

test('static server refuses traversal, hidden files, malformed paths and symlink escape', async (t) => {
  const { root, directory } = await fixture(t);
  await fs.writeFile(path.join(directory, 'secret.txt'), 'private');
  await fs.symlink(path.join(directory, 'secret.txt'), path.join(root, 'game/link.txt'));
  await fs.mkdir(path.join(root, '.git'));
  await fs.writeFile(path.join(root, '.git/config'), 'private');
  const { server, url } = await startServer({ root, port: 0 });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const input of ['/../secret.txt', '/%2e%2e/secret.txt', '/.git/config', '/game/link.txt'])
    assert.equal((await getRaw(url, input)).status, 403);
  for (const input of ['/%ZZ', '/%00', '/game%5clink.txt'])
    assert.equal((await getRaw(url, input)).status, 400);
  assert.equal((await getRaw(url, '/absent')).status, 404);
});

function tarRecord(name, data = '', type = '0') {
  const bytes = Buffer.from(data),
    header = Buffer.alloc(512);
  header.write(name, 0, 100);
  header.write('0000644\0', 100);
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
  header.write('00000000000\0', 136);
  header.fill(32, 148, 156);
  header.write(type, 156);
  header.write('ustar\0', 257);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  return Buffer.concat([header, bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512)]);
}

test('Git archive reader extracts regular data and rejects links, traversal and duplicates', () => {
  const archive = Buffer.concat([
    tarRecord('game/', '', '5'),
    tarRecord('game/index.html', '<h1>Archived</h1>'),
    Buffer.alloc(1024),
  ]);
  const records = readTarEntries(archive);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, 'game/index.html');
  assert.equal(records[0].bytes.toString(), '<h1>Archived</h1>');
  for (const archive of [
    tarRecord('../escape', 'x'),
    tarRecord('/absolute', 'x'),
    tarRecord('link', 'x', '2'),
    tarRecord('.git/config', 'x'),
    Buffer.concat([tarRecord('file', 'a'), tarRecord('file', 'b')]),
  ])
    assert.throws(() => readTarEntries(archive));
  const bad = tarRecord('file', 'a');
  bad[20] ^= 1;
  assert.throws(() => readTarEntries(bad), /checksum/);
  assert.throws(() => readTarEntries(tarRecord('file', 'more').subarray(0, 514)), /Truncated/);
});

test('generator produces deterministic explicit valid maps across seeds using the actual core', async () => {
  const core = await import('../game/core/index.mjs');
  const browserGenerator = await import('../game/generator.mjs');
  const a = await generateLevel('sunflower'),
    b = await generateLevel('sunflower');
  assert.deepEqual(a, b);
  assert.deepEqual(a, browserGenerator.generateLevel('sunflower'));
  const seen = new Set();
  for (const seed of [
    'sunflower',
    'night',
    'Київ',
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
  ]) {
    const level = await generateLevel(seed);
    assert.equal(level.width, 48);
    assert.equal(level.height, 36);
    assert.equal(core.validateLevel(level).valid, true);
    seen.add(JSON.stringify(level.walls));
  }
  assert.ok(seen.size > 1);
  await assert.rejects(generateLevel(''), /Seed/);
});

test('campaign validation uses the core and rejects duplicate or malformed levels', async (t) => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, 'game/core'));
  await fs.mkdir(path.join(root, 'game/content'));
  const actualCore = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../game/core/index.mjs',
  );
  // The fixture delegates to the exact runtime validator; no duplicate validator is maintained.
  await fs.writeFile(
    path.join(root, 'game/core/index.mjs'),
    `export { validateLevel } from ${JSON.stringify(pathToFileURL(actualCore).href)};`,
  );
  const level = await generateLevel('campaign-fixture');
  const campaign = { version: 'xonix-campaign.v1', id: 'fixture', revision: '1', levels: [level] };
  const write = () =>
    fs.writeFile(path.join(root, 'game/content/campaign.json'), JSON.stringify(campaign));
  await write();
  assert.equal((await validateLevels(root)).levels, 1);
  campaign.levels.push(level);
  await write();
  await assert.rejects(validateLevels(root), /Duplicate/);
  campaign.levels = [{ ...level, width: 0 }];
  await write();
  await assert.rejects(validateLevels(root), /Invalid campaign/);
});

test('theme validation uses the actual content registry and rejects invalid or duplicate entries', async (t) => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, 'game/content'));
  const actualContent = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../game/content.mjs',
  );
  await fs.writeFile(
    path.join(root, 'game/content.mjs'),
    `export { validateTheme } from ${JSON.stringify(pathToFileURL(actualContent).href)};`,
  );
  const document = JSON.parse(
    await fs.readFile(new URL('../game/content/themes.json', import.meta.url), 'utf8'),
  );
  const write = () =>
    fs.writeFile(path.join(root, 'game/content/themes.json'), JSON.stringify(document));
  await write();
  assert.equal((await validateThemes(root)).themes, document.themes.length);
  document.themes.push(structuredClone(document.themes[0]));
  await write();
  await assert.rejects(validateThemes(root), /duplicate theme ID/);
  document.themes.pop();
  document.themes[0].scene = 'unregistered';
  await write();
  await assert.rejects(validateThemes(root), /Invalid theme/);
  document.themes = [];
  await write();
  await assert.rejects(validateThemes(root), /nonempty themes/);
});

test('class validation accepts current data and rejects unsupported mechanics through the core', async (t) => {
  const { root } = await fixture(t);
  await fs.mkdir(path.join(root, 'game/content'));
  await fs.mkdir(path.join(root, 'game/core'));
  const actualCore = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../game/core/index.mjs',
  );
  await fs.writeFile(
    path.join(root, 'game/core/index.mjs'),
    `export { validateClassRecipes } from ${JSON.stringify(pathToFileURL(actualCore).href)};`,
  );
  const recipes = JSON.parse(
    await fs.readFile(new URL('../game/content/classes.json', import.meta.url), 'utf8'),
  );
  const write = () =>
    fs.writeFile(path.join(root, 'game/content/classes.json'), JSON.stringify(recipes));
  await write();
  assert.equal((await validateClasses(root)).classes, recipes.length);
  recipes[0].primitive = 'teleport';
  await write();
  await assert.rejects(validateClasses(root), /Invalid class recipes/);
});
