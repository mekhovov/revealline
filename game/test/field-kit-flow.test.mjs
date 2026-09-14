import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { attachMissionPicker } from '../ui/mission-picker.mjs';

const visibleActions = (page) =>
  [...page.doc.querySelector('.home-actions').children]
    .filter((node) => !node.hidden)
    .map((node) => node.id);

test('title has five destinations; Workshop and mission Back preserve an unstarted flight', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  assert.deepEqual(visibleActions(page), [
    'shell-featured',
    'shell-play',
    'shell-gallery',
    'shell-options',
    'shell-workshop',
  ]);
  assert.match(page.$('shell-destination').textContent, /Pressure Lines/);
  page.$('shell-workshop').click();
  assert.equal(page.$('shell-workshop-dialog').open, true);
  assert.equal(page.doc.activeElement.closest('dialog'), page.$('shell-workshop-dialog'));
  assert.ok(
    [...page.$('shell-workshop-dialog').querySelectorAll('a')].some(
      (link) => link.getAttribute('href') === '../authoring/asset-studio/',
    ),
  );
  page.$('shell-workshop-dialog').querySelector('button').click();
  assert.equal(page.$('shell-workshop-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  page.$('shell-play').click();
  page.$('shell-prepare').click();
  assert.equal(page.$('mission-picker-setup').open, true);
  assert.equal(page.doc.activeElement.id, 'pack-select');
  page.$('shell-missions-back').click();
  assert.equal(page.$('shell-home').open, true);
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});

test('mission gallery pages reuse locks; concealed pictures have no original and selection does not launch', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-play').click();
  const picker = attachMissionPicker({ document: page.doc });
  picker.sync();
  const missions = [...page.$('missions').children];
  assert.equal(missions.filter((button) => !button.hidden).length, 6);
  for (const button of missions) {
    assert.equal(
      button.querySelector('img'),
      null,
      'Unfinished mission cannot publish its hidden picture',
    );
    assert.equal(button.dataset.missionArtwork, undefined);
    if (button.disabled) button.click();
  }
  const pageControls = page.doc.querySelector('.mission-gallery-pages').querySelectorAll('button');
  pageControls[1].click();
  assert.equal(missions[0].hidden, true);
  assert.equal(missions[6].hidden, false);
  pageControls[0].click();
  assert.equal(missions[0].hidden, false);
  missions[0].click();
  await Promise.resolve();
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.$('shell-missions').open, true);
  assert.equal(page.$('missions').querySelector('.selected').dataset.level, '0');
});

test('Deploy uses the existing start guard and Continue replaces Deploy after a paused flight', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-play').click();
  page.$('pack-select').disabled = true;
  page.$('shell-deploy').click();
  page.frame(0);
  assert.equal(page.$('shell-missions').open, true, 'A pending content switch blocks deployment');
  assert.equal(page.rendered.run.tick, 0);
  page.$('pack-select').disabled = false;
  // Browser observation normally refreshes the disabled button after the switch.
  page.$('shell-missions-back').click();
  page.$('shell-play').click();
  page.$('shell-deploy').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(page.$('shell-missions').open, false);
  page.$('shell-menu').click();
  assert.deepEqual(visibleActions(page), [
    'shell-continue',
    'shell-play',
    'shell-gallery',
    'shell-options',
    'shell-workshop',
  ]);
  assert.match(page.$('shell-destination').textContent, /Continue/);
  const snapshot = [...page.storage.map];
  page.$('shell-continue').click();
  page.frame(0);
  assert.equal(page.rendered.paused, true, 'Continuing keeps the explicit resume protection');
  assert.deepEqual([...page.storage.map], snapshot);
});
