import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  exportCreatorTeamCampaign,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
} from '../creator/team.mjs';
import { createInstalledTeamCampaignStore } from '../creator/team-installed.mjs';
import { page } from './helpers/coop-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

async function campaign(id, seed) {
  const generated = generateCreatorTeamCampaign({
    id,
    name: `Campaign ${seed}`,
    seed,
  });
  return prepareCreatorTeamCampaign(generated.pack, generated.provenance);
}

function browserFixture(memory) {
  return ({ install }) => {
    install('crypto', { value: webcrypto });
    install('indexedDB', { value: memory.indexedDB });
    install('localStorage', { value: storage() });
  };
}

test('production Team import installs the exact creator edition while keeping Start deliberate', async (t) => {
  const memory = managedIndexedDB(),
    prepared = await campaign('team-host-install', 21),
    portable = exportCreatorTeamCampaign(prepared),
    f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      beforeImport: browserFixture(memory),
    });
  f.$('coop-pack-file').closest('details').open = true;
  f.$('coop-pack-file').files = [portable];
  await f.$('coop-pack-file').onchange();
  assert.match(f.$('coop-picture-status').textContent, /campaign installed/i);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-start').disabled, false);
  const reader = createInstalledTeamCampaignStore({
      indexedDB: memory.indexedDB,
    }),
    inventory = await reader.inventory();
  t.after(() => reader.close());
  assert.equal(inventory.generation, 1);
  assert.equal(inventory.editions.length, 1);
  assert.equal(inventory.editions[0].pack.id, prepared.pack.id);
  await openMissionLibrary(f, 'coop-discovery-open');
  const campaignCards = [...f.$('journey-cards').children].filter((card) => {
    const [source] = JSON.parse(card.dataset.missionId);
    return source === `team-installed:${inventory.editions[0].editionId}`;
  });
  assert.equal(campaignCards.length, prepared.pack.levels.length);
  assert.equal(
    [...f.$('journey-cards').children].some((card) =>
      JSON.parse(card.dataset.missionId)[0].startsWith('team-custom:'),
    ),
    false,
  );
});

test('a fresh Team host discovers and launches one exact installed edition', async (t) => {
  const memory = managedIndexedDB(),
    prepared = await campaign('team-host-reopen', 22),
    installer = createInstalledTeamCampaignStore({
      indexedDB: memory.indexedDB,
    }),
    { editionId } = await installer.install(prepared);
  installer.close();
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport: browserFixture(memory),
  });
  await openMissionLibrary(f, 'coop-discovery-open');
  const installed = [...f.$('journey-cards').children].filter((card) => {
    const [source, edition] = JSON.parse(card.dataset.missionId);
    return source === `team-installed:${editionId}` && edition === editionId;
  });
  assert.equal(installed.length, prepared.pack.levels.length);
  assert.match(installed[0].textContent, /Not cleared in this edition/);
  await activateMissionCard(installed[0]);
  assert.equal(f.$('journey-chooser').open, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-stage').textContent, prepared.pack.levels[0].name.toUpperCase());
  assert.equal(f.$('coop-level').value, prepared.pack.levels[0].id);
  assert.deepEqual(f.visits, []);
});

test('storage denial keeps a verified Team campaign playable for the current visit', async (t) => {
  const prepared = await campaign('team-host-visit-only', 23),
    portable = exportCreatorTeamCampaign(prepared),
    f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      beforeImport({ install }) {
        install('crypto', { value: webcrypto });
        install('indexedDB', { value: undefined });
        install('localStorage', { value: storage() });
      },
    });
  f.$('coop-pack-file').closest('details').open = true;
  f.$('coop-pack-file').files = [portable];
  await f.$('coop-pack-file').onchange();
  assert.match(f.$('coop-picture-status').textContent, /ready for this visit/i);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-start').disabled, false);
  await openMissionLibrary(f, 'coop-discovery-open');
  assert.equal(
    [...f.$('journey-cards').children].filter((card) =>
      JSON.parse(card.dataset.missionId)[0].startsWith('team-custom:'),
    ).length,
    prepared.pack.levels.length,
  );
  assert.match(f.$('coop-discovery-status').textContent, /could not be checked/i);
});
