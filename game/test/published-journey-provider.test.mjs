import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';
import { exportReplayPresentation } from '../replay-presentation.mjs';
import { ACTOR_APPEARANCE_RELEASES } from '../presentation/actor-appearance-lease.mjs';
import { addAuthoredRuntimeSnapshots } from '../../scripts/authored-runtime-snapshots.mjs';
import { loadRouteSnapshot, loadPublishedChapter } from '../content-design/route-snapshot.mjs';
import { createSoloRouteHost } from '../content-design/solo-route-host.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { publishedRouteViews } from '../content-design/published-journey.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';
import { publishedJourneyLibrarySources } from '../mission-library/published-routes.mjs';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import { duelExpeditionLibrarySources } from '../mission-library/multiplayer-expeditions.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const entries = [
  {
    name: 'game/content-design/route-loader.mjs',
    bytes: await readFile(new URL('../content-design/route-loader.mjs', import.meta.url)),
  },
];
const generated = await addAuthoredRuntimeSnapshots(entries);
const files = new Map(
  entries.map((entry) => [entry.name.replace('game/content-design/', ''), entry.bytes]),
);
const transport = async (path) => new Response(files.get(path));
const route = await loadRouteSnapshot(generated.navigationDescriptor, { fetchAsset: transport });
const themes = journeyActorThemeCandidates(
  JSON.parse(await readFile(new URL('../content-design/themes.json', import.meta.url))).themes,
  { includeOriginals: true },
);
const original = createCandidateSoloHost(generated.route.source, {
  themes,
  corePackIds: generated.route.corePackIds,
  optionalCampaignIds: generated.route.optionalCampaignIds,
});

function librarySources(selectedRoute, difficulty, launchRemote = (context) => context) {
  return publishedJourneyLibrarySources({
    route: selectedRoute,
    views: publishedRouteViews(selectedRoute),
    difficulty,
    launchSolo: () => {
      throw new Error('Remote metadata cannot launch a local Solo run.');
    },
    launchRemote,
  });
}

async function alteredPublishedRoute(mutate) {
  const value = structuredClone(generated.published);
  mutate(value.navigation);
  const bytes = Buffer.from(JSON.stringify(value));
  return loadRouteSnapshot(
    {
      ...generated.navigationDescriptor,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    { fetchAsset: async () => new Response(bytes) },
  );
}

test('published remote browsing matches every native Team and Duel owner, mission, preset and handoff in both languages', async (context) => {
  const previousLocale = getLocale();
  let difficulty = 'standard';
  try {
    for (const locale of ['en', 'uk']) {
      setLocale(locale, { persist: false });
      const native = [
        ...createRemoteTeamLibrarySources({
          launch: (value) => value,
          difficulty: () => difficulty,
        }),
        ...duelExpeditionLibrarySources({
          themes,
          activeRouteId: route.id,
          launch: (value) => value,
          difficulty: () => difficulty,
        }),
      ];
      const sources = librarySources(route, () => difficulty);
      const actual = sources.slice(1 + publishedRouteViews(route).archives.length);
      assert.deepEqual(
        actual.map((source) => source.id),
        native.map((source) => source.id),
      );
      for (const [index, expected] of native.entries()) {
        const source = actual[index];
        for (const key of [
          'id',
          'editionId',
          'edition',
          'collection',
          'lifecycle',
          'automaticContinuation',
        ])
          assert.equal(source[key], expected[key], `${locale} ${source.id} ${key}`);
        assert.equal(source.entries.length, expected.entries.length, source.id);
        if (source.collection !== 'Journey') continue; // Classic arena projection is unchanged.
        assert.deepEqual(source.entries, expected.entries, source.id);
        for (difficulty of ['gentle', 'standard', 'expert']) {
          for (const [ordinal, mission] of source.entries.entries()) {
            const nativeMission = expected.entries[ordinal];
            const label = `${locale} ${source.id} ${mission.id} ${difficulty}`;
            assert.deepEqual(source.describe(mission), expected.describe(nativeMission), label);
            assert.deepEqual(
              source.presentation(mission),
              expected.presentation(nativeMission),
              label,
            );
            assert.deepEqual(source.details(mission), expected.details(nativeMission), label);
            assert.deepEqual(source.card(mission), expected.card(nativeMission), label);
            assert.equal(
              source.progress(mission, mission.modes[0]),
              expected.progress(nativeMission, mission.modes[0]),
              label,
            );
            assert.deepEqual(
              source.progressState(mission, mission.modes[0]),
              expected.progressState(nativeMission, mission.modes[0]),
              label,
            );
          }
          const mission = source.entries[0];
          const handoff = { mode: mission.modes[0], libraryMissionId: mission.id, difficulty };
          assert.equal(source.launch(mission, handoff), handoff);
          assert.equal(expected.launch(expected.entries[0], handoff), handoff);
        }
      }
    }
    assert.ok(generated.navigationDescriptor.bytes < 8 * 1024 * 1024);
    context.diagnostic(
      `Complete pinned navigation: ${generated.navigationDescriptor.bytes} bytes; existing 8 MiB limit unchanged.`,
    );
  } finally {
    setLocale(previousLocale, { persist: false });
  }
});

test('published preset tags retain native Team and Hunt selection while Duel Expedition tags stay authored', async () => {
  const tagged = await alteredPublishedRoute((navigation) => {
    for (const projection of [
      navigation.team.view,
      ...navigation.supplemental.map((row) => row.view),
    ])
      for (const presets of Object.values(projection.presentations))
        for (const [difficulty, presentation] of Object.entries(presets))
          presentation.tags = [difficulty];
  });
  const sources = librarySources(tagged, () => 'expert');
  for (const source of sources.filter((row) =>
    [
      'journey:team-expedition-v1',
      'team-journey:humanoid-hunt-v1',
      'journey:humanoid-hunt-v1',
      'journey:team-cultural-specialist-originals-2',
      'journey:duel-expedition-v1',
    ].includes(row.id),
  )) {
    assert.deepEqual(
      source.describe(source.entries[0]).tags,
      [source.id === 'journey:duel-expedition-v1' ? 'standard' : 'expert'],
      source.id,
    );
  }
});

test('older published navigation retains its fallback and incomplete supplemental ownership fails closed', async () => {
  const legacy = await alteredPublishedRoute((navigation) => delete navigation.supplemental);
  assert.equal(publishedRouteViews(legacy).supplemental, undefined);
  assert.equal(
    librarySources(legacy, () => 'standard').length,
    librarySources(route, () => 'standard').length - route.navigation.supplemental.length,
  );
  for (const mutate of [
    (navigation) => navigation.supplemental.pop(),
    (navigation) => {
      navigation.supplemental = [];
    },
    (navigation) => {
      navigation.supplemental[1].sourceId = navigation.supplemental[2].sourceId;
    },
    (navigation) => {
      navigation.supplemental[1].mode = 'versus';
    },
    (navigation) => {
      delete navigation.supplemental[1].automaticContinuation;
    },
    (navigation) => {
      navigation.supplemental[0].view.campaigns[0].modes = ['solo'];
    },
  ]) {
    const invalid = await alteredPublishedRoute(mutate);
    assert.throws(() => publishedRouteViews(invalid), /supplemental/);
  }
});

test('published Solo materializes only Horizon and preserves full navigation, cards and exact execution identity', async () => {
  const fetched = [],
    approvals = [];
  const host = await createSoloRouteHost(route, {
    themes,
    fetchAsset: async (path) => {
      fetched.push(path);
      return transport(path);
    },
    ensurePackage: async (id, options) => {
      approvals.push({ id, retain: options.retain });
    },
  });
  try {
    assert.equal(route.source, undefined);
    assert.equal(fetched.length, 1);
    assert.match(fetched[0], /chapter-journey-opening/);
    assert(host.entries.every((entry) => entry.sourcePackId === 'journey-opening'));
    assert.deepEqual(host.catalog.missions, original.catalog.missions);
    assert.equal(host.catalog, publishedRouteViews(route).solo.catalog);
    const first = host.catalog.missions[0],
      owned = host.select(first, 'standard');
    const future = host.catalog.missions.find(
      (mission) => mission.packId !== 'journey-opening' && !mission.packId.includes('remix'),
    );
    assert.equal(host.select(future, 'standard'), null);
    assert.deepEqual(host.card(future), original.card(original.catalog.find(future.id)));
    const expected = original.select(original.catalog.find(future.id), 'expert');
    assert.equal(host.executionMetadata(expected.executionKey).packId, future.packId);
    await host.ensureExecution(expected.executionKey);
    // The route host exposes the authored encounter facade over these exact entries.
    assert.deepEqual(host.select(future, 'expert'), {
      ...expected,
      encounterVariant: 'authored',
      encounterVariants: ['authored'],
    });
    assert.equal(host.select(first, 'standard'), owned);
    assert(host.owns(owned));
    assert.equal(fetched.length, 2);
    await host.ensureMission(future);
    assert.equal(fetched.length, 2);
    assert.equal(
      approvals.length,
      2,
      'revalidate retained chapter even after its runtime is materialized',
    );
    assert(approvals.every((item) => item.retain === true));
    assert.equal(await host.ensureExecution('unknown'), null);
    assert.equal(host.next(first.id).id, original.next(first.id).id);
  } finally {
    host.preparer.dispose();
  }
});

test('published chapters load online without an offline preparation integration', async () => {
  const fetched = [];
  const host = await createSoloRouteHost(route, {
    themes,
    fetchAsset: async (path) => {
      fetched.push(path);
      return transport(path);
    },
  });
  try {
    for (const descriptor of route.navigation.chapters) {
      const mission = host.catalog.missions.find((item) => item.packId === descriptor.packId);
      assert(mission, `Published chapter ${descriptor.packId} must have a mission`);
      await host.ensureMission(mission);
      const expected = original.select(original.catalog.find(mission.id), 'standard');
      assert.deepEqual(host.select(mission, 'standard'), {
        ...expected,
        encounterVariant: 'authored',
        encounterVariants: ['authored'],
      });
      await host.ensureExecution(expected.executionKey);
    }
    assert.equal(fetched.length, route.navigation.chapters.length);
  } finally {
    host.preparer.dispose();
  }
});

test('chapter visual identity retains original whole-project authority for saved pins and replays', async () => {
  const host = await createSoloRouteHost(route, {
    themes,
    fetchAsset: transport,
    ensurePackage: async () => {},
  });
  try {
    const mission = host.catalog.missions[0],
      selection = host.select(mission, 'standard'),
      level = selection.campaign.levels[0];
    const originalSelection = original.select(original.catalog.find(mission.id), 'standard');
    const association = {
      editionId: route.id,
      contentThemeId: selection.manifests[0].presentation.themeId,
      mode: 'solo',
    };
    const actual = await host.prepareVisualIdentity({ selection, level, association });
    const adapter = await createJourneyVisualThemeIdentityAdapter(generated.route.source, {
      mode: 'solo',
    });
    const expected = await adapter.prepareHostSelection({
      host: original,
      selection: originalSelection,
      level: originalSelection.campaign.levels[0],
      association,
    });
    assert.deepEqual(actual, expected);
  } finally {
    host.preparer.dispose();
  }
});

test('published source admission rejects forged descriptors and cancels blocked snapshot reads', async () => {
  const descriptor = route.navigation.chapters[0];
  await assert.rejects(
    loadPublishedChapter(route, { ...descriptor }, { fetchAsset: transport }),
    /publisher-pinned/,
  );
  const controller = new AbortController();
  let cancelled = false;
  const pending = loadPublishedChapter(route, descriptor, {
    signal: controller.signal,
    fetchAsset: async () =>
      new Response(
        new ReadableStream({
          pull() {},
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert(cancelled);
});

test('previous-edition display rows retain their original mission ordinal', () => {
  for (const archive of publishedRouteViews(route).archives) {
    const source = generated.routes.find((item) => item.route.id === archive.route.id).route.source;
    for (const view of [archive.solo, archive.versus])
      for (const mission of view.catalog.missions) {
        assert.equal(
          mission.levelIndex,
          source.campaigns
            .find((campaign) => campaign.id === mission.campaignId)
            .missionIds.indexOf(mission.levelId),
        );
      }
  }
});

test('published replay owner fetches only its exact chapter and keeps the historical full-project pin', async () => {
  register(new URL('./helpers/published-replay-loader.mjs', import.meta.url), {
    data: { source: entries[0].bytes.toString() },
  });
  const { prepareReplayActorContext } = await import('../replay-actor-context.mjs');
  const selection = original.select(original.catalog.missions[0], 'standard'),
    level = selection.campaign.levels[0];
  const adapter = await createJourneyVisualThemeIdentityAdapter(generated.route.source, {
    mode: 'solo',
  });
  const content = await adapter.prepareHostSelection({
    host: original,
    selection,
    level,
    association: {
      editionId: route.id,
      contentThemeId: selection.manifests[0].presentation.themeId,
      mode: 'solo',
    },
  });
  const options = {
    seed: 1,
    turnPolicy: 'immediate',
    classId: 'scout',
    classRecipes: selection.classRecipes,
  };
  const state = createRun(level, options),
    recorder = createRecorder(level, options, 'published-owner-test');
  for (let index = 0; index < 5; index++) {
    stepRun(state, {}, FIXED_DT);
    recordInput(recorder, {});
  }
  const envelope = exportReplayPresentation({
    execution: { campaignKey: selection.executionKey, sourcePackId: selection.sourcePackId },
    actorAppearancePin: {
      format: 'revealline-actor-appearance-pin.v1',
      style: 'fpv',
      rendererPolicy: 'actor-style.v1',
      content,
      presentation: ACTOR_APPEARANCE_RELEASES[0].presentation,
    },
    replay: exportReplay(recorder, state),
  });
  const fetched = [];
  const actual = await prepareReplayActorContext(envelope, {
    fetcher: async (url) => {
      const path = new URL(url).pathname.split('/game/content-design/')[1];
      fetched.push(path);
      return new Response(
        files.has(path)
          ? files.get(path)
          : await readFile(new URL(`../content-design/${path}`, import.meta.url)),
      );
    },
  });
  assert.deepEqual(actual.content, content);
  assert.deepEqual(fetched, [
    generated.navigationDescriptor.path,
    route.navigation.chapters.find((item) => item.packId === 'journey-opening').path,
    'themes.json',
  ]);
});

async function picturelessFixture() {
  const chapter = generated.chapters.find((item) => item.descriptor.core);
  const source = structuredClone(chapter.source);
  source.assets = [];
  for (const mission of source.missions) mission.presentation.backgroundAssetId = null;
  const bytes = Buffer.from(JSON.stringify(source));
  const projected = structuredClone(route),
    descriptor = projected.navigation.chapters.find((item) => item.core);
  Object.assign(descriptor, {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const navigationBytes = Buffer.from(JSON.stringify(projected));
  const pinned = await loadRouteSnapshot(
    {
      ...generated.navigationDescriptor,
      bytes: navigationBytes.length,
      sha256: createHash('sha256').update(navigationBytes).digest('hex'),
    },
    { fetchAsset: async () => new Response(navigationBytes) },
  );
  return { pinned, bytes };
}

test('a superseded preparation cannot cancel its replacement in the same materialized pack', async () => {
  const { pinned, bytes } = await picturelessFixture();
  const host = await createSoloRouteHost(pinned, {
    themes,
    ensurePackage: async () => {},
    fetchAsset: async () => new Response(bytes),
  });
  const request = {
    missionId: host.catalog.missions[0].id,
    difficulty: 'standard',
    seed: 1,
    turnPolicy: 'immediate',
  };
  let replacement;
  try {
    const previous = host.preparer.prepare(request, {
      onStatus(status) {
        if (status.stage === 'preparing')
          replacement = host.preparer.prepare({ ...request, seed: 2 });
      },
    });
    await assert.rejects(previous, { name: 'AbortError' });
    assert(replacement);
    const prepared = await replacement;
    assert(host.preparer.current(prepared));
    assert.equal(prepared.run.seed, 2);
  } finally {
    host.preparer.dispose();
  }
});

test('a re-entrant action from an abort callback keeps ownership over the action that cancelled it', async () => {
  const { pinned, bytes } = await picturelessFixture();
  let approved = 0,
    replacement,
    announceWaiting;
  const waiting = new Promise((resolve) => {
    announceWaiting = resolve;
  });
  const host = await createSoloRouteHost(pinned, {
    themes,
    fetchAsset: async () => new Response(bytes),
    ensurePackage: (_id, { signal }) => {
      if (++approved !== 1) return Promise.resolve();
      return new Promise((resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            replacement = host.preparer.prepare({ ...request, seed: 3 });
            replacement.catch(() => {});
            reject(new DOMException('Cancelled first request.', 'AbortError'));
          },
          { once: true },
        );
        announceWaiting();
      });
    },
  });
  const request = {
    missionId: host.catalog.missions[0].id,
    difficulty: 'standard',
    seed: 1,
    turnPolicy: 'immediate',
  };
  try {
    const first = host.preparer.prepare(request);
    first.catch(() => {});
    await waiting;
    const stale = host.preparer.prepare({ ...request, seed: 2 });
    await assert.rejects(first, { name: 'AbortError' });
    await assert.rejects(stale, { name: 'AbortError' });
    assert(replacement);
    const prepared = await replacement;
    assert(host.preparer.current(prepared));
    assert.equal(prepared.run.seed, 3);
  } finally {
    host.preparer.dispose();
  }
});

test.after(() => original.preparer.dispose());
