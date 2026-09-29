import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { planCurrentEntries, writeCurrentEntries } from './pages-current-entry.mjs';
import { publishedReleaseIndex } from './build-pages.mjs';

const repository = 'owner/game',
  scope = 'https://owner.github.io/game/',
  canonical = scope + 'releases/v0.29.1/site/',
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-current-'));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  const assets = {
    'index.html': '<script src="./site/launch.mjs"></script>',
    'site/about.html': '<a href="../game/?pack=old">Play</a>',
    'game/index.html': '<script type="module" src="./app.mjs"></script>',
    'game/playground/index.html': '<a href="../?practice=1">Practice</a>',
    'authoring/enemy-catalog/index.html': '<a href="../../game/">Try</a>',
    'credits.html': '<a href="./">Home</a>',
    'game/app.mjs': 'export const frozen = true;',
    'service-worker.js': '/* original scoped worker */',
  };
  for (const [relative, bytes] of Object.entries(assets)) {
    await fs.mkdir(path.dirname(path.join(source, relative)), { recursive: true });
    await fs.writeFile(path.join(source, relative), bytes);
  }
  const manifest = JSON.stringify({
    version: 'v0.29.1',
    sourceRevision: 'a'.repeat(40),
    totalBytes: Object.values(assets).reduce((sum, value) => sum + Buffer.byteLength(value), 0),
    files: Object.entries(assets).map(([relative, value]) => ({
      path: relative,
      bytes: Buffer.byteLength(value),
      sha256: hash(value),
    })),
  });
  await fs.writeFile(path.join(source, 'manifest.json'), manifest);
  const record = {
    version: 'v0.29.1',
    sourceRevision: 'a'.repeat(40),
    manifestSha256: hash(manifest),
  };
  return { source, record, assets, plan: await planCurrentEntries({ source, repository, record }) };
}

function navigate(page, href) {
  const current = new URL(href);
  const link = {};
  let destination;
  vm.runInNewContext(page.match(/<script>([\s\S]*?)<\/script>/)[1], {
    URL,
    location: {
      href,
      search: current.search,
      hash: current.hash,
      replace: (url) => (destination = url),
    },
    document: { querySelector: () => link },
  });
  assert.equal(link.href, destination);
  return destination;
}

test('all current HTML aliases preserve queries/fragments with auditable source and output hashes', async (t) => {
  const { source, assets, plan } = await fixture(t);
  assert.equal(plan.metadata.canonicalSite, canonical);
  assert.equal(plan.metadata.htmlEntries.length, 6);
  assert.equal(plan.metadata.rootOverrides.length, 7);
  assert.equal(plan.metadata.frozenManifest.appliesTo, 'releases/v0.29.1/site/');
  for (const entry of plan.metadata.htmlEntries) {
    assert.equal(entry.target, canonical + entry.path);
    const page = plan.files.get(entry.path);
    assert.equal(
      navigate(page, scope + entry.path + '?pack=old&value=%3C%2Fscript%3E#saved%20cut'),
      entry.target + '?pack=old&value=%3C%2Fscript%3E#saved%20cut',
    );
    assert.ok(page.includes(`<a href="${entry.relativeTarget}">`));
    assert.ok(page.includes('>Play</a>'));
    assert.ok(page.includes('Opening Reveal / Line…'));
    assert.doesNotMatch(page, /<(?:script|link)\b[^>]*(?:src=|rel="stylesheet")/);
  }
  const destination = path.join(source, 'output');
  await writeCurrentEntries(plan, destination);
  for (const override of plan.metadata.rootOverrides) {
    const written = await fs.readFile(path.join(destination, override.path));
    assert.equal(written.length, override.bytes);
    assert.equal(hash(written), override.sha256);
    assert.equal(hash(assets[override.path]), override.sourceSha256);
    assert.equal(
      await fs.readFile(path.join(source, override.path), 'utf8'),
      assets[override.path],
    );
  }
  await assert.rejects(fs.access(path.join(destination, 'game/app.mjs')));
});

test('root retirement navigates only explicit HTML routes and never claims clients or touches saved/cache data', async (t) => {
  const { plan } = await fixture(t),
    handlers = {};
  let unregistered = 0;
  vm.runInNewContext(plan.files.get('service-worker.js'), {
    URL,
    Response,
    self: {
      location: { href: scope + 'service-worker.js' },
      registration: { scope, unregister: async () => ++unregistered },
      addEventListener: (type, handler) => (handlers[type] = handler),
      skipWaiting: () => assert.fail('must not activate over live games'),
      clients: { claim: () => assert.fail('must not take over clients') },
    },
    caches: new Proxy({}, { get: () => assert.fail('must preserve all caches') }),
    indexedDB: new Proxy({}, { get: () => assert.fail('must preserve all databases') }),
  });
  assert.deepEqual(Object.keys(handlers), ['activate', 'fetch']);
  assert.equal(unregistered, 0);
  for (const { from, to } of plan.metadata.navigationRoutes) {
    let response;
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: scope + from + '?practice=1#cut' },
      respondWith: (value) => (response = value),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), canonical + to + '?practice=1#cut');
  }
  for (const [url, method = 'GET', mode = 'navigate'] of [
    [canonical + 'game/'],
    [scope + 'releases/v0.28.0/site/game/'],
    [scope + 'releases/index.html'],
    [scope + 'releases/'],
    [scope + 'game/app.mjs'],
    [scope + 'missing/index.html'],
    [scope + 'game/index.html', 'POST'],
    [scope + 'game/index.html', 'GET', 'cors'],
    [scope + 'game/index.html', 'GET', 'no-cors'],
    ['https://outsider.invalid/game/game/'],
    ['https://owner.github.io/game-other/game/'],
    [scope + '//outsider.invalid/game/'],
    [scope + 'https://outsider.invalid/game/'],
    [scope + 'game%2findex.html'],
  ])
    handlers.fetch({
      request: { url, method, mode },
      respondWith: () => assert.fail(`unexpected interception: ${url}`),
    });
  let activation;
  handlers.activate({ waitUntil: (promise) => (activation = promise) });
  await activation;
  assert.equal(unregistered, 1);
});

test('retirement rejects a different registration scope without unregistering it', async (t) => {
  const { plan } = await fixture(t),
    handlers = {};
  vm.runInNewContext(plan.files.get('service-worker.js'), {
    URL,
    Response,
    self: {
      location: { href: scope + 'service-worker.js' },
      registration: { scope: canonical, unregister: () => assert.fail('wrong scope') },
      addEventListener: (type, handler) => (handlers[type] = handler),
    },
  });
  let activation;
  handlers.activate({ waitUntil: (promise) => (activation = promise) });
  await assert.rejects(activation, /scope mismatch/);
  handlers.fetch({
    request: { url: scope + 'game/', method: 'GET', mode: 'navigate' },
    respondWith: () => assert.fail('wrong scope intercepted'),
  });
});

test('identical alias and worker bytes route localhost and project prefixes without crossing origins', async (t) => {
  const { plan } = await fixture(t);
  for (const base of ['http://127.0.0.1:8886/', 'http://127.0.0.1:8886/preview/', scope]) {
    const immutable = base + 'releases/v0.29.1/site/';
    for (const entry of plan.metadata.htmlEntries) {
      const inputs = [entry.path];
      if (entry.path === 'index.html') inputs.push('');
      else if (entry.path.endsWith('/index.html'))
        inputs.push(
          entry.path.slice(0, -'index.html'.length),
          entry.path.slice(0, -'/index.html'.length),
        );
      for (const relative of inputs) {
        const target = navigate(
          plan.files.get(entry.path),
          base + relative + '?practice=1&revision=2#saved',
        );
        assert.equal(target, immutable + entry.path + '?practice=1&revision=2#saved');
      }
    }
    const handlers = {};
    vm.runInNewContext(plan.files.get('service-worker.js'), {
      URL,
      Response,
      self: {
        location: { href: base + 'service-worker.js' },
        registration: { scope: base, unregister: async () => true },
        addEventListener: (type, handler) => (handlers[type] = handler),
      },
    });
    for (const { from, to } of plan.metadata.navigationRoutes) {
      let response;
      handlers.fetch({
        request: { method: 'GET', mode: 'navigate', url: base + from + '?pack=old#cut' },
        respondWith: (value) => (response = value),
      });
      assert.equal(response.headers.get('Location'), immutable + to + '?pack=old#cut');
    }
    handlers.fetch({
      request: { method: 'GET', mode: 'navigate', url: immutable + 'game/' },
      respondWith: () => assert.fail('canonical runtime must not be redirected'),
    });
  }
});

test('actual launcher and runtime links stay versioned; release explorer uses the generated root catalog', async (t) => {
  const launch = await fs.readFile(new URL('../site/launch.mjs', import.meta.url), 'utf8'),
    link = {};
  let destination;
  for (const base of [canonical, 'http://127.0.0.1:8768/']) {
    vm.runInNewContext(launch, {
      URL,
      document: { currentScript: { src: base + 'site/launch.mjs' }, getElementById: () => link },
      location: {
        href: base + '?pack=fpv-arcade-r4&play=1#ready',
        replace: (url) => (destination = url),
      },
    });
    assert.equal(destination, base + 'game/?pack=fpv-arcade-r4&play=1#ready');
  }
  const { source: owned, record } = await fixture(t);
  const release = { ...record, play: `${record.version}/site/game/` };
  const catalog = publishedReleaseIndex([release], repository, record.version);
  const catalogDirectory = path.join(owned, 'pages', 'releases');
  await fs.mkdir(catalogDirectory, { recursive: true });
  await fs.writeFile(path.join(catalogDirectory, 'index.html'), catalog.html);
  await fs.writeFile(path.join(catalogDirectory, 'index.json'), JSON.stringify(catalog.json));
  const catalogURL = new URL('releases/', scope);
  assert.equal(new URL('../releases/', scope + 'game/index.html').href, catalogURL.href);
  assert.equal(catalog.json.releases[0].play, release.play);
  assert.ok(catalog.html.includes(`href="./${release.play}"`));
  assert.equal(new URL('./' + release.play, catalogURL).href, canonical + 'game/');
  let generatedCatalogLinks = 0;
  for (const relative of [
    'site/about.html',
    'game/index.html',
    'game/playground/index.html',
    'game/replay-theater/index.html',
    'authoring/enemy-catalog/index.html',
  ]) {
    const source = await fs.readFile(new URL('../' + relative, import.meta.url), 'utf8');
    let checked = 0;
    for (const [tag, reference] of source.matchAll(
      /<(?:a|link|script)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/g,
    )) {
      if (reference.startsWith('#') || /^[a-z]+:/i.test(reference)) continue;
      const target = new URL(reference.replaceAll('&amp;', '&'), canonical + relative);
      assert.equal(target.origin, new URL(canonical).origin);
      assert.ok(
        target.pathname.startsWith(new URL(canonical).pathname),
        `${relative}: ${reference}`,
      );
      const filename =
        decodeURIComponent(target.pathname.slice(new URL(canonical).pathname.length)) +
        (target.pathname.endsWith('/') ? 'index.html' : '');
      // This hidden native-only link is supplied by native staging, not Pages.
      if (tag.includes('id="native-diagnostics"')) {
        assert.match(tag, /\bhidden\b/);
        assert.equal(filename, 'diagnostics/index.html');
      } else if (filename === 'releases/index.html') {
        // The app resolves these public links at runtime because the Pages catalog is
        // generated beside versioned sites, not inside one. A clean source archive
        // correctly has no ignored local releases/index.html.
        assert.equal(relative, 'game/index.html');
        assert.equal(reference, '../releases/');
        assert.match(tag, /\bdata-release-explorer\b/);
        assert.doesNotMatch(tag, /\bdata-source-only\b/);
        assert.notEqual(target.href, catalogURL.href);
        assert.equal(
          await fs.readFile(
            path.join(catalogDirectory, filename.slice('releases/'.length)),
            'utf8',
          ),
          catalog.html,
        );
        generatedCatalogLinks++;
      } else if (!['privacy.html', 'credits.html'].includes(filename))
        // Public privacy/credits pages are generated by the unchanged distribution CLI.
        assert.ok(
          (await fs.stat(new URL('../' + filename, import.meta.url))).isFile(),
          `${relative}: ${filename}`,
        );
      checked++;
    }
    assert.ok(checked > 0, relative);
  }
  assert.equal(generatedCatalogLinks, 4);
});
