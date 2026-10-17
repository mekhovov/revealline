/* global window, document, navigator, requestAnimationFrame, MutationObserver,
PerformanceObserver, AudioBufferSourceNode, OscillatorNode, HTMLMediaElement */
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arch, release, loadavg } from 'node:os';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  installAudioProof,
  evaluateAudioProof,
  audioProofOptions,
  readAudioFailureContext,
} from './solo-qualification-audio.mjs';
import { verifyNativeQualificationReplay } from './solo-qualification-native-replay.mjs';
import {
  beginQualificationUploadWitness,
  readPublicQualificationReplay,
  waitQualificationControl,
  waitQualificationPreparation,
} from './solo-qualification-export.mjs';
import { createQualificationCpuProfile } from './solo-qualification-cpu-profile.mjs';
import { createQualificationReplayIdentity } from './solo-qualification-replay-identity.mjs';
import {
  qualificationContextMode,
  createPersistentQualificationOwner,
} from './solo-qualification-browser-context.mjs';
import {
  qualificationCadenceOption,
  prepareCadenceViewport,
  observeSettledCadence,
  calibrateSettledCadence,
} from './solo-qualification-cadence.mjs';
import {
  validateQualification,
  qualificationDisplayOptions,
  qualificationCacheMode,
  qualificationProfileMode,
  qualificationSnapshotStorage,
  resourceStability,
  createManifestMirror,
  evaluateQualificationBudgets,
  memoryProfileSummary,
  quantileBound,
  FRAME_BOUNDS,
} from './solo-qualification.mjs';
import {
  readPrePlayReadiness,
  createRafIntervalClock,
  calibrateReadyCadence,
  observeLowWorkCadence,
  calibrateLowWorkCadence,
  frozenExternalCadence,
  externalQualificationBudgets,
  aggregateQualificationGates,
  qualificationPageErrorDetails,
  qualificationQualityOptions,
  createSubmittedTierObservation,
  qualificationQualityAudioBoundary,
} from './solo-qualification-observation.mjs';

// Public UI only. Never write application storage, run state, clocks or caches.
// Recovery injection is a separately labeled scenario, not native device loss.
const [address, scenarioPath, output, ...flags] = process.argv.slice(2);
if (!address || !scenarioPath || !output || !process.env.PLAYWRIGHT_MODULE)
  throw new Error(
    'Usage: PLAYWRIGHT_MODULE=<path> node scripts/qualify-solo-runtime.mjs <Solo URL> <scenario.json> <new-report.json> [--browser=webkit] [--source-revision=<sha>] [--server-fixture-access|--fixture-access] [--public-url=<original production URL> --manifest=<frozen manifest>] [--headed] [--cpu=4] [--memory-profile|--audio-proof|--cpu-profile] [--audio-proof-music-capacity] [--audio-proof-import-events] [--work-probe] [--readiness-probe=first-running-v1 (ab45 cold correctness pilot only)] [--hitch-journal [--hitch-journal-preparation=first-return-anchored-v1]] [--journal-cost-probe (exact 30-second border recipe only)] [--cadence=blank30|settled120] [--baseline-runtime] [--viewport=400x850] [--dpr=3] [--mobile-context] [--context=ephemeral|persistent] [--snapshot-chunks (declared long lifecycle only)]',
  );
const option = (key, fallback) =>
  flags.find((flag) => flag.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const bytes = await readFile(resolve(scenarioPath)),
  scenario = validateQualification(JSON.parse(bytes));
const display = qualificationDisplayOptions(flags);
const snapshotStorageOptions = qualificationSnapshotStorage(flags, scenario);
const engine = option('browser', 'chromium'),
  cpu = Number(option('cpu', '1'));
const contextMode = qualificationContextMode(flags, engine);
const profileMode = qualificationProfileMode(flags, engine, scenario);
const memoryProfile = profileMode === 'memory-profile',
  audioProof = profileMode === 'audio-proof',
  cpuProfile = profileMode === 'cpu-profile';
const audioOptions = audioProofOptions(flags, scenario.audioRequirements, audioProof);
const exportsReplay = (actions) =>
  actions.some(
    (action) =>
      action.type === 'exportReplay' || (action.type === 'repeat' && exportsReplay(action.actions)),
  );
const needsReplayIdentity = exportsReplay(scenario.actions);
assert(
  scenario.expectedReplayDefinition && needsReplayIdentity,
  'Qualification requires an expected immutable level definition and public replay export',
);
assert(
  !(memoryProfile && audioProof),
  'Audio identity profiling retains media elements; run memory profiling separately',
);
const baselineRuntime = flags.includes('--baseline-runtime'),
  workProbe = flags.includes('--work-probe'),
  cadenceProtocol = qualificationCadenceOption(flags);
const hitchModule = flags.some((flag) => flag.startsWith('--hitch-journal'))
  ? await import('./solo-qualification-hitch-journal.mjs')
  : null;
const hitchOptions = hitchModule?.qualificationHitchJournalOptions(flags, scenario, bytes);
const readinessModule =
  scenario.selectedFontCancellation || flags.some((flag) => flag.startsWith('--readiness-probe'))
    ? await import('./solo-qualification-readiness.mjs')
    : null;
const readinessOptions = readinessModule?.qualificationReadinessOptions(flags, scenario, bytes);
let readinessDocuments = 0,
  selectedFontHold = null;
const selectedFontReadiness = [
  'selected-font-cancel-v1',
  'selected-font-cancel-joined-v2',
].includes(readinessOptions?.protocol);
const qualityOptions = qualificationQualityOptions(
  flags,
  scenario,
  createHash('sha256').update(bytes).digest('hex'),
);
let qualityDocuments = 0;
const journalCostModule = flags.some((flag) => flag.startsWith('--journal-cost-probe'))
  ? await import('./solo-qualification-journal-cost.mjs')
  : null;
const journalCostOptions = journalCostModule?.qualificationJournalCostOptions(
  flags,
  scenario,
  bytes,
);
assert(cadenceProtocol === 'blank30' || workProbe, 'Settled cadence requires the work probe');
assert(
  !baselineRuntime || (workProbe && /^[0-9a-f]{40}$/.test(option('source-revision', ''))),
  'Baseline mode requires the same --work-probe as candidate and a full --source-revision',
);
assert(['chromium', 'webkit'].includes(engine) && Number.isFinite(cpu) && cpu >= 1 && cpu <= 20);
assert(engine === 'chromium' || cpu === 1, 'CPU throttling is Chromium-only');
assert(!memoryProfile || engine === 'chromium', 'Heap/DOM profiling is Chromium-only');
try {
  await access(resolve(output));
  throw new Error('Refusing to overwrite existing evidence. Choose a new output path.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const localURL = new URL(address),
  url = new URL(option('public-url', address));
const mirrored = url.origin !== localURL.origin || url.pathname !== localURL.pathname;
let mirror, mirrorManifest;
if (mirrored) {
  assert(option('manifest', null), 'Public-origin mirroring requires the frozen package manifest');
  const manifestBytes = await readFile(resolve(option('manifest')));
  const manifest = JSON.parse(manifestBytes);
  if (option('source-revision', null))
    assert.equal(manifest.sourceRevision, option('source-revision'));
  mirror = createManifestMirror(manifest, url.href, localURL.href);
  mirrorManifest = {
    sourceRevision: manifest.sourceRevision,
    sha256: createHash('sha256').update(manifestBytes).digest('hex'),
    files: manifest.files.length,
  };
}
const fixtureAccess = flags.includes('--fixture-access');
const serverFixtureAccess = flags.includes('--server-fixture-access');
assert(
  !(fixtureAccess && serverFixtureAccess),
  'Choose server or routing access fixture, not both',
);
assert(
  !(fixtureAccess || serverFixtureAccess) ||
    ['localhost', '127.0.0.1', '[::1]'].includes(localURL.hostname),
  'Access fixture requires a local transport',
);
const cacheMode = qualificationCacheMode(scenario, { workProbe, fixtureAccess, mirrored });
if (scenario.query)
  for (const [key, value] of Object.entries(scenario.query)) url.searchParams.set(key, value);
url.searchParams.set('performance', '1');
const report = {
  format: 'SoloQualificationReportV1',
  scenario: scenario.id,
  kind: readinessOptions ? 'readiness-diagnostic' : (profileMode ?? scenario.kind),
  scenarioKind: scenario.kind,
  cacheMode,
  baselineRuntime,
  workProbe,
  cadenceProtocol,
  audioProof,
  audioProofOptions: audioProof ? audioOptions : null,
  sourceRevision: option('source-revision', null),
  scenarioSHA256: createHash('sha256').update(bytes).digest('hex'),
  requestedCoverage: scenario.coverage,
  startedAt: new Date().toISOString(),
  scenarioStatus: 'running',
  performanceGateStatus: 'not-evaluated',
  mirrorManifest: mirrorManifest ?? null,
  environment: {
    engine,
    contextMode,
    cpuThrottle: cpu,
    headless: !flags.includes('--headed'),
    architecture: arch(),
    osRelease: release(),
    initialLoad: loadavg(),
    requestedDisplay: display,
    inputMethod: 'public keyboard and UI controls; no touch gestures',
    url: url.href,
    localTransport: mirrored ? localURL.href : null,
  },
  limitations: [
    'Scenario action/replay/resource success is separate from conservative observed-window numerical gates. Cohort comparisons, matched overhead and physical-device qualification remain required.',
    'Keyboard and ordinary UI actions use native elapsed time. No fixed-tick replay or simulation mutation; a route that misses its expected result fails.',
    'Requested coverage is not proof that a mechanic occurred. Assertions and visible results are recorded separately.',
    'Desktop browser observations do not qualify iPhone Safari, Steam Deck graphics, thermals, touch, controllers or actual orientation.',
    'Viewport/DPR/mobile-context options exercise desktop layout and raster density, without a device-model or user-agent override. Touch capability does not mean touch actions were exercised.',
    'rAF histograms are quantile bounds. Previous-phase attribution retains transition-crossing intervals; browser GPU completion is unobserved.',
    ...(serverFixtureAccess
      ? [
          'Local server HTML access fixture; no browser routing is added unless public-origin mirroring was requested.',
        ]
      : []),
    'Resource export happens only at explicit paused/result checkpoints. Owned categories may overlap; no total memory or leak-free claim.',
    'Audio source starts/play-promise fulfillment demonstrate API activity, not audible output or complete speech/music coverage.',
    'This harness adds phase/rAF and audio-API observers. Its timing is not a measurement of ordinary diagnostics overhead.',
    ...(workProbe
      ? [
          'Independent PRE_STEP→POST_RENDER work instrumentation uses one fixed30-interval foreground about:blank calibration before game navigation with the same viewport/DPR/CPU setting. Title-ready intervals are separate startup evidence. External B stays fixed across navigation/reload and is independent of application B; no physical/GPU or overhead-free claim.',
        ]
      : []),
    ...(baselineRuntime
      ? [
          'Baseline application diagnostics may be absent. Missing internal latency, safety and owned-resource counters remain unobserved, not zero or passing. Generated build-info source revision is verified before actions.',
        ]
      : []),
    ...(audioProof
      ? [
          'Encoded-byte hashing and media-event retention are enabled for exact recording identity. This whole run is excluded from timing and memory qualification. Native APIs do not establish physical audible output.',
        ]
      : []),
    ...(memoryProfile
      ? [
          'Forced GC and heap/DOM observations perturb the browser. This whole run is excluded from timing qualification. No Memory.prepareForLeakDetection, worker termination or cache retirement is used.',
        ]
      : []),
    ...(cpuProfile
      ? [
          'CDP CPU sampling perturbs this whole run, including menus, preparation and play. All timing gates are excluded. The separate profile is capped at five minutes and retained on failure where the browser can return it.',
        ]
      : []),
    ...(fixtureAccess || mirrored
      ? [
          'Playwright routing disables HTTP cache. This is a fixture/network-transport run, not warm-cache qualification.',
        ]
      : []),
    ...(mirrored
      ? [
          'Original origin is preserved. All manifest-admitted deployment paths use local transport, including authoring imports. Missing deployment paths are blocked; only the explicit sibling soundtrack publication may use the live public origin. Policy is unchanged.',
        ]
      : []),
    ...(scenario.kind === 'recovery'
      ? [
          'Synthetic lifecycle/Canvas events test application handlers only; they do not lose or restore a native context.',
        ]
      : []),
  ],
  actions: [],
  snapshots: [],
  uploads: [],
  pageErrors: [],
  pageErrorWitnesses: [],
  failedResponses: [],
  externalCadenceCalibration: null,
  startupCadenceObservations: [],
  failure: null,
};
if (readinessOptions) {
  report.readinessPilot = {
    protocol: readinessOptions.protocol,
    performanceQualification: false,
    startupObservation:
      'Immediate partial observation; the optional startup-sample wait is omitted only for this correctness pilot.',
    scope:
      readinessOptions.protocol === 'first-running-v1'
        ? 'Fixed external settled120 B and original first30 actions/raw gates are retained. This is not an equivalent ordinary timing comparator.'
        : readinessOptions.protocol === 'selected-font-cancel-v1'
          ? 'Fixed external settled120 B and raw gates are retained. One exact held native font response, public cancellation and explicit Start are correctness-only.'
          : 'Fixed external settled120 B and raw gates are retained. The short public Resume route is correctness-only, not an ordinary timing comparator.',
  };
}
const resumeReadiness = readinessOptions?.protocol.endsWith('-resume-v1') === true;
const resumeReplay = resumeReadiness
  ? readinessModule.createResumeReplayEvidence(readinessOptions.protocol)
  : null;
if (resumeReplay) report.readinessReplayEvidence = resumeReplay.report;
const replayIdentity = scenario.replayIdentity ? createQualificationReplayIdentity() : null;
if (replayIdentity) report.replayIdentity = replayIdentity.report;
await mkdir(dirname(resolve(output)), { recursive: true });
const hitchStore = hitchOptions
  ? hitchModule.createHitchJournalStore(output, undefined, {
      soloURL: url.href,
      preparationPolicy: hitchOptions.preparationPolicy,
      activeDocumentPolicy: hitchOptions.activeDocumentPolicy,
    })
  : null;
if (hitchStore) {
  report.hitchJournal = hitchStore.report;
  report.limitations.push(
    'Opt-in bounded individual hitch journal; native long tasks are feature-detected and unsupported/dropped observations remain explicit. Single binary export per document at existing non-running boundaries. Added observer overhead requires a separate matched measurement.',
  );
}
const snapshotStore = snapshotStorageOptions
  ? await (
      await import('./solo-qualification-snapshot-store.mjs')
    ).createQualificationSnapshotStore(output, snapshotStorageOptions)
  : null;
async function save() {
  if (snapshotStore) return snapshotStore.save(report);
  const target = resolve(output),
    temporary = target + '.partial';
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
  await rename(temporary, target);
}
await save();
let browser, context, page, deadline, nativeReplay, cdp, playwright, cpuRecorder, persistentOwner;
let activeAction = null;
let partialReplay = false;
let memorySnapshots = 0;
let journalCostDocuments = 0;
function beginHitchDocument(address, action) {
  if (!hitchStore) return;
  try {
    hitchStore.beginDocument({ url: address, action });
  } catch (error) {
    hitchStore.fail(error.message);
  }
}
async function configureHitchDocument() {
  if (!hitchStore) return;
  try {
    await page.evaluate(
      (allocation) => window.soloQualificationHitchJournal.configure(allocation),
      hitchStore.allocation(),
    );
  } catch (error) {
    hitchStore.fail(`Document configuration: ${error.message}`);
  }
}
async function sealHitchDocument(boundary) {
  if (!hitchStore) return;
  try {
    const result = await page.evaluate(() =>
      window.soloQualificationHitchJournal.seal(document.body?.dataset.flightState),
    );
    await hitchStore.retain(result, boundary);
    const after = await page.evaluate(() => window.soloQualificationHitchJournal.state());
    if (after.postSealActive) hitchStore.fail('Active work after the sealed public boundary');
  } catch (error) {
    hitchStore.fail(`Document export: ${error.message}`);
  }
}
async function profileMemory() {
  if (!memoryProfile) return undefined;
  if (memorySnapshots++ >= 64)
    return { status: 'unobserved-cap', reason: '64 pause-only profiles per run maximum.' };
  const read = async () => {
    const [heap, dom] = await Promise.all([
      cdp.send('Runtime.getHeapUsage'),
      cdp.send('Memory.getDOMCounters'),
    ]);
    return { heap, dom };
  };
  let timer;
  const result = { status: 'running', at: new Date().toISOString() };
  try {
    await Promise.race([
      (async () => {
        result.before = await read();
        await cdp.send('HeapProfiler.collectGarbage');
        result.after = await read();
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Pause-only memory profile exceeded10s')), 10000);
      }),
    ]);
    result.status = 'observed';
  } catch (error) {
    result.status = 'failed';
    result.error = String(error.stack ?? error);
  } finally {
    clearTimeout(timer);
  }
  result.method =
    'Pause-only HeapProfiler.collectGarbage between Runtime.getHeapUsage + Memory.getDOMCounters reads; owned resources are the adjacent application export.';
  return result;
}
try {
  playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
  const contextOptions = { ...display, reducedMotion: 'no-preference', serviceWorkers: 'block' };
  if (contextMode === 'persistent') {
    persistentOwner = createPersistentQualificationOwner({
      browserType: playwright.webkit,
      launchOptions: { headless: !flags.includes('--headed') },
      contextOptions,
    });
    report.environment.contextOwner = persistentOwner.report;
    ({ browser, context } = await persistentOwner.launch());
    report.limitations.push(
      'Explicit fresh persistent WebKit profile per observation; not physical Safari or a privacy-setting equivalence claim. Compare only with the same declared context mode.',
    );
  } else {
    browser = await playwright[engine].launch({
      ...(engine === 'chromium' ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
      headless: !flags.includes('--headed'),
    });
    context = await browser.newContext(contextOptions);
  }
  report.environment.browserVersion = browser.version();
  report.limitations.push(
    'Service workers are explicitly blocked for controlled online qualification; offline/update lifecycle is separate.',
  );
  page = await context.newPage();
  if (memoryProfile || cpuProfile || cpu !== 1) cdp = await context.newCDPSession(page);
  page.on('pageerror', (error) => {
    if (report.pageErrors.length < 100) {
      report.pageErrorWitnesses.push({
        errorIndex: report.pageErrors.length,
        observedAt: new Date().toISOString(),
        observedTopLevelURL: page.url().slice(0, 4096),
        action: activeAction,
        details: qualificationPageErrorDetails(error),
      });
      report.pageErrors.push(String(error.stack ?? error));
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && report.failedResponses.length < 100)
      report.failedResponses.push({ url: response.url(), status: response.status() });
  });
  if (selectedFontReadiness)
    selectedFontHold = readinessModule.createSelectedFontHold(url.href, {
      requestPolicy: readinessOptions.requestPolicy ?? 'single-v1',
    });
  if (mirrored || fixtureAccess || selectedFontReadiness)
    await page.route('**/*', async (route) => {
      if (selectedFontHold && (await selectedFontHold.handle(route))) return;
      const requested = new URL(route.request().url());
      const decision = mirror?.(requested.href);
      if (decision?.kind === 'blocked') {
        if (report.failedResponses.length < 100)
          report.failedResponses.push({ url: requested.href, blocked: decision.reason });
        return route.abort('blockedbyclient');
      }
      const mapped = decision?.kind === 'local' ? decision.url : null;
      const entry =
        requested.origin === url.origin && route.request().resourceType() === 'document';
      if (!mapped && !(entry && fixtureAccess && !mirrored)) return route.continue();
      const response = await route.fetch(mapped ? { url: mapped } : {});
      if (entry)
        assert.equal(
          response.headers()['content-security-policy'],
          PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
          'Exact production CSP required',
        );
      if (!(entry && fixtureAccess)) return route.fulfill({ response });
      const body = (await response.text())
        .replace(
          /(name="revealline-access-salt"\s+content=")[^"]+/,
          '$1' + Buffer.from('performance-fixture').toString('base64url'),
        )
        .replace(
          /(name="revealline-access-verifier"\s+content=")[^"]+/,
          '$1' +
            pbkdf2Sync('fixture-password', 'performance-fixture', 150000, 32, 'sha256').toString(
              'base64url',
            ),
        );
      await route.fulfill({ response, body });
    });
  if (readinessOptions) {
    const { observeReadinessGpu } = await import('./solo-readiness-gpu.mjs');
    report.environment.graphicsCapability = await observeReadinessGpu(browser, engine);
    await save();
    assert(
      report.environment.graphicsCapability.canProceed,
      'Readiness graphics setup failed or its session did not settle; calibration not started',
    );
  }
  if (cpu !== 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (workProbe) {
    assert.equal(page.url(), 'about:blank', 'Cadence must precede every game request');
    await page.bringToFront();
    if (cadenceProtocol === 'settled120') {
      const expected = { ...display.viewport, dpr: display.deviceScaleFactor };
      report.blankViewportFixture = await page.evaluate(prepareCadenceViewport, expected);
      await page.waitForFunction(
        ({ width, height, dpr }) =>
          window.innerWidth === width &&
          window.innerHeight === height &&
          window.devicePixelRatio === dpr,
        expected,
        { timeout: 2000 },
      );
      report.externalCadenceCalibration = calibrateSettledCadence(
        await page.evaluate(observeSettledCadence, { expected }),
      );
    } else
      report.externalCadenceCalibration = calibrateLowWorkCadence(
        await page.evaluate(observeLowWorkCadence, { timeoutMs: 5000 }),
      );
    await save();
  }
  if (audioProof) await page.addInitScript(installAudioProof, audioOptions);
  if (qualityOptions)
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) qualityDocuments++;
    });
  if (readinessOptions)
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) readinessDocuments++;
    });
  const observationInitScript = `window.soloQualificationReadiness = ${readPrePlayReadiness.toString()};
     window.soloQualificationIntervalClock = ${createRafIntervalClock.toString()};
     window.soloQualificationFrozenCadence = ${frozenExternalCadence.toString()};`;
  if (journalCostOptions)
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) journalCostDocuments++;
    });
  if (!hitchStore && !journalCostOptions) await page.addInitScript(observationInitScript);
  function addQualificationProbe(install, options) {
    const cost = options.journalCost === true,
      readiness = options.readinessProbe === true,
      quality = options.qualityObservation === true;
    if (!hitchStore && !cost && !readiness && !quality) return page.addInitScript(install, options);
    // Ordering across separate addInitScript calls is unspecified. Construct all
    // opted-in dependencies and the probe in one synchronous installation.
    return page.addInitScript(`if (window.top === window) {
${observationInitScript}
${quality ? `window.soloQualificationCreateSubmittedTierObservation = ${createSubmittedTierObservation.toString()};` : ''}
${readiness ? `window.soloQualificationCreateReadinessProbe = ${readinessModule.createBrowserReadinessProbe.toString()};` : ''}
${cost ? journalCostModule.journalCostInitScript() : ''}
${hitchStore ? hitchModule.hitchJournalInitScript({ costProbe: cost }) : ''}
(${install.toString()})(${JSON.stringify(options)});
}`);
  }
  await addQualificationProbe(
    ({
      bounds,
      workProbe,
      externalCadenceCalibration,
      hitchJournal,
      journalCost,
      readinessProbe,
      readinessProtocol,
      qualityObservation,
    }) => {
      const cost = journalCost ? window.soloQualificationJournalCost : null;
      const quality = qualityObservation
        ? window.soloQualificationCreateSubmittedTierObservation()
        : null;
      const phases = ['boot', 'briefing', 'running', 'paused', 'result', 'picture', 'other'];
      const counts = phases.map(() => new Float64Array(bounds.length));
      const totals = new Float64Array(phases.length * 5),
        tail = new Float64Array(256 * 4);
      let observedGame, phaser, costScene;
      const workBounds = [
        0.25,
        0.5,
        1,
        2,
        4,
        6,
        8.34,
        10,
        12,
        16.67,
        20,
        25,
        33.34,
        50,
        100,
        250,
        null,
      ];
      const workWidth = workBounds.length + 3;
      const workTotals = new Float64Array(phases.length * workWidth),
        workRecent = new Float64Array(5000 * 2);
      const missed = new Float64Array(phases.length * 3),
        calibrationSamples = new Float64Array(30);
      let workStarted,
        workCount = 0,
        workSubscribed = false,
        calibrating = false,
        calibrationCount = 0,
        startupObservation = null;
      const { calibration, baselineMs: frameBudget } = window.soloQualificationFrozenCadence(
        externalCadenceCalibration,
      );
      const readyState = () => window.soloQualificationReadiness();
      // Capture the constructed owner once. Never wrap update/draw, evaluate
      // drawOptions, or recompute presentation ownership during active play.
      Object.defineProperty(window, 'Phaser', {
        configurable: true,
        get: () => phaser,
        set(value) {
          phaser = value;
          const Game = value.Game;
          value.Game = class extends Game {
            constructor(...args) {
              super(...args);
              observedGame = this;
            }
          };
        },
      });
      const readiness = readinessProbe
        ? window.soloQualificationCreateReadinessProbe(
            () => {
              const scenes =
                observedGame?.scene?.scenes?.filter((scene) => scene.lastPaint?.run) ?? [];
              if (scenes.length !== 1) return null;
              return scenes[0];
            },
            window,
            readinessProtocol,
          )
        : null;
      const intervalClock = window.soloQualificationIntervalClock(performance.now());
      let phase = 0,
        previousPhase = 0,
        journalPrevious = null,
        tailCount = 0;
      const audio = {
        oscillatorStarts: 0,
        sourceStarts: 0,
        sourceStartFailures: 0,
        mediaPlayRequests: 0,
        mediaPlayResolved: 0,
        mediaPlayRejected: 0,
      };
      if (typeof AudioBufferSourceNode !== 'undefined') {
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          try {
            const result = start.apply(this, args);
            audio.sourceStarts++;
            return result;
          } catch (error) {
            audio.sourceStartFailures++;
            throw error;
          }
        };
      }
      if (typeof OscillatorNode !== 'undefined') {
        const start = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...args) {
          const result = start.apply(this, args);
          audio.oscillatorStarts++;
          return result;
        };
      }
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        audio.mediaPlayRequests++;
        const result = play.apply(this, args);
        result?.then(
          () => audio.mediaPlayResolved++,
          () => audio.mediaPlayRejected++,
        );
        return result;
      };
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          const update = () => {
            const n = phases.indexOf(document.body.dataset.flightState);
            phase = n < 0 ? 6 : n;
            if (readiness) readiness.phase(document.body.dataset.flightState);
            if (cost) {
              cost.begin(2);
              cost.phase(phase);
            }
            if (hitchJournal) window.soloQualificationHitchJournal.phase(phase);
            if (cost) cost.end();
          };
          update();
          new MutationObserver(update).observe(document.body, {
            attributes: true,
            attributeFilter: ['data-flight-state'],
          });
        },
        { once: true },
      );
      function frame(now) {
        const dt = intervalClock.observe(now);
        if (dt === null) {
          if (cost) cost.begin(0);
          if (hitchJournal) {
            window.soloQualificationHitchJournal.first(now, performance.now());
            journalPrevious = now;
          }
          if (cost) cost.end();
          previousPhase = phase;
          requestAnimationFrame(frame);
          return;
        }
        const previous = now - dt,
          offset = previousPhase * 5;
        if (cost) cost.begin(1);
        if (hitchJournal) {
          window.soloQualificationHitchJournal.frame(journalPrevious, now, previousPhase, phase);
          journalPrevious = now;
        }
        if (cost) cost.end();
        let bucket = 0;
        while (bounds[bucket] !== null && dt > bounds[bucket]) bucket++;
        counts[previousPhase][bucket]++;
        totals[offset]++;
        totals[offset + 1] += dt;
        totals[offset + 2] = Math.max(totals[offset + 2], dt);
        if (frameBudget !== null) {
          const missedOffset = previousPhase * 3;
          const gaps = Math.max(0, Math.round(dt / frameBudget) - 1);
          missed[missedOffset] += gaps;
          missed[missedOffset + 2] = gaps ? missed[missedOffset + 2] + gaps : 0;
          missed[missedOffset + 1] = Math.max(missed[missedOffset + 1], missed[missedOffset + 2]);
        }
        if (calibrating && calibrationCount < 30) calibrationSamples[calibrationCount++] = dt;
        if (dt >= 50) totals[offset + 3]++;
        if (dt >= 100) totals[offset + 4]++;
        if (dt >= 50) {
          const index = (tailCount++ % 256) * 4;
          tail[index] = previous;
          tail[index + 1] = now;
          tail[index + 2] = previousPhase;
          tail[index + 3] = phase;
        }
        previousPhase = phase;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      window.soloQualificationProbe = {
        startApplicationProbe() {
          if (!workProbe || workSubscribed) return;
          if (!observedGame)
            throw new Error('Phaser owner unavailable for independent observation');
          if (cost) {
            const scenes =
              observedGame.scene?.scenes?.filter((scene) => Object.hasOwn(scene, 'lastPaint')) ??
              [];
            if (scenes.length === 1) costScene = scenes[0];
          }
          if (quality) {
            const scenes = observedGame.scene?.scenes;
            const owners =
              Array.isArray(scenes) && scenes.length <= 64
                ? scenes.filter((scene) => Object.hasOwn(scene, 'lastPaint'))
                : [];
            quality.bind(owners.length === 1 ? owners[0] : null);
          }
          workSubscribed = true;
          if (cost) cost.begin(7);
          if (hitchJournal) window.soloQualificationHitchJournal.subscribe(performance.now());
          if (cost) cost.end();
          observedGame.events.on(window.Phaser.Core.Events.PRE_STEP, () => {
            workStarted = performance.now();
            if (cost) {
              cost.beginWork(workStarted);
              cost.begin(3);
            }
            if (hitchJournal) window.soloQualificationHitchJournal.beginWork(workStarted, phase);
            if (cost) cost.end();
          });
          observedGame.events.on(window.Phaser.Core.Events.POST_RENDER, () => {
            if (workStarted === undefined) return;
            const workEnded = performance.now(),
              elapsed = workEnded - workStarted;
            if (quality) quality.observe(workEnded, phase);
            if (cost) {
              cost.endWork(workEnded, costScene?.lastPaint?.quality);
              cost.begin(4);
            }
            if (hitchJournal) window.soloQualificationHitchJournal.endWork(workEnded, phase);
            if (cost) cost.end();
            workStarted = undefined;
            const offset = phase * workWidth;
            workTotals[offset]++;
            workTotals[offset + 1] += elapsed;
            workTotals[offset + 2] = Math.max(workTotals[offset + 2], elapsed);
            let bucket = 0;
            while (workBounds[bucket] !== null && elapsed > workBounds[bucket]) bucket++;
            workTotals[offset + 3 + bucket]++;
            const sample = (workCount++ % 5000) * 2;
            workRecent[sample] = elapsed;
            workRecent[sample + 1] = phase;
          });
          calibrating = true;
        },
        calibrationProgress: () => ({
          count: calibrationCount,
          samples: Array.from(calibrationSamples.subarray(0, calibrationCount)),
          state: readyState(),
        }),
        finishStartupObservation(value) {
          if (startupObservation)
            throw new Error('A document may only accept one title-ready startup observation');
          calibrating = false;
          startupObservation = value;
        },
        presentation: () => ({
          atMs: performance.now(),
          phase: document.body?.dataset.flightState,
          submittedTier:
            observedGame?.scene?.scenes?.find((scene) => scene.lastPaint)?.lastPaint?.quality ??
            null,
          scope:
            'Retained last submitted paint record only; sparse action-boundary observations do not establish the tier between samples.',
        }),
        readinessBoundary: (label) => readiness?.boundary(label),
        export: () => ({
          ...(readiness ? { readiness: readiness.export() } : {}),
          ...(quality ? { submittedTiers: quality.export() } : {}),
          firstRafCallback: intervalClock.snapshot(),
          phases,
          bounds,
          counts: counts.map((x) => Array.from(x)),
          totals: Array.from(totals),
          tailCount,
          tail: Array.from(tail.subarray(0, Math.min(256, tailCount) * 4)),
          audio: { ...audio },
          calibration,
          startupObservation,
          missed: Array.from(missed),
          work: workProbe
            ? {
                bounds: workBounds,
                width: workWidth,
                totals: Array.from(workTotals),
                count: workCount,
                retainedCount: Math.min(5000, workCount),
                omittedCount: Math.max(0, workCount - 5000),
                recent: Array.from(workRecent.subarray(0, Math.min(5000, workCount) * 2)),
              }
            : null,
          ...(hitchJournal ? { hitchJournal: window.soloQualificationHitchJournal.state() } : {}),
          ...(cost ? { journalCost: cost.state() } : {}),
          now: performance.now(),
        }),
      };
    },
    {
      bounds: FRAME_BOUNDS,
      workProbe,
      externalCadenceCalibration: report.externalCadenceCalibration,
      hitchJournal: Boolean(hitchStore),
      journalCost: Boolean(journalCostOptions),
      readinessProbe: Boolean(readinessOptions),
      readinessProtocol: readinessOptions?.protocol,
      qualityObservation: Boolean(qualityOptions),
    },
  );
  if (cpuProfile) {
    cpuRecorder = createQualificationCpuProfile(cdp, {
      file: resolve(output) + '.cpuprofile',
      maximumMs: scenario.timeoutMs,
      onLimit: async () => {
        report.scenarioStatus = 'fail';
        report.cpuProfileLimit = 'Bounded profile duration reached; partial recording retained.';
        process.exitCode = 1;
        await context?.close().catch(() => {});
      },
    });
    report.cpuProfile = cpuRecorder.report;
    await cpuRecorder.start();
  }
  const entryURL = scenario.entryPath ? new URL(scenario.entryPath, url) : url;
  beginHitchDocument(entryURL.href, 'initial');
  const response = await page.goto(entryURL.href, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  if (hitchStore) await configureHitchDocument();
  assert.equal(
    response.headers()['content-security-policy'],
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
    'Exact production CSP required',
  );
  report.csp = response.headers()['content-security-policy'];
  report.environment.documentCacheControl = response.headers()['cache-control'] ?? null;
  if (scenario.cacheMode === 'warm-http-reload') {
    assert(
      !/\bno-store\b/i.test(report.environment.documentCacheControl ?? ''),
      'Warm reload document is served with no-store',
    );
    report.limitations.push(
      'Warm HTTP reload attempt in the same context without browser routing; cache eligibility is preserved, but actual body cache hits are not inferred from reload alone.',
    );
  }
  if (
    (fixtureAccess || serverFixtureAccess) &&
    (await page.locator('input[name=password]').isVisible())
  ) {
    await page.locator('input[name=password]').fill('fixture-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  if (scenario.readySelector) {
    await page.locator(scenario.readySelector).waitFor({ state: 'visible', timeout: 120000 });
    if (scenario.readyHiddenSelector)
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.hidden === true,
        scenario.readyHiddenSelector,
        { timeout: 120000 },
      );
    await waitQualificationControl(page, scenario.readySelector, 120000);
  } else
    await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
      timeout: 120000,
    });
  if (report.sourceRevision || needsReplayIdentity) {
    const identityURL = new URL('build-info.json', url).href;
    const identity = await page.evaluate(async (address) => {
      const response = await fetch(address, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Generated build identity unavailable: ${response.status}`);
      return response.text();
    }, identityURL);
    assert(
      Buffer.byteLength(identity) <= 65536,
      'Build identity exceeds its bounded metadata size',
    );
    const parsed = JSON.parse(identity);
    report.buildIdentity = {
      url: identityURL,
      sourceRevision: parsed.sourceRevision,
      version: parsed.version,
      sha256: createHash('sha256').update(identity).digest('hex'),
    };
    assert(/^[0-9a-f]{40}$/.test(parsed.sourceRevision), 'Generated full source identity required');
    if (report.sourceRevision)
      assert.equal(
        parsed.sourceRevision,
        report.sourceRevision,
        'Generated build identity does not match requested revision',
      );
  }
  async function prepareObservation(label) {
    if (!workProbe) return;
    try {
      await page.waitForFunction(
        () => window.soloQualificationProbe?.calibrationProgress().state.ready,
        null,
        { timeout: 60000 },
      );
    } catch (error) {
      const progress = await page.evaluate(() =>
        window.soloQualificationProbe?.calibrationProgress(),
      );
      report.startupCadenceObservations.push({
        label,
        url: page.url(),
        role: 'startup-only; never used for external B',
        ...calibrateReadyCadence(progress?.samples ?? [], progress?.state),
        deadlineFailure: String(error.message),
      });
      throw error;
    }
    await page.evaluate(() => window.soloQualificationProbe.startApplicationProbe());
    let deadlineFailure = null;
    try {
      if (!readinessOptions)
        await page.waitForFunction(
          () => window.soloQualificationProbe.calibrationProgress().count === 30,
          null,
          { timeout: 5000 },
        );
    } catch (error) {
      deadlineFailure = String(error.message);
    }
    const progress = await page.evaluate(() => window.soloQualificationProbe.calibrationProgress());
    const startupObservation = {
      ...calibrateReadyCadence(progress.samples, progress.state),
      role: 'startup-only; never used for external B',
    };
    await page.evaluate(
      (value) => window.soloQualificationProbe.finishStartupObservation(value),
      startupObservation,
    );
    report.startupCadenceObservations.push({
      label,
      url: page.url(),
      ...startupObservation,
      deadlineFailure,
      ...(readinessOptions
        ? { pilotStartupWait: 'omitted; immediate partial samples retained' }
        : {}),
    });
  }
  if (!scenario.readySelector) await prepareObservation('initial-ready');
  report.readyAt = new Date().toISOString();
  report.environment.userAgent = await page.evaluate(() => navigator.userAgent);
  report.environment.initialDisplay = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    maxTouchPoints: navigator.maxTouchPoints,
  }));
  deadline = Date.now() + scenario.timeoutMs;
  const remaining = (action) => {
    const time = Math.min(action.timeoutMs ?? 30000, deadline - Date.now());
    assert(time > 0, 'Scenario deadline exceeded');
    return time;
  };
  async function execute(actions, prefix = '') {
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index],
        path = `${prefix}${index}`,
        record = {
          path,
          type: action.type,
          label: action.label ?? null,
          startedAt: new Date().toISOString(),
          status: 'running',
        };
      report.actions.push(record);
      const previousAction = activeAction;
      activeAction = { path, type: action.type };
      const timeout = remaining(action),
        locator = action.selector ? page.locator(action.selector) : null;
      try {
        if (action.type === 'repeat') {
          const started = Date.now();
          let completed = 0;
          for (; completed < action.count; completed++) {
            await execute(action.actions, `${path}.${completed}.`);
            if (action.atLeastMs !== undefined && Date.now() - started >= action.atLeastMs) {
              completed++;
              break;
            }
          }
          record.iterations = completed;
          record.elapsedMs = Date.now() - started;
          assert(
            action.atLeastMs === undefined || record.elapsedMs >= action.atLeastMs,
            'Repeat cap reached before requested duration',
          );
        } else if (action.type === 'click') {
          if (action.optional && !(await locator.isVisible()))
            record.status = 'skipped-not-visible';
          else await locator.click({ timeout });
        } else if (action.type === 'reload') {
          if (hitchStore) await sealHitchDocument(`before-reload-${path}`);
          if (hitchStore) beginHitchDocument(page.url(), `reload-${path}`);
          await page.reload({ waitUntil: 'domcontentloaded', timeout });
          if (hitchStore) await configureHitchDocument();
          if (
            (fixtureAccess || serverFixtureAccess) &&
            (await page.locator('input[name=password]').isVisible())
          ) {
            await page.locator('input[name=password]').fill('fixture-password');
            await page.getByRole('button', { name: 'Unlock', exact: true }).click();
          }
          await page.waitForFunction(
            () => document.documentElement.dataset.bootState === 'ready',
            null,
            { timeout },
          );
          await prepareObservation(`reload-${path}`);
        } else if (action.type === 'follow') {
          const followDeadline = Date.now() + timeout;
          const followRemaining = () => {
            const value = followDeadline - Date.now();
            assert(value > 0, 'Follow action deadline exceeded');
            return value;
          };
          record.navigation = {
            mode: 'same-page-prepared-url; does not activate the link or its popup target',
            from: page.url(),
          };
          if (action.preparationStatusSelector) {
            record.preparation = {};
            await waitQualificationPreparation(
              page,
              action.preparationStatusSelector,
              followRemaining(),
              record.preparation,
            );
          }
          const href = await locator.getAttribute('href', { timeout: followRemaining() });
          assert(href, 'Missing prepared UI link');
          const destination = new URL(href, page.url());
          assert.equal(
            destination.origin,
            url.origin,
            'Qualification navigation must stay in the admitted origin',
          );
          destination.searchParams.set('performance', '1');
          record.navigation.destination = destination.href;
          if (hitchStore) await sealHitchDocument(`before-follow-${path}`);
          beginHitchDocument(destination.href, `follow-${path}`);
          await page.goto(destination.href, {
            waitUntil: 'domcontentloaded',
            timeout: followRemaining(),
          });
          if (hitchStore) await configureHitchDocument();
          if (
            (fixtureAccess || serverFixtureAccess) &&
            (await page.locator('input[name=password]').isVisible())
          ) {
            await page
              .locator('input[name=password]')
              .fill('fixture-password', { timeout: followRemaining() });
            await page
              .getByRole('button', { name: 'Unlock', exact: true })
              .click({ timeout: followRemaining() });
          }
          await page.waitForFunction(
            () => document.documentElement.dataset.bootState === 'ready',
            null,
            { timeout: followRemaining() },
          );
          await prepareObservation(`follow-${path}`);
        } else if (action.type === 'select') await locator.selectOption(action.value, { timeout });
        else if (action.type === 'check') {
          await locator.setChecked(action.value, { timeout });
          if (qualityOptions && action.selector === '#settings-reduced-effects') {
            record.publicEffects = await locator.evaluate((control) => ({
              checked: control.checked,
              effects: document.body.dataset.effects,
              phase: document.body.dataset.flightState,
              systemReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            }));
            assert.equal(record.publicEffects.checked, qualityOptions.tier === 'reduced');
            assert.equal(record.publicEffects.effects, qualityOptions.tier);
            assert.notEqual(record.publicEffects.phase, 'running');
          }
        } else if (action.type === 'fill') await locator.fill(action.value, { timeout });
        else if (action.type === 'upload') {
          const file = resolve(dirname(resolve(scenarioPath)), action.file),
            data = await readFile(file);
          report.uploads.push({
            path: action.file,
            bytes: data.length,
            sha256: createHash('sha256').update(data).digest('hex'),
          });
          await waitQualificationControl(page, action.selector, timeout);
          record.publicUpload = await locator.evaluate((control) => ({
            loadingIndicatorHidden:
              control.ownerDocument.getElementById('boot-status')?.hidden ?? null,
            inertAncestor: Boolean(control.closest('[inert]')),
            busyAncestor: Boolean(control.closest('[aria-busy="true"]')),
            selectedFilesBefore: control.files?.length ?? null,
            changeHandlerPresent: typeof control.onchange === 'function',
            toolState: control.ownerDocument.documentElement.dataset.toolState ?? null,
            publicStatus:
              control.ownerDocument.getElementById('editor-status')?.textContent ?? null,
          }));
          await beginQualificationUploadWitness(page, action.selector);
          try {
            await locator.setInputFiles(file, { timeout });
          } finally {
            record.publicUpload.events = await page.evaluate(() => {
              const events = window.soloQualificationUploadWitness?.dispose() ?? [];
              delete window.soloQualificationUploadWitness;
              return events;
            });
          }
          record.publicUpload.selectedFilesAfter = await locator.evaluate(
            (control) => control.files?.length ?? null,
          );
          if (action.acceptedLevelSelector) {
            const submitted = JSON.parse(data).level;
            assert(submitted, 'Accepted-level check requires a full scenario fixture');
            const control = page.locator(action.acceptedLevelSelector);
            if (!(await control.isVisible()))
              await page
                .locator(`details:has(${action.acceptedLevelSelector}) > summary`)
                .click({ timeout });
            try {
              await page.waitForFunction(
                ({ selector, expected }) => {
                  const canonical = (value) =>
                    Array.isArray(value)
                      ? `[${value.map(canonical).join(',')}]`
                      : value && typeof value === 'object'
                        ? `{${Object.keys(value)
                            .sort()
                            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
                            .join(',')}}`
                        : JSON.stringify(value);
                  const control = document.querySelector(selector);
                  if (!control || control.closest('[inert], [aria-busy="true"]')) return false;
                  try {
                    return canonical(JSON.parse(control.value)) === canonical(expected);
                  } catch {
                    return false;
                  }
                },
                { selector: action.acceptedLevelSelector, expected: submitted },
                { timeout },
              );
              record.acceptedConfiguration = {
                status: 'match',
                levelId: submitted.id,
                scope:
                  'Public editor JSON matches every submitted level field before Preview; native replay acceptance remains independently required.',
              };
            } catch (error) {
              record.acceptedConfiguration = {
                status: 'mismatch-or-unavailable',
                publicJSON: (await control.inputValue().catch(() => '')).slice(0, 65536),
                publicStatus: await page
                  .locator('#editor-status')
                  .textContent()
                  .catch(() => null),
              };
              throw error;
            }
          }
        } else if (action.type === 'key') {
          assert(
            action.ms <= deadline - Date.now(),
            'Key duration exceeds remaining scenario budget',
          );
          await page.keyboard.down(action.key);
          try {
            await page.waitForTimeout(action.ms);
          } finally {
            await page.keyboard.up(action.key);
          }
        } else if (action.type === 'result') {
          const end = Date.now() + timeout;
          let observed = false;
          while (Date.now() < end) {
            const overlay = page.locator('#game-overlay');
            if (await overlay.isVisible()) {
              const kind = await overlay.getAttribute('data-kind');
              if (['won', 'lost'].includes(kind)) {
                record.outcome = kind;
                assert.equal(kind, action.outcome, 'Unexpected public result');
                observed = true;
                break;
              }
            }
            for (const selector of ['#skip-celebration', '#show-result']) {
              const control = page.locator(selector);
              if (await control.isVisible())
                await control.click({ timeout: Math.max(1, end - Date.now()) });
            }
            await page.waitForTimeout(Math.min(100, Math.max(1, end - Date.now())));
          }
          assert(observed, 'Expected public result did not become visible before deadline');
        } else if (action.type === 'audio-ready') {
          assert.notEqual(
            await page.locator('body').getAttribute('data-flight-state'),
            'running',
            'Audio preparation wait requires a paused boundary',
          );
          if (audioProof) {
            await page.waitForFunction(
              (hashes) => {
                if (document.body.dataset.flightState === 'running')
                  throw new Error('Audio proof readiness wait entered active play');
                return window.soloAudioProof.recordingsReady(hashes);
              },
              action.recordedHashes,
              { timeout },
            );
            record.readiness = 'exact-encoded-recordings-decoded';
          } else {
            assert(action.fallbackMs <= deadline - Date.now());
            await page.waitForTimeout(action.fallbackMs);
            record.readiness = 'fixed-preparation-wait-identity-unobserved';
          }
        } else if (action.type === 'wait') {
          if (action.phase) {
            await page.waitForFunction(
              (value) => document.body.dataset.flightState === value,
              action.phase,
              { timeout },
            );
            if (action.phase === 'running')
              record.firstActivePresentation = await page.evaluate(() =>
                window.soloQualificationProbe.presentation(),
              );
          } else {
            assert(action.ms <= deadline - Date.now());
            const windowIndex =
              audioProof && action.label
                ? await page.evaluate(
                    (label) => window.soloAudioProof.beginWindow(label),
                    action.label,
                  )
                : null;
            try {
              await page.waitForTimeout(action.ms);
            } finally {
              if (windowIndex !== null)
                await page.evaluate((index) => window.soloAudioProof.endWindow(index), windowIndex);
            }
          }
        } else if (action.type === 'expect') {
          await locator.waitFor({ state: 'visible', timeout });
          if (action.contains !== undefined) {
            record.actual = (await locator.textContent()).trim();
            assert(
              record.actual.includes(action.contains),
              'Required public text fragment missing',
            );
          } else if (action.attribute) {
            record.actual = await locator.getAttribute(action.attribute);
            assert.equal(record.actual, action.value);
          } else if (action.value !== undefined) {
            record.actual = (await locator.textContent()).trim();
            assert.equal(record.actual, action.value);
          } else record.actual = 'visible';
        } else if (action.type === 'resize') {
          const resized = qualificationDisplayOptions([
            `--viewport=${action.width}x${action.height}`,
            `--dpr=${display.deviceScaleFactor}`,
          ]);
          await page.setViewportSize(resized.viewport);
        } else if (action.type === 'fault')
          await page.evaluate(({ selector, event }) => {
            const target = selector ? document.querySelector(selector) : window;
            if (!target) throw new Error('Missing injected-event target');
            target.dispatchEvent(
              new Event(
                { 'canvas-loss': 'contextlost', 'canvas-restore': 'contextrestored' }[event] ??
                  event,
              ),
            );
          }, action);
        else if (action.type === 'exportReplay') {
          const text = await readPublicQualificationReplay(page, timeout);
          nativeReplay = text;
          record.bytes = Buffer.byteLength(text);
          if (replayIdentity) record.identity = replayIdentity.observe(text);
          if (resumeReplay) record.readinessIdentity = resumeReplay.observe(action.label, text);
        } else if (action.type === 'snapshot') {
          const snapshot = await page.evaluate(() => {
            const phase = document.body.dataset.flightState;
            if (phase === 'running')
              throw new Error('Resource snapshots require an explicit paused/result boundary');
            return {
              phase,
              application: window.RevealLineSoloPerformance?.export() ?? null,
              presentation: window.soloQualificationProbe.presentation(),
              probe: window.soloQualificationProbe.export(),
              audioProof: window.soloAudioProof?.export() ?? null,
              hud: Object.fromEntries(
                ['coverage', 'lives', 'time', 'score', 'run-message'].map((id) => [
                  id,
                  document.getElementById(id)?.textContent ?? null,
                ]),
              ),
            };
          });
          assert(
            snapshot.application || baselineRuntime,
            'Required application diagnostics unavailable',
          );
          if (report.sourceRevision && snapshot.application)
            assert.equal(
              snapshot.application.sourceRevision,
              report.sourceRevision,
              'Observed generated runtime does not match the declared source revision',
            );
          const row = {
            group: action.group,
            action: path,
            ...snapshot,
            qualityPolicy: snapshot.application?.quality ?? null,
            internalDiagnosticStatus: snapshot.application ? 'observed' : 'unavailable-baseline',
          };
          report.snapshots.push(row);
          if (qualityOptions) qualificationQualityAudioBoundary(row, report.snapshots.length - 1);
          row.memory = await profileMemory();
          assert(
            row.memory?.status !== 'failed',
            'Pause-only memory profile failed; partial application data retained',
          );
        }
        if (selectedFontHold) {
          if (action.label === 'selected-theme') await selectedFontHold.waitUntilHeld();
          if (action.label === 'public-cancelled') {
            const witness = await page.evaluate(
              () => window.soloQualificationProbe.export().readiness,
            );
            readinessModule.assertSelectedFontCancelled(witness, readinessOptions.protocol);
            selectedFontHold.releaseAfterPublicCancellation();
          }
          if (action.label === 'no-automatic-start-after-release')
            await page.evaluate(() =>
              window.soloQualificationProbe.readinessBoundary('font-release-no-start'),
            );
        }
        if (record.status === 'running') record.status = 'pass';
      } catch (error) {
        record.status = 'fail';
        record.failure = String(error.stack ?? error);
        throw error;
      } finally {
        record.completedAt = new Date().toISOString();
        activeAction = previousAction;
      }
      // Serialize only between actions, never in a browser animation callback.
      if (
        audioProof &&
        action.type === 'expect' &&
        action.selector === '#soundtrack-use-selection:enabled'
      ) {
        // Preserve import feedback before subsequent listening controls replace it.
        record.audioPublicContext = await page.evaluate(readAudioFailureContext);
      }
      if (action.type === 'snapshot' || action.type === 'repeat') await save();
    }
  }
  await execute(scenario.actions);
  replayIdentity?.finish();
  resumeReplay?.finish();
  if (scenario.expectAudio) {
    const probe = await page.evaluate(() => window.soloQualificationProbe.export());
    const audio = report.snapshots.at(-1)?.application?.audio;
    report.audioCheck = { observed: probe.audio, master: audio, requirement: scenario.expectAudio };
    if (audio || !baselineRuntime) {
      assert.equal(
        audio?.muted,
        false,
        'Expected an unmuted master at the final paused checkpoint',
      );
      assert(audio.volume > 0, 'Expected nonzero master volume');
    } else report.audioCheck.internalMasterState = 'unobserved-baseline';
    assert(
      probe.audio.sourceStarts + probe.audio.oscillatorStarts + probe.audio.mediaPlayResolved >=
        scenario.expectAudio.nativeStartsAtLeast,
      'No successful native audio-source starts were observed',
    );
  }
  report.resources = resourceStability(report.snapshots, scenario.resourceRules);
  assert(
    !report.resources.some(
      (row) => row.status === 'fail' || (!baselineRuntime && row.status !== 'pass'),
    ),
    'Resource stability rule failed or was unobserved',
  );
  assert.equal(report.pageErrors.length, 0, 'Uncaught page errors were observed');
  report.scenarioStatus = 'pass';
} catch (error) {
  report.scenarioStatus = 'fail';
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (selectedFontHold) {
    await selectedFontHold.close();
    report.selectedFontTransport = selectedFontHold.snapshot();
    if (report.selectedFontTransport.status !== 'complete') {
      report.scenarioStatus = 'fail';
      report.selectedFontFailure =
        'Original selected-font response did not complete within its owned fault protocol.';
      process.exitCode = 1;
    }
  }
  if (cpuRecorder) {
    await cpuRecorder.stop(report.scenarioStatus === 'fail' ? 'scenario-failure' : 'actions-ended');
    if (report.cpuProfile.status !== 'retained' || report.cpuProfile.limitReached) {
      report.scenarioStatus = 'fail';
      report.cpuProfileFailure =
        'Complete bounded CPU recording unavailable; partial evidence retained.';
      process.exitCode = 1;
    }
  }
  if (page && !page.isClosed()) {
    try {
      if (report.scenarioStatus === 'fail') {
        if (audioProof) {
          try {
            report.audioFailureContext = await page.evaluate(readAudioFailureContext);
          } catch (error) {
            report.audioFailureContextError = String(error.stack ?? error);
          }
        }
        try {
          const beforeStop = await page.locator('body').getAttribute('data-flight-state');
          report.failureCleanup = { beforeStop, inducedPause: false };
          if (beforeStop === 'running') {
            report.failureCleanup.inducedPause = true;
            await page.keyboard.press('Escape');
            await page.waitForFunction(
              () => document.body.dataset.flightState !== 'running',
              null,
              { timeout: 5000 },
            );
          }
          const partial = await page.evaluate(() => {
            const phase = document.body.dataset.flightState;
            return {
              phase,
              application:
                phase !== 'running' ? (window.RevealLineSoloPerformance?.export() ?? null) : null,
              presentation: window.soloQualificationProbe?.presentation() ?? null,
              hud: Object.fromEntries(
                ['coverage', 'lives', 'time', 'score', 'run-message'].map((id) => [
                  id,
                  document.getElementById(id)?.textContent ?? null,
                ]),
              ),
            };
          });
          report.failureCleanup.afterStop = partial.phase;
          if (partial.application)
            report.snapshots.push({
              group: 'failed-attempt-partial',
              ...partial,
              qualityPolicy: partial.application.quality ?? null,
              harnessInducedBoundary: beforeStop === 'running',
              memory: await profileMemory(),
            });
          if (
            needsReplayIdentity &&
            !nativeReplay &&
            ['paused', 'result', 'picture'].includes(partial.phase)
          ) {
            report.failureReplayExport = {
              status: 'attempting',
              scope:
                'Public export of partial play after failure; original scenario failure remains.',
            };
            try {
              nativeReplay = await readPublicQualificationReplay(page, 10000);
              partialReplay = true;
              report.failureReplayExport.status = 'retained';
            } catch (error) {
              report.failureReplayExport.status = 'unavailable';
              report.failureReplayExport.failure = String(error.stack ?? error);
            }
          }
        } catch (error) {
          report.failureCleanupFailure = String(error.stack ?? error);
        }
      }
      if (hitchStore) await sealHitchDocument('final-existing-public-boundary');
      report.finalState = await page.evaluate(() => ({
        state: document.body?.dataset.flightState,
        boot: document.documentElement.dataset.bootState,
        readiness: window.soloQualificationProbe?.calibrationProgress().state ?? null,
        display: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          maxTouchPoints: navigator.maxTouchPoints,
        },
        probe: window.soloQualificationProbe?.export(),
        audioProof: window.soloAudioProof?.export() ?? null,
      }));
      if (journalCostOptions) {
        report.journalCost = await page.evaluate(() =>
          window.soloQualificationJournalCost.export(),
        );
        report.journalCost.journalEnabled = Boolean(hitchStore);
        report.journalCost.documents = journalCostDocuments;
        if (journalCostDocuments !== 1) report.journalCost.status = 'incomplete';
      }
      if (qualityOptions)
        report.qualityComparison = {
          ...qualityOptions,
          documents: qualityDocuments,
          observation: report.finalState?.probe?.submittedTiers ?? null,
        };
      const probe = report.finalState.probe;
      if (probe)
        report.cadence = probe.phases.map((phase, index) => ({
          phase,
          count: probe.totals[index * 5],
          totalMs: probe.totals[index * 5 + 1],
          maximumMs: probe.totals[index * 5 + 2],
          atLeast50ms: probe.totals[index * 5 + 3],
          atLeast100ms: probe.totals[index * 5 + 4],
          p95: quantileBound(probe.counts[index], 0.95),
          p99: quantileBound(probe.counts[index], 0.99),
        }));
    } catch (error) {
      report.finalReadFailure = String(error.message);
    }
  }
  report.completedAt = new Date().toISOString();
  report.environment.finalLoad = loadavg();
  await save();
  if (persistentOwner) {
    const cleanup = await persistentOwner.close();
    if (cleanup.status !== 'closed') {
      report.scenarioStatus = 'fail';
      report.contextCleanupFailure =
        'Persistent browser/profile cleanup is unconfirmed; exact profile retained for the outer owner.';
      process.exitCode = 1;
    }
  } else {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
  if (scenario.audioRequirements) {
    report.audioIdentity = evaluateAudioProof(
      report.finalState?.audioProof,
      scenario.audioRequirements,
    );
    if (audioProof && report.audioIdentity.status !== 'pass') {
      report.scenarioStatus = 'fail';
      report.audioIdentityFailure =
        'Required recording playback identity or transition was not observed; all partial evidence retained.';
      process.exitCode = 1;
    }
  }
  if (cpuProfile) report.performanceGateStatus = 'excluded-cpu-profiling';
  else if (audioProof) report.performanceGateStatus = 'excluded-audio-identity-profiling';
  else if (memoryProfile) {
    report.performanceGateStatus = 'excluded-memory-profiling';
    report.memory = memoryProfileSummary(report.snapshots);
  } else if (scenario.kind !== 'recovery') {
    try {
      report.performanceGates = evaluateQualificationBudgets(report.snapshots.at(-1)?.application);
      if (workProbe)
        report.externalPerformanceGates = externalQualificationBudgets(report.finalState?.probe);
      report.performanceGateAggregation = aggregateQualificationGates({
        application: report.performanceGates,
        external: report.externalPerformanceGates,
        workProbe,
        baselineRuntime,
        applicationAvailable: Boolean(report.snapshots.at(-1)?.application),
      });
      report.performanceGateStatus = report.performanceGateAggregation.status;
    } catch (error) {
      report.performanceGateStatus = 'invalid-evidence';
      report.performanceGateFailure = String(error.stack ?? error);
    }
  } else report.performanceGateStatus = 'excluded-synthetic-recovery';
  if (hitchStore && hitchStore.finish().status !== 'complete') {
    report.performanceGateStatusBeforeHitchJournal = report.performanceGateStatus;
    report.performanceGateStatus = 'invalid-evidence';
    report.hitchJournalFailure =
      'Complete bounded hitch evidence unavailable; original outcomes retained.';
  }
  if (journalCostOptions && report.journalCost?.status !== 'complete') {
    report.performanceGateStatusBeforeJournalCost = report.performanceGateStatus;
    report.performanceGateStatus = 'invalid-evidence';
    report.journalCostFailure =
      'Complete single-document bounded synchronous-hook cost unavailable.';
  }
  if (readinessOptions) {
    report.readinessDocuments = readinessDocuments;
    report.readinessObservation = report.finalState?.probe?.readiness ?? null;
    if (selectedFontReadiness) {
      report.readinessAssessment = readinessModule.assessSelectedFontReadiness(
        report.readinessObservation,
        report.snapshots.at(-1)?.application,
        readinessDocuments,
        report.selectedFontTransport,
        readinessOptions.requestPolicy ?? 'single-v1',
      );
    } else if (resumeReadiness) {
      const before = report.snapshots.find((row) => row.group === 'before-resume');
      const restored = report.snapshots.find((row) => row.group === 'saved-restored-before-resume');
      const after = report.snapshots.find((row) => row.group === 'after-resume');
      const saved = readinessOptions.protocol === 'saved-resume-v1';
      report.readinessObservations = saved
        ? [before?.probe?.readiness ?? null, after?.probe?.readiness ?? null]
        : [after?.probe?.readiness ?? null];
      report.readinessAssessment = readinessModule.assessResumeReadiness({
        protocol: readinessOptions.protocol,
        documents: readinessDocuments,
        observations: report.readinessObservations,
        applications: (saved ? [before, restored, after] : [before, after]).map(
          (row) => row?.application,
        ),
        replayEvidence: resumeReplay.report,
        finalReplayText: nativeReplay,
      });
    } else
      report.readinessAssessment = readinessModule.assessReadinessPilot(
        report.readinessObservation,
        report.snapshots.at(-1)?.application,
        readinessDocuments,
      );
    if (report.readinessAssessment.status !== 'passed') {
      report.scenarioStatus = 'fail';
      report.readinessFailure =
        'Complete pre-play readiness was not observed; all original numeric and replay evidence is retained.';
      process.exitCode = 1;
    }
  }
  if (nativeReplay) {
    try {
      if (snapshotStore)
        assert(
          Buffer.byteLength(nativeReplay) <= 16 * 1024 ** 2,
          'Chunked lifecycle replay exceeds its reserved 16 MiB evidence budget',
        );
      const file = resolve(output) + '.replay.json';
      await writeFile(file, nativeReplay, { flag: 'wx' });
      report.replay = {
        file,
        sha256: createHash('sha256').update(nativeReplay).digest('hex'),
        bytes: Buffer.byteLength(nativeReplay),
        scope: partialReplay ? 'failed-scenario-partial-play' : 'completed-scenario',
      };
      const replayRequirements = partialReplay ? {} : scenario.replayRequirements;
      try {
        const { inspectQualificationReplayPortability } = await import(
          './solo-qualification-replay.mjs'
        );
        const observation = inspectQualificationReplayPortability(
          JSON.parse(nativeReplay),
          replayRequirements,
          scenario.expectedReplayDefinition,
        );
        report.replay.nodePortability = {
          status: observation.match ? 'match' : 'mismatch',
          nodeVersion: process.version,
          observation,
          scope:
            'Current-checkout Node reconstruction, retained as cross-engine portability evidence. It is not the authority for native gameplay correctness.',
        };
      } catch (error) {
        report.replay.nodePortability = {
          status: 'failed',
          nodeVersion: process.version,
          failure: String(error.stack ?? error),
        };
      }
      report.replay.nativeVerification = await verifyNativeQualificationReplay({
        playwright,
        engine,
        executablePath: process.env.CHROME_EXECUTABLE,
        observedBrowserClosed: Boolean(browser && !browser.isConnected()),
        expected: {
          browserVersion: report.environment.browserVersion,
          buildIdentity: report.buildIdentity,
          csp: report.csp,
        },
        recordingText: nativeReplay,
        requirements: replayRequirements,
        expectedDefinition: scenario.expectedReplayDefinition,
        mirror,
      });
      report.replay.nativeVerification.contextMode = 'ephemeral-no-storage-replay-verification';
      report.replay.observation = report.replay.nativeVerification.observation ?? null;
      assert.equal(
        report.replay.nativeVerification.status,
        'pass',
        'Strict same-engine replay/mechanic verification failed',
      );
    } catch (error) {
      report.scenarioStatus = 'fail';
      report.replayFailure = String(error.stack ?? error);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode && ['fail', 'invalid-evidence'].includes(report.performanceGateStatus))
    process.exitCode = 2;
  await save();
}
