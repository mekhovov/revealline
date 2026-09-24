import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const route = createAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
const project = compileContentProject(route.source);
const manifest = resolveMission(project, 'first-return');
async function activate(button) {
  const handler = button.onclick;
  let operation;
  button.onclick = (...args) => (operation = handler.apply(button, args));
  try {
    button.focus();
    button.click();
  } finally {
    button.onclick = handler;
  }
  if (operation instanceof Promise) await operation;
}
async function setup(
  t,
  { disk = managedIndexedDB(), storage = memoryStorage(), refuse = () => false } = {},
) {
  const page = await soloPage(t, {
    search: '',
    titleScreen: true,
    storage,
    journeyIndexedDB: disk.indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return refuse()
          ? new Response('unavailable', { status: 503 })
          : new Response(await readFile(path));
    },
  });
  const drawn = [];
  const context = { drawImage: (...args) => drawn.push(args) };
  const create = page.doc.createElement.bind(page.doc);
  page.doc.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'canvas') element.getContext = () => context;
    return element;
  };
  page.$('journey-picture-viewer').querySelector('canvas').getContext = () => context;
  return {
    page,
    disk,
    storage,
    drawn,
    backend: createJourneyBackend({ ...disk, profileKey: route.profileKey }),
  };
}
async function win(page) {
  await activate(page.$('shell-featured'));
  await settle(() => {
    page.frame(0);
    return (
      page.rendered.run.levelId === 'first-return' &&
      page.doc.body.dataset.flightState === 'running'
    );
  });
  assert.deepEqual(
    page.rendered.run.level,
    applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
  );
  assert.deepEqual(page.rendered.backdrop.assetRevision, manifest.background);
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const expectedLevel = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard'));
  const reference = createRun(expectedLevel, options),
    recorder = createRecorder(expectedLevel, options);
  page.key('ArrowDown');
  for (let tick = 0; tick < 469; tick++) {
    assert.equal(reference.status, 'running');
    recordInput(recorder, { direction: 'down' });
    stepRun(reference, { direction: 'down' }, FIXED_DT);
    page.frame(FIXED_DT * 1000);
    assert.equal(reference.lives, 3);
  }
  page.key('ArrowDown', false);
  assert.equal(reference.status, 'won');
  assert.equal(reference.tick, 469);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(reference));
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
}

test(
  'a real Solo Journey win earns exact artwork, Collection and completed card; view and Retry never award another original',
  { timeout: 120000 },
  async (t) => {
    let refuse = false;
    const { page: p, backend, drawn } = await setup(t, { refuse: () => refuse });
    await win(p);
    for (let reads = 0; reads < 20 && !(await backend.readState()).pictures.records.length; reads++)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await backend.readState()).pictures.records.length, 1);
    const accepted = p.rendered.backdrop.assetRevision;
    const earned = (await backend.readState()).pictures.records[0];
    assert.deepEqual(earned.asset, accepted);
    assert.equal(earned.editionId, DEFAULT_JOURNEY_ROUTES.solo);
    assert.equal(earned.mode, 'solo');
    assert.equal(earned.missionId, 'candidate/journey-opening/prologue/first-return');
    const result = authoritativeCheckpoint(p.rendered.run);
    await activate(p.$('collection-button'));
    assert.equal(p.$('collection-dialog').open, true);
    const card = p.$('journey-picture-grid').children[0];
    assert.equal(card.dataset.missionId, earned.missionId);
    assert.match(card.textContent, /First return.*View earned original/);
    const view = card.querySelector('button');
    refuse = true;
    await activate(view);
    assert.match(p.$('journey-picture-status').textContent, /Original unavailable/);
    assert.equal(p.$('journey-picture-retry').hidden, false);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), result);
    refuse = false;
    await activate(p.$('journey-picture-retry'));
    assert.equal(p.$('journey-picture-status').textContent, 'Earned original');
    assert.equal(drawn.at(-1)[0].width, accepted.width);
    assert.equal(drawn.at(-1)[0].height, accepted.height);
    p.$('journey-picture-back').click();
    assert.equal(p.doc.activeElement, view);
    p.$('collection-back').click();
    await openMissionLibrary(p, 'shell-packs');
    const mission = [...p.$('journey-cards').children].find(
      (button) => JSON.parse(button.dataset.missionId)[3] === earned.missionId,
    );
    assert.equal(mission.dataset.pictureState, 'earned');
    await settle(
      () =>
        mission.querySelector('.journey-card-picture-status')?.textContent === 'Earned original',
    );
    assert(mission.querySelector('canvas'));
    p.$('journey-back').click();
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), result);
    assert.deepEqual((await backend.readState()).pictures.records, [earned]);
    await activate(p.$('retry-button'));
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    assert.equal(p.rendered.run.tick, 0);
    assert.deepEqual(p.rendered.backdrop.assetRevision, accepted);
    assert.deepEqual((await backend.readState()).pictures.records, [earned]);
    assert.deepEqual(p.errors, []);
  },
);
