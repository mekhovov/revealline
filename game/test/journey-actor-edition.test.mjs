import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createJourneyActorTheme,
  JOURNEY_ACTOR_MATERIALS,
  journeyActorThemeMaterial,
} from '../presentation/journey-actor-materials.mjs';
import { withCampaignActorPresentation } from '../content-design/campaign-actor-presentation.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { loadPreviewTheme } from '../content-design/preview-loader.mjs';
import { validateTheme } from '../content.mjs';
import { createActorPresentation, drawPresentedActor } from '../ui/actor-presentation.mjs';
import { ENEMY_CATALOG, enemySkinId } from '../enemy-catalog.mjs';
import { auditJourneyAdaptations } from '../../scripts/audit-journey-adaptations.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;

test('Studio and adaptation inspection expose the same explicit material successor without changing the old review action', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const actorHandler = studio.slice(
    studio.indexOf("$('whole-journey-actors').onclick"),
    studio.indexOf("$('import').onchange"),
  );
  assert.match(actorHandler, /campaignActors: true/);
  assert.match(actorHandler, /if \(!discardSource\(\)\) return/);
  assert.match(actorHandler, /inspectSource\(\)/);
  assert.doesNotMatch(actorHandler, /session\.replace|applySource\(|launchPreview\(/);
  const previousHandler = studio.slice(
    studio.indexOf("$('whole-journey').onclick"),
    studio.indexOf("$('whole-journey-actors').onclick"),
  );
  assert.doesNotMatch(previousHandler, /campaignActors/);
  const audit = await auditJourneyAdaptations({ edition: 'actor-originals' });
  assert.equal(audit.contentEdition, 'actor-originals');
  assert.equal(audit.counts.numberedReferences, 48);
  assert.equal(audit.counts.coveredReferences, 48);
  assert.equal(audit.counts.finalDispositions, 0);
  assert.equal(audit.counts.authoredSoloCandidates, 83);
  const source = createAuthoredJourneyRoute('whole-originals-v4').source;
  for (const row of audit.references)
    for (const link of row.adaptations)
      assert.equal(
        link.missionRevision,
        source.missions.find((mission) => mission.id === link.missionId).revision,
      );
});

test('explicit material theme successors retain the existing palette/labels/player authority and do not alter old theme loading', async () => {
  for (const theme of themes) {
    const before = structuredClone(theme),
      successor = createJourneyActorTheme(theme);
    assert.deepEqual(theme, before);
    assert.deepEqual(validateTheme(successor).errors, []);
    assert.equal(successor.id, `${theme.id}-actors-v1`);
    assert.deepEqual(successor.palette, theme.palette);
    assert.deepEqual(successor.classBodies, theme.classBodies);
    assert.deepEqual(successor.labels, theme.labels);
    assert.equal(journeyActorThemeMaterial(theme.id), null);
    assert.equal(journeyActorThemeMaterial(successor.id).sourceThemeId, theme.id);
    const fetchTheme = async () => ({ ok: true, json: async () => ({ themes }) });
    assert.equal(await loadPreviewTheme({ themeId: theme.id, fetchTheme }), theme);
    assert.deepEqual(await loadPreviewTheme({ themeId: successor.id, fetchTheme }), successor);
    successor.palette.field = '#000000';
    assert.deepEqual(theme, before);
  }
  for (const id of ['fpv', '__proto__', 'horizon-actors-v2'])
    assert.equal(journeyActorThemeMaterial(id), null);
  assert.throws(() => createJourneyActorTheme({ id: 'fpv' }), /registered/);
  await assert.rejects(
    loadPreviewTheme({
      themeId: 'horizon-actors-v1',
      fetchTheme: async () => ({ ok: true, json: async () => ({ themes: [] }) }),
    }),
    /unavailable/,
  );
});

test('copy-on-write material projection is explicit, idempotent and rejects mixed or unknown chapters', () => {
  const source = createOpeningCandidates({ artwork: true }),
    before = structuredClone(source);
  const next = withCampaignActorPresentation(source, 'horizon');
  assert.deepEqual(source, before);
  assert.notEqual(next.id, source.id);
  assert.deepEqual(withCampaignActorPresentation(next, 'horizon'), next);
  assert(next.missions.every((mission) => mission.presentation.themeId === 'horizon-actors-v1'));
  assert.throws(() => withCampaignActorPresentation(source, '__proto__'), /Unknown/);
  assert.throws(() => withCampaignActorPresentation({ missions: [] }, 'horizon'), /needs missions/);
  const mixed = structuredClone(source);
  mixed.missions[0].presentation.themeId = 'border-bloom';
  assert.throws(() => withCampaignActorPresentation(mixed, 'horizon'), /mixed-theme/);
});

test('material review edition owns its save slot and preserves all498 resolved simulations and83 original assets', () => {
  const old = createAuthoredJourneyRoute('whole-originals-v3'),
    next = createAuthoredJourneyRoute('whole-originals-v4');
  assert.equal(next.sessionKey, 'revealline.suspended.journey-whole-originals.v4');
  assert.notEqual(old.sessionKey, next.sessionKey);
  assert.deepEqual(next.corePackIds, old.corePackIds);
  assert.deepEqual(next.source.maps, old.source.maps);
  assert.deepEqual(next.source.assets, old.source.assets);
  const oldProject = compileContentProject(old.source),
    project = compileContentProject(next.source);
  assert.equal(project.missions.length, 83);
  let count = 0;
  for (const mission of project.missions)
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const previous = resolveMission(oldProject, mission.id, { mode, difficulty });
        const current = resolveMission(project, mission.id, { mode, difficulty });
        assert.equal(current.simulationIdentity, previous.simulationIdentity);
        assert.notEqual(current.level.revision, previous.level.revision);
        assert.equal(current.presentation.themeId, `${previous.presentation.themeId}-actors-v1`);
        assert.equal(
          current.presentation.backgroundAssetId,
          previous.presentation.backgroundAssetId,
        );
        count++;
      }
  assert.equal(count, 498);
});

const actor = (type) => Object.freeze({ id: type, type, x: 8, y: 4, vx: 3, vy: 0, radius: 0.2 });
const sample = (type, options) =>
  createActorPresentation()
    .sample([actor(type)], { themeId: 'horizon-actors-v1', reduced: true, ...options })
    .get(type);
function surface() {
  const calls = [],
    values = {};
  return {
    calls,
    ctx: new Proxy(
      {},
      {
        get: (_, name) =>
          name in values ? values[name] : (...args) => calls.push([name, ...args]),
        set: (_, name, value) => {
          values[name] = value;
          return true;
        },
      },
    ),
  };
}

test('shared actor sampling opts in only for successor IDs, preserves exact contact geometry and honors explicit skins', () => {
  for (const material of JOURNEY_ACTOR_MATERIALS)
    for (const { type } of ENEMY_CATALOG) {
      const old = sample(type, { themeId: material.sourceThemeId });
      const next = sample(type, { themeId: `${material.sourceThemeId}-actors-v1` });
      const { journeyMaterial, ...unchanged } = next;
      assert.equal(journeyMaterial, material.id);
      assert.deepEqual(unchanged, old);
      assert(Object.isFrozen(next));
      const override = sample(type, {
        themeId: `${material.sourceThemeId}-actors-v1`,
        actorSkins: { [type]: enemySkinId(type, 'ukraine') },
      });
      assert.equal(override.themeId, 'ukraine');
      assert(!Object.hasOwn(override, 'journeyMaterial'));
      const { ctx, calls } = surface();
      drawPresentedActor(ctx, next, themes[0].palette);
      assert(
        calls.some(([name, , , radius]) => name === 'arc' && radius === actor(type).radius * 16),
      );
      assert(calls.some(([name, , , w, h]) => name === 'fillRect' && w === 2 && h === 2));
      const uploaded = Object.freeze({ id: 'user-body' }),
        custom = surface();
      drawPresentedActor(custom.ctx, next, themes[0].palette, uploaded);
      assert(custom.calls.some(([name, image]) => name === 'drawImage' && image === uploaded));
      assert(
        custom.calls.filter(([name]) => name === 'fillRect').length <
          calls.filter(([name]) => name === 'fillRect').length,
      );
    }
});
