import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { captureMedalGoalCopy } from '../ui/capture-medal-goal.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
import { CLASSES } from '../core/index.mjs';
import { recoverGameplayTuning } from '../gameplay-tuning.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'medal-goal-host',
  revision: '1',
  title: 'Medal goal host',
  classRecipes: CLASSES,
  levels: ['first', 'second'].map((id) => ({
    version: 'xonix-level.v1',
    id,
    revision: '1',
    name: id,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    goal: { coverage: 0.3 },
    enemies: [{ id: 'right', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
    rules: { timeMedals: [1, 100] },
  })),
};

async function complete(p) {
  p.$('start-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  p.key('ArrowDown', false);
  for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
  assert.equal(p.rendered.run.status, 'won');
  // Let the native earned-picture presentation finish before using its visible
  // result action. The terminal simulation remains frozen during these frames.
  for (let i = 0; i < 100 && p.$('show-result').hidden; i++) p.frame(100);
  assert.equal(p.$('show-result').hidden, false);
  p.$('show-result').click();
  p.frame(0);
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
}

test('actual earned Capture result localizes its medal gap without changing accepted flight, progress, focus or Retry ownership', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const p = await soloPage(t, { campaign });
  await complete(p);
  const run = p.rendered.run;
  assert.equal(run.medal, 'silver');
  assert.equal(recoverGameplayTuning(run.level).adminOverride, false);
  assert.match(p.$('overlay-footnote').textContent, /Next: Gold.*1 s.*rounded up.*No lives lost/);
  assert.equal(p.$('overlay-footnote').textContent, captureMedalGoalCopy(run));
  const profileKey = 'revealline.library.dev.v1',
    saved = loadLibrary(p.storage, profileKey, { campaigns: [campaign] }).library;
  assert.equal(saved.campaigns[campaignKey(campaign)].clears.first.medals, 2);
  p.$('retry-button').focus();
  const checkpoint = authoritativeCheckpoint(run),
    storage = [...p.storage.map],
    writes = p.storage.writes.length;
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.equal(p.$('overlay-footnote').textContent, captureMedalGoalCopy(run));
    assert.match(
      p.$('overlay-footnote').textContent,
      language === 'uk' ? /Наступна медаль: золото/ : /Next: Gold/,
    );
    assert.equal(p.doc.activeElement === p.$('retry-button'), true);
    assert.equal(p.rendered.run === run, true);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual([...p.storage.map], storage);
    assert.equal(p.storage.writes.length, writes);
  }
  p.$('retry-button').click();
  await settle(() => p.doc.body.dataset.flightState === 'running' && p.rendered.run !== run);
  assert.equal(p.rendered.run.levelId, run.levelId);
  assert.equal(p.rendered.run.status, 'running');
  assert.equal(p.$('game-overlay').hidden, true);
  assert.deepEqual(p.errors, []);
});

test('an actual administrative playtest completion does not advertise a next medal or award one', async (t) => {
  setLocale('en', { persist: false });
  const p = await soloPage(t, { campaign });
  const tuning = p.$('gameplay-tuning');
  tuning.querySelector('[data-tuning="enemySpeed"]').value = '1.25';
  tuning.querySelector('button').click();
  await complete(p);
  assert.equal(recoverGameplayTuning(p.rendered.run.level).adminOverride, true);
  assert.match(p.$('overlay-copy').textContent, /no clear, medal or mastery awarded/);
  assert.equal(p.$('result-medals').textContent, '');
  assert.equal(p.$('overlay-footnote').textContent, '');
  const saved = loadLibrary(p.storage, 'revealline.library.dev.v1', {
    campaigns: [campaign],
  }).library;
  assert.deepEqual(Object.keys(saved.campaigns[campaignKey(campaign)]?.clears ?? {}), []);
  assert.deepEqual(p.errors, []);
});
