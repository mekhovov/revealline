import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createAuthoredJourneyRoute } from '../game/content-design/route.mjs';
import { createFractureCandidates } from '../game/content-design/fracture-candidates.mjs';
import { createCombatCandidates } from '../game/content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../game/core/index.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { scenarioFormatForLevel, validateScenario } from '../game/content.mjs';
import { jammerPictureStrength } from '../game/ui/jammer-picture.mjs';
import { combatView } from '../game/ui/combat-view.mjs';
import { soloReactionDanger } from '../game/ui/reaction-danger.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  campaignKey,
  exportLibrary,
  libraryCapacity,
} from '../game/library.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import { validateQualification as validateQualificationSchema } from './solo-qualification.mjs';
import {
  AUDIO_FIXTURE_FORMAT,
  AUDIO_PLAYLIST_ID,
  AUDIO_BUNDLE_FILE,
  AUDIO_RECORDINGS,
  AUDIO_SPEECH,
  speechFixtureProvenance,
  verifyAudioFixtureBytes,
} from './prepare-solo-audio-fixtures.mjs';

// Compile existing content; never edit a saved player profile or an accepted run.
// Fixed-step evidence below identifies workloads, not desktop/device performance.
const [directory, ...arguments_] = process.argv.slice(2);
if (!directory)
  throw new Error(
    'Usage: node scripts/prepare-solo-qualification.mjs <new-output-directory> [--audio-fixtures=<prepared-directory>]',
  );
assert(
  arguments_.length <= 1 && arguments_.every((arg) => arg.startsWith('--audio-fixtures=')),
  'Unknown preparation option',
);
const audioDirectory = arguments_[0]?.slice('--audio-fixtures='.length);
assert(
  audioDirectory === undefined || audioDirectory.length > 0,
  'Audio fixture directory is empty',
);
await mkdir(resolve(directory)); // Refuse to mix with or overwrite old evidence.
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const themes = (await json('../game/content-design/themes.json')).themes;
const authored = compileContentProject(createAuthoredJourneyRoute('authored').source);
const fracture = compileContentProject(createFractureCandidates());
const combat = compileContentProject(createCombatCandidates());
const routes = await json('../game/test/fixtures/candidate-solo-tuned-host-routes.json');
const fractureRows = (await json('../game/test/fixtures/fracture-clear-routes.json')).sets.find(
  (set) => set.difficulty === 'standard' && set.turnPolicy === 'immediate',
).rows;
const combatRows = (await json('../game/test/fixtures/combat-candidate-routes.json')).routes;
const campaign = await json('../game/content/campaign.json');
const workloads = [];
for (const id of ['first-return', 'long-rail']) {
  const row = routes.rows.find((row) => row[0] === id);
  const manifest = resolveMission(authored, id, { difficulty: 'standard' });
  workloads.push({
    id,
    ...(id === 'long-rail' ? { qualificationId: 'long-rail-captures-v2' } : {}),
    level: applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
    segments: id === 'long-rail' ? row[4].slice(0, 8) : row[4],
    themeId: manifest.presentation.themeId,
    expected: id === 'long-rail' ? 'running' : 'won',
    basis: 'candidate-solo-tuned-host-routes.json',
    coverage: ['captures', ...(id === 'long-rail' ? ['long-cuts', 'patrols'] : [])],
  });
}
{
  const row = fractureRows.find((row) => row[0] === 'first-fracture');
  const manifest = resolveMission(fracture, row[0], { difficulty: 'standard' });
  assert.equal(manifest.simulationIdentity, row[1]);
  workloads.push({
    id: row[0],
    qualificationId: 'first-fracture-capture-erosion-v2',
    level: manifest.level,
    // One ordinary held cut, then enough native time for the earned erosion.
    // The prior model victory route depended on fragile short corrective inputs.
    segments: [
      ['down', 192],
      [null, 1800],
    ],
    preserveHeldInput: true,
    themeId: manifest.presentation.themeId,
    expected: 'running',
    basis:
      'Unchanged First Fracture definition from fracture-clear-routes.json; version2 capture-and-erosion workload ends before victory. Prior failed native victory attempts remain preserved.',
    coverage: ['captures', 'earned-erosion'],
  });
}
{
  const row = combatRows.find(
    (row) =>
      row.id === 'sentry-detour' &&
      row.difficulty === 'standard' &&
      row.turnPolicy === 'grid-center' &&
      row.seed === 1,
  );
  const manifest = resolveMission(combat, row.id, { difficulty: row.difficulty });
  assert.equal(manifest.simulationIdentity, row.simulationIdentity);
  workloads.push({
    id: row.id,
    qualificationId: 'sentry-detour-capture-projectile-v2',
    turnPolicy: row.turnPolicy,
    level: manifest.level,
    segments: row.segments.map(({ direction, ticks }, index) => [
      direction,
      index === row.segments.length - 1 ? 300 : ticks,
    ]),
    themeId: manifest.presentation.themeId,
    expected: 'running',
    basis: 'combat-candidate-routes.json',
    coverage: ['captures', 'combat-warning', 'combat-projectiles'],
  });
}
workloads.push({
  id: 'signal-07',
  // The editor adds missing collection arrays and the public recorder uses the
  // core-normalized definition. Make those existing defaults explicit in the
  // submitted fixture as well; keep every authored field and the strict checks.
  level: normalizedLevel(campaign.levels.find((row) => row.id === 'signal-07')),
  segments: [[null, 3600]],
  themeId: 'horizon',
  expected: 'running',
  basis:
    'game/content/campaign.json shipped level with existing core defaults made explicit by normalizedLevel; no gameplay tuning; 30 seconds neutral input',
  coverage: ['lane-warning', 'active-lane', 'jammer-picture'],
});

const definition = (level, turnPolicy = 'immediate') => ({
  level,
  options: { classId: 'scout', turnPolicy },
});
const expectedDefinitions = new Map(
  workloads.flatMap((workload) => [
    [workload.id, definition(workload.level, workload.turnPolicy)],
    [workload.qualificationId ?? workload.id, definition(workload.level, workload.turnPolicy)],
  ]),
);
for (const id of [
  'original-art-opening-capture',
  'original-art-opening-warm-reload-capture',
  'original-art-long-recording-save-reward-next-profile',
  'twenty-retries',
  'thirty-minute-lifecycle-soak',
  'recorded-local-stream-current-next-and-natural-transition',
  'large-profile-public-import-and-reload',
])
  expectedDefinitions.set(id, expectedDefinitions.get('first-return'));
expectedDefinitions.set('recorded-guide-capture-speech', expectedDefinitions.get('long-rail'));
for (const id of ['enabled-local-audio-and-reactions', 'explicit-resume-recovery-handlers'])
  expectedDefinitions.set(id, expectedDefinitions.get('signal-07'));
expectedDefinitions.set(
  'ten-next-current-opening-v3',
  definition(
    applyGameplayTuning(
      resolveMission(authored, routes.rows[10][0], { difficulty: 'standard' }).level,
      resolveGameplayTuning('standard'),
    ),
  ),
);
function validateQualification(value) {
  const expectedReplayDefinition = expectedDefinitions.get(value.id);
  assert(expectedReplayDefinition, `Missing accepted workload definition: ${value.id}`);
  const exports = (actions) =>
    actions.some(
      (action) =>
        action.type === 'exportReplay' || (action.type === 'repeat' && exports(action.actions)),
    );
  return validateQualificationSchema({
    ...value,
    ...(value.entryPath === 'playground/' ? { readyHiddenSelector: '#boot-status' } : {}),
    expectedReplayDefinition,
    actions: exports(value.actions) ? value.actions : [...value.actions, { type: 'exportReplay' }],
  });
}

const key = (direction) => `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`;
const play = (segments) =>
  segments.map(([direction, ticks]) =>
    direction
      ? { type: 'key', key: key(direction), ms: Math.max(1, Math.round(ticks * FIXED_DT * 1000)) }
      : { type: 'wait', ms: Math.max(1, Math.round(ticks * FIXED_DT * 1000)) },
  );
const finish = [{ type: 'result', outcome: 'won', timeoutMs: 20000 }];
const start = [
  { type: 'click', selector: '#start-button', timeoutMs: 60000 },
  { type: 'wait', phase: 'running', timeoutMs: 60000 },
];
const publicSettings = [
  { type: 'click', selector: '#shell-menu' },
  { type: 'click', selector: '#shell-options' },
];
const closePublicSettings = [
  { type: 'click', selector: '[data-close="settings-dialog"]' },
  { type: 'key', key: 'Escape', ms: 1 },
];
const prepare = (id) => [
  {
    type: 'upload',
    selector: '#import-file',
    file: `${id}.xonix.json`,
    acceptedLevelSelector: '#level-json',
  },
  { type: 'click', selector: '#preview-button', timeoutMs: 60000 },
  {
    type: 'follow',
    selector: '#open-preview',
    preparationStatusSelector: '[data-presentation-status="auxiliary"]',
    timeoutMs: 120000,
  },
  { type: 'snapshot', group: 'prepared' },
];
const launch = (id) => [...prepare(id), ...start];
const saved = [];
const put = async (file, value) => {
  const body = JSON.stringify(value, null, 2) + '\n';
  await writeFile(resolve(directory, file), body);
  saved.push({ file, sha256: createHash('sha256').update(body).digest('hex') });
};
for (const workload of workloads) {
  const options = { seed: 1, classId: 'scout', turnPolicy: workload.turnPolicy ?? 'immediate' };
  const run = createRun(workload.level, options),
    recorder = createRecorder(workload.level, options);
  const features = {
    closures: 0,
    eroded: 0,
    shots: 0,
    warnings: 0,
    projectileTicks: 0,
    jammerTicks: 0,
    maximumTrailCells: 0,
    maximumClaimedCells: 0,
    safeNonterminalCaptures: 0,
  };
  const events = {};
  const nativeSegments = [];
  let nativeDirection,
    nativeTicks = 0;
  const flushNative = () => {
    if (nativeTicks) nativeSegments.push([nativeDirection, nativeTicks]);
    nativeTicks = 0;
  };
  for (const [direction, ticks] of workload.segments)
    for (let tick = 0; tick < ticks; tick++) {
      if (nativeDirection !== direction) {
        flushNative();
        nativeDirection = direction;
      }
      nativeTicks++;
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      for (const event of run.events) events[event.type] = (events[event.type] ?? 0) + 1;
      features.shots += run.events.filter((event) => event.type === 'combat.fired').length;
      features.closures += run.events.filter((event) => event.type === 'cut.closed').length;
      if (!soloReactionDanger(run))
        features.safeNonterminalCaptures += run.events.filter(
          (event) => event.type === 'cells.claimed',
        ).length;
      features.eroded += run.events.filter((event) => event.type === 'cells.eroded').length;
      const view = combatView(run);
      if (view?.valid) {
        if (view.projectiles?.length) features.projectileTicks++;
        if (view.actors?.some((actor) => actor.phase === 'warning')) features.warnings++;
      }
      if (jammerPictureStrength(run) > 0) features.jammerTicks++;
      features.maximumTrailCells = Math.max(features.maximumTrailCells, run.trail.length);
      features.maximumClaimedCells = Math.max(features.maximumClaimedCells, run.claimedCount);
      if (
        !workload.preserveHeldInput &&
        run.events.some((event) => event.type === 'capture.stopped')
      )
        flushNative();
    }
  flushNative();
  workload.nativeSegments = nativeSegments;
  workload.safeNonterminalCaptures = features.safeNonterminalCaptures;
  assert.equal(run.status, workload.expected, `${workload.id}: stale legal input recipe`);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  if (workload.coverage.includes('earned-erosion')) assert(features.eroded > 0);
  if (workload.coverage.includes('combat-projectiles')) assert(features.projectileTicks > 0);
  if (workload.coverage.includes('jammer-picture')) assert(features.jammerTicks > 0);
  const timingVariants = [];
  if (workload.preserveHeldInput)
    for (const heldTicks of [168, 180, 192, 204, 216]) {
      const variant = createRun(workload.level, options);
      let closures = 0,
        eroded = 0;
      for (const [direction, ticks] of [
        ['down', heldTicks],
        [null, 1800],
      ])
        for (let tick = 0; tick < ticks; tick++) {
          stepRun(variant, { direction }, FIXED_DT);
          closures += variant.events.filter((event) => event.type === 'cut.closed').length;
          eroded += variant.events.filter((event) => event.type === 'cells.eroded').length;
        }
      assert.equal(variant.status, 'running');
      assert.equal(variant.lives, 3);
      assert(closures >= 1 && eroded >= 1);
      timingVariants.push({
        heldTicks,
        status: variant.status,
        lives: variant.lives,
        closures,
        eroded,
      });
    }
  const scenario = {
    format: scenarioFormatForLevel(workload.level.version),
    masteryDefinition: null,
    level: workload.level,
    theme: themes.find((theme) => theme.id === workload.themeId),
    visualOverrides: {},
    settings: options,
    presentation: { style: 'microtile', showGrid: true },
    metadata: {
      title: `Qualification: ${workload.id}`,
      description:
        'Unchanged gameplay definition; public Playground import for bounded qualification. Decorative authored backdrop is absent from this explicit greybox fixture.',
    },
  };
  assert.equal(validateScenario(scenario).valid, true, JSON.stringify(validateScenario(scenario)));
  await put(`${workload.id}.xonix.json`, scenario);
  await put(`${workload.id}.model.json`, {
    kind: 'model-correctness',
    basis: workload.basis,
    fixedDt: FIXED_DT,
    nativeSegments,
    timingVariants,
    features,
    events,
    expectedStatus: workload.expected,
    actualStatus: run.status,
    checkpoint: authoritativeCheckpoint(run),
    publicReplayVerified: true,
    limitations: [
      'No native rendering, wall time, host lifecycle, artwork or physical-device performance conclusion.',
    ],
  });
  await put(
    `${workload.id}.qualification.json`,
    validateQualification({
      format: 'SoloQualificationV1',
      id: workload.qualificationId ?? workload.id,
      kind: 'performance',
      timeoutMs: 240000,
      entryPath: 'playground/',
      readySelector: '#import-file',
      coverage: workload.coverage,
      replayRequirements: {
        ...(workload.coverage.includes('captures') ? { closures: 1 } : {}),
        ...(workload.coverage.includes('earned-erosion') ? { eroded: 1 } : {}),
        ...(workload.coverage.includes('combat-projectiles')
          ? { shots: 1, projectileTicks: 1 }
          : {}),
        ...(workload.coverage.includes('jammer-picture') ? { jammerTicks: 1 } : {}),
        ...(workload.coverage.includes('long-cuts') ? { maximumTrailCells: 20 } : {}),
      },
      actions: [
        ...launch(workload.id),
        ...play(workload.nativeSegments),
        ...(workload.expected === 'won'
          ? finish
          : [
              { type: 'wait', phase: 'running' },
              { type: 'click', selector: '#pause-button' },
              { type: 'wait', phase: 'paused' },
            ]),
        { type: 'snapshot', group: 'after-workload' },
        { type: 'exportReplay' },
      ],
    }),
  );
}
const resourceRules = [
  'resources.renderer.ownedCanvases.canvases',
  'resources.renderer.ownedCanvases.rgbaBytesEstimate',
  'resources.phaser.uniqueCanvases',
].map((path) => ({ group: 'completed', path, last: 10, maxRange: 0 }));
const opening = workloads[0];
// These paths retain the shipped source, registered originals and level visual
// overrides. They do not go through Playground serialization/conversion.
await put(
  'original-art-opening.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'original-art-opening-capture',
    kind: 'performance',
    timeoutMs: 240000,
    query: { journey: 'opening' },
    coverage: ['public opening Journey', 'registered original art', 'large capture', 'long cut'],
    replayRequirements: { closures: 1, maximumTrailCells: 20, maximumClaimedCells: 500 },
    actions: [
      { type: 'snapshot', group: 'original-art-ready' },
      { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
      ...play(opening.nativeSegments),
      ...finish,
      { type: 'snapshot', group: 'original-art-captured' },
      { type: 'exportReplay' },
    ],
  }),
);
await put(
  'original-art-opening-warm.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'original-art-opening-warm-reload-capture',
    kind: 'performance',
    timeoutMs: 360000,
    query: { journey: 'opening' },
    cacheMode: 'warm-http-reload',
    coverage: [
      'same-context public reload before Direct Start',
      'HTTP cache remains eligible without browser routing; hits are separately unobserved',
      'public opening Journey with original art and earned capture',
    ],
    replayRequirements: { closures: 1, maximumTrailCells: 20, maximumClaimedCells: 500 },
    actions: [
      { type: 'snapshot', group: 'warm-primer-ready' },
      { type: 'reload', timeoutMs: 120000 },
      { type: 'snapshot', group: 'warm-reloaded-ready' },
      { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
      ...play(opening.nativeSegments),
      ...finish,
      { type: 'snapshot', group: 'warm-original-art-captured' },
      { type: 'exportReplay' },
    ],
  }),
);
// Profile one long recording separately from short-win lifecycle/timing runs.
// Neutral input is legal on First Return's protected start; enemies still tick.
// Keep the authored level, time limit, lives, seed and winning controls unchanged.
{
  const seconds = 180,
    options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    run = createRun(opening.level, options),
    recorder = createRecorder(opening.level, options),
    initialLives = run.lives;
  assert.equal(run.rules.timeLimitSeconds, 0, 'Long recording needs the original untimed mission');
  assert.equal(run.lives, 3);
  const tick = (direction) => {
    recordInput(recorder, { direction });
    stepRun(run, { direction }, FIXED_DT);
  };
  for (let index = 0; index < seconds * 120; index++) tick(null);
  assert.equal(run.status, 'running');
  assert.equal(run.lives, initialLives);
  assert.equal(run.player.cutting, false);
  assert.equal(run.player.x, 24.5);
  assert.equal(run.player.y, 0.5);
  const pausedCheckpoint = authoritativeCheckpoint(run),
    longReplay = exportReplay(recorder, run);
  assert.equal(longReplay.ticks, 21600);
  assert.equal(verifyReplay(longReplay).match, true);
  for (const [direction, ticks] of opening.segments)
    for (let index = 0; index < ticks; index++) tick(direction);
  assert.equal(run.status, 'won');
  assert.equal(run.lives, 3);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const nearbyDurations = [];
  for (const waitSeconds of [178, 179, 181, 182]) {
    const nearby = createRun(opening.level, options);
    for (let index = 0; index < waitSeconds * 120; index++)
      stepRun(nearby, { direction: null }, FIXED_DT);
    assert.equal(nearby.status, 'running');
    assert.equal(nearby.lives, 3);
    for (const [direction, ticks] of opening.segments)
      for (let index = 0; index < ticks; index++) stepRun(nearby, { direction }, FIXED_DT);
    assert.equal(nearby.status, 'won');
    assert.equal(nearby.lives, 3);
    nearbyDurations.push({
      waitSeconds,
      status: nearby.status,
      lives: nearby.lives,
      tick: nearby.tick,
    });
  }
  await put('long-recording-save-reward.model.json', {
    kind: 'model-correctness',
    basis: 'Unchanged First Return standard mission and candidate-solo-tuned-host-routes.json',
    levelIdentity: dataIdentity(opening.level),
    fixedDt: FIXED_DT,
    options,
    timeLimitSeconds: run.rules.timeLimitSeconds,
    preCaptureSeconds: seconds,
    preCaptureTicks: longReplay.ticks,
    preCaptureReplayBytes: Buffer.byteLength(JSON.stringify(longReplay)),
    preCaptureReplaySHA256: createHash('sha256').update(JSON.stringify(longReplay)).digest('hex'),
    preCaptureReplayVerified: true,
    pausedCheckpoint,
    winningSegments: opening.segments,
    wonCheckpoint: authoritativeCheckpoint(run),
    wonReplayVerified: true,
    nearbyDurations,
    limitations: [
      'Fixed-tick feasibility only; the public browser must independently retain the actual outcome.',
      'Neutral input compresses well: this tests long replay verification, not maximum recording byte size or the thirty-minute cap.',
      'Pause/save/export and Next are host actions; model proof does not establish their native cost or durability.',
      'Native export precedes the win so immediate Next is not delayed by export UI; no exported winning replay is claimed.',
      'Whether optional reward verification overlaps the next flight must be observed in the separately excluded CPU profile.',
    ],
  });
  await put(
    'long-recording-save-reward.qualification.json',
    validateQualification({
      format: 'SoloQualificationV1',
      id: 'original-art-long-recording-save-reward-next-profile',
      kind: 'lifecycle',
      requiredProfile: 'cpu',
      timeoutMs: 300000,
      query: { journey: 'opening' },
      coverage: [
        'CPU profiling only; excluded from timing qualification and the matched performance cohorts',
        'unchanged original-art First Return with 180 seconds of legal neutral recording',
        'public Pause invokes existing save/readback; public replay export retains the long unfinished recording',
        'unchanged earned win followed immediately by public Next and ten seconds of new gameplay',
        'profile determines reward verification overlap; no overlap or durable-save success is assumed',
      ],
      actions: [
        { type: 'snapshot', group: 'long-recording-ready' },
        { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
        { type: 'wait', phase: 'running', timeoutMs: 60000 },
        ...Array.from({ length: 3 }, (_, index) => ({
          type: 'wait',
          ms: 60000,
          label: `long-recording-minute-${index + 1}`,
        })),
        { type: 'wait', phase: 'running' },
        { type: 'click', selector: '#pause-button', label: 'long-recording-save' },
        { type: 'wait', phase: 'paused' },
        { type: 'snapshot', group: 'long-recording-paused-after-save' },
        { type: 'exportReplay', label: 'long-recording-public-export' },
        { type: 'click', selector: '#replay-dialog .dialog-close' },
        { type: 'click', selector: '#shell-workshop-dialog [data-close="shell-workshop-dialog"]' },
        { type: 'click', selector: '#settings-dialog .dialog-close' },
        { type: 'key', key: 'Escape', ms: 20 },
        ...start,
        ...play(opening.nativeSegments),
        ...finish,
        {
          type: 'click',
          selector: '#next-button',
          timeoutMs: 60000,
          label: 'immediate-earned-next',
        },
        { type: 'wait', phase: 'running', timeoutMs: 60000 },
        { type: 'wait', ms: 10000, label: 'next-flight-reward-overlap-observation' },
        { type: 'click', selector: '#pause-button' },
        { type: 'wait', phase: 'paused' },
        { type: 'snapshot', group: 'long-recording-next-flight' },
      ],
    }),
  );
}
const sentinel = await json('../game/content/packs/sentinel-relay.json');
// Ordinary linked-pack Start applies the selected Standard recipe. Practice
// imports bypass that projection, so the raw authored pack is not this route's
// accepted replay definition. Keep the complete tuned level for model and native
// verification; the earlier raw-definition mismatch remains failed evidence.
const sentinelLevel = applyGameplayTuning(
  sentinel.campaigns[0].levels[0],
  resolveGameplayTuning('standard'),
);
assert.equal(sentinelLevel.id, 'sentinel-relay-01');
assert.equal(sentinelLevel.rules.moveSpeed, 8.84);
assert.equal(sentinelLevel.rules.switchCooldownSeconds, 2);
assert.equal(sentinelLevel.encounter.shielded.restTicks, 248);
assert.equal(
  sentinelLevel.revision,
  'gp4s-3ff00000000000003ff00000000000003ff0000000000000-eb108d8cc7e0ab11',
);
expectedDefinitions.set('original-art-sentinel-relay-jamming', definition(sentinelLevel));
assert(
  sentinel.levelVisuals.some(
    (row) => row.levelId === sentinelLevel.id && row.visualOverrides.background,
  ),
);
// A declared real movement route on the safe border, rather than repeated
// outward inputs against a wall. Native replay must independently prove motion.
const sentinelSegments = Array.from({ length: 15 }, () => [
  ['up', 120],
  ['down', 120],
]).flat();
const sentinelOptions = { seed: 1, classId: 'scout' };
const sentinelRun = createRun(sentinelLevel, sentinelOptions);
const sentinelRecorder = createRecorder(sentinelLevel, sentinelOptions);
const sentinelProof = {
  movingTicks: 0,
  jammerTicks: 0,
  minimumY: sentinelRun.player.y,
  maximumY: sentinelRun.player.y,
};
for (const [direction, ticks] of sentinelSegments)
  for (let i = 0; i < ticks; i++) {
    const x = sentinelRun.player.x,
      y = sentinelRun.player.y;
    recordInput(sentinelRecorder, { direction });
    stepRun(sentinelRun, { direction }, FIXED_DT);
    if (sentinelRun.player.x !== x || sentinelRun.player.y !== y) sentinelProof.movingTicks++;
    if (jammerPictureStrength(sentinelRun) > 0) sentinelProof.jammerTicks++;
    sentinelProof.minimumY = Math.min(sentinelProof.minimumY, sentinelRun.player.y);
    sentinelProof.maximumY = Math.max(sentinelProof.maximumY, sentinelRun.player.y);
    assert.equal(sentinelRun.player.x, sentinelLevel.spawn.x);
  }
assert.equal(sentinelRun.status, 'running');
assert.equal(sentinelRun.lives, sentinelLevel.rules.lives);
assert.equal(sentinelProof.movingTicks, 3600);
assert(sentinelProof.jammerTicks > 0);
assert.equal(verifyReplay(exportReplay(sentinelRecorder, sentinelRun)).match, true);
await put('original-art-sentinel.model.json', {
  kind: 'model-correctness',
  levelId: sentinelLevel.id,
  options: sentinelOptions,
  segments: sentinelSegments,
  ...sentinelProof,
  outcome: sentinelRun.status,
  lives: sentinelRun.lives,
  publicReplayVerified: true,
  scope:
    'Safe movement workload discovery only; native recording must separately prove movement and jamming.',
});
await put(
  'original-art-sentinel.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'original-art-sentinel-relay-jamming',
    kind: 'performance',
    timeoutMs: 240000,
    query: { pack: 'sentinel-relay' },
    coverage: [
      'unchanged shipped Sentinel Relay pack',
      'embedded original JPEG background',
      'sentinel warning/active phases',
      'jammer-picture',
      '30 real up/down border movement gestures',
    ],
    replayRequirements: { jammerTicks: 1, movingTicks: 2400 },
    actions: [
      { type: 'snapshot', group: 'original-art-ready' },
      { type: 'click', selector: '#start-button', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
      ...play(sentinelSegments),
      { type: 'wait', phase: 'running' },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'original-art-jamming' },
      { type: 'exportReplay' },
    ],
  }),
);
const retryCycle = [
  ...play(opening.nativeSegments),
  ...finish,
  { type: 'snapshot', group: 'completed' },
  { type: 'click', selector: '#retry-button', timeoutMs: 60000 },
  { type: 'wait', phase: 'running', timeoutMs: 60000 },
];
await put(
  'twenty-retries.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'twenty-retries',
    resourceRules,
    kind: 'lifecycle',
    timeoutMs: 900000,
    entryPath: 'playground/',
    readySelector: '#import-file',
    coverage: [
      '20 real Retry transitions',
      'same imported opening',
      'compatible result resource snapshots',
    ],
    actions: [
      ...launch(opening.id),
      { type: 'repeat', count: 20, actions: retryCycle },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'last-retry' },
    ],
  }),
);
await put(
  'thirty-minute-soak.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'thirty-minute-lifecycle-soak',
    resourceRules,
    kind: 'lifecycle',
    timeoutMs: 2400000,
    entryPath: 'playground/',
    readySelector: '#import-file',
    coverage: [
      'at least 30 real minutes repeating legal capture/result/Retry cycles',
      'resource snapshots at equivalent result boundaries',
    ],
    actions: [
      ...launch(opening.id),
      {
        type: 'repeat',
        count: 360,
        atLeastMs: 1800000,
        actions: [...retryCycle, { type: 'wait', ms: 1000 }],
      },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'soak-end' },
    ],
  }),
);
// Each item is one real held key. Capture/recovery clears its intent in the
// host, so the remaining hold is a safe wait; do not re-press on every tick.
// The previous Courtyard cut collided after a 57-tick startup delay. This
// edge-to-edge route keeps the unchanged mission/rules and earns the same win.
const courtyardHeldRoute = [
  ['down', 680],
  ['right', 1000],
  ['up', 240],
  ['left', 1000],
  ['down', 800],
];
const courtyardLevel = normalizedLevel(
  applyGameplayTuning(
    resolveMission(authored, 'courtyard-return', { difficulty: 'standard' }).level,
    resolveGameplayTuning('standard'),
  ),
);
assert.equal(dataIdentity(courtyardLevel), 'eb57020d33aacb15');
const courtyardProofs = [];
for (const [initialTicks, durationDelta, dispatchGap] of [
  [0, 0, 0],
  [57, 0, 0],
  [120, -6, 8],
  [120, 6, 8],
]) {
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(courtyardLevel, options);
  const recorder = createRecorder(courtyardLevel, options);
  let intent = null;
  const tick = () => {
    const before = run.status;
    recordInput(recorder, { direction: intent });
    stepRun(run, { direction: intent }, FIXED_DT);
    if (
      before === 'respawning' ||
      run.status === 'respawning' ||
      run.events.some((event) => event.type === 'capture.stopped')
    )
      intent = null;
  };
  for (let i = 0; i < initialTicks; i++) tick();
  for (const [index, [direction, duration]] of courtyardHeldRoute.entries()) {
    if (index) for (let i = 0; i < dispatchGap && run.status === 'running'; i++) tick();
    intent = direction;
    for (let i = 0; i < duration + durationDelta && run.status === 'running'; i++) tick();
    if (run.status !== 'running') break;
  }
  for (let i = 0; i < 2400 && run.status === 'running'; i++) tick();
  assert.equal(run.status, 'won');
  assert.equal(run.lives, 3);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  courtyardProofs.push({
    initialTicks,
    durationDelta,
    dispatchGap,
    outcome: run.status,
    lives: run.lives,
    coverage: run.coverage,
    ticks: run.tick,
    publicReplayVerified: true,
  });
}
await put('ten-next-courtyard.model.json', {
  kind: 'model-correctness',
  levelId: courtyardLevel.id,
  levelIdentity: dataIdentity(courtyardLevel),
  segments: courtyardHeldRoute,
  options: { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
  proofs: courtyardProofs,
  broaderSensitivityReceipt: {
    path: '.cache/solo-followup/courtyard-boundary-tolerance-02.json',
    sha256: '9e70b06b005c9815487748c61eb7fcf06707a5056f2da08d373352fd673fb5ff',
    passingInitialTicks: [0, 201],
    retainedFailingInitialTicks: [202, 240],
    passingJitterVariants: 172,
  },
  scope:
    'Model correctness only; initial delay and finite input jitter checks do not guarantee arbitrary stalls. Continuous steering persists across keyup; capture/recovery clear it. Native qualification still requires eleven actual wins and ten public Next activations. This receipt covers only the Courtyard route.',
});
// These routes preserve the accepted Standard definitions and real held-input
// semantics. Longer edge travel and explicit re-presses avoid the earlier
// incomplete cut or narrow enemy-phase wait; finite model checks are not native
// qualification and do not justify arbitrary scheduling-delay tolerance.
const laterHeldRoutes = [
  {
    id: 'second-landing',
    levelIdentity: '8ade4f963169761c',
    segments: [
      [null, 530],
      ['right', 820],
      ['down', 250],
      ['left', 1100],
      ['left', 100],
      ['right', 350],
      ['down', 600],
      ['down', 600],
    ],
    variants: [
      [0, 0, 0],
      [57, 0, 0],
      [80, -2, 0],
      [80, 2, 0],
      [60, 0, 2],
    ],
    broaderSensitivityReceipt: {
      path: '.cache/solo-followup/second-landing-tolerance-05.json',
      sha256: '9d1f2e3db01951fbe6372000c3cc7875582722e0af5c88ac416596f1a1ebe23e',
    },
  },
  {
    id: 'long-way-home',
    levelIdentity: 'f5e7c371b7e9dd2e',
    segments: [
      ['left', 300],
      ['left', 100],
      ['up', 400],
      ['right', 450],
      ['down', 600],
      ['down', 570],
      ['down', 600],
      ['down', 100],
      ['right', 600],
      ['up', 240],
      ['left', 1200],
      ['left', 1200],
      ['left', 1150],
      ['up', 600],
      ['up', 600],
      ['right', 400],
      ['down', 600],
      ['down', 600],
      ['down', 600],
      ['right', 150],
      ['up', 600],
      ['up', 600],
      ['up', 600],
    ],
    variants: [
      [0, 0, 0],
      [57, 0, 0],
      [120, -2, 0],
      [120, 2, 0],
      [60, 0, 2],
    ],
  },
  {
    id: 'behind-the-patrol',
    levelIdentity: '1ddc85424850e75d',
    segments: [
      [null, 800],
      ['right', 461],
      ['down', 520],
    ],
    variants: [
      [0, 0, 0],
      [57, 0, 0],
      [120, -2, 0],
      [120, 2, 0],
      [60, 0, 2],
    ],
  },
];
for (const route of laterHeldRoutes) {
  const level = normalizedLevel(
    applyGameplayTuning(
      resolveMission(authored, route.id, { difficulty: 'standard' }).level,
      resolveGameplayTuning('standard'),
    ),
  );
  assert.equal(dataIdentity(level), route.levelIdentity);
  const proofs = [];
  for (const [initialTicks, durationDelta, dispatchGap] of route.variants) {
    const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    let intent = null;
    const tick = () => {
      const before = run.status;
      recordInput(recorder, { direction: intent });
      stepRun(run, { direction: intent }, FIXED_DT);
      if (
        before === 'respawning' ||
        run.status === 'respawning' ||
        run.events.some((event) => event.type === 'capture.stopped')
      )
        intent = null;
    };
    for (let i = 0; i < initialTicks; i++) tick();
    for (const [index, [direction, duration]] of route.segments.entries()) {
      if (index) for (let i = 0; i < dispatchGap && run.status === 'running'; i++) tick();
      if (direction !== null) intent = direction;
      for (let i = 0; i < duration + durationDelta && run.status === 'running'; i++) tick();
      if (run.status !== 'running') break;
    }
    for (let i = 0; i < 2400 && run.status === 'running'; i++) tick();
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    proofs.push({
      initialTicks,
      durationDelta,
      dispatchGap,
      outcome: run.status,
      lives: run.lives,
      livesLost: run.classic.livesLost,
      coverage: run.coverage,
      ticks: run.tick,
      publicReplayVerified: true,
    });
  }
  await put(`ten-next-${route.id}.model.json`, {
    kind: 'model-correctness',
    levelId: route.id,
    levelIdentity: route.levelIdentity,
    segments: route.segments,
    options: { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    proofs,
    broaderSensitivityReceipt: route.broaderSensitivityReceipt ?? {
      path: '.cache/solo-followup/final-three-tolerance-01.json',
      sha256: 'b2dfd61d9e9857d1ab53f18cd0338bccc94fb1b16e244689cb42153a963738be',
    },
    scope:
      'Finite fixed-step model checks only. All original failed recipes and probes remain retained. Native acceptance still requires eleven earned victories and ten ordinary Next activations.',
  });
}
const heldRoutes = new Map([
  ['courtyard-return', courtyardHeldRoute],
  ...laterHeldRoutes.map((route) => [route.id, route.segments]),
]);
const nextActions = [
  { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
  { type: 'wait', phase: 'running', timeoutMs: 60000 },
];
for (let index = 0; index <= 10; index++) {
  const row = routes.rows[index];
  const segments = heldRoutes.get(row[0]) ?? row[4];
  nextActions.push(...play(segments), ...finish, {
    type: 'snapshot',
    group: 'next-result',
  });
  if (index < 10)
    nextActions.push(
      { type: 'click', selector: '#next-button', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
    );
}
await put(
  'ten-next.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'ten-next-current-opening-v3',
    kind: 'lifecycle',
    timeoutMs: 1200000,
    query: { journey: 'opening' },
    coverage: [
      'ten public Next transitions',
      'first eleven authored routes',
      'Courtyard, Long Way Home, Behind the Patrol and Second Landing held-input routes v3; other mission inputs unchanged',
      'actual wins required; no progress seeding',
    ],
    actions: nextActions,
  }),
);
await put(
  'enabled-audio.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'enabled-local-audio-and-reactions',
    expectAudio: { nativeStartsAtLeast: 1, unmuted: true },
    kind: 'performance',
    timeoutMs: 240000,
    entryPath: 'playground/',
    readySelector: '#import-file',
    coverage: [
      'master sound enabled via gesture',
      'synthesized music style transition',
      'gameplay effects',
      'reaction preference enabled; actual speech must be separately observed',
    ],
    actions: [
      ...launch('signal-07'),
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      ...publicSettings,
      { type: 'click', selector: '#settings-tab-audio' },
      { type: 'click', selector: '#settings-master-mute' },
      { type: 'check', selector: '[data-reaction-option="sounds"]', value: true },
      { type: 'check', selector: '[data-reaction-option="speech"]', value: true },
      { type: 'click', selector: '#soundtrack-open', timeoutMs: 60000 },
      { type: 'select', selector: '#soundtrack-quick-style', value: 'ambient' },
      { type: 'click', selector: '#soundtrack-play-style' },
      { type: 'click', selector: '#soundtrack-close' },
      ...closePublicSettings,
      { type: 'snapshot', group: 'audio-enabled' },
      ...start,
      { type: 'wait', ms: 30000 },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'audio-result' },
    ],
  }),
);
const speechProvenance = await speechFixtureProvenance();
await put('recorded-speech.provenance.json', speechProvenance);
const pause = [
  { type: 'click', selector: '#pause-button' },
  { type: 'wait', phase: 'paused' },
];
const audioSettings = [
  ...publicSettings,
  // The clip is pinned in English. This is the visible public language control,
  // not a preference/storage injection or an assumption about the host locale.
  { type: 'click', selector: '#settings-tab-display' },
  {
    type: 'select',
    selector: '#settings-panel-display [data-language-select]:visible',
    value: 'en',
  },
  { type: 'click', selector: '#settings-tab-audio' },
  { type: 'click', selector: '#settings-master-mute' },
];
const closeAudioSettings = closePublicSettings;
const speechWorkload = workloads.find(({ id }) => id === 'long-rail');
assert(
  speechWorkload.safeNonterminalCaptures > 0,
  'Speech route needs a nonterminal capture without an authoritative warning',
);
assert(
  !speechWorkload.level.classic?.hunt && !speechWorkload.level.runningEnemies,
  'Speech route must select the guide speaker',
);
await put(
  'recorded-speech.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'recorded-guide-capture-speech',
    kind: 'performance',
    timeoutMs: 300000,
    entryPath: 'playground/',
    readySelector: '#import-file',
    audioRequirements: { recordedHashes: [AUDIO_SPEECH.sha256] },
    replayRequirements: { closures: 2 },
    coverage: [
      'unchanged Long Rail route; intermediate capture remains running',
      'public master/reaction speech controls and English language selection',
      'shipped guide capture pilot recording; native exact-hash start required in separate audio-proof mode',
      'generated macOS speech original; listening qualification remains pending',
    ],
    actions: [
      ...prepare(speechWorkload.id),
      ...audioSettings,
      // Before the first flight, unmuting alone need not create an AudioContext.
      // Public Studio playback supplies a gesture-owned context; changing the
      // speech control then invokes the actual safe-phase warmup path.
      { type: 'click', selector: '#soundtrack-open', timeoutMs: 60000 },
      { type: 'select', selector: '#soundtrack-quick-style', value: 'ambient' },
      { type: 'click', selector: '#soundtrack-play-style' },
      { type: 'click', selector: '#soundtrack-close', timeoutMs: 60000 },
      { type: 'check', selector: '[data-reaction-option="sounds"]', value: true },
      { type: 'check', selector: '[data-reaction-option="speech"]', value: false },
      { type: 'check', selector: '[data-reaction-option="speech"]', value: true },
      ...closeAudioSettings,
      {
        type: 'audio-ready',
        recordedHashes: [AUDIO_SPEECH.sha256],
        timeoutMs: 30000,
        fallbackMs: 5000,
      },
      { type: 'snapshot', group: 'recorded-speech-ready' },
      ...start,
      ...play(speechWorkload.nativeSegments),
      ...pause,
      { type: 'snapshot', group: 'recorded-speech-result' },
      { type: 'exportReplay' },
    ],
  }),
);
if (audioDirectory) {
  const provenance = JSON.parse(await readFile(resolve(audioDirectory, 'provenance.json')));
  assert.equal(provenance.format, AUDIO_FIXTURE_FORMAT);
  assert.equal(provenance.status, 'prepared-not-executed');
  assert.equal(provenance.playlistId, AUDIO_PLAYLIST_ID);
  assert.equal(provenance.bundle.file, AUDIO_BUNDLE_FILE);
  assert.equal(provenance.recordings.length, AUDIO_RECORDINGS.length);
  for (const pin of AUDIO_RECORDINGS) {
    const recording = provenance.recordings.find(({ id }) => id === pin.id);
    assert.equal(recording?.status, 'verified');
    assert.equal(recording.sha256, pin.sha256);
    assert.equal(recording.bytes, pin.bytes);
  }
  const bundle = verifyAudioFixtureBytes(
    await readFile(resolve(audioDirectory, AUDIO_BUNDLE_FILE)),
    { ...provenance.bundle, id: AUDIO_BUNDLE_FILE },
  );
  await writeFile(resolve(directory, AUDIO_BUNDLE_FILE), bundle, { flag: 'wx' });
  saved.push({ file: AUDIO_BUNDLE_FILE, sha256: provenance.bundle.sha256 });
  await put('recorded-music.provenance.json', provenance);
  await put(
    'recorded-music.qualification.json',
    validateQualification({
      format: 'SoloQualificationV1',
      id: 'recorded-local-stream-current-next-and-natural-transition',
      kind: 'performance',
      timeoutMs: 360000,
      entryPath: 'playground/',
      readySelector: '#import-file',
      audioRequirements: {
        streamedHashes: AUDIO_RECORDINGS.map(({ sha256 }) => sha256),
        minimumAdvanceSeconds: 1,
        naturalTransitionsAtLeast: 1,
      },
      coverage: [
        'public .rlsound import of two exact archived CC0 originals with pinned hashes',
        'local Blob-backed HTMLMediaElement streaming; no claim about remote delivery',
        'public recording-mode filter disabled for listening; no gameplay-video permission claim',
        'ordered playlist current/next admission via public explicit Next',
        '60 seconds without transport input requires a natural near-end transition',
        'separate audio-proof mode requires both exact MP3 hashes and native playback advancement',
      ],
      actions: [
        ...prepare('first-return'),
        ...audioSettings,
        { type: 'click', selector: '#soundtrack-open', timeoutMs: 60000 },
        { type: 'click', selector: '#soundtrack-advanced-backup-toggle' },
        { type: 'upload', selector: '#soundtrack-bundle-file', file: AUDIO_BUNDLE_FILE },
        { type: 'click', selector: '#soundtrack-import-bundle', timeoutMs: 60000 },
        { type: 'expect', selector: '#soundtrack-use-selection:enabled' },
        // These originals are listening fixtures. Their unchanged metadata does
        // not claim the additional permissions required by recording mode.
        { type: 'click', selector: '#soundtrack-advanced-listening-toggle' },
        { type: 'check', selector: '#soundtrack-recording-mode', value: false },
        { type: 'click', selector: '#soundtrack-apply-listening', timeoutMs: 60000 },
        { type: 'expect', selector: '#soundtrack-use-selection:enabled' },
        // Play this playlist commits the imported draft itself. Its controls
        // stay disabled until public import has completed media admission.
        { type: 'select', selector: '#soundtrack-selection', value: AUDIO_PLAYLIST_ID },
        { type: 'click', selector: '#soundtrack-use-selection', timeoutMs: 60000 },
        // Saving can finish outside the original user gesture. The public
        // transport supplies the documented fresh activation when necessary.
        { type: 'click', selector: '#soundtrack-play' },
        { type: 'wait', ms: 5000 },
        { type: 'expect', selector: '#soundtrack-now', contains: 'Party Sector' },
        { type: 'click', selector: '#soundtrack-next' },
        { type: 'wait', ms: 5000 },
        { type: 'expect', selector: '#soundtrack-now', contains: 'Bossa Nova' },
        { type: 'click', selector: '#soundtrack-close' },
        ...closeAudioSettings,
        { type: 'snapshot', group: 'recorded-music-ready' },
        ...start,
        { type: 'wait', ms: 60000, label: 'natural-music-transition' },
        ...pause,
        { type: 'snapshot', group: 'recorded-music-result' },
      ],
    }),
  );
}
await put(
  'recovery.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'explicit-resume-recovery-handlers',
    kind: 'recovery',
    timeoutMs: 180000,
    entryPath: 'playground/',
    readySelector: '#import-file',
    coverage: [
      'synthetic Canvas loss/restoration handler',
      'synthetic blur handler',
      'native viewport resize',
      'explicit Resume',
    ],
    actions: [
      ...launch('signal-07'),
      { type: 'fault', event: 'canvas-loss', selector: '#game-canvas canvas' },
      { type: 'wait', phase: 'paused' },
      { type: 'fault', event: 'canvas-restore', selector: '#game-canvas canvas' },
      { type: 'wait', ms: 1000 },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'restored-requires-resume' },
      ...start,
      { type: 'fault', event: 'blur' },
      { type: 'wait', phase: 'paused' },
      { type: 'fault', event: 'focus' },
      { type: 'resize', width: 390, height: 844 },
      { type: 'wait', ms: 1000 },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'resized-requires-resume' },
      ...start,
      { type: 'wait', ms: 3000 },
      { type: 'click', selector: '#pause-button' },
      { type: 'snapshot', group: 'recovered' },
    ],
  }),
);
// A synthetic, supported library pressure fixture. It is admitted through the
// same public import as a user's backup; it does not inject storage or awards.
const libraryRun = createRun(campaign.levels[0]);
for (let tick = 0; tick < 180; tick++) stepRun(libraryRun, {}, FIXED_DT);
for (let tick = 0; tick < 469; tick++) stepRun(libraryRun, { direction: 'down' }, FIXED_DT);
assert.equal(libraryRun.status, 'won');
const template = recordLibraryCompletion(emptyLibrary(), {
  campaign,
  result: getSummary(libraryRun),
  runId: 'qualification-library-template',
  themeId: 'horizon',
  bodyId: 'fpv-body',
  completedAt: '2026-10-16T00:00:00.000Z',
});
const library = emptyLibrary(),
  progressTemplate = Object.values(template.campaigns)[0];
for (let index = 0; index < 480; index++) {
  const id = `qualification-history-${index}`,
    key = campaignKey({ ...campaign, id });
  library.campaigns[key] = { ...structuredClone(progressTemplate), campaignId: id };
  for (const theme of themes.slice(0, 8))
    library.gallery.push({
      ...template.gallery[0],
      campaignKey: key,
      themeId: theme.id,
      runId: `qualification-gallery-${index}-${theme.id}`,
      key: `gallery-v1-${dataIdentity([key, template.gallery[0].levelId, theme.id])}`,
    });
  for (let attempt = 0; attempt < 2; attempt++)
    library.scores.push({
      ...template.scores[0],
      campaignKey: key,
      boardId: `board-v1-${dataIdentity([key, template.scores[0].boardId])}`,
      runId: `qualification-score-${index}-${attempt}`,
    });
}
const validatedLibrary = JSON.parse(exportLibrary(library));
await put('large-profile.library.json', validatedLibrary);
await put('large-profile.capacity.json', {
  kind: 'synthetic-public-import-fixture',
  ...libraryCapacity(validatedLibrary),
  scope:
    'Near-capacity historical metadata; no installed originals, saved live flight or custom soundtrack assets. Campaign IDs are isolated synthetic fixture IDs.',
});
await put(
  'large-profile.qualification.json',
  validateQualification({
    format: 'SoloQualificationV1',
    id: 'large-profile-public-import-and-reload',
    kind: 'lifecycle',
    timeoutMs: 360000,
    query: { journey: 'opening' },
    coverage: [
      '480 saved campaign records',
      '3840 gallery records',
      '960 score records',
      'public import and reload',
      'metadata pressure only; original media and soundtrack libraries excluded',
    ],
    actions: [
      { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      ...publicSettings,
      { type: 'click', selector: '#settings-tab-data' },
      { type: 'click', selector: '#settings-saves' },
      { type: 'upload', selector: '#save-file', file: 'large-profile.library.json' },
      { type: 'expect', selector: '#undo-library:not(:disabled)', timeoutMs: 60000 },
      { type: 'expect', selector: '#library-capacity', contains: '480' },
      { type: 'snapshot', group: 'imported-large-profile' },
      { type: 'reload', timeoutMs: 120000 },
      { type: 'click', selector: '#shell-continue', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      ...publicSettings,
      { type: 'click', selector: '#settings-tab-data' },
      { type: 'click', selector: '#settings-saves' },
      { type: 'expect', selector: '#library-capacity', contains: '480' },
      { type: 'click', selector: '[data-close=\"library-dialog\"]' },
      ...closePublicSettings,
      ...start,
      {
        type: 'repeat',
        count: 30,
        actions: [
          { type: 'key', key: 'ArrowRight', ms: 250 },
          { type: 'key', key: 'ArrowLeft', ms: 250 },
        ],
      },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      { type: 'snapshot', group: 'large-profile-playing' },
    ],
  }),
);
await put('index.json', {
  format: 'SoloQualificationPreparedV1',
  evidenceKind:
    'prepared inputs plus separately identified model correctness; no native execution yet',
  files: saved.slice(),
  definitionProjections: {
    sources: await Promise.all(
      [
        'game/content/packs/sentinel-relay.json',
        'game/content/campaign.json',
        'game/gameplay-tuning.mjs',
        'game/core/level.mjs',
        'game/core/index.mjs',
        'game/replay.mjs',
        'game/playground/model.mjs',
        'game/ui/field-kit-surfaces.mjs',
        'game/ui/game-shell.mjs',
      ].map(async (path) => ({
        path,
        sha256: createHash('sha256')
          .update(await readFile(new URL(`../${path}`, import.meta.url)))
          .digest('hex'),
      })),
    ),
    sentinel: {
      authoredSource: 'game/content/packs/sentinel-relay.json: campaigns[0].levels[0]',
      sourceFunctions: [
        'game/gameplay-tuning.mjs: resolveGameplayTuning(standard)',
        'game/gameplay-tuning.mjs: applyGameplayTuning',
      ],
      authoredIdentity: dataIdentity(sentinel.campaigns[0].levels[0]),
      acceptedIdentity: dataIdentity(sentinelLevel),
      acceptedRevision: sentinelLevel.revision,
      scope:
        'Ordinary linked-pack Start applies the existing Standard recipe. Full projected definition is shared by model and native expectation. Inputs, art and mechanic minimums remain unchanged; prior raw-definition mismatch remains failed.',
    },
    signal07: {
      authoredSource: 'game/content/campaign.json: levels[id=signal-07]',
      sourceFunctions: [
        'game/core/level.mjs: normalizedLevel',
        'game/playground/model.mjs: editorScenario (adds missing collection arrays at import)',
        'game/core/index.mjs: createRun (normalizes the accepted definition)',
        'game/replay.mjs: createRecorder (retains the normalized run level)',
      ],
      authoredIdentity: dataIdentity(campaign.levels.find((level) => level.id === 'signal-07')),
      acceptedIdentity: dataIdentity(
        workloads.find((workload) => workload.id === 'signal-07').level,
      ),
      inheritedScenarios: ['signal-07', 'enabled-audio', 'recovery'],
      scope:
        'Existing engine defaults are explicit in submitted upload, model and full native expectation. No Standard gameplay tuning is applied to this practice import. Prior missing-array import failures remain failed. Other validated fixture definitions are unchanged.',
    },
    largeProfileNavigation: {
      sourceFunctions: [
        'game/ui/field-kit-surfaces.mjs: openLibrary through settings-saves',
        'game/ui/game-shell.mjs: openHome, refreshHomeCopy, shell-continue',
      ],
      scope:
        'Navigation-only correction: Home → Options → Data → Saves & recovery opens the existing public Library import. Close Library then Settings and Home before Resume; after reload use Continue for the established Journey. Full profile bytes, record counts, reload, capacity assertions and native controls are preserved. Earlier hidden-control failures remain failed.',
    },
  },
  audioFixtureStatus: audioDirectory
    ? 'speech and local streaming actions prepared; separate native audio-proof run still required'
    : 'speech prepared; local streaming scenario not prepared (supply --audio-fixtures)',
  instructions:
    'Pass the game base URL and one .qualification.json to scripts/qualify-solo-runtime.mjs. Inputs enter through public Playground import and full preview. Each native expected result is enforced; route drift is retained as failure, never repaired by writing state.',
});
console.log(
  JSON.stringify({
    directory: resolve(directory),
    files: saved.length,
    modelWorkloads: workloads.map(({ id }) => id),
  }),
);
