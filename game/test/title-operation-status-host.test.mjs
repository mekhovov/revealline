import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';

async function basePage(t, options = {}) {
  const classRecipes = JSON.parse(
    await readFile(new URL('../content/classes.json', import.meta.url), 'utf8'),
  );
  // A small legal base campaign keeps this menu lifecycle test independent of
  // image-heavy optional packs. The real host, completion and save paths run.
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'title-operation-status',
    revision: '1',
    title: 'Title status',
    classRecipes,
    levels: [
      {
        version: 'xonix-level.v1',
        id: 'base-return',
        revision: '1',
        name: 'Base return',
        width: 48,
        height: 36,
        spawn: { x: 24.5, y: 0.5 },
        walls: [],
        enemies: [],
        objectives: [],
        supplies: [],
        goal: { coverage: 0.5 },
      },
    ],
  };
  return soloPage(t, { campaign, titleScreen: true, ...options });
}

async function selectBase(page) {
  page.$('shell-play').click();
  page.change('pack-select', '');
  await settle(() => !page.$('pack-select').disabled, 'Base selection must finish');
  assert.equal(
    page.$('content-select-status').textContent,
    'Base game · Base return selected and ready.',
  );
  assert.equal(page.$('shell-featured-status').hidden, false);
  page.$('shell-briefing').click();
  await settle(() => page.doc.body.dataset.pictureState === 'ready');
}

test('completed Base flight does not retain its old selection message beside featured Deploy', async (t) => {
  const page = await basePage(t);
  await selectBase(page);
  page.$('start-button').click();
  page.key('ArrowDown');
  for (let i = 0; i < 1000 && page.rendered.run.status === 'running'; i++) page.frame();
  page.key('ArrowDown', false);
  assert.equal(page.rendered.run.status, 'won', 'The real flight must complete before returning');
  assert.ok(page.rendered.run.coverage >= 0.5);
  page.$('show-result').click();
  page.$('shell-menu').click();
  assert.equal(page.$('shell-continue').hidden, true);
  assert.equal(page.$('shell-featured').hidden, false);
  assert.equal(page.$('shell-destination').textContent, 'Deploy · Pressure Lines / Arcade');
  assert.equal(page.$('shell-featured-status').hidden, true);
  assert.equal(
    page.$('content-select-status').textContent,
    'Base game · Base return selected and ready.',
  );
  assert.equal(
    page.$('pack-select').value,
    '',
    'Opening the title does not change the selected chapter',
  );
  page.$('shell-gallery').click();
  page.$('collection-back').click();
  assert.equal(page.$('shell-home').open, true);
  assert.equal(page.$('shell-featured-status').hidden, true);
  assert.equal(page.rendered.run.status, 'won');
  assert.deepEqual(page.errors, []);
});

test('a paused Base flight keeps its actual Continue destination', async (t) => {
  const page = await basePage(t);
  await selectBase(page);
  page.$('start-button').click();
  page.key('ArrowDown');
  for (let i = 0; i < 20; i++) page.frame();
  page.key('ArrowDown', false);
  page.$('shell-menu').click();
  assert.equal(page.rendered.run.status, 'running');
  assert.equal(page.$('shell-continue').hidden, false);
  assert.equal(page.$('shell-featured').hidden, true);
  assert.match(page.$('shell-destination').textContent, /^Continue · .*Base return/);
  assert.equal(page.$('shell-featured-status').hidden, true);
  assert.equal(page.$('pack-select').value, '');
  assert.deepEqual(page.errors, []);
});

test('failed featured selection remains visible after leaving and reopening the title', async (t) => {
  let attempted = false;
  const page = await basePage(t, {
    fetchJSON(path) {
      if (path === 'content/packs/fpv-arcade-r5.json') {
        attempted = true;
        throw new Error('Featured chapter unavailable in this test');
      }
    },
  });
  page.$('shell-featured').click();
  await settle(() => !page.$('shell-featured').disabled, 'Featured failure must settle');
  assert.equal(attempted, true, 'Deploy still requests its actual Pressure Lines pack');
  const status = page.$('shell-featured-status');
  assert.equal(status.dataset.kind, 'error');
  assert.equal(
    status.textContent,
    'The download for FPV Front · Pressure Lines could not be read. Reload the game while online, then choose this chapter again. Your current flight and installed chapters are kept.',
  );
  assert.equal(status.hidden, false);
  const message = status.textContent;
  page.$('shell-play').click();
  page.$('shell-missions-back').click();
  assert.equal(page.$('shell-home').open, true);
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, message);
  assert.equal(page.$('content-select-status').textContent, message);
  assert.equal(page.$('pack-select').value, '');
  assert.deepEqual(page.errors, []);
});
