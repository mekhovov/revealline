import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  authoritativeCheckpoint,
  verifyReplay,
  MAX_REPLAY_BYTES,
} from '../replay.mjs';
import {
  suspendSession,
  restoreSession,
  snapshotSession,
  saveSession,
  ACTOR_SESSION_FORMAT,
  SESSION_IMPORT_BYTES,
  SESSION_STORAGE_BYTES,
} from '../sessions.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { resolveGameplayTuning, applyGameplayTuning } from '../gameplay-tuning.mjs';
import { resolveActorStyleForBoundary } from '../presentation/actor-style-policy.mjs';
import { mediaFixture, libraryRecord } from './helpers/media-fixtures.mjs';
import { emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { prepareBackup, exportBackup } from '../backup.mjs';
import { prepareAttemptExport } from '../attempt-export.mjs';

function fixture(mode = 'standard', turnPolicy = 'immediate') {
  const f = mediaFixture(true),
    entry = f.catalog.entries.find((item) => item.difficulty === mode),
    library = validateMediaLibrary(libraryRecord(f.identity), f),
    pins = createPresentationPins({
      library,
      identityCatalog: f.identityCatalog,
      ...f.request(mode),
      themeIds: ['fpv', 'ukraine', 'retro', 'network'],
    }),
    level = entry.campaign.levels[0],
    options = {
      classId: 'scout',
      classRecipes: entry.campaign.classRecipes ?? CLASSES,
      turnPolicy,
    },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const direction of [...Array(13).fill('down'), 'right']) {
    const command = { direction, boost: false, action: false, pickup: false };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  }
  const actor = {
    format: 'revealline-actor-appearance-pin.v1',
    style: 'fpv',
    rendererPolicy: 'actor-style.v1',
    content: {
      editionId: 'field-kit',
      contentThemeId: 'fpv',
      mode: 'solo',
      owner: { kind: 'campaign', baseCampaignKey: f.identity.baseCampaignKey },
      level: { id: f.identity.levelId, revision: f.identity.levelRevision, sha256: 'a'.repeat(64) },
    },
    presentation: {
      source: { id: 'field-kit', revision: 62 },
      theme: { id: 'fpv', revision: 62 },
      collection: null,
      sha256: 'b'.repeat(64),
    },
  };
  return {
    ...f,
    entry,
    level,
    pins,
    actor,
    flight: {
      run,
      recorder,
      campaignKey: entry.executionKey,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      runId: 'actor-flight',
      savedAt: '2026-09-24T08:00:00.000Z',
      continuation: { direction: 'right' },
    },
  };
}
const options = (f) => ({
  campaign: f.entry.campaign,
  campaignKey: f.entry.executionKey,
  mediaIdentityCatalog: f.identityCatalog,
});
const save = (f, extra = {}) =>
  suspendSession({
    ...f.flight,
    presentationPins: f.pins,
    presentationLevel: f.level,
    actorAppearancePin: f.actor,
    ...extra,
  });
const visual = (f) => ({
  format: 'revealline-visual-theme-pin.v1',
  content: f.actor.content,
  selection: { id: 'field-kit', revision: 1 },
  presentation: f.actor.presentation,
});

test('actor saves survive backup and rescue export without granting asset readiness', async () => {
  const f = fixture(),
    session = save(f),
    source = { library: emptyLibrary(), packs: emptyPackLibrary(), session },
    before = structuredClone(source),
    config = {
      campaigns: [f.entry.campaign],
      resolveMediaIdentityCatalog: () => f.identityCatalog,
    };
  const bytes = await exportBackup(source, config),
    restored = await prepareBackup(bytes, config);
  assert.deepEqual(restored.session, session);
  assert.deepEqual(source, before);
  await assert.rejects(
    prepareBackup(bytes, { campaigns: [f.entry.campaign] }),
    /original picture library and exact historical owners/,
  );
  for (const context of [
    {},
    { campaign: f.entry.campaign, mediaIdentityCatalog: f.identityCatalog },
  ]) {
    const exported = await prepareAttemptExport(session, context);
    assert.deepEqual(exported.session, session);
    assert.equal(Object.isFrozen(exported.session.actorAppearancePin), true);
    assert.equal(exported.context, context.campaign ? 'installed-campaign' : 'replay-only');
  }
});

for (const mode of ['standard', 'gentle'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`v6 ${mode}/${turnPolicy} retains actors and exact replay independently of current preferences`, async () => {
      const f = fixture(mode, turnPolicy),
        before = authoritativeCheckpoint(f.flight.run),
        recording = structuredClone(f.flight.recorder),
        saved = save(f);
      assert.equal(saved.format, ACTOR_SESSION_FORMAT);
      assert.equal(saved.visualThemePin, null);
      assert.deepEqual(authoritativeCheckpoint(f.flight.run), before);
      assert.deepEqual(f.flight.recorder, recording);
      assert.equal(verifyReplay(saved.replay).match, true);
      const promise = restoreSession(saved, options(f));
      saved.actorAppearancePin = {
        ...saved.actorAppearancePin,
        style: 'campaign',
        presentation: null,
      };
      f.actor.presentation.source.revision = 100;
      const restored = await promise;
      assert.equal(restored.session.actorAppearancePin.style, 'fpv');
      assert.equal(restored.session.actorAppearancePin.presentation.source.revision, 62);
      assert.equal(
        resolveActorStyleForBoundary({
          requested: 'campaign',
          boundary: 'continue',
          retainedStyle: restored.session.actorAppearancePin.style,
        }).actorStyle,
        'fpv',
      );
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      for (const direction of ['right', 'down', 'left', 'up']) {
        const command = { direction, boost: false, action: false, pickup: false };
        stepRun(f.flight.run, command, FIXED_DT);
        stepRun(restored.run, command, FIXED_DT);
        assert.deepEqual(
          authoritativeCheckpoint(restored.run),
          authoritativeCheckpoint(f.flight.run),
        );
      }
    });

test('v6 retains explicit campaign style and optional independent whole-theme pin', async () => {
  for (const withVisual of [false, true]) {
    const f = fixture(),
      pin = { ...f.actor, style: 'campaign', presentation: null },
      saved = save(f, { actorAppearancePin: pin, visualThemePin: withVisual ? visual(f) : null });
    assert.equal(saved.actorAppearancePin.style, 'campaign');
    assert.equal(saved.actorAppearancePin.presentation, null);
    assert.deepEqual(saved.visualThemePin, withVisual ? visual(f) : null);
    const restored = await restoreSession(saved, options(f));
    assert.deepEqual(restored.session.actorAppearancePin, pin);
    assert.deepEqual(restored.session.visualThemePin, saved.visualThemePin);
  }
});

test('v6 supports both retained still and story envelopes', async () => {
  const f = fixture(),
    pictures = {
      ...f.pins,
      format: 'revealline-flight-pictures.v2',
      choices: f.pins.choices.map((picture) => ({ picture, story: null })),
    },
    saved = save(f, { presentationPins: pictures });
  assert.deepEqual(snapshotSession(saved), saved);
  assert.deepEqual((await restoreSession(saved, options(f))).session.presentationPins, pictures);
});

test('v6 keeps gp4 simulation revision separate from original actor and picture owners', async () => {
  const f = fixture('gentle'),
    tuning = resolveGameplayTuning('gentle'),
    tuned = applyGameplayTuning(f.level, tuning),
    runOptions = { classId: 'scout', classRecipes: CLASSES };
  f.flight.run = createRun(tuned, runOptions);
  f.flight.recorder = createRecorder(tuned, runOptions);
  const saved = save(f),
    restored = await restoreSession(saved, options(f));
  assert.match(saved.replay.level.revision, /^gp4/);
  assert.notEqual(saved.replay.level.revision, saved.presentationPins.levelRevision);
  assert.notEqual(
    saved.presentationPins.levelRevision,
    saved.actorAppearancePin.content.level.revision,
  );
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(f.flight.run));
  assert.throws(() => save(f, { presentationLevel: undefined }), /authored presentation level/);
});

test('old v1–v5 output shapes remain exact and absent actor pin never upgrades them', async () => {
  for (const version of [1, 2, 3, 4, 5]) {
    const build = () => {
      const f = fixture(),
        extra = {};
      if (version === 1) extra.continuation = undefined;
      if (version >= 3) extra.presentationPins = f.pins;
      if (version === 4)
        extra.presentationPins = {
          ...f.pins,
          format: 'revealline-flight-pictures.v2',
          choices: f.pins.choices.map((picture) => ({ picture, story: null })),
        };
      if (version === 5) extra.visualThemePin = visual(f);
      return { f, extra };
    };
    const { f, extra } = build(),
      saved = suspendSession({ ...f.flight, ...extra }),
      again = build(),
      explicitAbsent = suspendSession({
        ...again.f.flight,
        ...again.extra,
        actorAppearancePin: undefined,
      });
    assert.equal(saved.format, `xonix-session.v${version}`);
    assert.equal(JSON.stringify(saved), JSON.stringify(explicitAbsent));
    assert.deepEqual(
      Object.keys(saved).sort(),
      [
        'format',
        'campaignKey',
        'themeId',
        'bodyId',
        'runId',
        'savedAt',
        'replay',
        ...(version >= 2 ? ['continuation'] : []),
        ...(version >= 3 ? ['presentationPins'] : []),
        ...(version === 5 ? ['visualThemePin'] : []),
      ].sort(),
    );
    assert.deepEqual(snapshotSession(saved), saved);
    assert.equal((await restoreSession(saved, options(f))).session.format, saved.format);
    assert.throws(
      () => snapshotSession({ ...saved, actorAppearancePin: f.actor }),
      /unknown|not supported/i,
    );
  }
  const f = fixture();
  assert.throws(() =>
    suspendSession({ ...f.flight, presentationPins: f.pins, visualThemePin: null }),
  );
});

test('v6 requires strict flat pictures, actor pin, nullable whole-theme pin and continuation', () => {
  const f = fixture(),
    saved = save(f);
  for (const field of [
    'continuation',
    'presentationPins',
    'visualThemePin',
    'actorAppearancePin',
  ]) {
    const changed = structuredClone(saved);
    delete changed[field];
    assert.throws(() => snapshotSession(changed));
  }
  for (const changed of [
    { ...saved, actorAppearancePin: null },
    { ...saved, style: 'fpv' },
    { ...saved, session: saved },
    { ...saved, visualThemePin: {} },
  ])
    assert.throws(() => snapshotSession(changed));
  assert.throws(() => save(f, { presentationPins: undefined }), /authored Journey context/);
  assert.throws(() => save(f, { continuation: undefined }), /explicit continuation/);
});

test('actor mismatch is rejected before changing the live simulation or recording', () => {
  const f = fixture(),
    before = authoritativeCheckpoint(f.flight.run),
    recording = structuredClone(f.flight.recorder);
  for (const mutate of [
    (p) => {
      p.content.mode = 'versus';
    },
    (p) => {
      p.content.owner.baseCampaignKey = 'wrong';
    },
    (p) => {
      p.content.level.revision = 'wrong';
    },
  ]) {
    const actor = structuredClone(f.actor);
    mutate(actor);
    assert.throws(() => save(f, { actorAppearancePin: actor }), /original picture owner/);
    assert.deepEqual(authoritativeCheckpoint(f.flight.run), before);
    assert.deepEqual(f.flight.recorder, recording);
  }
});

test('matching forged actor and picture owner is still rejected by installed identity on restore', async () => {
  const f = fixture(),
    saved = structuredClone(save(f));
  saved.actorAppearancePin.content.owner.baseCampaignKey = 'forged-owner';
  for (const picture of saved.presentationPins.choices)
    picture.identity.baseCampaignKey = 'forged-owner';
  assert.doesNotThrow(() => snapshotSession(saved));
  await assert.rejects(restoreSession(saved, options(f)), /identity|owner|picture|context/i);
});

test('v6 save remains within unchanged local budget and grants only bounded import metadata', () => {
  assert.equal(SESSION_STORAGE_BYTES, 2 * 1024 * 1024);
  assert.equal(MAX_REPLAY_BYTES, 32 * 1024 * 1024);
  assert.equal(SESSION_IMPORT_BYTES, MAX_REPLAY_BYTES + 16384 + 8192);
  const saved = save(fixture()),
    storage = new Map();
  const result = saveSession({ setItem: (key, value) => storage.set(key, value) }, 'flight', saved);
  assert.equal(result.ok, true);
  assert.deepEqual(snapshotSession(storage.get('flight')), saved);
});

test('extra v6 import metadata never expands the embedded replay byte budget', () => {
  const saved = structuredClone(save(fixture()));
  // Bounded strings stay valid individually; together they exceed the existing
  // replay limit but fit in the larger outer v6 metadata envelope.
  saved.replay.testPadding = Array(128).fill('x'.repeat(262144));
  const encoded = JSON.stringify(saved);
  assert.ok(Buffer.byteLength(encoded) < SESSION_IMPORT_BYTES);
  assert.throws(() => snapshotSession(encoded), /replay exceeds its unchanged byte budget/);
});

test('historical envelopes retain their original import byte boundary', () => {
  const f = fixture(),
    old = JSON.stringify(suspendSession(f.flight)),
    bytes = MAX_REPLAY_BYTES + 16384;
  const padded = old + ' '.repeat(bytes + 1 - Buffer.byteLength(old));
  assert.ok(Buffer.byteLength(padded) < SESSION_IMPORT_BYTES);
  assert.throws(() => snapshotSession(padded), /exceeds its byte budget/);
});
