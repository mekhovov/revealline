import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { loadLibrary } from '../library.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { CELEBRATION_SECONDS } from '../ui/celebration.mjs';
import { preparePack } from '../packs.mjs';

import {
  assertReadyCard,
  installedAssets,
  settle,
  open,
  startPrepared,
  running,
} from './mission-library-solo-fixture.mjs';

test('installed Custom late mission in a second campaign launches its exact authored identity', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  source.id = 'library-custom-host';
  const second = structuredClone(source.campaigns[0]);
  second.id = 'custom-second';
  second.levels.forEach((level, index) => {
    level.id = `custom-second-${index}`;
  });
  source.campaigns.push(second);
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      assert.equal(image.valid, true);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  const assets = await installedAssets(pack);
  const p = await soloPage(t, { titleScreen: true, assetIndexedDB: assets.indexedDB });
  await open(p);
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  assert.equal(
    p.$('journey-cards').children.length,
    source.campaigns.reduce((n, c) => n + c.levels.length, 0),
  );
  const card = [...p.$('journey-cards').children].find(
    (button) => JSON.parse(button.dataset.missionId)[3] === second.levels.at(-1).id,
  );
  assert.match(card.textContent, /Custom.*Authored rules/);
  assertReadyCard(card, second.levels.at(-1).name);
  card.click();
  await startPrepared(p, second.levels.at(-1).id);
  assert.equal(p.$('pack-select').value, source.id);
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('late Custom clear follows authored Next, ends truthfully, and never grants skipped clears', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  source.id = 'library-authored-next';
  source.campaigns = [source.campaigns[0]];
  source.campaigns[0].id = 'library-authored-next-campaign';
  source.campaigns[0].levels = [0, 1, 2].map((index) => ({
    ...retryFixture('self-contact').level,
    id: `authored-next-${index}`,
    name: `Authored next ${index}`,
    goal: { coverage: 0.1 },
    rules: { lives: 3 },
  }));
  source.levelVisuals = [];
  source.visualOverrides = {};
  const { pack } = await preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      assert.equal(image.valid, true);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  });
  const assets = await installedAssets(pack);
  const p = await soloPage(t, { titleScreen: true, assetIndexedDB: assets.indexedDB });
  await open(p);
  p.$('journey-collection').value = 'Custom';
  p.$('journey-collection').emit('change');
  const selected = [...p.$('journey-cards').children].find(
    (card) => JSON.parse(card.dataset.missionId)[3] === 'authored-next-1',
  );
  selected.click();
  await startPrepared(p, 'authored-next-1');
  async function clear() {
    p.key('ArrowDown');
    p.key('ArrowDown', false);
    for (let frame = 0; frame < 30 && p.rendered.run.status !== 'won'; frame++) p.frame(250);
    assert.equal(p.rendered.run.status, 'won');
    assert.equal(p.$('game-overlay').hidden, true, 'Earned picture precedes result actions.');
    const completed = authoritativeCheckpoint(p.rendered.run);
    assert.equal(p.$('skip-celebration').hidden, true);
    for (
      let frame = 0;
      frame < Math.ceil(CELEBRATION_SECONDS * 10) + 2 && p.$('show-result').hidden;
      frame++
    )
      p.frame(100);
    assert.equal(p.$('show-result').hidden, false);
    p.$('show-result').click();
    assert.equal(p.$('game-overlay').hidden, false);
    assert.equal(p.$('skip-celebration').hidden, true);
    p.frame(0);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), completed);
    await settle(() => {
      p.frame(0);
      return p.$('game-overlay').dataset.kind === 'won';
    });
    assert.equal(p.$('next-button').hidden, false);
  }
  await clear();
  p.$('next-button').click();
  await running(p, 'authored-next-2');
  await clear();
  const last = p.rendered.run;
  p.$('next-button').click();
  await settle(() =>
    /End of the Solo mission library/.test(p.$('flight-preparation-status').textContent),
  );
  p.frame(0);
  assert.equal(p.rendered.run, last, 'Sequence end never wraps to the first uncleared mission.');
  assert.equal(p.$('game-overlay').dataset.kind, 'won');
  const profile = loadLibrary(p.storage, 'revealline.library.dev.v1', {
    campaigns: pack.campaigns,
  }).library;
  const progress = Object.values(profile.campaigns).find(
    (entry) => entry.clears['authored-next-1'],
  );
  assert.deepEqual(Object.keys(progress.clears).sort(), ['authored-next-1', 'authored-next-2']);
  assert.equal(p.$('overlay-menu').hidden, false);
  p.$('overlay-menu').click();
  await settle(() => p.$('shell-home').open);
  p.$('shell-play').click();
  await settle(() => p.$('journey-chooser').open);
  assert.equal(p.$('journey-collection').value, 'Custom');
  assert.deepEqual(p.errors, []);
});
