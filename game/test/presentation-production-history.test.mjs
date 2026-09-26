import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { reviseStudioTheme, adoptStudioBundle } from '../presentation/studio-session.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import { retainFieldKitProductionHistory } from '../../scripts/team-production-history.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { createFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';

async function reconstructPinnedProduction(oracle, candidate) {
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const source = structuredClone(oracle.metadata);
  for (const [group, pin] of Object.entries(oracle.groups)) {
    const prefix = candidate.document[group].slice(0, pin.count);
    assert.equal(prefix.length, pin.count, `pinned ${group} count`);
    assert.equal(sha(canonicalJSON(prefix)), pin.sha256, `pinned ${group} bytes`);
    source[group] = prefix;
  }
  // Reuse records only after all immutable group hashes match the pinned oracle.
  const document = validateThemeBundle(source);
  const assets = new Map();
  for (const asset of document.assets) {
    if (!asset.file || assets.has(asset.file.sha256)) continue;
    const blob = candidate.assets.get(asset.file.sha256);
    assert.ok(blob, `pinned payload ${asset.file.sha256}`);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(bytes.length, asset.file.bytes);
    assert.equal(sha(bytes), asset.file.sha256);
    assets.set(asset.file.sha256, blob);
  }
  const payloads = [...assets].map(([hash, blob]) => [hash, blob.size]);
  payloads.sort(([a], [b]) => a.localeCompare(b));
  assert.equal(payloads.length, oracle.payloads.count);
  assert.equal(sha(canonicalJSON(payloads)), oracle.payloads.sha256);
  const raw = Buffer.from(await (await exportThemeBundle(document, assets)).arrayBuffer());
  assert.equal(raw.length, oracle.provenance.bytes);
  assert.equal(sha(raw), oracle.provenance.sha256, 'reconstructed pinned bundle');
  return { document, assets, raw };
}

test('P02 retains the published P01 history and appends audio7 under a new fpv24', async () => {
  // This oracle was independently read from published 856850ce, not this candidate.
  const oracle = JSON.parse(
    await fs.readFile(new URL('./fixtures/production-p01-v0574.json', import.meta.url), 'utf8'),
  );
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const key = (record) => `${record.id}@${record.revision}`;
  const currentRaw = await fs.readFile(
    new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
  );
  const current = await importThemeBundle(new Blob([currentRaw]), { decodeImage: null });
  // Pin this historical test to published c930 P02, independent of current generation.
  const p02Oracle = JSON.parse(
    await fs.readFile(new URL('./fixtures/production-p02-v0581.json', import.meta.url), 'utf8'),
  );
  const candidate = await reconstructPinnedProduction(p02Oracle, current);
  const raw = candidate.raw;
  const priorSource = structuredClone(oracle.metadata);
  for (const [group, pin] of Object.entries(oracle.groups)) {
    const prefix = candidate.document[group].slice(0, pin.count);
    assert.equal(prefix.length, pin.count, `published ${group} count`);
    assert.equal(sha(canonicalJSON(prefix)), pin.sha256, `published ${group} bytes`);
    priorSource[group] = prefix;
  }
  // Only after matching every immutable group may candidate records supply the prior.
  const prior = validateThemeBundle(priorSource);
  const payloads = [];
  for (const [hash, blob] of candidate.assets) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(sha(bytes), hash, `actual payload ${hash}`);
    payloads.push([hash, bytes.length]);
  }
  payloads.sort(([a], [b]) => a.localeCompare(b));
  assert.equal(payloads.length, oracle.payloads.count);
  assert.equal(sha(canonicalJSON(payloads)), oracle.payloads.sha256);
  const priorBytes = Buffer.from(
    await (await exportThemeBundle(prior, candidate.assets)).arrayBuffer(),
  );
  assert.equal(priorBytes.length, oracle.provenance.bytes);
  assert.equal(sha(priorBytes), oracle.provenance.sha256, 'reconstructed published bundle');

  // The producer visits bindings in slot order, while exported JSON sorts object
  // keys. Restore that insertion order only; every canonical historical byte
  // still matches the independent published oracle before replaying the append.
  const production = { ...candidate, document: structuredClone(candidate.document) };
  for (const theme of production.document.themes)
    theme.bindings = Object.fromEntries(
      production.document.slots
        .filter((slot) => Object.hasOwn(theme.bindings, slot.id))
        .map((slot) => [slot.id, theme.bindings[slot.id]]),
    );
  assert.equal(canonicalJSON(production.document), canonicalJSON(candidate.document));
  const next = retainProductionHistory(production.document, prior);
  validateThemeBundle(next, { previous: prior, expectedRevision: 23 });
  assert.equal(canonicalJSON(next), canonicalJSON(candidate.document));
  const expected = [
    'cancel',
    'capture',
    'confirm',
    'failure',
    'focus',
    'music',
    'pickup',
    'victory',
  ]
    .map((name) => `audio.${name}.field-kit@7`)
    .sort();
  assert.deepEqual(next.assets.slice(oracle.groups.assets.count).map(key).sort(), expected);
  assert.equal(next.assets.length, 1082);
  assert.equal(next.themes.length, 25);
  assert.equal(next.revision, 24);
  assert.deepEqual(next.selection.theme, { id: 'fpv', revision: 24 });
  const theme = next.themes.at(-1);
  assert.deepEqual(theme.parent, { id: 'fpv', revision: 23 });
  assert.deepEqual(Object.values(theme.bindings).map(key).sort(), expected);
  assert.deepEqual(theme.tokens, {});
  const screens = Object.entries(resolvePresentation(next).assets).filter(
    ([slot]) => slot.startsWith('screen.') && !slot.startsWith('screen.title.'),
  );
  assert.equal(screens.length, 7);
  for (const [slot, record] of screens) assert.equal(record.revision, 12, slot);
  assert.equal(next.slots.length, oracle.groups.slots.count);
  assert.equal(next.collections.length, oracle.groups.collections.count);

  const mergedAssets = new Map([...candidate.assets, ...production.assets]);
  assert.equal(mergedAssets.size, 127);
  for (const [hash, before] of candidate.assets)
    assert.deepEqual(
      Buffer.from(await mergedAssets.get(hash).arrayBuffer()),
      Buffer.from(await before.arrayBuffer()),
      `retained payload ${hash}`,
    );
  const second = retainProductionHistory(production.document, next);
  assert.equal(canonicalJSON(second), canonicalJSON(next));
  const exported = Buffer.from(await (await exportThemeBundle(next, mergedAssets)).arrayBuffer());
  const repeated = Buffer.from(await (await exportThemeBundle(second, mergedAssets)).arrayBuffer());
  assert.deepEqual(exported, raw, 'published P02 ledger equals reproduced bundle');
  assert.deepEqual(repeated, exported, 'second export identical');
  const compiledPrior = await compilePresentation(prior, candidate.assets);
  const compiledNext = await compilePresentation(next, mergedAssets);
  const compiledSecond = await compilePresentation(second, mergedAssets);
  assert.equal(compiledNext.files.size, 131);
  assert.deepEqual([...compiledNext.files.keys()].sort(), [...compiledPrior.files.keys()].sort());
  const changed = [];
  for (const [name, body] of compiledNext.files) {
    assert.deepEqual(body, compiledSecond.files.get(name), `second compile ${name}`);
    if (!Buffer.from(body).equals(Buffer.from(compiledPrior.files.get(name)))) changed.push(name);
  }
  assert.deepEqual(changed.sort(), ['manifest.json', 'runtime.json', 'studio.json']);

  const conflictingTheme = structuredClone(next);
  conflictingTheme.themes.find((record) => key(record) === 'fpv@23').bindings['audio.music'] = {
    id: 'audio.music.field-kit',
    revision: 7,
  };
  assert.throws(
    () => validateThemeBundle(conflictingTheme, { previous: prior }),
    /Immutable themes history changed/,
  );
  const conflictingAsset = structuredClone(next);
  conflictingAsset.assets[0].description = 'A replacement of published immutable content.';
  assert.throws(
    () => validateThemeBundle(conflictingAsset, { previous: prior }),
    /Immutable assets history changed/,
  );
});

test('P03 retains the measured fpv25 source-stage checkpoint after published P02', async () => {
  const p02Oracle = JSON.parse(
    await fs.readFile(new URL('./fixtures/production-p02-v0581.json', import.meta.url), 'utf8'),
  );
  const stageOracle = JSON.parse(
    await fs.readFile(
      new URL('./fixtures/production-p03-source-fpv25.json', import.meta.url),
      'utf8',
    ),
  );
  const candidate = await importThemeBundle(
    new Blob([
      await fs.readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const published = await reconstructPinnedProduction(p02Oracle, candidate);
  const stage = await reconstructPinnedProduction(stageOracle, candidate);
  validateThemeBundle(stage.document, {
    previous: published.document,
    expectedRevision: p02Oracle.metadata.revision,
  });
  assert.equal(stage.document.revision, 25);
  assert.deepEqual(stage.document.selection.theme, { id: 'fpv', revision: 25 });
  assert.equal(stage.document.assets.length, 1096);
  assert.equal(stage.document.themes.length, 26);
  for (const [group, pin] of Object.entries(p02Oracle.groups))
    assert.deepEqual(
      stage.document[group].slice(0, pin.count),
      published.document[group],
      `retained P02 ${group}`,
    );
  assert.equal(stage.document.slots.length, published.document.slots.length);
  assert.equal(stage.document.collections.length, published.document.collections.length);

  const screens = [
    'missions',
    'hangar',
    'results',
    'collection',
    'settings',
    'couch',
    'studio',
  ].map((name) => `screen.${name}.background.field-kit@13`);
  const rotors = ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'].map(
    (name) => `player.${name}.rotors.field-kit@6`,
  );
  const key = (record) => `${record.id}@${record.revision}`;
  const appended = stage.document.assets.slice(p02Oracle.groups.assets.count);
  assert.deepEqual(appended.map(key).sort(), [...screens, ...rotors].sort());
  for (const asset of appended) {
    const screen = asset.id.startsWith('screen.');
    assert.equal(asset.quality.stage, 'source', asset.id);
    assert.deepEqual(asset.provenance.parent, {
      id: asset.id,
      revision: screen ? 12 : 5,
    });
    assert.ok(
      asset.provenance.source.endsWith(
        screen
          ? 'sha256:fde77f2222b0e6d021ff10af22f551532dd9139229b7871aaf584b40cfd1f44a'
          : 'sha256:39127024d6fb37fb50e42a4d3e1e7034b633be8e7e31225b638963a577e63554',
      ),
      asset.id,
    );
    assert.equal(asset.file, null, `${asset.id} does not replace an original payload`);
  }
  const theme = stage.document.themes.at(-1);
  assert.deepEqual(theme.parent, { id: 'fpv', revision: 24 });
  assert.deepEqual(Object.values(theme.bindings).map(key).sort(), [...screens, ...rotors].sort());
  assert.deepEqual(theme.tokens, {});
  assert.equal(stage.assets.size, 127);
  for (const [hash, before] of published.assets)
    assert.deepEqual(
      Buffer.from(await stage.assets.get(hash).arrayBuffer()),
      Buffer.from(await before.arrayBuffer()),
      `retained P02 payload ${hash}`,
    );
});

test('current P03 reproduction retains its measured source stage before any review successor', async () => {
  const oracle = JSON.parse(
    await fs.readFile(
      new URL('./fixtures/production-p03-source-fpv25.json', import.meta.url),
      'utf8',
    ),
  );
  const raw = await fs.readFile(
    new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
  );
  const candidate = await importThemeBundle(new Blob([raw]), { decodeImage: null });
  const stage = await reconstructPinnedProduction(oracle, candidate);
  const prior = candidate.document;
  const production = await createFieldKitProduction();
  // Match the CLI: reproduce against the complete existing ledger. Rebuilding
  // from P02 would flatten fpv25 and any later measured review successors.
  const next = retainFieldKitProductionHistory(production.document, prior);
  validateThemeBundle(next, { expectedRevision: prior.revision });
  assert.ok(next.revision >= stage.document.revision, 'the measured source stage is retained');
  assert.equal(canonicalJSON(next), canonicalJSON(candidate.document));
  for (const [group, pin] of Object.entries(oracle.groups))
    assert.deepEqual(
      next[group].slice(0, pin.count),
      stage.document[group],
      `retained source-stage ${group}`,
    );
  const mergedAssets = new Map([...candidate.assets, ...production.assets]);
  for (const [hash, before] of stage.assets)
    assert.deepEqual(
      Buffer.from(await mergedAssets.get(hash).arrayBuffer()),
      Buffer.from(await before.arrayBuffer()),
      `retained source-stage payload ${hash}`,
    );
  const second = retainFieldKitProductionHistory(production.document, next);
  assert.equal(canonicalJSON(second), canonicalJSON(next));
  const exported = Buffer.from(await (await exportThemeBundle(next, mergedAssets)).arrayBuffer());
  const repeated = Buffer.from(await (await exportThemeBundle(second, mergedAssets)).arrayBuffer());
  assert.deepEqual(exported, raw, 'current CLI ledger preserves the measured P03 history');
  assert.deepEqual(repeated, exported, 'second export identical');
});

test('Journey music review retains fpv33 source evidence and every earlier immutable record', async () => {
  const oracle = JSON.parse(
    await fs.readFile(
      new URL('./fixtures/production-journey-p02-source-fpv33.json', import.meta.url),
      'utf8',
    ),
  );
  const currentRaw = await fs.readFile(
    new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
  );
  const current = await importThemeBundle(new Blob([currentRaw]), { decodeImage: null });
  const stage = await reconstructPinnedProduction(oracle, current);
  const reviewedOracle = JSON.parse(
    await fs.readFile(
      new URL('./fixtures/production-journey-p05-fpv34.json', import.meta.url),
      'utf8',
    ),
  );
  const reviewed = await reconstructPinnedProduction(reviewedOracle, current);
  const before = resolvePresentation(stage.document),
    after = resolvePresentation(reviewed.document);
  assert.equal(stage.document.revision, 33);
  assert.equal(reviewed.document.revision, 34);
  for (const [slot, asset] of Object.entries(before.assets)) {
    if (!slot.startsWith('audio.')) {
      assert.deepEqual(after.assets[slot], asset, `Unchanged non-audio binding ${slot}`);
      continue;
    }
    assert.equal(asset.quality.stage, 'source');
    assert.equal(asset.revision, 8);
    assert.equal(after.assets[slot].quality.stage, 'reviewed');
    assert.equal(after.assets[slot].revision, 9);
    assert.deepEqual(after.assets[slot].provenance.parent, { id: asset.id, revision: 8 });
    assert.equal(after.assets[slot].provenance.source, asset.provenance.source);
    assert.deepEqual(after.assets[slot].recipe, asset.recipe);
    assert.equal(after.assets[slot].file, null);
  }
  assert.equal(reviewed.document.assets.length, stage.document.assets.length + 8);
  assert.equal(reviewed.document.themes.length, stage.document.themes.length + 1);
  assert.equal(reviewed.assets.size, stage.assets.size);
  const reproduced = retainFieldKitProductionHistory(
    (await createFieldKitProduction()).document,
    current.document,
  );
  assert.equal(canonicalJSON(reproduced), canonicalJSON(current.document));
});

function desired(
  description = 'First production recipe',
  quality = { stage: 'source', evidence: [] },
) {
  const document = createDefaultThemeBundle();
  const original = structuredClone(resolvePresentation(document).assets['ui.button.primary']);
  const asset = {
    ...original,
    id: 'ui.button.primary.field-kit',
    description,
    quality,
    provenance: {
      ...original.provenance,
      parent: { id: original.id, revision: original.revision },
    },
  };
  return reviseStudioTheme(document, {
    assets: [asset],
    bindings: { 'ui.button.primary': { id: asset.id, revision: asset.revision } },
  });
}

test('unchanged production preserves its exact document and appends changed revisions', () => {
  const first = desired();
  assert.deepEqual(retainProductionHistory(first, first), first);
  const changed = retainProductionHistory(desired('Updated production recipe'), first);
  validateThemeBundle(changed, { previous: first });
  const asset = resolvePresentation(changed).assets['ui.button.primary'];
  assert.equal(asset.revision, 2);
  assert.deepEqual(asset.provenance.parent, { id: asset.id, revision: 1 });
  assert.deepEqual(
    changed.assets.find((a) => a.id === asset.id && a.revision === 1),
    first.assets.at(-1),
  );
  assert.deepEqual(retainProductionHistory(desired('Updated production recipe'), changed), changed);
});

test('review evidence gets an immutable successor and normal reproduction keeps the review', () => {
  const first = desired();
  const reviewed = retainProductionHistory(
    desired(undefined, {
      stage: 'reviewed',
      evidence: ['Observed actual focus, pressed and disabled states.'],
    }),
    first,
  );
  assert.equal(resolvePresentation(reviewed).assets['ui.button.primary'].revision, 2);
  assert.equal(first.assets.at(-1).quality.stage, 'source');
  assert.deepEqual(retainProductionHistory(desired(), reviewed), reviewed);
  const changed = retainProductionHistory(desired('New drawing requiring a new review'), reviewed);
  assert.equal(resolvePresentation(changed).assets['ui.button.primary'].revision, 3);
  assert.equal(resolvePresentation(changed).assets['ui.button.primary'].quality.stage, 'source');
});

test('production refuses silent slot contract mutation and can explicitly return to an old revision', () => {
  const first = desired(),
    changed = retainProductionHistory(desired('Second recipe'), first);
  const reset = retainProductionHistory(first, changed);
  assert.equal(resolvePresentation(reset).assets['ui.button.primary'].revision, 1);
  assert.equal(reset.assets.length, changed.assets.length);
  const incompatible = structuredClone(first);
  incompatible.slots[0].required = false;
  assert.throws(
    () => retainProductionHistory(incompatible, first),
    /explicit compatible migration/,
  );
});

test('Journey feedback dependencies bind only the reviewed player-craft effects inputs', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const reviewPath = 'docs/verification/couch-craft-v01120/review.json';
  const reviewBytes = await fs.readFile(new URL(`../../${reviewPath}`, import.meta.url));
  const reviewHash = createHash('sha256').update(reviewBytes).digest('hex');
  const review = JSON.parse(reviewBytes);
  assert.equal(reviewHash, 'fa2120613abf06bc578ba8388ba33af415392583e19e83c2297638af8010c305');
  assert.equal(
    review.effects.priorFingerprintSHA256,
    '654fed2ce5b5e9b5e0c6bb79a6d7095093a4ed8128877b1a7f0658d830c275e7',
  );
  assert.equal(
    review.effects.currentFingerprintSHA256,
    'e23e228b4bf4ee68bb7cbbd231aaebe66d6e3da8965fbeae9b2c4acc90f9e053',
  );
  for (const slotId of [
    'trail.active',
    'trail.secured',
    'trail.head',
    'effect.capture',
    'effect.failure',
    'effect.victory',
    'effect.pickup',
    'effect.shield',
    'effect.respawn',
    'effect.pressure',
  ]) {
    const asset = resolved.assets[slotId];
    assert.equal(asset.quality.stage, 'reviewed', slotId);
    assert.ok(
      asset.provenance.source.endsWith(
        'sha256:b33868fdd4f6aa898a885043116b939509f4d5b14d4412adb7d71e6e90ed6bbe',
      ),
    );
    assert.match(asset.provenance.source, /game\/ui\/lane-presentation\.mjs/);
    assert.match(asset.provenance.source, /game\/content-design\/actor-marker\.mjs/);
    assert.match(asset.provenance.source, /game\/ui\/enemy-body-assets\.mjs/);
    assert.match(asset.provenance.source, /game\/ui\/enemy-body-motion\.mjs/);
    assert.equal(
      asset.quality.evidence.some((entry) =>
        entry.includes(`Scoped trail, impact and wreck continuation: ${reviewPath}`),
      ),
      true,
    );
  }
});

test('shared-host UI stays reviewed while a changed audio input reopens its review', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const uiReviewPath = 'docs/verification/actor-only-ui-continuation-2026-09-24/review.json';
  const uiReviewHash = createHash('sha256')
    .update(await fs.readFile(new URL(`../../${uiReviewPath}`, import.meta.url)))
    .digest('hex');
  const reviewed = production.document.slots.filter((slot) => ['ui', 'audio'].includes(slot.group));
  assert.equal(reviewed.length, 32);
  for (const slot of reviewed) {
    const asset = resolved.assets[slot.id];
    if (slot.group === 'ui') {
      assert.equal(asset.quality.stage, 'reviewed', slot.id);
      assert.ok(
        asset.provenance.source.endsWith(
          'sha256:c7ebea5695fe1fbd7c17eafdd0035dcd4d1651b5d3ec91893c6575334da38d3a',
        ),
        slot.id,
      );
      assert.match(asset.provenance.source, /game\/ui\/operation-status\.css/);
      assert.match(asset.provenance.source, /game\/ui\/operation-status\.mjs/);
      assert.match(asset.provenance.source, /game\/presentation\/dom-ownership\.mjs/);
      assert.match(asset.provenance.source, /game\/presentation\/team-runtime-slots\.mjs/);
      assert.equal(
        asset.quality.evidence.some(
          (entry) =>
            entry.includes('Scoped actor-only UI functional continuation') &&
            entry.includes(`${uiReviewPath} sha256:${uiReviewHash}`),
        ),
        true,
      );
    } else {
      assert.equal(asset.quality.stage, 'source', slot.id);
      assert.deepEqual(asset.quality.evidence, [
        'Connected runtime recipe; screen and state review remains required.',
      ]);
      assert.ok(
        asset.provenance.source.endsWith(
          'sha256:301e68a4898cf7d9140abee266195401a69cfca0db2301a12409ec252c882ec9',
        ),
        slot.id,
      );
      assert.match(asset.provenance.source, /game\/ui\/audio-master\.mjs/);
      assert.match(asset.provenance.source, /game\/ui\/soundtrack-panel\.css/);
      assert.match(asset.provenance.source, /game\/soundtrack-portable\.mjs/);
      assert.match(asset.provenance.source, /game\/content\/soundtrack-catalogue\.mjs/);
      assert.match(asset.provenance.source, /game\/online-soundtrack-catalogue\.mjs/);
    }
  }
});

test('soundtrack screen and Journey motion reviews bind only the inspected current inputs', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const screenReviewPath = 'docs/verification/ux2-v0115-screen-continuation/review.json';
  const screenReviewHash = createHash('sha256')
    .update(await fs.readFile(new URL(`../../${screenReviewPath}`, import.meta.url)))
    .digest('hex');
  assert.equal(
    screenReviewHash,
    'f0baff0c70c3bb3d3e08b92e8bfdb28c60e77913333640160841f58bc4c5c094',
  );
  const fingerprints = {
    screens: '251d09ba8aa8710a134694874bd7ae87f2e76af0000825f9ad2b97da024d1dbd',
    motion: '03a9b8a5eceb9eee63da578807becbb0f7770713d3eb2bd04affe5a75d3316f4',
  };
  const reviewed = production.document.slots.filter(
    (slot) => slot.group in fingerprints && resolved.assets[slot.id].kind === 'recipe',
  );
  assert.equal(reviewed.length, 14);
  for (const slot of reviewed) {
    const asset = resolved.assets[slot.id];
    assert.equal(asset.quality.stage, 'reviewed', slot.id);
    assert.ok(asset.provenance.source.endsWith(`sha256:${fingerprints[slot.group]}`), slot.id);
    assert.ok(
      asset.quality.evidence.some((entry) =>
        entry.includes(
          slot.group === 'motion'
            ? 'Scoped clean-craft motion continuation: docs/verification/couch-craft-v01120/review.json sha256:fa2120613abf06bc578ba8388ba33af415392583e19e83c2297638af8010c305'
            : `Scoped UX2 shared-screen continuation: ${screenReviewPath} sha256:${screenReviewHash}`,
        ),
      ),
      slot.id,
    );
  }
});

test('changed recipe inputs reopen only their own reviewed group', async (t) => {
  const production = await createFieldKitProduction();
  const prior = structuredClone(production.document);
  const reviewed = prior.slots.filter((slot) =>
    ['ui', 'audio', 'screens', 'motion'].includes(slot.group),
  );
  const selected = resolvePresentation(prior);
  // Review-state fixture only. Actual current approvals are asserted separately above.
  for (const slot of reviewed) {
    const ref = selected.assets[slot.id];
    const asset = prior.assets.find(
      (asset) => asset.id === ref.id && asset.revision === ref.revision,
    );
    if (asset.quality.stage !== 'reviewed')
      asset.quality = {
        stage: 'reviewed',
        evidence: ['Synthetic source-invalidation fixture; not production approval.'],
      };
  }
  const resolved = resolvePresentation(prior);
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'recipe-source-invalidation-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const recoveryInputs = [
    'soundtrack.mjs',
    'soundtrack-rights.mjs',
    'soundtrack-bundle.mjs',
    'soundtrack-share.mjs',
    'soundtrack-source.mjs',
    'soundtrack-albums.mjs',
    'soundtrack-portable.mjs',
    'content/soundtrack-catalogue.mjs',
    'online-soundtrack-catalogue.mjs',
    'ui/soundtrack-panel.mjs',
  ];
  const inputs = new Map([
    ['ui/operation-status.css', 'ui'],
    ['ui/operation-status.mjs', 'ui'],
    ['ui/soundtrack-player.mjs', 'audio'],
    ['ui/audio-master.mjs', 'audio'],
    ...recoveryInputs.map((input) => [input, 'audio']),
    ['ui/field-kit-surfaces.css', 'screens'],
    ['ui/actor-presentation.mjs', 'motion'],
  ]);
  // Game-relative keys cover both model and UI helpers. Only copied ordinary
  // fixture files may be changed; links to the real project are read-only inputs.
  await fs.mkdir(path.join(fixture, 'game', 'ui'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'game', 'content'), { recursive: true });
  for (const entry of ['authoring', 'site', 'scripts', 'docs'])
    await fs.symlink(path.join(root, entry), path.join(fixture, entry));
  for (const directory of ['', 'ui', 'content'])
    for (const entry of await fs.readdir(path.join(root, 'game', directory))) {
      if (!directory && ['ui', 'content'].includes(entry)) continue;
      const input = directory ? `${directory}/${entry}` : entry;
      const source = path.join(root, 'game', input);
      const target = path.join(fixture, 'game', input);
      if (inputs.has(input)) await fs.copyFile(source, target);
      else await fs.symlink(source, target);
    }
  for (const [input, group] of inputs) {
    const target = path.join(fixture, 'game', input);
    const stat = await fs.lstat(target);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Writable copy required: ${input}`);
    const original = await fs.readFile(target);
    try {
      await fs.appendFile(target, '\n/* Unreviewed fixture change. */\n');
      const changed = await createFieldKitProduction({ projectRoot: fixture });
      const next = retainFieldKitProductionHistory(changed.document, prior);
      validateThemeBundle(next, { previous: prior });
      const assets = resolvePresentation(next).assets;
      for (const slot of reviewed) {
        const affected = slot.group === group && assets[slot.id].kind === 'recipe';
        assert.equal(assets[slot.id].quality.stage, affected ? 'source' : 'reviewed', slot.id);
        if (affected) {
          assert.notEqual(
            assets[slot.id].provenance.source,
            resolved.assets[slot.id].provenance.source,
          );
          assert.equal(assets[slot.id].revision, resolved.assets[slot.id].revision + 1);
        } else assert.deepEqual(assets[slot.id], resolved.assets[slot.id]);
      }
      assert.deepEqual(next.assets.slice(0, prior.assets.length), prior.assets);
    } finally {
      await fs.writeFile(target, original);
      assert.deepEqual(await fs.readFile(path.join(root, 'game', input)), original);
    }
    if (recoveryInputs.includes(input)) {
      const retained = `${target}.missing-fixture`;
      await fs.rename(target, retained);
      try {
        await assert.rejects(
          createFieldKitProduction({ projectRoot: fixture }),
          (error) => error.code === 'ENOENT' && error.path === target,
          `Missing audio dependency must refuse production: ${input}`,
        );
      } finally {
        await fs.rename(retained, target);
      }
    }
  }
});

test('the whole production collection has capacity for immutable review successors', async () => {
  const prior = await importThemeBundle(
    new Blob([
      await fs.readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const production = await createFieldKitProduction();
  const proposed = structuredClone(production.document);
  const selected = resolvePresentation(proposed);
  // Capacity fixture only: it never writes or qualifies production artwork.
  for (const slot of proposed.slots.filter((entry) => entry.required)) {
    const selectedAsset = selected.assets[slot.id];
    const asset = proposed.assets.find(
      (entry) => entry.id === selectedAsset.id && entry.revision === selectedAsset.revision,
    );
    asset.quality = {
      stage: 'reviewed',
      evidence: ['Capacity fixture only; not production qualification. '.repeat(4)],
    };
  }
  const next = retainFieldKitProductionHistory(proposed, prior.document);
  validateThemeBundle(next, { previous: prior.document });
  assert.ok(next.assets.length > prior.document.assets.length);
  for (const old of prior.document.assets)
    assert.deepEqual(
      next.assets.find((entry) => entry.id === old.id && entry.revision === old.revision),
      old,
    );
  // An administrator must also be able to replace the complete reviewed set.
  const variation = structuredClone(next),
    variationResolved = resolvePresentation(next);
  for (const slot of variation.slots.filter((entry) => entry.required)) {
    const current = variationResolved.assets[slot.id];
    variation.assets.find(
      (entry) => entry.id === current.id && entry.revision === current.revision,
    ).description += ' / coordinated replacement capacity fixture';
  }
  const replaced = retainProductionHistory(variation, next);
  validateThemeBundle(replaced, { previous: next });
  assert.equal(
    replaced.assets.length,
    next.assets.length + proposed.slots.filter((s) => s.required).length,
  );
  for (const old of next.assets)
    assert.deepEqual(
      replaced.assets.find((entry) => entry.id === old.id && entry.revision === old.revision),
      old,
    );
  const bytes = new Map([...prior.assets, ...production.assets]);
  const replacementExport = await exportThemeBundle(replaced, bytes);
  const replacementImport = await importThemeBundle(replacementExport, { decodeImage: null });
  assert.deepEqual(replacementImport.document, replaced);

  const portable = await exportThemeBundle(next, bytes);
  const restored = await importThemeBundle(portable, { decodeImage: null });
  assert.deepEqual(restored.document, next);
  const adopted = adoptStudioBundle(next, restored.document);
  assert.deepEqual(
    adopted.assets,
    next.assets,
    'a complete native round trip reuses exact history',
  );
  assert.deepEqual(resolvePresentation(adopted).assets, resolvePresentation(next).assets);
  const reexport = await exportThemeBundle(adopted, restored.assets);
  assert.ok(
    reexport.size >= portable.size,
    'collection history is retained within existing bounds',
  );
});
