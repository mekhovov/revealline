import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadRemoteTeamLibrarySources } from '../mission-library/remote-team-display.mjs';
import { REMOTE_TEAM_NAVIGATION } from '../content-design/remote-team-navigation-registry.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyMissionId } from '../journey/catalog.mjs';
import {
  publishedRouteViews,
  publishedSourceAuthority,
} from '../content-design/published-journey.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { t, setLocale, getLocale } from '../i18n/index.mjs';
import { huntText } from '../hunt/copy.mjs';

const files = new Map(
  await Promise.all(
    REMOTE_TEAM_NAVIGATION.map(async (descriptor) => [
      descriptor.path,
      await readFile(new URL(`../content-design/${descriptor.path}`, import.meta.url)),
    ]),
  ),
);
const payloads = new Map(
  REMOTE_TEAM_NAVIGATION.map((descriptor) => [
    descriptor.target,
    JSON.parse(files.get(descriptor.path)),
  ]),
);
const transport = () => {
  const requested = [];
  return {
    requested,
    fetchAsset: async (path, options) => {
      requested.push({ path, options });
      assert(files.has(path), 'Only the three code-owned display assets may be requested.');
      return new Response(files.get(path));
    },
  };
};
const expand = (runs) =>
  runs.flatMap((value, index) => (index % 2 ? [] : Array(runs[index + 1]).fill(value)));

test('registered display files retain exact accepted output and no executable/admission data', () => {
  assert.deepEqual(
    REMOTE_TEAM_NAVIGATION.map((entry) => [entry.target, entry.editionId]),
    [
      ['cultural', 'team-cultural-specialist-originals-2'],
      ['expedition', 'team-expedition-v1'],
      ['hunt', 'humanoid-hunt-v1'],
    ],
  );
  for (const descriptor of REMOTE_TEAM_NAVIGATION) {
    const bytes = files.get(descriptor.path),
      payload = payloads.get(descriptor.target);
    assert.equal(bytes.length, descriptor.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
    assert.deepEqual(Object.keys(payload).sort(), [
      'cards',
      'editionId',
      'factory',
      'format',
      'mode',
      'project',
      'target',
      'view',
    ]);
    assert.deepEqual(Object.keys(payload.view).sort(), ['campaigns', 'ordinals', 'presentations']);
    assert(Object.isFrozen(descriptor));
    assert(Object.isFrozen(descriptor.project));
    assert.equal(publishedSourceAuthority(payload), null);
    assert.throws(() => publishedRouteViews({ navigation: payload }), /not been verified/);
  }
});

test('all116 receiving identities retain order, ordinals and exact handoff context without artwork or native rows', async () => {
  const io = transport(),
    calls = [];
  const sources = await loadRemoteTeamLibrarySources({
    ...io,
    launch: (context) => {
      calls.push(context);
      return true;
    },
  });
  assert.deepEqual(
    sources.map((source) => source.id),
    [
      'journey:team-expedition-v1',
      'team-journey:humanoid-hunt-v1',
      'journey:team-cultural-specialist-originals-2',
      'team-classic:relay-rescue-starter',
    ],
  );
  assert.equal(sources[1].automaticContinuation, false);
  assert(
    sources
      .filter((source) => source !== sources[1])
      .every((source) => source.automaticContinuation === undefined),
  );
  assert.deepEqual(
    io.requested.map(({ path }) => path),
    REMOTE_TEAM_NAVIGATION.map((entry) => entry.path),
  );
  assert(io.requested.every(({ options }) => options.redirect === 'error'));
  const expected = ['expedition', 'hunt', 'cultural'].flatMap((target) =>
    payloads.get(target).view.campaigns.flatMap((campaign) =>
      campaign.levels.map((level) =>
        journeyMissionId({
          source: campaign.source,
          packId: campaign.packId,
          campaignId: campaign.id,
          levelId: level.id,
        }),
      ),
    ),
  );
  assert.deepEqual(
    sources.slice(0, 3).flatMap((source) => source.entries.map((entry) => entry.id)),
    expected,
  );
  assert.equal(expected.length, 114);
  assert.equal(new Set(expected).size, expected.length);
  for (const source of sources.slice(0, 3)) {
    const target = source.id.includes('expedition')
      ? 'expedition'
      : source.id.includes('hunt')
        ? 'hunt'
        : 'cultural';
    for (const mission of source.entries) {
      assert.equal(
        source.describe(mission).levelIndex,
        payloads.get(target).view.ordinals[mission.id],
      );
      assert.equal(source.progress(mission, 'team'), '');
      assert.deepEqual(source.progressState(mission, 'team'), { state: 'new', bestStars: null });
      assert.equal(source.completion(mission, 'team'), null);
      assert.equal(mission.pack, undefined);
      assert.equal(mission.level, undefined);
      const context = Object.freeze({ mode: 'team', marker: mission.id });
      assert.equal(source.launch(mission, context), true);
      assert.equal(calls.at(-1), context);
      assert.throws(() => source.launch({ ...mission }, context), {
        message: t('errors:missionLibrary.teamMissionUnavailable'),
      });
    }
  }
  const classic = sources.at(-1);
  for (const [index, row] of classic.entries.entries()) {
    assert.equal(row.pack, COOP_STARTER_PACK);
    assert.equal(row.level, COOP_STARTER_PACK.levels[index]);
    assert.equal(row.artworkSource, null);
    const context = { mode: 'team' };
    assert.equal(classic.launch(row, context), true);
    assert.equal(calls.at(-1), context);
  }
  const library = createMissionLibrary(sources);
  assert.equal(library.missions.length, 116);
  assert.equal(library.forMode('solo').length, 0);
  assert.equal(library.forMode('versus').length, 0);
  assert.equal(library.forMode('team').length, 116);
  for (const row of library.missions) {
    await library.launch(row, { mode: 'team' });
    assert.equal(calls.at(-1).libraryMissionId, row.id);
  }
});

test('every preset diagram/details/tag and live EN/UK label use the accepted projection without refetching', async () => {
  const io = transport();
  let difficulty = 'standard';
  const sources = await loadRemoteTeamLibrarySources({
    ...io,
    difficulty: () => difficulty,
    launch: () => true,
  });
  const previous = getLocale();
  try {
    for (const locale of ['en', 'uk']) {
      await setLocale(locale);
      assert.equal(
        sources[0].presentation(sources[0].entries[0]).edition,
        t('interface:expeditions.team'),
      );
      assert.equal(sources[1].presentation(sources[1].entries[0]).edition, huntText('lessons'));
      assert.equal(
        sources[2].presentation(sources[2].entries[0]).edition,
        t('interface:missionLibrary.team.journeyEdition'),
      );
      for (const source of sources.slice(0, 3)) {
        const target = source.id.includes('expedition')
          ? 'expedition'
          : source.id.includes('hunt')
            ? 'hunt'
            : 'cultural';
        const payload = payloads.get(target);
        for (const preset of ['gentle', 'standard', 'expert']) {
          difficulty = preset;
          for (const mission of source.entries) {
            const item = payload.view.presentations[mission.id][preset],
              compact = payload.cards[item.card];
            const card = source.card(mission);
            assert.deepEqual(card, {
              ...compact,
              cells: expand(compact.cells),
              terrain: expand(compact.terrain),
            });
            assert(Object.isFrozen(card));
            assert(Object.isFrozen(card.cells));
            assert.deepEqual(source.describe(mission).tags, item.tags);
            const translated = (field, fallback) =>
              locale !== 'en' && item.translations[field]?.source === fallback
                ? t(item.translations[field].key)
                : fallback;
            assert.deepEqual(source.details(mission), {
              challenge: t('interface:missionLibrary.challenge', {
                band: item.band,
                difficulty: t(`interface:missionLibrary.difficulty.${preset}`),
              }),
              route: translated('routeDecision', item.route),
              mastery: translated('mastery', item.mastery),
            });
          }
        }
      }
    }
  } finally {
    await setLocale(previous);
  }
  assert.equal(io.requested.length, 3);
});

test('successful immutable views are reusable but cached reads still reject a retired owner', async () => {
  const io = transport();
  await loadRemoteTeamLibrarySources({ ...io, launch: () => true });
  await loadRemoteTeamLibrarySources({ ...io, launch: () => true });
  assert.equal(io.requested.length, 3);
  const error = new DOMException('Retired opening.', 'AbortError');
  await assert.rejects(
    loadRemoteTeamLibrarySources({
      ...io,
      launch: () => true,
      assertCurrent: () => {
        throw error;
      },
    }),
    (actual) => actual === error,
  );
  assert.equal(io.requested.length, 3);
});

test('missing, oversized, truncated and hash-mismatched display assets fail explicitly and Retry never invokes a compiler', async () => {
  const descriptor = REMOTE_TEAM_NAVIGATION[0],
    original = files.get(descriptor.path);
  for (const response of [
    () => new Response(null, { status: 404 }),
    () => new Response(Buffer.concat([original, Buffer.from('x')])),
    () => new Response(original.subarray(0, original.length - 1)),
    () => new Response(Buffer.alloc(original.length, 32)),
  ]) {
    let failed = true,
      requests = 0;
    const fetchAsset = async (path) => {
      requests++;
      return failed ? response() : new Response(files.get(path));
    };
    await assert.rejects(
      loadRemoteTeamLibrarySources({ fetchAsset, launch: () => true }),
      (error) => {
        assert.equal(error.message, t('interface:missionsCouldNotLoadChooseMissionsToRetry'));
        assert(error.cause instanceof Error);
        assert.notEqual(error.message, error.cause.message);
        return true;
      },
    );
    assert.equal(requests, 1);
    failed = false;
    const result = await loadRemoteTeamLibrarySources({ fetchAsset, launch: () => true });
    assert.equal(result.length, 4);
    assert.equal(requests, 4);
  }
});

test('cancellation cancels a held stream; a late retired owner cannot publish or poison a replacement', async () => {
  const controller = new AbortController();
  let begin,
    cancelled = false;
  const began = new Promise((resolve) => {
    begin = resolve;
  });
  const fetchAsset = async () =>
    new Response(
      new ReadableStream({
        pull() {
          begin();
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  const pending = loadRemoteTeamLibrarySources({
    fetchAsset,
    signal: controller.signal,
    launch: () => true,
  });
  await began;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert(cancelled);

  let retired = false,
    release;
  const descriptor = REMOTE_TEAM_NAVIGATION[0];
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let first = true;
  const sharedFetch = async (path) =>
    first ? ((first = false), await held) : new Response(files.get(path));
  const stale = loadRemoteTeamLibrarySources({
    fetchAsset: sharedFetch,
    launch: () => true,
    assertCurrent() {
      if (retired) throw new DOMException('Retired.', 'AbortError');
    },
  });
  retired = true;
  const replacement = await loadRemoteTeamLibrarySources({
    fetchAsset: sharedFetch,
    launch: () => true,
  });
  release(new Response(files.get(descriptor.path)));
  await assert.rejects(stale, { name: 'AbortError' });
  assert.equal(replacement.length, 4);
  assert.equal(
    (await loadRemoteTeamLibrarySources({ fetchAsset: sharedFetch, launch: () => true }))[0]
      .entries[0],
    replacement[0].entries[0],
  );
});
