import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BoardPainter } from '../ui/render.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop } from '../coop/core.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import {
  prepareIndustrialEnvironmentSource,
  resolveIndustrialEnvironment,
} from '../presentation/industrial-environments.mjs';
import { acceptAttemptAppearance } from '../presentation/attempt-appearance.mjs';
import { industrialMaterialPixels } from '../presentation/industrial-materials.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';

const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);
const palette = Object.fromEntries(
  ['ink', 'paper', 'muted', 'accent', 'safe', 'danger', 'field', 'grid', 'sky', 'land'].map(
    (key) => [key, '#667788'],
  ),
);
const selection = {
  artRevision: 'industrial-roster-v3',
  collection: { id: 'military-field', revision: 'r1' },
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function source(mode) {
  const project = createPursuitCampaignCandidates({ team: mode === 'team' });
  const entry =
    mode === 'team'
      ? createCandidateTeamHost(project, {
          corePackIds: project.packs.map((pack) => pack.id),
        }).rows.find((row) => row.difficulty === 'standard')
      : createContentExecutionCatalog(project, { mode }).entries.find(
          (row) => row.difficulty === 'standard',
        );
  const level = mode === 'team' ? entry.level : entry.campaign.levels[0];
  const candidate = await prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode,
    source: level,
    origin: {
      kind: 'builtin',
      catalogueId: project.id,
      catalogueRevision: project.revision,
      sourceForm: `compiled-native-v1:${project.policyId}:${entry.difficulty}`,
    },
  });
  assert.ok(candidate);
  return { level, appearance: acceptAttemptAppearance(candidate, selection) };
}
function surfaces(t) {
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const owned = [],
    drawn = [];
  const createCanvas = () => {
    const canvas = { width: 16, height: 16, pixels: null };
    canvas.getContext = () => ({
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4) }),
      putImageData: ({ data }) => {
        canvas.pixels = new Uint8ClampedArray(data);
      },
    });
    owned.push(canvas);
    return canvas;
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tag) => {
        assert.equal(tag, 'canvas');
        return createCanvas();
      },
    },
  });
  t.after(() => {
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore);
    else delete globalThis.document;
  });
  // Native terrain generation executes; this finite Canvas boundary records
  // pixels and image use, not browser contrast or device performance.
  const context = new Proxy(
    {},
    {
      get(target, name) {
        if (name in target) return target[name];
        if (name === 'measureText') return (text) => ({ width: String(text).length * 7 });
        if (name === 'drawImage') return (image) => drawn.push(image);
        return () => {};
      },
      set(target, name, value) {
        target[name] = value;
        return true;
      },
    },
  );
  return {
    owned,
    drawn,
    canvas: { width: 1152, height: 576, clientWidth: 1152, getContext: () => context },
  };
}
function presentation(custom = false) {
  const frames = new Map();
  return {
    resolved: {
      ...compiled.resolved,
      assets: { 'terrain.wall': compiled.resolved.assets['terrain.wall'] },
    },
    canvas: { palette, motionScale: 0 },
    fonts: { ui: 'sans-serif', numeric: 'monospace' },
    image(slot) {
      if (frames.has(slot)) return frames.get(slot);
      const base = compiled.resolved.assets[slot];
      if (base?.kind !== 'image') return null;
      const asset =
        custom && slot.startsWith('terrain.')
          ? { ...base, file: { ...base.file, sha256: 'a'.repeat(64) } }
          : base;
      const frame = {
        image: { width: asset.file.width, height: asset.file.height },
        asset,
        geometry: imagePresentation(asset),
      };
      frames.set(slot, frame);
      return frame;
    },
  };
}
function assertMaterialPixels(frame, original, appearance, slot = 'terrain.wall') {
  const definition = resolveIndustrialEnvironment(appearance.environmentPin),
    binding = definition.arcade[slot];
  assert.notEqual(
    frame.image,
    original.image,
    'The native adapter must actually replace the approved built-in terrain image.',
  );
  const expected = industrialMaterialPixels(
    {
      width: frame.image.width,
      height: frame.image.height,
      rgba: new Uint8ClampedArray(frame.image.width * frame.image.height * 4),
    },
    binding.material,
    { revision: definition.materialRevision, variant: binding.variant },
  );
  assert.equal(hash(frame.image.pixels), hash(expected.rgba));
}
for (const mode of ['solo', 'versus'])
  test(`${mode} shared Capture painter produces accepted chapter pixels and preserves custom/historical art`, async (t) => {
    const surface = surfaces(t),
      { appearance } = await source(mode),
      painter = new BoardPainter({}),
      base = presentation();
    t.after(() => painter.dispose());
    painter.setPresentation(base);
    painter.setAttemptAppearance(appearance);
    const frame = painter.artSnapshot.image('terrain.wall');
    assertMaterialPixels(frame, base.image('terrain.wall'), appearance);
    for (const slot of ['terrain.slow', 'terrain.lethal'])
      assertMaterialPixels(painter.artSnapshot.image(slot), base.image(slot), appearance, slot);
    const count = surface.owned.length;
    painter.setAttemptAppearance(appearance);
    assert.equal(painter.artSnapshot.image('terrain.wall'), frame);
    assert.equal(surface.owned.length, count);
    const custom = presentation(true);
    painter.setPresentation(custom);
    assert.equal(painter.artSnapshot.image('terrain.wall'), custom.image('terrain.wall'));
    painter.setPresentation(base);
    painter.setAttemptAppearance(null);
    assert.equal(painter.artSnapshot, base);
    assert.equal(base.image('terrain.wall').image.width, 16);
  });
test('Team and reconstructed room board views paint the accepted chapter pixels without changing native state', async (t) => {
  const surface = surfaces(t),
    { appearance, level } = await source('team'),
    run = createCoop(level),
    before = structuredClone(run),
    painter = createCoopPainter(surface.canvas),
    base = presentation();
  t.after(() => painter.dispose());
  painter.setPresentation(base);
  for (const view of [run, structuredClone(run)]) {
    painter.setAttemptAppearance(view, appearance);
    painter.paint(view, { reduced: true });
    const frame = painter.artSnapshot.image('terrain.wall');
    assertMaterialPixels(frame, base.image('terrain.wall'), appearance);
    for (const slot of ['terrain.slow', 'terrain.lethal'])
      assertMaterialPixels(painter.artSnapshot.image(slot), base.image(slot), appearance, slot);
    assert.ok(
      surface.drawn.includes(frame.image),
      'The native paint transaction uses the chapter wall image.',
    );
    const count = surface.owned.length;
    painter.setAttemptAppearance(view, appearance);
    painter.paint(view, { reduced: true });
    assert.equal(surface.owned.length, count);
    assert.deepEqual(view, before);
  }
  const custom = presentation(true);
  painter.setPresentation(custom);
  painter.paint(run, { reduced: true });
  assert.equal(painter.artSnapshot.image('terrain.wall'), custom.image('terrain.wall'));
  painter.setPresentation(base);
  painter.setAttemptAppearance(run, null);
  painter.paint(run, { reduced: true });
  assert.equal(painter.artSnapshot, base);
});
