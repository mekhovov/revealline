import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { emptyLibrary, updatePreferences, exportLibrary, loadLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';

const presets = JSON.parse(
  await readFile(new URL('../../authoring/motion-lab/presets.json', import.meta.url), 'utf8'),
);
const themes = JSON.parse(
  await readFile(new URL('../content/themes.json', import.meta.url), 'utf8'),
);
const mapping = presets.characterPresentations.sets[0].classBodies;
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
const preferences = (storage) => loadLibrary(storage, profileKey).library.preferences;
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'fpv-role-host',
  revision: '1',
  title: 'Appearance boundary',
  levels: [retryFixture('self-contact').level],
};
const settle = (predicate, message) => waitFor(predicate, { timeoutMs: 30000, message });
class Picture {
  set src(url) {
    if (url.startsWith('data:image/png;base64,')) {
      const bytes = Buffer.from(url.split(',')[1], 'base64');
      this.naturalWidth = bytes.readUInt32BE(16);
      this.naturalHeight = bytes.readUInt32BE(20);
    } else this.naturalWidth = this.naturalHeight = 1254;
    this.width = this.naturalWidth;
    this.height = this.naturalHeight;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
}
const pageOptions = (storage, assets) => ({
  campaign,
  storage,
  assetIndexedDB: assets.indexedDB,
  pictures: { Image: Picture },
});

test('solo matching classes uses seven current starter bodies while manual old/new choices remain deliberate', async (t) => {
  const storage = memoryStorage(),
    assets = managedIndexedDB();
  const p = await soloPage(t, pageOptions(storage, assets));
  assert.equal(p.$('body-select').value, mapping.scout);
  for (const [classId, bodyId] of Object.entries(mapping)) {
    p.change('class-select', classId);
    p.frame(0);
    assert.equal(p.$('body-select').value, bodyId);
    assert.equal(
      p.$('body-select').options.find((option) => option.value === bodyId).disabled,
      false,
    );
  }
  assert.equal(
    p.$('body-select').options.find((option) => option.value === 'fpv-night').disabled,
    true,
  );
  for (const bodyId of ['fpv-body', 'scout-quad', mapping.fiber]) {
    p.change('body-select', bodyId);
    assert.equal(p.$('match-class-appearance').checked, false);
    p.change('class-select', 'scout');
    assert.equal(p.$('body-select').value, bodyId);
    assert.equal(preferences(storage).bodyId, bodyId);
    assert.equal(preferences(storage).matchClassAppearance, false);
  }
  assert.deepEqual(p.errors, []);
});

test('explicit new saved appearance and suspended checkpoint survive normal host reload and Load', async (t) => {
  const initial = updatePreferences(emptyLibrary(), {
    bodyId: mapping.impact,
    matchClassAppearance: false,
  });
  const storage = memoryStorage({ [profileKey]: exportLibrary(initial) }),
    assets = managedIndexedDB();
  let checkpoint, saved;
  await t.test('save an unfinished flight using the selected new body', async (t) => {
    const p = await soloPage(t, pageOptions(storage, assets));
    assert.equal(p.$('body-select').value, mapping.impact);
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.key('ArrowDown');
    for (let n = 0; n < 12; n++) p.frame();
    p.$('pause-button').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    saved = storage.getItem(sessionKey);
    assert.equal(JSON.parse(saved).bodyId, mapping.impact);
    assert.equal(JSON.parse(saved).replay.ticks, 12);
    assert.deepEqual(p.errors, []);
  });
  // The real pagehide handler saves once more during the helper's settled teardown.
  const closed = storage.getItem(sessionKey);
  assert.deepEqual(
    { ...JSON.parse(closed), savedAt: JSON.parse(saved).savedAt },
    JSON.parse(saved),
  );
  saved = closed;
  await t.test(
    'reload keeps that body and loads the exact saved checkpoint while paused',
    async (t) => {
      const p = await soloPage(t, { ...pageOptions(storage, assets), titleScreen: true });
      assert.equal(p.$('body-select').value, mapping.impact);
      assert.equal(preferences(storage).bodyId, mapping.impact);
      assert.equal(storage.getItem(sessionKey), saved);
      p.$('shell-home').close();
      p.$('continue-saved').click();
      await settle(() => {
        p.frame(0);
        return p.rendered.run.tick === 12;
      }, 'Explicit saved flight is loaded.');
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
      assert.equal(p.$('body-select').value, mapping.impact);
      assert.equal(p.rendered.paused, true);
      assert.deepEqual(p.errors, []);
    },
  );
});

test('custom FPV class mapping and unknown explicit appearance keep existing host fallbacks', async (t) => {
  await t.test(
    'one authored class change disables the entire current recommendation guard',
    async (t) => {
      const altered = structuredClone(themes);
      altered.themes.find((theme) => theme.id === 'fpv').classBodies.carrier = 'fpv-body';
      const p = await soloPage(t, {
        ...pageOptions(memoryStorage(), managedIndexedDB()),
        fetchJSON: (path) => (path === 'content/themes.json' ? altered : undefined),
      });
      assert.equal(p.$('body-select').value, 'scout-quad');
      p.change('class-select', 'carrier');
      assert.equal(p.$('body-select').value, 'fpv-body');
      assert.deepEqual(p.errors, []);
    },
  );
  await t.test(
    'a future body ID remains readable as data and displays the existing neutral fallback',
    async (t) => {
      const library = updatePreferences(emptyLibrary(), {
        bodyId: 'future-unregistered-body',
        matchClassAppearance: false,
      });
      const storage = memoryStorage({ [profileKey]: exportLibrary(library) });
      const p = await soloPage(t, pageOptions(storage, managedIndexedDB()));
      assert.equal(p.$('body-select').value, 'neutral-marker');
      assert.equal(preferences(storage).bodyId, 'future-unregistered-body');
      assert.deepEqual(p.errors, []);
    },
  );
  await t.test(
    'an unearned registered appearance keeps the default without rewriting its stored ID',
    async (t) => {
      const library = updatePreferences(emptyLibrary(), {
        bodyId: 'fpv-night',
        matchClassAppearance: false,
      });
      const storage = memoryStorage({ [profileKey]: exportLibrary(library) });
      const p = await soloPage(t, pageOptions(storage, managedIndexedDB()));
      assert.equal(p.$('body-select').value, 'fpv-body');
      assert.equal(preferences(storage).bodyId, 'fpv-night');
      assert.equal(
        p.$('body-select').options.find((option) => option.value === 'fpv-night').disabled,
        true,
      );
      assert.deepEqual(p.errors, []);
    },
  );
});

test('actual Couch recommendation switches both independent painters without touching match physics or profile', async (t) => {
  const storage = memoryStorage(),
    f = await couchPage(t, { storage });
  const look = BoardPainter.prototype.setLook,
    looks = [];
  BoardPainter.prototype.setLook = function (theme, bodyId, overrides) {
    looks.push({ painter: this, theme, bodyId, overrides });
  };
  try {
    for (const [classId, bodyId] of Object.entries(mapping)) {
      looks.length = 0;
      f.$('race-class').value = classId;
      f.$('race-class').emit('change');
      f.frame();
      assert.equal(looks.length, 2);
      assert.notEqual(looks[0].painter, looks[1].painter);
      assert.ok(looks.every((entry) => entry.bodyId === bodyId));
      assert.notEqual(f.renders[0], f.renders[1]);
      assert.notEqual(f.renders[0].cells, f.renders[1].cells);
      assert.equal(f.renders[0].level.id, f.renders[1].level.id);
      assert.equal(f.renders[0].tick, 0);
    }
    f.$('race-start').click();
    f.frame();
    f.key('KeyD');
    f.frames(4);
    f.key('KeyD', false);
    f.$('race-pause').click();
    f.frame();
    const held = f.checkpoint();
    f.frames(3, 100);
    assert.deepEqual(f.checkpoint(), held);
    assert.equal(storage.writes.length, 0);
  } finally {
    BoardPainter.prototype.setLook = look;
  }
});
