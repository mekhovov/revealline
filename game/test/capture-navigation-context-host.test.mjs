import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { attachGameShell } from '../ui/game-shell.mjs';

test('Capture context separates the actual Solo host from browsing another mode without changing its flight', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const p = await soloPage(t, { titleScreen: true });
  assert.equal(p.$('shell-family-context').textContent, 'Capture · Solo');
  assert.equal(p.$('shell-family-context').hidden, false);
  assert.equal(p.$('shell-family-context').closest('dialog'), p.$('shell-home'));
  assert.equal(p.doc.activeElement, p.$('shell-featured'));

  await activateHostAction(p.$('shell-featured'));
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  for (let index = 0; index < 12; index++) p.frame();
  p.key('ArrowDown', false);
  assert.equal(p.rendered.run.player.cutting, true);
  p.$('shell-menu').click();
  p.frame(0);
  const run = p.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  const unchanged = () => {
    p.frame(0);
    assert.equal(p.rendered.run, run);
    assert.equal(p.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  };

  await openMissionLibrary(p, 'shell-play');
  assert.match(p.$('journey-chooser-status').textContent, /Browsing Solo · from Capture · Solo/);
  assert.match(
    p.$('journey-chooser').querySelector('.journey-library-copy').textContent,
    /Activate a mission to open its flight or briefing/,
  );
  p.change('journey-mode', 'versus');
  p.$('journey-filter-details').open = false;
  const status = p.$('journey-chooser-status');
  assert.equal(status.parentNode, p.$('journey-chooser'));
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /Browsing Duel · from Capture · Solo/);
  unchanged();
  const focus = p.doc.activeElement;
  setLocale('uk', { persist: false });
  assert.equal(p.$('shell-family-context').textContent, 'Захоплення · Одиночна');
  assert.match(status.textContent, /Перегляд: Дуель · з Захоплення · Одиночна/);
  assert.equal(p.doc.activeElement, focus, 'Translation does not take menu focus.');
  unchanged();
  setLocale('en', { persist: false });
  p.$('journey-back').click();
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.doc.activeElement, p.$('shell-play'));
  unchanged();

  await openMissionLibrary(p, 'shell-play');
  assert.equal(p.$('journey-mode').value, 'versus', 'The existing browsing choice is retained.');
  p.change('journey-mode', 'solo');
  const current = [...p.$('journey-cards').children].find(
    (card) => card.dataset.current === 'true',
  );
  assert(current, 'The exact current mission remains in its existing library.');
  current.focus();
  unchanged();
  const [owner, edition] = JSON.parse(current.dataset.missionId);
  const another = [...p.$('journey-cards').children].find((card) => {
    const [source, revision, , runtimeId] = JSON.parse(card.dataset.missionId);
    return source === owner && revision === edition && runtimeId !== run.levelId && !card.disabled;
  });
  assert(another, 'Another exact mission from the current owner is available.');
  await activateMissionCard(another);
  assert.equal(p.$('mission-replace-dialog').open, true);
  assert.equal(p.$('journey-chooser').open, false);
  unchanged();
  p.$('mission-replace-stay').click();
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.doc.activeElement.dataset.missionId, another.dataset.missionId);
  unchanged();
  assert.deepEqual(p.errors, []);
});

test('isolated lessons retain their own title context without exposing Capture navigation', async (t) => {
  const p = await soloPage(t, { titleScreen: true });
  p.win.emit('pagehide', { persisted: false });
  const shell = attachGameShell({
    document: p.doc,
    training: true,
    canContinue: () => false,
    pause() {},
  });
  t.after(() => shell.destroy());
  assert.equal(p.$('shell-family-context').hidden, true);
  assert.equal(p.$('shell-title-modes').hidden, true);
});
