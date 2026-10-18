/* global window, document, PageTransitionEvent */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, link, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  diagnoseQualificationFailure,
  finishQualification,
  writeQualificationReport,
} from './shared-demo-browser-report.mjs';
import { createHash } from 'node:crypto';
import { startProductionPreview } from './serve-production-preview.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { CURRENT_ART_SOURCES } from '../game/presentation/current-art-sources.mjs';
import { listProductionSlots } from '../authoring/production/model.mjs';
import { buildRouteWorld } from '../authoring/library/route-worlds/build.mjs';
import { buildExternalSentinel } from '../authoring/library/sentinel-circuit-external/build.mjs';
import { buildSentinelTheme } from '../authoring/library/sentinel-theme-chapters/build.mjs';

export function parseArtQualificationOptions(argv) {
  const options = {};
  for (const arg of argv) {
    const match = /^--(runtime|executable|report)=(.+)$/.exec(arg);
    if (!match || Object.hasOwn(options, match[1]))
      throw new Error('Expected unique --runtime, --executable and --report paths.');
    options[match[1]] = path.resolve(match[2]);
  }
  if (!options.runtime || !options.executable || !options.report)
    throw new Error('All three paths are required.');
  return options;
}
export function artworkOmissionPaths(proof, sources = CURRENT_ART_SOURCES) {
  assert.equal(proof.allExact, true);
  assert(Array.isArray(proof.loads) && proof.loads.length > 0);
  const ids = new Map(sources.map((source) => [source.id, source]));
  for (const load of proof.loads) {
    const source = ids.get(load.id);
    assert(source?.kind !== 'procedural' && source?.sourceImagePath === load.path);
    assert.equal(source.image.bytes, load.bytes);
    assert.equal(source.image.sha256, load.sha256);
  }
  const paths = new Set(proof.loads.map((load) => load.path));
  assert.equal(paths.size, proof.uniqueOriginals);
  return paths;
}
export async function writeNewArtQualificationReport(reportPath, report, options = {}) {
  return writeQualificationReport(reportPath, report, {
    ...options,
    fs: {
      writeFile,
      rm,
      rename: async (temporary, destination) => {
        // Atomic adoption must fail if another receipt appeared during the browser run.
        await link(temporary, destination);
        await rm(temporary);
      },
    },
  });
}
async function bounded(work, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Qualification operation exceeded ${milliseconds}ms.`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function qualifyAuthoringArtFallback(options) {
  try {
    await lstat(options.report);
    throw new Error('Refusing to overwrite an existing qualification receipt.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert(
    (await lstat(path.dirname(options.report))).isDirectory(),
    'Report parent directory must exist.',
  );
  for (const file of [options.runtime, options.executable])
    assert((await lstat(file)).isFile(), `Expected a file: ${file}`);
  const root = fileURLToPath(new URL('../', import.meta.url)),
    hash = (b) => createHash('sha256').update(b).digest('hex');
  const paths = [
    'scripts/qualify-authoring-art-fallback-browser.mjs',
    'scripts/shared-demo-browser-report.mjs',
    'game/locales/en/tools.json',
    'game/locales/uk/tools.json',
    'game/i18n/catalogs.mjs',
    'authoring/design-atlas/reveal-audit.html',
    'authoring/production/preview.mjs',
    'authoring/design-atlas/reveal-audit.mjs',
    'authoring/design-atlas/reveal-audit-thumbnails.mjs',
    'authoring/design-atlas/reveal-audit-viewer.mjs',
    'game/presentation/current-art.mjs',
    'game/presentation/current-art-sources.mjs',
  ];
  const sourceHashes = async () =>
    Object.fromEntries(
      await Promise.all(paths.map(async (p) => [p, hash(await readFile(path.join(root, p)))])),
    );
  const report = {
    format: 'revealline-authoring-art-fallback-browser.v1',
    started: new Date().toISOString(),
    scope:
      'Real Chromium authoring pages on task-owned production-policy fixture server; not a generated-build or offline-install qualification. Exact original PNG404 injected at HTTP server, native retained pack/media served from exact producer payloads. Owned URL attribution uses the actual production-preview allocation stack; unrelated page-presentation URLs are reported separately. Synthetic pagehide exercises owned gallery cleanup; no pixel aesthetic approval.',
    checks: [],
    errors: [],
    serverClosed: false,
    sourceBefore: await sourceHashes(),
  };
  const proofPath = path.join(
    root,
    'docs/qualification/shared-demos/current-art-fallback-proof-final.json',
  );
  const proofBytes = await readFile(proofPath);
  const eligible = artworkOmissionPaths(JSON.parse(proofBytes));
  report.omissionProof = {
    path: 'docs/qualification/shared-demos/current-art-fallback-proof-final.json',
    sha256: hash(proofBytes),
    originalPaths: [...eligible],
  };
  report.limits = [
    'Representative production embedded original and selected external gallery/viewer original; not every omitted image receives browser pixel qualification.',
    'Only lazy in-view gallery images are loaded; this is not all21 thumbnails.',
    'Final pagehide is dispatched by the probe; actual navigation/BFCache has separate qualification.',
    'URL instrumentation retains active Blob references for hashing and records global counts separately from preview allocation-stack ownership.',
    'Source hashes cover the listed consumer/resolver/locale/tool files, not the whole repository.',
    'Storage comparison covers localStorage/sessionStorage; this probe does not inspect all IndexedDB records.',
  ];
  const register = JSON.parse(
    await readFile(path.join(root, 'authoring/production/register.json')),
  );
  const row = listProductionSlots(register).find((r) =>
    r.work?.files.some((f) => eligible.has(f.file.path)),
  );
  assert(row);
  const descriptor = CURRENT_ART_SOURCES.find(
    (s) => s.sourceImagePath === row.work.files.find((f) => eligible.has(f.file.path)).file.path,
  );
  const producers = new Map([
    ['sentinel-circuit-fpv', buildExternalSentinel],
    ...['ukraine',
'retro'].flatMap((id) => [
      [`route-worlds-${id}`, () => buildRouteWorld(id)],
      [`sentinel-circuit-${id}`, () => buildSentinelTheme(id)],
    ]),
  ]);
  const payloads = new Map(),
    requests = [];
  const originalPins = new Map(
    CURRENT_ART_SOURCES.filter((s) => s.sourceImagePath).map((s) => [s.sourceImagePath, s.image]),
  );
  const nativePacks = new Map(
    CURRENT_ART_SOURCES.filter((s) => s.kind === 'embedded').map((s) => [s.source.path, s.source]),
  );
  const externalPins = new Map(
    CURRENT_ART_SOURCES.filter((source) => source.kind === 'external').flatMap((source) =>
      ['pack', 'media'].map((kind) => [
        source.source[kind].path,
        { ...source.source[kind], kind, id: source.source.descriptorId },
      ]),
    ),
  );
  let preview,
    browser,
    page,
    omit = false,
    holdPath = null,
    release;
  const gate = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  let held = null;
  const check = (name, facts) => {
    report.checks.push({ name, ...facts });
    console.log(JSON.stringify({ check: name }));
  };
  const deadline = setTimeout(() => {
    report.complete = false;
    report.failure ??= 'Authoring artwork qualification exceeded 120 seconds.';
    void browser?.close().catch(() => {});
  }, 120000);
  try {
    preview = await startProductionPreview({
      root,
      port: 0,
      fixtureAccess: true,
      cache: 'no-store',
    });
    const native = preview.server.listeners('request')[0];
    preview.server.removeListener('request', native);
    preview.server.on('request', async (req, res) => {
      const path = new URL(req.url, preview.url).pathname.slice(1);
      if (requests.length < 4096) requests.push(path);
      else report.requestLogOverflow = true;
      if (omit && eligible.has(path)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...PUBLIC_SECURITY_HEADERS });
        res.end('Exact original deliberately omitted by fixture');
        return;
      }
      if (originalPins.has(path)) {
        try {
          const bytes = await readFile(new URL(path, pathToFileURL(root + '/'))),
            pin = originalPins.get(path);
          assert.equal(bytes.length, pin.bytes);
          assert.equal(hash(bytes), pin.sha256);
          res.writeHead(200, {
            'Content-Type': pin.mime,
            'Content-Length': String(bytes.length),
            ...PUBLIC_SECURITY_HEADERS,
          });
          res.end(bytes);
        } catch (e) {
          res.writeHead(500);
          res.end(e.message);
        }
        return;
      }
      if (path === holdPath && held) await held;
      if (nativePacks.has(path)) {
        try {
          const bytes = await readFile(new URL(path, pathToFileURL(root + '/'))),
            pin = nativePacks.get(path);
          assert.equal(bytes.length, pin.bytes);
          assert.equal(hash(bytes), pin.sha256);
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': String(bytes.length),
            ...PUBLIC_SECURITY_HEADERS,
          });
          res.end(bytes);
        } catch (e) {
          res.writeHead(500);
          res.end(e.message);
        }
        return;
      }
      const external = externalPins.get(path);
      if (external && producers.has(external.id)) {
        try {
          const { id, kind } = external;
          if (!payloads.has(id)) payloads.set(id, producers.get(id)());
          const result = await payloads.get(id);
          const blob = result.payloads[kind];
          const bytes = Buffer.from(await blob.arrayBuffer());
          assert.equal(bytes.length, external.bytes);
          assert.equal(hash(bytes), external.sha256);
          res.writeHead(200, {
            'Content-Type': blob.type,
            'Content-Length': String(bytes.length),
            ...PUBLIC_SECURITY_HEADERS,
          });
          res.end(bytes);
        } catch (e) {
          res.writeHead(500);
          res.end(e.message);
        }
        return;
      }
      return native(req, res);
    });
    const { chromium } = await import(pathToFileURL(options.runtime).href);
    browser = await chromium.launch({
      executablePath: options.executable,
      timeout: 20000,
      headless: true,
      args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL),
        active = new Map(),
        owned = new Set();
      window.__artURLs = { active, owned, created: 0, revoked: 0 };
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        active.set(url, blob);
        if (new Error().stack.includes('/authoring/production/preview.mjs')) owned.add(url);
        window.__artURLs.created++;
        return url;
      };
      URL.revokeObjectURL = (url) => {
        active.delete(url);
        owned.delete(url);
        window.__artURLs.revoked++;
        return revoke(url);
      };
    });
    page = await context.newPage();
    page.on('pageerror', (e) => {
      if (report.errors.length < 64)
        report.errors.push({ name: e.name, message: e.message, stack: e.stack });
      else report.errorLogOverflow = true;
    });
    page.setDefaultTimeout(20000);
    const login = async () => {
      if (await page.locator('#access-gate input[type=password]').isVisible()) {
        await page.locator('#access-gate input[type=password]').fill('fixture-password');
        await page.locator('#access-gate button[type=submit]').click();
      }
      await page.waitForFunction(() => document.documentElement.dataset.accessState === 'unlocked');
    };
    const storage = () =>
      page.evaluate(() => ({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.fromEntries(Object.entries(sessionStorage)),
      }));
    const imagePin = (selector) =>
      page.locator(selector).evaluate(async (img) => {
        if (!window.__artURLs.owned.has(img.src))
          throw new Error('Displayed target is not an owned preview URL');
        return {
          width: img.naturalWidth,
          height: img.naturalHeight,
          sha256: Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                'SHA-256',
                await window.__artURLs.active.get(img.src).arrayBuffer(),
              ),
            ),
            (b) => b.toString(16).padStart(2, '0'),
          ).join(''),
        };
      });
    await page.goto(preview.url + 'authoring/production/index.html');
    await login();
    await page.locator('#production-search').fill(row.id);
    await page.locator(`[data-production-slot="${row.id}"]`).first().click();
    const before = await storage();
    report.urlObservations = [];
    const urls = async (label) =>
      report.urlObservations.push({
        label,
        ...(await page.evaluate(() => ({
          owned: window.__artURLs.owned.size,
          globalActive: window.__artURLs.active.size,
          globalCreated: window.__artURLs.created,
          globalRevoked: window.__artURLs.revoked,
        }))),
      });
    await urls('Production initialized');
    let start = requests.length;
    await page.locator('#production-preview').click();
    await page.locator('.preview img').waitFor();
    assert.equal(await page.evaluate(() => window.__artURLs.owned.size), 1);
    assert.deepEqual(await imagePin('.preview img'), {
      width: descriptor.image.width,
      height: descriptor.image.height,
      sha256: descriptor.image.sha256,
    });
    assert.equal(requests.slice(start).filter((p) => p === descriptor.sourceImagePath).length, 1);
    assert(!requests.slice(start).some((p) => p === descriptor.source?.path));
    await page.locator('#production-clear-preview').click();
    await page.waitForFunction(() => window.__artURLs.owned.size === 0);
    await urls('Production direct preview cleared');
    check('Production UI prefers exact source PNG and releases displayed URL', { slotId: row.id });
    omit = true;
    start = requests.length;
    await page.locator('#production-preview').click();
    await page.locator('.preview img').waitFor();
    assert.equal(await page.evaluate(() => window.__artURLs.owned.size), 1);
    assert.deepEqual(await imagePin('.preview img'), {
      width: descriptor.image.width,
      height: descriptor.image.height,
      sha256: descriptor.image.sha256,
    });
    assert.equal(requests.slice(start).filter((p) => p === descriptor.sourceImagePath).length, 1);
    assert(requests.slice(start).some((p) => p !== descriptor.sourceImagePath));
    await page.locator('#production-clear-preview').click();
    await page.waitForFunction(() => window.__artURLs.owned.size === 0);
    await urls('Production fallback preview cleared');
    check('Production UI fallback displays byte-identical original and releases URL', {
      requested: requests.slice(start),
    });
    if (descriptor.kind === 'embedded') {
      holdPath = descriptor.source.path;
      held = gate();
      start = requests.length;
      await page.locator('#production-preview').click();
      for (let n = 0; !requests.slice(start).includes(holdPath) && n < 100; n++)
        await new Promise((r) => setTimeout(r, 10));
      assert(requests.slice(start).includes(holdPath));
      await page.locator('#production-clear-preview').click();
      release();
      held = null;
      holdPath = null;
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.preview img').count(), 0);
      await page.waitForFunction(() => window.__artURLs.owned.size === 0);
      check('Production cancellation fences late native fallback and releases all URLs', {});
    }
    assert.deepEqual(await storage(), before);
    check('Production preview leaves local/session storage unchanged', {});
    await page.goto(preview.url + 'authoring/design-atlas/reveal-audit.html');
    await login();
    await page.locator('#rasters article').first().waitFor();
    const auditBefore = await storage();
    await urls('Reveal initialized');
    const audit = JSON.parse(
      await readFile(path.join(root, 'authoring/design-atlas/reveal-audit.json')),
    );
    const auditIndex = audit.images.findIndex((e) => eligible.has(e.path));
    assert(auditIndex >= 0);
    const targetSelector = `#rasters article:nth-child(${auditIndex + 1}) .image img`;
    await page.locator(`#rasters article:nth-child(${auditIndex + 1})`).scrollIntoViewIfNeeded();
    await page.locator(targetSelector).waitFor();
    assert.deepEqual(await imagePin(targetSelector), {
      width: audit.images[auditIndex].image.width,
      height: audit.images[auditIndex].image.height,
      sha256: audit.images[auditIndex].image.sha256,
    });
    const loaded = await page.locator('#rasters .image img').count();
    assert(loaded > 0 && loaded < audit.images.length);
    check('Reveal Audit lazily displays exact retained artwork after original404', {
      loaded,
      total: audit.images.length,
      selectedPath: audit.images[auditIndex].path,
    });
    await page.locator(`#reveal-source-raster-${auditIndex + 1}`).click();
    await page.waitForFunction(
      () => document.querySelector('#reveal-source-dialog')?.dataset.state === 'ready',
    );
    assert.deepEqual(await imagePin('#reveal-source-region img'), {
      width: audit.images[auditIndex].image.width,
      height: audit.images[auditIndex].image.height,
      sha256: audit.images[auditIndex].image.sha256,
    });
    await page.locator('#reveal-source-close').click();
    assert.equal(await page.locator('#reveal-source-region img').count(), 0);
    check('Reveal source viewer uses same exact bytes and retires its image on Back', {});
    assert.deepEqual(await storage(), auditBefore);
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })),
    );
    await page.waitForFunction(() => window.__artURLs.owned.size === 0);
    await urls('Reveal final synthetic pagehide');
    check(
      'Reveal gallery final departure aborts pending loads and retires every owned object URL',
      {
        urls: await page.evaluate(() => ({
          owned: window.__artURLs.owned.size,
          allPageOwners: window.__artURLs.active.size,
          created: window.__artURLs.created,
          revoked: window.__artURLs.revoked,
        })),
      },
    );
    assert.deepEqual(await storage(), auditBefore);
    assert.deepEqual(report.errors, []);
    assert(!report.requestLogOverflow && !report.errorLogOverflow);
    report.complete = true;
  } catch (error) {
    report.requestedPaths = requests;
    await diagnoseQualificationFailure({
      report,
      error,
      page,
      screenshotPath: options.report.replace(/\.json$/, '') + '.png',
    });
  } finally {
    clearTimeout(deadline);
    release?.();
    const summary = await finishQualification({
      report,
      reportPath: options.report,
      browser,
      writeReport: async (reportPath, value, writeOptions) => {
        try {
          if (preview) {
            preview.server.closeAllConnections();
            await bounded(() => new Promise((resolve) => preview.server.close(resolve)), 6000);
            report.serverClosed = true;
          }
        } catch (error) {
          report.complete = false;
          report.serverCleanupFailure = String(error);
        }
        try {
          report.sourceAfter = await sourceHashes();
          report.sourceUnchanged =
            JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
          if (!report.sourceUnchanged) {
            report.complete = false;
            report.failure ??= 'Listed qualification sources changed during the run.';
          }
        } catch (error) {
          report.complete = false;
          report.sourceObservationFailure = String(error);
        }
        await writeNewArtQualificationReport(reportPath, value, writeOptions);
      },
    });
    if (!summary.complete) process.exitCode = 1;
  }
  return report;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  qualifyAuthoringArtFallback(parseArtQualificationOptions(process.argv.slice(2))).catch(
    (error) => {
      console.error(JSON.stringify({ complete: false, failure: String(error.stack ?? error) }));
      process.exitCode = 1;
    },
  );
}
