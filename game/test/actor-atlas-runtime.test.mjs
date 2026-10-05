// Regression source only: execution remains waived by repository policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { decodePresentationDocument } from '../presentation/document-codec.mjs';
import { adoptStudioBundle } from '../presentation/studio-session.mjs';
import {
  validateThemeBundle,
  validateAssetRevision,
  resolvePresentation,
} from '../presentation/model.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import {
  nativeActorAnimationClip,
  createActorPresentation,
  drawPresentedActor,
} from '../ui/actor-presentation.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { createCoop, startCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { actorAtlasSamplePixels } from '../../scripts/produce-actor-atlas-sample.mjs';
import { pixelArtForSlot } from '../presentation/pixel-art.mjs';

const sampleURL = new URL(
  '../../authoring/industrial-art-review/atlas-sample/industrial-bouncer.rltheme',
  import.meta.url,
);
const actor = Object.freeze({
  id: 'pressure',
  type: 'bouncer',
  x: 4,
  y: 4,
  vx: 2,
  vy: 0,
  radius: 0.2,
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('atlas transport keeps the original dependency, preserves immutable revisions and rejects changed pixels', async () => {
  const bytes = await readFile(sampleURL),
    imported = await importThemeBundle(new Blob([bytes]), { decodeImage: null }),
    image = resolvePresentation(imported.document).assets['enemy.bouncer'];
  assert.equal(image.format, 'revealline-asset-revision.v2');
  assert.equal(image.animation.frames.length, 12);
  assert.equal(imported.assets.size, 2);
  const parent = imported.document.assets.find(
    (row) =>
      row.id === image.provenance.parent.id && row.revision === image.provenance.parent.revision,
  );
  assert.ok(imported.assets.has(parent.file.sha256));
  const before = validateThemeBundle(
      decodePresentationDocument(
        await readFile(new URL('../presentation/compiled/studio.json', import.meta.url), 'utf8'),
      ),
    ),
    adopted = adoptStudioBundle(before, imported.document);
  assert.ok(
    imported.document.slots.every(({ id }) => before.slots.some((slot) => slot.id === id)),
    'The sample cannot introduce unreleased source-registry picture slots.',
  );
  for (const asset of before.assets)
    assert.deepEqual(
      adopted.assets.find((row) => row.id === asset.id && row.revision === asset.revision),
      asset,
    );
  const bytesAgain = Buffer.from(
    await (await exportThemeBundle(imported.document, imported.assets)).arrayBuffer(),
  );
  assert.deepEqual(bytesAgain, bytes);
  const changed = new Uint8Array(bytes);
  changed[changed.length - 1] ^= 1;
  await assert.rejects(importThemeBundle(new Blob([changed]), { decodeImage: null }), /hash/);
  const missingParent = structuredClone(imported.document);
  missingParent.assets = missingParent.assets.filter((row) => row.id !== parent.id);
  assert.throws(() => validateThemeBundle(missingParent), /parent/);
  const escaped = structuredClone(image);
  escaped.animation.frames[1].region.x = image.file.width;
  assert.throws(() => validateAssetRevision(escaped), /escaped/);
});

test('all twelve sample poses are original distinct transparent frames without changing the source', () => {
  const { atlas, source, frames } = actorAtlasSamplePixels();
  assert.deepEqual(source, pixelArtForSlot('enemy.bouncer'));
  const identities = new Set();
  for (const { region } of frames) {
    const bytes = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
      const start = ((region.y + y) * atlas.width + region.x) * 4;
      bytes.set(atlas.rgba.subarray(start, start + 128), y * 128);
    }
    identities.add(hash(bytes));
    for (let at = 3; at < bytes.length; at += 4) {
      assert.ok(bytes[at] === 0 || bytes[at] === 255);
      assert.equal(bytes[at], source.rgba[at], 'Every pose keeps the source silhouette and alpha.');
    }
  }
  assert.equal(identities.size, 12);
});

test('native pressure transitions restart clip clocks; pause/freeze hold and rendering stays pure', async () => {
  const imported = await importThemeBundle(new Blob([await readFile(sampleURL)]), {
      decodeImage: null,
    }),
    geometry = imagePresentation(resolvePresentation(imported.document).assets['enemy.bouncer']),
    sampler = createActorPresentation();
  const sample = (phase, extra = {}) =>
    sampler
      .sample([actor], {
        tick: 1,
        time: 0.1,
        dt: 0.1,
        classic: { enemies: [{ id: actor.id, pressure: { phase }, ...extra }] },
      })
      .get(actor.id);
  const waiting = sample('warning');
  assert.equal(waiting.animationState, 'anticipation');
  assert.equal(waiting.animationTimeMs, 0);
  sample('warning');
  const held = sample('warning', { frozen: true });
  assert.equal(held.animationTimeMs, 100);
  const paused = sampler
    .sample([actor], {
      paused: true,
      dt: 0.1,
      classic: { enemies: [{ id: actor.id, pressure: { phase: 'warning' } }] },
    })
    .get(actor.id);
  assert.equal(paused.animationTimeMs, held.animationTimeMs);
  assert.equal(sample('committed').animationTimeMs, 0);
  const recovery = sample('cooldown');
  assert.equal(recovery.animationState, 'recovery');
  assert.equal(recovery.animationTimeMs, 0);
  const calls = [],
    ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) => {
            if (key === 'drawImage') calls.push(args);
          },
        set: () => true,
      },
    ),
    pixels = { width: 128, height: 96 },
    frozen = structuredClone(recovery);
  drawPresentedActor(ctx, recovery, { muted: '#888888', accent: '#ffffff' }, pixels, geometry);
  assert.deepEqual(
    calls[0].slice(1, 5),
    [32, 64, 32, 32],
    'Recovery samples its own admitted atlas region.',
  );
  assert.deepEqual(recovery, frozen);
});

test('registered native tells map narrowly and do not invent firing or caught events', () => {
  assert.equal(nativeActorAnimationClip({ type: 'claimed-rover' }, { mode: 'dormant' }, 2), 'idle');
  assert.equal(
    nativeActorAnimationClip({ type: 'claimed-rover' }, { mode: 'warning' }),
    'anticipation',
  );
  assert.equal(nativeActorAnimationClip({ type: 'eroder' }, { mode: 'warning' }), 'anticipation');
  assert.equal(nativeActorAnimationClip({ type: 'contour-patrol' }, { mode: 'idle' }), 'blocked');
  assert.equal(nativeActorAnimationClip(actor, { mode: 'fire', phase: 'caught' }, 2), 'move');
});

test('Team adapter projects hunter warning, commitment and recovery without altering native state', () => {
  const run = createCoop(FIRST_CONNECTION),
    adapter = createCoopActorPresentation();
  startCoop(run);
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  assert.ok(hunter);
  for (const [phase, expected] of [
    ['warning', 'anticipation'],
    ['commit', 'move'],
    ['recovery', 'recovery'],
  ]) {
    hunter.phase = phase;
    const before = structuredClone(run);
    adapter.update(run);
    assert.equal(adapter.frame('enemy', hunter.id).animationState, expected);
    assert.deepEqual(run, before);
  }
});
