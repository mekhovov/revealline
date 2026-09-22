import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  JOURNEY_MUSIC_DIRECTIONS,
  createJourneyMusicDirectionReview,
  createTeamMusicDirectionReview,
} from '../content-design/campaign-music-direction.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { soloCompatibleMusicContext } from '../couch/couch-music-context.mjs';
import { createTeamActorCandidates } from '../content-design/team-actor-candidates.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { canonicalJSON } from '../data-json.mjs';

test('twelve frozen campaign briefs provide scene roles and authored energy, not music or rights approval', () => {
  assert.equal(JOURNEY_MUSIC_DIRECTIONS.length, 12);
  assert.equal(new Set(JOURNEY_MUSIC_DIRECTIONS.map((row) => row.chapterId)).size, 12);
  for (const row of JOURNEY_MUSIC_DIRECTIONS) {
    assert(Object.isFrozen(row));
    assert(Object.isFrozen(row.preferredGenres));
    assert.equal(row.approval, 'direction-only');
    assert.equal(row.originalProduction, 'paused');
    assert.equal(row.menu.scene, 'menu');
    assert.equal(row.gameplay.scene, 'gameplay');
    assert(row.menu.energy <= row.gameplay.energy);
    assert(row.gameplay.energy >= 2 && row.gameplay.energy <= 4);
    assert(row.preferredGenres.every((id) => ['synth90s', 'metal'].includes(id)));
    assert(row.gameplay.brief.length > 40);
    assert(!Object.hasOwn(row, 'trackId'));
  }
  assert.throws(() => createJourneyMusicDirectionReview('__proto__'), /explicit Journey/);
});

test('both whole-Journey editions bind all249 preset contexts exactly to compatible Versus identities', async () => {
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  for (const routeId of ['whole-originals-v3', 'whole-originals-v4']) {
    const route = createAuthoredJourneyRoute(routeId);
    const host = createCandidateVersusHost(route.source, {
      corePackIds: route.corePackIds,
      themes: routeId.endsWith('v4') ? journeyActorThemeCandidates(themes) : themes,
    });
    const report = createJourneyMusicDirectionReview(routeId);
    assert.equal(report.length, 249);
    assert(Object.isFrozen(report));
    for (const row of host.rows) {
      const brief = report.find(
        (item) =>
          item.packId === row.mission.packId &&
          item.campaignId === row.mission.campaignId &&
          item.missionId === row.level.id &&
          item.difficulty === row.difficulty,
      );
      assert(brief);
      assert.deepEqual(
        brief.context,
        soloCompatibleMusicContext({
          campaignKey: row.musicCampaignKey,
          level: row.level,
          themeId: row.defaultThemeId,
        }),
      );
      assert.deepEqual(brief.modes, ['solo', 'versus']);
      assert.equal(brief.direction.sourceThemeId, row.defaultThemeId.replace(/-actors-v1$/, ''));
      assert(Object.isFrozen(brief.context));
    }
  }
});

test('both Team review variants keep all36 exact pack-hashed contexts and prepared look distinct from authored mood', async () => {
  for (const actors of [false, true]) {
    const source = actors
      ? createTeamActorCandidates()
      : createTeamJourneyCandidates({ artwork: true });
    const host = createCandidateTeamHost(source, {
      corePackIds: source.packs.map((pack) => pack.id),
    });
    const report = await createTeamMusicDirectionReview({ actors });
    assert.equal(report.length, 36);
    for (let i = 0; i < report.length; i++) {
      const brief = report[i],
        row = host.rows[i];
      assert.deepEqual(brief.modes, ['team']);
      assert.equal(brief.missionId, row.level.id);
      assert.equal(brief.context.themeId, 'fpv');
      assert.equal(brief.authoredThemeId, row.presentation.themeId);
      const key = JSON.parse(brief.context.campaignKey);
      assert.equal(key[0], 'team-music.v1');
      assert.equal(key[5], createHash('sha256').update(canonicalJSON(row.pack)).digest('hex'));
      assert.equal(
        brief.context.mapKey,
        JSON.stringify([brief.context.campaignKey, row.level.id, row.level.revision, 'fpv']),
      );
      assert(Object.isFrozen(brief.context));
    }
  }
  await assert.rejects(createTeamMusicDirectionReview({ actors: 'yes' }), /explicit Team/);
});
