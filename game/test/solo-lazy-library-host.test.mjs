import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
test('Main Solo leaves Library unconstructed through Start, then public Workshop opens the same paused run', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  assert.equal(
    page.$('prepare-backup-set') === null,
    true,
    'Unopened Library must not construct its backup presenter',
  );
  assert.equal(page.$('builtin-packs').children.length, 0);
  await page.$('shell-featured').onclick();
  await settle(() => {
    page.frame(0);
    return !page.rendered.paused;
  });
  for (let i = 0; i < 16; i++) page.frame(16);
  assert.equal(
    page.$('prepare-backup-set') === null,
    true,
    'Unopened Library must not construct its backup presenter',
  );
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  page.$('overlay-menu').click();
  page.$('shell-options').click();
  page.$('settings-tab-extras').click();
  page.$('shell-workshop').click();
  const button = page.$('shell-library');
  assert.equal(button.closest('[hidden]'), null);
  button.click();
  assert.equal(page.$('library-dialog').open, true);
  await settle(() => page.$('prepare-backup-set') && page.$('library-dialog-entry-status').hidden);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('library-scores').hidden, false);
  const originalBackup = page.$('prepare-backup-set');
  page.doc.querySelector('[data-library-panel="saves"]').click();
  await settle(() => !page.$('library-saves').hidden);
  assert.equal(
    page.$('prepare-backup-set'),
    originalBackup,
    'Repeated public opens reuse the original presenter',
  );
  page.$('library-dialog').close();
  page.frame(0);
  assert.deepEqual(page.errors, []);
});
test('public Collection owns its modal while lazy gallery preparation preserves run and storage', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    storage = [...page.storage.map];
  page.$('shell-options').click();
  page.$('settings-tab-data').click();
  page.$('shell-gallery').click();
  assert.equal(page.$('collection-dialog').open, true);
  assert.equal(page.$('library-dialog').open, false);
  await settle(
    () =>
      page.$('prepare-backup-set') &&
      (!page.$('collection-dialog-entry-status') ||
        page.$('collection-dialog-entry-status').hidden),
  );
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual([...page.storage.map], storage);
  assert.deepEqual(page.errors, []);
});
