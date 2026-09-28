import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLevelCardPresentation,
  createLevelCardView,
  levelCardPresentation,
} from '../ui/level-card.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('core and company hosts share one stable semantic card skeleton', () => {
  const document = new Document();
  const view = createLevelCardView({
    document,
    className: 'company-level-card',
    classes: { number: 'company-level-number', title: 'company-level-title' },
  });
  assert.equal(view.button.type, 'button');
  assert.match(view.button.className, /\blevel-card\b/);
  assert.match(view.number.className, /\blevel-card-number\b/);
  assert.match(view.number.className, /\bcompany-level-number\b/);
  assert.match(view.title.className, /\blevel-card-title\b/);
  assert.deepEqual(view.button.children, [
    view.campaignHeading,
    view.meta,
    view.title,
    view.campaign,
    view.progressGroup,
    view.status,
    view.preview,
    view.check,
  ]);
  assert.deepEqual(view.meta.children, [view.number, view.position]);
  assert.deepEqual(view.progressGroup.children, [view.progress, view.stars]);
});

test('shared core and company cards expose stable numbering and every progress state', () => {
  for (const [state, bestStars, stars] of [
    ['new', null, '☆☆☆'],
    ['skipped', null, '☆☆☆'],
    ['completed', null, '☆☆☆'],
    ['completed', 1, '★☆☆'],
    ['completed', 2, '★★☆'],
    ['completed', 3, '★★★'],
  ]) {
    const card = levelCardPresentation({
      globalLevelNumber: 42,
      campaignLevelNumber: 3,
      campaignLevelCount: 8,
      progressState: { state, bestStars },
    });
    assert.equal(card.globalLabel, '#42');
    assert.equal(card.campaignLabel, '3/8');
    assert.equal(card.completed, state === 'completed');
    assert.equal(card.stars, stars);
  }
});

test('custom cards stay outside official numbering and malformed card state fails closed', () => {
  assert.equal(
    levelCardPresentation({
      collection: 'Custom',
      campaignLevelNumber: 1,
      campaignLevelCount: 4,
    }).globalLabel,
    'Custom',
  );
  assert.throws(
    () =>
      levelCardPresentation({
        globalLevelNumber: 0,
        campaignLevelNumber: 1,
        campaignLevelCount: 1,
      }),
    /numbering is invalid/,
  );
  assert.throws(
    () =>
      levelCardPresentation({
        campaignLevelNumber: 1,
        campaignLevelCount: 1,
        progressState: { state: 'completed', bestStars: 4 },
      }),
    /progress is invalid/,
  );
});

test('shared state application updates persistent card nodes for every host', () => {
  const view = createLevelCardView({ document: new Document() });
  const presentation = levelCardPresentation({
    globalLevelNumber: 42,
    campaignLevelNumber: 3,
    campaignLevelCount: 8,
    progressState: { state: 'completed', bestStars: 2 },
  });
  assert.equal(applyLevelCardPresentation(view, presentation), view);
  assert.equal(view.button.dataset.completionState, 'completed');
  assert.equal(view.button.dataset.bestStars, '2');
  assert.equal(view.button.dataset.levelNumber, '42');
  assert.equal(view.stars.textContent, '★★☆');
});
