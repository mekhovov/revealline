import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLASSES, FIXED_DT, createRun, getSummary, stepRun } from '../core/index.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { expandDifficultyCampaigns } from '../campaign-contexts.mjs';
import { emptyLibrary, importLibrary, campaignKey, recordLibraryCompletion } from '../library.mjs';
import { preparePack, resolvePackCampaign, emptyPackLibrary } from '../packs.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup, isPreparedBackup } from '../backup.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { createRecorder, recordInput, exportReplay, authoritativeCheckpoint } from '../replay.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const copy = (value) => structuredClone(value);
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
// Real decoding remains the host's responsibility. This adapter checks the
// preparation order using a valid tiny PNG header, without claiming pixel tests.
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const registered = {
  version: 'xonix-campaign.v1',
  id: 'backup-base',
  revision: '1',
  title: 'Registered base',
  classRecipes: copy(CLASSES),
  levels: [read('../content/campaign.json').levels[0]],
};
const rawPack = read('../content/packs/night-shift.json');
rawPack.id = 'gentle-backup-pack';
rawPack.campaigns = [
  {
    version: 'xonix-campaign.v1',
    id: 'gentle-backup-campaign',
    revision: '1',
    title: 'Included only',
    themeId: 'retro',
    levels: [
      {
        version: 'xonix-level.v1',
        id: 'gentle-backup-map',
        revision: '1',
        name: 'Portable crossing',
        width: 48,
        height: 36,
        spawn: { x: 24.5, y: 0.5 },
        walls: [],
        enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
        objectives: [],
        supplies: [],
        goal: { coverage: 0.3 },
      },
    ],
  },
];
rawPack.visualOverrides = { background: { name: 'tiny.png', dataUrl: png } };
rawPack.levelVisuals = [];
const preparedPack = (await preparePack(rawPack, { decodeImage })).pack;
const original = resolvePackCampaign(preparedPack, rawPack.campaigns[0].id).campaign;
const gentle = createDifficultyContext(original, 'gentle');
const stamp = '2026-09-12T12:00:00.000Z';
function flight(context = gentle, turnPolicy = 'immediate', ticks = 120) {
  const options = {
    classId: 'scout',
    classRecipes: context.campaign.classRecipes,
    turnPolicy,
    seed: 1,
  };
  const level = context.campaign.levels[0],
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (let tick = 0; tick < ticks; tick++) {
    assert.equal(run.status, 'running');
    stepRun(run, { direction: 'down' }, FIXED_DT);
    recordInput(recorder, { direction: 'down' });
  }
  assert.equal(run.status, 'running');
  assert.equal(run.player.cutting, true);
  return {
    run,
    session: suspendSession({
      run,
      recorder,
      campaignKey: context.campaignKey,
      runId: `included-gentle-${turnPolicy}`,
      themeId: 'retro',
      bodyId: 'retro-craft',
      savedAt: stamp,
    }),
  };
}
function collection(context = gentle) {
  const run = createRun(context.campaign.levels[0], {
    classId: 'scout',
    classRecipes: context.campaign.classRecipes,
  });
  while (run.status === 'running') stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  return recordLibraryCompletion(emptyLibrary(), {
    campaign: context.campaign,
    result: getSummary(run),
    runId: 'prior-gentle-clear',
    themeId: 'retro',
    bodyId: 'retro-craft',
    sourcePackId: rawPack.id,
    completedAt: stamp,
  });
}
function envelope(session = null, library = emptyLibrary()) {
  return {
    format: BACKUP_FORMAT,
    library,
    packs: { format: 'xonix-pack-library.v1', packs: [copy(rawPack)] },
    session,
  };
}

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: clean-host import derives a Gentle cut only from its included prepared pack`, async () => {
    const { run, session } = flight(gentle, turnPolicy),
      library = collection();
    const candidate = envelope(session, library),
      before = JSON.stringify(candidate);
    const conflictingCurrent = copy(original);
    conflictingCurrent.levels[0].goal.coverage = 0.9;
    const conflictingGentle = createDifficultyContext(conflictingCurrent, 'gentle');
    let decodes = 0,
      expansions = 0,
      fallbackCalls = 0;
    const options = {
      campaigns: [registered],
      decodeImage: async () => {
        decodes++;
        return decodeImage();
      },
      expandCampaigns(sources) {
        expansions++;
        assert.equal(decodes, 1, 'All included image preparation completes before expansion.');
        assert.ok(Object.isFrozen(sources));
        assert.ok(Object.isFrozen(sources[0].levels[0]));
        assert.deepEqual(sources.map(campaignKey), [
          campaignKey(registered),
          campaignKey(original),
        ]);
        assert.notEqual(sources[0], registered);
        assert.notEqual(sources[1], original);
        return expandDifficultyCampaigns(sources);
      },
      resolveCampaign() {
        fallbackCalls++;
        return conflictingGentle.campaign;
      },
    };
    const ready = await prepareBackup(candidate, options);
    assert.equal(expansions, 1);
    assert.equal(fallbackCalls, 0);
    assert.ok(isPreparedBackup(ready));
    assert.deepEqual(ready.library, library);
    assert.deepEqual(ready.session, session);
    assert.equal(ready.packs.packs[0].visualOverrides.background.dataUrl, png);
    assert.equal(JSON.stringify(candidate), before);
    const restored = await restoreSession(ready.session, {
      campaign: gentle.campaign,
      campaignKey: gentle.campaignKey,
    });
    assert.deepEqual(exportReplay(restored.recorder, restored.run), session.replay);
    for (let tick = 0; tick < 30; tick++) {
      stepRun(run, { direction: 'right' }, FIXED_DT);
      stepRun(restored.run, { direction: 'right' }, FIXED_DT);
    }
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    const exported = await exportBackup(ready, {
      campaigns: [registered],
      decodeImage,
      expandCampaigns: expandDifficultyCampaigns,
    });
    const reimported = await prepareBackup(exported, {
      campaigns: [registered],
      decodeImage,
      expandCampaigns: expandDifficultyCampaigns,
    });
    assert.deepEqual(reimported, ready);
  });

test('the optional hook preserves no-hook exports and does not silently recognize an omitted Gentle context', async () => {
  const standard = createDifficultyContext(original, 'standard');
  const candidate = envelope(flight(standard).session, collection(standard));
  const legacy = await prepareBackup(candidate, { decodeImage });
  const expanded = await prepareBackup(candidate, {
    decodeImage,
    expandCampaigns: expandDifficultyCampaigns,
  });
  assert.deepEqual(expanded, legacy);
  assert.equal(
    await exportBackup(legacy, { decodeImage }),
    await exportBackup(expanded, { decodeImage, expandCampaigns: expandDifficultyCampaigns }),
  );
  await assert.rejects(
    prepareBackup(envelope(flight().session), { decodeImage }),
    /matching included/,
  );
});

test('expansion sees fully prepared originals and never runs after a failed pack or image', async () => {
  let called = 0;
  const options = {
    decodeImage,
    expandCampaigns: () => {
      called++;
      return [];
    },
  };
  const malformed = envelope();
  malformed.packs.packs[0].engine = 'unregistered';
  await assert.rejects(prepareBackup(malformed, options));
  await assert.rejects(
    prepareBackup(envelope(), {
      ...options,
      decodeImage: async () => {
        throw new Error('image failed');
      },
    }),
    /image failed/,
  );
  assert.equal(called, 0);
});

test('non-function expanders reject before image decoding and cannot be supplied inside a backup', async () => {
  let decodes = 0;
  for (const expandCampaigns of [null, false, 1, 'gentle', [], {}])
    await assert.rejects(
      prepareBackup(envelope(), {
        decodeImage: async () => {
          decodes++;
          return decodeImage();
        },
        expandCampaigns,
      }),
      /trusted function/,
    );
  assert.equal(decodes, 0);
  await assert.rejects(
    prepareBackup({ ...envelope(), expandCampaigns: [] }, { decodeImage }),
    /not supported/,
  );
});

test('malformed, asynchronous, accessor, cyclic and over-count hook results fail without invoking getters', async () => {
  let reads = 0;
  const accessor = copy(original);
  Object.defineProperty(accessor, 'title', {
    enumerable: true,
    get() {
      reads++;
      return 'getter';
    },
  });
  const cyclic = [];
  cyclic.push(cyclic);
  const sparse = new Array(1);
  const invalidId = copy(original);
  invalidId.id = '../bad';
  const oversized = copy(original);
  oversized.title = 'x'.repeat(65537);
  const executable = copy(original);
  executable.run = () => {};
  const inherited = Object.assign(Object.create({ inherited: true }), original);
  const badLevel = copy(original);
  badLevel.levels[0].version = 'xonix-level.v999';
  const values = [
    undefined,
    null,
    {},
    Promise.resolve([]),
    [accessor],
    cyclic,
    sparse,
    [invalidId],
    [oversized],
    [executable],
    [inherited],
    [badLevel],
    Array(209).fill(original),
  ];
  for (const output of values)
    await assert.rejects(prepareBackup(envelope(), { decodeImage, expandCampaigns: () => output }));
  assert.equal(reads, 0);
});

test('owned expansion input and output resist mutation during decode and replay progress', async () => {
  const session = flight().session,
    source = envelope(session),
    originalBytes = JSON.stringify(source);
  const hostBase = copy(registered);
  let release,
    hookInputs,
    returned,
    progress = 0;
  const pending = prepareBackup(source, {
    campaigns: [hostBase],
    decodeImage: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    expandCampaigns(sources) {
      hookInputs = sources;
      assert.throws(() => {
        sources[0].levels[0].goal.coverage = 0.99;
      }, TypeError);
      returned = copy(expandDifficultyCampaigns(sources));
      return returned;
    },
    onProgress() {
      progress++;
      for (const campaign of returned) campaign.levels[0].goal.coverage = 0.99;
      returned.length = 0;
    },
  });
  hostBase.levels[0].goal.coverage = 0.95;
  source.session.runId = 'late-edit';
  source.packs.packs[0].campaigns[0].levels[0].goal.coverage = 0.95;
  release({ naturalWidth: 1, naturalHeight: 1 });
  const ready = await pending;
  assert.ok(progress > 0);
  assert.equal(campaignKey(hookInputs[0]), campaignKey(registered));
  assert.deepEqual(ready.session, JSON.parse(originalBytes).session);
  assert.deepEqual(ready.packs.packs[0], JSON.parse(originalBytes).packs.packs[0]);
  assert.ok(Object.isFrozen(ready.session));
});

test('expanded campaigns tighten final progress validation even without a suspended attempt', async () => {
  const library = collection(),
    key = gentle.campaignKey;
  const clear = library.campaigns[key].clears[gentle.campaign.levels[0].id];
  library.campaigns[key].clears['not-in-the-pack'] = copy(clear);
  assert.deepEqual(
    importLibrary(library),
    library,
    'Unknown campaign records remain portable metadata.',
  );
  const candidate = envelope(null, library),
    before = JSON.stringify(candidate);
  assert.ok(await prepareBackup(candidate, { decodeImage }));
  await assert.rejects(
    prepareBackup(candidate, { decodeImage, expandCampaigns: expandDifficultyCampaigns }),
    /progress does not match/,
  );
  assert.equal(JSON.stringify(candidate), before);
});

test('wrong derived keys and self-consistent different campaign rules cannot restore as included Gentle content', async () => {
  const wrongKey = envelope(flight().session);
  wrongKey.session.campaignKey =
    gentle.campaignKey.slice(0, -1) + (gentle.campaignKey.endsWith('0') ? '1' : '0');
  await assert.rejects(
    prepareBackup(wrongKey, { decodeImage, expandCampaigns: expandDifficultyCampaigns }),
    /matching included/,
  );
  const changed = copy(original);
  changed.levels[0].goal.coverage = 0.9;
  const alternate = createDifficultyContext(changed, 'gentle');
  const forged = envelope(flight(alternate).session);
  forged.session.campaignKey = gentle.campaignKey;
  await assert.rejects(
    prepareBackup(forged, { decodeImage, expandCampaigns: expandDifficultyCampaigns }),
    /rules differ/,
  );
});

test('registered-original versus included-derived identity collisions reject before adoption', async () => {
  const candidate = envelope(flight().session),
    before = JSON.stringify(candidate);
  // This exact Gentle execution object is authored as a separate Standard base.
  // The supplied expander must reject the ambiguous owner rather than merge it.
  await assert.rejects(
    prepareBackup(candidate, {
      campaigns: [gentle.campaign],
      decodeImage,
      expandCampaigns: expandDifficultyCampaigns,
    }),
    /different base\/difficulty owners/,
  );
  assert.equal(JSON.stringify(candidate), before);
});

test('cancellation in expansion or the final verification callback never returns an adoptable backup', async () => {
  const inHook = new AbortController();
  await assert.rejects(
    prepareBackup(envelope(), {
      signal: inHook.signal,
      decodeImage,
      expandCampaigns(sources) {
        inHook.abort();
        return expandDifficultyCampaigns(sources);
      },
    }),
    { name: 'AbortError' },
  );
  const inProgress = new AbortController();
  let observed = 0,
    finalTicks = null;
  await assert.rejects(
    prepareBackup(envelope(flight().session), {
      signal: inProgress.signal,
      decodeImage,
      expandCampaigns: expandDifficultyCampaigns,
      onProgress(value) {
        observed++;
        if (value.ticks === value.total) {
          finalTicks = value.ticks;
          inProgress.abort();
        }
      },
    }),
    { name: 'AbortError' },
  );
  assert.ok(observed > 0);
  assert.equal(finalTicks, 120);
});

test('a missing included pack stays unresolved without a trusted host resolver', async () => {
  const candidate = envelope(flight().session);
  candidate.packs = emptyPackLibrary();
  await assert.rejects(
    prepareBackup(candidate, {
      campaigns: [registered],
      expandCampaigns: expandDifficultyCampaigns,
    }),
    /matching included/,
  );
});
