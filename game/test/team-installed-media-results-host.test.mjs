import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { hrtime } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { generateCreatorTeamCampaign, prepareCreatorTeamCampaign } from '../creator/team.mjs';
import { prepareCreatorTeamMediaCampaign } from '../creator/team-media.mjs';
import {
  CREATOR_TEAM_DATABASE,
  createInstalledTeamCampaignStore,
} from '../creator/team-installed.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { page } from './helpers/coop-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { hostVictoryRoute, replayTeamCommands } from './helpers/coop-win.mjs';

const decodeImage = async () => ({ naturalWidth: 1152, naturalHeight: 576 });

async function mediaCampaign() {
  const made = generateCreatorTeamCampaign({
    id: 'team-result-media',
    name: 'Shared pictures',
    seed: 0,
  });
  const gameplay = await prepareCreatorTeamCampaign(made.pack, made.provenance);
  const compiled = JSON.parse(
    await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  const pictures = COOP_PICTURE_BINDINGS.slice(0, 2).map((row) => row.picture);
  const assets = await Promise.all(
    pictures.map(async (picture) => ({
      sha256: picture.sha256,
      blob: new Blob(
        [
          await readFile(
            new URL(`../presentation/compiled/${compiled.urls[picture.sha256]}`, import.meta.url),
          ),
        ],
        { type: 'image/png' },
      ),
    })),
  );
  const prepared = await prepareCreatorTeamMediaCampaign(
    gameplay,
    gameplay.pack.levels.map((level, index) => ({
      levelId: level.id,
      pictureSha256: pictures[index].sha256,
    })),
    assets,
    {
      decodeImage,
      credits: {
        creator: 'Host acceptance fixture',
        media: 'Repository-owned approved pictures',
        license: 'Repository test fixture only',
      },
    },
  );
  return { prepared, pictures };
}

function environment(memory, local) {
  const databases = new Map([[CREATOR_TEAM_DATABASE, memory.indexedDB]]);
  return ({ install }) => {
    install('crypto', { value: webcrypto });
    install('indexedDB', {
      value: {
        open(name, ...args) {
          if (!databases.has(name)) databases.set(name, managedIndexedDB().indexedDB);
          return databases.get(name).open(name, ...args);
        },
      },
    });
    install('localStorage', { value: local });
  };
}

async function selectInstalled(f, editionId, levelId, { resume = false } = {}) {
  await openMissionLibrary(f, 'coop-discovery-open');
  const card = [...f.$('journey-cards').children].find((item) => {
    const [source, edition, , mission] = JSON.parse(item.dataset.missionId);
    return source === `team-installed:${editionId}` && edition === editionId && mission === levelId;
  });
  assert(card, 'The exact installed mission is listed.');
  if (resume) assert.match(card.textContent, /Resume saved attempt/);
  await activateMissionCard(card);
  assert.equal(f.$('coop-level').value, levelId);
}

function winInstalled(f, level, routeKind) {
  const reference = hostVictoryRoute(routeKind, level);
  assert.equal(reference.run.status, 'won', JSON.stringify(reference.stages));
  assert(reference.log.every((commands) => commands.every((command) => !command.boost)));
  assert(!reference.events.some((event) => event.type === 'player.downed'));
  for (const seat of [0, 1])
    assert(reference.events.some((event) => event.type === 'cut.closed' && event.player === seat));
  replayTeamCommands(f, reference.log);
  assert.equal(
    f.$('coop-overlay-kicker').textContent,
    'A WORLD YOU REVEALED TOGETHER',
    f.$('coop-message').textContent,
  );
  assert.equal(f.$('coop-overlay').hidden, false);
  return reference;
}

test('installed Team media: legal host wins retain exact rewards, Next and fresh-host progress', async (t) => {
  const memory = managedIndexedDB();
  const values = new Map();
  const local = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const { prepared, pictures } = await mediaCampaign();
  const store = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB, decodeImage });
  t.after(() => store.close());
  const { editionId } = await store.install(prepared);
  const [first, second] = prepared.pack.levels;
  const beforeImport = environment(memory, local);
  const progress = async () =>
    (await store.inventory()).editions.find((row) => row.editionId === editionId).progress;
  const waitProgress = async (predicate, diagnostic) => {
    const deadline = hrtime.bigint() + 5_000_000_000n;
    while (!predicate(await progress())) {
      assert(hrtime.bigint() < deadline, diagnostic());
      await delay(5);
    }
  };

  await t.test('first win and deliberate Next', async (t) => {
    const f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      capturePaint: true,
      beforeImport,
    });
    await selectInstalled(f, editionId, first.id);
    winInstalled(f, first, 'first-connection');
    await waitProgress(
      (saved) => Boolean(saved.clears[first.id]),
      () => f.$('coop-message').textContent,
    );
    assert.equal((await progress()).clears[first.id].reward.sha256, pictures[0].sha256);
    f.$('coop-view-picture').focus();
    f.tap('Enter');
    assert.equal(f.$('coop-earned-picture').open, true);
    assert.equal(f.earnedDrawImages.at(-1)[0].sha256, pictures[0].sha256);
    f.$('coop-picture-return').click();
    assert.equal(f.$('coop-next').hidden, false);
    f.$('coop-next').focus();
    f.tap('Enter');
    await waitFor(
      () => f.$('coop-level').value === second.id && f.$('coop-overlay').hidden,
      () => f.$('coop-next-status').textContent,
    );
    f.tick(2);
    assert(f.drawImages.some((image) => image.sha256 === pictures[1].sha256));
    assert.equal(
      (await progress()).clears[second.id],
      undefined,
      'Starting Next never awards its picture.',
    );
    f.$('coop-pause').click();
    await waitProgress(
      (saved) => Boolean(saved.attempts[second.id]),
      () => f.$('coop-message').textContent,
    );
  });

  await t.test('fresh host restores second mission and earns only its own reward', async (t) => {
    const f = await page(t, {
      nativeFocus: true,
      nativeVisibility: true,
      capturePaint: true,
      beforeImport,
    });
    const pending = await store.restoreAttempt(editionId, second.id);
    await selectInstalled(f, editionId, second.id, { resume: true });
    assert.equal(
      (await store.restoreAttempt(editionId, second.id)).snapshot.attemptId,
      pending.snapshot.attemptId,
      'The fresh host resumes the saved attempt rather than replacing it.',
    );
    assert.equal(f.$('coop-overlay').hidden, true);
    winInstalled(f, second, 'relay-yard');
    await waitProgress(
      (saved) => Boolean(saved.clears[second.id]),
      () => f.$('coop-message').textContent,
    );
    const saved = await progress();
    assert.equal(saved.clears[first.id].reward.sha256, pictures[0].sha256);
    assert.equal(saved.clears[second.id].reward.sha256, pictures[1].sha256);
    assert.equal(saved.attempts[second.id], undefined);
    assert.equal(f.$('coop-next').hidden, true, 'The final mission has no invented successor.');
    f.$('coop-view-picture').focus();
    f.tap('Enter');
    assert.equal(f.earnedDrawImages.at(-1)[0].sha256, pictures[1].sha256);
    assert.deepEqual(f.visits, []);
  });
  t.diagnostic(
    'Actual installed store, replay and keyboard host; finite DOM, IndexedDB and image decoding do not certify a native browser win.',
  );
});
