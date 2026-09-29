import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { encounterGuideEntry } from '../encounter-guide.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { attachEncounterHelp } from '../ui/encounter-help.mjs';

const campaignFor = (level) => ({
  version: 'xonix-campaign.v1',
  id: 'encounter-help-host',
  revision: '1',
  title: 'Encounter Help host fixture',
  levels: [level],
});
async function host(t, level = combatLevel(), options = {}) {
  const storage = memoryStorage();
  const page = await couchPage(t, {
    campaign: campaignFor(level),
    storage,
    nativeKeyboard: true,
    fetchResponse: async (path) =>
      path === '../content/packs/fpv-arcade-r5.json'
        ? new Response('Isolated Base fixture', { status: 503 })
        : undefined,
    ...options,
  });
  return { ...page, storage };
}
function key(page, code) {
  page.key(code, true, page.doc.activeElement);
  page.key(code, false, page.doc.activeElement);
}
function openHelp(page) {
  // The integrated native menus own Help inside Settings → Extras. Use the
  // visible controls and retain that owner for Back; never click a hidden leaf.
  page.frames(151, 1000 / 120);
  page.$('race-options').click();
  assert.equal(page.$('race-options-panel').hidden, false);
  page.$('race-settings-tab-extras').click();
  assert.equal(page.$('race-settings-panel-extras').hidden, false);
  assert.equal(page.$('race-help').closest('[hidden],[inert]'), null);
  page.$('race-help').focus();
  key(page, 'Enter');
  assert.equal(page.$('race-help-panel').hidden, false);
}
async function start(page) {
  page.$('race-start').click();
  await waitFor(() => {
    page.frame(0);
    return page.state() === 'running';
  });
}

test('Help before board admission stays empty and preserves the existing loading or failure owner', () => {
  const doc = new Document(),
    root = doc.createElement('section'),
    status = doc.createElement('p');
  status.setAttribute('role', 'status');
  doc.body.append(status, root);
  let match;
  const help = attachEncounterHelp({
    root,
    getLevels: () => match?.runs?.map((run) => run.level) ?? [],
  });
  for (const message of ['Preparing both boards.', 'Picture unavailable; retry preparation.']) {
    status.textContent = message;
    help.refresh();
    assert.equal(root.hidden, true);
    assert.equal(root.textContent, '');
    assert.equal(status.textContent, message);
    assert.equal(root.querySelectorAll('[role="status"],[aria-live]').length, 0);
  }
  match = { runs: [{ level: combatLevel() }, { level: combatLevel() }] };
  help.refresh();
  assert.equal(root.hidden, false);
  assert.match(root.textContent, /Optional sentry/);
  match = { runs: [{ level: { version: 'unknown' } }] };
  help.refresh();
  assert.equal(root.hidden, false);
  assert.match(root.textContent, /board rules could not be validated/);
  assert.doesNotMatch(root.textContent, /Optional sentry|Practice/);
  assert.equal(status.textContent, 'Picture unavailable; retry preparation.');
  help.dispose();
  match = { runs: [{ level: combatLevel() }] };
  help.refresh();
  assert.equal(root.hidden, true);
  assert.equal(root.textContent, '');
});

test('Versus Help reads actual optional board rules without advancing either paused run', async (t) => {
  const p = await host(t);
  assert.equal(p.renders[0].ruleset, 'xonix-core.v6');
  assert.equal(p.renders[0].level.classic.combatPatrols.enabled, true);
  await start(p);
  p.key('KeyD');
  p.frames(12);
  p.key('KeyD', false);
  p.$('race-pause').click();
  p.frame(0);
  const checkpoints = p.checkpoint(),
    boards = [...p.renders],
    writes = p.storage.writes.length;
  openHelp(p);
  const section = p.$('race-encounter-help');
  assert.ok(section, 'Current optional encounters need a section in the existing Help reader.');
  assert.equal(section.hidden, false);
  assert.equal(p.$('race-help-reading').contains(section), true);
  assert.match(section.textContent, /Optional sentry.*Player 1.*Player 2/s);
  assert.ok(section.textContent.includes(encounterGuideEntry('optional-sentry').risk));
  assert.ok(section.textContent.includes(encounterGuideEntry('optional-sentry').try));
  assert.doesNotMatch(section.textContent, /Practice|Solo|Return to field guide/);
  const content = [...section.children];
  assert.equal(p.doc.activeElement, p.$('race-help-read'));
  key(p, 'Enter');
  assert.equal(p.doc.activeElement, p.$('race-help-reading'));
  assert.equal(p.$('race-help-reading-done').disabled, false);
  p.frames(180);
  assert.deepEqual([...section.children], content, 'Help has no per-frame rebuild.');
  assert.deepEqual(p.checkpoint(), checkpoints);
  assert.deepEqual(p.renders, boards);
  assert.equal(p.storage.writes.length, writes);
  key(p, 'Escape');
  assert.equal(p.doc.activeElement, p.$('race-help-read'));
  p.$('race-help-back').focus();
  key(p, 'Enter');
  assert.equal(p.doc.activeElement, p.$('race-help'));
  assert.equal(p.state(), 'paused');
  assert.deepEqual(p.checkpoint(), checkpoints);
});

test('combined mission Help localizes its existing reader and preserves paused boards with staged setup values', async (t) => {
  const source = createCombatCandidates();
  source.missions[0].actors[0].role = 'trail-pursuer';
  source.missions[0].actors[1].role = 'heading-interceptor';
  source.missions[0].actors.push(structuredClone(source.missions[1].actors[2]));
  const level = resolveMission(compileContentProject(source), source.missions[0].id).level;
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const p = await host(t, level, { turnPolicy: 'grid-center' });
  await start(p);
  p.frames(12);
  p.$('race-pause').click();
  p.frame(0);
  const checkpoint = p.checkpoint(),
    boards = [...p.renders];
  // Uncommitted setup controls must not become the rules of the held round.
  p.$('race-level').value = 'an-uncommitted-choice';
  p.$('race-class').value = 'carrier';
  openHelp(p);
  const section = p.$('race-encounter-help');
  const rows = section.querySelectorAll('[data-encounter-topic]');
  assert.deepEqual(
    rows.map((row) => row.dataset.encounterTopic),
    ['optional-scout', 'optional-sentry', 'trail-pursuit', 'head-intercept'],
  );
  assert.equal(section.children[0].textContent, 'Mission threats');
  const content = [...section.children];
  p.$('race-help-read').focus();
  key(p, 'Enter');
  const reader = p.$('race-help-reading');
  assert.equal(p.doc.activeElement, reader);
  setLocale('uk', { persist: false });
  assert.equal(section.children[0].textContent, 'Загрози місії');
  assert.equal(p.doc.activeElement, reader);
  assert.equal(p.$('race-help-reading-done').disabled, false);
  assert.deepEqual(
    [...section.children],
    content,
    'Locale refresh keeps the active content nodes.',
  );
  for (const row of rows) {
    const entry = encounterGuideEntry(row.dataset.encounterTopic);
    assert.ok(row.textContent.includes(entry.label));
    assert.ok(row.textContent.includes(entry.spot));
    assert.ok(row.textContent.includes(entry.risk));
    assert.ok(row.textContent.includes(entry.try));
    assert.match(row.textContent, /Гравець 1.*Гравець 2/s);
    assert.doesNotMatch(row.textContent, /encounterGuide\.|encounterHelp\./);
  }
  p.frames(90);
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.deepEqual(p.renders, boards);
  key(p, 'Escape');
  assert.equal(p.doc.activeElement, p.$('race-help-read'));
  p.$('race-help-back').click();
  assert.equal(p.doc.activeElement, p.$('race-help'));
  assert.equal(p.doc.body.dataset.couchStatus, 'paused');
  assert.deepEqual(p.checkpoint(), checkpoint);
});

test('absent and disabled patrol rules add no Help section or actions', async (t) => {
  for (const enabled of [false, null])
    await t.test(String(enabled), async (t) => {
      const level = combatLevel();
      if (enabled === null) delete level.classic.combatPatrols;
      else level.classic.combatPatrols.enabled = enabled;
      const p = await host(t, level);
      const checkpoint = p.checkpoint();
      openHelp(p);
      const section = p.$('race-encounter-help');
      assert.equal(section.hidden, true);
      assert.equal(section.textContent, '');
      assert.equal(section.querySelectorAll('button,input,select,a').length, 0);
      p.frames(60);
      assert.deepEqual(p.checkpoint(), checkpoint);
      assert.equal(p.doc.activeElement, p.$('race-help-read'));
    });
});

test('reading encounter guidance after the real time limit retains both result boards', async (t) => {
  const p = await host(t, combatLevel('scout'));
  await start(p);
  for (let i = 0; i < 200 && p.doc.body.dataset.couchStatus !== 'finished'; i++) p.frame(200);
  assert.equal(p.doc.body.dataset.couchStatus, 'finished');
  const checkpoint = p.checkpoint(),
    boards = [...p.renders],
    writes = p.storage.writes.length;
  openHelp(p);
  assert.equal(p.$('race-encounter-help').hidden, false);
  p.$('race-help-read').focus();
  key(p, 'Enter');
  p.frames(60);
  key(p, 'Escape');
  p.$('race-help-back').focus();
  key(p, 'Enter');
  assert.equal(p.doc.body.dataset.couchStatus, 'finished');
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.deepEqual(p.renders, boards);
  assert.equal(p.storage.writes.length, writes);
  assert.equal(p.doc.activeElement, p.$('race-help'));
});

test('controller reading uses the existing end-only Help return and survives cached page restore', async (t) => {
  const pad = {
    index: 0,
    id: 'Encounter Help controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const p = await host(t, combatLevel(), { pads: [pad] });
  await start(p);
  p.frames(12);
  p.$('race-pause').click();
  p.frame(0);
  p.join(0);
  // A separate pointer entry follows the controller's neutral/echo interval.
  p.frames(200);
  openHelp(p);
  p.frame(0);
  p.$('race-help-reading').scrollHeight = 600;
  p.$('race-help-read').focus();
  p.pulse(0, 0);
  assert.equal(p.doc.activeElement, p.$('race-help-reading'));
  assert.match(p.$('race-help-reading-hint').textContent, /South or East returns/);
  const checkpoint = p.checkpoint();
  p.pulse(0, 13);
  assert.ok(p.$('race-help-reading').scrollTop > 0);
  p.pulse(0, 1);
  assert.equal(p.doc.activeElement, p.$('race-help-read'));
  assert.equal(p.$('race-help-reading-done').disabled, true);
  assert.deepEqual(p.checkpoint(), checkpoint);
  p.win.emit('pagehide', { persisted: true });
  p.win.emit('pageshow', { persisted: true });
  p.frames(180);
  assert.equal(p.doc.body.dataset.couchStatus, 'paused');
  assert.equal(p.$('race-encounter-help').hidden, false);
  assert.deepEqual(p.checkpoint(), checkpoint);
  p.$('race-help-read').click();
  assert.equal(p.doc.activeElement, p.$('race-help-reading'));
  p.win.emit('pagehide', { persisted: false });
  assert.equal(p.$('race-encounter-help').hidden, true);
  assert.equal(p.$('race-encounter-help').textContent, '');
  assert.equal(p.pendingFrames(), 0);
});
