import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OVERFLIGHT_CHARACTERS,
  OVERFLIGHT_CHARACTER_IMAGE_SLOTS,
  prepareOverflightCharacters,
  resolveOverflightCharacter,
} from '../overflight/characters.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../overflight/core.mjs';
import { compileOverflightProject, DEFAULT_OVERFLIGHT_PROJECT } from '../overflight/project.mjs';
import { pilot, selectCard } from '../overflight/review-pilot.mjs';
import { createOverflightRendererOwner } from '../overflight/host-loop.mjs';
import { createArcadeAdapter, getArcadeCollection } from '../presentation/industrial-arcade.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { pixelArtForSlot } from '../presentation/pixel-art.mjs';

test('all seven cosmetic identities preserve the complete seeded simulation through earned upgrades', () => {
  const compiled = compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT),
    runs = OVERFLIGHT_CHARACTERS.map(({ id, slots }) => {
      const run = createOverflightRun(compiled, {
        seed: compiled.seed,
        airframes: 3,
        characterId: id,
      });
      // This is the host's presentation-only metadata, never a gameplay recipe.
      run.appearance = Object.freeze({ characterId: id, playerSlot: slots[0] });
      startOverflight(run);
      return run;
    });
  let input = {};
  for (let tick = 0; tick < 45 * 60; tick++) {
    if (runs[0].phase === 'upgrade') {
      const choices = runs.map((run) => selectCard(run, 'fan').id);
      assert.equal(new Set(choices).size, 1);
      for (const [index, run] of runs.entries())
        assert.equal(chooseOverflightUpgrade(run, choices[index]), true);
    }
    assert.equal(runs[0].phase, 'playing');
    if (tick % 6 === 0) input = pilot(runs[0]);
    for (const run of runs) stepOverflight(run, { ...input, boost: tick % 180 === 0 });
  }
  assert.ok(runs[0].progression.choices > 0, 'The comparison must include an earned upgrade.');
  assert.ok(runs[0].stats.kills > 0, 'The comparison must include actual combat and rewards.');
  assert.ok(
    runs[0].stats.boostsUsed > 0,
    'The comparison must exercise the active movement input.',
  );
  const state = (run) => {
    const result = { ...run };
    delete result.appearance;
    return result;
  };
  for (const run of runs.slice(1)) {
    assert.deepEqual(overflightSummary(run), overflightSummary(runs[0]));
    // Includes every pool, RNG stream, cooldown, grid and progression record.
    assert.deepEqual(state(run), state(runs[0]));
  }
  assert.equal(new Set(runs.map((run) => run.appearance.characterId)).size, 7);
});

const release = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url), 'utf8'),
);
function presentationBoundary({ customId = null } = {}) {
  let sourceCloses = 0;
  const images = Object.fromEntries(
    OVERFLIGHT_CHARACTER_IMAGE_SLOTS.map((slot) => {
      const source = release.resolved.assets[slot],
        asset = slot === `player.${customId}.detailed` ? { ...source, id: 'custom.body' } : source;
      return [
        slot,
        Object.freeze({
          image: Object.freeze({
            slot,
            width: asset.file.width,
            height: asset.file.height,
            close: () => sourceCloses++,
          }),
          asset,
          geometry: imagePresentation(asset),
        }),
      ];
    }),
  );
  const canvases = [],
    snapshot = Object.freeze({
      source: release.source,
      resolved: Object.freeze({
        ...release.resolved,
        assets: Object.freeze(
          Object.fromEntries(Object.entries(images).map(([slot, frame]) => [slot, frame.asset])),
        ),
        bindings: Object.freeze(
          Object.fromEntries(
            Object.entries(images).map(([slot, frame]) => [
              slot,
              { id: frame.asset.id, revision: frame.asset.revision },
            ]),
          ),
        ),
      }),
      image: (slot) => images[slot] ?? null,
    });
  // Only Canvas/decode are replaced. The production appearance adapter owns
  // actual variant caching and retirement; this is not a browser-render test.
  const canvasFactory = () => {
    let source;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage(image) {
          source = image;
        },
        getImageData: () => ({ data: new Uint8ClampedArray(pixelArtForSlot(source.slot).rgba) }),
        putImageData() {},
      }),
    };
    canvases.push(canvas);
    return canvas;
  };
  return { snapshot, canvasFactory, canvases, sourceCloses: () => sourceCloses };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

test(
  'real renderer ownership retains cached roster art through retry and delayed retirement',
  { timeout: 5000 },
  async () => {
    const boundary = presentationBoundary(),
      adapter = createArcadeAdapter({ canvasFactory: boundary.canvasFactory }),
      owner = createOverflightRendererOwner(),
      collection = getArcadeCollection('industrial-workshop');
    let creations = 0,
      destructions = 0,
      pendingGate = null;
    const acquire = (characterId) => {
      // Inspect accepted source slots without touching the previous adapter.
      const selected = resolveOverflightCharacter(boundary.snapshot, characterId),
        identity = JSON.stringify({ characterId, playerSlot: selected.playerSlot });
      return owner.acquire(identity, async () => {
        adapter.clear();
        const snapshot = adapter.resolve(boundary.snapshot, collection),
          roster = prepareOverflightCharacters(snapshot),
          character = roster.find(({ id }) => id === characterId);
        creations++;
        return {
          character,
          roster,
          identity,
          destroyStarted: deferred(),
          destroyGate: null,
          async destroy() {
            destructions++;
            this.destroyStarted.resolve();
            await this.destroyGate;
            assert.ok(this.roster.every(({ frame }) => frame.image.width > 0));
          },
        };
      });
    };
    try {
      const first = await acquire('scout'),
        firstCanvases = [...boundary.canvases];
      assert.equal(firstCanvases.length, 7, 'All selector variants are eagerly prepared.');
      assert.ok(firstCanvases.every((canvas) => canvas.width === 64));
      assert.equal(
        await acquire('scout'),
        first,
        'An unchanged retry reuses the prepared renderer.',
      );
      assert.equal(creations, 1);
      assert.equal(destructions, 0);
      assert.equal(boundary.canvases.length, 7);
      const gate = deferred();
      pendingGate = gate;
      first.destroyGate = gate.promise;
      const replacing = acquire('carrier');
      await first.destroyStarted.promise;
      assert.ok(firstCanvases.every((canvas) => canvas.width === 64));
      assert.equal(boundary.canvases.length, 7, 'No replacement clears live appearance canvases.');
      gate.resolve();
      const second = await replacing;
      assert.equal(second.character.playerSlot, 'player.carrier.detailed');
      assert.equal(second.character.frame.geometry.rotors.length, 6);
      assert.ok(firstCanvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
      assert.ok(second.roster.every(({ frame }) => frame.image.width === 64));
      assert.equal(creations, 2);
      assert.equal(destructions, 1);
      assert.equal(await acquire('carrier'), second);
      await owner.dispose();
      assert.ok(second.roster.every(({ frame }) => frame.image.width === 64));
      adapter.clear();
      assert.ok(boundary.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
      assert.equal(destructions, 2);
      assert.equal(boundary.sourceCloses(), 0);
      for (const { id } of OVERFLIGHT_CHARACTERS)
        assert.equal(resolveOverflightCharacter(boundary.snapshot, id).frame.image.width, 64);
    } finally {
      pendingGate?.resolve();
      await owner.dispose();
      adapter.clear();
    }
  },
);

test('custom uploaded bodies remain the exact accepted source across appearance retirement', () => {
  const boundary = presentationBoundary({ customId: 'fiber' }),
    adapter = createArcadeAdapter({ canvasFactory: boundary.canvasFactory }),
    collection = getArcadeCollection('industrial-workshop'),
    original = resolveOverflightCharacter(boundary.snapshot, 'fiber');
  const first = prepareOverflightCharacters(adapter.resolve(boundary.snapshot, collection));
  assert.equal(first.find(({ id }) => id === 'fiber').frame, original.frame);
  assert.equal(boundary.canvases.length, 6);
  adapter.clear();
  const second = prepareOverflightCharacters(adapter.resolve(boundary.snapshot, collection));
  assert.equal(second.find(({ id }) => id === 'fiber').frame, original.frame);
  assert.equal(boundary.canvases.length, 12);
  adapter.clear();
  assert.equal(original.frame.image.width, 64);
  assert.equal(original.frame.geometry, first.find(({ id }) => id === 'fiber').frame.geometry);
  assert.equal(boundary.sourceCloses(), 0);
});
