import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { CLASSES, loadoutHash } from '../core/registry.mjs';
import { emptyProgress } from '../progress.mjs';
import { campaignKey, emptyLibrary, progressFor, setCampaignProgress, exportLibrary, importLibrary } from '../library.mjs';

for (const [file, predecessor, successor] of [
  ['equipment-workshop', 'equipment-workshop/1/3fc2cf073da368b4', 'equipment-workshop/1/7bbeedba8b221cf4'],
  ['neon-mosaic-pack', 'neon-mosaic/2/68f10772f1871b8b', 'neon-mosaic/2/56d7451c6b50ab4b'],
]) {
  const input = JSON.parse(await readFile(new URL(`../content/packs/${file}.json`, import.meta.url)));
  input.visualOverrides = {};
  input.levelVisuals = [];
  const { pack } = await preparePack(input, { decodeImage: async () => { throw Error('No media needed.'); } });
  const campaign = resolvePackCampaign(pack, pack.campaigns[0].id).campaign;
  const first = campaign.levels[0].id;
  const recipe = (campaign.classRecipes ?? CLASSES)[0];
  const variant = `immediate/${recipe.id}/${encodeURIComponent(recipe.revision)}/${loadoutHash(recipe)}/1`;
  const statistics = { score: 900, time: 24, medals: 3, clean: true };
  const clear = { ...statistics, variants: { [variant]: statistics } };
  function fixture() {
    const library = emptyLibrary();
    library.campaigns[predecessor] = {
      ...emptyProgress(campaign), clears: { [first]: structuredClone(clear), 'retired-slot': structuredClone(clear) }, seen: ['retained-win', 'retired-win'],
    };
    return library;
  }
  test(`${file}: exact successor preserves surviving progress without relabeling historical evidence`, () => {
    assert.equal(campaignKey(campaign), successor);
    const library = importLibrary(exportLibrary(fixture()));
    const original = exportLibrary(library);
    const projected = progressFor(library, campaign);
    assert.deepEqual(Object.keys(projected.clears), [first]);
    assert.deepEqual(projected.clears[first], clear);
    assert.deepEqual(projected.seen, ['retained-win', 'retired-win']);
    assert.equal(exportLibrary(library), original);
    const saved = setCampaignProgress(library, campaign, projected);
    assert.deepEqual(saved.campaigns[predecessor], library.campaigns[predecessor]);
    assert.deepEqual(progressFor(importLibrary(exportLibrary(saved), {campaigns:[campaign]}), campaign), projected);
    assert.deepEqual(saved.gallery, library.gallery);
    assert.deepEqual(saved.scores, library.scores);
    assert.deepEqual(saved.masteries, library.masteries);
  });
  test(`${file}: changed geometry, wrong predecessor and malformed/current saves cannot adopt historical progress`, () => {
    const library = fixture();
    const changed = structuredClone(campaign);
    changed.levels[0].goal.coverage -= 0.01;
    assert.notEqual(campaignKey(changed), successor);
    assert.deepEqual(progressFor(library, changed).clears, {});
    const wrong = fixture();
    wrong.campaigns[`${campaign.id}/${campaign.revision}/0000000000000000`] = wrong.campaigns[predecessor];
    delete wrong.campaigns[predecessor];
    assert.deepEqual(progressFor(wrong, campaign).clears, {});
    library.campaigns[predecessor].clears[first].score = -1;
    assert.deepEqual(progressFor(library, campaign).clears, {});
    const current = fixture();
    current.campaigns[successor] = emptyProgress(campaign);
    assert.deepEqual(progressFor(current, campaign).clears, {});
    current.campaigns[successor].clears = { invented: clear };
    assert.deepEqual(progressFor(current, campaign).clears, {});
  });
}
