import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import {
  emptyLibrary,
  importLibrary,
  exportLibrary,
  recordLibraryCompletion,
} from '../library.mjs';
import { emptyPackLibrary, preparePack, resolvePackCampaign } from '../packs.mjs';
import { createExecutionCatalog, expandDifficultyCampaigns } from '../campaign-contexts.mjs';
import { createMediaIdentityCatalog, validateMediaLibrary } from '../media-library.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import {
  createStoredStillIdentityCatalog,
  validateStoredStillMedia,
} from '../media-storage-record.mjs';
import { validatePictureReceiptOwners } from '../picture-receipts.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup, isPreparedBackup } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { prepareProfileTransfer, transferFingerprint } from '../profile-transfer.mjs';
import { mediaFixture, libraryRecord, deferred, pngBytes } from './helpers/media-fixtures.mjs';

// Original bytes remain in .rlmedia. This suite explicitly supplies image-free
// metadata and modeled storage/locks; it does not assert byte availability.
function fixture(
  mode = 'standard',
  turnPolicy = 'grid-center',
  base = mediaFixture(true).campaign,
) {
  const themes = ['fpv', 'retro'].map((id) => ({ id })),
    catalog = createExecutionCatalog([{ campaign: base, themes }]),
    identityCatalog = createMediaIdentityCatalog(catalog),
    entry = catalog.entries.find((item) => item.difficulty === mode),
    level = entry.campaign.levels[0],
    request = {
      executionKey: entry.executionKey,
      levelId: level.id,
      levelRevision: level.revision,
      themeId: 'fpv',
    },
    identity = identityCatalog.resolve(request),
    media = validateMediaLibrary(libraryRecord(identity), { identityCatalog }),
    pins = createPresentationPins({
      library: media,
      identityCatalog,
      ...request,
      themeIds: ['fpv', 'retro'],
    });
  let library = emptyLibrary();
  for (const owned of catalog.entries) {
    const winning = createRun(owned.campaign.levels[0], {
      classRecipes: owned.campaign.classRecipes ?? CLASSES,
      turnPolicy,
      seed: 4,
    });
    while (winning.status === 'running' && winning.tick < 1000)
      stepRun(winning, { direction: 'down' }, FIXED_DT);
    assert.equal(winning.status, 'won');
    const presentationPins = createPresentationPins({
      library: media,
      identityCatalog,
      executionKey: owned.executionKey,
      levelId: winning.level.id,
      levelRevision: winning.level.revision,
      themeIds: ['fpv', 'retro'],
    });
    library = recordLibraryCompletion(library, {
      campaign: owned.campaign,
      result: getSummary(winning),
      themeId: 'fpv',
      bodyId: 'fpv-body',
      runId: `earned-${owned.difficulty}`,
      completedAt: '2026-09-13T10:00:00.000Z',
      presentationPins,
      mediaIdentityCatalog: identityCatalog,
    });
  }
  const options = { classRecipes: entry.campaign.classRecipes ?? CLASSES, turnPolicy, seed: 9 },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const direction of [...Array(13).fill('down'), 'right']) {
    const command = { direction };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  }
  const flight = {
    run,
    recorder,
    campaignKey: entry.executionKey,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'unfinished-pinned-flight',
    savedAt: '2026-09-13T11:00:00.000Z',
    continuation: { direction: 'right' },
  };
  const session = suspendSession({ ...flight, presentationPins: pins });
  return {
    base,
    catalog,
    identityCatalog,
    entry,
    media,
    library,
    run,
    flight,
    session,
    pins,
    source: { format: BACKUP_FORMAT, library, packs: emptyPackLibrary(), session },
    options: {
      campaigns: [base],
      expandCampaigns: expandDifficultyCampaigns,
      resolveMediaIdentityCatalog: () => identityCatalog,
    },
  };
}

function target() {
  const local = new Map(),
    assets = new Map(),
    writes = [];
  const storage = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(['local', key]);
      local.set(key, value);
    },
    removeItem: (key) => {
      writes.push(['remove', key]);
      local.delete(key);
    },
  };
  const adapters = {
    storage,
    profileKey: 'target-profile',
    sessionKey: 'target-session',
    packsKey: 'target-packs',
    journalKey: 'target-journal',
    readAsset: async (key) => assets.get(key) ?? null,
    writeAsset: async (key, value) => {
      writes.push(['asset', key]);
      if (value === null) assets.delete(key);
      else assets.set(key, value);
      return { ok: true };
    },
    withLock: async (task) => task(),
    commitProfile: async (library, options) => {
      assert.equal(options.mode, 'replace');
      assert.equal(local.get(options.writeLock.key), options.writeLock.token);
      storage.setItem('target-profile', exportLibrary(library));
      return { ok: true, library };
    },
  };
  return { local, assets, writes, adapters };
}
function transferSource(f, { library = f.library, session = f.session } = {}) {
  const id = 'release-v0.31.0',
    prefix = `revealline.library.${id}.v1`,
    keys = {
      profile: prefix,
      session: `revealline.suspended.${id}.v1`,
      packs: `revealline.packs.${id}.v1`,
      writer: `${prefix}.writer`,
      lock: `${prefix}.backup-lock`,
      journal: `${prefix}.backup-journal`,
    },
    local = new Map(),
    assets = new Map(),
    held = new Set(),
    reads = [];
  if (library) local.set(keys.profile, exportLibrary(library));
  if (session) local.set(keys.session, JSON.stringify(session));
  assets.set(keys.packs, JSON.stringify(f.source.packs));
  const read = (map, key) => {
    assert.deepEqual(held, new Set([keys.writer, keys.lock]));
    reads.push(key);
    return map.get(key) ?? null;
  };
  const options = {
    ...f.options,
    currentVersion: '0.32.0',
    storage: {
      getItem: (key) => read(local, key),
      setItem: () => assert.fail('source write'),
      removeItem: () => assert.fail('source remove'),
    },
    readAsset: async (key) => read(assets, key),
    lockManager: {
      async request(key, options, task) {
        assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
        assert.equal(held.has(key), false);
        held.add(key);
        try {
          return await task({ name: key });
        } finally {
          held.delete(key);
        }
      },
    },
  };
  return { id, keys, local, assets, held, reads, options };
}

for (const mode of ['standard', 'gentle'])
  for (const policy of ['immediate', 'grid-center'])
    test(`${mode}/${policy}: real pinned cut and earned receipts roundtrip backup with exact verified owner catalog`, async () => {
      const f = fixture(mode, policy),
        source = structuredClone(f.source),
        before = structuredClone(source);
      let calls = 0;
      const options = {
        ...f.options,
        resolveMediaIdentityCatalog: (context) => {
          calls++;
          assert.ok(Object.isFrozen(context));
          assert.ok(Object.isFrozen(context.originals[0].levels[0]));
          assert.deepEqual(context.originals, [f.base]);
          assert.deepEqual(context.campaigns, expandDifficultyCampaigns([f.base]));
          assert.deepEqual(context.packs, emptyPackLibrary());
          return createMediaIdentityCatalog(
            createExecutionCatalog(
              context.originals.map((campaign) => ({
                campaign,
                themes: [{ id: 'fpv' }, { id: 'retro' }],
              })),
            ),
          );
        },
      };
      const prepared = await prepareBackup(source, options);
      const roundtrip = await prepareBackup(await exportBackup(prepared, options), options);
      assert.equal(calls, 3);
      assert.equal(isPreparedBackup(roundtrip), true);
      assert.equal(roundtrip.library.format, 'xonix-library.v3');
      assert.equal(roundtrip.session.format, 'xonix-session.v3');
      assert.deepEqual(roundtrip.library.pictureReceipts, f.library.pictureReceipts);
      assert.deepEqual(roundtrip.session.presentationPins, f.pins);
      const restored = await restoreSession(roundtrip.session, {
        campaign: f.entry.campaign,
        campaignKey: f.entry.executionKey,
        mediaIdentityCatalog: f.identityCatalog,
      });
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(f.run));
      for (let tick = 0; tick < 40; tick++) {
        stepRun(f.run, { direction: 'right' }, FIXED_DT);
        stepRun(restored.run, { direction: 'right' }, FIXED_DT);
      }
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(f.run));
      assert.deepEqual(source, before);
    });

test('ownership factory sees only owned prepared included packs after awaited decoding and exact Gentle expansion', async () => {
  const raw = JSON.parse(
    readFileSync(new URL('../content/packs/classic-lab.json', import.meta.url)),
  );
  raw.campaigns = [
    {
      ...mediaFixture(true).campaign,
      title: 'Injected ownership pack',
      themeId: 'fpv',
      musicId: raw.campaigns[0].musicId,
    },
  ];
  raw.levelVisuals = [];
  raw.masteries = [];
  const basePack = (await preparePack(raw)).pack,
    base = resolvePackCampaign(basePack, basePack.campaigns[0].id).campaign,
    f = fixture('gentle', 'grid-center', base),
    delayed = deferred(),
    began = deferred();
  const candidate = structuredClone(f.source);
  const dataUrl = `data:image/png;base64,${pngBytes().toString('base64')}`;
  raw.visualOverrides.background = { dataUrl, fit: 'contain' };
  candidate.packs.packs = [raw];
  const pending = prepareBackup(candidate, {
    campaigns: [],
    expandCampaigns: expandDifficultyCampaigns,
    decodeImage: async () => {
      began.resolve();
      await delayed.promise;
      return { naturalWidth: 1, naturalHeight: 1 };
    },
    resolveMediaIdentityCatalog: (context) => {
      assert.deepEqual(context.originals, [base]);
      assert.deepEqual(context.campaigns, expandDifficultyCampaigns([base]));
      assert.equal(context.packs.packs[0].visualOverrides.background.dataUrl, dataUrl);
      assert.ok(Object.isFrozen(context.packs.packs[0].campaigns[0].levels[0]));
      return createMediaIdentityCatalog(
        createExecutionCatalog(
          context.originals.map((campaign) => ({
            campaign,
            themes: context.packs.packs[0].themes,
          })),
        ),
      );
    },
  });
  await began.promise;
  raw.campaigns[0].levels[0].revision = 'caller-mutated-after-start';
  delayed.resolve();
  const prepared = await pending;
  assert.deepEqual(prepared.session, f.session);
  assert.equal(prepared.packs.packs[0].campaigns[0].levels[0].revision, 'authored-1');
});

test('pack-absent earned Standard/Gentle receipts validate from JSON-rehydrated historical owners without installing content', async () => {
  const f = fixture(),
    stored = validateStoredStillMedia({
      format: 'revealline-still-storage.v1',
      owners: [
        {
          campaign: {
            ...f.base,
            levels: f.base.levels.map(normalizedLevel),
            classRecipes: CLASSES,
          },
          themeIds: ['fpv', 'retro'],
        },
      ],
      library: f.media,
      legacy: { format: 'revealline-managed-bytes.v1', items: [] },
    });
  const historical = createStoredStillIdentityCatalog(JSON.stringify(stored));
  const prepared = await prepareBackup(
    { ...f.source, session: null },
    {
      campaigns: [],
      resolveMediaIdentityCatalog: (context) => {
        assert.deepEqual(context.originals, []);
        assert.deepEqual(context.campaigns, []);
        return historical;
      },
    },
  );
  assert.deepEqual(prepared.library.pictureReceipts, f.library.pictureReceipts);
  assert.deepEqual(prepared.packs, emptyPackLibrary());
  assert.deepEqual(
    validatePictureReceiptOwners(
      prepared.library.pictureReceipts,
      prepared.library.gallery,
      historical,
    ),
    f.library.pictureReceipts,
  );
});

test('v3 session or earned receipt requires explicit synchronous branded owner resolver; refusal precedes target writes', async () => {
  const f = fixture(),
    destination = target();
  for (const source of [
    f.source,
    { ...f.source, session: null },
    { ...f.source, library: emptyLibrary() },
  ])
    for (const resolver of [undefined, {}, () => ({}), async () => f.identityCatalog]) {
      await assert.rejects(async () => {
        const prepared = await prepareBackup(source, {
          ...f.options,
          resolveMediaIdentityCatalog: resolver,
        });
        await commitBackup(prepared, destination.adapters);
      }, /picture|resolver|catalog/);
      assert.deepEqual(destination.writes, []);
    }
});

test('foreign authored-owner and revision cannot pass same-map/world/hash receipt checks or reach commit', async () => {
  const f = fixture('gentle'),
    destination = target();
  for (const kind of ['session', 'receipt'])
    for (const field of ['baseCampaignKey', 'levelRevision']) {
      const source = structuredClone(f.source);
      if (kind === 'session')
        for (const pin of source.session.presentationPins.choices)
          pin.identity[field] += '-foreign';
      else {
        source.session = null;
        source.library.pictureReceipts[1].presentationPin.identity[field] += '-foreign';
      }
      await assert.rejects(async () => {
        const prepared = await prepareBackup(source, f.options);
        await commitBackup(prepared, destination.adapters);
      }, /owner|authored/);
      assert.deepEqual(destination.writes, []);
    }
  const empty = createMediaIdentityCatalog(createExecutionCatalog([]));
  await assert.rejects(
    prepareBackup(f.source, { ...f.options, resolveMediaIdentityCatalog: () => empty }),
    /authored map/,
  );
});

test('read-only earlier-release transfer retains v3 identities, fingerprint and source locks then supports explicit target commit/Undo', async () => {
  const f = fixture('gentle'),
    source = transferSource(f),
    original = structuredClone({ local: source.local, assets: source.assets });
  const review = await prepareProfileTransfer(source.id, source.options);
  assert.deepEqual(review.prepared.library.pictureReceipts, f.library.pictureReceipts);
  assert.deepEqual(review.prepared.session, f.session);
  assert.equal(review.preview.pictures, 2);
  assert.equal(review.preview.hasSession, true);
  assert.equal(review.fingerprint, await transferFingerprint(review.prepared));
  assert.deepEqual(
    (await prepareProfileTransfer(source.id, source.options)).fingerprint,
    review.fingerprint,
  );
  assert.deepEqual({ local: source.local, assets: source.assets }, original);
  assert.equal(source.held.size, 0);
  const destination = target(),
    previous = await prepareBackup({
      format: BACKUP_FORMAT,
      library: emptyLibrary(),
      packs: emptyPackLibrary(),
      session: null,
    });
  assert.equal((await commitBackup(previous, destination.adapters)).ok, true);
  assert.equal((await commitBackup(review.prepared, destination.adapters)).ok, true);
  assert.deepEqual(
    importLibrary(destination.local.get('target-profile')).pictureReceipts,
    f.library.pictureReceipts,
  );
  assert.deepEqual(JSON.parse(destination.local.get('target-session')), f.session);
  assert.equal(destination.assets.has('target-journal'), false);
  assert.equal((await commitBackup(previous, destination.adapters)).ok, true);
  assert.deepEqual(importLibrary(destination.local.get('target-profile')), emptyLibrary());
  assert.equal(destination.local.has('target-session'), false);
  assert.deepEqual({ local: source.local, assets: source.assets }, original);
});

test('transfer rejects missing/foreign owner resolver and cancellation without fingerprint or source/target writes', async () => {
  const f = fixture(),
    destination = target();
  for (const issue of ['missing', 'foreign', 'abort']) {
    const source = transferSource(f),
      original = structuredClone({ local: source.local, assets: source.assets }),
      cancel = new AbortController();
    const options = {
      ...source.options,
      signal: cancel.signal,
      digest: () => assert.fail('rejected review fingerprint'),
    };
    if (issue === 'missing') options.resolveMediaIdentityCatalog = undefined;
    if (issue === 'foreign')
      options.resolveMediaIdentityCatalog = () =>
        createMediaIdentityCatalog(createExecutionCatalog([]));
    if (issue === 'abort')
      options.resolveMediaIdentityCatalog = () => {
        cancel.abort();
        return f.identityCatalog;
      };
    await assert.rejects(async () => {
      const review = await prepareProfileTransfer(source.id, options);
      await commitBackup(review.prepared, destination.adapters);
    }, /picture|authored|cancel/);
    assert.deepEqual(destination.writes, []);
    assert.deepEqual({ local: source.local, assets: source.assets }, original);
    assert.equal(source.held.size, 0);
  }
});

test('old v1/v2 libraries and sessions retain their normalized formats and never require or call a picture resolver', async () => {
  const f = fixture();
  for (const version of [1, 2]) {
    const library = structuredClone(emptyLibrary());
    if (version === 1) {
      library.format = 'xonix-library.v1';
      delete library.masteries;
    }
    const { continuation, ...withoutIntent } = f.flight;
    const session = suspendSession(version === 1 ? withoutIntent : f.flight);
    assert.equal(session.format, `xonix-session.v${version}`);
    const source = { format: BACKUP_FORMAT, library, packs: emptyPackLibrary(), session };
    const options = {
      ...f.options,
      resolveMediaIdentityCatalog: () => assert.fail('legacy resolver'),
    };
    const prepared = await prepareBackup(
      await exportBackup({ library, packs: source.packs, session }, options),
      options,
    );
    assert.deepEqual(prepared.library, importLibrary(library));
    assert.deepEqual(prepared.session, session);
    const from = transferSource(f, { library: importLibrary(library), session });
    const review = await prepareProfileTransfer(from.id, {
      ...from.options,
      resolveMediaIdentityCatalog: options.resolveMediaIdentityCatalog,
    });
    assert.deepEqual(review.prepared.session, session);
    assert.equal(Object.hasOwn(review.prepared.library, 'pictureReceipts'), false);
  }
});

test('dynamic saved campaign resolves before the picture factory receives its owned exact execution', async () => {
  const f = fixture(),
    order = [],
    resolved = structuredClone(f.base);
  const source = { ...f.source, library: emptyLibrary() };
  const options = {
    campaigns: [],
    resolveCampaign: (key) => {
      order.push('campaign');
      assert.equal(key, f.entry.executionKey);
      return resolved;
    },
    resolveMediaIdentityCatalog: (context) => {
      order.push('pictures');
      assert.deepEqual(context.campaigns, [f.base]);
      assert.notEqual(context.campaigns[0], resolved);
      assert.ok(Object.isFrozen(context.campaigns[0].levels[0]));
      return createMediaIdentityCatalog(
        createExecutionCatalog(
          context.campaigns.map((campaign) => ({
            campaign,
            themes: [{ id: 'fpv' }, { id: 'retro' }],
          })),
        ),
      );
    },
  };
  const prepared = await prepareBackup(source, options);
  assert.deepEqual(order, ['campaign', 'pictures']);
  assert.deepEqual(prepared.session, f.session);
  assert.equal(Object.isFrozen(resolved), false);
});
