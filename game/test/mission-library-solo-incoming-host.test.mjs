import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { preparePack } from '../packs.mjs';

import {
  installedAssets,
  settle,
  appendLibraryWaitEvidence,
  startPrepared,
  lateBase,
  currentPressure,
} from './mission-library-solo-fixture.mjs';

test('incoming opaque Classic handoff launches its exact late mission without another picker', async (t) => {
  const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
  const p = await soloPage(t, { titleScreen: true, search: `?${search}` });
  await startPrepared(p, lateBase.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

test('incoming Current-rules Classic handoff retains its original picture owner', async (t) => {
  assert.ok(currentPressure);
  const source = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url), 'utf8'),
  );
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  const assets = await installedAssets(pack);
  const search = new URLSearchParams({
    journey: 'legacy',
    'library-mission': currentPressure.id,
  });
  const p = await soloPage(t, {
    titleScreen: true,
    search: `?${search}`,
    assetIndexedDB: assets.indexedDB,
  });
  await startPrepared(p, currentPressure.runtimeId);
  assert.equal(p.rendered.run.level.classic.lineImpact.version, 'line-impact.v1');
  assert.ok(Math.abs(p.rendered.run.level.classic.lineImpact.speed - 38.4) < 1e-9);
  assert.equal(p.$('journey-chooser').open, false);
  assert.doesNotMatch(p.$('run-message').textContent, /Picture choice.*execution catalog/);
  assert.deepEqual(p.errors, []);
});

for (const transition of ['finish', 'newer input', 'failed initial picture'])
  test(`incoming Classic handoff serializes initial picture preparation: ${transition}`, async (t) => {
    const compiled = JSON.parse(
      await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
    );
    const pictureHash = (level) =>
      Object.values(compiled.resolved.assets).find(
        (asset) => asset.kind === 'image' && asset.description === `scene-${level}`,
      ).file.sha256;
    const initialHash = pictureHash('signal-01'),
      targetHash = pictureHash(lateBase.runtimeId);
    let release,
      initialRequested = false,
      targetRequests = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    const search = new URLSearchParams({ journey: 'legacy', 'library-mission': lateBase.id });
    const page = soloPage(t, {
      titleScreen: true,
      search: `?${search}`,
      waitForPictures: false,
      fetchResponse: async (path) => {
        if (String(path).includes(targetHash)) targetRequests++;
        if (!String(path).includes(initialHash)) return;
        initialRequested = true;
        await gate;
        if (transition === 'failed initial picture')
          return new Response('Deliberate initial picture outage', { status: 503 });
      },
    });
    try {
      await settle(
        () => initialRequested && globalThis.document.getElementById('journey-collection'),
      );
    } catch (error) {
      appendLibraryWaitEvidence(error, null, initialRequested);
      throw error;
    }
    const doc = globalThis.document;
    assert.notEqual(doc.body.dataset.flightState, 'running');
    assert.equal(
      targetRequests,
      0,
      'The requested original waits for the captured initial writer.',
    );
    if (transition === 'newer input') {
      doc.getElementById('start-button').emit('pointerdown');
      doc.getElementById('start-button').focus();
    }
    const focused = doc.activeElement;
    release();
    const p = await page;
    if (transition === 'newer input') {
      await settle(() => p.doc.body.dataset.pictureState === 'ready');
      await new Promise((resolve) => setImmediate(resolve));
      p.frame(0);
      assert.equal(
        targetRequests,
        0,
        'A retired incoming action must never prepare its destination.',
      );
      assert.equal(p.rendered.run.levelId, 'signal-01');
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.paused, true);
      assert.equal(p.doc.activeElement, focused);
      assert.notEqual(p.doc.body.dataset.flightState, 'running');
    } else {
      await startPrepared(p, lateBase.runtimeId);
      assert.ok(targetRequests > 0);
      assert.equal(p.$('shell-home').open, false);
    }
    assert.equal(p.$('journey-chooser').open, false);
    assert.deepEqual(p.errors, []);
  });

test('unknown incoming identity reports failure and never starts a different mission', async (t) => {
  const p = await soloPage(t, {
    titleScreen: true,
    search: '?journey=legacy&library-mission=unknown',
  });
  await settle(() => p.$('run-message').textContent.includes('exact mission edition'));
  p.frame(0);
  assert.notEqual(p.doc.body.dataset.flightState, 'running');
  assert.equal(p.$('shell-home').open, false);
  assert.deepEqual(p.errors, []);
});

