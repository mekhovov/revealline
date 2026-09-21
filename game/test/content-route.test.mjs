import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAuthoredJourneyRoute, createCandidateSequence } from '../content-design/route.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CORE_PACK_IDS,
} from '../content-design/whole-journey-candidates.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;

test('explicit whole-originals review preserves source editions and offers one shared71-mission core', () => {
  const route = createAuthoredJourneyRoute('whole-originals');
  assert.deepEqual(route.source, createWholeJourneyCandidates({ artwork: true }));
  assert.deepEqual(route.corePackIds, WHOLE_JOURNEY_CORE_PACK_IDS);
  assert.equal(route.sessionKey, 'revealline.suspended.journey-whole-originals.v1');
  assert(Object.isFrozen(route.source.assets[0]));
  for (const createHost of [createCandidateSoloHost, createCandidateVersusHost]) {
    const host = createHost(route.source, { themes, corePackIds: route.corePackIds });
    const core = [];
    for (let mission = host.catalog.missions[0]; mission; mission = host.next(mission.id)) {
      assert(!core.includes(mission), 'No continuation cycle');
      core.push(mission);
    }
    assert.equal(core.length, 71);
    assert.equal(core.at(-1).levelId, 'home-signal');
    const remixes = host.catalog.missions.filter((m) => !host.isCore(m.id));
    assert.equal(remixes.length, 12);
    assert(remixes.every((m) => host.next(m.id) === null));
    assert.equal(new Set(core.map((m) => m.packId)).size, 12);
  }
});

test('staged route appends Border without changing prior execution or progress identities', () => {
  assert.equal(createAuthoredJourneyRoute('1'), null);
  assert.equal(createAuthoredJourneyRoute('unknown'), null);
  const opening = createAuthoredJourneyRoute('opening');
  const route = createAuthoredJourneyRoute('authored');
  assert.deepEqual(opening.source, createOpeningCandidates({ artwork: true }));
  assert.equal(opening.sessionKey, 'revealline.suspended.journey-opening.v1');
  assert.equal(route.sessionKey, 'revealline.suspended.journey-authored.v1');
  assert(Object.isFrozen(route.source.missions[0]));
  assert.equal(route.source.missions.length, 17);
  for (const mode of ['solo', 'versus']) {
    const combined = createContentExecutionCatalog(route.source, { mode });
    for (const source of [opening.source, createBorderCandidates({ artwork: true })]) {
      const previous = createContentExecutionCatalog(source, { mode });
      for (const entry of previous.entries) {
        const current = combined.select(entry.sourcePackId, entry.campaignId, entry.difficulty);
        assert.equal(current.executionKey, entry.executionKey);
        assert.deepEqual(current.campaign, entry.campaign);
        assert.deepEqual(current.manifests, entry.manifests);
      }
      for (const mission of previous.journey().missions) {
        assert.deepEqual(
          combined.journey().missions.find((item) => item.id === mission.id),
          mission,
        );
      }
    }
  }
});

test('one shared core sequence skips optional packs, ends deliberately and validates membership', () => {
  const route = createAuthoredJourneyRoute('authored');
  let sequence;
  for (const createHost of [createCandidateSoloHost, createCandidateVersusHost]) {
    const host = createHost(route.source, { themes, corePackIds: route.corePackIds });
    const core = [];
    for (let mission = host.catalog.missions[0]; mission; mission = host.next(mission.id))
      core.push(mission);
    assert.equal(core.length, 15);
    assert.equal(core[8].levelId, 'long-way-home');
    assert.equal(core[9].levelId, 'behind-the-patrol');
    assert.equal(core.at(-1).levelId, 'return-pocket');
    if (sequence)
      assert.deepEqual(
        core.map((m) => m.id),
        sequence,
      );
    else sequence = core.map((m) => m.id);
    assert.equal(host.catalog.missions.length, 17);
    for (const mission of host.catalog.missions.filter((m) => m.levelId.endsWith('-remix'))) {
      assert.equal(host.next(mission.id), null);
      assert.equal(host.isCore(mission.id), false);
    }
    assert.equal(host.next('missing'), null);
    for (const invalid of [[], ['missing'], ['journey-opening', 'journey-opening'], ['../bad']]) {
      assert.throws(() => createCandidateSequence(host.catalog, invalid), /core packs/);
    }
    // Caller mutation and filter ordering cannot change an established sequence.
    const selection = ['journey-border', 'journey-opening'];
    const selected = createCandidateSequence(host.catalog, selection);
    selection.pop();
    assert.equal(selected.next(core[8].id).id, core[9].id);
  }
});
