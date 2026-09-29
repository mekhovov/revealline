import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import { planCurrentEntries } from '../../scripts/pages-current-entry.mjs';

const directoryURL = new URL('../communities/index.html', import.meta.url);
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
  assert.ok(links.includes('../'));
  for (const slug of ['coupa', 'droneaid', 'droneaid-community'])
    assert.ok(links.includes(`./${slug}/`));
});

test('directory exposes the main game and every public brand through relative clean routes', async () => {
  const { COMMUNITY_ROUTES } = await import('../community-routes.mjs');
  const catalog = JSON.parse(
    await fs.readFile(new URL('../editions/catalog.json', import.meta.url)),
  );
  const nodes = descendants(parse(await readDirectory()));
  const links = nodes
    .filter((node) => node.tagName === 'a' && attribute(node, 'class') === 'community-entry')
    .map((node) => attribute(node, 'href'));
  assert.deepEqual(
    links.slice().sort(),
    ['../', ...COMMUNITY_ROUTES.map(({ slug }) => `./${slug}/`)].sort(),
  );
  assert.deepEqual(
    COMMUNITY_ROUTES.map(({ brandId }) => brandId).sort(),
    catalog.brands
      .filter(({ publication }) => publication === 'public')
      .map(({ id }) => id)
      .sort(),
  );
  for (const base of [
    'http://localhost:8768/',
    'https://owner.github.io/revealline/',
    'https://owner.github.io/revealline/releases/v0.142.3/site/',
  ]) {
    for (const link of links) {
      const destination = new URL(link, `${base}game/communities/index.html`);
      assert.equal(
        destination.href,
        link === '../' ? `${base}game/` : `${base}game/communities/${link.slice(2)}`,
      );
      assert.equal(destination.search, '');
      assert.equal(destination.hash, '');
    }
  }
});

test('DroneAid collections share one community card without losing either entry point', async () => {
  const nodes = descendants(parse(await readDirectory()));
  const cards = nodes.filter((node) => node.tagName === 'article');
  const heading = (card) =>
    descendants(card)
      .filter((node) => node.tagName === 'h2')
      .flatMap(descendants)
      .map((node) => node.value ?? '')
      .join('')
      .trim();
  assert.deepEqual(cards.map(heading), ['FPV / LINE', 'DroneAid', 'Coupa']);
  const entries = (card) =>
    descendants(card)
      .filter((node) => node.tagName === 'a')
      .map((node) => attribute(node, 'href'));
  assert.deepEqual(entries(cards.find((card) => heading(card) === 'DroneAid')), [
    './droneaid/',
    './droneaid-community/',
  ]);
  assert.deepEqual(entries(cards.find((card) => heading(card) === 'Coupa')), ['./coupa/']);
});

test('old directory bookmarks preserve query and hash while forwarding to the plural path', async () => {
  const script = await fs.readFile(new URL('../community/redirect.mjs', import.meta.url), 'utf8');
  for (const base of [
    'http://localhost:8779/',
    'https://owner.github.io/revealline/releases/v0.142.3/site/',
  ]) {
    let destination;
    const link = {};
    vm.runInNewContext(script, {
      URL,
      location: {
        href: `${base}game/community/index.html?lang=uk#details`,
        search: '?lang=uk',
        hash: '#details',
        replace: (value) => {
          destination = value;
        },
      },
      document: { getElementById: () => link },
    });
    assert.equal(destination, `${base}game/communities/?lang=uk#details`);
    assert.equal(link.href, destination);
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

test('creator and moderator return links retain the separate service marketplace', async () => {
  for (const [entry, key, expected] of [
    ['../creator/index.html', 'interface:creator.communityCampaigns', '../community/store.html'],
    ['../community/moderation.html', 'interface:community.backToCommunity', './store.html'],
  ]) {
    const page = new URL(entry, import.meta.url);
    const nodes = descendants(parse(await fs.readFile(page, 'utf8')));
    const link = nodes.find((node) => node.tagName === 'a' && attribute(node, 'data-i18n') === key);
    assert.equal(attribute(link, 'href'), expected);
    assert.equal(
      new URL(expected, page).href,
      new URL('../community/store.html', import.meta.url).href,
    );
  }
});

test('static directory resources and preserved store entry are covered by the source distribution', async () => {
  const config = JSON.parse(await fs.readFile(new URL('../build-config.json', import.meta.url)));
  assert.ok(config.include.includes('game'));
  for (const entry of ['communities/index.html', 'community/index.html', 'community/store.html']) {
    const page = new URL(`../${entry}`, import.meta.url);
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
    ['game/communities/index.html', await fs.readFile(directoryURL)],
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
  for (const name of ['game/communities/index.html', 'game/community/store.html']) {
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
  assert.ok(plan.metadata.navigationRoutes.some(({ from }) => from === 'game/communities/'));
  assert.ok(
    plan.metadata.navigationRoutes.some(({ from }) => from === 'game/community/store.html'),
  );
});
