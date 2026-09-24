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
  // HTML-selected reading entry; copy() follows its exact runtime imports.
  'game/ui/tool-display-entry.mjs',
  'game/ui/workshop-return-entry.mjs',
  'game/ui/workshop-return.css',
  'game/ui/operation-status.css',
  'game/ui/operation-status.mjs',
  'game/ui/field-kit-fonts.css',
  'game/ui/field-kit-tokens.css',
  'game/ui/field-kit-components.css',
  'game/ui/field-kit-flow.css',
  'game/ui/field-kit-surfaces.css',
  'game/ui/field-kit-surfaces.mjs',
  'game/ui/field-kit-copy.mjs',
  'game/ui/field-kit-compiled.css',
  'game/presentation/page-entry.mjs',
  'game/presentation/compiled/assets/72b6c93f47090f3a3724223477e22cbc461132329768e70b82cdb87d85a72052.png',
  'game/presentation/compiled/assets/8fe3df81db48bf682862a06c8f7434365ff49151a2a72a94c0a85ea85a3adf27.png',
  'game/ui/fonts/field-kit/handjet-display-600.woff2',
  'game/ui/fonts/field-kit/exo2-ui-400-600.woff2',
  'game/ui/fonts/field-kit/ibm-plex-mono-500.woff2',
  'game/ui/fonts/field-kit/Handjet-OFL.txt',
  'game/ui/fonts/field-kit/Exo2-OFL.txt',
  'game/ui/fonts/field-kit/IBMPlexMono-OFL.txt',
  'game/ui/fonts/field-kit/provenance.json',
  'game/ui/fonts/Tiny5-Regular.ttf',
  'game/ui/fonts/OFL.txt',
  'game/ui/fonts/METADATA.pb',
  'game/ui/fonts/provenance.json',
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
    'game/video-editor.mjs',
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
      'authoring/library/fpv-field-kit/prepared/reveals/reveals.json',
      'authoring/library/fpv-field-kit/prepared/reveals/review.html',
      'authoring/library/fpv-field-kit/prepared/reveals/review.mjs',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-hunter-v1-e7445fff125f6827c5106853067d1ff099b16e30cfc0acdbb501dabe81f6a914.png',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-border-patrol-v1-537de86076d2fa4141f1c37b23774015da66431657a8ff2db3193d66e0c7ade1.png',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-contour-patrol-v1-9df94fb4dcfee56fffc16d15eda5d75ff2fc06a52a7754949ca5fc9e0607a20f.png',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-claimed-rover-v1-ddb9f5264822eceb35dcbfa80145c74a3e6d22a547d3171fdfa5095718e90106.png',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-eroder-v1-29502a902fadb1d6e1ddf8c4426e61fc5fff9613d3c8608ebfbd55848d5e3720.png',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-lane-boss-v1-e44630c2356c86db2611116dde6d12ea121d22aefef263932fabb719fc8e5dfd.png',
      'authoring/library/runtime-sprite-candidates-v1/export/fpv-compact-relay-sentinel-v1-9640e613855c6001aa5d2a23550237a6a3235a6637a8a248a7d7cdbc21d534db.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-swallow-v3-e01a6c53d78acf164d04878b73f06de18cfed676b894bd7353a708fd1005aaf7.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-pottery-courier-v1-86089f57441d33c4153d8da5246f5e5c3822c9304d8e7b9a761ae17e5a217ea2.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-carved-chest-v1-1e68e385ea2166b999e7b9041eabaf90d7b5b552a0034cdce576ddc123cbd91b.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-falcon-crest-v3-f3ce0fa984bb43f3a3fa69734c60df3dfa6c8a148f0b1d32778407b92c93a648.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-weaver-shuttle-v3-39c737ed85d1df0c61bb05fce6424d36ea93f452ca19c7542253f37442e914aa.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-bell-warden-v1-aaa88f04dccaa141ffb121acbb6e1b4eb9b89c0ace3e8ebddc172ba4294eabce.png',
      'authoring/library/runtime-sprite-candidates-v1/export/atlas-woven-basket-v1-3604eeef2dfbdf02c26f8ae8d86984cb453c52574bfd9dd87d28df015f9c50ac.png',
      'authoring/library/runtime-sprite-candidates-v1/export/manifest.json',
    ].sort(),
    'Only the explicit teaching/presentation resources, existing FPV player originals and fourteen fallback derivatives ship; other source originals and proof tooling stay excluded.',
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
      'game/video-editor.mjs',
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
      AbortController,
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
        'game/video-editor.mjs',
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
