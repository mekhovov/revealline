import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CORE_PACK_IDS,
} from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createCandidateSequence } from '../content-design/route.mjs';
import { createMissionCard } from '../content-design/mission-card.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import { attachJourneyChooser } from '../ui/journey-chooser.mjs';

const project = compileContentProject(createWholeJourneyCandidates());
for (const mode of ['solo', 'versus'])
  test(`83-mission ${mode} chooser remains flat, searchable, reversible and read-only`, () => {
    const journey = resolveContentJourney(project, { mode });
    const catalog = createJourneyCatalog(
      journey.campaigns.map(({ packId, campaignId, runtime, manifests }) => ({
        source: 'candidate',
        packId,
        id: campaignId,
        title: runtime.title,
        modes: [mode],
        levels: manifests.map((m) => ({
          id: m.missionId,
          name: m.level.name,
          hook: m.design.routeDecision,
        })),
      })),
    );
    const sequence = createCandidateSequence(catalog, WHOLE_JOURNEY_CORE_PACK_IDS);
    const state = emptyJourneyProfile();
    state.skipped[mode] = [catalog.missions[1].id];
    state.clears[mode][catalog.missions[0].id] = {
      runId: 'arranged-receipt',
      gameplayId: 'prior-edition',
      difficulty: 'standard',
    };
    const before = structuredClone(state),
      selected = [];
    const doc = new Document(),
      opener = doc.createElement('button');
    doc.body.append(opener);
    opener.focus();
    let paused = 0;
    const chooser = attachJourneyChooser({
      document: doc,
      catalog,
      mode,
      profile: { snapshot: () => structuredClone(state) },
      onPause: () => paused++,
      onChoose: (mission) => selected.push(mission.id),
      getCard: (mission) => createMissionCard(resolveMission(project, mission.levelId, { mode })),
    });
    const $ = (id) => doc.getElementById(id);
    chooser.open(opener);
    assert.equal(paused, 1);
    assert.equal($('journey-chooser').open, true);
    assert.equal(doc.activeElement, $('journey-search'));
    assert.equal($('journey-cards').children.length, 83);
    assert.equal($('journey-campaign').options.length, 26);
    assert.match($('journey-cards').children[0].textContent, /Cleared/);
    assert.match($('journey-cards').children[1].textContent, /Skipped · try again/);
    for (const card of $('journey-cards').children) {
      assert.equal(card.disabled, false);
      assert.match(card.textContent, /Band \d+\/12/);
      assert.match(card.textContent, /Optional challenge:/);
    }
    const home = catalog.missions.find((m) => m.levelId === 'home-signal');
    $('journey-search').value = 'home-signal';
    $('journey-search').emit('input');
    assert.equal($('journey-cards').children.length, 1);
    assert.equal($('journey-cards').children[0].dataset.missionId, home.id);
    $('journey-cards').children[0].click();
    assert.deepEqual(selected, [home.id]);
    assert.equal($('journey-chooser').open, false);
    assert.equal(sequence.next(home.id), null);
    chooser.open(opener);
    $('journey-search').value = '';
    $('journey-search').emit('input');
    const skipped = $('journey-cards').children[1];
    skipped.focus();
    chooser.refresh();
    assert.equal(doc.activeElement.dataset.missionId, catalog.missions[1].id);
    $('journey-campaign').value = 'candidate/journey-apex/apex-aurora';
    $('journey-campaign').emit('change');
    assert.equal($('journey-cards').children.length, 4);
    assert.equal(sequence.next(catalog.missions[8].id).levelId, 'behind-the-patrol');
    $('journey-search').value = 'no matching mission';
    $('journey-search').emit('input');
    assert.equal($('journey-cards').children.length, 0);
    assert.match($('journey-chooser-status').textContent, /0 missions/);
    $('journey-back').click();
    assert.equal($('journey-chooser').open, false);
    assert.equal(doc.activeElement, opener);
    assert.deepEqual(state, before, 'Selection/filtering must not award, skip or erase progress');
  });
