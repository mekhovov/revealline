import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { planCurrentEntries } from '../../scripts/pages-current-entry.mjs';

const directoryURL = new URL('../community/index.html', import.meta.url);
const descendants = (node) => [node, ...(node.childNodes ?? []).flatMap(descendants)];
const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const readDirectory = () => fs.readFile(directoryURL, 'utf8');
const digest = (value) => createHash('sha256').update(value).digest('hex');

test('public company directory can display and navigate without a community backend', async () => {
  const source = await readDirectory(),
    nodes = descendants(parse(source));
  assert.equal(
    attribute(
      nodes.find((node) => node.tagName === 'html'),
      'data-community-api',
    ),
    undefined,
  );
  const scripts = nodes.filter((node) => node.tagName === 'script');
  assert.deepEqual(
    scripts.map((node) => attribute(node, 'src')).sort(),
    ['../i18n/bootstrap.mjs', '../i18n/catalogs.mjs', '../vendor/i18next-26.4.2.min.js'],
    'Only the local localization runtime runs; no catalog/auth/client bootstrap is loaded.',
  );
  for (const node of scripts) {
    assert.notEqual(attribute(node, 'type'), 'module');
    assert.equal(
      (node.childNodes ?? [])
        .map((child) => child.value ?? '')
        .join('')
        .trim(),
      '',
    );
  }
  assert.ok(!nodes.some((node) => ['form', 'input', 'textarea'].includes(node.tagName)));
  assert.ok(
    !nodes.some((node) =>
      ['account', 'catalog', 'publish', 'status'].includes(attribute(node, 'id')),
    ),
  );
  assert.ok(!nodes.some((node) => node.attrs?.some((item) => /^on/i.test(item.name))));
  assert.doesNotMatch(source, /(?:\/v1\/catalog|\/api\/auth|page\.mjs|account\.mjs|client\.mjs)/);
  const links = nodes.filter((node) => node.tagName === 'a').map((node) => attribute(node, 'href'));
  assert.ok(links.includes('../company.html?edition=droneaid'));
  assert.ok(links.includes('../company.html?edition=coupa-all'));
});

test('company launch links stay in the same local or frozen distribution at every supported depth', async () => {
  const nodes = descendants(parse(await readDirectory()));
  const links = nodes
    .filter((node) => node.tagName === 'a')
    .map((node) => attribute(node, 'href'))
    .filter((href) => href?.includes('company.html'));
  assert.equal(links.length, 2);
  for (const base of [
    'http://localhost:8768/',
    'https://owner.github.io/revealline/',
    'https://owner.github.io/revealline/releases/v0.142.3/site/',
    'file:///downloaded-game/',
  ]) {
    for (const link of links) {
      const destination = new URL(link, `${base}game/community/index.html`);
      assert.equal(destination.href, `${base}game/${link.slice(3)}`);
      assert.ok(['droneaid', 'coupa-all'].includes(destination.searchParams.get('edition')));
      assert.equal(destination.searchParams.size, 1);
      assert.equal(destination.hash, '');
    }
  }
});

test('the separate community store retains its service configuration and existing account/catalog host', async () => {
  const source = await fs.readFile(new URL('../community/store.html', import.meta.url), 'utf8'),
    nodes = descendants(parse(source));
  assert.equal(
    attribute(
      nodes.find((node) => node.tagName === 'html'),
      'data-community-api',
    ),
    '/',
  );
  assert.ok(
    nodes.some((node) => node.tagName === 'script' && attribute(node, 'src') === './page.mjs'),
  );
  for (const id of ['catalog', 'search', 'account-signed-out', 'account-signed-in', 'publish'])
    assert.ok(
      nodes.some((node) => attribute(node, 'id') === id),
      `Preserve store control ${id}.`,
    );
});

test('static directory resources and preserved store entry are covered by the source distribution', async () => {
  const config = JSON.parse(await fs.readFile(new URL('../build-config.json', import.meta.url)));
  assert.ok(config.include.includes('game'));
  for (const entry of ['index.html', 'store.html']) {
    const page = new URL(`../community/${entry}`, import.meta.url);
    const nodes = descendants(parse(await fs.readFile(page, 'utf8')));
    for (const node of nodes) {
      const reference = ['script', 'img'].includes(node.tagName)
        ? attribute(node, 'src')
        : node.tagName === 'link'
          ? attribute(node, 'href')
          : null;
      if (!reference) continue;
      const target = new URL(reference, page);
      assert.equal(target.protocol, 'file:', `${entry}: all presentation resources are local.`);
      assert.ok(target.href.startsWith(new URL('../', import.meta.url).href));
      assert.ok((await fs.stat(target)).isFile(), `${entry}: ${reference}`);
    }
  }
});

test('Pages aliases retain both entry routes and preserve frozen directory/store bytes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'community-current-entry-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = new Map([
    ['index.html', Buffer.from('<!doctype html><title>Fixture</title>')],
    ['game/community/index.html', await fs.readFile(directoryURL)],
    [
      'game/community/store.html',
      await fs.readFile(new URL('../community/store.html', import.meta.url)),
    ],
  ]);
  for (const [name, value] of files) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  const manifest = Buffer.from(
    JSON.stringify({
      version: 'v0.142.3',
      sourceRevision: 'a'.repeat(40),
      totalBytes: [...files.values()].reduce((sum, value) => sum + value.length, 0),
      files: [...files].map(([name, value]) => ({
        path: name,
        bytes: value.length,
        sha256: digest(value),
      })),
    }),
  );
  await fs.writeFile(path.join(root, 'manifest.json'), manifest);
  const plan = await planCurrentEntries({
    source: root,
    repository: 'owner/revealline',
    record: {
      version: 'v0.142.3',
      sourceRevision: 'a'.repeat(40),
      manifestSha256: digest(manifest),
    },
  });
  const publicBase = 'https://owner.github.io/revealline/';
  for (const name of ['game/community/index.html', 'game/community/store.html']) {
    const page = plan.files.get(name);
    assert.ok(page);
    let destination;
    const link = {};
    vm.runInNewContext(page.match(/<script>([\s\S]*?)<\/script>/)[1], {
      URL,
      location: {
        href: publicBase + name + '?lang=uk#details',
        search: '?lang=uk',
        hash: '#details',
        replace: (value) => {
          destination = value;
        },
      },
      document: { querySelector: () => link },
    });
    assert.equal(destination, `${publicBase}releases/v0.142.3/site/${name}?lang=uk#details`);
    assert.equal(link.href, destination);
    assert.deepEqual(await fs.readFile(path.join(root, name)), files.get(name));
  }
  assert.ok(plan.metadata.navigationRoutes.some(({ from }) => from === 'game/community/'));
  assert.ok(
    plan.metadata.navigationRoutes.some(({ from }) => from === 'game/community/store.html'),
  );
});
