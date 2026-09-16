import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignKey } from '../library.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitForChapterSelection } from './helpers/chapter-install-wait.mjs';

test('explicit chapter selection installs exact pressure chapter and keeps R4, R3, R2 and First Light selectable', async (t) => {
  const read = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
  const [index, catalog, archiveIndex, archiveCatalog, pack, r4, r3, r2, original] =
    await Promise.all([
      read('../content/packs/index.json'),
      read('../content/packs/catalog.json'),
      read('../content/packs/archive-index.json'),
      read('../content/packs/archive-catalog.json'),
      read('../content/packs/fpv-arcade-r5.json'),
      read('../content/packs/fpv-arcade-r4.json'),
      read('../content/packs/fpv-arcade-r3.json'),
      read('../content/packs/fpv-arcade-r2.json'),
      read('../content/packs/fpv-arcade.json'),
    ]);
  assert.deepEqual(
    catalog.packs.map(({ id, path }) => ({ id, path })),
    index.packs,
  );
  assert.deepEqual(
    archiveCatalog.packs.map(({ id, path }) => ({ id, path })),
    archiveIndex.packs,
  );
  for (const edition of [pack, r4, r3, r2, original]) {
    const summary = [...catalog.packs, ...archiveCatalog.packs].find(({ id }) => id === edition.id);
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
  assert.equal(pack.id, 'fpv-arcade-r5');
  assert.equal(pack.campaigns[0].id, 'fpv-pressure-lines');
  assert.equal(new Set([pack, r4, r3, r2, original].map(keyFor)).size, 5);
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
  const expectedCampaign = keyFor(pack);
  const page = await soloPage(t, { titleScreen: true });
  // Title Start uses the saved/current selection. Chapter installation is an
  // explicit Missions choice, and must not silently start the selected flight.
  page.$('shell-play').click();
  const choose = page.$('mission-picker-cards').querySelector(`[data-pack="${pack.id}"]`);
  assert.ok(choose);
  choose.click();
  await waitForChapterSelection(
    t,
    page,
    () =>
      page.$('pack-select').value === pack.id &&
      page.$('campaign-select').value === expectedCampaign &&
      !page.$('pack-select').disabled &&
      page.doc.body.dataset.pictureState === 'ready',
    'Pressure Lines chapter install and exact picture must become ready',
  );
  assert.equal(page.$('pack-select').value, pack.id, page.$('run-message').textContent);
  assert.equal(page.$('campaign-select').value, keyFor(pack));
  assert.equal(page.$('shell-home').open, false);
  page.frame(0);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(pack.campaigns[0].levels[0]));
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
  assert.equal(page.rendered.run.rules.stopOnCapture, true);
  assert.equal(page.rendered.run.level.id, 'orchard-crossing');
  assert.equal(page.rendered.run.level.revision, '1');
  assert.equal(page.rendered.run.rules.moveSpeed, 15);
  assert.equal(page.rendered.run.rules.boostMultiplier, 1);
  assert.deepEqual(page.rendered.run.level.classic.arcadeActions, { version: 'arcade-actions.v1' });
  assert.equal(page.rendered.run.level.goal.coverage, 0.68);
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
  assert.deepEqual(page.errors, []);
});

for (const [id, ruleset, coverage] of [
  ['fpv-arcade-r4', 'xonix-core.v5', 0.65],
  ['fpv-arcade-r3', 'xonix-core.v5', 0.65],
  ['fpv-arcade-r2', 'xonix-core.v5', 0.65],
  ['fpv-arcade', 'xonix-core.v4', 0.6],
]) {
  // Two editions fit comfortably. Test each archived switch in its own real
  // host; installing all five image-heavy editions at once correctly exceeds
  // the unchanged library cap (covered by the storage-boundary tests).
  test(`switch from pressure to ${id}`, async (sub) => {
    const read = async (name) =>
      JSON.parse(await readFile(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
    const [pack, edition] = await Promise.all([read('fpv-arcade-r5'), read(id)]);
    const keyFor = (source) =>
      campaignKey({
        ...source.campaigns[0],
        classRecipes: source.classRecipes.filter((recipe) =>
          source.campaigns[0].classIds.includes(recipe.id),
        ),
      });
    const oldImage = globalThis.Image;
    globalThis.Image = class {
      set src(value) {
        const bytes = Buffer.from(value.split(',')[1], 'base64');
        this.naturalWidth = bytes.readUInt32BE(16);
        this.naturalHeight = bytes.readUInt32BE(20);
        queueMicrotask(() => this.onload());
      }
    };
    sub.after(() => {
      if (oldImage === undefined) delete globalThis.Image;
      else globalThis.Image = oldImage;
    });
    const pressureCampaign = keyFor(pack),
      archivedCampaign = keyFor(edition);
    const earlier = await soloPage(sub, { titleScreen: true });
    earlier.$('shell-play').click();
    const choose = earlier.$('mission-picker-cards').querySelector(`[data-pack="${pack.id}"]`);
    assert.ok(choose);
    choose.click();
    await waitForChapterSelection(
      sub,
      earlier,
      () =>
        earlier.$('pack-select').value === pack.id &&
        earlier.$('campaign-select').value === pressureCampaign &&
        !earlier.$('pack-select').disabled &&
        earlier.doc.body.dataset.pictureState === 'ready',
      'Pressure Lines chapter install and exact picture must become ready',
    );
    assert.equal(earlier.$('pack-select').value, pack.id);
    earlier.$('shell-prepare').click();
    assert.equal(earlier.$('mission-picker-setup').open, true);
    earlier.change('pack-select', edition.id);
    await waitForChapterSelection(
      sub,
      earlier,
      () =>
        earlier.$('pack-select').value === edition.id &&
        !earlier.$('pack-select').disabled &&
        earlier.$('campaign-select').value === archivedCampaign,
      `${edition.id} selection settled`,
    );
    earlier.frame(0);
    assert.deepEqual(earlier.rendered.run.level, normalizedLevel(edition.campaigns[0].levels[0]));
    assert.equal(earlier.rendered.run.ruleset, ruleset);
    assert.equal(earlier.rendered.run.level.goal.coverage, coverage);
    assert.deepEqual(
      earlier.rendered.run.level.classic?.arcadeActions,
      id === 'fpv-arcade-r4' ? { version: 'arcade-actions.v1' } : undefined,
    );
    if (id === 'fpv-arcade-r3' || id === 'fpv-arcade-r4') {
      assert.deepEqual(earlier.rendered.run.level.classic.lineImpact, {
        version: 'line-impact.v1',
        speed: 24,
      });
      assert.deepEqual(earlier.rendered.run.classic.lineImpact, {
        version: 'line-impact-state.v1',
        nextId: 1,
        seededActorIds: [],
        fronts: [],
      });
    } else {
      assert.equal(earlier.rendered.run.level.classic?.lineImpact, undefined);
      assert.equal(earlier.rendered.run.classic?.lineImpact, undefined);
    }
    assert.equal(earlier.rendered.run.tick, 0);
    assert.deepEqual(earlier.errors, []);
  });
}
