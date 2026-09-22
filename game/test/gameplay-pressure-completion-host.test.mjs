import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSES } from '../core/index.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
import { builtinMasteryRegistration } from '../mastery-catalog.mjs';
import { recoverGameplayTuning } from '../gameplay-tuning.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'pressure-clear-fixture',
  revision: '1',
  title: 'Pressure completion fixture',
  classRecipes: CLASSES,
  levels: ['first', 'second'].map((id) => ({
    version: 'xonix-level.v1',
    id,
    revision: '1',
    name: id,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.3 },
    enemies: [{ id: 'right', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  })),
};

// Actual Solo host, real core controls and storage callbacks. The DOM boundary
// does not assert native layout; no run status, checkpoint or clear is patched.
for (const admin of [false, true]) {
  test(`${admin ? 'admin' : 'normal Standard'} pressure clear preserves the collection eligibility boundary`, async (t) => {
    const p = await soloPage(t, { campaign });
    if (admin) {
      const panel = p.$('gameplay-tuning');
      panel.querySelector('[data-tuning="enemySpeed"]').value = '1.25';
      panel.querySelector('button').click();
    }
    p.frame(0);
    const recipe = recoverGameplayTuning(p.rendered.run.level);
    assert.equal(recipe.difficulty, 'standard');
    assert.equal(recipe.adminOverride, admin);
    assert.notEqual(p.rendered.run.level.revision, campaign.levels[0].revision);
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.$('save-attempt-button').click();
    assert.ok(p.storage.getItem(sessionKey), 'Save the real unfinished pressure attempt.');
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.key('ArrowDown');
    p.key('ArrowDown', false);
    for (let i = 0; i < 900 && p.rendered.run.status !== 'won'; i++) p.frame();
    assert.equal(p.rendered.run.status, 'won');
    if (!p.$('skip-celebration').hidden) p.$('skip-celebration').click();
    p.frame(0);
    assert.equal(p.$('game-overlay').dataset.kind, 'won');
    const saved = loadLibrary(p.storage, profileKey, { campaigns: [campaign] }).library;
    assert.deepEqual(
      Object.keys(saved.campaigns[campaignKey(campaign)]?.clears ?? {}),
      admin ? [] : ['first'],
    );
    assert.deepEqual(
      saved.masteries,
      [],
      'Pressure attempts do not claim historical equipment seals.',
    );
    assert.equal(saved.gallery.length, admin ? 0 : 1);
    assert.equal(
      p.storage.getItem(sessionKey),
      null,
      'Terminal pressure attempts retire only their own suspended slot.',
    );
    if (!admin) {
      assert.equal(p.$('save-warning').textContent, '');
      p.$('next-button').click();
      await settle(() => {
        p.frame(0);
        return p.rendered.run.levelId === 'second' && p.doc.body.dataset.flightState === 'running';
      }, 'A normal pressure clear continues through the actual Next handler.');
      assert.equal(recoverGameplayTuning(p.rendered.run.level).adminOverride, false);
      const afterNext = loadLibrary(p.storage, profileKey, { campaigns: [campaign] }).library;
      assert.deepEqual(Object.keys(afterNext.campaigns[campaignKey(campaign)].clears), ['first']);
    }
    assert.deepEqual(p.errors, []);
  });
}

test('a genuinely registered historical mastery is not advertised for a tuned fresh flight', async (t) => {
  // Same authored gameplay/roster as the shipped pack, without loading artwork.
  const source = JSON.parse(
    await readFile(
      new URL('../../authoring/library/homeward-skies/pack-source.json', import.meta.url),
    ),
  );
  const authored = { ...source.campaigns[0], classRecipes: CLASSES };
  assert.ok(builtinMasteryRegistration(campaignKey(authored), authored.levels[0].id));
  const p = await soloPage(t, { campaign: authored });
  p.frame(0);
  assert.equal(recoverGameplayTuning(p.rendered.run.level).adminOverride, false);
  assert.equal(p.$('mastery-brief').hidden, true);
  assert.equal(p.$('mastery-overlay').hidden, true);
  assert.equal(p.$('mastery-status').hidden, true);
  assert.deepEqual(
    loadLibrary(p.storage, profileKey, { campaigns: [authored] }).library.masteries,
    [],
  );
});
