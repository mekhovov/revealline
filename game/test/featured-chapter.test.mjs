import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';

test('featured chapter installs the exact R2 catalog entry and keeps the prior chapter selectable', async (t) => {
  const read = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
  const [index, catalog, pack] = await Promise.all([
    read('../content/packs/index.json'),
    read('../content/packs/catalog.json'),
    read('../content/packs/fpv-arcade-r2.json'),
  ]);
  assert.deepEqual(
    catalog.packs.map(({ id, path }) => ({ id, path })),
    index.packs,
  );
  const summary = catalog.packs.find(({ id }) => id === pack.id);
  assert.deepEqual(summary.campaigns[0], {
    id: pack.campaigns[0].id,
    revision: pack.campaigns[0].revision,
    title: pack.campaigns[0].title,
    levels: pack.campaigns[0].levels.map(({ id, name }) => ({ id, name })),
  });
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
  assert.equal(page.$('shell-home').open, false);
  page.frame(0);
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
  assert.equal(page.rendered.run.rules.stopOnCapture, true);
  assert.equal(page.rendered.run.level.id, 'orchard-window');
  assert.equal(page.rendered.run.level.goal.coverage, 0.65);
  assert.equal(page.rendered.run.tick, 0);
  page.change('pack-select', 'fpv-arcade');
  await settle(
    () => page.$('pack-select').value === 'fpv-arcade' && !page.$('pack-select').disabled,
  );
  page.frame(0);
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v4');
  assert.equal(page.rendered.run.level.goal.coverage, 0.6);
  assert.deepEqual(page.errors, []);
});
