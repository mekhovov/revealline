import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { readMissionLibraryHandoff, readMissionLibraryReady } from '../mission-library/handoff.mjs';

test('an accessible demo on an idle Legacy host prepares the same level without automatic Start', async (t) => {
  const page = await demoPage(t);
  const levelId = page.rendered.run.levelId;
  await page.open();
  page.$('demo-interrupt').click();
  page.$('demo-fresh').click();
  await waitFor(() => !page.$('demo-dialog').open, {
    timeoutMs: 30000,
    message: 'Fresh must finish exact mission preparation on the Legacy owner.',
  });
  page.frame(0);
  assert.equal(page.$('mission-replace-dialog').open, false);
  assert.equal(page.rendered.run.levelId, levelId);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('game-overlay').dataset.kind, 'ready');
  for (let index = 0; index < 12; index++) page.frame(16);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), null);
  assert.deepEqual(page.errors, []);
});

test('default Journey demo Fresh transfers exact Legacy mission ownership and arrives at Ready', async (t) => {
  let destination;
  await t.test(
    'the Journey host requests its verified destination without adopting a Legacy run',
    async (pageTest) => {
      const page = await demoPage(pageTest, { search: '' });
      const ordinary = page.rendered.run,
        checkpoint = authoritativeCheckpoint(ordinary),
        initialHref = page.win.location.href;
      await page.open();
      assert.equal(page.demoFrame.run.levelId, 'signal-01');
      page.$('demo-interrupt').click();
      page.$('demo-fresh').click();
      await waitFor(() => page.win.location.href !== initialHref, {
        timeoutMs: 30000,
        message: 'Exact library metadata lookup must dispatch its owned cross-host destination.',
      });
      destination = new URL(page.win.location.href);
      assert.equal(destination.searchParams.get('journey'), 'legacy');
      assert.equal(readMissionLibraryReady(destination.searchParams), true);
      assert.match(readMissionLibraryHandoff(destination.searchParams), /signal-01/);
      assert.equal(page.rendered.run, ordinary);
      assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
      assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), null);
      assert.deepEqual(page.errors, []);
    },
  );
  await t.test(
    'the receiving Legacy host prepares exact art and remains at tick zero',
    async (pageTest) => {
      assert.ok(destination);
      const page = await demoPage(pageTest, { search: destination.search });
      assert.equal(page.rendered.run.levelId, 'signal-01');
      assert.equal(page.rendered.run.tick, 0);
      assert.equal(page.rendered.paused, true);
      assert.equal(page.$('game-overlay').dataset.kind, 'ready');
      assert.equal(page.doc.body.dataset.flightState, 'briefing');
      assert.equal(page.doc.body.dataset.pictureState, 'ready');
      assert.equal(page.$('demo-dialog').open, false);
      for (let index = 0; index < 12; index++) page.frame(16);
      assert.equal(page.rendered.run.tick, 0, 'handoff never authorizes automatic Start');
      assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), null);
      assert.deepEqual(page.errors, []);
    },
  );
  await t.test(
    'a Ready hint cannot authorize an unearned locked Legacy mission',
    async (pageTest) => {
      const locked = new URL(destination),
        identity = JSON.parse(readMissionLibraryHandoff(locked.searchParams));
      const levelIndex = identity.indexOf('signal-01');
      assert.ok(levelIndex >= 0);
      identity[levelIndex] = 'signal-03';
      locked.searchParams.set('library-mission', JSON.stringify(identity));
      const page = await demoPage(pageTest, { search: locked.search });
      assert.equal(page.rendered.run.levelId, 'signal-01');
      assert.equal(page.rendered.run.tick, 0);
      assert.equal(page.rendered.paused, true);
      assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), null);
      assert.deepEqual(page.errors, []);
    },
  );
});
