/* global window, document, navigator, caches, localStorage, sessionStorage, location, crypto */
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CURRENT_ART_SOURCES } from '../game/presentation/current-art-sources.mjs';
import { buildSentinelTheme } from '../authoring/library/sentinel-theme-chapters/build.mjs';
import { applyPublicationProfile, PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { startProductionPreview } from './serve-production-preview.mjs';
import {
  parseArtQualificationOptions,
  writeNewArtQualificationReport,
  artworkOmissionPaths,
} from './qualify-authoring-art-fallback-browser.mjs';
import {
  diagnoseQualificationFailure,
  finishQualification,
} from './shared-demo-browser-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function qualifyOfflineArtFallback(options) {
  try {
    await lstat(options.report);
    throw new Error('Refusing to overwrite existing evidence.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert((await lstat(path.dirname(options.report))).isDirectory());
  for (const file of [options.runtime, options.executable]) assert((await lstat(file)).isFile());
  const paths = [
    'scripts/qualify-offline-art-fallback-browser.mjs',
    'scripts/game-cli.mjs',
    'scripts/main-pages-source-originals.mjs',
    'game/offline/service-worker.template.js',
    'game/presentation/current-art.mjs',
    'game/presentation/current-art-sources.mjs',
    'authoring/production/preview.mjs',
    'game/official-downloads.mjs',
  ];
  const hashes = async () =>
    Object.fromEntries(
      await Promise.all(
        paths.map(async (name) => [name, sha(await readFile(path.join(root, name)))]),
      ),
    );
  const report = {
    format: 'revealline-offline-art-fallback-browser.v1',
    started: new Date().toISOString(),
    scope:
      'Real Chromium service worker and context.setOffline. Two real artwork descriptors, selector-approved omissions and verified official workshop download bodies on a task-owned production-CSP fixture server. This is a bounded representative cache/reader integration, not the complete generated distribution or full tool navigation.',
    sourceBefore: await hashes(),
    checks: [],
    errors: [],
    limits: [
      'Embedded and external representatives only; other approved omissions are covered by native exact-byte proofs.',
      'The fixture worker uses the actual generated template and a small selected download inventory; no full site install is claimed.',
      'Cache bodies/metadata and player storage are compared exactly before and after reads; VM regressions separately assert no worker cache.put calls.',
    ],
  };
  let browser, page, preview;
  const deadline = setTimeout(() => {
    report.complete = false;
    report.failure ??= 'Offline artwork qualification exceeded 120 seconds.';
    void browser?.close().catch(() => {});
  }, 120000);
  try {
    const proofPath = 'docs/qualification/shared-demos/current-art-fallback-proof-final.json';
    const proofBytes = await readFile(path.join(root, proofPath));
    const admitted = artworkOmissionPaths(JSON.parse(proofBytes));
    report.omissionProof = { path: proofPath, sha256: sha(proofBytes) };
    const sources = [
      CURRENT_ART_SOURCES.find(
        (row) => row.kind === 'embedded' && admitted.has(row.sourceImagePath),
      ),
      CURRENT_ART_SOURCES.find(
        (row) => row.kind === 'external' && row.source.descriptorId === 'sentinel-circuit-ukraine',
      ),
    ];
    assert(sources.every((source) => source && admitted.has(source.sourceImagePath)));
    const payloads = new Map(),
      filePins = new Map();
    const external = await buildSentinelTheme('ukraine');
    for (const source of sources) {
      const original = await readFile(path.join(root, source.sourceImagePath));
      assert.equal(sha(original), source.image.sha256);
      assert.equal(original.length, source.image.bytes);
      payloads.set(source.sourceImagePath, original);
      filePins.set(source.sourceImagePath, {
        path: source.sourceImagePath,
        ...source.image,
        kind: 'gameplay',
      });
      for (const pin of source.kind === 'external'
        ? [source.source.pack, source.source.media]
        : [source.source]) {
        const bytes =
          source.kind === 'external'
            ? Buffer.from(
                await external.payloads[
                  pin.path.endsWith('pack.json') ? 'pack' : 'media'
                ].arrayBuffer(),
              )
            : await readFile(path.join(root, pin.path));
        assert.equal(sha(bytes), pin.sha256);
        assert.equal(bytes.length, pin.bytes);
        payloads.set(pin.path, bytes);
        filePins.set(pin.path, { ...pin, kind: 'gameplay' });
      }
    }
    const entries = [...payloads].map(([name, bytes]) => ({ name, bytes }));
    entries.push(
      {
        name: 'game/presentation/current-art-sources.mjs',
        bytes: await readFile(path.join(root, 'game/presentation/current-art-sources.mjs')),
      },
      { name: 'fixture/archive.bin', bytes: Buffer.from('archive') },
    );
    const catalogue = {
      files: [
        ...filePins.values(),
        { path: 'fixture/archive.bin', bytes: 7, sha256: sha('archive'), kind: 'gameplay' },
      ],
      groups: [
        {
          id: 'tooling:workshop',
          kind: 'gameplay',
          category: 'tooling',
          requires: [],
          files: sources.map((row) => row.sourceImagePath),
        },
        {
          id: 'chapter:current',
          kind: 'gameplay',
          category: 'chapter',
          requires: [],
          files: [...filePins.keys()].filter(
            (name) => !sources.some((row) => row.sourceImagePath === name),
          ),
        },
        {
          id: 'archive:fixture',
          kind: 'gameplay',
          category: 'archive',
          requires: [],
          files: ['fixture/archive.bin'],
        },
      ],
      missions: [],
    };
    let omittedSourceOriginals;
    applyPublicationProfile(entries, catalogue, 'main-pages', null, {
      onOmittedSourceOriginals: (paths) => {
        omittedSourceOriginals = paths;
      },
    });
    assert.deepEqual(omittedSourceOriginals, sources.map((row) => row.sourceImagePath).sort());
    const retained = catalogue.files.filter((file) =>
      catalogue.groups.find((group) => group.id === 'tooling:workshop').files.includes(file.path),
    );
    assert.equal(retained.length, 3);
    const config = {
      format: 'revealline-offline.v1',
      version: 'offline-art-fixture',
      buildId: sha(JSON.stringify(catalogue)),
      files: [],
      packageConsent: true,
      downloadFiles: retained,
      omittedSourceOriginals,
    };
    const worker = (
      await readFile(path.join(root, 'game/offline/service-worker.template.js'), 'utf8')
    ).replace('__XONIX_OFFLINE_CONFIG__', JSON.stringify(config));
    report.worker = {
      templateSHA256: report.sourceBefore['game/offline/service-worker.template.js'],
      emittedSHA256: sha(worker),
      config,
      retainedPins: retained,
    };
    const requests = [];
    preview = await startProductionPreview({
      root,
      port: 0,
      fixtureAccess: true,
      cache: 'no-store',
    });
    const native = preview.server.listeners('request')[0];
    preview.server.removeListener('request', native);
    preview.server.on('request', (req, res) => {
      const relative = new URL(req.url, preview.url).pathname.slice(1);
      if (requests.length < 1024) requests.push(relative);
      else report.requestOverflow = true;
      const send = (status, body, mime) => {
        res.writeHead(status, {
          ...PUBLIC_SECURITY_HEADERS,
          'Content-Type': mime,
          'Cache-Control': 'no-store',
        });
        res.end(body);
      };
      if (relative === 'offline-art-fixture.html')
        return send(
          200,
          '<!doctype html><title>Offline artwork qualification</title><main id="pictures"></main>',
          'text/html',
        );
      if (relative === 'service-worker.js') return send(200, worker, 'text/javascript');
      if (omittedSourceOriginals.includes(relative))
        return send(404, 'Approved omission', 'text/plain');
      if (payloads.has(relative))
        return send(
          200,
          payloads.get(relative),
          relative.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        );
      return native(req, res);
    });
    const runtime = await import(pathToFileURL(options.runtime).href);
    browser = await runtime.chromium.launch({
      executablePath: options.executable,
      headless: true,
      args: [
        '--disable-gpu-shader-disk-cache',
        '--disk-cache-size=1048576',
        '--media-cache-size=1048576',
      ],
    });
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => {
      if (report.errors.length < 32)
        report.errors.push({ name: error.name, message: error.message, stack: error.stack });
      else report.errorOverflow = true;
    });
    await page.goto(preview.url + 'offline-art-fixture.html');
    await page.evaluate(
      async ({ sources, retained }) => {
        const current = await import('/game/presentation/current-art.mjs');
        const production = await import('/authoring/production/preview.mjs');
        const downloads = await import('/game/official-downloads.mjs');
        const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller)
          await new Promise((resolve) =>
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
          );
        const store = downloads.createOfficialDownloads();
        await store.download({
          edition: 'offline-art-fixture',
          group: 'tooling:workshop',
          files: retained,
          baseURL: location.origin + '/',
        });
        const check = await store.inspect(retained, { verify: true });
        if (!check.ready) throw new Error('Verified artwork download was not ready.');
        window.offlineArt = { current, production, sources, retained, reg };
        window.snapshotOfflineArt = async () => {
          const hash = async (buffer) =>
            [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
              .map((byte) => byte.toString(16).padStart(2, '0'))
              .join('');
          const cacheBodies = [];
          for (const name of (await caches.keys()).sort()) {
            const cache = await caches.open(name);
            for (const request of (await cache.keys()).sort((a, b) => a.url.localeCompare(b.url))) {
              const response = await cache.match(request),
                bytes = await response.arrayBuffer();
              cacheBodies.push({
                cache: name,
                url: request.url,
                bytes: bytes.byteLength,
                sha256: await hash(bytes),
                status: response.status,
              });
            }
          }
          return {
            caches: cacheBodies,
            local: { ...localStorage },
            session: { ...sessionStorage },
          };
        };
      },
      { sources, retained },
    );
    const baseline = await page.evaluate(() => window.snapshotOfflineArt());
    report.checks.push({
      name: 'verified selected workshop download installed and worker controlling',
      controller: await page.evaluate(() => navigator.serviceWorker.controller.scriptURL),
      files: retained.length,
    });
    for (const offline of [false, true]) {
      await context.setOffline(offline);
      const start = requests.length;
      const result = await page.evaluate(async () => {
        const { current, production, sources } = window.offlineArt,
          checks = [];
        const hash = async (bytes) =>
          [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        for (const source of sources) {
          const response = await fetch(source.sourceImagePath, { cache: 'no-store' });
          if (response.status !== 404) throw new Error('Omitted original did not return local404.');
          const native = await current.readCurrentArtImage(source.id, {
            baseURL: location.origin + '/',
          });
          const nativeHash = await hash(native.bytes);
          if (nativeHash !== source.image.sha256 || native.bytes.length !== source.image.bytes)
            throw new Error('Current Art bytes differ.');
          const owned = new Map();
          const rendered = await production.loadProductionImage(
            {
              role: 'original',
              file: {
                path: source.sourceImagePath,
                bytes: source.image.bytes,
                sha256: source.image.sha256,
              },
              width: source.image.width,
              height: source.image.height,
            },
            {
              rootURL: location.origin + '/',
              urlAPI: {
                createObjectURL(blob) {
                  const url = URL.createObjectURL(blob);
                  owned.set(url, blob);
                  return url;
                },
                revokeObjectURL(url) {
                  owned.delete(url);
                  URL.revokeObjectURL(url);
                },
              },
            },
          );
          document.querySelector('#pictures').append(rendered.image);
          const displayedURL = rendered.image.src,
            displayedHash = await hash(await owned.get(displayedURL).arrayBuffer());
          if (
            displayedHash !== source.image.sha256 ||
            rendered.image.naturalWidth !== source.image.width ||
            rendered.image.naturalHeight !== source.image.height
          )
            throw new Error('Displayed Production original differs.');
          rendered.image.remove();
          rendered.dispose();
          if (owned.size) throw new Error('Preview URLs remain owned.');
          checks.push({
            id: source.id,
            kind: source.kind,
            sourcePath: source.sourceImagePath,
            bytes: native.bytes.length,
            sha256: nativeHash,
            displayedSHA256: displayedHash,
            width: source.image.width,
            height: source.image.height,
            remainingOwnedURLs: owned.size,
          });
        }
        return checks;
      });
      assert.deepEqual(
        requests.slice(start),
        [],
        'Read-only previews must use local404 + installed native cache bodies, even online.',
      );
      const after = await page.evaluate(() => window.snapshotOfflineArt());
      assert.deepEqual(after, baseline);
      report.checks.push({
        name: offline
          ? 'offline exact embedded/external previews'
          : 'online exact embedded/external previews',
        result,
        noNetworkRequests: true,
        cacheAndStorageUnchanged: true,
      });
    }
    const unknown = await page.evaluate(async () => {
      try {
        await fetch('authoring/off-list-original.png');
        return { rejected: false };
      } catch (error) {
        return { rejected: true, name: error.name, message: error.message };
      }
    });
    assert.equal(unknown.rejected, true);
    assert.equal(unknown.name, 'TypeError');
    report.checks.push({ name: 'off-list original retains offline network failure', ...unknown });
    assert.deepEqual(await page.evaluate(() => window.snapshotOfflineArt()), baseline);
    await context.setOffline(false);
    await page.evaluate(async () => {
      await window.offlineArt.reg.unregister();
    });
    report.checks.push({ name: 'worker unregistered after proof', unregistered: true });
    report.requestedPaths = requests;
    assert.deepEqual(report.errors, []);
    assert(!report.requestOverflow && !report.errorOverflow);
    report.complete = true;
  } catch (error) {
    await diagnoseQualificationFailure({
      report,
      error,
      page,
      screenshotPath: options.report.replace(/\.json$/, '') + '.png',
    });
  } finally {
    clearTimeout(deadline);
    const summary = await finishQualification({
      report,
      reportPath: options.report,
      browser,
      writeReport: async (filename, value, writeOptions) => {
        try {
          if (preview) {
            preview.server.closeAllConnections();
            let timer;
            try {
              await Promise.race([
                new Promise((resolve) => preview.server.close(resolve)),
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () => reject(new Error('Fixture server cleanup exceeded 6000ms.')),
                    6000,
                  );
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
            report.serverClosed = true;
          }
        } catch (error) {
          report.complete = false;
          report.serverCleanupFailure = String(error);
        }
        try {
          report.sourceAfter = await hashes();
          report.sourceUnchanged =
            JSON.stringify(report.sourceAfter) === JSON.stringify(report.sourceBefore);
          if (!report.sourceUnchanged) {
            report.complete = false;
            report.failure ??= 'Bound source changed during qualification.';
          }
        } catch (error) {
          report.complete = false;
          report.sourceObservationFailure = String(error);
        }
        await writeNewArtQualificationReport(filename, value, writeOptions);
      },
    });
    if (!summary.complete) process.exitCode = 1;
  }
  return report;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  qualifyOfflineArtFallback(parseArtQualificationOptions(process.argv.slice(2))).catch((error) => {
    console.error(JSON.stringify({ complete: false, failure: String(error.stack ?? error) }));
    process.exitCode = 1;
  });
}
