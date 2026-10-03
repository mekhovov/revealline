import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import {
  collectEditionEngineFiles,
  compileEdition,
  editionCodeDependencies,
} from './compile-edition.mjs';
import { EDITION_RUNTIME_ASSET_LEDGER } from './edition-runtime.mjs';
import {
  createCompanyWorkspaceFiles,
  companySourceDraft,
  companyDraftFiles,
  companyStudioReport,
} from './company-studio.mjs';
import { createEditionRuntimeCatalog } from '../game/editions/model.mjs';
import {
  withStudioAppearanceTheme,
  withStudioAppearanceDefault,
  declaredJSONPaths,
} from '../authoring/company-studio/model.mjs';
import { verifyStudioPreview } from '../authoring/company-studio/preview.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { duplicateStudioSnapshot } from '../game/presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../game/presentation/bundle.mjs';
import { exportRuntimeTheme, importRuntimeTheme } from '../game/presentation/runtime-transfer.mjs';
import { getThemeFamily } from '../game/presentation/theme-system.mjs';
import { Document } from '../game/test/helpers/couch-dom.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (bytes) => JSON.parse(Buffer.from(bytes).toString());
function htmlContext(bytes) {
  const tree = parse(Buffer.from(bytes).toString());
  const html = tree.childNodes.find((node) => node.tagName === 'html');
  return Object.fromEntries(
    html.attrs
      .filter(({ name }) => name.startsWith('data-'))
      .map(({ name, value }) => [
        name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
        value,
      ]),
  );
}
function memoryStorage() {
  const values = new Map(),
    writes = [];
  return {
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      writes.push(key);
    },
    removeItem: (key) => values.delete(key),
  };
}
const mime = (name) =>
  ({
    html: 'text/html',
    mjs: 'text/javascript',
    js: 'text/javascript',
    css: 'text/css',
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    mp3: 'audio/mpeg',
  })[name.split('.').at(-1)] ?? 'application/octet-stream';

/** Real compiler output and emitted runtime modules. The optional browser server
 * serves these same bounded maps; it never modifies access control or source files.
 * Cache-only reload below is a Node acceptance check, not physical browser/SW proof. */
export async function checkCuratedAppearancePackage({ port = 0, keepServing = false } = {}) {
  const family = getThemeFamily('dnipro-porcelain');
  const workspace = duplicateStudioSnapshot(createDefaultThemeBundle(), {
    id: 'river-acceptance',
    name: 'River acceptance',
    tokens: { panel: '#253144', amber: '#fac769' },
    appearanceBasis: {
      familyId: family.id,
      familyRevision: family.revision,
      interfaceId: family.interface.id,
      interfaceRevision: family.interface.revision,
    },
  });
  const native = await importThemeBundle(await exportThemeBundle(workspace), { decodeImage: null });
  const runtime = await importRuntimeTheme(await exportRuntimeTheme(native.document, new Map()));
  const candidate = runtime.candidate;
  assert.deepEqual(candidate.basis, workspace.appearanceBasis);
  const pin = { familyId: candidate.family.id, revision: candidate.family.revision };
  const north = createCompanyWorkspaceFiles({ brandId: 'north', name: 'North community' });
  const south = createCompanyWorkspaceFiles({ brandId: 'south', name: 'South community' });
  let catalog = createEditionRuntimeCatalog({
    brands: [...north.catalog.brands, ...south.catalog.brands],
    campaigns: [...north.catalog.campaigns, ...south.catalog.campaigns],
    editions: [...north.catalog.editions, ...south.catalog.editions],
    assets: [],
    defaultEditionId: north.catalog.defaultEditionId,
  });
  catalog = withStudioAppearanceTheme(catalog, candidate);
  for (const id of ['north', 'south'])
    catalog = withStudioAppearanceDefault(catalog, {
      scope: 'community',
      id,
      appearanceDefault: pin,
    });
  // Exercise both assignment scopes with one exact candidate; distinct-pin precedence
  // is covered by community-appearance and edition-appearance-host tests.
  catalog = withStudioAppearanceDefault(catalog, {
    scope: 'campaign',
    id: north.catalog.campaigns[0].id,
    appearanceDefault: pin,
  });
  const draft = companyDraftFiles(
    companySourceDraft({ catalog, files: new Map([...north.files, ...south.files]) }),
  );
  assert.deepEqual(draft.catalog, catalog);
  const engine = await collectEditionEngineFiles({ root });
  const originalSources = [...draft.files].map(([name, bytes]) => [name, hash(bytes)]);
  const packages = new Map(),
    report = {
      format: 'revealline-curated-appearance-acceptance.v1',
      basis: candidate.basis,
      pin,
      engineInputSha256: hash(
        Buffer.from(JSON.stringify([...engine].map(([name, bytes]) => [name, hash(bytes)]).sort())),
      ),
      scope:
        'Compiled bytes, real HTTP, emitted runtime and cache-only Node reload; DOM adapter for host assertions. Physical browser/offline installation requires separate evidence.',
      checks: [],
      communities: [],
    };
  let temporary;
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const [, context, ...rest] = url.pathname.split('/');
    const bytes = packages.get(context)?.files.get(rest.join('/'));
    response.writeHead(bytes ? 200 : 404, {
      'content-type': mime(rest.join('/')),
      'cache-control': 'no-store',
    });
    response.end(bytes ?? 'Not in the selected compiled package.');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    if (temporary) await rm(temporary, { recursive: true, force: true });
  };
  try {
    for (const context of ['north', 'south']) {
      const result = await compileEdition({
        catalog: draft.catalog,
        editionIds: [`${context}-public`],
        files: new Map([...engine, ...draft.files]),
        enginePaths: [...engine.keys()],
        version: '0.142.4',
        sourceRevision: report.engineInputSha256,
        offline: { basePath: '/' },
      });
      packages.set(context, result);
      const totalBytes = [...result.files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
      assert.ok(result.files.size <= 2000 && totalBytes <= 72 * 1024 * 1024);
      const previewURL = `/${context}/game/company.html`;
      const verified = await verifyStudioPreview({
        catalog: draft.catalog,
        editionId: `${context}-public`,
        files: new Map(
          declaredJSONPaths(draft.catalog).map((name) => [name, json(draft.files.get(name))]),
        ),
        report: companyStudioReport(draft.catalog, result, { previewURL }),
        baseURL: `${origin}/authoring/company-studio/`,
        runtimeAssets: json(engine.get(EDITION_RUNTIME_ASSET_LEDGER)),
        fetcher: fetch,
      });
      const dataset = htmlContext(result.files.get('game/company.html'));
      assert.equal(dataset.appearanceFamily, pin.familyId);
      assert.equal(dataset.appearanceRevision, pin.revision);
      assert.equal(JSON.parse(decodeURIComponent(dataset.appearanceSeed)).familyId, pin.familyId);
      const offline = json(result.files.get('offline-cache.json'));
      const cache = new Map();
      for (const row of offline.files) {
        const bytes = result.files.get(row.path);
        assert.equal(bytes.length, row.bytes);
        assert.equal(hash(bytes), row.sha256);
        cache.set(`${origin}/${context}/${row.path}`, bytes);
      }
      // Only emitted ESM bytes need a temporary filesystem to execute in Node.
      // Media and complete packages remain in memory, avoiding duplicate builds.
      temporary ??= await mkdtemp(path.join(tmpdir(), 'appearance-emitted-'));
      const directory = path.join(temporary, context),
        pending = [
          'game/company-entry.mjs',
          'game/runtime-content-provider.mjs',
          'game/presentation/theme-host.mjs',
        ],
        written = new Set();
      while (pending.length) {
        const name = pending.pop();
        if (written.has(name)) continue;
        const bytes = result.files.get(name);
        assert.ok(bytes, `Missing emitted ${name}`);
        written.add(name);
        await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
        await writeFile(path.join(directory, name), bytes);
        pending.push(
          ...editionCodeDependencies(name, bytes).filter((file) => /\.(?:mjs|js)$/.test(file)),
        );
      }
      const load = (name) => import(pathToFileURL(path.join(directory, name)).href);
      const { companyEntryHref } = await load('game/company-entry.mjs');
      const { loadRuntimeContentProvider } = await load('game/runtime-content-provider.mjs');
      const { installThemeHost } = await load('game/presentation/theme-host.mjs');
      const href = companyEntryHref(`${origin}${previewURL}`, dataset.editionId);
      assert.equal(new URL(href).pathname, `/${context}/game/index.html`);
      const documentRef = {
        documentElement: { dataset: htmlContext(result.files.get('game/index.html')) },
      };
      const online = await loadRuntimeContentProvider({
        locationRef: { href },
        documentRef,
        fetcher: fetch,
      });
      let offlineRequests = 0;
      const offlineProvider = await loadRuntimeContentProvider({
        locationRef: { href },
        documentRef,
        fetcher: async (url) => {
          const bytes = cache.get(String(url));
          assert.ok(bytes, `Offline request is outside verified cache: ${url}`);
          offlineRequests++;
          return new Response(bytes, { headers: { 'content-type': mime(String(url)) } });
        },
      });
      assert.ok(offlineRequests > 0);
      for (const provider of [online, offlineProvider]) {
        assert.deepEqual(provider.appearanceThemes, [candidate]);
        assert.deepEqual(provider.appearanceDefaultFor(), pin);
        assert.equal(provider.editionId, `${context}-public`);
        assert.throws(
          () => provider.href({ edition: context === 'north' ? 'south-public' : 'north-public' }),
          /another company/,
        );
      }
      assert.equal(online.authoredPresentationSha256, offlineProvider.authoredPresentationSha256);
      const document = new Document(),
        storage = memoryStorage();
      const host = installThemeHost({
        document,
        getStorage: () => storage,
        prepareStyles: async () => {},
        appearanceDefault: offlineProvider.appearanceDefault,
        appearanceThemes: offlineProvider.appearanceThemes,
      });
      await host.ready;
      assert.equal(host.snapshot().familyId, pin.familyId);
      assert.equal(storage.writes.length, 0);
      host.set({ familyId: 'tryzub' });
      await host.ready;
      assert.equal(host.snapshot().familyId, 'tryzub');
      host.setDefault({ familyId: pin.familyId, revision: 'r999' });
      await host.ready;
      assert.equal(
        host.snapshot().familyId,
        'tryzub',
        'Personal choice outranks unavailable context',
      );
      host.set({ familyId: 'follow-game' });
      await host.ready;
      assert.notEqual(host.snapshot().familyId, pin.familyId);
      assert.ok(host.getWarning());
      host.setDefault(pin);
      await host.ready;
      assert.equal(host.snapshot().familyId, pin.familyId);
      host.dispose();
      report.communities.push({
        context,
        route: `${origin}${previewURL}`,
        files: result.files.size,
        bytes: totalBytes,
        headroomBytes: 72 * 1024 * 1024 - totalBytes,
        verifiedFiles: verified.verifiedFiles,
        entrySha256: hash(result.files.get('game/company.html')),
        canonicalEntrySha256: hash(result.files.get('game/index.html')),
        catalogSha256: hash(result.files.get('edition-catalog.json')),
        emittedModules: written.size,
        offlineFiles: cache.size,
        offlineRequests,
        authoredPresentationSha256: online.authoredPresentationSha256,
      });
    }
    for (const [name, digest] of originalSources) assert.equal(hash(draft.files.get(name)), digest);
    report.checks.push(
      'saved basis/native/runtime/source-draft round trips',
      'one immutable candidate in two unrelated communities',
      'real compiler report and every artifact hash',
      'compiled entry redirect and emitted runtime provider over HTTP',
      'verified cache-only reload with no network fallback',
      'community boundary and authored presentation identity',
      'personal choice precedence and unavailable exact revision recovery (DOM adapter)',
      'source content byte preservation',
    );
    if (!keepServing) await close();
    return { report, close, packages };
  } catch (error) {
    await close();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    serve = args.indexOf('--serve'),
    receipt = args.indexOf('--receipt');
  const port = serve < 0 ? 0 : Number(args[serve + 1]);
  if (serve >= 0 && (!Number.isInteger(port) || port < 1024 || port > 65535))
    throw new Error('--serve requires a port from 1024 to 65535.');
  const result = await checkCuratedAppearancePackage({ port, keepServing: serve >= 0 });
  const output = JSON.stringify(result.report, null, 2) + '\n';
  if (receipt >= 0) await writeFile(args[receipt + 1], output);
  process.stdout.write(output);
  if (serve >= 0)
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => void result.close());
}
