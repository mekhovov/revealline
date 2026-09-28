import { pngBytes as teaserBytes } from './helpers/media-fixtures.mjs';
import { rewardAudioFixture } from './helpers/reward-audio-fixture.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mountEditionRewards } from '../ui/edition-rewards.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { rewardContext } from '../rewards/context.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { projectRewardProgress } from '../rewards/model.mjs';
import { createRewardBackend } from '../rewards/store.mjs';
import { emptyJourneyProfile, applyJourneyEvent } from '../journey/profile.mjs';
import { resolveEditionSelection } from '../editions/model.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createExplorationExample } from '../studio/exploration-example.mjs';

const copy = (value) => structuredClone(value);
const locales = (value) => ({ en: copy(value), uk: copy(value) });
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
    'base64',
  ),
);

async function fixture(
  t,
  {
    storage = managedIndexedDB(),
    image = false,
    teaser = false,
    reducedMotion = false,
    durable = true,
    exploration = false,
    audio = false,
    playlist = false,
    learning = false,
    getLearningEvidence,
    mastery = false,
    getMasteryEvidence,
  } = {},
) {
  const base = await editionProviderFixture();
  const source = copy(base.source);
  source.missions = Array.from({ length: 6 }, (_, index) => ({
    ...copy(source.missions[0]),
    id: `mission-${index + 1}`,
  }));
  source.campaigns[0].missionIds = source.missions.map((mission) => mission.id);
  const bindings = createRewardMissionBindings(source);
  const catalog = copy(base.catalog);
  if (image) {
    catalog.assets.push({
      id: 'reward-picture',
      path: 'game/content/sample/reward.png',
      sha256: createHash('sha256').update(png).digest('hex'),
      bytes: png.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    });
    catalog.campaigns[0].assetIds.push('reward-picture');
  }
  const audioFiles = new Map();
  const audioRef = (id, extension, bytes) => {
    const asset = {
      id,
      path: `game/content/sample/${id}.${extension}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    };
    catalog.assets.push(asset);
    catalog.campaigns[0].assetIds.push(id);
    audioFiles.set(`http://localhost/${asset.path}`, bytes);
    return { assetId: id, sha256: asset.sha256 };
  };
  const audioPayload =
    audio || playlist
      ? {
          id: 'recording',
          type: 'audio',
          locales: locales({ title: 'Owned diagnostic' }),
          asset: audioRef('recording', 'wav', rewardAudioFixture()),
          transcript: Object.fromEntries(
            ['en', 'uk'].map((locale) => [
              locale,
              audioRef(
                `transcript-${locale}`,
                'txt',
                new TextEncoder().encode('An exact diagnostic transcript.'),
              ),
            ]),
          ),
        }
      : null;
  const teaserImage = teaser
    ? {
        asset: audioRef('separate-preview', 'png', teaserBytes()),
        locales: locales({ alt: 'A closed preview exhibit' }),
      }
    : null;
  const selection = resolveEditionSelection(catalog);
  const lesson = learning
    ? {
        ...copy(COMPANY_LESSONS[0]),
        missionId: source.missions[0].id,
        campaignId: source.campaigns[0].id,
      }
    : null;
  const missionReward = (mission) => ({
    format: 'revealline-completion-reward.v1',
    id: `${mission.missionId}-discovery`,
    revision: 'r1',
    brandId: selection.brand.id,
    campaignId: source.campaigns[0].id,
    scope: { kind: 'mission', id: mission.missionId },
    locales: locales({ title: `${mission.missionId} discovery`, teaser: 'A promised insight.' }),
    requirements: {
      missions: [{ missionId: mission.missionId, bindings: copy(mission.bindings) }],
      learning: [],
      mastery: [],
    },
    payloads: [
      {
        id: 'knowledge',
        type: 'knowledge',
        locales: locales({
          title: 'A useful discovery',
          paragraphs: ['Knowledge earned through the accepted mission win.'],
        }),
      },
    ],
  });
  const rewards = bindings.map(missionReward);
  if (teaserImage) rewards[0].teaserImage = teaserImage;
  if (exploration) rewards[0].payloads.push(createExplorationExample());
  if (audio || playlist) rewards[0].payloads.push(audioPayload);
  if (playlist) {
    rewards[0].payloads.push({
      ...copy(audioPayload),
      id: 'second-recording',
      locales: locales({ title: 'Second recording' }),
    });
    rewards[0].audioGroups = [
      {
        format: 'revealline-ordered-audio-group.v1',
        id: 'listening-room',
        locales: locales({ title: 'Listening room' }),
        payloadIds: ['second-recording', 'recording'],
      },
    ];
  }
  rewards[0].payloads.push({
    id: 'resource',
    type: 'url',
    url: 'https://example.org/earned-resource',
    locales: locales({ title: 'Further reading' }),
  });
  if (image)
    rewards[0].payloads.push({
      id: 'picture',
      type: 'image',
      asset: { assetId: catalog.assets[0].id, sha256: catalog.assets[0].sha256 },
      locales: locales({ title: 'Original picture', alt: 'The exact earned illustration' }),
    });
  rewards.push({
    ...copy(rewards[0]),
    id: 'campaign-finale',
    scope: { kind: 'campaign', id: source.campaigns[0].id },
    locales: locales({
      title: 'The completed workshop',
      teaser: 'Six discoveries assemble the atlas.',
    }),
    requirements: {
      missions: bindings.map(({ missionId, bindings: allowed }) => ({
        missionId,
        bindings: copy(allowed),
      })),
      learning: [],
      mastery: [],
    },
    payloads: [
      {
        id: 'finale',
        type: 'knowledge',
        locales: locales({
          title: 'Complete atlas',
          paragraphs: ['The final synthesis of all six missions.'],
        }),
      },
    ],
  });
  delete rewards.at(-1).teaserImage;
  delete rewards.at(-1).audioGroups;
  const provider = {
    editionId: selection.edition.id,
    selection,
    route: { source },
    rewards,
    lessons: lesson ? [lesson] : [],
    catalog,
    bootstrap: { catalog, selection },
    rootURL: 'http://localhost/',
  };
  if (lesson) rewards[0].requirements.learning = [completionLearningReference(lesson)];
  if (mastery)
    rewards[0].requirements.mastery = [
      { id: 'journey-no-loss-win', revision: '1', missionId: bindings[0].missionId },
    ];
  const doc = new Document();
  const overlay = doc.createElement('section');
  overlay.id = 'game-overlay';
  overlay.dataset.kind = 'ready';
  const reading = doc.createElement('div');
  reading.id = 'overlay-reading';
  const card = doc.createElement('div');
  card.id = 'overlay-reading-unit';
  card.className = 'overlay-card';
  const resultActions = doc.createElement('div');
  resultActions.className = 'overlay-actions';
  const nextAction = doc.createElement('button');
  nextAction.id = 'next-button';
  resultActions.append(nextAction);
  card.append(reading, resultActions);
  overlay.append(card);
  const collection = doc.createElement('dialog');
  collection.id = 'collection-dialog';
  const settings = doc.createElement('section');
  settings.id = 'settings-panel-data';
  doc.body.append(overlay, collection, settings);
  const created = [],
    revoked = [],
    externalClicks = [],
    requests = [];
  const audioElements = [];
  let audioLeases = 0;
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  t.after(() => master.dispose());
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'audio') {
      Object.assign(element, {
        paused: true,
        duration: 1,
        playCalls: 0,
        load() {
          if (this.src) queueMicrotask(() => this.emit('loadedmetadata'));
        },
        play() {
          this.playCalls++;
          this.paused = false;
          this.emit('play');
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
          this.emit('pause');
        },
      });
      audioElements.push(element);
    }
    if (tag === 'a')
      element.addEventListener('click', () => {
        if (element.href?.startsWith('https://')) externalClicks.push(element.href);
      });
    return element;
  };
  let profile = emptyJourneyProfile(),
    run = { levelId: 'mission-1', status: 'ready' },
    pauses = 0;
  const win = Object.assign(new Events(), {
    indexedDB: storage?.indexedDB ?? null,
    URL: {
      createObjectURL(blob) {
        const url = `blob:reward-${created.length}`;
        created.push({ url, blob });
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    setTimeout(callback) {
      queueMicrotask(callback);
      return 1;
    },
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(audioFiles.get(String(url)) ?? png);
  });
  const view = await mountEditionRewards({
    provider,
    document: doc,
    window: win,
    writer: { writable: true },
    pause: () => {
      pauses++;
    },
    getRun: () => run,
    getJourneyProfile: () => profile,
    getJourneyRevision: () => profile.generation,
    getJourneyDurable: () => durable,
    getLearningEvidence,
    getMasteryEvidence,
    getReducedMotion: () => reducedMotion,
    audioMaster: master,
    musicDucker: {
      acquire(factor) {
        assert.equal(factor, 0);
        audioLeases++;
        return () => {
          audioLeases--;
        };
      },
    },
  });
  t.after(() => view.dispose());
  const backend = storage
    ? createRewardBackend({ editionId: provider.editionId, indexedDB: storage.indexedDB })
    : null;
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
    view.refresh();
  };
  function accepted(
    index,
    { runId = `accepted-${index}`, difficulty = 'standard', mode = 'solo', gameplayId } = {},
  ) {
    const mission = bindings[index - 1];
    profile = applyJourneyEvent(profile, {
      type: 'complete',
      mode,
      missionId: mission.journeyMissionIds[0],
      runId,
      difficulty,
      gameplayId:
        gameplayId ??
        mission.bindings.find((binding) => binding.difficulty === difficulty).gameplayId,
    });
    return profile;
  }
  return {
    provider,
    bindings,
    doc,
    view,
    overlay,
    collection,
    settings,
    created,
    revoked,
    externalClicks,
    requests,
    audioElements,
    master,
    get audioLeases() {
      return audioLeases;
    },
    backend,
    settle,
    accepted,
    get profile() {
      return profile;
    },
    get pauses() {
      return pauses;
    },
    setRun(value) {
      run = value;
    },
    skip(index) {
      profile = applyJourneyEvent(profile, {
        type: 'skip',
        mode: 'solo',
        missionId: bindings[index - 1].journeyMissionIds[0],
      });
    },
    setDurable(value) {
      durable = value;
    },
    get cards() {
      return doc.getElementById('completion-reward-shelf').querySelectorAll('article');
    },
    async exportState() {
      settings.querySelector('button').click();
      return JSON.parse(await created.at(-1).blob.text());
    },
  };
}

test('learning-only evidence changes refresh rewards without changing arcade progress or persisting an unsaved proof', async (t) => {
  let evidence = { revision: 0, learning: [], durableLearning: [] };
  const f = await fixture(t, { learning: true, getLearningEvidence: () => evidence });
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  assert.equal(f.view.snapshot().state.receipts.length, 0);
  const verified = {
    ...completionLearningReference(f.provider.lessons[0]),
    attemptId: 'verified-lesson',
  };
  evidence = {
    revision: 1,
    learning: [{ ...verified, fixtureRevision: 'wrong' }],
    durableLearning: [],
  };
  f.view.refresh();
  assert.equal(f.view.snapshot().state.receipts.length, 0);
  evidence = { revision: 2, learning: [verified], durableLearning: [] };
  f.view.refresh();
  await f.settle();
  assert.equal(f.view.snapshot().state.receipts.length, 1);
  assert.equal((await f.backend.read()).receipts.length, 0);
  f.accepted(2);
  f.view.refresh();
  await f.settle();
  assert.equal((await f.backend.read()).receipts.length, 1);
  const profile = JSON.stringify(f.profile);
  evidence = { revision: 3, learning: [verified], durableLearning: [verified] };
  f.view.refresh();
  await f.settle();
  assert.equal((await f.backend.read()).receipts.length, 2);
  assert.equal(JSON.stringify(f.profile), profile);
});

test('verified mastery changes grant once while session evidence cannot persist through an unrelated win', async (t) => {
  let evidence = { revision: 0, mastery: [], durableMastery: [] };
  const f = await fixture(t, { mastery: true, getMasteryEvidence: () => evidence });
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  assert.equal(f.view.snapshot().state.receipts.length, 0);
  const verified = { ...f.provider.rewards[0].requirements.mastery[0], runId: 'accepted-1' };
  evidence = {
    revision: 1,
    mastery: [{ ...verified, runId: 'different-attempt' }],
    durableMastery: [],
  };
  f.view.refresh();
  assert.equal(f.view.snapshot().state.receipts.length, 0);
  evidence = { revision: 2, mastery: [verified], durableMastery: [] };
  f.view.refresh();
  await f.settle();
  assert.equal(f.view.snapshot().state.receipts.length, 1);
  assert.equal((await f.backend.read()).receipts.length, 0);
  f.accepted(2);
  f.view.refresh();
  await f.settle();
  assert.equal((await f.backend.read()).receipts.length, 1);
  const profile = JSON.stringify(f.profile);
  evidence = { revision: 3, mastery: [verified], durableMastery: [verified] };
  f.view.refresh();
  await f.settle();
  const receipts = (await f.backend.read()).receipts;
  assert.equal(receipts.length, 2);
  assert.deepEqual(
    receipts.find((item) => item.definition.id === f.provider.rewards[0].id).evidence.mastery,
    [verified],
  );
  assert.equal(JSON.stringify(f.profile), profile);
});

test('accepted Journey IDs map to authoring IDs; skips and other modes are excluded, with revision eligibility checked by the model', async (t) => {
  const f = await fixture(t);
  f.skip(1);
  f.accepted(2, { mode: 'team' });
  f.accepted(3, { gameplayId: 'not-the-selected-gameplay' });
  f.accepted(4);
  const context = rewardContext(f.provider, f.bindings, f.profile);
  assert.deepEqual(Object.keys(context.clears), ['mission-3', 'mission-4']);
  assert.equal(projectRewardProgress(f.provider.rewards[2], context).eligible, false);
  assert.equal(projectRewardProgress(f.provider.rewards[3], context).eligible, true);
  assert.equal(context.clears['mission-4'].runId, 'accepted-4');
  assert(!Object.keys(context.clears).some((id) => id.includes('candidate')));
  assert.deepEqual(context.learning, []);
  assert.deepEqual(context.mastery, []);
});

test('winning practice or skipping a mission cannot grant; accepted progress grants once and exports exact receipts', async (t) => {
  const f = await fixture(t);
  f.setRun({ levelId: 'mission-1', status: 'running' });
  f.view.refresh();
  f.setRun({ levelId: 'mission-1', status: 'won' });
  f.overlay.dataset.kind = 'won';
  f.view.refresh();
  f.skip(1);
  f.view.refresh();
  await f.settle();
  assert.equal((await f.exportState()).receipts.length, 0);
  assert.equal(f.cards[0].dataset.earned, 'false');
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  assert.equal(f.cards[0].dataset.earned, 'true');
  const first = await f.exportState();
  assert.equal(first.receipts.length, 1);
  assert.equal(first.receipts[0].evidence.clears['mission-1'].runId, 'accepted-1');
  f.accepted(1, { runId: 'repeat-run' });
  f.view.refresh();
  await f.settle();
  const repeated = await f.exportState();
  assert.equal(repeated.receipts.length, 1);
  assert.deepEqual(repeated.receipts[0], first.receipts[0]);
});

test('the final mission alone and five distinct wins keep the six-mission finale locked', async (t) => {
  const f = await fixture(t);
  f.accepted(6);
  f.view.refresh();
  await f.settle();
  assert.equal(f.cards.at(-1).dataset.earned, 'false');
  for (let index = 2; index <= 5; index++) f.accepted(index);
  f.view.refresh();
  await f.settle();
  const locked = f.cards.at(-1);
  assert.equal(locked.dataset.earned, 'false');
  assert.equal(locked.querySelectorAll('button').length, 0);
  assert(!locked.textContent.includes('The final synthesis'));
  const five = await f.exportState();
  assert.equal(five.receipts.length, 5);
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  assert.equal(f.cards.at(-1).dataset.earned, 'true');
  assert.equal((await f.exportState()).receipts.length, 7);
});

test('resource URLs stay hidden while locked and opening a reward pauses without following external links', async (t) => {
  const f = await fixture(t);
  assert.equal(f.doc.querySelectorAll('a').length, 0);
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  assert.deepEqual(f.externalClicks, []);
  f.collection.showModal();
  const open = f.cards[0].querySelector('button');
  open.focus();
  open.click();
  const dialog = f.doc.getElementById('completion-reward-dialog');
  assert.equal(dialog.open, true);
  assert.equal(f.pauses, 1);
  assert.deepEqual(f.externalClicks, []);
  const link = dialog.querySelector('a');
  assert.equal(link.href, 'https://example.org/earned-resource');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  link.click();
  assert.deepEqual(f.externalClicks, ['https://example.org/earned-resource']);
  dialog.close();
  assert.equal(f.doc.activeElement, open);
});

test('exact earned images verify on demand and release object URLs on close/disposal', async (t) => {
  const f = await fixture(t, { image: true });
  assert.equal(f.requests.length, 0);
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  assert.equal(f.requests.length, 0);
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  const dialog = f.doc.getElementById('completion-reward-dialog');
  await waitFor(() => !!dialog.querySelector('img'));
  const image = dialog.querySelector('img');
  assert.equal(image.alt, 'The exact earned illustration');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].options.redirect, 'error');
  dialog.close();
  assert(f.revoked.includes(image.src));
  f.cards[0].querySelector('button').click();
  await waitFor(() => !!dialog.querySelector('img'));
  const second = dialog.querySelector('img').src;
  f.view.dispose();
  assert(f.revoked.includes(second));
  assert.equal(f.doc.getElementById('completion-reward-dialog'), null);
});

test('missing pinned media never substitutes newer artwork or revokes the earned discovery', async (t) => {
  const f = await fixture(t, { image: true });
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  const earned = await f.exportState();
  f.provider.catalog.assets[0].sha256 = 'b'.repeat(64);
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  await f.settle();
  const dialog = f.doc.getElementById('completion-reward-dialog');
  assert.equal(dialog.querySelector('img'), null);
  assert.equal(f.requests.length, 0);
  assert(dialog.textContent.includes('Knowledge earned'));
  assert.deepEqual((await f.exportState()).receipts, earned.receipts);
});

test('unavailable storage keeps earned discoveries available with a session-only status', async (t) => {
  const f = await fixture(t, { storage: null, durable: false, reducedMotion: true });
  f.accepted(1);
  f.overlay.dataset.kind = 'won';
  f.setRun({ levelId: 'mission-1', status: 'won' });
  f.view.refresh();
  await f.settle();
  assert.equal(f.cards[0].dataset.earned, 'true');
  const status = f.doc.getElementById('completion-reward-save-status');
  assert.equal(status.dataset.durable, 'false');
  const result = f.doc.getElementById('completion-reward-result');
  assert.equal(result.dataset.reducedMotion, 'true');
  assert.equal(result.classList.contains('completion-reward-arrive'), false);
  assert.equal(
    f.doc
      .getElementById('earned-result-more')
      .querySelector('.completion-reward-save-note')
      .getAttribute('role'),
    'status',
  );
  assert.equal(
    f.doc
      .getElementById('completion-reward-shelf')
      .querySelector('.completion-reward-save-note')
      .getAttribute('aria-live'),
    'polite',
  );
  assert.equal((await f.exportState()).receipts.length, 1);
});

test('a first accepted win keeps its cosmetic flourish through persistence and exposes exploration immediately', async (t) => {
  const f = await fixture(t);
  const run = { levelId: 'mission-1', status: 'running' };
  f.setRun(run);
  f.view.refresh();
  f.accepted(1);
  run.status = 'won';
  f.overlay.dataset.kind = 'won';
  f.view.refresh();
  const result = f.doc.getElementById('completion-reward-result');
  assert.equal(result.classList.contains('completion-reward-arrive'), true);
  assert.equal(result.querySelector('button').disabled, false);
  await f.settle();
  assert.equal(result.classList.contains('completion-reward-arrive'), true);
  f.setRun({ levelId: 'mission-1', status: 'won' });
  f.accepted(1, { runId: 'repeat-clear' });
  f.view.refresh();
  assert.equal(result.classList.contains('completion-reward-arrive'), false);
  assert.equal(result.querySelector('button').disabled, false);
});

test('closing a viewer cancels pending media without publishing a late object URL', async (t) => {
  const f = await fixture(t, { image: true });
  let complete;
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  const dialog = f.doc.getElementById('completion-reward-dialog');
  await f.settle();
  assert.equal(typeof complete, 'function');
  dialog.close();
  complete(new Response(png));
  await f.settle();
  assert.equal(dialog.querySelector('img'), null);
  assert.equal(f.created.length, 0);
});

test('an earned discovery exports exact offline pictures without opening resources or changing progress', async (t) => {
  const f = await fixture(t, { image: true });
  assert.equal(f.doc.getElementById('completion-reward-printable'), null);
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  const before = await f.exportState();
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  await f.doc.getElementById('completion-reward-printable').onclick();
  const file = f.created.findLast((item) => item.blob.type.startsWith('text/html'));
  assert(file);
  const html = await file.blob.text();
  assert(html.includes('src="data:image/png;base64,'));
  assert(html.includes('Knowledge earned'));
  assert.deepEqual(f.externalClicks, []);
  assert.deepEqual((await f.exportState()).receipts, before.receipts);
  f.doc.getElementById('completion-reward-dialog').close();
  assert(f.revoked.includes(file.url));
});

test('optional atlas mounts only after earning and cannot change accepted progress', async (t) => {
  const f = await fixture(t, { exploration: true });
  assert.equal(f.doc.querySelector('.discovery-exploration'), null);
  assert.equal(f.requests.length, 0);
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  const before = await f.exportState();
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  const atlas = f.doc.querySelector('.discovery-exploration');
  assert(atlas);
  const cards = atlas.querySelector('nav').querySelectorAll('button');
  assert.equal(cards.length, 2);
  cards[1].click();
  assert.equal(atlas.querySelector('.discovery-compare').querySelectorAll('article').length, 2);
  const choices = atlas.querySelector('fieldset').querySelectorAll('button');
  choices[0].click();
  assert(atlas.querySelector('.discovery-feedback').textContent.length > 0);
  assert.deepEqual((await f.exportState()).receipts, before.receipts);
  f.doc.getElementById('completion-reward-dialog').close();
  assert.equal(f.doc.querySelector('.discovery-exploration'), null);
});

test('native media is absent while locked; earned viewer uses shared sound ownership and close leaves progress unchanged', async (t) => {
  const f = await fixture(t, { audio: true });
  assert.equal(f.doc.querySelector('[data-reward-media]'), null);
  assert.equal(f.requests.length, 0);
  f.accepted(1);
  f.view.refresh();
  await waitFor(() => f.cards[0].dataset.earned === 'true');
  const before = await f.exportState();
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  assert(f.doc.querySelector('[data-reward-media="audio"]'));
  await waitFor(() =>
    f.doc
      .getElementById('completion-reward-dialog')
      .querySelector('details')
      ?.textContent.includes('An exact diagnostic transcript.'),
  );
  assert.equal(f.audioElements.length, 0);
  assert(!f.requests.some(({ url }) => url.endsWith('.wav')));
  f.doc.querySelector('[data-reward-media-action="play"]').click();
  await waitFor(() => f.audioElements[0]?.playCalls === 1);
  assert.equal(f.audioElements[0].volume, 0.4);
  assert.equal(f.audioLeases, 1);
  f.master.setMuted(true);
  assert.equal(f.audioElements[0].muted, true);
  const rewardDialog = f.doc.getElementById('completion-reward-dialog'),
    back = [...rewardDialog.children].find((node) => node.tagName === 'BUTTON');
  assert.equal(back.textContent, 'Back to game');
  back.click();
  assert.equal(rewardDialog.open, false);
  assert.equal(f.audioLeases, 0);
  assert.equal(f.audioElements[0].paused, true);
  assert.equal(f.doc.querySelector('[data-reward-media]'), null);
  assert.deepEqual((await f.exportState()).receipts, before.receipts);
});

test('campaign exhibit never requests a locked image and releases exact earned thumbnails on close', async (t) => {
  const f = await fixture(t, { image: true });
  f.collection.showModal();
  const pictures = () => f.doc.getElementById('completion-reward-exhibit-pictures');
  pictures().click();
  await f.settle();
  assert.equal(f.requests.length, 0);
  assert.equal(pictures().getAttribute('aria-pressed'), 'true');
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  await waitFor(() =>
    f.doc.querySelector('.completion-reward-exhibit-picture')?.querySelector('img'),
  );
  const image =
    f.doc.querySelector('.completion-reward-exhibit-picture')?.querySelector('img') ?? null;
  assert.equal(image.alt, 'The exact earned illustration');
  assert.equal(f.requests.length, 1);
  assert.equal(f.doc.activeElement, pictures());
  f.collection.close();
  assert.equal(pictures().getAttribute('aria-pressed'), 'false');
  assert.equal(
    f.doc.querySelector('.completion-reward-exhibit-picture')?.querySelector('img') ?? null,
    null,
  );
  assert.deepEqual(f.created.map((entry) => entry.url).sort(), [...f.revoked].sort());
});

test('twenty exhibit picture cycles keep accepted progress and release all owned URLs', async (t) => {
  const f = await fixture(t, { image: true });
  f.accepted(1);
  f.view.refresh();
  await f.settle();
  const generation = f.profile.generation;
  const receipts = JSON.stringify(f.view.snapshot().state.receipts);
  for (let index = 0; index < 20; index++) {
    f.doc.getElementById('completion-reward-exhibit-pictures').click();
    await waitFor(() =>
      f.doc.querySelector('.completion-reward-exhibit-picture')?.querySelector('img'),
    );
    f.doc.getElementById('completion-reward-exhibit-pictures').click();
    assert.equal(
      f.doc.querySelector('.completion-reward-exhibit-picture')?.querySelector('img') ?? null,
      null,
    );
  }
  assert.equal(f.profile.generation, generation);
  assert.equal(JSON.stringify(f.view.snapshot().state.receipts), receipts);
  assert.equal(f.created.length, 20);
  assert.equal(new Set(f.revoked).size, 20);
  assert.deepEqual(f.created.map((entry) => entry.url).sort(), [...f.revoked].sort());
});

test('the earned viewer persists the historic qualified attempt only when its exact proof is durable', async (t) => {
  let evidence = {
    revision: 0,
    mastery: [],
    durableMastery: [],
    historicalClears: [],
    durableHistoricalClears: [],
  };
  const f = await fixture(t, { mastery: true, getMasteryEvidence: () => evidence });
  f.accepted(1);
  const historic = {
    missionId: 'mission-1',
    ...f.profile.clears.solo[f.bindings[0].journeyMissionIds[0]],
  };
  const verified = { ...f.provider.rewards[0].requirements.mastery[0], runId: historic.runId };
  f.accepted(1, { runId: 'later-loss-win', difficulty: 'gentle' });
  f.view.refresh();
  await f.settle();
  assert.equal(f.view.snapshot().state.receipts.length, 0);
  evidence = { ...evidence, revision: 1, mastery: [verified], historicalClears: [historic] };
  f.view.refresh();
  await f.settle();
  assert.equal(
    f.view.snapshot().state.receipts[0].evidence.clears['mission-1'].runId,
    historic.runId,
  );
  assert.equal((await f.backend.read()).receipts.length, 0);
  f.accepted(2);
  f.view.refresh();
  await f.settle();
  assert.equal(
    (await f.backend.read()).receipts.some(
      (receipt) => receipt.definition.id === f.provider.rewards[0].id,
    ),
    false,
  );
  evidence = {
    ...evidence,
    revision: 2,
    durableMastery: [verified],
    durableHistoricalClears: [historic],
  };
  f.view.refresh();
  await f.settle();
  const receipt = (await f.backend.read()).receipts.find(
    (item) => item.definition.id === f.provider.rewards[0].id,
  );
  assert.equal(receipt.evidence.clears['mission-1'].runId, historic.runId);
  assert.deepEqual(receipt.evidence.mastery, [verified]);
});

test('locked ready and Collection previews request separate art only after explicit actions', async (t) => {
  const f = await fixture(t, { image: true, teaser: true, reducedMotion: true });
  await f.settle();
  assert.equal(f.requests.length, 0);
  const state = JSON.stringify(f.view.snapshot().state);
  f.doc.getElementById('completion-reward-preview-teaser').click();
  await waitFor(() => f.doc.getElementById('completion-reward-result').querySelector('img'));
  assert.equal(f.requests.length, 1);
  assert(f.requests[0].url.endsWith('separate-preview.png'));
  assert.equal(
    f.doc.getElementById('completion-reward-result').querySelector('img').alt,
    'A closed preview exhibit',
  );
  f.overlay.dataset.kind = 'playing';
  f.setRun({ levelId: 'mission-1', status: 'playing' });
  f.view.refresh();
  assert.deepEqual(
    f.revoked,
    f.created.map((item) => item.url),
  );
  f.collection.showModal();
  f.doc.getElementById('completion-reward-exhibit-pictures').click();
  await waitFor(() => f.doc.getElementById('completion-reward-shelf').querySelector('img'));
  assert.equal(f.requests.length, 2);
  assert(f.requests.every((item) => item.url.endsWith('separate-preview.png')));
  assert.equal(JSON.stringify(f.view.snapshot().state), state);
  assert.equal(f.externalClicks.length, 0);
  f.collection.close();
  await f.settle();
  assert.deepEqual(
    f.revoked,
    f.created.map((item) => item.url),
  );
});

test('unavailable teaser never substitutes an earned picture and pending ready previews cancel on play', async (t) => {
  const f = await fixture(t, { image: true, teaser: true });
  await f.settle();
  const teaser = f.provider.catalog.assets.find((item) => item.id === 'separate-preview');
  teaser.sha256 = 'f'.repeat(64);
  f.doc.getElementById('completion-reward-preview-teaser').click();
  await f.settle();
  assert.equal(f.requests.length, 0);
  assert.equal(f.created.length, 0);
  assert.equal(f.doc.getElementById('completion-reward-result').querySelector('img'), null);
  assert.equal(f.view.snapshot().state.receipts.length, 0);
});

test('leaving the ready card during a delayed teaser download prevents late images', async (t) => {
  const f = await fixture(t, { image: true, teaser: true });
  await f.settle();
  let finish;
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  f.doc.getElementById('completion-reward-preview-teaser').click();
  await waitFor(() => finish);
  f.overlay.dataset.kind = 'playing';
  f.setRun({ levelId: 'mission-1', status: 'playing' });
  f.view.refresh();
  finish(new Response(teaserBytes()));
  await f.settle();
  assert.equal(f.created.length, 0);
  assert.equal(f.doc.getElementById('completion-reward-result').querySelector('img'), null);
});

test('earned playlist stays locked until its accepted win and switching never changes receipts or autoplays', async (t) => {
  const f = await fixture(t, { playlist: true });
  assert.equal(f.doc.querySelector('[data-reward-audio-group]'), null);
  assert.equal(f.requests.length, 0);
  f.accepted(1);
  f.view.refresh();
  await waitFor(() => f.cards[0].dataset.earned === 'true');
  const before = await f.exportState();
  f.collection.showModal();
  f.cards[0].querySelector('button').click();
  const group = f.doc.querySelector('[data-reward-audio-group]');
  assert(group);
  assert.deepEqual(
    group
      .querySelectorAll('[data-playlist-track]')
      .map((n) => n.getAttribute('data-playlist-track')),
    ['second-recording', 'recording'],
  );
  assert.equal(f.doc.querySelectorAll('[data-reward-media]').length, 1);
  await waitFor(() =>
    group.querySelector('details')?.textContent.includes('An exact diagnostic transcript.'),
  );
  assert.equal(f.audioElements.length, 0);
  group.querySelector('[data-reward-media-action="play"]').click();
  await waitFor(() => f.audioElements[0]?.playCalls === 1);
  group.querySelector('[data-playlist-action="next"]').click();
  assert.equal(f.audioLeases, 0);
  assert.equal(f.audioElements[0].paused, true);
  assert.equal(f.audioElements.length, 1);
  f.doc.getElementById('completion-reward-dialog').close();
  assert.equal(f.doc.querySelector('[data-reward-audio-group]'), null);
  assert.deepEqual((await f.exportState()).receipts, before.receipts);
});

test('earned result discovery actions leave the scroll pane while long details remain readable and Next stays enabled', async (t) => {
  const f = await fixture(t),
    card = f.doc.getElementById('overlay-reading-unit'),
    reading = f.doc.getElementById('overlay-reading'),
    next = f.doc.getElementById('next-button');
  const longDetails = f.doc.createElement('p');
  longDetails.textContent = 'Long result recap. '.repeat(100);
  reading.append(longDetails);
  const result = f.doc.getElementById('completion-reward-result');
  assert.equal(
    result.parentElement,
    reading,
    'Ready reward promises use ordinary untimed reading.',
  );
  f.accepted(1);
  f.overlay.dataset.kind = 'won';
  f.setRun({ levelId: 'mission-1', status: 'won' });
  f.view.refresh();
  assert.equal(result.parentElement, card);
  assert.equal(result.dataset.placement, 'summary');
  assert.equal(reading.contains(result.querySelector('[data-reward-surface="result"]')), false);
  assert.equal(f.doc.getElementById('completion-reward-result-details').parentElement, reading);
  assert.equal(next.disabled, false);
  await f.settle();
  assert.equal(
    result.parentElement,
    card,
    'Persistence refresh cannot put the action back below prose.',
  );
  f.overlay.dataset.kind = 'ready';
  f.setRun({ levelId: 'mission-1', status: 'ready' });
  f.view.refresh();
  assert.equal(result.parentElement, reading);
  assert.equal(next.disabled, false);
  f.view.dispose();
  assert.equal(f.doc.getElementById('completion-reward-result-details'), null);
});

test('a queued discovery save shows neutral pending feedback and never claims tab-only failure before settlement', async (t) => {
  const f = await fixture(t);
  f.accepted(1);
  f.overlay.dataset.kind = 'won';
  f.setRun({ levelId: 'mission-1', status: 'won' });
  f.view.refresh();
  const status = f.doc.getElementById('completion-reward-save-status'),
    result = f.doc.getElementById('completion-reward-result');
  assert.equal(status.dataset.pending, 'true');
  assert.equal(status.dataset.durable, 'false');
  assert.equal(result.querySelector('.completion-reward-session-status').dataset.pending, 'true');
  assert.equal(
    f.doc.getElementById('earned-result-more').querySelector('.completion-reward-save-note'),
    null,
  );
  assert.equal(f.doc.getElementById('next-button').disabled, false);
  await f.settle();
  assert.equal(status.dataset.pending, 'false');
  assert.equal(status.dataset.durable, 'true');
  assert.equal(result.querySelector('.completion-reward-session-status'), null);
});
