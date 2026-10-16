import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, SoloElement } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Exercise the actual HUD after a legal six-cell cut. Browser layout and
// physical input are outside this modeled host regression.
for (const sample of [
  { points: 0.1, score: 0.6000000000000001, en: '0.6', uk: '0,6' },
  { points: 7, score: 42, en: '00042', uk: '00042' },
]) {
  test(
    `Solo HUD formats ${sample.points}-point captures without changing saved or replay scores`,
    { timeout: 120000 },
    async (t) => {
      const previousLocale = getLocale();
      t.after(() => setLocale(previousLocale, { persist: false }));
      setLocale('en', { persist: false });
      t.mock.method(SoloElement.prototype, 'getContext', () => null);
      const level = retryFixture('self-contact').level;
      level.rules = { lives: 3, pointsPerCell: sample.points };
      const campaign = {
        version: 'xonix-campaign.v1',
        id: 'hud-numeric-capture',
        revision: '1',
        title: 'Numeric HUD regression',
        classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
        levels: [level],
      };
      const page = await soloPage(t, { campaign });
      assert.equal(page.$('score').textContent, '00000');
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.key('ArrowDown');
      for (let n = 0; n < 10; n++) page.frame();
      page.key('ArrowDown', false);
      page.key('ArrowLeft');
      for (let n = 0; n < 180 && page.rendered.run.claimedCount === 0; n++) page.frame();
      page.key('ArrowLeft', false);
      page.$('pause-button').click();
      page.frame(0);

      const run = page.rendered.run;
      assert.equal(run.claimedCount, 6, 'Legal fixed-step steering closes the six-cell cut.');
      assert.equal(run.score, sample.score);
      assert.equal(page.$('score').textContent, sample.en);
      const checkpoint = authoritativeCheckpoint(run),
        stored = page.storage.getItem('revealline.suspended.dev.v1'),
        saved = JSON.parse(stored),
        replay = verifyReplay(saved.replay);
      assert.equal(replay.match, true);
      assert.equal(replay.state.score, sample.score);
      const writes = page.storage.writes.length;
      for (const [locale, expected] of [
        ['uk', sample.uk],
        ['en', sample.en],
      ]) {
        setLocale(locale, { persist: false });
        assert.equal(
          page.$('score').textContent,
          expected,
          'The paused HUD follows the selected language immediately.',
        );
        page.frame(0);
        assert.equal(page.$('score').textContent, expected);
        assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
        assert.equal(run.score, sample.score);
        assert.equal(page.storage.getItem('revealline.suspended.dev.v1'), stored);
        assert.equal(page.storage.writes.length, writes);
      }
      assert.deepEqual(page.errors, []);
    },
  );
}
