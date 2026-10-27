import test from 'node:test';
import { REMOTE_TEAM_NAVIGATION } from '../game/content-design/remote-team-navigation-registry.mjs';
import { loadRemoteTeamLibrarySources } from '../game/mission-library/remote-team-display.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runRemoteTeamNavigationCLI,
  inspectRemoteTeamNavigation,
  loadRemoteTeamNavigationSource,
} from './remote-team-navigation.mjs';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import { createCandidateTeamHost } from '../game/content-design/team-host.mjs';
import { createJourneyCatalog } from '../game/journey/catalog.mjs';
import {
  authoredJourneyMissionTags,
  journeyMissionDetails,
} from '../game/mission-library/journey-presentation.mjs';
import { getLocale, setLocale, t } from '../game/i18n/index.mjs';
import { contentText } from '../game/i18n/content.mjs';
import registry from '../game/i18n/content-registry.mjs';
import { createMissionLibrary, libraryMissionId } from '../game/mission-library/library.mjs';
import {
  teamJourneyLibrarySource,
  teamJourneyLibraryOwner,
  TEAM_LIBRARY_JOURNEY_EDITION,
} from '../game/mission-library/team-source.mjs';
import { TEAM_EXPANSION_ROUTE } from '../game/content-design/multiplayer-expansion.mjs';
import { SUPPLEMENTAL_HUNT_ROUTE } from '../game/mission-library/supplemental-hunt.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { missionLibraryHref, readMissionLibraryHandoff } from '../game/mission-library/handoff.mjs';

const editionAuthorities = Object.freeze({
  cultural: TEAM_LIBRARY_JOURNEY_EDITION,
  expedition: TEAM_EXPANSION_ROUTE,
  hunt: SUPPLEMENTAL_HUNT_ROUTE,
});

const presets = ['gentle', 'standard', 'expert'];
const expand = (runs, count) => {
  assert(Array.isArray(runs) && runs.length % 2 === 0);
  assert(Number.isInteger(count) && count > 0 && count <= 65536);
  const result = [];
  for (let index = 0; index < runs.length; index += 2) {
    const length = runs[index + 1];
    assert(Number.isInteger(length) && length > 0 && result.length + length <= count);
    for (let item = 0; item < length; item++) result.push(runs[index]);
  }
  assert.equal(result.length, count);
  return result;
};
const translatedField = (presentation, field, locale) => {
  const raw = presentation[field === 'routeDecision' ? 'route' : 'mastery'];
  const registered = presentation.translations[field];
  return locale !== 'en' && registered?.source === raw ? t(registered.key) : raw;
};

/** Each wrapper is a complete fresh-process target file, never a name-filtered case. */
export function registerRemoteTeamNavigationTest(target) {
  test(`${target}: exact display projection preserves mutable authoring, every preset, locale and diagram`, async (context) => {
    const directory = await mkdtemp(join(tmpdir(), `revealline-remote-team-${target}-`));
    context.after(() => rm(directory, { recursive: true, force: true }));
    const originalLocale = getLocale();
    context.after(() => setLocale(originalLocale));
    context.mock.method(globalThis, 'fetch', () => {
      throw new Error('Display authoring must not fetch media.');
    });
    const path = join(directory, `${target}.json`);
    setLocale('en');
    const produced = await runRemoteTeamNavigationCLI(['produce', target, path]);
    const bytes = await readFile(path);
    const payload = inspectRemoteTeamNavigation(bytes, target);
    const committedDescriptor = REMOTE_TEAM_NAVIGATION.find((entry) => entry.target === target);
    assert(committedDescriptor);
    assert.equal(committedDescriptor.editionId, editionAuthorities[target]);
    assert.deepEqual(
      await readFile(
        new URL(`../game/content-design/${committedDescriptor.path}`, import.meta.url),
      ),
      bytes,
      'Committed runtime display bytes exactly match this fresh registered-source production.',
    );
    assert.equal(committedDescriptor.bytes, bytes.length);
    assert.equal(committedDescriptor.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(committedDescriptor.project, payload.project);
    assert.equal(committedDescriptor.factory, payload.factory);
    assert.equal(produced.bytes, bytes.length);
    assert.equal(produced.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(payload.mode, 'team');
    if (target === 'cultural') assert.equal(payload.editionId, DEFAULT_JOURNEY_ROUTES.team);
    assert.equal(
      payload.editionId,
      editionAuthorities[target],
      'The actual registered source adapter owns this exact receiving edition.',
    );
    assert.deepEqual(Object.keys(payload.view).sort(), ['campaigns', 'ordinals', 'presentations']);
    assert.equal(Object.hasOwn(payload, 'packs'), false);
    assert.equal(Object.hasOwn(payload.view, 'executionMetadata'), false);
    const authoring = await loadRemoteTeamNavigationSource(target);
    assert.equal(Object.isFrozen(authoring), false);
    assert.equal(Object.isFrozen(authoring.missions[0]), false);
    authoring.name = 'Independent editable draft';
    authoring.missions[0].name = 'An edited mission must not poison the next source';
    setLocale('uk');
    const checked = await runRemoteTeamNavigationCLI(['check', target, path]);
    assert.deepEqual(checked.codeOwners, produced.codeOwners);
    assert.equal(produced.codeOwners.length, 16);
    assert.equal(new Set(produced.codeOwners.map((owner) => owner.path)).size, 16);
    assert.equal(Object.hasOwn(payload, 'codeOwners'), false);
    assert.equal(
      checked.sha256,
      produced.sha256,
      'A new factory call and locale retain exact canonical bytes.',
    );
    assert.deepEqual(await readFile(path), bytes, 'Check never rewrites the reviewed artifact.');

    const source = await loadRemoteTeamNavigationSource(target);
    assert.notEqual(source.name, authoring.name);
    assert.notEqual(source.missions[0].name, authoring.missions[0].name);
    assert.equal(payload.project.id, source.id);
    assert.equal(payload.project.revision, source.revision);
    assert.equal(
      payload.project.sha256,
      createHash('sha256').update(canonicalJSON(source)).digest('hex'),
    );
    const host = createCandidateTeamHost(source, {
      corePackIds: source.packs.map((pack) => pack.id),
    });
    const metadata = createJourneyCatalog(payload.view.campaigns);
    let selectedPreset = 'standard',
      accepted = null;
    const receiving = createMissionLibrary([
      teamJourneyLibrarySource({
        journey: host,
        editionId: editionAuthorities[target],
        difficulty: () => selectedPreset,
        launch: (row, context) => {
          accepted = { row, context };
          return true;
        },
      }),
    ]);
    const displayCalls = [];
    const displayedSources = await loadRemoteTeamLibrarySources({
      fetchAsset: async (assetPath) =>
        new Response(
          await readFile(new URL(`../game/content-design/${assetPath}`, import.meta.url)),
        ),
      difficulty: () => selectedPreset,
      launch: (context) => {
        displayCalls.push(context);
        return true;
      },
    });
    const displayed = displayedSources.find(
      (entry) => entry.id === teamJourneyLibraryOwner(payload.editionId),
    );
    assert(displayed);
    const displayedLibrary = createMissionLibrary([displayed]);
    assert.deepEqual(
      displayedLibrary.missions.map((entry) => entry.id),
      receiving.missions.map((entry) => entry.id),
    );
    assert.equal(displayed.row, undefined);
    assert.equal(displayed.executionMetadata, undefined);
    const projectedLibraryId = (mission) =>
      libraryMissionId({
        owner: teamJourneyLibraryOwner(payload.editionId),
        edition: payload.editionId,
        campaign: JSON.stringify([mission.source, mission.packId, mission.campaignId]),
        mission: mission.id,
      });
    assert.deepEqual(
      new Set(receiving.missions.map((row) => row.id)),
      new Set(metadata.missions.map(projectedLibraryId)),
      'Exact real adapter identities; no missing or extra receiving rows.',
    );
    assert.deepEqual(
      metadata.missions,
      host.catalog.missions,
      'Exact active membership, order, mode, names and opaque identities.',
    );
    assert.equal(
      new Set(metadata.missions.map((mission) => mission.id)).size,
      metadata.missions.length,
    );
    assert.deepEqual(
      Object.keys(payload.view.presentations).sort(),
      metadata.missions.map((mission) => mission.id).sort(),
    );
    assert.deepEqual(
      Object.keys(payload.view.ordinals).sort(),
      metadata.missions.map((mission) => mission.id).sort(),
    );
    const referencedCards = new Set();
    for (const mission of metadata.missions) {
      const native = host.catalog.find(mission.id);
      const displayMission = displayed.entries.find((entry) => entry.id === mission.id);
      assert(displayMission);
      assert.equal(
        host.row(displayMission, 'standard'),
        null,
        'Runtime display metadata has no native row authority.',
      );
      assert.deepEqual(displayed.describe(displayMission).levelIndex, native.levelIndex);
      assert.equal(
        host.row(mission, 'standard'),
        null,
        'Display lookalikes do not acquire native row ownership.',
      );
      assert.equal(payload.view.ordinals[mission.id], native.levelIndex);
      assert.deepEqual(
        Object.keys(payload.view.presentations[mission.id]).sort(),
        [...presets].sort(),
      );
      for (const preset of presets) {
        const presentation = payload.view.presentations[mission.id][preset];
        const manifest = host.manifest(native, preset);
        selectedPreset = preset;
        const displayContext = Object.freeze({
          mode: 'team',
          libraryMissionId: projectedLibraryId(mission),
        });
        assert.equal(displayed.launch(displayMission, displayContext), true);
        assert.equal(displayCalls.at(-1), displayContext);
        assert.deepEqual(
          displayed.describe(displayMission).tags,
          authoredJourneyMissionTags(native, manifest),
        );
        assert.throws(() => displayed.launch({ ...displayMission }, displayContext));
        const receivingRow = receiving.find(projectedLibraryId(mission));
        assert(receivingRow);
        assert.equal(await receiving.launch(receivingRow, { mode: 'team' }), true);
        assert.equal(
          accepted.row,
          host.row(native, preset),
          'Actual source adapter retains exact native row/preset ownership.',
        );
        assert.equal(accepted.context.libraryMissionId, receivingRow.id);
        assert.equal(accepted.context.mode, 'team');
        const destination = new URL(
          missionLibraryHref({
            baseURL: 'https://game.invalid/game/',
            currentMode: 'solo',
            mode: 'team',
            journey: payload.editionId,
            missionId: receivingRow.id,
            sourceJourney: DEFAULT_JOURNEY_ROUTES.solo,
          }),
        );
        assert.equal(destination.pathname, '/game/couch/relay-rescue.html');
        assert.equal(destination.searchParams.get('journey'), editionAuthorities[target]);
        assert.equal(readMissionLibraryHandoff(destination.searchParams), receivingRow.id);

        assert.equal(presentation.band, manifest.design.difficulty.band);
        assert.equal(presentation.route, manifest.design.routeDecision);
        assert.equal(presentation.mastery, manifest.design.mastery);
        assert.deepEqual(presentation.tags, authoredJourneyMissionTags(native, manifest));
        const registered = registry[dataIdentity(manifest)]?.fields ?? {};
        assert.deepEqual(
          presentation.translations,
          Object.fromEntries(
            ['routeDecision', 'mastery'].flatMap((field) =>
              registered[`design.${field}`]
                ? [
                    [
                      field,
                      {
                        source: registered[`design.${field}`].source,
                        key: registered[`design.${field}`].key,
                      },
                    ],
                  ]
                : [],
            ),
          ),
        );
        const compact = payload.cards[presentation.card];
        assert(compact);
        assert.equal(dataIdentity(compact), presentation.card);
        referencedCards.add(presentation.card);
        const count = compact.width * compact.height;
        const diagram = {
          ...compact,
          cells: expand(compact.cells, count),
          terrain: expand(compact.terrain, count),
        };
        assert.deepEqual(
          diagram,
          host.card(native, preset),
          'Complete initial cells/terrain/spawns/actors and guidance match the core-backed diagram.',
        );
        assert.deepEqual(displayed.card(displayMission), host.card(native, preset));
        for (const locale of ['en', 'uk']) {
          setLocale(locale);
          assert.equal(contentText(mission, 'name'), contentText(native, 'name'));
          assert.equal(contentText(mission, 'campaignTitle'), contentText(native, 'campaignTitle'));
          assert.equal(contentText(mission, 'hook'), contentText(native, 'hook'));
          const expected = journeyMissionDetails(manifest);
          assert.deepEqual(displayed.details(displayMission), expected);
          const displayCopy = displayed.presentation(displayMission);
          assert.equal(displayCopy.name, contentText(native, 'name'));
          assert.equal(displayCopy.campaignTitle, contentText(native, 'campaignTitle'));
          assert.equal(displayCopy.hook, contentText(native, 'hook'));
          assert.equal(translatedField(presentation, 'routeDecision', locale), expected.route);
          assert.equal(translatedField(presentation, 'mastery', locale), expected.mastery);
          assert.equal(
            expected.challenge,
            t('interface:missionLibrary.challenge', {
              band: presentation.band,
              difficulty: t(`interface:missionLibrary.difficulty.${preset}`),
            }),
          );
        }
      }
    }
    assert.deepEqual(
      Object.keys(payload.cards).sort(),
      [...referencedCards].sort(),
      'No missing or extra diagram authority.',
    );
    const stale = structuredClone(payload);
    stale.project.sha256 = '0'.repeat(64);
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(path, `${canonicalJSON(stale)}\n`),
    );
    await assert.rejects(
      runRemoteTeamNavigationCLI(['check', target, path]),
      /differs from the registered current authoring source/,
    );
    context.diagnostic(
      JSON.stringify({
        target,
        bytes: produced.bytes,
        sha256: produced.sha256,
        missions: metadata.missions.length,
        cards: referencedCards.size,
        presets,
        locales: ['en', 'uk'],
      }),
    );
  });
}
