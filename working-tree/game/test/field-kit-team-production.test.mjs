import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFieldKitTeamAssets } from '../../scripts/field-kit-team-assets.mjs';
import {
  createFieldKitProduction,
  fieldKitRecipeSources,
} from '../../scripts/produce-field-kit-theme.mjs';
import { applyReviewedTeamArt } from '../../scripts/reviewed-team-art.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, resolvePresentation } from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const families = ['team-anchor-field-kit-v1', 'team-feedback-field-kit-v1'];
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-team-production-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const family of families) {
    const relative = `authoring/library/${family}`;
    await fs.mkdir(path.join(dir, relative), { recursive: true });
    await fs.copyFile(
      path.join(root, relative, 'source.mjs'),
      path.join(dir, relative, 'source.mjs'),
    );
    await fs.cp(path.join(root, relative, 'prepared'), path.join(dir, relative, 'prepared'), {
      recursive: true,
    });
  }
  return dir;
}

test('Team production preserves six original PNGs through migration, compile and exact bundle round-trip', async () => {
  const produced = await createFieldKitTeamAssets({ projectRoot: root });
  assert.deepEqual(
    produced.assets.map((asset) => asset.slotId),
    [
      'team.anchor.available',
      'team.anchor.captured',
      'team.effect.support',
      'team.effect.slowed',
      'team.effect.rescue',
      'team.effect.recovery',
    ],
  );
  const prior = createDefaultThemeBundle();
  const base = structuredClone(prior);
  base.slots.push(...produced.slots);
  const assets = produced.assets.map(({ slotId, values }) => ({
    format: FORMATS.asset,
    id: `${slotId}.field-kit`,
    revision: 1,
    recipe: null,
    ...values,
  }));
  const desired = reviseStudioTheme(base, {
    assets,
    bindings: Object.fromEntries(
      produced.assets.map(({ slotId }, i) => [slotId, { id: assets[i].id, revision: 1 }]),
    ),
  });
  const next = retainProductionHistory(desired, prior, { appendSlots: produced.slots });
  assert.deepEqual(next.slots.slice(0, prior.slots.length), prior.slots);
  for (const kind of ['assets', 'themes', 'collections'])
    assert.deepEqual(next[kind].slice(0, prior[kind].length), prior[kind]);
  assert.deepEqual(
    resolvePresentation({ ...next, selection: prior.selection }),
    resolvePresentation(prior),
  );
  assert.deepEqual(retainProductionHistory(desired, next, { appendSlots: produced.slots }), next);
  const binaries = new Map(
    produced.assets.map(({ body, values }) => [
      values.file.sha256,
      new Blob([body], { type: 'image/png' }),
    ]),
  );
  for (const { values, body } of produced.assets) {
    assert.equal(values.quality.stage, 'produced', 'A generator cannot approve its own visuals.');
    assert.equal(values.provenance.parent, null, 'No invented default asset parent.');
    assert.equal(values.file.sha256, hash(body));
  }
  const bundle = await exportThemeBundle(next, binaries);
  const imported = await importThemeBundle(bundle, { decodeImage: null });
  assert.deepEqual(imported.document, next);
  assert.deepEqual(
    Buffer.from(await (await exportThemeBundle(imported.document, imported.assets)).arrayBuffer()),
    Buffer.from(await bundle.arrayBuffer()),
  );
  const compiled = await compilePresentation(imported.document, imported.assets);
  for (const { slotId, body, values } of produced.assets) {
    const resolved = compiled.resolved.assets[slotId];
    assert.equal(resolved.file.sha256, values.file.sha256);
    assert.ok(
      [...compiled.files.values()].some((bytes) => Buffer.from(bytes).equals(body)),
      `${slotId} exact bytes must reach output`,
    );
  }
});

for (const corruption of ['manifest', 'image', 'source', 'missing']) {
  test(`Team production refuses ${corruption} drift instead of silently regenerating an accepted family`, async (t) => {
    const projectRoot = await fixture(t);
    const family = path.join(projectRoot, 'authoring/library/team-anchor-field-kit-v1');
    if (corruption === 'manifest') {
      const target = path.join(family, 'prepared/manifest.json');
      const record = JSON.parse(await fs.readFile(target, 'utf8'));
      record.assets[0].description += 'changed';
      await fs.writeFile(target, JSON.stringify(record));
    } else if (corruption === 'source') {
      await fs.appendFile(path.join(family, 'source.mjs'), '\n// changed original\n');
    } else if (corruption === 'missing') {
      await fs.unlink(path.join(family, 'prepared/available.png'));
    } else {
      await fs.appendFile(path.join(family, 'prepared/available.png'), 'changed bytes');
    }
    await assert.rejects(createFieldKitTeamAssets({ projectRoot }));
  });
}

test('the actual Field Kit producer appends the complete Team family without mutating frozen defaults', async () => {
  const before = createDefaultThemeBundle();
  const produced = await createFieldKitProduction({ projectRoot: root });
  assert.equal(produced.document.slots.length, before.slots.length + 6);
  assert.deepEqual(createDefaultThemeBundle(), before);
  const resolved = resolvePresentation(produced.document);
  for (const slot of produced.appendSlots) {
    const asset = resolved.assets[slot.id];
    assert.equal(asset.kind, 'image');
    assert.equal(
      asset.quality.stage,
      'reviewed',
      'Only the exact separately reviewed family is adopted.',
    );
    const body = Buffer.from(await produced.assets.get(asset.file.sha256).arrayBuffer());
    assert.equal(hash(body), asset.file.sha256);
    assert.equal(body.length, asset.file.bytes);
  }
});

test('changing a reviewed contract or producer revokes the family approval without altering generated assets', async () => {
  const prepared = (await createFieldKitTeamAssets({ projectRoot: root })).assets;
  for (const changed of [
    'game/presentation/team-anchor-slots.mjs',
    'scripts/produce-team-feedback-art.mjs',
  ]) {
    const result = await applyReviewedTeamArt(prepared, async (name) =>
      name === changed ? Buffer.from('changed') : fs.readFile(path.join(root, name)),
    );
    assert.equal(result, prepared);
    assert.ok(result.every((asset) => asset.values.quality.stage === 'produced'));
  }
  const approved = await applyReviewedTeamArt(prepared, (name) =>
    fs.readFile(path.join(root, name)),
  );
  assert.ok(approved.every((asset) => asset.values.quality.stage === 'reviewed'));
  assert.ok(prepared.every((asset) => asset.values.quality.stage === 'produced'));
});

test('review approval is bound to each role, not merely any previously inspected PNG', async () => {
  const prepared = (await createFieldKitTeamAssets({ projectRoot: root })).assets;
  const swapped = prepared.map((asset, i) =>
    i === 0 ? { ...asset, body: prepared[1].body } : asset,
  );
  assert.equal(
    await applyReviewedTeamArt(swapped, (name) => fs.readFile(path.join(root, name))),
    swapped,
  );
  assert.ok(swapped.every((asset) => asset.values.quality.stage === 'produced'));
});

test('Team loading helpers reopen only the UI recipe fingerprint when their source changes', async () => {
  const read = (name) => fs.readFile(path.join(root, name));
  const original = await fieldKitRecipeSources(read);
  for (const changed of [
    'manifest-path',
    'team-actor-slots',
    'team-anchor-slots',
    'team-effect-slots',
    'team-threat-slots',
    'team-event-slots',
  ]) {
    const target = `game/presentation/${changed}.mjs`;
    const updated = await fieldKitRecipeSources(async (name) =>
      name === target ? Buffer.concat([await read(name), Buffer.from('\n// changed')]) : read(name),
    );
    assert.notEqual(updated.ui, original.ui, target);
    for (const group of Object.keys(original).filter((name) => name !== 'ui'))
      assert.equal(updated[group], original[group]);
  }
});
