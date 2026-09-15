import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachMissionPicker } from '../ui/mission-picker.mjs';

const visibleActions = (page) =>
  [...page.doc.querySelector('.home-actions').children]
    .filter((node) => !node.hidden)
    .map((node) => node.id || node.href);

test('Mission setup keeps the original craft status in its modal and restores it after closing', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  const status = page.$('craft-preparation-status'),
    originalParent = status.parentNode,
    originalSiblings = [...originalParent.children],
    originalChildren = [...status.children];
  page.$('shell-play').click();
  assert.equal(status.closest('dialog'), page.$('shell-missions'));
  assert.equal(
    status.closest('.shell-dialog-heading'),
    page.$('shell-missions').querySelector('.shell-dialog-heading'),
  );
  assert.deepEqual(
    [...status.children],
    originalChildren,
    'The existing live presenter is retained',
  );
  page.$('shell-prepare').click();
  const focused = page.doc.activeElement;
  page.$('shell-missions').emit('close');
  assert.equal(
    status.closest('dialog'),
    page.$('shell-missions'),
    'A queued old close cannot move current feedback',
  );
  assert.equal(page.doc.activeElement, focused);
  page.$('shell-missions-back').click();
  assert.equal(status.parentNode, originalParent);
  assert.deepEqual([...originalParent.children], originalSiblings);
  assert.deepEqual([...status.children], originalChildren);
  page.$('shell-play').click();
  assert.equal(status.closest('dialog'), page.$('shell-missions'));
  page.$('shell-briefing').click();
  assert.deepEqual([...originalParent.children], originalSiblings);
  assert.deepEqual(page.errors, []);
});

test('direct briefing and disposal retain one craft presenter outside hidden mission content', async (t) => {
  const page = await soloPage(t),
    status = page.$('craft-preparation-status'),
    originalParent = status.parentNode,
    originalChildren = [...status.children];
  page.$('overlay-brief').click();
  assert.equal(page.$('shell-missions').dataset.view, 'brief');
  assert.equal(status.closest('dialog'), page.$('shell-missions'));
  assert.equal(page.$('shell-mission-content').contains(status), false);
  assert.equal(page.$('shell-deploy-bar').contains(status), false);
  assert.deepEqual([...status.children], originalChildren);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(status.parentNode, originalParent);
  assert.deepEqual([...status.children], originalChildren);
  assert.equal(page.doc.querySelectorAll('#craft-preparation-status').length, 1);
  assert.deepEqual(page.errors, []);
});

test('title has five game destinations and the release catalog; Workshop and mission Back preserve an unstarted flight', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  assert.deepEqual(visibleActions(page), [
    'shell-featured',
    'shell-play',
    'shell-gallery',
    'shell-options',
    'shell-workshop',
    'shell-release-explorer',
  ]);
  const catalog = page.doc.querySelector('.home-actions').querySelector('[data-release-explorer]');
  assert.equal(catalog.tagName, 'A');
  assert.equal(catalog.href, 'http://localhost/releases/');
  assert.match(catalog.textContent, /Release explorer/);
  assert.equal(catalog.hidden, false);
  assert.ok(catalog.tabIndex >= 0, 'The catalog remains keyboard reachable');
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
    'shell-release-explorer',
  ]);
  assert.match(page.$('shell-destination').textContent, /Continue/);
  const snapshot = [...page.storage.map];
  page.$('shell-continue').click();
  page.frame(0);
  assert.equal(page.rendered.paused, true, 'Continuing keeps the explicit resume protection');
  assert.deepEqual([...page.storage.map], snapshot);
});

test('an accepted world change rebuilds mission thumbnails without starting the existing flight', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  const previous = page.$('missions').children[0];
  previous.dataset.missionArtwork = 'data:image/png;base64,stale-fixture';
  page.$('theme-select').value = 'ukraine';
  page.$('theme-select').emit('change');
  await settle(() => page.$('missions').children[0] !== previous);
  assert.equal(page.$('missions').children[0].dataset.missionArtwork, undefined);
  assert.equal(page.$('theme-select').value, 'ukraine');
  page.frame(0);
  assert.equal(page.rendered.run.tick, 0);
});

// The real shell, controller router and simulation run here. Only native cancel
// dispatch and gamepad hardware are modeled; browser focus/layout stays separate.
for (const origin of ['home', 'flight', 'brief']) {
  for (const exit of ['button', 'escape', 'controller']) {
    test(`Missions ${exit} returns to ${origin} without resuming or changing a saved cut`, async (t) => {
      const pad = {
        index: 0,
        id: 'Missions navigation',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      const page = await soloPage(t, { titleScreen: true, readPads: () => [pad] });
      page.$('shell-play').click();
      page.$('shell-deploy').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.key('ArrowDown');
      for (let i = 0; i < 24; i++) page.frame();
      page.key('ArrowDown', false);
      page.key('Escape');
      page.key('Escape', false);
      page.frame(0);
      assert.equal(page.rendered.paused, true);
      assert.equal(page.rendered.run.player.cutting, true);
      if (origin === 'home') {
        page.$('overlay-menu').click();
        page.$('shell-play').click();
        page.$('shell-prepare').click();
        page.$('save-attempt-button').click();
      } else if (origin === 'brief') page.$('overlay-brief').click();
      else page.$('shell-packs').click();
      const checkpoint = authoritativeCheckpoint(page.rendered.run);
      const stored = [...page.storage.map];
      assert.equal(page.$('shell-missions').open, true);
      if (origin === 'brief') assert.equal(page.$('shell-missions').dataset.view, 'brief');
      if (exit === 'button') page.$('shell-missions-back').click();
      else if (exit === 'escape') {
        const cancel = new Event('cancel', { cancelable: true });
        if (page.$('shell-missions').dispatchEvent(cancel)) page.$('shell-missions').close();
        assert.equal(cancel.defaultPrevented, true, 'The shell owns the native close destination');
      } else {
        page.frame();
        page.frame(); // Real controller adoption requires neutral samples.
        pad.buttons[1] = { pressed: true, value: 1 };
        page.frame();
        pad.buttons[1] = { pressed: false, value: 0 };
        page.frame();
      }
      await Promise.resolve();
      page.frame(0);
      assert.equal(page.$('shell-missions').open, false);
      assert.equal(page.$('shell-home').open, origin === 'home');
      assert.equal(
        page.doc.activeElement.id,
        origin === 'home' ? 'shell-continue' : 'start-button',
      );
      assert.equal(page.rendered.paused, true);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
      const storedAfter = [...page.storage.map];
      // Existing Home entry pauses/autosaves again. Its timestamp may advance;
      // every saved payload field and every other storage entry must remain exact.
      if (origin === 'home') {
        const savedBefore = stored.find(([key]) => key === 'revealline.suspended.dev.v1')[1];
        const savedAfter = storedAfter.find(([key]) => key === 'revealline.suspended.dev.v1');
        const beforeSession = JSON.parse(savedBefore);
        const afterSession = JSON.parse(savedAfter[1]);
        assert.ok(Date.parse(afterSession.savedAt) >= Date.parse(beforeSession.savedAt));
        afterSession.savedAt = beforeSession.savedAt;
        assert.deepEqual(afterSession, beforeSession);
        savedAfter[1] = savedBefore;
      }
      assert.deepEqual(storedAfter, stored);
      assert.doesNotMatch(
        page.$('controller-ui-hint').textContent,
        /operation is still in progress/,
      );
      assert.equal(page.$('shell-missions').dataset.view, undefined);
      assert.deepEqual(page.errors, []);
    });
  }
}

test('Back to flight remains an intentional exit from title Missions', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-play').click();
  page.$('shell-briefing').click();
  await Promise.resolve();
  page.frame(0);
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('shell-missions').open, false);
  assert.equal(page.doc.activeElement.id, 'start-button');
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});

test('controller Back retains a cancellation warning when a transaction keeps its dialog open', async (t) => {
  const pad = {
    index: 0,
    id: 'Blocked cancellation',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const page = await soloPage(t, { titleScreen: true, readPads: () => [pad] });
  page.$('shell-options').click();
  // The minimal DOM does not perform showModal's native autofocus.
  page.$('settings-dialog').querySelector('button').focus();
  page.$('settings-dialog').addEventListener('cancel', (event) => event.preventDefault());
  page.frame();
  page.frame();
  pad.buttons[1] = { pressed: true, value: 1 };
  page.frame();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('shell-home').open, true);
  assert.match(page.$('controller-ui-hint').textContent, /operation is still in progress/);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});
