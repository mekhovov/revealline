import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  exportCreatorTeamCampaign,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
} from '../creator/team.mjs';
import {
  createInstalledTeamAttempt,
  createInstalledTeamAttemptSnapshot,
  createInstalledTeamCampaignStore,
  installedTeamGameplayId,
} from '../creator/team-installed.mjs';
import { stepCoop } from '../coop/core.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
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
      presentation: {
        load: ({ snapshot }) => {
          snapshot.resolved.theme.revision = 79;
        },
      },
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
  const originalLocale = getLocale();
  t.after(() => setLocale(originalLocale, { persist: false }));
  setLocale('en', { persist: false });
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
    presentation: {
      load: ({ snapshot }) => {
        snapshot.resolved.theme.revision = 79;
      },
    },
  });
  await openMissionLibrary(f, 'coop-discovery-open');
  const installed = [...f.$('journey-cards').children].filter((card) => {
    const [source, edition] = JSON.parse(card.dataset.missionId);
    return source === `team-installed:${editionId}` && edition === editionId;
  });
  assert.equal(installed.length, prepared.pack.levels.length);
  assert.match(installed[0].textContent, /Not cleared in this edition/);
  installed[0].focus();
  const selectedId = installed[0].dataset.missionId;
  setLocale('uk', { persist: false });
  assert.equal(f.doc.activeElement, installed[0]);
  assert.equal(installed[0].dataset.missionId, selectedId);
  assert.match(installed[0].textContent, /У цьому виданні не пройдено/);
  assert.match(installed[0].textContent, new RegExp(editionId.slice(0, 12)));
  assert.match(installed[0].textContent, /Campaign 22/);
  assert.equal(installed[0].querySelector('.journey-card-action').textContent, 'Грати');
  await activateMissionCard(installed[0]);
  assert.equal(f.$('journey-chooser').open, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-stage').textContent, prepared.pack.levels[0].name.toUpperCase());
  assert.equal(f.$('coop-level').value, prepared.pack.levels[0].id);
  assert.deepEqual(f.visits, []);
  const reader = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB });
  t.after(() => reader.close());
  let saved = null;
  for (let tries = 0; tries < 40 && !saved; tries++) {
    saved = (await reader.inventory()).editions[0].progress.attempts[prepared.pack.levels[0].id];
    if (!saved) await new Promise((resolve) => setImmediate(resolve));
  }
  assert(saved, 'Starting an installed Team mission writes its recoverable initial checkpoint.');
  assert.equal(saved.editionId, editionId);
  assert.equal(saved.checkpoint.tick, 0);
});

test('a fresh Team host labels and resumes an exactly replayed installed checkpoint', async (t) => {
  const memory = managedIndexedDB(),
    prepared = await campaign('team-host-resume', 24),
    installer = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    { editionId } = await installer.install(prepared),
    level = prepared.pack.levels[0],
    run = createInstalledTeamAttempt(prepared.pack, level.id, 'gentle', 'joint'),
    gameplayId = installedTeamGameplayId(prepared.pack, level.id, 'gentle', 'joint'),
    commands = [
      { direction: 'down', boost: true, support: false },
      { direction: 'down', boost: true, support: false },
    ];
  for (let index = 0; index < 25; index++) stepCoop(run, commands);
  const snapshot = createInstalledTeamAttemptSnapshot({
    editionId,
    attemptId: 'host-resume-attempt',
    gameplayId,
    presetId: 'joint',
    run,
    segments: [{ ticks: 25, commands }],
  });
  await installer.recordAttempt(snapshot, { expectedGeneration: 0 });
  installer.close();
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport: browserFixture(memory),
    presentation: {
      load: ({ snapshot }) => {
        // Exercise the retained historical-import picture policy used by the
        // generated non-media campaign, matching the fresh-launch fixture.
        snapshot.resolved.theme.revision = 79;
      },
    },
  });
  await openMissionLibrary(f, 'coop-discovery-open');
  const card = [...f.$('journey-cards').children].find((candidate) => {
    const [source, edition] = JSON.parse(candidate.dataset.missionId);
    return source === `team-installed:${editionId}` && edition === editionId;
  });
  assert(card);
  assert.match(card.textContent, /Resume saved attempt/);
  await activateMissionCard(card);
  assert.match(f.$('coop-discovery-status').textContent, /restored from its saved attempt/i);
  assert.match(f.$('coop-message').textContent, /Saved territory restored/i);
  assert.equal(f.$('coop-level').value, level.id);
  assert.equal(f.$('coop-difficulty').value, 'gentle');
  assert.equal(f.$('coop-experiment').value, 'joint');
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
      presentation: {
        load: ({ snapshot }) => {
          snapshot.resolved.theme.revision = 79;
        },
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
