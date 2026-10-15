import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createSoloRouteHost } from '../content-design/solo-route-host.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { prepareImprovPlayer } from '../demo-improv-player.mjs';
import { verifyReplayAsync } from '../replay.mjs';

const owners = new Map();
async function ownerEntries(owner) {
  if (!owners.has(owner))
    owners.set(
      owner,
      (async () => {
        let route, themes;
        if (owner === 'journey') {
          route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
          themes = JSON.parse(
            await readFile(new URL('../content-design/themes.json', import.meta.url)),
          ).themes;
        } else {
          const boot = await loadEditionBootstrap({
            catalogURL: new URL('../editions/catalog.json', import.meta.url).href,
            contentBaseURL: new URL('../../', import.meta.url).href,
            editionId: owner,
            fetcher: async (url) => ({
              ok: true,
              text: () => readFile(fileURLToPath(url), 'utf8'),
            }),
          });
          route = boot.route;
          themes = boot.boot.themes.themes;
        }
        const host = await createSoloRouteHost(route, {
          themes,
          buildVersion: 'demo-recovery-test',
        });
        try {
          return host.entries;
        } finally {
          host.preparer.dispose();
        }
      })(),
    );
  return owners.get(owner);
}

const cases = [
  ['journey', 'fractured-grid', 'staggered-reserve', 'immediate'],
  ['journey', 'fractured-grid', 'staggered-reserve', 'grid-center'],
  ['journey', 'sentinel-crown', 'first-relay', 'immediate'],
  ['journey', 'sentinel-crown', 'first-relay', 'grid-center'],
  ['journey', 'sentinel-crown', 'relay-perimeter', 'immediate'],
  ['journey', 'sentinel-crown', 'crown-audience', 'grid-center'],
  ['droneaid', 'droneaid-nl-signals-of-support', 'droneaid-nl-signals-of-support-04', 'immediate'],
  [
    'droneaid',
    'droneaid-nl-signals-of-support',
    'droneaid-nl-signals-of-support-06',
    'grid-center',
  ],
  ['coupa-all', 'coupa-developer-integration', 'coupa-developer-integration-02', 'grid-center'],
];
// Catalogue compilation is fixture setup, outside each performance deadline.
for (const owner of new Set(cases.map(([owner]) => owner))) await ownerEntries(owner);
for (const [owner, campaign, levelId, turnPolicy] of cases)
  test(
    `${owner}/${levelId}/${turnPolicy}: formerly stalled performance reaches a real result`,
    { timeout: 120000 },
    async (t) => {
      const entries = await ownerEntries(owner);
      const entry = entries.find(
        (entry) =>
          entry.campaign.id === campaign && (!entry.difficulty || entry.difficulty === 'standard'),
      );
      assert.ok(entry, 'Use the installed owner, never a merged company catalogue.');
      const index = entry.campaign.levels.findIndex((level) => level.id === levelId);
      assert.ok(index >= 0);
      const original = JSON.stringify(entry.campaign.levels[index]);
      const recipes = entry.classRecipes ?? entry.campaign.classRecipes;
      const seed = (((index + 1) * 2654435761) ^ Math.imul(1, 2246822519)) >>> 0;
      const player = await prepareImprovPlayer(
        applyGameplayTuning(entry.campaign.levels[index], resolveGameplayTuning('standard')),
        { seed, turnPolicy, classId: recipes[index % recipes.length].id, classRecipes: recipes },
        { performanceSeed: seed, signal: t.signal },
      );
      try {
        const recording = player.exportRecording();
        const checked = await verifyReplayAsync(recording, { signal: t.signal });
        assert.equal(checked.match, true);
        assert.ok(['won', 'lost'].includes(checked.state.status));
        assert.ok(checked.state.coverage > 0);
        player.play();
        while (player.phase === 'playing') player.advance(0.25);
        assert.equal(player.phase, 'complete');
        assert.equal(player.finalCheckpoint.matched, true);
        assert.equal(JSON.stringify(entry.campaign.levels[index]), original);
      } finally {
        player.dispose();
      }
    },
  );
