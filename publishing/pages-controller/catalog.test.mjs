import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { catalogShell, copyCatalogPresentation } from './catalog.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('controller catalog supplies the stylesheet requested by its copied page host', async (t) => {
  const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'controller-catalog-')));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source'),
    output = path.join(dir, 'output');
  const entry = await fs.readFile(
    new URL('../../game/presentation/page-entry.mjs', import.meta.url),
  );
  // Exercise the real entry's runtime URL resolution with a tiny local graph.
  // Host behavior is outside this packaging test; no compiled art is duplicated.
  const files = new Map([
    ['game/presentation/page-entry.mjs', entry],
    [
      'game/presentation/page.mjs',
      Buffer.from('export function mountPresentationPage() { return { close() {} }; }\n'),
    ],
    [
      'game/ui/operation-status.mjs',
      Buffer.from('export function createOperationStatus() { return { dispose() {} }; }\n'),
    ],
    ['game/ui/operation-status.css', Buffer.from('.operation-status-signal { width: 1em; }\n')],
    ['game/ui/field-kit-surfaces.mjs', Buffer.from('export {};\n')],
    ['site/release-catalog.css', Buffer.from('.release-catalog { color: white; }\n')],
    ['game/presentation/compiled/theme.css', Buffer.from(':root { --test-color: black; }\n')],
  ]);
  for (const part of ['fonts', 'tokens', 'components', 'surfaces', 'compiled'])
    files.set(`game/ui/field-kit-${part}.css`, Buffer.from(`/* ${part} */\n`));
  for (const name of ['Handjet-OFL.txt', 'Exo2-OFL.txt', 'IBMPlexMono-OFL.txt', 'provenance.json'])
    files.set(
      `game/ui/fonts/field-kit/${name}`,
      Buffer.from(name.endsWith('.json') ? '{}\n' : 'notice\n'),
    );
  const theme = files.get('game/presentation/compiled/theme.css');
  files.set(
    'game/presentation/compiled/manifest.json',
    Buffer.from(
      JSON.stringify({
        format: 'revealline-presentation-build.v1',
        files: [{ path: 'theme.css', bytes: theme.length, sha256: hash(theme) }],
      }),
    ),
  );
  for (const [name, bytes] of files) {
    const target = path.join(source, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
  const frozen = path.join(output, 'releases/v0.1.0/site/game/index.html');
  await fs.mkdir(path.dirname(frozen), { recursive: true });
  await fs.writeFile(frozen, 'unchanged frozen game\n');
  const receipt = await copyCatalogPresentation(source, output);
  const copiedEntry = pathToFileURL(
    path.join(output, 'catalog-ui/game/presentation/page-entry.mjs'),
  );
  const { mountAuxiliaryPresentationPage } = await import(copiedEntry.href);
  const links = [];
  const doc = {
    baseURI: pathToFileURL(path.join(output, 'releases/index.html')).href,
    head: { append: (link) => links.push(link) },
    body: { append() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
      tag,
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      remove() {},
    }),
  };
  const lease = mountAuxiliaryPresentationPage({ document: doc, window: {} });
  assert.equal(links.length, 1);
  assert.equal(links[0].attributes.rel, 'stylesheet');
  const requested = new URL(links[0].attributes.href);
  assert.equal(requested.href, new URL('../ui/operation-status.css', copiedEntry).href);
  assert.deepEqual(await fs.readFile(requested), files.get('game/ui/operation-status.css'));
  lease.close();

  // Both catalog document depths resolve every emitted HTML resource to output.
  for (const [relative, prefix] of [
    ['index.html', './'],
    ['releases/index.html', '../'],
  ]) {
    const html = catalogShell('Explorer', '<h1>Explorer</h1>', { presentation: true, prefix });
    const documentURL = pathToFileURL(path.join(output, relative));
    for (const match of html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/g))
      assert.ok((await fs.stat(new URL(match[1], documentURL))).isFile(), match[1]);
  }
  assert.equal(receipt.files, files.size);
  assert.equal(
    receipt.bytes,
    [...files.values()].reduce((total, bytes) => total + bytes.length, 0),
  );
  for (const [name, bytes] of files)
    assert.deepEqual(await fs.readFile(path.join(output, 'catalog-ui', name)), bytes, name);
  assert.equal(await fs.readFile(frozen, 'utf8'), 'unchanged frozen game\n');
});
