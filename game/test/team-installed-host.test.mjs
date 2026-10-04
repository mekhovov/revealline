import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  exportCreatorTeamCampaign,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
  prepareCreatorTeamSourceCampaign,
} from '../creator/team.mjs';
import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import {
  TEAM_HUNT_ATTEMPT_KEY,
  restoreTeamHuntAttempt,
  snapshotTeamHuntPresentation,
} from '../coop/hunt-attempts.mjs';
import {
  CREATOR_TEAM_DATABASE,
  CREATOR_TEAM_PROGRESS_FORMAT,
  createInstalledTeamAttempt,
  createInstalledTeamAttemptSnapshot,
  createInstalledTeamCampaignStore,
  installedTeamGameplayId,
  snapshotInstalledTeamPresentation,
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
  assert.equal(installed[0].querySelector('.journey-card-action').hidden, true);
  assert.equal(installed[0].querySelector('.journey-card-action').textContent, '');
  await activateMissionCard(installed[0]);
  assert.equal(f.$('journey-chooser').open, false);
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, false);
  f.tick(); // Sample released controls before a separate deliberate Start.
  f.$('coop-resume').focus();
  f.$('coop-resume').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-stage').textContent, prepared.pack.levels[0].name.toUpperCase());
  assert.equal(f.$('coop-level').value, prepared.pack.levels[0].id);
  assert.deepEqual(f.visits, []);
  const reader = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB });
  t.after(() => reader.close());
  let saved = null;
  for (const deadline = Date.now() + 5000; Date.now() < deadline && !saved; ) {
    saved = (await reader.inventory()).editions[0].progress.attempts[prepared.pack.levels[0].id];
    if (!saved) await delay(5);
  }
  assert(
    saved,
    `Starting an installed Team mission writes its recoverable initial checkpoint. ${f.$('coop-message').textContent}`,
  );
  const decoded = snapshotInstalledTeamPresentation(saved, editionId, prepared.pack.levels[0].id);
  assert.equal(
    decoded.attemptAppearance?.environmentPin ?? null,
    null,
    'An installed edition never inherits built-in chapter authority.',
  );
  assert.equal(decoded.snapshot.editionId, editionId);
  assert.equal(decoded.snapshot.checkpoint.tick, 0);
});

test('installed Team cards show historical clears without inventing a star grade', async (t) => {
  const memory = managedIndexedDB(),
    prepared = await campaign('team-host-cleared', 25),
    installer = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
    { editionId } = await installer.install(prepared),
    level = prepared.pack.levels[0];
  installer.close();
  // Model a valid receipt persisted by a previous Team host. This tests the
  // real inventory-to-card adapter, not replay verification or grade authority.
  await new Promise((resolve, reject) => {
    const opened = memory.indexedDB.open(CREATOR_TEAM_DATABASE, 1);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result,
        tx = db.transaction('progress', 'readwrite');
      tx.objectStore('progress').put(
        {
          format: CREATOR_TEAM_PROGRESS_FORMAT,
          editionId,
          generation: 1,
          clears: {
            [level.id]: {
              runId: 'historical-team-clear',
              gameplayId: installedTeamGameplayId(prepared.pack, level.id, 'standard', 'full'),
              difficulty: 'standard',
              presetId: 'full',
            },
          },
          attempts: {},
        },
        editionId,
      );
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
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
  const cards = [...f.$('journey-cards').children].filter(
    (card) => JSON.parse(card.dataset.missionId)[0] === `team-installed:${editionId}`,
  );
  assert.equal(cards.length, prepared.pack.levels.length);
  assert.equal(cards[0].dataset.completionState, 'completed');
  assert.equal(cards[0].dataset.bestStars, '');
  assert.match(
    cards[0].querySelector('.journey-card-progress').textContent,
    /Cleared.*Standard.*Full teamwork/,
  );
  assert.match(cards[0].getAttribute('aria-label'), /Cleared.*Standard.*Full teamwork/);
  assert.equal(cards[1].dataset.completionState, 'new');
  assert.equal(cards[1].dataset.bestStars, '');
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
  assert.equal(f.$('coop-overlay').hidden, false);
  const clock = f.$('coop-clock').textContent;
  f.tick(120);
  assert.equal(f.$('coop-clock').textContent, clock);
  f.$('coop-resume').focus();
  f.$('coop-resume').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-level').value, level.id);
  assert.equal(f.$('coop-difficulty').value, 'gentle');
  assert.equal(f.$('coop-experiment').value, 'joint');
});

for (const restoring of [false, true])
  test(
    restoring
      ? 'an installed Hunt resumes through its paused briefing and retains replayable release journals'
      : 'a fresh installed Hunt saves the released briefing state in both native journals',
    async (t) => {
      const memory = managedIndexedDB(),
        local = storage(),
        prepared = await prepareCreatorTeamSourceCampaign(
          createPursuitPilotCandidates({ team: true }),
          {
            sourcePackId: 'journey-pursuit-team',
            campaignId: 'pursuit-team-pilots',
            difficulty: 'standard',
          },
        ),
        installer = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB }),
        { editionId } = await installer.install(prepared),
        level = prepared.pack.levels[0],
        run = createInstalledTeamAttempt(prepared.pack, level.id, 'standard', 'full'),
        gameplayId = installedTeamGameplayId(prepared.pack, level.id, 'standard', 'full'),
        commands = [
          { direction: 'right', boost: false, support: false },
          { direction: 'left', boost: false, support: false },
        ];
      assert.ok(run.level.hunt);
      if (restoring) for (let index = 0; index < 25; index++) stepCoop(run, commands);
      const snapshot = createInstalledTeamAttemptSnapshot({
        editionId,
        attemptId: 'installed-hunt-briefing',
        gameplayId,
        presetId: 'full',
        run,
        segments: restoring ? [{ ticks: 25, commands }] : [],
      });
      if (restoring) await installer.recordAttempt(snapshot, { expectedGeneration: 0 });
      t.after(() => installer.close());
      const f = await page(t, {
        nativeFocus: true,
        nativeVisibility: true,
        beforeImport({ install }) {
          install('crypto', { value: webcrypto });
          install('indexedDB', { value: memory.indexedDB });
          install('localStorage', { value: local });
        },
        presentation: {
          load: ({ snapshot: artwork }) => {
            artwork.resolved.theme.revision = 79;
          },
        },
      });
      await openMissionLibrary(f, 'coop-discovery-open');
      const card = [...f.$('journey-cards').children].find((candidate) => {
        const [source, edition, , levelId] = JSON.parse(candidate.dataset.missionId);
        return (
          source === `team-installed:${editionId}` && edition === editionId && levelId === level.id
        );
      });
      assert.ok(card);
      await activateMissionCard(card);
      assert.equal(f.$('coop-overlay').hidden, false, f.$('journey-chooser-status').textContent);
      assert.match(
        f.$('coop-resume').textContent,
        restoring ? /Resume together/ : /Start together/,
      );
      assert.equal(
        local.getItem(TEAM_HUNT_ATTEMPT_KEY),
        null,
        'Preparation does not overwrite a save.',
      );
      f.tick(); // The admission gesture cannot also count as Resume.
      f.$('coop-resume').focus();
      f.$('coop-resume').click();
      assert.equal(
        f.$('coop-overlay').hidden,
        true,
        'Resume binds Hunt stores only after the core resumes.',
      );
      if (!restoring) {
        const initial = JSON.parse(local.getItem(TEAM_HUNT_ATTEMPT_KEY));
        assert.deepEqual(snapshotTeamHuntPresentation(initial).snapshot.segments, [
          { release: true },
        ]);
        const verified = await restoreTeamHuntAttempt(initial, { pack: prepared.pack, level });
        assert.equal(verified.run.tick, 0);
        assert.deepEqual(verified.run.needsNeutral, [true, true]);
      }
      f.$('coop-pause').click();
      const savedEnvelope = JSON.parse(local.getItem(TEAM_HUNT_ATTEMPT_KEY));
      const saved = snapshotTeamHuntPresentation(savedEnvelope).snapshot;
      if (restoring) assert.equal(saved.attemptId, snapshot.attemptId);
      else assert.ok(saved.attemptId);
      assert.equal(saved.checkpoint.tick, snapshot.checkpoint.tick);
      if (restoring) assert.deepEqual(saved.segments[0], snapshot.segments[0]);
      assert.deepEqual(saved.segments.at(-1), { release: true });
      const verified = await restoreTeamHuntAttempt(savedEnvelope, { pack: prepared.pack, level });
      assert.equal(verified.run.tick, run.tick);
      assert.deepEqual(verified.run.needsNeutral, [true, true]);
      // Force-pause persistence serializes asynchronously through the installed store.
      for (const deadline = Date.now() + 5000; Date.now() < deadline; ) {
        const progress = (await installer.inventory()).editions.find(
          (entry) => entry.editionId === editionId,
        ).progress;
        if (!progress.attempts[level.id]) {
          await delay(5);
          continue;
        }
        const current = await installer.restoreAttempt(editionId, level.id);
        if (current.snapshot.segments.at(-1)?.release) {
          assert.deepEqual(current.run, verified.run);
          return;
        }
        await delay(5);
      }
      assert.fail(
        'The installed journal must retain the same briefing release as the Hunt mirror.',
      );
    },
  );

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
