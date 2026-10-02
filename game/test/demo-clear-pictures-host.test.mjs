import assert from 'node:assert/strict';
import test from 'node:test';
import { readDemoSettings } from '../demo-experience.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';

const SETTINGS = 'revealline.demo.dev.v1';
const PREVIEW_NOTE = 'Picture preview · no progress or rewards are earned.';
const storedGameData = (storage) =>
  [...storage.map].filter(([key]) => !key.startsWith('revealline.demo.'));
const setChecked = (page, id, checked) => {
  const control = page.$(id);
  assert.ok(control, `The ${id} control is mounted.`);
  control.checked = checked;
  control.emit('change');
};
const assertClearPreview = (page) => {
  assert.equal(page.demoFrame.options.pictureVisibility, 'clear');
  assert.equal(page.demoFrame.options.pictureInterference, false);
  assert.equal(page.demoFrame.options.demoTransition, 0);
  assert.equal(page.$('demo-picture-note').textContent, PREVIEW_NOTE);
};

for (const [name, search] of [
  ['Standard', '?journey=legacy'],
  ['Journey', ''],
])
  test(`${name}: live clear-picture toggle previews unearned art without resetting playback, practice or progress`, async (t) => {
    const page = await demoPage(t, { search });
    const ordinary = page.rendered.run;
    const ordinaryBefore = authoritativeCheckpoint(ordinary);
    const before = storedGameData(page.storage);
    assert.equal(page.$('demo-show-all-pictures').checked, false);
    assert.equal(page.$('demo-show-all-pictures-live').checked, false);
    await page.open();
    assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
    for (let index = 0; index < 6; index++) page.frame(40);
    page.$('demo-watch-pause').click();
    page.frame(0);
    const playback = page.demoFrame.run;
    const playbackBefore = authoritativeCheckpoint(playback);
    const picture = page.demoFrame.options.backdrop;

    setChecked(page, 'demo-show-all-pictures-live', true);
    assertClearPreview(page);
    assert.equal(page.demoFrame.run, playback, 'The option repaints the same paused simulation.');
    assert.equal(page.demoFrame.options.backdrop, picture, 'Toggling does not reload the artwork.');
    assert.deepEqual(authoritativeCheckpoint(playback), playbackBefore);
    assert.equal(page.$('demo-watch-pause').getAttribute('aria-pressed'), 'true');
    assert.equal(page.$('demo-show-all-pictures').checked, true);
    assert.equal(page.$('demo-hide-pictures').checked, false);

    setChecked(page, 'demo-show-all-pictures-live', false);
    assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
    assert.notEqual(page.$('demo-picture-note').textContent, PREVIEW_NOTE);
    assert.equal(page.$('demo-show-all-pictures').checked, false);
    assert.deepEqual(authoritativeCheckpoint(playback), playbackBefore);

    setChecked(page, 'demo-show-all-pictures', true);
    assertClearPreview(page);
    assert.equal(page.$('demo-show-all-pictures-live').checked, true);
    setChecked(page, 'demo-hide-pictures', true);
    assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
    assert.equal(page.$('demo-show-all-pictures').checked, false);
    assert.equal(page.$('demo-show-all-pictures-live').checked, false);
    assert.equal(
      page.$('demo-picture-note').textContent,
      'Picture hidden by your demo privacy setting.',
    );

    setChecked(page, 'demo-show-all-pictures-live', true);
    assertClearPreview(page);
    assert.equal(page.$('demo-hide-pictures').checked, false);
    page.$('demo-takeover').click();
    await settle(() => !page.$('demo-practice-controls').hidden);
    page.frame(0);
    const practice = page.demoFrame.run;
    const practiceBefore = authoritativeCheckpoint(practice);
    assert.notEqual(practice, playback);
    assertClearPreview(page);
    setChecked(page, 'demo-show-all-pictures-live', false);
    assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
    setChecked(page, 'demo-show-all-pictures-live', true);
    assertClearPreview(page);
    assert.equal(page.demoFrame.run, practice);
    assert.deepEqual(authoritativeCheckpoint(practice), practiceBefore);
    assert.deepEqual(authoritativeCheckpoint(playback), playbackBefore);
    assert.deepEqual(authoritativeCheckpoint(ordinary), ordinaryBefore);
    assert.deepEqual(
      storedGameData(page.storage),
      before,
      'Only the demo preference may be written.',
    );
    page.$('demo-back').click();
    page.frame(0);
    assert.equal(page.rendered.run, ordinary);
    assert.deepEqual(authoritativeCheckpoint(ordinary), ordinaryBefore);
    assert.deepEqual(storedGameData(page.storage), before);
    assert.deepEqual(page.errors, []);
  });

test('the settings choice persists across a mounted app reload and privacy remains mutually exclusive', async (t) => {
  const storage = memoryStorage();
  await t.test('save from Settings', async (t) => {
    const page = await demoPage(t, { storage });
    setChecked(page, 'demo-hide-pictures', true);
    setChecked(page, 'demo-show-all-pictures', true);
    assert.equal(page.$('demo-hide-pictures').checked, false);
    assert.deepEqual(JSON.parse(storage.getItem(SETTINGS)), {
      version: 1,
      auto: true,
      collect: false,
      gameSounds: false,
      hidePictures: false,
      showAllPictures: true,
    });
  });
  await t.test('restore in the next app instance', async (t) => {
    const page = await demoPage(t, { storage });
    assert.equal(page.$('demo-show-all-pictures').checked, true);
    assert.equal(page.$('demo-show-all-pictures-live').checked, true);
    assert.equal(page.$('demo-hide-pictures').checked, false);
    await page.open();
    assertClearPreview(page);
    setChecked(page, 'demo-hide-pictures', true);
    assert.equal(page.$('demo-show-all-pictures-live').checked, false);
    assert.equal(readDemoSettings(storage, SETTINGS).showAllPictures, false);
  });
});
