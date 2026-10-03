import test from 'node:test';
import assert from 'node:assert/strict';
import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createMissionCard } from '../content-design/mission-card.mjs';
import { contentText } from '../i18n/content.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';

test('all pursuit pilots and chapter titles, briefings and native cards translate without changing accepted recipes', (context) => {
  const previous = getLocale();
  context.after(() => setLocale(previous, { persist: false }));
  for (const factory of [createPursuitPilotCandidates, createPursuitCampaignCandidates])
    for (const team of [false, true]) {
      const source = factory({ team }),
        before = dataIdentity(source);
      setLocale('uk', { persist: false });
      for (const record of [
        source,
        ...source.maps,
        ...source.missions,
        ...source.campaigns,
        ...source.packs,
      ])
        assert.match(contentText(record, 'name'), /[А-ЯІЇЄҐа-яіїєґ]/, record.id);
      for (const mission of source.missions)
        for (const field of [
          'routeDecision',
          'lesson',
          'counterplay',
          'captureConsequence',
          'memorableMoment',
          'mastery',
        ])
          assert.notEqual(
            contentText(mission.design, field),
            mission.design[field],
            `${mission.id}/${field}`,
          );
      const catalog = createContentExecutionCatalog(source, { mode: team ? 'team' : 'solo' });
      for (const entry of catalog.entries)
        for (const manifest of entry.manifests) {
          assert.notEqual(contentText(manifest.level, 'name'), manifest.level.name);
          const accepted = applyGameplayTuning(
            manifest.level,
            resolveGameplayTuning(entry.difficulty),
          );
          assert.notEqual(contentText(accepted, 'name'), accepted.name);
          const card = createMissionCard(manifest);
          assert.notEqual(contentText(card, 'route'), card.route);
          assert.notEqual(contentText(card, 'mastery'), card.mastery);
          const edited = structuredClone(manifest);
          edited.missionId = 'custom-unregistered';
          assert.equal(contentText(edited, 'design.routeDecision'), edited.design.routeDecision);
        }
      setLocale('en', { persist: false });
      for (const mission of source.missions)
        assert.equal(contentText(mission, 'name'), mission.name);
      assert.equal(dataIdentity(source), before);
    }
});
