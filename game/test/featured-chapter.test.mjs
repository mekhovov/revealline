import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolveObjectURL } from 'node:buffer';
import { campaignKey } from '../library.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { releasePictureForIdentity } from '../presentation/release-pictures.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { openMissionLibrary, activateMissionCard } from './helpers/library-selection.mjs';

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);
const library = createMissionLibrary(
  classicLibrarySources(index, {
    availability: () => ({ state: 'ready' }),
    launch: () => true,
  }),
);
const keyFor = (source) =>
  campaignKey({
    ...source.campaigns[0],
    classRecipes: source.classRecipes.filter((recipe) =>
      source.campaigns[0].classIds.includes(recipe.id),
    ),
  });
async function fixture(t) {
  const decoded = new WeakMap();
  class OriginalImage extends PNGImage {
    async decode() {
      await super.decode();
      const blob = resolveObjectURL(this.source);
      const bytes = blob
        ? Buffer.from(await blob.arrayBuffer())
        : Buffer.from(this.source.split(',')[1], 'base64');
      decoded.set(this, {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        width: this.width,
        height: this.height,
      });
    }
  }
  const page = await soloPage(t, { titleScreen: true, pictures: { Image: OriginalImage } });
  return { page, decoded };
}
async function chooseAndPlay(f, edition, { replace = false } = {}) {
  const { page } = f;
  const authored = edition.campaigns[0].levels[0];
  const metadata = index.missions.find(
    (entry) => entry.packId === edition.id && entry.levelId === authored.id,
  );
  assert.ok(metadata);
  const mission = library.missions.find(
    (row) =>
      row.ownerId === JSON.stringify(['classic', metadata.source, edition.id]) &&
      row.editionId === metadata.sourceFile.sha256 &&
      JSON.parse(row.id)[2] === keyFor(edition) &&
      row.runtimeId === authored.id,
  );
  assert.ok(mission, 'The complete exact authored edition is indexed.');
  await openMissionLibrary(page, 'shell-play');
  const find = () =>
    [...page.$('journey-cards').children].find((row) => row.dataset.missionId === mission.id);
  const card = find();
  assert.ok(card);
  assert.match(card.querySelector('.journey-card-action').textContent, /^Download/);
  const prior = page.rendered.run,
    checkpoint = authoritativeCheckpoint(prior),
    picture = page.rendered.backdrop;
  await activateMissionCard(card);
  assert.equal(
    page.rendered.run,
    prior,
    'Downloading never launches or replaces the previous flight.',
  );
  assert.deepEqual(authoritativeCheckpoint(prior), checkpoint);
  assert.equal(page.rendered.backdrop, picture);
  assert.equal(page.$('journey-chooser').open, true);
  const ready = find();
  assert.ok(ready, 'Requery the stable mission identity after preparation refresh.');
  assert.equal(ready.querySelector('.journey-card-action').textContent, 'Play');
  await activateMissionCard(ready);
  if (replace) {
    assert.equal(page.$('mission-replace-dialog').open, true);
    await settle(() => !page.$('mission-replace-confirm').disabled);
    assert.equal(page.rendered.run, prior);
    assert.deepEqual(authoritativeCheckpoint(prior), checkpoint);
    const button = page.$('mission-replace-confirm'),
      handler = button.onclick;
    assert.equal(button.textContent, 'Replace & play');
    let pending;
    button.onclick = (...args) => (pending = handler.apply(button, args));
    try {
      button.focus();
      button.click();
    } finally {
      button.onclick = handler;
    }
    assert.ok(pending instanceof Promise);
    await pending;
  }
  page.frame(0);
  assert.equal(page.$('pack-select').value, edition.id);
  assert.equal(page.$('campaign-select').value, keyFor(edition));
  assert.equal(page.$('pack-select').disabled, false);
  assert.equal(page.doc.body.dataset.pictureState, 'ready');
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.$('journey-chooser').open, false);
  const identity = {
    baseCampaignKey: keyFor(edition),
    levelId: authored.id,
    levelRevision: authored.revision,
    themeId: 'fpv',
  };
  const approved = releasePictureForIdentity(compiled, identity);
  assert.ok(approved, 'An exact approved release picture belongs to this authored edition.');
  assert.deepEqual(page.rendered.backdrop.pin.identity, identity);
  assert.equal(page.rendered.backdrop.pin.sha256, approved.asset.file.sha256);
  assert.deepEqual(
    f.decoded.get(page.rendered.backdrop.image),
    {
      sha256: approved.asset.file.sha256,
      width: approved.asset.file.width,
      height: approved.asset.file.height,
    },
    'The actual accepted background decoded the exact approved PNG bytes.',
  );
  assert.equal(page.rendered.backdrop.fit, 'contain');
  assert.equal(page.rendered.backdrop.sampling, 'nearest');
  assert.deepEqual(
    page.rendered.run.level,
    normalizedLevel(applyGameplayTuning(authored, resolveGameplayTuning('standard'))),
  );
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
  return authored;
}

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
  const f = await fixture(t),
    { page } = f;
  await chooseAndPlay(f, pack);
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.rendered.run.ruleset, 'xonix-core.v5');
  assert.equal(page.rendered.run.rules.stopOnCapture, true);
  assert.equal(page.rendered.run.level.id, 'orchard-crossing');
  const authored = pack.campaigns[0].levels[0];
  assert.equal(authored.revision, '1');
  assert.equal(authored.rules.moveSpeed, 15);
  assert.equal(page.rendered.run.rules.moveSpeed, 8.84);
  assert.equal(page.rendered.run.rules.boostMultiplier, 1);
  assert.deepEqual(page.rendered.run.level.classic.arcadeActions, { version: 'arcade-actions.v1' });
  assert.equal(page.rendered.run.level.goal.coverage, 0.68);
  assert.deepEqual(authored.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
  assert.deepEqual(
    page.rendered.run.level.classic.lineImpact,
    applyGameplayTuning(authored, resolveGameplayTuning('standard')).classic.lineImpact,
  );
  assert.deepEqual(page.rendered.run.classic.lineImpact, {
    version: 'line-impact-state.v1',
    nextId: 1,
    seededActorIds: [],
    fronts: [],
  });
});

for (const [id, ruleset, coverage] of [
  ['fpv-arcade-r4', 'xonix-core.v5', 0.65],
  ['fpv-arcade-r3', 'xonix-core.v5', 0.65],
  ['fpv-arcade-r2', 'xonix-core.v5', 0.65],
  ['fpv-arcade', 'xonix-core.v4', 0.6],
]) {
  // Two editions fit the existing library budget. Keep each archived switch in
  // its own real host rather than weakening the unchanged storage boundary.
  test(`switch from pressure to ${id}`, async (t) => {
    const read = async (name) =>
      JSON.parse(await readFile(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
    const [pack, edition] = await Promise.all([read('fpv-arcade-r5'), read(id)]);
    const f = await fixture(t),
      { page } = f;
    await chooseAndPlay(f, pack);
    const authored = await chooseAndPlay(f, edition, { replace: true });
    assert.equal(page.rendered.run.ruleset, ruleset);
    assert.equal(page.rendered.run.level.goal.coverage, coverage);
    assert.deepEqual(
      page.rendered.run.level.classic?.arcadeActions,
      id === 'fpv-arcade-r4' ? { version: 'arcade-actions.v1' } : undefined,
    );
    if (id === 'fpv-arcade-r3' || id === 'fpv-arcade-r4') {
      assert.deepEqual(authored.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
      assert.deepEqual(
        page.rendered.run.level.classic.lineImpact,
        applyGameplayTuning(authored, resolveGameplayTuning('standard')).classic.lineImpact,
      );
      assert.deepEqual(page.rendered.run.classic.lineImpact, {
        version: 'line-impact-state.v1',
        nextId: 1,
        seededActorIds: [],
        fronts: [],
      });
    } else {
      assert.equal(page.rendered.run.level.classic?.lineImpact, undefined);
      assert.equal(page.rendered.run.classic?.lineImpact, undefined);
    }
    assert.equal(page.rendered.run.tick, 0);
    assert.deepEqual(page.errors, []);
  });
}
