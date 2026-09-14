import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { readBuildConfig, collectBuildFiles, buildProject } from '../../scripts/game-cli.mjs';
import { planCurrentEntries } from '../../scripts/pages-current-entry.mjs';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fieldKitFiles = [
  'game/ui/field-kit-fonts.css',
  'game/ui/field-kit-tokens.css',
  'game/ui/field-kit-components.css',
  'game/ui/fonts/field-kit/handjet-display-600.woff2',
  'game/ui/fonts/field-kit/exo2-ui-400-600.woff2',
  'game/ui/fonts/field-kit/ibm-plex-mono-500.woff2',
  'game/ui/fonts/field-kit/Handjet-OFL.txt',
  'game/ui/fonts/field-kit/Exo2-OFL.txt',
  'game/ui/fonts/field-kit/IBMPlexMono-OFL.txt',
  'game/ui/fonts/field-kit/provenance.json',
];
const workshopEntries = [
  'authoring/still-media/index.html',
  'authoring/still-media/launch.js',
  'authoring/still-media/workshop.mjs',
];
const posterEntries = [
  'authoring/video-poster/index.html',
  'authoring/video-poster/launch.js',
  'authoring/video-poster/workshop.mjs',
  'authoring/video-poster/workshop.css',
];
const teachingScenarios = [
  'tactical-read-clearing',
  'tactical-borrowed-seconds',
  'tactical-quiet-crossing',
].map((id) => `authoring/library/tactical-teaching/scenarios/${id}.json`);
const dawnEntries = [
  'Dawn-Signal-originals.rlmedia',
  'Dawn-Signal-stories.rlstory',
  'manifest.json',
].map((name) => `authoring/still-media/examples/dawn-signal/${name}`);
const publicationEntries = [
  ...workshopEntries,
  ...posterEntries,
  ...teachingScenarios,
  ...dawnEntries,
];
const storyRuntime = [
  'game/victory-story.mjs',
  'game/story-storage-record.mjs',
  'game/story-media-store.mjs',
  'game/story-bundle.mjs',
  'game/story-bindings.mjs',
  'game/flight-media-pins.mjs',
  'game/story-receipts.mjs',
  'game/ui/still-story-panel.mjs',
  'game/ui/story-dialog.mjs',
  'game/ui/story-dialog.css',
  'game/ui/victory-story.mjs',
];
const requiredRuntime = [
  ...fieldKitFiles,
  'game/ui/still-media-host.mjs',
  'game/ui/still-media-panel.mjs',
  'game/ui/still-media-panel.css',
  'game/ui/still-media-catalog.mjs',
  'game/ui/still-media-preview.mjs',
  'game/media-bundle.mjs',
  'game/media-store.mjs',
  'game/managed-media-store.mjs',
  'game/content/campaign.json',
  'game/content/classes.json',
  'game/content/themes.json',
  'authoring/motion-lab/presets.json',
];

test('actual release allowlist ships the standalone still entry and exact existing runtime/content dependencies', async () => {
  const config = await readBuildConfig(sourceRoot),
    files = await collectBuildFiles(sourceRoot, config);
  for (const name of [
    ...publicationEntries,
    ...requiredRuntime,
    ...storyRuntime,
    'game/video-poster.mjs',
    'game/ui/video-poster-workshop.mjs',
  ])
    assert.ok(files.includes(name), `Missing workshop distribution dependency: ${name}`);
  assert.equal(config.include.filter((entry) => entry === 'authoring/still-media').length, 1);
  assert.equal(
    files.some((name) => name.startsWith('game/test/')),
    false,
  );
  assert.deepEqual(
    files.filter((name) => name.startsWith('authoring/library/')).sort(),
    [
      ...teachingScenarios,
      'authoring/library/fpv-role-presentations/originals/scout.png',
      'authoring/library/fpv-role-presentations/originals/bomber.png',
      'authoring/library/fpv-role-presentations/originals/carrier.png',
      'authoring/library/fpv-role-presentations/originals/interceptor.png',
      'authoring/library/fpv-role-presentations/originals/fiber.png',
      'authoring/library/fpv-role-presentations/originals/impact.png',
      'authoring/library/fpv-role-presentations/originals/trapper.png',
      ...[
        'bouncer',
        'border-patrol',
        'contour-patrol',
        'claimed-rover',
        'eroder',
        'lane-boss',
        'relay-sentinel',
      ].map((type) => `authoring/library/fpv-enemy-presentations/originals/${type}.png`),
      'authoring/library/ukraine-role-wide-variants/originals/scout-v3.png',
      'authoring/library/ukraine-role-presentations/originals/bomber.png',
      'authoring/library/ukraine-role-presentations/originals/carrier.png',
      'authoring/library/ukraine-role-wide-variants/originals/interceptor-v3.png',
      'authoring/library/ukraine-role-wide-variants/originals/fiber-v3.png',
      'authoring/library/ukraine-role-presentations/originals/impact.png',
      'authoring/library/ukraine-role-presentations/originals/trapper.png',
    ].sort(),
    'Only the three teaching documents, fourteen FPV/Ukraine player originals and seven enemy originals ship; other generated originals and proof tooling stay excluded.',
  );
  assert.deepEqual(
    files.filter((name) => name.startsWith('authoring/video-poster/')).sort(),
    [...posterEntries].sort(),
  );
});

async function fixture(t) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'still-workshop-build-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source'),
    originals = new Map();
  const put = async (name, bytes) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), bytes);
  };
  const copy = async (name) => {
    if (originals.has(name)) return;
    const bytes = await fs.readFile(path.join(sourceRoot, name));
    originals.set(name, bytes);
    await put(name, bytes);
    if (!/\.m?js$/.test(name)) return;
    for (const match of bytes
      .toString()
      .matchAll(
        /(?:^|[;\r\n])\s*(?:import\b\s*(?:[^;"']*?\bfrom\s*)?|export\b[^;"']*?\bfrom\s*)["']([^"']+)["']/g,
      )) {
      assert.ok(
        match[1].startsWith('.'),
        `Workshop graph has an unexpected external import: ${match[1]}`,
      );
      await copy(path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1])));
    }
  };
  // Exact workshop modules and their transitive literal import graph. Include the
  // launcher's known dynamic workshop import explicitly. No game/app or earned
  // state is run; the unrelated game HTML below is a declared fixture entry.
  for (const name of [
    ...publicationEntries,
    ...storyRuntime,
    ...fieldKitFiles,
    'game/ui/still-media-panel.css',
    'game/offline.mjs',
    'game/offline/service-worker.template.js',
  ])
    await copy(name);
  await put(
    'game/index.html',
    '<!doctype html><html><head></head><body>Inert build fixture</body></html>',
  );
  await put(
    'game/build-config.json',
    JSON.stringify({
      version: '0.32.0',
      entry: 'game/index.html',
      include: [
        'game',
        'authoring/still-media',
        'authoring/motion-lab',
        ...posterEntries,
        ...teachingScenarios,
      ],
    }),
  );
  return { directory, root, originals };
}
function zipEntries(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(
      bytes.readUInt16LE(offset + 8),
      0,
      'Fixture verifies original uncompressed payload bytes.',
    );
    const length = bytes.readUInt32LE(offset + 18),
      nameLength = bytes.readUInt16LE(offset + 26),
      extra = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extra,
      name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    assert.equal(files.has(name), false);
    files.set(name, bytes.subarray(start, start + length));
    offset = start + length;
  }
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
  return files;
}

for (const version of ['0.32.0', 'v0.32.0'])
  test(`built workshop ${version} retains exact entry bytes in loose/ZIP/offline data and opens its generated channel`, async (t) => {
    const f = await fixture(t),
      out = path.join(f.directory, 'distribution');
    await buildProject({ root: f.root, out, version, sourceRevision: 'a'.repeat(40) });
    const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8')),
      offline = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json'), 'utf8')),
      zip = zipEntries(await fs.readFile(path.join(out, 'distribution.zip')));
    for (const name of [
      ...publicationEntries,
      ...storyRuntime,
      'game/video-poster.mjs',
      'game/ui/video-poster-workshop.mjs',
      ...fieldKitFiles,
      'game/ui/still-media-host.mjs',
      'game/ui/still-media-panel.css',
      'game/media-bundle.mjs',
      'game/build-info.json',
    ]) {
      const bytes = await fs.readFile(path.join(out, name));
      if (f.originals.has(name)) assert.deepEqual(bytes, f.originals.get(name));
      for (const list of [manifest.files, offline.files]) {
        const entry = list.find((row) => row.path === name);
        assert.ok(entry, `${name} missing from inventory`);
        assert.equal(entry.sha256, digest(bytes));
        assert.equal(entry.bytes, bytes.length);
      }
      assert.deepEqual(zip.get(name), bytes);
    }
    assert.equal(offline.version, version);
    const { readStillWorkshopChannel } = await import(
      pathToFileURL(path.join(out, 'game/ui/still-media-host.mjs')).href
    );
    let calls = 0;
    assert.equal(
      await readStillWorkshopChannel({
        fetchImpl: async (url) => {
          ++calls;
          assert.equal(url.href, pathToFileURL(path.join(out, 'game/build-info.json')).href);
          return new Response(await fs.readFile(fileURLToPath(url)), { status: 200 });
        },
      }),
      `release-${version}`,
    );
    assert.equal(
      calls,
      1,
      'Build metadata is read once, without opening storage or starting the game.',
    );
  });

test('Pages automatically gives the shipped workshop an immutable same-edition HTML route, preserving query and fragment', async (t) => {
  const f = await fixture(t),
    out = path.join(f.directory, 'frozen-site'),
    version = 'v0.32.0';
  await buildProject({ root: f.root, out, version, sourceRevision: 'b'.repeat(40) });
  const manifest = await fs.readFile(path.join(out, 'manifest.json'));
  const plan = await planCurrentEntries({
    source: out,
    repository: 'owner/game',
    record: { version, sourceRevision: 'b'.repeat(40), manifestSha256: digest(manifest) },
  });
  for (const name of ['authoring/still-media/index.html', 'authoring/video-poster/index.html']) {
    const directory = path.posix.dirname(name),
      entry = plan.metadata.htmlEntries.find((row) => row.path === name);
    assert.ok(entry);
    assert.equal(entry.target, `https://owner.github.io/game/releases/${version}/site/${name}`);
    for (const prefix of ['https://owner.github.io/game/', 'http://localhost:8888/preview/']) {
      for (const suffix of [directory, `${directory}/`, name]) {
        const current = new URL(`${prefix}${suffix}?restore=1#originals`),
          link = {};
        let destination;
        vm.runInNewContext(plan.files.get(name).match(/<script>([\s\S]*?)<\/script>/)[1], {
          URL,
          location: {
            href: current.href,
            search: current.search,
            hash: current.hash,
            replace: (url) => (destination = url),
          },
          document: { querySelector: () => link },
        });
        assert.equal(destination, `${prefix}releases/${version}/site/${name}?restore=1#originals`);
        const moduleURL = new URL('../../game/ui/still-media-host.mjs', destination);
        assert.equal(
          new URL('../build-info.json', moduleURL).href,
          `${prefix}releases/${version}/site/game/build-info.json`,
        );
        assert.equal(
          new URL('../../game/', destination).href,
          `${prefix}releases/${version}/site/game/`,
        );
      }
    }
    assert.ok(
      plan.metadata.navigationRoutes.some(
        (row) => row.from === `${directory}/` && row.to === `${directory}/`,
      ),
    );
    assert.deepEqual(
      await fs.readFile(path.join(out, name)),
      f.originals.get(name),
      'Alias planning does not rewrite the frozen workshop.',
    );
  }
});

test('built poster/still links and teaching requests retain their edition and work from a prepared cache without a network', async (t) => {
  const f = await fixture(t),
    out = path.join(f.directory, 'offline-site');
  await buildProject({ root: f.root, out, version: 'v0.32.0', sourceRevision: 'c'.repeat(40) });
  const inventory = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json'), 'utf8'));
  assert.ok(inventory.files.reduce((sum, file) => sum + file.bytes, 0) <= 64 * 1024 * 1024);
  const bodies = new Map(
    await Promise.all(
      inventory.files.map(async ({ path: name }) => [
        name,
        await fs.readFile(path.join(out, name)),
      ]),
    ),
  );
  const worker = await fs.readFile(path.join(out, 'service-worker.js'), 'utf8');
  const gameHTML = await fs.readFile(path.join(sourceRoot, 'game/index.html'), 'utf8');
  const creatorLink = gameHTML.match(/href="([^"]+)"[^>]*>\s*Video poster workshop\s*<\/a>/)?.[1];
  assert.ok(creatorLink, 'A native Creator tools link opens the poster workshop.');
  const posterHTML = bodies.get('authoring/video-poster/index.html').toString();
  const stillLink = posterHTML.match(/id="video-poster-still" href="([^"]+)"/)?.[1];
  assert.ok(stillLink);
  const stillHTML = bodies.get('authoring/still-media/index.html').toString();
  const dawnLinks = [
    ...stillHTML.matchAll(/href="(\.\/examples\/dawn-signal\/[^\"]+)" download/g),
  ].map((match) => match[1]);
  assert.equal(
    dawnLinks.length,
    3,
    'The native workshop offers both exact originals and their manifest.',
  );
  assert.ok(stillHTML.includes('Reload saved media and installed maps'));
  const dawnManifest = JSON.parse(bodies.get(dawnEntries[2]).toString());
  assert.equal(dawnManifest.producer, 'CLI; not a native browser export');
  for (const item of dawnManifest.files) {
    const body = bodies.get(`authoring/still-media/examples/dawn-signal/${item.name}`);
    assert.equal(body.length, item.bytes);
    assert.equal(digest(body), item.sha256);
  }
  const playground = await fs.readFile(
    path.join(sourceRoot, 'game/playground/playground.mjs'),
    'utf8',
  );
  assert.ok(playground.includes('../../authoring/library/tactical-teaching/scenarios/${id}.json'));
  for (const scope of [
    'https://owner.github.io/game/releases/v0.32.0/site/',
    'http://localhost:8888/preview/releases/v0.32.0/site/',
    'http://localhost:8888/',
  ]) {
    const handlers = {},
      storage = new Map();
    let online = true,
      networkCalls = 0;
    const caches = {
      async keys() {
        return [...storage.keys()];
      },
      async delete(key) {
        return storage.delete(key);
      },
      async open(key) {
        if (!storage.has(key)) storage.set(key, new Map());
        const entries = storage.get(key);
        return {
          async match(url) {
            return entries.get(typeof url === 'string' ? url : url.url)?.clone();
          },
          async put(url, response) {
            entries.set(
              typeof url === 'string' ? url : url.url,
              new Response(await response.arrayBuffer(), {
                status: response.status,
                headers: response.headers,
              }),
            );
          },
        };
      },
    };
    vm.runInNewContext(worker, {
      self: {
        registration: { scope },
        addEventListener: (name, callback) => (handlers[name] = callback),
      },
      caches,
      crypto: webcrypto,
      URL,
      Request,
      Response,
      Headers,
      Uint8Array,
      fetch: async (request) => {
        networkCalls++;
        assert.equal(online, true, 'No network is available after Prepare finishes.');
        const url = new URL(request.url),
          base = new URL(scope);
        assert.equal(url.origin, base.origin);
        assert.ok(url.pathname.startsWith(base.pathname));
        const bytes = bodies.get(decodeURI(url.pathname.slice(base.pathname.length)));
        assert.ok(bytes, 'Prepare requests only inventoried original bytes.');
        return new Response(bytes);
      },
    });
    let install;
    handlers.install({ waitUntil: (job) => (install = job) });
    await install;
    online = false;
    const preparedCalls = networkCalls;
    const game = new URL('game/', scope),
      poster = new URL(creatorLink, game),
      still = new URL(stillLink, poster);
    assert.equal(poster.href, `${scope}authoring/video-poster/`);
    assert.equal(still.href, `${scope}authoring/still-media/`);
    const requests = [
      [new URL('?capture=1#poster', poster), 'authoring/video-poster/index.html'],
      [new URL('?restore=1#originals', still), 'authoring/still-media/index.html'],
      ...publicationEntries.map((name) => [new URL(name, scope), name]),
      ...storyRuntime.map((name) => [new URL(name, scope), name]),
      ...dawnLinks.map((link) => {
        const url = new URL(link, still);
        assert.ok(url.href.startsWith(`${scope}authoring/still-media/examples/dawn-signal/`));
        return [
          url,
          `authoring/still-media/examples/dawn-signal/${url.pathname.split('/').at(-1)}`,
        ];
      }),
      ...[
        'game/video-poster.mjs',
        'game/ui/video-poster-workshop.mjs',
        'game/build-info.json',
        ...fieldKitFiles,
      ].map((name) => [new URL(name, scope), name]),
      ...teachingScenarios.map((name) => [
        new URL(`../../${name}`, new URL('game/playground/', scope)),
        name,
      ]),
    ];
    for (const [url, name] of requests) {
      let reply;
      handlers.fetch({
        request: { url: url.href, method: 'GET' },
        respondWith: (job) => (reply = job),
      });
      assert.ok(reply, `${name} must be handled under its exact distribution prefix.`);
      const response = await reply;
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bodies.get(name));
    }
    assert.equal(networkCalls, preparedCalls);
  }
});
