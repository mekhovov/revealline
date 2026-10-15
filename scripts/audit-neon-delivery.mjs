import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { inspectImageDataUrl } from '../game/content.mjs';
import { CURRENT_ART_SOURCES } from '../game/presentation/current-art-sources.mjs';
import { classicReviewCatalog } from './neon-review-catalog.mjs';
import { readMissionLibraryHandoff } from '../game/mission-library/handoff.mjs';

const root = new URL('../', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const index = await read('game/content/mission-library-index.json');
const catalog = classicReviewCatalog();
const neon = await read('authoring/library/neon-artwork/prompts.json');
const classic = (await read('authoring/library/classic-reveal-artwork/manifest.json')).images;
const packs = new Map();
const images = [];
for (const [folder, entries] of [
  ['neon-artwork', neon],
  ['classic-reveal-artwork', classic],
]) {
  for (const entry of entries) {
    const source = `authoring/library/${folder}/${entry.file}`;
    const bytes = await readFile(new URL(source, root));
    assert.equal(digest(bytes), entry.sha256, `${entry.id}: original picture changed`);
    const inspected = inspectImageDataUrl(`data:image/jpeg;base64,${bytes.toString('base64')}`);
    assert.ok(inspected.valid, `${entry.id}: invalid picture`);
    assert.equal(inspected.width, entry.width);
    assert.equal(inspected.height, entry.height);
    const packId = entry.packId ?? (entry.pack === 'first-signal' ? null : entry.pack);
    const sourceRows = index.missions.filter(
      (row) =>
        row.packId === packId &&
        (folder === 'neon-artwork' ? row.name === entry.title : row.levelId === entry.id),
    );
    assert.equal(sourceRows.length, 1, `${entry.id}: missing or duplicate catalog identity`);
    const row = sourceRows[0];
    const current = catalog.filter(
      (item) => item.name === row.name && JSON.parse(item.ownerId)[2] === packId,
    );
    assert.equal(current.length, 1, `${entry.id}: missing exact public link`);
    assert.equal(
      readMissionLibraryHandoff(new URL(current[0].publicHref).searchParams),
      current[0].id,
      `${entry.id}: link changes the selected identity`,
    );
    if (!packs.has(packId))
      packs.set(
        packId,
        await read(packId ? `game/content/packs/${packId}.json` : 'game/content/base-artwork.json'),
      );
    const pack = packs.get(packId);
    const binding = pack.levelVisuals.find((item) => item.levelId === row.levelId)?.visualOverrides
      .background;
    assert.ok(binding?.dataUrl, `${entry.id}: missing level picture`);
    assert.equal(
      digest(Buffer.from(binding.dataUrl.split(',')[1], 'base64')),
      entry.sha256,
      `${entry.id}: wrong picture bound`,
    );
    assert.ok(
      CURRENT_ART_SOURCES.some(
        (item) => item.owner.levelId === row.levelId && item.image?.sha256 === entry.sha256,
      ),
      `${entry.id}: current-picture registry mismatch`,
    );
    const sourceBytes = await readFile(new URL(row.sourceFile.path, root));
    assert.equal(
      digest(sourceBytes),
      row.sourceFile.sha256,
      `${entry.id}: stale mission catalog source`,
    );
    images.push({
      id: row.levelId,
      title: row.name,
      packId,
      campaignId: row.campaignId,
      campaignKey: row.campaignKey,
      levelRevision: row.levelRevision,
      source,
      imageSHA256: entry.sha256,
      width: inspected.width,
      height: inspected.height,
      fit: binding.fit,
      publicURL: current[0].publicHref,
      galleryURL: `https://mekhovov.github.io/revealline/authoring/library/${folder}/#${entry.id}`,
    });
  }
}
assert.equal(neon.length, 54);
assert.equal(classic.length, 23);
assert.equal(new Set(images.map((row) => row.imageSHA256)).size, 77, 'Repeated artwork');
const report = {
  format: 'revealline-neon-delivery-audit.v1',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  scope:
    'Source catalog, exact public URLs and image byte bindings. Not a browser, offline-install or human-balance approval.',
  catalogIdentityCount: index.missions.length,
  catalogIdentities: index.missions.map(({ source, packId, campaignId, levelId }) => ({
    source,
    packId,
    campaignId,
    levelId,
  })),
  currentPictureOwners: CURRENT_ART_SOURCES.length,
  currentPictureOwnersWithoutImage: CURRENT_ART_SOURCES.filter((row) => !row.image).map(
    (row) => row.id,
  ),
  images,
};
const output = new URL('../docs/qualification/neon-level-completion/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('inventory.json', output), JSON.stringify(report, null, 2) + '\n');
const baselineCommit = 'dcdad7f7b8c05c20e192564a981c8f9448460653';
const baseline = JSON.parse(
  execFileSync('git', ['show', `${baselineCommit}:game/content/mission-library-index.json`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  }),
);
const identity = ({ source, packId, campaignId, levelId }) =>
  JSON.stringify([source, packId, campaignId, levelId]);
const present = new Set(index.missions.map(identity));
const missingIdentities = baseline.missions
  .filter((row) => !present.has(identity(row)))
  .map(identity);
assert.equal(missingIdentities.length, 0, 'Previously published catalog identities are missing');
await writeFile(
  new URL('catalog-preservation.json', output),
  JSON.stringify(
    {
      baselineCommit,
      baselineIdentities: baseline.missions.length,
      currentIdentities: index.missions.length,
      missingIdentities,
      scope:
        'Official Classic mission catalog identities; does not inspect private browser imports or saved runs.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `${images.length} unique original images match their level bindings, catalog sources, picture registry and exact public links. ${index.missions.length} catalog identities recorded.`,
);
