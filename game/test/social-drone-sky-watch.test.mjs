import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { RasterImage } from './helpers/raster-image.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { openMissionLibrary, activateMissionCard } from './helpers/library-selection.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { dataIdentity } from '../data-json.mjs';
import { reconcileEarnedRewards } from '../rewards/model.mjs';
import { rewardMediaReferences, inspectRewardMediaBytes } from '../rewards/media-format.mjs';
import { createEarnedVideo } from '../ui/earned-video.mjs';
import { Document } from './helpers/couch-dom.mjs';

const root = new URL('../../', import.meta.url);
const SKY_WATCH_ROUTE = [
  { direction: 'right', reached: (run) => run.player.x >= 51.4 },
  { direction: 'down', reached: (run) => run.player.y >= 34.9 && !run.player.cutting },
  { direction: 'left', reached: (run) => run.player.x <= 46.6 },
  { direction: 'up', reached: (run) => run.player.y <= 1.1 && !run.player.cutting },
  { direction: 'left', reached: (run) => run.player.x <= 24.6 },
  { direction: 'down', reached: (run) => run.player.y >= 34.9 && !run.player.cutting },
  { direction: 'up', reached: (run) => run.player.y <= 1.1 && !run.player.cutting },
  { direction: 'right', reached: (run) => run.player.x >= 68.4 },
  { direction: 'down', reached: (run) => run.player.y >= 34.9 && !run.player.cutting },
];
const fetcher = async (value) => {
  const path = new URL(value, 'https://example.test/').pathname
    .replace(/^\/revealline\//, '')
    .replace(/^\//, '');
  try {
    return new Response(await readFile(new URL(path, root)));
  } catch (error) {
    if (error.code === 'ENOENT') return new Response('', { status: 404 });
    throw error;
  }
};
async function provider() {
  return loadRuntimeContentProvider({
    locationRef: { href: 'https://example.test/revealline/game/communities/social-drone-ua/' },
    documentRef: { documentElement: { dataset: {} } },
    fetcher,
  });
}

test('public Social Drone includes an independently playable Sky Watch mission and mobile-prepared media', async () => {
  const p = await provider();
  assert.equal(p.editionId, 'social-drone-ua');
  assert(p.selection.edition.campaignIds.includes('social-drone-sky-watch'));
  const source = p.route.source;
  const mission = source.missions.find((m) => m.id === 'social-drone-sky-watch-01');
  assert(mission);
  const campaign = source.campaigns.find((c) => c.id === 'social-drone-sky-watch');
  assert.deepEqual(campaign.missionIds, [mission.id]);
  const reward = p.rewards.find((r) => r.scope.id === mission.id);
  assert.deepEqual(
    reward.requirements.missions.map((m) => m.missionId),
    [mission.id],
  );
  const video = reward.payloads.find((p) => p.type === 'video');
  assert.equal(
    video.asset.sha256,
    '919fa23b4427b313e19e88784599455feaad022afc128dc93024acdeb988cc21',
  );
  assert.equal(mission.actors.length, 3);
  assert.equal(mission.map.revision, '2');
  for (const { reference, role } of rewardMediaReferences(video)) {
    const asset = p.catalog.assets.find((a) => a.id === reference.assetId);
    const bytes = await readFile(new URL(asset.path, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), reference.sha256);
    inspectRewardMediaBytes(asset, role, bytes);
    if (role === 'video') {
      const source = Buffer.from(bytes);
      assert(source.indexOf('moov') < source.indexOf('mdat'), 'MP4 is prepared for iPhone start');
    }
  }
  assert(
    p.selection.edition.presentationHistory.some((h) => h.path.endsWith('before-sky-watch.json')),
  );
});

test('an actual watch-corridor win verifies as a replay and earns the video without previous campaign clears', async () => {
  const p = await provider();
  const project = compileContentProject(p.route.source);
  const { level: authoredLevel } = resolveMission(project, 'social-drone-sky-watch-01', {
    mode: 'solo',
    difficulty: 'standard',
  });
  const level = applyGameplayTuning(authoredLevel, resolveGameplayTuning('standard'));
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const segment of SKY_WATCH_ROUTE) {
    for (let i = 0; i < 2500 && run.status === 'running' && !segment.reached(run); i++) {
      recordInput(recorder, { direction: segment.direction });
      stepRun(run, { direction: segment.direction }, FIXED_DT);
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.lives, 3);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const context = {
    editionId: p.editionId,
    brandId: 'social-drone-ua',
    campaignIds: p.selection.edition.campaignIds,
    clears: {
      [level.id]: {
        runId: 'legal-sky-watch-win',
        gameplayId: dataIdentity({
          ruleset: run.ruleset,
          level: run.level,
          classes: run.classRecipes,
        }),
        difficulty: 'standard',
      },
    },
    learning: [],
    mastery: [],
  };
  const update = reconcileEarnedRewards(p.rewards, context);
  assert.equal(update.granted.length, 1);
  assert.equal(update.granted[0].definition.scope.id, level.id);
  assert(update.granted[0].definition.payloads.some((p) => p.type === 'video'));
});

test('earned video requires a won run and its earned receipt, presents once, and disposes on close', () => {
  const document = new Document();
  let started = 0,
    disposed = 0,
    startOptions,
    options;
  const presentation = createEarnedVideo({
    document,
    window: {},
    getReducedMotion: () => true,
    mountMedia(value) {
      options = value;
      return {
        start(value) {
          startOptions = value;
          started++;
        },
        dispose() {
          disposed++;
        },
      };
    },
  });
  const run = { status: 'running', levelId: 'sky-watch' };
  const receipts = [
    {
      definition: {
        scope: { kind: 'mission', id: 'sky-watch' },
        payloads: [{ type: 'video', locales: { en: { title: 'Sky Watch' } } }],
      },
    },
  ];
  assert.equal(presentation.present(run, receipts), false);
  run.status = 'won';
  assert.equal(presentation.present(run, []), false);
  assert.equal(presentation.present(run, receipts), true);
  assert.equal(started, 1);
  assert.deepEqual(startOptions, { allowMutedFallback: true });
  assert.equal(options.cinematic, true);
  assert.equal(options.reducedMotion, true);
  assert.equal(presentation.present(run, receipts), false);
  options.onEnded();
  assert.equal(disposed, 1);
  assert.equal(document.querySelector('dialog'), null);
  presentation.dispose();
  assert.equal(disposed, 1);
  assert.equal(document.querySelector('dialog'), null);
});

test('normal community mission library launches Sky Watch and holds the finished board before opening its earned video', async (t) => {
  const page = await soloPage(t, {
    search: '?edition=social-drone-ua',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: RasterImage },
    fetchResponse: async (value) => {
      const request = new URL(String(value), 'http://localhost/game/');
      const pathname =
        request.protocol === 'file:'
          ? request.pathname.slice(root.pathname.length)
          : request.pathname.slice(1);
      if (!/^game\/(?:editions\/|content\/company-)/.test(pathname)) return undefined;
      return new Response(await readFile(new URL(pathname, root)));
    },
  });
  await openMissionLibrary(page, 'shell-play');
  const card = [...page.$('journey-cards').children].find((row) =>
    row.textContent.includes('Sky Watch'),
  );
  assert(card, 'Public mission menu contains Sky Watch');
  await activateMissionCard(card);
  await settle(() => {
    page.frame(0);
    return (
      page.rendered.run.levelId === 'social-drone-sky-watch-01' &&
      page.doc.body.dataset.flightState === 'running'
    );
  });
  const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  for (const segment of SKY_WATCH_ROUTE) {
    page.key(keys[segment.direction]);
    for (
      let i = 0;
      i < 650 && page.rendered.run.status === 'running' && !segment.reached(page.rendered.run);
      i++
    )
      page.frame(FIXED_DT * 1000 * 4);
    page.key(keys[segment.direction], false);
    assert(
      page.rendered.run.status !== 'running' || segment.reached(page.rendered.run),
      `Sky Watch route reached its ${segment.direction} waypoint`,
    );
  }
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(page.doc.querySelector('.earned-video-dialog'), null);
  for (let i = 0; i < 18; i++) page.frame(100);
  assert.equal(
    page.doc.querySelector('.earned-video-dialog'),
    null,
    'Completed board remains visible during the initial hold',
  );
  for (let i = 0; i < 60; i++) page.frame(100);
  const dialog = page.doc.querySelector('.earned-video-dialog');
  assert(dialog?.open, 'Public earned video opens after the celebration');
  for (let i = 0; i < 50; i++) page.frame(100);
  assert.equal(
    page.$('game-overlay').hidden,
    true,
    'Automatic continuation waits while the earned video is open',
  );
  dialog.querySelector('button').click();
  assert.equal(page.doc.querySelector('.earned-video-dialog'), null);
  for (let i = 0; i < 15 && page.$('game-overlay').hidden; i++) page.frame(100);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('result-random-level').hidden, false);
  assert.deepEqual(page.errors, []);
});
