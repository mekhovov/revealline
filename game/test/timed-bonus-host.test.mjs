import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
test('actual Solo preview host pauses a live countdown and resumes expiry without replacing the attempt', async (t) => {
  const schedule = {
    id: 'host-window',
    kind: 'enemy-slow',
    anchors: [
      { x: 8.5, y: 8.5 },
      { x: 24.5, y: 8.5 },
    ],
    initialDelayTicks: 0,
    announcementTicks: 120,
    availableTicks: 1200,
    cooldownTicks: 1440,
    maxAppearances: 3,
    maxCollections: 1,
  };
  const source = editTimedBonus(createStarterProject(), 'nearby-shore', {
    action: 'add',
    id: schedule.id,
    schedule,
  });
  const preview = prepareContentPreview(source, 'nearby-shore', {
    theme: themes.find((theme) => theme.id === 'horizon'),
  });
  const page = await soloPage(t, {
    search: '?practice=1',
    storage: memoryStorage(),
    previewStorage: memoryStorage({
      'revealline.playground.current': JSON.stringify(preview.scenario),
    }),
  });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const run = page.rendered.run;
  for (
    let frame = 0;
    frame < 150 && run.classic.timedBonuses.schedules[0].phase !== 'available';
    frame++
  )
    page.frame();
  assert.equal(run.classic.timedBonuses.schedules[0].phase, 'available');
  assert.equal(foundationCompatibleView(run).powerups[0].timed, true);
  page.$('pause-button').click();
  const paused = structuredClone(run.classic.timedBonuses);
  for (let frame = 0; frame < 30; frame++) page.frame();
  assert.deepEqual(run.classic.timedBonuses, paused);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.run, run);
  for (
    let frame = 0;
    frame < 1250 && run.classic.timedBonuses.schedules[0].phase === 'available';
    frame++
  )
    page.frame();
  assert.equal(run.classic.timedBonuses.schedules[0].phase, 'cooldown');
  assert.equal(run.classic.powerups.length, 0);
  assert.equal(run.classic.timedBonuses.schedules[0].collections, 0);
  assert.deepEqual(page.errors, []);
});
