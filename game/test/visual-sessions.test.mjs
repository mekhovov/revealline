import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import {
  suspendSession,
  restoreSession,
  snapshotSession,
  saveSession,
  VISUAL_SESSION_FORMAT,
} from '../sessions.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { mediaFixture, libraryRecord } from './helpers/media-fixtures.mjs';
import { prepareAttemptExport } from '../attempt-export.mjs';
import { emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { prepareBackup, exportBackup } from '../backup.mjs';
import * as gp1 from '../gameplay-tuning-v1.mjs';
import * as gp2 from '../gameplay-tuning-v2.mjs';
import * as gp3 from '../gameplay-tuning-v3.mjs';
import * as gp4 from '../gameplay-tuning.mjs';
function fixture(mode = 'standard', turnPolicy = 'grid-center') {
  const f = mediaFixture(true),
    entry = f.catalog.entries.find((item) => item.difficulty === mode),
    library = validateMediaLibrary(libraryRecord(f.identity), f);
  const request = f.request(mode),
    pins = createPresentationPins({
      library,
      identityCatalog: f.identityCatalog,
      ...request,
      themeIds: ['fpv', 'ukraine', 'retro', 'network'],
    });
  const level = entry.campaign.levels[0],
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
  const flight = {
    run,
    recorder,
    campaignKey: entry.executionKey,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'pinned-flight',
    savedAt: '2026-09-13T08:00:00.000Z',
    continuation: { direction: 'right' },
  };
  return { ...f, entry, library, pins, flight, level };
}

function visualPin(f) {
  const identity = f.pins.choices.find(
    (choice) => choice.identity.themeId === f.flight.themeId,
  ).identity;
  return {
    format: 'revealline-visual-theme-pin.v1',
    content: {
      editionId: 'field-kit',
      contentThemeId: f.flight.themeId,
      mode: 'solo',
      owner: { kind: 'campaign', baseCampaignKey: identity.baseCampaignKey },
      level: { id: identity.levelId, revision: identity.levelRevision, sha256: 'a'.repeat(64) },
    },
    selection: { id: 'field-kit', revision: 1 },
    presentation: {
      source: { id: 'field-kit', revision: 2 },
      theme: { id: 'fpv', revision: 3 },
      collection: null,
      sha256: 'b'.repeat(64),
    },
  };
}
const options = (f) => ({
  campaign: f.entry.campaign,
  campaignKey: f.entry.executionKey,
  mediaIdentityCatalog: f.identityCatalog,
});
const savedFlight = (f, extra = {}) =>
  suspendSession({
    ...f.flight,
    presentationPins: f.pins,
    presentationLevel: f.level,
    visualThemePin: visualPin(f),
    ...extra,
  });
for (const mode of ['standard', 'gentle'])
  for (const turn of ['immediate', 'grid-center'])
    test(`v5 ${mode}/${turn}: preserves original artwork owner, full visual reference and continuing simulation`, async () => {
      const f = fixture(mode, turn),
        before = authoritativeCheckpoint(f.flight.run),
        recording = structuredClone(f.flight.recorder),
        pin = visualPin(f);
      const saved = savedFlight(f, { visualThemePin: pin });
      assert.equal(saved.format, VISUAL_SESSION_FORMAT);
      assert.deepEqual(authoritativeCheckpoint(f.flight.run), before);
      assert.deepEqual(f.flight.recorder, recording);
      assert.equal(verifyReplay(saved.replay).match, true);
      const promise = restoreSession(saved, options(f));
      pin.selection.revision = 77;
      saved.visualThemePin = {
        ...saved.visualThemePin,
        selection: { id: 'another', revision: 99 },
      };
      const restored = await promise;
      assert.deepEqual(restored.session.visualThemePin, visualPin(f));
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      for (const direction of ['right', 'right', 'down', 'left']) {
        const command = { direction, boost: false, action: false, pickup: false };
        stepRun(f.flight.run, command, FIXED_DT);
        stepRun(restored.run, command, FIXED_DT);
        assert.deepEqual(
          authoritativeCheckpoint(restored.run),
          authoritativeCheckpoint(f.flight.run),
        );
      }
      if (mode === 'gentle')
        assert.notEqual(
          f.pins.levelRevision,
          restored.session.visualThemePin.content.level.revision,
        );
    });

for (const [revision, tuning] of [
  ['gp1', gp1],
  ['gp2', gp2],
  ['gp3', gp3],
  ['gp4', gp4],
])
  for (const profile of [
    { mode: 'gentle', overrides: undefined },
    {
      mode: 'standard',
      overrides: { enemySpeed: 1.1, playerSpeed: 1, enemyDensity: 1 },
    },
  ])
    test(`v5 ${revision}/${profile.mode}${profile.overrides ? '/admin' : ''}: separates tuned simulation, authored pictures and visual owner`, async () => {
      const f = fixture(profile.mode),
        runOptions = { classId: 'scout', classRecipes: f.entry.campaign.classRecipes ?? CLASSES },
        recipe = tuning.resolveGameplayTuning(profile.mode, profile.overrides),
        tuned = tuning.applyGameplayTuning(f.level, recipe);
      f.flight.run = createRun(tuned, runOptions);
      f.flight.recorder = createRecorder(tuned, runOptions);
      const saved = savedFlight(f),
        checkpoint = authoritativeCheckpoint(f.flight.run),
        artworkRevision = visualPin(f).content.level.revision;
      assert.match(saved.replay.level.revision, new RegExp(`^${revision}`));
      assert.equal(saved.presentationPins.levelRevision, f.level.revision);
      assert.equal(saved.visualThemePin.content.level.revision, artworkRevision);
      assert.notEqual(saved.replay.level.revision, saved.presentationPins.levelRevision);
      if (profile.mode === 'gentle') {
        assert.notEqual(saved.presentationPins.levelRevision, artworkRevision);
        assert.notEqual(saved.replay.level.revision, artworkRevision);
      }
      assert.equal(recipe.adminOverride, !!profile.overrides);
      assert.deepEqual(snapshotSession(saved), saved);

      const restored = await restoreSession(saved, options(f));
      assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
      assert.deepEqual(restored.session.visualThemePin, visualPin(f));
      for (const direction of ['right', 'down', 'left', 'up']) {
        const command = { direction, boost: false, action: false, pickup: false };
        stepRun(f.flight.run, command, FIXED_DT);
        stepRun(restored.run, command, FIXED_DT);
        assert.deepEqual(
          authoritativeCheckpoint(restored.run),
          authoritativeCheckpoint(f.flight.run),
        );
      }

      assert.throws(
        () => savedFlight(f, { presentationLevel: undefined }),
        /authored presentation level/i,
      );
      const wrongAuthoredLevel = structuredClone(f.level);
      wrongAuthoredLevel.revision += '-other';
      assert.throws(
        () => savedFlight(f, { presentationLevel: wrongAuthoredLevel }),
        /Tuned picture source differs|presentation level/i,
      );
      const wrongPictures = structuredClone(f.pins);
      wrongPictures.levelRevision += '-other';
      assert.throws(
        () => savedFlight(f, { presentationPins: wrongPictures }),
        /matching flight identity/i,
      );

      const forgedPictures = structuredClone(saved);
      forgedPictures.presentationPins.levelRevision += '-other';
      assert.doesNotThrow(() => snapshotSession(forgedPictures));
      await assert.rejects(
        restoreSession(forgedPictures, options(f)),
        /different flight context|matching flight identity/i,
      );
      const alteredCampaign = structuredClone(f.entry.campaign);
      alteredCampaign.levels[0].goal.coverage += 0.01;
      await assert.rejects(
        restoreSession(saved, { ...options(f), campaign: alteredCampaign }),
        /Saved rules differ/i,
      );
      const forgedReplay = structuredClone(saved);
      forgedReplay.replay.level.goal.coverage = 0.99;
      await assert.rejects(restoreSession(forgedReplay, options(f)), /verification|rules differ/i);
    });

test('v5 retains still and story envelopes without changing v3/v4 output', async () => {
  const f = fixture();
  const story = {
    ...f.pins,
    format: 'revealline-flight-pictures.v2',
    choices: f.pins.choices.map((picture) => ({ picture, story: null })),
  };
  for (const presentationPins of [f.pins, story]) {
    const saved = savedFlight(f, { presentationPins });
    assert.deepEqual(snapshotSession(JSON.stringify(saved)), saved);
    assert.deepEqual(
      (await restoreSession(saved, options(f))).session.presentationPins,
      presentationPins,
    );
    assert.equal(
      suspendSession({ ...f.flight, presentationPins }).format,
      presentationPins === f.pins ? 'xonix-session.v3' : 'xonix-session.v4',
    );
  }
});

for (const [label, change] of [
  ['mode', (p) => (p.content.mode = 'team')],
  ['theme', (p) => (p.content.contentThemeId = 'retro')],
  ['owner', (p) => (p.content.owner.baseCampaignKey += '-other')],
  ['level', (p) => (p.content.level.id = 'other')],
  ['revision', (p) => (p.content.level.revision += '-other')],
  ['unknown field', (p) => (p.untrusted = true)],
  ['missing hash', (p) => delete p.presentation.sha256],
])
  test(`v5 rejects conflicting ${label} before touching simulation`, () => {
    const f = fixture(),
      pin = visualPin(f),
      before = authoritativeCheckpoint(f.flight.run),
      recording = structuredClone(f.flight.recorder);
    change(pin);
    assert.throws(() => savedFlight(f, { visualThemePin: pin }));
    assert.deepEqual(authoritativeCheckpoint(f.flight.run), before);
    assert.deepEqual(f.flight.recorder, recording);
  });

test('v5 requires pictures, continuation and a non-null pin; malformed writes preserve older save bytes', () => {
  const f = fixture(),
    saved = savedFlight(f),
    storage = {
      bytes: 'prior',
      setItem(key, bytes) {
        this.bytes = bytes;
      },
    };
  for (const key of ['presentationPins', 'continuation', 'visualThemePin']) {
    const bad = structuredClone(saved);
    delete bad[key];
    assert.throws(() => snapshotSession(bad));
    assert.equal(saveSession(storage, 'slot', bad).ok, false);
    assert.equal(storage.bytes, 'prior');
  }
  assert.throws(() => savedFlight(f, { visualThemePin: null }));
  assert.throws(() => savedFlight(f, { presentationPins: undefined }));
  assert.throws(() => savedFlight(f, { continuation: undefined }));
  assert.equal(
    saveSession(
      {
        setItem() {
          throw Error('quota');
        },
      },
      'slot',
      saved,
    ).ok,
    false,
  );
  assert.equal(saveSession(storage, 'slot', saved).ok, true);
  assert.deepEqual(JSON.parse(storage.bytes), saved);
});

test('matching forged visual and picture owners still fail against installed content', async () => {
  const f = fixture(),
    saved = structuredClone(savedFlight(f));
  saved.visualThemePin.content.owner.baseCampaignKey += '-other';
  for (const choice of saved.presentationPins.choices) choice.identity.baseCampaignKey += '-other';
  assert.doesNotThrow(() => snapshotSession(saved));
  await assert.rejects(restoreSession(saved, options(f)), /identity|catalog|owner|authored/i);
});

test('installed and replay-only rescue export preserve visual pins without granting asset readiness', async () => {
  const f = fixture(),
    saved = savedFlight(f);
  for (const config of [
    {},
    { campaign: f.entry.campaign, mediaIdentityCatalog: f.identityCatalog },
  ]) {
    const ready = await prepareAttemptExport(saved, config);
    assert.deepEqual(ready.session, saved);
    assert.equal(Object.isFrozen(ready.session.visualThemePin), true);
    assert.equal(ready.context, config.campaign ? 'installed-campaign' : 'replay-only');
  }
});

test('backup round trip retains visual metadata and requires authenticated picture identity', async () => {
  const f = fixture(),
    session = savedFlight(f),
    source = { library: emptyLibrary(), packs: emptyPackLibrary(), session };
  const before = structuredClone(source),
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
});
