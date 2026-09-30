import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCurriculumMissionExplorations } from '../company-campaigns/curriculum-mission-explorations.mjs';
import { validateCompletionReward, completionRewardAssetReferences } from '../rewards/model.mjs';
import {
  validateExplorationPayload,
  createExplorationState,
  applyExplorationAction,
} from '../rewards/exploration.mjs';
import { mountDiscoveryExploration } from '../ui/discovery-exploration.mjs';
import { Document } from './helpers/couch-dom.mjs';
const root = new URL('../../', import.meta.url);
const assets = JSON.parse(await readFile(new URL('game/editions/assets.json', root), 'utf8'));
const missionId = 'fpv-meet-aircraft-01';
const payload = () => createCurriculumMissionExplorations(missionId, assets)[0];
const settle = async () => {
  for (let count = 0; count < 12; count++) await Promise.resolve();
};

test('Frame pilot binds the inspected original and three separated structural regions without changing existing requirements', async () => {
  const value = validateExplorationPayload(payload()),
    image = value.recipe.diagram.asset;
  const asset = assets.find((item) => item.id === image.assetId);
  const bytes = await readFile(new URL(asset.path, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256);
  assert.equal(bytes.length, asset.bytes);
  assert.equal(value.recipe.id, 'inspect-image-atlas');
  assert.deepEqual(
    value.recipe.diagram.hotspots.map((item) => item.cardId),
    ['centre', 'arm', 'motor-position'],
  );
  // At a 240px-wide uncropped rendering of this 960×640 artwork, the three
  // marker centres remain more than a 44px button apart. Native layout is a
  // separate observation; this proves only the authored spatial separation.
  const points = value.recipe.diagram.hotspots;
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      assert(Math.hypot((points[a].x - points[b].x) * 240, (points[a].y - points[b].y) * 160) > 44);
  assert.deepEqual(createCurriculumMissionExplorations('fpv-meet-aircraft-02', assets), []);
  const changed = structuredClone(assets);
  changed.find((item) => item.id === image.assetId).sha256 = '0'.repeat(64);
  assert.throws(() => createCurriculumMissionExplorations(missionId, changed), /exact reviewed/);
  const rejected = structuredClone(assets);
  rejected.find((item) => item.id === image.assetId).approved = false;
  assert.throws(() => createCurriculumMissionExplorations(missionId, rejected), /exact reviewed/);
  const rewards = JSON.parse(
    await readFile(
      new URL('game/content/company-campaigns/fpv-meet-aircraft.rewards.json', root),
      'utf8',
    ),
  );
  const original = rewards.find(
    (item) => item.scope.kind === 'mission' && item.scope.id === missionId,
  );
  const candidate = structuredClone(original);
  candidate.payloads = [...candidate.payloads.filter((item) => item.id !== value.id), value];
  const checked = validateCompletionReward(candidate);
  assert.deepEqual(checked.requirements, original.requirements);
  assert(
    completionRewardAssetReferences([checked]).some(
      (ref) => ref.assetId === image.assetId && ref.sha256 === image.sha256,
    ),
  );
});

test('Frame predictions remain optional and bilingual source scope does not claim product documentation', () => {
  const value = payload(),
    recipe = value.recipe;
  for (const locale of ['en', 'uk']) {
    assert(value.locales[locale].intro.length > 60);
    assert(recipe.diagram.locales[locale].alt.length > 60);
    for (const card of recipe.cards) {
      assert(card.locales[locale].body.length > 60);
      assert(card.locales[locale].sourceNote.length > 60);
      assert(card.sourceIds.every((id) => recipe.sources.some((source) => source.id === id)));
    }
  }
  assert.match(recipe.diagram.locales.en.caption, /Fictional civilian/);
  assert.match(recipe.cards[2].locales.en.body, /do not establish/);
  assert(
    recipe.sources.some(
      (source) => source.url === 'https://betaflight.com/docs/wiki/getting-started',
    ),
  );
  assert(
    recipe.sources.some(
      (source) =>
        source.url === 'https://www.nasa.gov/stem-content/the-science-behind-quadcopters/',
    ),
  );
  const initial = createExplorationState(recipe);
  const wrong = applyExplorationAction(recipe, initial, {
    type: 'predict',
    predictionId: 'support-or-command',
    choiceId: 'controller',
  });
  const corrected = applyExplorationAction(recipe, wrong, {
    type: 'predict',
    predictionId: 'support-or-command',
    choiceId: 'support',
  });
  assert.equal(wrong.answers['support-or-command'], 'controller');
  assert.equal(corrected.answers['support-or-command'], 'support');
  assert.equal(Object.hasOwn(corrected, 'completed'), false);
  assert.deepEqual(
    createExplorationState(recipe),
    initial,
    'Reopening resets only ephemeral exploration choices.',
  );
});

test('the authored Frame image and equivalent Ukrainian labels share keyboard selection and release media', async () => {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  let loaded = 0,
    released = 0;
  const view = mountDiscoveryExploration({
    container,
    payload: payload(),
    locale: 'uk',
    loadImage: async (image, target) => {
      loaded++;
      assert.deepEqual(image.asset, payload().recipe.diagram.asset);
      const img = doc.createElement('img');
      img.complete = true;
      img.naturalWidth = 960;
      img.naturalHeight = 640;
      img.alt = image.locales.uk.alt;
      target.append(img);
      return () => released++;
    },
  });
  await settle();
  assert.equal(loaded, 1);
  const centre = container.querySelector('[data-diagram-card="centre"]'),
    arm = container.querySelector('[data-diagram-card="arm"]');
  assert.match(centre.getAttribute('aria-label'), /Центральні пластини/);
  centre.focus();
  centre.emit('keydown', { key: 'ArrowRight' });
  assert.equal(doc.activeElement, arm);
  arm.emit('click');
  assert.equal(
    container.querySelector('[data-card-id="arm"]').getAttribute('aria-pressed'),
    'true',
  );
  const last = container.querySelector('[data-card-id="motor-position"]');
  last.focus();
  last.emit('keydown', { key: 'Home' });
  assert.equal(doc.activeElement, container.querySelector('[data-card-id="centre"]'));
  assert.equal(container.querySelectorAll('[data-card-id]').length, 3);
  view.dispose();
  assert.equal(released, 1);
  assert.equal(container.children.length, 0);
});

test('the textile pilot uses the exact museum object and separates observation from documented attribution', async () => {
  const value = createCurriculumMissionExplorations('ukraine-threads-01', assets)[0];
  const recipe = validateExplorationPayload(value).recipe;
  const image = recipe.diagram.asset;
  const asset = assets.find((item) => item.id === image.assetId);
  const bytes = await readFile(new URL(asset.path, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256);
  assert.equal(bytes.length, 177615);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'The pinned original is a JPEG.');
  assert.deepEqual(
    recipe.diagram.hotspots.map((point) => point.cardId),
    ['flower', 'border', 'fold'],
  );
  const points = recipe.diagram.hotspots;
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      assert(Math.hypot((points[a].x - points[b].x) * 240, (points[a].y - points[b].y) * 122) > 44);
  assert.match(recipe.diagram.locales.en.caption, /Photograph of a real collection object/);
  assert.match(recipe.diagram.locales.en.caption, /2009\.300\.2715/);
  assert.match(recipe.diagram.locales.uk.caption, /2009\.300\.2715/);
  assert.match(recipe.diagram.locales.en.caption, /Brooklyn Museum/);
  assert.match(recipe.cards[0].locales.en.body, /does not give this shape one universal meaning/);
  assert.match(recipe.cards[1].locales.en.sourceNote, /photograph alone/);
  assert.match(recipe.cards[2].locales.en.body, /not every surface or a complete garment/);
  assert(
    recipe.sources.some(
      (source) => source.url === 'https://www.metmuseum.org/art/collection/search/157573',
    ),
  );
  for (const locale of ['en', 'uk']) {
    assert(value.locales[locale].intro.length > 60);
    for (const card of recipe.cards) {
      assert(card.locales[locale].body.length > 60);
      assert(card.locales[locale].sourceNote.length > 60);
      assert(card.sourceIds.every((id) => recipe.sources.some((source) => source.id === id)));
    }
  }
  const changed = structuredClone(assets);
  changed.find((item) => item.id === image.assetId).sha256 = '0'.repeat(64);
  assert.throws(
    () => createCurriculumMissionExplorations('ukraine-threads-01', changed),
    /exact reviewed/,
  );
  const unpublished = structuredClone(assets);
  unpublished.find((item) => item.id === image.assetId).publication = 'internal';
  assert.throws(
    () => createCurriculumMissionExplorations('ukraine-threads-01', unpublished),
    /exact reviewed/,
  );
  const initial = createExplorationState(recipe);
  const observed = applyExplorationAction(recipe, initial, {
    type: 'predict',
    predictionId: 'observation-or-record',
    choiceId: 'image-only',
  });
  const corrected = applyExplorationAction(recipe, observed, {
    type: 'predict',
    predictionId: 'observation-or-record',
    choiceId: 'record',
  });
  assert.equal(corrected.answers['observation-or-record'], 'record');
  assert.equal(Object.hasOwn(corrected, 'completed'), false);
  assert.deepEqual(createExplorationState(recipe), initial);
});

test('the actual textile photograph keeps equivalent Ukrainian controls and visible museum credit', async () => {
  const doc = new Document(),
    container = doc.createElement('section');
  const value = createCurriculumMissionExplorations('ukraine-threads-01', assets)[0];
  doc.body.append(container);
  let released = 0;
  const view = mountDiscoveryExploration({
    container,
    payload: value,
    locale: 'uk',
    loadImage: async (image, target) => {
      assert.deepEqual(image.asset, value.recipe.diagram.asset);
      const img = doc.createElement('img');
      img.complete = true;
      img.naturalWidth = 1200;
      img.naturalHeight = 610;
      img.alt = image.locales.uk.alt;
      target.append(img);
      return () => released++;
    },
  });
  await settle();
  assert.match(container.textContent, /2009\.300\.2715/);
  const flower = container.querySelector('[data-diagram-card="flower"]');
  const border = container.querySelector('[data-diagram-card="border"]');
  flower.focus();
  flower.emit('keydown', { key: 'ArrowRight' });
  assert.equal(doc.activeElement, border);
  border.emit('click');
  assert.equal(
    container.querySelector('[data-card-id="border"]').getAttribute('aria-pressed'),
    'true',
  );
  assert.match(border.getAttribute('aria-label'), /Нижня облямівка/);
  assert.equal(container.querySelectorAll('[data-card-id]').length, 3);
  view.dispose();
  assert.equal(released, 1);
  assert.equal(container.children.length, 0);
});
