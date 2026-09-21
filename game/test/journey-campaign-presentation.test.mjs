import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTheme } from '../content.mjs';
import {
  JOURNEY_CAMPAIGN_THEMES,
  withCampaignPresentation,
} from '../content-design/campaign-presentation.mjs';
import { createWholeJourneyChapterSources } from '../content-design/whole-journey-candidates.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { loadPreviewTheme } from '../content-design/preview-loader.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';
import { auditJourneyAdaptations } from '../../scripts/audit-journey-adaptations.mjs';
import themesDocument from '../content-design/themes.json' with { type: 'json' };

const { themes } = themesDocument;
const oldRoute = createAuthoredJourneyRoute('whole-originals-v2');
const route = createAuthoredJourneyRoute('whole-originals-v3');
const oldProject = compileContentProject(oldRoute.source);
const project = compileContentProject(route.source);
const chapters = createWholeJourneyChapterSources({
  artwork: true,
  roverTeaching: true,
  campaignPresentation: true,
});
const expected = new Map(
  chapters.flatMap(({ id, source }) =>
    source.missions.map((mission) => [mission.id, JOURNEY_CAMPAIGN_THEMES[id]]),
  ),
);

const luminance = (hex) => {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a, b) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('twelve registered campaign palettes retain functional labels, shapes and unrounded contrast floors', async () => {
  assert.equal(themes.length, 12);
  assert.equal(new Set(Object.values(JOURNEY_CAMPAIGN_THEMES)).size, 12);
  assert.equal(new Set(themes.map((theme) => theme.palette.field)).size, 12);
  const presets = JSON.parse(
    await readFile(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  );
  for (const theme of themes) {
    assert.deepEqual(validateTheme(theme).errors, [], theme.id);
    assert(presets.characters[theme.player]);
    for (const key of [
      'family',
      'player',
      'enemyShape',
      'patrolShape',
      'bossShape',
      'labels',
      'classBodies',
    ])
      assert.deepEqual(theme[key], themes[0][key], `${theme.id}/${key}`);
    for (const key of ['accent', 'safe', 'danger']) {
      assert.equal(theme.palette[key], themes[0].palette[key]);
      assert(contrast(theme.palette[key], theme.palette.field) >= 3, `${theme.id}/${key}`);
    }
    for (const key of ['paper', 'muted'])
      assert(contrast(theme.palette[key], theme.palette.field) >= 4.5, `${theme.id}/${key}`);
    assert(contrast(theme.palette.paper, theme.palette.ink) >= 4.5);
  }
  // Nominal flat-color checks are not photograph, antialiasing or device qualification.
  const legacy = JSON.parse(await readFile(new URL('../content/themes.json', import.meta.url)));
  assert(!legacy.themes.some((theme) => Object.values(JOURNEY_CAMPAIGN_THEMES).includes(theme.id)));
});

test('copy-on-write presentation does not mutate drafts or repeatedly advance an already-bound edition', () => {
  const chapter = createWholeJourneyChapterSources({ artwork: true, roverTeaching: true }).find(
    ({ id }) => id === 'rover',
  ).source;
  const original = structuredClone(chapter);
  const projected = withCampaignPresentation(chapter, 'rover');
  assert.deepEqual(chapter, original);
  assert.deepEqual(withCampaignPresentation(projected, 'rover'), projected);
  projected.maps[0].name = 'Local edit';
  assert.deepEqual(chapter, original);
  assert.throws(() => withCampaignPresentation(chapter, '__proto__'), /Unknown/);
  assert.throws(() => withCampaignPresentation({ missions: [] }, 'rover'), /needs missions/);
  const mixed = structuredClone(chapter);
  mixed.missions[0].presentation.themeId = 'rover-yard';
  assert.throws(() => withCampaignPresentation(mixed, 'rover'), /mixed-theme/);
});

test('498 manifests preserve exact physical fields, geometry, originals and design; only59 missions acquire theme editions', () => {
  assert.notEqual(route.sessionKey, oldRoute.sessionKey);
  assert.equal(route.sessionKey, 'revealline.suspended.journey-whole-originals.v3');
  assert.deepEqual(route.corePackIds, oldRoute.corePackIds);
  assert.deepEqual(route.source.maps, oldRoute.source.maps);
  assert.deepEqual(route.source.assets, oldRoute.source.assets);
  let changed = 0,
    unchanged = 0;
  for (const mission of route.source.missions)
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const next = resolveMission(project, mission.id, { mode, difficulty });
        const previous = resolveMission(oldProject, mission.id, { mode, difficulty });
        assert.equal(next.presentation.themeId, expected.get(mission.id));
        assert.equal(next.simulationIdentity, previous.simulationIdentity);
        assert.deepEqual({ ...next.level, revision: previous.level.revision }, previous.level);
        for (const key of ['background', 'design', 'diagnostics', 'topology'])
          assert.deepEqual(next[key], previous[key]);
        assert.equal(next.officialProgressEligible, false);
        if (next.presentation.themeId !== previous.presentation.themeId) {
          assert.equal(next.level.revision, `${previous.level.revision}-theme-1`);
          changed++;
        } else {
          assert.deepEqual(next, previous);
          unchanged++;
        }
      }
  assert.equal(changed, 354);
  assert.equal(unchanged, 144);
  assert.equal(createAuthoredJourneyRoute('authored').source.missions.length, 17);
});

for (const mode of ['solo', 'versus'])
  test(`249 ${mode} host selections own exact campaign themes and stable per-preset visual identities`, async () => {
    const host = (mode === 'solo' ? createCandidateSoloHost : createCandidateVersusHost)(
      route.source,
      { themes, corePackIds: route.corePackIds },
    );
    try {
      const adapter = await createJourneyVisualThemeIdentityAdapter(route.source, { mode });
      const identities = new Map();
      let count = 0;
      for (const selection of host.entries ?? host.rows)
        for (const level of mode === 'solo' ? selection.campaign.levels : [selection.level]) {
          const themeId = expected.get(level.id);
          assert.deepEqual(
            selection.themes.map((theme) => theme.id),
            [themeId],
          );
          const raw = host.visualThemeSelection(selection, level);
          const manifest = raw.entry.manifests.find((m) => m.missionId === level.id);
          assert.equal(manifest.presentation.themeId, themeId);
          const context = await adapter.prepareHostSelection({
            host,
            selection,
            level,
            association: { editionId: 'journey', contentThemeId: themeId, mode },
          });
          if (identities.has(level.id)) assert.deepEqual(context, identities.get(level.id));
          else identities.set(level.id, context);
          assert.equal(context.owner.projectId, route.source.id);
          count++;
        }
      assert.equal(count, 249);
      assert.equal(identities.size, 83);
      let length = 0;
      for (let mission = host.catalog.missions[0]; mission; mission = host.next(mission.id))
        length++;
      assert.equal(length, 71);
    } finally {
      host.preparer?.dispose();
    }
  });

test('Studio loads exact theme IDs with no Horizon substitution; greybox scenarios match the same projection', async () => {
  const sources = createWholeJourneyChapterSources({
    roverTeaching: true,
    campaignPresentation: true,
  });
  for (const { id, source } of sources) {
    const themeId = JOURNEY_CAMPAIGN_THEMES[id];
    const theme = await loadPreviewTheme({
      themeId,
      fetchTheme: async () => ({
        ok: true,
        json: async () => themesDocument,
      }),
    });
    assert.equal(theme.id, themeId);
    for (const mission of source.missions) {
      const preview = prepareContentPreview(source, mission.id, { theme });
      assert.equal(preview.scenario.theme.id, themeId);
      assert.deepEqual(preview.scenario.level, preview.manifest.level);
    }
  }
  await assert.rejects(
    () =>
      loadPreviewTheme({
        themeId: 'neon-contours',
        fetchTheme: async () => ({ ok: true, json: async () => ({ themes: [themes[0]] }) }),
      }),
    /theme/i,
  );
});

test('individual Studio chapter inspections use the same presentation projection and require explicit Apply', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  for (const [id, factory] of [
    ['neon', 'Neon'],
    ['rover', 'RoverTeaching'],
    ['fracture', 'Fracture'],
    ['phase', 'Phase'],
    ['livewire', 'Livewire'],
    ['relay', 'Relay'],
    ['crosswind', 'Crosswind'],
    ['sentinel', 'Sentinel'],
    ['apex', 'Apex'],
  ]) {
    const start = studio.indexOf(`$('${id}').onclick = guarded(() => {`);
    assert(start >= 0, id);
    const handler = studio.slice(start, studio.indexOf('\n});', start));
    assert(
      handler.includes(
        `withCampaignPresentation(create${factory}Candidates({ artwork: true }), '${id}')`,
      ),
      id,
    );
    assert(handler.includes('discardSource()'), id);
    assert(handler.includes('inspectSource()'), id);
    assert.doesNotMatch(handler, /session\.(?:apply|replace|transact)|location\.|publish/i);
  }
});

test('adaptation inspection uses the same campaign edition and does not invent final acceptance', async () => {
  const report = await auditJourneyAdaptations({ edition: 'campaign-originals' });
  assert.equal(report.contentEdition, 'campaign-originals');
  assert.equal(report.counts.coveredReferences, 48);
  assert.equal(report.counts.authoredSoloCandidates, 83);
  assert.equal(report.counts.finalDispositions, 0);
  for (const link of report.references.flatMap((row) => row.adaptations)) {
    assert.equal(
      link.missionRevision,
      route.source.missions.find((m) => m.id === link.missionId).revision,
    );
    for (const { mode, difficulty, simulationIdentity } of link.editions)
      assert.equal(
        resolveMission(project, link.missionId, { mode, difficulty }).simulationIdentity,
        simulationIdentity,
      );
  }
});
