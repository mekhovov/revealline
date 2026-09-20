import test from 'node:test';
import assert from 'node:assert/strict';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { createNeonCandidates } from '../content-design/neon-candidates.mjs';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createJourneyVisualThemeIdentityAdapter } from '../presentation/journey-visual-theme-identities.mjs';
import themesDocument from '../content-design/themes.json' with { type: 'json' };

for (const [name, factory] of [
  ['Border', createBorderCandidates],
  ['Signal', createSignalCandidates],
  ['Neon', createNeonCandidates],
  ['Rover', createRoverCandidates],
])
  for (const mode of ['solo', 'versus'])
    test(`${name} actual ${mode} host preserves exact authored theme identities across all missions and presets`, async () => {
      const source = factory({ artwork: true });
      const makeHost = mode === 'solo' ? createCandidateSoloHost : createCandidateVersusHost;
      const host = makeHost(source, {
        themes: themesDocument.themes,
        corePackIds: [source.packs[0].id],
      });
      try {
        const adapter = await createJourneyVisualThemeIdentityAdapter(source, { mode });
        const identities = new Map();
        let count = 0;
        for (const selection of host.entries ?? host.rows) {
          for (const level of mode === 'solo' ? selection.campaign.levels : [selection.level]) {
            const raw = host.visualThemeSelection(selection, level);
            const manifest = raw.entry.manifests.find((item) => item.missionId === level.id);
            const context = await adapter.prepareHostSelection({
              host,
              selection,
              level,
              association: {
                editionId: 'journey',
                contentThemeId: manifest.presentation.themeId,
                mode,
              },
            });
            const key = `${raw.entry.sourcePackId}/${raw.entry.campaignId}/${level.id}`;
            if (identities.has(key)) assert.deepEqual(context, identities.get(key));
            else identities.set(key, context);
            assert.equal(context.owner.projectId, source.id);
            assert.equal(context.owner.packId, raw.entry.sourcePackId);
            assert.equal(context.level.id, level.id);
            assert.equal(raw.entry.officialProgressEligible, false);
            assert(Object.isFrozen(context));
            count++;
          }
        }
        assert.equal(identities.size, 7);
        assert.equal(count, 21);
      } finally {
        host.preparer?.dispose();
      }
    });
