import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignKey } from '../library.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

test('featured chapter installs the exact R3 impact edition and keeps R2 and First Light selectable', async (t) => {
  const read = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
  const [index, catalog, pack, r2, original] = await Promise.all([
    read('../content/packs/index.json'),
    read('../content/packs/catalog.json'),
    read('../content/packs/fpv-arcade-r3.json'),
    read('../content/packs/fpv-arcade-r2.json'),
    read('../content/packs/fpv-arcade.json'),
  ]);
  assert.deepEqual(
    catalog.packs.map(({ id, path }) => ({ id, path })),
    index.packs,
  );
  for (const edition of [pack, r2, original]) {
    const summary = catalog.packs.find(({ id }) => id === edition.id);
    assert.ok(summary, `${edition.id} remains in the selectable catalog`);
    assert.deepEqual(summary.campaigns[0], {
      id: edition.campaigns[0].id,
      revision: edition.campaigns[0].revision,
      title: edition.campaigns[0].title,
      levels: edition.campaigns[0].levels.map(({ id, name }) => ({ id, name })),
    });
  }
  const keyFor = (edition) => {
    const campaign = edition.campaigns[0];
    return campaignKey({
      ...campaign,
      classRecipes: edition.classRecipes.filter((recipe) => campaign.classIds.includes(recipe.id)),
    });
  };
  assert.equal(pack.id, 'fpv-arcade-r3');
  assert.equal(pack.campaigns[0].id, 'fpv-first-light-r3');
  assert.equal(new Set([pack, r2, original].map(keyFor)).size, 3);
  // Real bytes/catalog/install/host execute. Model only the browser decoder;
  // the renderer and real browser independently inspect the actual pictures.
  const originals = new Map(
    pack.levelVisuals.map((entry) => {
      const url = entry.visualOverrides.background.dataUrl;
      const bytes = Buffer.from(url.split(',')[1], 'base64');
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      return [url, [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]];
    }),
  );
  const oldImage = globalThis.Image;
  globalThis.Image = class {
    set src(value) {
      const size = originals.get(value);
      assert.ok(size, 'Only the three exact First Light originals may decode');
      [this.naturalWidth, this.naturalHeight] = size;
      queueMicrotask(() => this.onload());
    }
  };
  t.after(() => {
    if (oldImage === undefined) delete globalThis.Image;
    else globalThis.Image = oldImage;
  });
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-featured').click();
  await settle(() => !page.$('shell-featured').disabled, 'featured launch settled');
  assert.equal(page.$('pack-select').value, pack.id, page.$('run-message').textContent);
  assert.equal(page.$('campaign-select').value, keyFor(pack));
  assert.equal(page.$('shell-home').open, false);
  page.frame(0);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(pack.campaigns[0].levels[0]));
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
  assert.equal(page.rendered.run.rules.stopOnCapture, true);
  assert.equal(page.rendered.run.level.id, 'orchard-window');
  assert.equal(page.rendered.run.level.revision, '3');
  assert.equal(page.rendered.run.level.goal.coverage, 0.65);
  assert.deepEqual(page.rendered.run.level.classic.lineImpact, {
    version: 'line-impact.v1',
    speed: 24,
  });
  assert.deepEqual(page.rendered.run.classic.lineImpact, {
    version: 'line-impact-state.v1',
    nextId: 1,
    seededActorIds: [],
    fronts: [],
  });
  assert.equal(page.rendered.run.tick, 0);
  for (const [edition, ruleset, coverage] of [
    [r2, 'xonix-core.v5', 0.65],
    [original, 'xonix-core.v4', 0.6],
  ]) {
    page.change('pack-select', edition.id);
    await settle(
      () =>
        page.$('pack-select').value === edition.id &&
        !page.$('pack-select').disabled &&
        page.$('campaign-select').value === keyFor(edition),
      `${edition.id} selection settled`,
    );
    page.frame(0);
    assert.deepEqual(page.rendered.run.level, normalizedLevel(edition.campaigns[0].levels[0]));
    assert.equal(page.rendered.run.ruleset, ruleset);
    assert.equal(page.rendered.run.level.goal.coverage, coverage);
    assert.equal(page.rendered.run.level.classic?.lineImpact, undefined);
    assert.equal(page.rendered.run.classic?.lineImpact, undefined);
    assert.equal(page.rendered.run.tick, 0);
  }
  assert.deepEqual(page.errors, []);
});
