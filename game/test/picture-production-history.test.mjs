import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { decodePresentationDocument } from '../presentation/document-codec.mjs';
import { validateThemeBundle, resolvePresentation } from '../presentation/model.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import {
  PICTURE_PRODUCTION_MIGRATION,
  retainPictureProductionHistory,
} from '../../scripts/picture-production-history.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import { retainFieldKitProductionHistory } from '../../scripts/team-production-history.mjs';

const published = validateThemeBundle(
  decodePresentationDocument(
    await readFile(new URL('../presentation/compiled/studio.json', import.meta.url), 'utf8'),
  ),
);
const defaults = createDefaultThemeBundle();
const additions = PICTURE_PRODUCTION_MIGRATION.additions.slots.map(({ id }) => id);
function desiredCandidate() {
  const installed = structuredClone(published);
  installed.slots = structuredClone(defaults.slots);
  installed.assets.push(
    ...structuredClone(
      defaults.assets.filter((asset) => additions.some((id) => asset.id === `${id}.default`)),
    ),
  );
  return reviseStudioTheme(installed, {
    bindings: Object.fromEntries(additions.map((id) => [id, { id: `${id}.default`, revision: 1 }])),
  });
}

test('explicit picture migration preserves production104 history and repeats without adopting again', () => {
  const desired = desiredCandidate(),
    oldBytes = canonicalJSON(published),
    desiredBytes = canonicalJSON(desired);
  const next = retainPictureProductionHistory(desired, published);
  assert.equal(published.revision, 104);
  assert.equal(published.slots.length, 335);
  assert.equal(next.revision, 105);
  assert.equal(next.slots.length, 389);
  validateThemeBundle(next, { previous: published, expectedRevision: 104 });
  for (const key of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(next[key].slice(0, published[key].length), published[key]);
  const before = resolvePresentation(published),
    after = resolvePresentation(next);
  for (const id of Object.keys(before.assets))
    assert.deepEqual(after.assets[id], before.assets[id], id);
  for (const id of additions) {
    assert.equal(after.assets[id].quality.stage, 'source');
    assert.deepEqual(after.assets[id].quality.evidence, []);
    assert.equal(next.slots.find((slot) => slot.id === id).owner.themeId, 'retro');
  }
  assert.equal(canonicalJSON(published), oldBytes);
  assert.equal(canonicalJSON(desired), desiredBytes);
  assert.equal(canonicalJSON(retainPictureProductionHistory(desired, next)), canonicalJSON(next));
});

test('generic and historical Team writers do not implicitly admit picture migration', () => {
  const desired = desiredCandidate();
  assert.throws(() => retainProductionHistory(desired, published), /explicit compatible migration/);
  assert.throws(
    () => retainFieldKitProductionHistory(desired, published),
    /exact additive Team slot contract/,
  );
  assert.throws(() => retainPictureProductionHistory(desired), /published predecessor/);
});

test('migration rejects changed owners, altered contracts, extra and incomplete slots', () => {
  const mutations = [
    (draft) => {
      draft.slots.find((slot) => slot.id === additions[0]).owner.levelRevision += '-other';
    },
    (draft) => {
      draft.slots.find((slot) => slot.id === additions[0]).label += ' changed';
    },
    (draft) => {
      draft.slots.find((slot) => slot.id === 'ui.panel').label += ' changed';
    },
    (draft) => {
      const slot = structuredClone(draft.slots.find((entry) => entry.id === additions[0]));
      slot.id = 'picture.retro.unregistered';
      draft.slots.push(slot);
    },
    (draft) => {
      draft.slots = draft.slots.filter((slot) => slot.id !== additions[0]);
      for (const theme of draft.themes) delete theme.bindings[additions[0]];
    },
  ];
  for (const mutate of mutations) {
    const draft = structuredClone(desiredCandidate());
    mutate(draft);
    validateThemeBundle(draft);
    assert.throws(
      () => retainPictureProductionHistory(draft, published),
      /Picture production migration/,
    );
  }
});

test('retained approval evidence and installed defaults cannot become a rewritten predecessor', () => {
  const prior = structuredClone(published);
  prior.assets[0].quality.evidence.push('unapproved retained evidence');
  validateThemeBundle(prior);
  assert.throws(
    () => retainPictureProductionHistory(desiredCandidate(), prior),
    /published assets prefix changed/,
  );
  const desired = desiredCandidate(),
    installed = structuredClone(retainPictureProductionHistory(desired, published));
  installed.assets.find((asset) => asset.id === `${additions[0]}.default`).description +=
    ' replaced';
  validateThemeBundle(installed);
  assert.throws(
    () => retainPictureProductionHistory(desired, installed),
    /default revision conflict/,
  );
});

test('slot compatibility cannot award new-picture approval, including inherited reviewed candidates', () => {
  const desired = structuredClone(desiredCandidate());
  desired.assets.find((asset) => asset.id === `${additions[0]}.default`).quality = {
    stage: 'reviewed',
    evidence: ['not an authorized review'],
  };
  validateThemeBundle(desired);
  assert.throws(
    () => retainPictureProductionHistory(desired, published),
    /cannot approve new picture artwork/,
  );
  const candidate = retainPictureProductionHistory(desiredCandidate(), published),
    original = resolvePresentation(candidate).assets[additions[0]];
  const reviewed = {
    ...structuredClone(original),
    revision: original.revision + 1,
    provenance: {
      ...original.provenance,
      parent: { id: original.id, revision: original.revision },
    },
    quality: { stage: 'reviewed', evidence: ['outside this candidate migration'] },
  };
  const inherited = reviseStudioTheme(candidate, {
    assets: [reviewed],
    bindings: { [additions[0]]: { id: reviewed.id, revision: reviewed.revision } },
  });
  assert.throws(
    () => retainPictureProductionHistory(desiredCandidate(), inherited),
    /cannot inherit an unapproved reviewed status/,
  );
});

test('portable candidate retains every published payload and immutable record', async () => {
  const retained = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  assert.equal(canonicalJSON(retained.document), canonicalJSON(published));
  const next = retainPictureProductionHistory(desiredCandidate(), retained.document),
    exported = await exportThemeBundle(next, retained.assets),
    imported = await importThemeBundle(exported, { decodeImage: null });
  assert.equal(canonicalJSON(imported.document), canonicalJSON(next));
  assert.equal(imported.assets.size, retained.assets.size);
  for (const [hash, body] of retained.assets)
    assert.ok(
      Buffer.from(await body.arrayBuffer()).equals(
        Buffer.from(await imported.assets.get(hash).arrayBuffer()),
      ),
      hash,
    );
});
