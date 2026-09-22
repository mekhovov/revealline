import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { validateThemeBundle, resolvePresentation } from '../presentation/model.mjs';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { createFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';
import { retainFieldKitProductionHistory } from '../../scripts/team-production-history.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import { TEAM_EQUIPMENT_IDS } from '../presentation/team-equipment-art.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const oracle = JSON.parse(
  await readFile(new URL('./fixtures/production-main-reconciliation.json', import.meta.url)),
);

async function readCurrentProduction() {
  const raw = await readFile(
    new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
  );
  return importThemeBundle(new Blob([raw]), { decodeImage: null });
}

// Authenticate the pre-Team checkpoint independently of the current selection.
// Later Team editions must retain these exact records and original payloads.
async function reconstructPreTeam(current) {
  const pin = oracle.canonical;
  assert.equal(pin.revision, 57);
  const source = {
    format: 'revealline-theme-bundle.v1',
    id: 'field-kit',
    revision: pin.revision,
    selection: {
      base: { id: 'base', revision: 1 },
      collection: null,
      theme: { id: 'fpv', revision: pin.revision },
    },
  };
  for (const group of ['slots', 'assets', 'themes', 'collections']) {
    const expected = oracle.shared[group] ?? pin[group];
    source[group] = current.document[group].slice(0, expected.count);
    assert.equal(source[group].length, expected.count, group);
    assert.equal(sha(canonicalJSON(source[group])), expected.sha256, group);
  }
  const document = validateThemeBundle(source);
  assert.equal(document.slots.length, 293);
  const assets = new Map();
  for (const asset of document.assets) {
    if (!asset.file || assets.has(asset.file.sha256)) continue;
    const blob = current.assets.get(asset.file.sha256);
    assert.ok(blob, asset.file.sha256);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(bytes.length, asset.file.bytes);
    assert.equal(sha(bytes), asset.file.sha256);
    assets.set(asset.file.sha256, blob);
  }
  assert.equal(assets.size, 127);
  const raw = Buffer.from(await (await exportThemeBundle(document, assets)).arrayBuffer());
  assert.equal(raw.length, pin.bytes);
  assert.equal(sha(raw), pin.sha256, 'complete canonical pre-Team57 bundle');
  return { document, assets };
}

test('explicit Team migration retains the complete canonical57 ledger and repeats byte-for-byte', async () => {
  const prior = await reconstructPreTeam(await readCurrentProduction());
  const original = canonicalJSON(prior.document);
  const production = await createFieldKitProduction();
  const desired = canonicalJSON(production.document);
  assert.throws(() => retainProductionHistory(production.document, prior.document), /migration/);
  const next = retainFieldKitProductionHistory(production.document, prior.document);
  validateThemeBundle(next, { previous: prior.document, expectedRevision: 57 });
  assert.equal(next.revision, 58);
  assert.equal(next.slots.length, 335);
  for (const group of ['slots', 'assets', 'themes', 'collections'])
    assert.equal(
      canonicalJSON(next[group].slice(0, prior.document[group].length)),
      canonicalJSON(prior.document[group]),
      `immutable ${group}`,
    );
  assert.equal(canonicalJSON(prior.document), original);
  assert.equal(canonicalJSON(production.document), desired);
  const resolved = resolvePresentation(next);
  for (const slot of next.slots.filter((slot) => slot.id.startsWith('team.')))
    assert.equal(
      resolved.assets[slot.id].quality.stage,
      TEAM_EQUIPMENT_IDS.includes(slot.id) ? 'reviewed' : 'source',
      slot.id,
    );
  const repeated = retainFieldKitProductionHistory(production.document, next);
  assert.equal(canonicalJSON(repeated), canonicalJSON(next));
  const assets = new Map([...prior.assets, ...production.assets]);
  const bytes = Buffer.from(await (await exportThemeBundle(next, assets)).arrayBuffer());
  const roundTrip = await importThemeBundle(new Blob([bytes]), { decodeImage: null });
  assert.equal(canonicalJSON(roundTrip.document), canonicalJSON(next));
  for (const [hash, body] of prior.assets)
    assert.ok(
      Buffer.from(await roundTrip.assets.get(hash).arrayBuffer()).equals(
        Buffer.from(await body.arrayBuffer()),
      ),
      `original payload ${hash}`,
    );
  const again = Buffer.from(await (await exportThemeBundle(repeated, assets)).arrayBuffer());
  assert.ok(bytes.equals(again));
});

test('Team migration rejects altered existing contracts, unrelated additions and incomplete role sets', async () => {
  const prior = await reconstructPreTeam(await readCurrentProduction());
  const { document: desired } = await createFieldKitProduction();
  const before = canonicalJSON(prior.document);
  const cases = [
    (draft) => {
      draft.slots.find((slot) => slot.id === 'ui.panel').label += ' changed';
    },
    (draft) => {
      draft.slots.find((slot) => slot.id === 'team.support.pulse').label += ' changed';
    },
    (draft) => {
      const extra = structuredClone(draft.slots.find((slot) => slot.id === 'team.support.pulse'));
      extra.id = 'team.unregistered';
      draft.slots.push(extra);
    },
  ];
  for (const mutate of cases) {
    const bad = structuredClone(desired);
    mutate(bad);
    assert.throws(() => retainFieldKitProductionHistory(bad, prior.document), /migration/);
    assert.equal(canonicalJSON(prior.document), before);
  }
  const partial = structuredClone(desired);
  partial.slots = partial.slots.filter((slot) => slot.id !== 'team.capture.joint');
  for (const theme of partial.themes) delete theme.bindings['team.capture.joint'];
  assert.throws(() => retainFieldKitProductionHistory(partial, prior.document), /migration/);
  assert.equal(canonicalJSON(prior.document), before);
});

test('current-ledger Team reproduction retains its prefix and is a no-op after migration', async () => {
  const current = await readCurrentProduction();
  const before = canonicalJSON(current.document);
  const production = await createFieldKitProduction();
  const next = retainFieldKitProductionHistory(production.document, current.document);
  for (const group of ['slots', 'assets', 'themes', 'collections'])
    assert.equal(
      canonicalJSON(next[group].slice(0, current.document[group].length)),
      canonicalJSON(current.document[group]),
      `current immutable ${group}`,
    );
  assert.equal(canonicalJSON(current.document), before);
  assert.equal(next.slots.length, 335);
  const priorAssets = resolvePresentation(current.document).assets;
  const nextAssets = resolvePresentation(next).assets;
  for (const slot of TEAM_EQUIPMENT_IDS) {
    const prior = priorAssets[slot],
      accepted = nextAssets[slot];
    assert.equal(accepted.quality.stage, 'reviewed', slot);
    assert.equal(accepted.file.sha256, prior.file.sha256, 'Review preserves original bytes.');
    assert.deepEqual(accepted.geometry, prior.geometry);
    if (prior.quality.stage === 'produced') {
      assert.equal(accepted.id, prior.id);
      assert.equal(accepted.revision, prior.revision + 1, 'Review adds an immutable successor.');
      assert.deepEqual(
        next.assets.find((asset) => asset.id === prior.id && asset.revision === prior.revision),
        prior,
        'The produced ancestor retains its original quality evidence.',
      );
    }
  }
  const repeated = retainFieldKitProductionHistory(production.document, next);
  assert.equal(canonicalJSON(repeated), canonicalJSON(next));
  // The generic writer accepts the already-installed contract; it still must
  // reject the independently pinned pre-Team contract in the migration test.
  const aligned = { ...production.document, slots: next.slots };
  assert.equal(canonicalJSON(retainProductionHistory(aligned, next)), canonicalJSON(next));
  const assets = new Map([...current.assets, ...production.assets]);
  const bytes = Buffer.from(await (await exportThemeBundle(next, assets)).arrayBuffer());
  const again = Buffer.from(await (await exportThemeBundle(repeated, assets)).arrayBuffer());
  assert.ok(bytes.equals(again));
  const restoredPrior = await reconstructPreTeam({ document: next, assets });
  assert.equal(restoredPrior.document.revision, 57);
});
