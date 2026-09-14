import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
const settle = (predicate, message) => waitFor(predicate, { timeoutMs: 30000, message });
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

// Browser decoding is modeled only at this boundary; PNG dimensions come from
// the actual embedded bytes. This does not certify pixels or native rendering.
class Picture {
  set src(url) {
    if (url.startsWith('data:image/png;base64,')) {
      const bytes = Buffer.from(url.split(',')[1], 'base64');
      this.width = this.naturalWidth = bytes.readUInt32BE(16);
      this.height = this.naturalHeight = bytes.readUInt32BE(20);
    } else {
      this.width = this.naturalWidth = 384;
      this.height = this.naturalHeight = 288;
    }
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
}
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const selectionKey = `${profileKey}.last-selection.v1`;
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'selection-host',
  revision: '1',
  title: 'Original saved chapter',
  levels: [retryFixture('self-contact').level],
};

test('actual chapter selection survives reload while the other saved flight stays explicit and exact', async (t) => {
  const storage = memoryStorage();
  const assets = managedIndexedDB();
  let originalSave, originalCheckpoint, selection;
  await t.test(
    'save one flight, then deliberately choose a different installed chapter',
    async (t) => {
      const p = await soloPage(t, {
        campaign,
        storage,
        assetIndexedDB: assets.indexedDB,
        pictures: { Image: Picture },
      });
      p.$('start-button').click();
      await settle(() => p.doc.body.dataset.flightState === 'running');
      p.key('ArrowDown');
      for (let n = 0; n < 12; n++) p.frame();
      p.$('pause-button').click();
      p.frame(0);
      originalCheckpoint = authoritativeCheckpoint(p.rendered.run);
      originalSave = storage.getItem(sessionKey);
      assert.equal(JSON.parse(originalSave).replay.ticks, 12);
      p.$('shell-menu').click();
      await p.$('shell-featured').onclick();
      assert.equal(
        p.$('pack-select').value,
        'fpv-arcade-r5',
        p.$('shell-featured-status').textContent,
      );
      await settle(
        () =>
          !p.$('shell-featured').disabled &&
          p.$('pack-select').value === 'fpv-arcade-r5' &&
          p.doc.body.dataset.pictureState === 'ready',
      );
      p.frame(0);
      assert.equal(p.$('pack-select').value, 'fpv-arcade-r5');
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.paused, true);
      selection = storage.getItem(selectionKey);
      assert.equal(JSON.parse(selection).levelId, p.rendered.run.level.id);
      // The existing menu pause may refresh savedAt; the complete saved flight stays exact.
      const after = JSON.parse(storage.getItem(sessionKey));
      assert.deepEqual(
        { ...after, savedAt: JSON.parse(originalSave).savedAt },
        JSON.parse(originalSave),
      );
      originalSave = storage.getItem(sessionKey);
      assert.deepEqual(p.errors, []);
    },
  );
  await t.test(
    'reload opens the selected chapter without automatically loading or flying',
    async (t) => {
      const p = await soloPage(t, {
        campaign,
        storage,
        titleScreen: true,
        assetIndexedDB: assets.indexedDB,
        pictures: { Image: Picture },
      });
      assert.equal(p.$('shell-home').open, true);
      assert.equal(p.$('pack-select').value, 'fpv-arcade-r5');
      assert.equal(p.rendered.run.level.id, JSON.parse(selection).levelId);
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.paused, true);
      p.frame(1000);
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(storage.getItem(selectionKey), selection);
      assert.equal(storage.getItem(sessionKey), originalSave);
      p.$('shell-home').close();
      p.$('continue-saved').click();
      await settle(() => {
        p.frame(0);
        return p.rendered.run.level.id === campaign.levels[0].id;
      }, 'Saved-flight adoption completes.');
      p.frame(0);
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), originalCheckpoint);
      assert.equal(p.rendered.paused, true);
      assert.equal(
        storage.getItem(selectionKey),
        selection,
        'Restoring is not a new menu selection.',
      );
      assert.deepEqual(p.errors, []);
    },
  );
});
