import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachMissionPicker } from '../ui/mission-picker.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'lazy-mission-list',
  revision: '1',
  title: 'Lazy mission list',
  classRecipes: CLASSES,
  levels: ['first-cut', 'second-cut'].map((id) => ({
    version: 'xonix-level.v1',
    id,
    revision: '1',
    name: id,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.2 },
  })),
};

function observeLists(t) {
  const writes = { missions: 0, 'pack-select': 0, 'level-select': 0 };
  const replace = SoloElement.prototype.replaceChildren;
  t.mock.method(SoloElement.prototype, 'replaceChildren', function (...children) {
    if (Object.hasOwn(writes, this.id)) writes[this.id]++;
    return replace.apply(this, children);
  });
  return writes;
}

async function win(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let frame = 0; frame < 40 && page.rendered.run.status !== 'won'; frame++) page.frame(250);
  assert.equal(page.rendered.run.status, 'won');
  page.$('skip-celebration').onclick();
  page.$('show-result').click();
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
}

function openRetainedPicker(page) {
  // Exercise the actual retained component after explicit pause; normal public
  // Missions uses its separate unified catalogue, not this old card owner.
  page.$('shell-menu').click();
  page.$('shell-home').close();
  page.$('shell-missions').showModal();
  attachMissionPicker({ document: page.doc }).focusSelectedChapter();
}

test('closed mission cards and selectors stay dormant across a legal win and accepted Next', async (t) => {
  const writes = observeLists(t);
  const page = await soloPage(t, { campaign });
  const before = { ...writes };
  assert.equal(page.$('shell-missions').open, false);
  await win(page);
  assert.deepEqual(writes, before, 'A hidden mission list must not rebuild on the accepted win.');
  const firstRun = page.rendered.run;
  const firstCheckpoint = authoritativeCheckpoint(firstRun);
  page.$('next-button').click();
  await settle(
    () =>
      page.doc.body.dataset.flightState === 'running' && page.rendered.run.levelId === 'second-cut',
  );
  assert.notEqual(page.rendered.run, firstRun);
  assert.deepEqual(authoritativeCheckpoint(firstRun), firstCheckpoint);
  assert.deepEqual(writes, before, 'Next must not build hidden cards or restart their thumbnails.');
  assert.equal(page.$('level-select').value, 'second-cut');
  assert.deepEqual(page.errors, []);
});

test('reopening retained Missions flushes current earned selection before its guarded Start control', async (t) => {
  const writes = observeLists(t);
  const page = await soloPage(t, { campaign });
  await win(page);
  page.$('next-button').click();
  await settle(
    () =>
      page.doc.body.dataset.flightState === 'running' && page.rendered.run.levelId === 'second-cut',
  );
  const run = page.rendered.run;
  openRetainedPicker(page);
  const buttons = [...page.$('missions').children].filter((node) => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].disabled, false);
  assert.notEqual(buttons[0].dataset.pictureState, 'concealed');
  assert.equal(buttons[1].classList.contains('selected'), true);
  assert.equal(buttons[1].disabled, false);
  const writesWhenOpen = { ...writes };
  page.$('shell-deploy').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.rendered.run, run);
  assert.equal(page.$('shell-missions').open, false);
  assert.deepEqual(writes, writesWhenOpen);
  assert.deepEqual(page.errors, []);
});
