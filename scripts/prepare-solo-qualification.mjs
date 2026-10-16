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
import { validateQualification } from './solo-qualification.mjs';
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
    level: applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
    segments: row[4],
    themeId: manifest.presentation.themeId,
    expected: 'won',
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
    level: manifest.level,
    segments: row[3],
    themeId: manifest.presentation.themeId,
    expected: 'won',
    basis: 'fracture-clear-routes.json',
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
    turnPolicy: row.turnPolicy,
    level: manifest.level,
    segments: row.segments.map(({ direction, ticks }) => [direction, ticks]),
    themeId: manifest.presentation.themeId,
    expected: 'won',
    basis: 'combat-candidate-routes.json',
    coverage: ['captures', 'combat-warning', 'combat-projectiles'],
  });
}
workloads.push({
  id: 'signal-07',
  level: campaign.levels.find((row) => row.id === 'signal-07'),
  segments: [[null, 3600]],
  themeId: 'horizon',
  expected: 'running',
  basis: 'game/content/campaign.json unchanged shipped level; 30 seconds neutral input',
  coverage: ['lane-warning', 'active-lane', 'jammer-picture'],
});

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
const prepare = (id) => [
  { type: 'upload', selector: '#import-file', file: `${id}.xonix.json` },
  { type: 'click', selector: '#preview-button', timeoutMs: 60000 },
  { type: 'follow', selector: '#open-preview', timeoutMs: 120000 },
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
      if (run.events.some((event) => event.type === 'capture.stopped')) flushNative();
    }
  flushNative();
  workload.nativeSegments = nativeSegments;
  workload.safeNonterminalCaptures = features.safeNonterminalCaptures;
  assert.equal(run.status, workload.expected, `${workload.id}: stale legal input recipe`);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  if (workload.coverage.includes('earned-erosion')) assert(features.eroded > 0);
  if (workload.coverage.includes('combat-projectiles')) assert(features.projectileTicks > 0);
  if (workload.coverage.includes('jammer-picture')) assert(features.jammerTicks > 0);
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
      id: workload.id,
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
const sentinel = await json('../game/content/packs/sentinel-relay.json');
const sentinelLevel = sentinel.campaigns[0].levels[0];
assert.equal(sentinelLevel.id, 'sentinel-relay-01');
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
      { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
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
const nextActions = [
  { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
  { type: 'wait', phase: 'running', timeoutMs: 60000 },
];
for (let index = 0; index <= 10; index++) {
  nextActions.push(...play(routes.rows[index][4]), ...finish, {
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
    id: 'ten-next-current-opening',
    kind: 'lifecycle',
    timeoutMs: 1200000,
    query: { journey: 'opening' },
    coverage: [
      'ten public Next transitions',
      'first eleven authored routes',
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
      { type: 'click', selector: '#settings-button' },
      { type: 'click', selector: '#settings-tab-audio' },
      { type: 'click', selector: '#settings-master-mute' },
      { type: 'check', selector: '[data-reaction-option="sounds"]', value: true },
      { type: 'check', selector: '[data-reaction-option="speech"]', value: true },
      { type: 'click', selector: '#soundtrack-open', timeoutMs: 60000 },
      { type: 'select', selector: '#soundtrack-quick-style', value: 'ambient' },
      { type: 'click', selector: '#soundtrack-play-style' },
      { type: 'click', selector: '#soundtrack-close' },
      { type: 'click', selector: '[data-close=\"settings-dialog\"]' },
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
  { type: 'click', selector: '#settings-button' },
  // The clip is pinned in English. This is the visible public language control,
  // not a preference/storage injection or an assumption about the host locale.
  { type: 'select', selector: '#settings-dialog [data-language-select]', value: 'en' },
  { type: 'click', selector: '#settings-tab-audio' },
  { type: 'click', selector: '#settings-master-mute' },
];
const closeAudioSettings = [{ type: 'click', selector: '[data-close="settings-dialog"]' }];
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
      ...finish,
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
        // Play this playlist commits the imported draft itself. Its controls
        // stay disabled until public import has completed media admission.
        { type: 'select', selector: '#soundtrack-selection', value: AUDIO_PLAYLIST_ID },
        { type: 'click', selector: '#soundtrack-use-selection', timeoutMs: 60000 },
        { type: 'wait', ms: 5000 },
        { type: 'click', selector: '#soundtrack-next' },
        { type: 'wait', ms: 5000 },
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
      { type: 'click', selector: '#library-button' },
      { type: 'click', selector: '[data-library-panel=\"saves\"]' },
      { type: 'upload', selector: '#save-file', file: 'large-profile.library.json' },
      { type: 'expect', selector: '#undo-library:not(:disabled)', timeoutMs: 60000 },
      { type: 'expect', selector: '#library-capacity', contains: '480' },
      { type: 'snapshot', group: 'imported-large-profile' },
      { type: 'reload', timeoutMs: 120000 },
      { type: 'click', selector: '#shell-featured', timeoutMs: 60000 },
      { type: 'wait', phase: 'running', timeoutMs: 60000 },
      { type: 'click', selector: '#pause-button' },
      { type: 'wait', phase: 'paused' },
      { type: 'click', selector: '#library-button' },
      { type: 'click', selector: '[data-library-panel=\"saves\"]' },
      { type: 'expect', selector: '#library-capacity', contains: '480' },
      { type: 'click', selector: '[data-close=\"library-dialog\"]' },
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
