/* global window, HTMLCanvasElement */
// Hosted synthetic visual correctness only. No local launch or physical-display inference.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPersistentQualificationOwner } from './solo-qualification-browser-context.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  fullProtocol,
  prefixProtocol,
  primitiveProtocol,
  compositorProtocol,
  captureCompositor,
  analyzeCompositor,
} from './solo-raster-protocols.mjs';
import {
  readRasterJSON,
  strictControlReproduced,
  primitiveInputPremises,
  RASTER_SOURCE_LIMITS,
  assertRasterSourceBody,
  EARNED_RASTER_PROTOCOL,
} from './solo-remote-raster.mjs';
const MiB = 1024 ** 2;
const hash = (b) => createHash('sha256').update(b).digest('hex');
const [planPath, outputPath] = process.argv.slice(2);
const plan = await readRasterJSON(planPath, 2 * MiB);
assert.equal(plan.format, 'SoloHostedRasterExecutionV1');
assert(['chromium', 'webkit'].includes(plan.engine));
assert.equal(plan.observationTimeoutMs, 120000);
assert(plan.protocol === undefined || plan.protocol === EARNED_RASTER_PROTOCOL);
const earned = plan.protocol === EARNED_RASTER_PROTOCOL;
const output = resolve(outputPath);
await mkdir(output, { recursive: false });
const fixtureBytes = await readFile(plan.fixture.path);
assert.equal(hash(fixtureBytes), plan.fixture.sha256);
const fixture = earned
  ? JSON.parse(fixtureBytes)
  : JSON.parse(fixtureBytes).expectedReplayDefinition;
const playwright = await import(pathToFileURL(plan.browserModule));
const report = {
  format: earned ? 'SoloHostedEarnedNativeRasterV1' : 'SoloHostedNativeRasterV1',
  ...(earned ? { protocol: EARNED_RASTER_PROTOCOL } : {}),
  status: 'failed',
  sourceRevision: plan.sourceRevision,
  artifact: plan.artifact,
  engine: plan.engine,
  startedAt: new Date().toISOString(),
  performanceExclusion: true,
  primary: null,
  localization: [],
  scope: earned
    ? 'Fresh Linux legal source-core earned capture/erosion raster. No timing, repair, shipped-art, iPhone or historical Mac failure resolution.'
    : 'Fresh Linux default-native-API synthetic presentation. No software forcing, physical scanout, iPhone, heat or historical Mac failure resolution.',
};
const persist = async () => {
  const text = JSON.stringify(report, null, 2) + '\n';
  assert(Buffer.byteLength(text) <= 4 * MiB);
  await writeFile(join(output, 'report.json'), text);
};
const bounded = async (label, run, ms = 10000) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_, no) => {
        timer = setTimeout(() => no(Error(`${label} exceeded ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
let expectedVersion;
async function stage(kind, run, persistent = plan.engine === 'webkit') {
  const directory = join(output, kind);
  await mkdir(directory);
  const value = {
    kind,
    status: 'incomplete',
    startedAt: new Date().toISOString(),
    contextMode: persistent ? 'persistent' : 'ephemeral',
    cases: [],
    invariantFailures: [],
    captures: [],
    errors: [],
    failedRequests: [],
    sources: [],
    sourceLimits: RASTER_SOURCE_LIMITS,
    sourceAdmissionFailures: [],
    cleanup: null,
  };
  if (kind === 'full12' || kind === 'earned7') report.primary = value;
  else report.localization.push(value);
  await persist();
  let owner,
    server,
    browser,
    context,
    page,
    deadline,
    operation,
    settled = false,
    bytesObserved = 0;
  const pending = [],
    allowed = new Map(plan.resources.map((r) => ['/' + r.path, r]));
  const scopeCheck = () => {
    assert(!value.deadlineReached);
    assert(!value.overflow);
  };
  const work = async () => {
    if (persistent) {
      owner = createPersistentQualificationOwner({
        browserType: playwright.webkit,
        launchOptions: { headless: true },
        contextOptions: {
          viewport: { width: 400, height: 850 },
          deviceScaleFactor: 3,
          serviceWorkers: 'block',
        },
        temporaryRoot: plan.scratch,
      });
      value.contextOwner = owner.report;
      ({ browser, context } = await owner.launch());
    } else {
      server = await playwright[plan.engine].launchServer({
        headless: true,
        timeout: 30000,
        ...(plan.engine === 'chromium' ? { executablePath: plan.chromeExecutable } : {}),
      });
      value.ownedPID = server.process().pid;
      server.process().on('exit', (code, signal) => {
        value.processExit = { code, signal, at: new Date().toISOString() };
      });
      browser = await playwright[plan.engine].connect(server.wsEndpoint(), { timeout: 10000 });
      context = await browser.newContext({
        viewport: { width: 400, height: 850 },
        deviceScaleFactor: 3,
        serviceWorkers: 'block',
      });
    }
    scopeCheck();
    value.browserVersion = browser.version();
    if (expectedVersion) assert.equal(value.browserVersion, expectedVersion);
    else expectedVersion = value.browserVersion;
    page = context.pages()[0] ?? (await context.newPage());
    page.setDefaultTimeout(10000);
    page.on('pageerror', (e) => {
      if (value.errors.length < 64) value.errors.push(String(e));
      else value.overflow = true;
    });
    page.on('requestfailed', (r) => {
      if (value.failedRequests.length < 64)
        value.failedRequests.push({ url: r.url(), error: r.failure()?.errorText });
      else value.overflow = true;
    });
    page.on('response', (response) => {
      const url = new URL(response.url()),
        relative = url.pathname;
      if (
        !relative.endsWith('.mjs') &&
        !['/authoring/motion-lab/presets.json', '/game/content/themes.json'].includes(relative)
      )
        return;
      const identity = allowed.get(relative);
      const rejectSource = (reason) => {
        value.overflow = true;
        if (value.sourceAdmissionFailures.length < 16)
          value.sourceAdmissionFailures.push({
            path: relative.slice(0, 1024),
            reason,
            expectedBytes: identity?.bytes ?? null,
          });
      };
      if (
        kind === 'primitive' ||
        url.origin !== new URL(plan.address).origin ||
        !allowed.has(relative) ||
        pending.length >= RASTER_SOURCE_LIMITS.records
      ) {
        rejectSource('source-scope-or-count');
        return;
      }
      if (identity.bytes > RASTER_SOURCE_LIMITS.perSourceBytes) {
        rejectSource('source-bytes');
        return;
      }
      pending.push(
        (async () => {
          const row = { path: identity.path, status: response.status() };
          value.sources.push(row);
          try {
            const bytes = await response.body();
            bytesObserved += bytes.length;
            Object.assign(row, assertRasterSourceBody(bytes, identity, row.status, bytesObserved));
          } catch (e) {
            row.failure = String(e);
          }
        })(),
      );
    });
    const response = await page.goto(new URL('build-info.json', plan.address).href, {
      timeout: 30000,
    });
    assert(response && response.status() === 200);
    const identity = await response.body();
    assert(identity.length <= MiB);
    value.buildInfoSHA256 = hash(identity);
    assert.equal(value.buildInfoSHA256, plan.artifact.buildInfoSHA256);
    assert.equal(JSON.parse(identity).sourceRevision, plan.sourceRevision);
    value.csp = response.headers()['content-security-policy'];
    assert.equal(value.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
    if (kind === 'prefix')
      await page.evaluate(() => {
        const prototype = HTMLCanvasElement.prototype,
          original = prototype.getContext,
          contexts = [],
          seen = new WeakSet();
        const state = { overflow: false };
        prototype.getContext = function (...args) {
          const context = Reflect.apply(original, this, args);
          if (args[0] === '2d' && context && !seen.has(context)) {
            seen.add(context);
            if (contexts.length < 512) contexts.push(context);
            else state.overflow = true;
          }
          return context;
        };
        window.rasterContextBoundary = () => {
          prototype.getContext = original;
          const rows = contexts.map((context, index) => ({
            index,
            width: context.canvas.width,
            height: context.canvas.height,
            attributes:
              typeof context.getContextAttributes === 'function'
                ? context.getContextAttributes()
                : null,
          }));
          delete window.rasterContextBoundary;
          return {
            status: state.overflow ? 'incomplete-cap' : 'observed',
            overflow: state.overflow,
            rows,
            scope:
              'Declared diagnostic wrapper: forwards every getContext exactly once with unchanged arguments; attributes read once after all fixed draws. Primary full12 remains unwrapped.',
          };
        };
      });
    await run({ page, value, directory, scopeCheck });
    scopeCheck();
    if (kind === 'prefix') {
      value.contextAttributes = await page.evaluate(() => window.rasterContextBoundary());
      assert.equal(value.contextAttributes.status, 'observed');
    }

    await bounded('source response drain', () => Promise.all(pending), 5000);
    scopeCheck();
    value.observationComplete = true;
  };
  try {
    operation = work();
    operation.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.race([
      operation,
      new Promise((_, no) => {
        deadline = setTimeout(() => {
          value.deadlineReached = true;
          no(Error('Fixed 120 s observation deadline'));
        }, plan.observationTimeoutMs);
      }),
    ]);
  } catch (e) {
    value.failure = String(e.stack ?? e);
  } finally {
    try {
      if (kind === 'compositor' && page)
        await bounded(
          'fixture disposal',
          () => page.evaluate(() => window.compositorFixture?.dispose()),
          3000,
        );
      if (owner) {
        value.cleanup = await owner.close();
        assert.equal(value.cleanup.status, 'closed');
        assert.equal(value.cleanup.profileRemoved, true);
      } else {
        if (context) await bounded('context close', () => context.close(), 5000);
        if (browser) await bounded('browser close', () => browser.close(), 5000);
        if (server) await bounded('server close', () => server.close(), 5000);
        assert(server && browser && !browser.isConnected());
        assert.equal(server.process().exitCode, 0);
        assert.equal(server.process().signalCode, null);
        value.cleanup = { status: 'closed', processExit: value.processExit, browserClosed: true };
      }
      value.browserClosedAt = new Date().toISOString();
    } catch (e) {
      value.cleanupFailure = String(e);
    }
    try {
      if (operation && !settled)
        await bounded('observation drain', () => operation.catch(() => {}), 5000);
      await bounded('closed source drain', () => Promise.all(pending), 5000);
    } catch (e) {
      value.drainFailure = String(e);
    }
    clearTimeout(deadline);
    value.observationSettled = settled;
    const requiredSources = [
      'game/ui/render.mjs',
      'game/core/index.mjs',
      'game/replay.mjs',
      'authoring/motion-lab/presets.json',
      'game/content/themes.json',
    ];
    if (kind === 'full12' || kind === 'prefix') requiredSources.push('game/ui/jammer-picture.mjs');
    value.sourceClosureComplete =
      kind === 'primitive'
        ? value.sources.length === 0
        : requiredSources.every((path) => value.sources.some((r) => r.path === path && !r.failure));
    value.clean = Boolean(
      value.observationComplete &&
        value.sourceClosureComplete &&
        settled &&
        value.cleanup?.status === 'closed' &&
        !value.failure &&
        !value.cleanupFailure &&
        !value.drainFailure &&
        !value.deadlineReached &&
        !value.overflow &&
        !value.errors.length &&
        !value.failedRequests.length &&
        value.sources.every((r) => !r.failure),
    );
    value.status = value.clean
      ? value.invariantFailures.length
        ? 'failed-strict-invariants'
        : 'automated-invariants-pass-visual-review-pending'
      : 'incomplete';
    value.completedAt = new Date().toISOString();
    await persist();
  }
  return value;
}
async function rasterResult({ page, value, directory, scopeCheck }, protocol, count) {
  const result = await page.evaluate(protocol, { base: plan.address, fixture });
  scopeCheck();
  value.cases = result.rows;
  value.invariantFailures = result.failures;
  value.environment = result.environment;
  value.fixtureScope = result.scope;
  assert.equal(result.rows.length, count);
  assert(result.captures.length <= 108);
  let total = 0;
  const names = new Set();
  for (const capture of result.captures) {
    assert(/^[a-z0-9-]+$/.test(capture.name) && !names.has(capture.name));
    names.add(capture.name);
    assert(capture.png.length <= 12 * MiB);
    const bytes = Buffer.from(capture.png, 'base64');
    total += bytes.length;
    assert(bytes.length <= 8 * MiB && total <= 64 * MiB);
    const path = join(directory, `${capture.name}.png`);
    await writeFile(path, bytes, { flag: 'wx' });
    value.captures.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  value.outputBytes = total;
}
async function earnedRasterResult({ page, value, directory, scopeCheck }) {
  const { earnedRasterProtocol } = await import('./solo-earned-raster-protocol.mjs');
  const result = await page.evaluate(earnedRasterProtocol, { base: plan.address, fixture });
  scopeCheck();
  assert.equal(result.format, 'SoloEarnedNativeRasterV1');
  value.cases = result.rows;
  value.invariantFailures = result.failures;
  value.notObserved = result.notObserved;
  value.environment = result.environment;
  value.fixtureScope = result.scope;
  value.canvasIdentities = result.canvasIdentities;
  const { recording, ...proof } = result.proof;
  value.earnedProof = proof;
  assert(result.rows.length > 0 && result.rows.length <= 21);
  assert.equal(result.rows.length + result.notObserved.length, 21);
  const replayBytes = Buffer.from(JSON.stringify(recording) + '\n');
  assert(replayBytes.length <= MiB);
  const replayPath = join(directory, 'earned-replay.json');
  await writeFile(replayPath, replayBytes, { flag: 'wx' });
  value.replayArtifact = { path: replayPath, bytes: replayBytes.length, sha256: hash(replayBytes) };
  assert(result.captures.length <= 48);
  let total = replayBytes.length,
    rawCount = 0;
  const names = new Set();
  for (const capture of result.captures) {
    assert(/^[a-z0-9-]+$/.test(capture.name) && !names.has(capture.name));
    names.add(capture.name);
    for (const [extension, base64] of [
      ['png', capture.png],
      ['rgba', capture.rgba],
    ]) {
      if (base64 === undefined) continue;
      assert(typeof base64 === 'string' && base64.length <= 12 * MiB);
      const bytes = Buffer.from(base64, 'base64');
      total += bytes.length;
      assert(bytes.length <= 8 * MiB && total <= 64 * MiB);
      if (extension === 'rgba') {
        assert.equal(bytes.length, 1200 * 600 * 4);
        assert(++rawCount <= 6, 'Only the first failed row has raw comparators');
      }
      const path = join(directory, `${capture.name}.${extension}`);
      await writeFile(path, bytes, { flag: 'wx' });
      value.captures.push({ path, bytes: bytes.length, sha256: hash(bytes) });
    }
  }
  value.outputBytes = total;
}
try {
  const primary = earned
    ? await stage('earned7', earnedRasterResult)
    : await stage('full12', (ctx) => rasterResult(ctx, fullProtocol, 12));
  if (!earned && strictControlReproduced(primary, 12)) {
    const control = await stage('prefix', (ctx) => rasterResult(ctx, prefixProtocol, 2));
    if (strictControlReproduced(control, 2)) {
      const primaryCaptures = new Map(primary.captures.map((r) => [r.path.split('/').at(-1), r]));
      control.primaryPrefixPNGAgreement = control.captures.every((r) => {
        const p = primaryCaptures.get(r.path.split('/').at(-1));
        return p && p.sha256 === r.sha256 && p.bytes === r.bytes;
      });
      assert.equal(
        control.primaryPrefixPNGAgreement,
        true,
        'Fresh prefix changed its full12 prefix output',
      );
      let rawPNGs;
      const compositor = await stage(
        'compositor',
        async ({ page, value, directory }) => {
          value.fixture = await page.evaluate(compositorProtocol, { base: plan.address, fixture });
          let captureBytes = 0;
          const retainPNG = async (path, bytes, options) => {
            captureBytes += bytes.length;
            assert(bytes.length <= 8 * MiB && captureBytes <= 32 * MiB);
            return writeFile(path, bytes, options);
          };
          rawPNGs = await captureCompositor({
            page,
            report: value,
            output: directory,
            hash,
            writeFile: retainPNG,
            resolve,
            bounded,
          });
          assert.equal(rawPNGs.size, 14);
          let total = 0;
          for (const bytes of rawPNGs.values()) {
            total += bytes.length;
            assert(bytes.length <= 8 * MiB && total <= 32 * MiB);
          }
        },
        false,
      );
      if (compositor.clean) {
        const decoderPath = join(
          dirname(plan.browserModule),
          '..',
          'playwright-core',
          'lib',
          'utilsBundle.js',
        );
        const decoderBytes = await readFile(decoderPath);
        report.pngDecoder = {
          bytes: decoderBytes.length,
          sha256: hash(decoderBytes),
          scope: 'Exact installed Playwright 1.62.1 bundled PNG decoder, after browser closure.',
        };
        const { PNG } = createRequire(import.meta.url)(decoderPath);
        assert.equal(typeof PNG?.sync?.read, 'function');
        for (const bytes of rawPNGs.values()) {
          assert(bytes.length >= 24 && bytes.subarray(1, 4).toString() === 'PNG');
          assert.equal(bytes.readUInt32BE(16), 1200);
          assert.equal(bytes.readUInt32BE(20), 900);
        }
        try {
          analyzeCompositor(compositor, rawPNGs, PNG);
          compositor.analysisComplete = true;
        } catch (e) {
          if (e.code === 'ERR_ASSERTION' && compositor.invariantFailures.length > 0) {
            compositor.analysisComplete = true;
            compositor.strictAssertion = String(e);
          } else compositor.analysisFailure = String(e);
        }
        compositor.status = compositor.analysisFailure
          ? 'incomplete'
          : compositor.invariantFailures.length
            ? 'failed-strict-invariants'
            : 'automated-invariants-pass-visual-review-pending';
      }
      assert(
        compositor.clean && compositor.analysisComplete && !compositor.analysisFailure,
        'Compositor owner/analysis incomplete; stop localization',
      );
      const inputs = {};
      for (const [group, rows] of Object.entries(plan.primitiveInputs)) {
        inputs[group] = [];
        for (const row of rows) {
          const bytes = await readFile(row.path);
          assert.equal(bytes.length, row.bytes);
          assert.equal(hash(bytes), row.sha256);
          inputs[group].push({ ...row, base64: bytes.toString('base64') });
        }
      }
      primitiveInputPremises(inputs);
      const primitive = await stage('primitive', async ({ page, value, directory }) => {
        const result = await page.evaluate(primitiveProtocol, {
          pngInputs: inputs.postTintPNGs,
          atlasInputs: inputs.atlasUploads,
          historical: inputs.originalAfterNoiseComparators,
        });
        assert.equal(result.outputs.length, 6);
        assert.equal(result.pairwise.length, 15);
        assert.equal(result.historicalComparisons.length, 12);
        value.premises = result.premises;
        value.pairwise = result.pairwise;
        value.historicalComparisons = result.historicalComparisons;
        value.sourceAttributes = result.sourceAttributes;
        const retain = async (name, base64) => {
          assert(base64.length <= 3 * MiB);
          const bytes = Buffer.from(base64, 'base64');
          assert.equal(bytes.length, 768 * 576 * 4);
          const path = join(directory, name);
          await writeFile(path, bytes, { flag: 'wx' });
          return { path, bytes: bytes.length, sha256: hash(bytes) };
        };
        value.postTintDecoded = await retain('post-tint-decoded.rgba', result.postTintDecodedRGBA);
        value.outputs = [];
        for (const { rgba, ...scalars } of result.outputs)
          value.outputs.push({
            ...scalars,
            ...(await retain(`primitive-${scalars.order}.rgba`, rgba)),
          });
        value.scope =
          'Historical dbf immutable pixel inputs on a fresh Linux browser. Descriptive localization only; no current live-path input equality or historical backend/1LSB identity inferred.';
      });
      primitive.diagnosticStatus = primitive.clean
        ? 'observed-original-strict-failure-retained'
        : 'inconclusive';
    } else
      report.localizationDisposition = control.clean
        ? 'fresh-prefix-non-reproduction-no-localization'
        : 'fresh-prefix-incomplete-no-localization';
  } else
    report.localizationDisposition = primary.clean
      ? 'strict-control-not-reproduced-no-localization'
      : 'primary-incomplete-no-localization';
  if (earned) report.localizationDisposition = 'separate-earned-protocol-no-synthetic-localization';
  report.status =
    primary.clean &&
    (!earned || primary.cases.length === 21) &&
    primary.invariantFailures.length === 0
      ? 'automated-invariants-pass-visual-review-pending'
      : 'failed';
} catch (e) {
  report.failure = String(e.stack ?? e);
  report.status = 'failed';
}
report.browserVersion = expectedVersion;
report.completedAt = new Date().toISOString();
await persist();
process.exitCode = report.status === 'automated-invariants-pass-visual-review-pending' ? 0 : 1;
