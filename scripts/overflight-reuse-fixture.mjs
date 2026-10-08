import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { FORMATS, validateThemeBundle } from '../game/presentation/model.mjs';
import { hashPresentationBytes } from '../game/presentation/bundle.mjs';
import { compilePresentation } from './compile-presentation.mjs';
const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const OVERFLIGHT_SLOT = 'pickup.supply-case-closed',
  SOLO_SLOT = 'pickup.supply';
export async function createOverflightReuseFixture() {
  const manifest = await readJSON('../authoring/library/overflight-field-kit-v1/manifest.json');
  const record = manifest.assets.find((asset) => asset.slotId === OVERFLIGHT_SLOT);
  const bytes = new Uint8Array(
    await readFile(
      new URL(`../authoring/library/overflight-field-kit-v1/${record.file}`, import.meta.url),
    ),
  );
  assert.equal(await hashPresentationBytes(bytes), record.sha256);
  assert.equal(bytes.length, record.bytes);
  const original = createDefaultThemeBundle(),
    before = structuredClone(original),
    document = structuredClone(original),
    slot = document.slots.find((entry) => entry.id === SOLO_SLOT);
  const asset = {
    format: FORMATS.asset,
    id: 'overflight.field-kit.supply-case',
    revision: record.slotRevision,
    kind: 'image',
    description: 'The generated Overflight supply case reused by the existing Solo supply slot.',
    provenance: {
      creator: 'RevealLine',
      source: `authoring/library/overflight-field-kit-v1/${record.file}`,
      license: 'Project-original artwork',
      prompt: record.provenance,
      parent: null,
    },
    file: {
      sha256: record.sha256,
      bytes: record.bytes,
      mime: 'image/png',
      width: record.width,
      height: record.height,
    },
    geometry: structuredClone(slot.geometry),
    recipe: null,
    quality: { stage: 'produced', evidence: [] },
  };
  document.assets.push(asset);
  const theme = document.themes[1];
  for (const id of [OVERFLIGHT_SLOT, SOLO_SLOT])
    theme.bindings[id] = { id: asset.id, revision: asset.revision };
  validateThemeBundle(document);
  const compiled = await compilePresentation(
    document,
    new Map([[record.sha256, new Blob([bytes], { type: 'image/png' })]]),
    { themeId: theme.id },
  );
  assert.deepEqual(original, before, 'The original registered bundle stays unchanged.');
  return { asset, bytes, document, compiled, themeId: theme.id };
}
