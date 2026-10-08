import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { replaceStudioCollection } from '../presentation/studio-session.mjs';
import {
  DESTRUCTION_AUDIO_SLOTS,
  addDestructionAudioSlots,
  needsDestructionAudioSlots,
} from '../presentation/destruction-audio-upgrade.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';

function historical() {
  const previous = structuredClone(createDefaultThemeBundle());
  previous.slots = previous.slots.filter((slot) => !DESTRUCTION_AUDIO_SLOTS.includes(slot.id));
  previous.assets = previous.assets.filter(
    (asset) => !DESTRUCTION_AUDIO_SLOTS.some((slot) => asset.id === `${slot}.default`),
  );
  for (const theme of previous.themes)
    for (const id of DESTRUCTION_AUDIO_SLOTS) delete theme.bindings[id];
  return validateThemeBundle(previous);
}

test('destruction admission appends one undoable revision and preserves every existing selected appearance', () => {
  const old = historical(),
    binding = resolvePresentation(old).bindings['audio.capture'],
    selected = replaceStudioCollection(old, {
      id: 'custom-audio',
      name: 'Custom collection',
      requiredSlots: ['audio.capture'],
      bindings: { 'audio.capture': binding },
    }),
    before = structuredClone(selected),
    next = addDestructionAudioSlots(selected);
  assert.equal(needsDestructionAudioSlots(selected), true);
  assert.equal(needsDestructionAudioSlots(next), false);
  assert.equal(next.revision, selected.revision + 1);
  assert.deepEqual(selected, before);
  for (const kind of ['slots', 'assets', 'themes', 'collections'])
    for (const original of selected[kind])
      assert.deepEqual(
        next[kind].find((item) => item.id === original.id && item.revision === original.revision),
        original,
      );
  const prior = resolvePresentation(selected),
    current = resolvePresentation(next);
  for (const [slot, asset] of Object.entries(prior.assets))
    assert.deepEqual(current.assets[slot], asset);
  for (const slot of DESTRUCTION_AUDIO_SLOTS) {
    assert.equal(current.assets[slot].kind, 'recipe');
    assert.ok(next.slots.find((item) => item.id === slot).kinds.includes('audio'));
  }
  assert.throws(() => addDestructionAudioSlots(next), /already available/);
  const pinned = structuredClone(next);
  pinned.selection = structuredClone(selected.selection);
  assert.equal(resolvePresentation(pinned).assets['audio.destroy-soft'], undefined);
});

test('partially admitted custom destruction audio and original bytes survive admission and package round-trip', async () => {
  const previous = structuredClone(historical()),
    defaults = createDefaultThemeBundle(),
    id = 'audio.destroy-soft',
    bytes = new Uint8Array(44);
  bytes.set(new TextEncoder().encode('RIFF'));
  bytes.set(new TextEncoder().encode('WAVE'), 8);
  new DataView(bytes.buffer).setUint32(4, 36, true);
  const hash = await hashPresentationBytes(bytes),
    blob = new Blob([bytes], { type: 'audio/wav' }),
    custom = {
      ...structuredClone(defaults.assets.find((asset) => asset.id === `${id}.default`)),
      id: 'custom-infantry-sound',
      kind: 'audio',
      recipe: null,
      description: 'Existing creator recording',
      file: { sha256: hash, bytes: bytes.length, mime: 'audio/wav', width: null, height: null },
    };
  previous.slots.push(structuredClone(defaults.slots.find((slot) => slot.id === id)));
  previous.assets.push(custom);
  previous.themes.at(-1).bindings[id] = { id: custom.id, revision: custom.revision };
  const accepted = validateThemeBundle(previous),
    next = addDestructionAudioSlots(accepted);
  assert.deepEqual(resolvePresentation(next).assets[id], custom);
  const packed = await exportThemeBundle(next, new Map([[hash, blob]])),
    restored = await importThemeBundle(packed);
  assert.deepEqual(restored.document, next);
  assert.deepEqual(new Uint8Array(await restored.assets.get(hash).arrayBuffer()), bytes);
  assert.equal(restored.assets.size, 1);
  assert.equal(needsDestructionAudioSlots(restored.document), false);
});
