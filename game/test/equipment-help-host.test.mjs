import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, SoloElement } from './helpers/solo-dom.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));

// Actual authored capacity/supply data and app prompts; no gameplay rule replacement.
for (const withSupply of [false, true])
  test(`manual equipment prompts follow selected craft and actual supply availability: pads ${withSupply}`, async (t) => {
    const source = structuredClone(campaign);
    source.id = `equipment-help-${withSupply}`;
    if (!withSupply) source.levels[0].supplies = [];
    const page = await soloPage(t, { campaign: source });
    assert.equal(page.rendered.run.ability.capacity, 0);
    assert.equal(page.$('manual-equipment-help').hidden, false);
    assert.equal(page.$('pickup-button').hidden, true);
    assert.doesNotMatch(page.$('keyboard-help').textContent, /supply/i);
    assert.doesNotMatch(page.$('controller-help').textContent, /: supply/i);
    page.change('class-select', 'bomber');
    page.frame(0);
    assert.equal(page.rendered.run.ability.capacity, 1);
    assert.equal(page.$('pickup-button').hidden, !withSupply);
    assert.equal(/supply/i.test(page.$('keyboard-help').textContent), withSupply);
    assert.equal(/: supply/i.test(page.$('controller-help').textContent), withSupply);
    assert.equal(page.rendered.run.tick, 0, 'Reading help does not start flight');
    assert.deepEqual(page.errors, []);
  });

const r5 = JSON.parse(
  readFileSync(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
);
const classic = JSON.parse(
  readFileSync(new URL('../content/packs/classic-lab.json', import.meta.url)),
);
const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));

for (const mode of ['tactical', 'tactical-no-hangar', 'r5', 'one-craft-hangar', 'arcade-hangar']) {
  test(`craft switching follows actual roster and hangars through button, G and controller: ${mode}`, async (t) => {
    const available = ['tactical', 'arcade-hangar'].includes(mode);
    const pad = {
      index: 0,
      id: 'Craft controls',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    const source = structuredClone(campaign);
    if (mode === 'tactical-no-hangar') source.levels[0].hangars = [];
    const imageSizes = new Map(
      r5.levelVisuals.map(({ visualOverrides }) => {
        const data = visualOverrides.background.dataUrl;
        const bytes = Buffer.from(data.split(',')[1], 'base64');
        return [data, [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]];
      }),
    );
    let decoded = 0;
    class PackImage extends PNGImage {
      async decode() {
        await super.decode();
        if (imageSizes.has(this.src)) decoded++;
      }
      set src(data) {
        if (!data.startsWith('blob:'))
          assert.ok(
            imageSizes.has(data),
            'The browser boundary accepts only the exact R5 original headers',
          );
        super.src = data;
      }
      get src() {
        return super.src;
      }
    }
    t.mock.method(SoloElement.prototype, 'getContext', () => null);
    const page = await soloPage(t, {
      campaign: source,
      readPads: () => [pad],
      pictures: { Image: PackImage },
    });
    if (!mode.startsWith('tactical')) {
      const pack = structuredClone(mode === 'r5' ? r5 : classic);
      if (mode !== 'r5') {
        const level = pack.campaigns[0].levels[0];
        level.hangars = [{ id: 'test-hangar', ...level.spawn, radius: 2 }];
        level.classic.arcadeActions = { version: 'arcade-actions.v1' };
        if (mode === 'arcade-hangar') {
          pack.classRecipes.push(structuredClone(classes.find((c) => c.id === 'bomber')));
          pack.campaigns[0].classIds.push('bomber');
        }
      }
      page.$('library-button').click();
      page.doc.querySelector('[data-library-panel="packs"]').click();
      assert.equal(page.$('library-packs').hidden, false);
      page.$('pack-json').value = JSON.stringify(pack);
      await page.$('install-pack').onclick();
      assert.match(page.$('pack-status').textContent, /Validated and installed/);
      const play = page
        .$('installed-packs')
        .querySelectorAll('button')
        .find((b) => b.textContent === `Play ${pack.campaigns[0].title}`);
      assert.ok(play);
      await play.onclick();
      await settle(
        () =>
          page.$('pack-select').value === pack.id && page.doc.body.dataset.pictureState === 'ready',
      );
      if (mode === 'r5')
        assert.ok(decoded > 0, 'The installed authored original completed decoding.');
      page.frame(0);
    }
    assert.equal(page.$('hangar-button').hidden, !available);
    assert.equal(page.$('hangar-button').disabled, !available);
    assert.equal(/hangar/i.test(page.$('loadout-note').textContent), available);
    assert.equal(/hangar/i.test(page.$('hangar-state').textContent), available);
    assert.equal(/change craft/i.test(page.$('keyboard-help').textContent), available);
    assert.equal(/: hangar/i.test(page.$('controller-help').textContent), available);
    assert.equal(
      page.$('class-select').disabled,
      false,
      'Fresh starting-class setup remains available',
    );
    if (mode.startsWith('tactical')) {
      page.change('class-select', 'bomber');
      page.frame(0);
      assert.equal(page.rendered.run.activeClassId, 'bomber');
    } else if (mode === 'r5') {
      assert.equal(page.rendered.run.classRecipes.length, 1);
      assert.equal(page.rendered.run.activeClassId, 'scout');
      assert.equal(page.rendered.run.hangars.length, 0);
    }
    for (const entry of ['button', 'key', 'controller']) {
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.frame();
      page.frame();
      const before = authoritativeCheckpoint(page.rendered.run);
      if (entry === 'button') {
        // Also call the actual handler when hidden/disabled to verify its guard.
        page.$('hangar-button').onclick();
      } else if (entry === 'key') {
        page.key('KeyG');
        page.key('KeyG', false);
      } else {
        pad.buttons[3] = { pressed: true, value: 1 };
        page.frame();
        pad.buttons[3] = { pressed: false, value: 0 };
        // Do not advance a running field just to release the modeled button.
      }
      page.frame(0); // Paint the synchronous pause result without advancing the simulation.
      assert.equal(page.$('hangar-dialog').open, available);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
      if (available) {
        assert.equal(page.rendered.paused, true);
        page.doc.querySelector('button[data-close="hangar-dialog"]').click();
      } else if (entry === 'controller') {
        assert.equal(
          page.$('shell-missions').open,
          true,
          'Unavailable hangar button keeps its Missions fallback',
        );
        page.$('shell-missions-back').click();
      } else page.$('pause-button').click();
      page.$('save-attempt-button').click();
      assert.equal(page.$('save-attempt-button').disabled, false);
      assert.ok(
        page.storage.getItem('revealline.suspended.dev.v1'),
        'Save & pause remains available',
      );
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    }
    if (available) {
      const run = page.rendered.run;
      const next = run.classRecipes.find((c) => c.id !== run.activeClassId).id;
      const historyLength = run.classHistory.length;
      page.$('hangar-button').onclick();
      page.change('switch-class-select', next);
      page.$('switch-class-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.frame(); // Preserve the existing neutral Resume tick.
      page.frame(); // The deliberate switch is applied on the next simulation tick.
      assert.equal(
        page.rendered.run.activeClassId,
        next,
        'The authored safe hangar still switches through the core',
      );
      assert.equal(page.rendered.run.classHistory.length, historyLength + 1);
    }
    assert.deepEqual(page.errors, []);
  });
}
