import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { getLocale, setLocale, t as text } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';

const campaign = JSON.parse(
  await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
);

function english(t) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
}

test('Duel Home identifies the prepared format and mission in its existing summary', async (t) => {
  english(t);
  const p = await couchPage(t);
  const summary = p.$('race-summary');
  assert.equal(summary.parentElement.className, 'landing-commands');
  assert.equal(summary.hidden, false);
  assert.match(summary.textContent, /^Capture · Duel · /);
  assert.ok(summary.textContent.includes(text('interface:oneRace')));
  const mission = campaign.levels.find((level) => level.id === p.renders[0].levelId);
  assert.ok(mission);
  assert.ok(summary.textContent.endsWith(contentText(mission, 'name')));
  assert.equal(p.$('race-main').hidden, false);
  const before = p.checkpoint();
  p.frames(10);
  assert.deepEqual(p.checkpoint(), before);
  p.$('race-options').click();
  p.$('race-settings-tab-gameplay').click();
  p.$('race-format').value = 'first-to-two';
  p.$('race-format').emit('change');
  await waitFor(() => summary.textContent.includes(text('interface:firstToTwo')));
  assert.match(summary.textContent, /^Capture · Duel · /);
  assert.equal(p.state(), 'ready');
});

test('Duel mission browsing, locale and Back preserve the paused accepted round', async (t) => {
  english(t);
  const p = await couchPage(t);
  p.$('race-start').click();
  p.frame();
  p.key('ArrowDown');
  p.frames(12);
  p.key('ArrowDown', false);
  p.$('race-pause').click();
  p.frame(0);
  assert.equal(p.state(), 'paused');
  assert.ok(p.tick() > 0, 'The round actually advanced before pausing.');
  const before = p.checkpoint();
  await openMissionLibrary(p, 'race-chapters');
  assert.match(p.$('journey-chooser-status').textContent, /Browsing Duel · from Capture · Duel/);
  p.$('journey-mode').value = 'solo';
  p.$('journey-mode').emit('change');
  p.$('journey-filter-details').open = false;
  assert.match(p.$('journey-chooser-status').textContent, /Browsing Solo · from Capture · Duel/);
  const card = [...p.$('journey-cards').children].find((node) => !node.disabled);
  assert(card);
  card.focus();
  p.frames(5);
  assert.deepEqual(p.checkpoint(), before);
  setLocale('uk', { persist: false });
  assert.equal(p.doc.activeElement, card);
  assert.match(p.$('race-summary').textContent, /^Захоплення · Дуель · /);
  assert.match(p.$('journey-chooser-status').textContent, /з Захоплення · Дуель/);
  p.$('journey-back').click();
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement, p.$('race-chapters'));
  assert.deepEqual(p.checkpoint(), before);
});

for (const [route, label, translated] of [
  ['humanoid-hunt-v1', 'Hunt lessons · six missions', 'Уроки полювання · шість місій'],
  ['snake-hunt-v1', 'Snake Hunt', 'Зміїне полювання'],
]) {
  test(`Duel retains the accepted ${route} identity instead of calling it Capture`, async (t) => {
    english(t);
    const p = await couchPage(t, {
      href: `http://localhost/game/couch/?journey=${route}`,
      initialLevel: null,
    });
    const summary = p.$('race-summary');
    assert.equal(summary.parentElement.className, 'landing-commands');
    assert.ok(summary.textContent.startsWith(`${label} · Duel · `), summary.textContent);
    assert.doesNotMatch(summary.textContent, /^Capture/);
    setLocale('uk', { persist: false });
    assert.ok(summary.textContent.startsWith(`${translated} · Дуель · `), summary.textContent);
    assert.doesNotMatch(summary.textContent, /^Захоплення/);
  });
}
