import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ACTOR_FAMILIES, ACTOR_CASTS, ACTOR_VISUALS } from '../hunt/actor-catalog.mjs';
import {
  drawHuntActor,
  INDUSTRIAL_ROSTER_ART_REVISION,
  INDUSTRIAL_ROSTER_SAMPLES,
} from '../hunt/actor-art.mjs';
import { actorArtReviewRevision } from '../hunt/preferences.mjs';
import { validateActorAnimation, ACTOR_CLIPS } from '../presentation/actor-animation.mjs';
import { soldierSpecimen, rasterActor } from '../../scripts/produce-soldier-roster.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');

test('production roster descriptors round-trip through the existing bounded Studio contract', () => {
  assert.deepEqual(
    Object.keys(INDUSTRIAL_ROSTER_SAMPLES),
    ACTOR_FAMILIES.map((row) => row.id),
  );
  const timings = new Set();
  for (const [family, descriptor] of Object.entries(INDUSTRIAL_ROSTER_SAMPLES)) {
    const json = JSON.stringify(descriptor),
      restored = validateActorAnimation(JSON.parse(json));
    assert.deepEqual(restored, descriptor);
    assert.ok(Buffer.byteLength(json) < 32768);
    assert.equal(descriptor.rig, 'overhead-soldier.v1');
    assert.equal(descriptor.revision, 3);
    assert.equal(descriptor.id, `industrial-roster-${family}`);
    assert.deepEqual(Object.keys(descriptor.clips), ACTOR_CLIPS);
    assert.equal(descriptor.frames.length, 22);
    assert.ok(Object.isFrozen(descriptor));
    assert.deepEqual(descriptor.anchors.pivot, { x: 0.5, y: 0.5 });
    timings.add(
      descriptor.clips.move.frames
        .map((id) => descriptor.frames.find((f) => f.id === id).durationMs)
        .join(','),
    );
  }
  assert.equal(timings.size, 12, 'Every family has a deliberate distinct gait cadence.');
});

test('all twelve family silhouettes survive 16/24/32px independently of the three kit palettes', () => {
  for (const size of [16, 24, 32])
    for (const cast of ACTOR_CASTS) {
      const silhouettes = new Set(),
        images = new Set();
      for (const family of ACTOR_FAMILIES) {
        const image = soldierSpecimen(
          {
            family: family.id,
            cast: cast.id,
            state: 'walk',
            locomotionPhase: 1 / 6,
            armed: family.id === 'guard',
          },
          size,
        );
        const alpha = image.rgba.filter((_, i) => i % 4 === 3);
        assert.ok(alpha.includes(0) && alpha.includes(255));
        assert.equal(alpha[0], 0);
        assert.equal(alpha[size - 1], 0);
        assert.equal(alpha.at(-1), 0);
        silhouettes.add(hash(alpha));
        images.add(hash(image.rgba));
      }
      assert.equal(
        silhouettes.size,
        12,
        `${size}px ${cast.id}: silhouettes must differ without color`,
      );
      assert.equal(images.size, 12);
    }
  for (const family of ACTOR_FAMILIES) {
    const geometry = ACTOR_CASTS.map((cast) =>
      soldierSpecimen({ family: family.id, cast: cast.id }, 32).paints.map((p) => p.rect),
    );
    assert.equal(
      new Set(geometry.map((value) => JSON.stringify(value))).size,
      3,
      'Kits change equipment geometry, not only colors.',
    );
  }
});

test('all soldier gear stays inside the native rotating cell with every compact and detailed gait frame', () => {
  for (const visual of ACTOR_VISUALS)
    for (const detail of ['compact', 'detailed'])
      for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2])
        for (const phase of ['warning', 'rest', 'burst'])
          for (const locomotionPhase of [0, 1 / 6, 4 / 6]) {
            const image = soldierSpecimen({
              visualId: visual.id,
              detail,
              phase,
              locomotionPhase,
              state: 'walk',
              facingRadians: angle,
              armed: visual.family === 'guard',
            });
            assert.equal(image.rotations[0], angle);
            for (const paint of image.paints.filter((p) => p.rotation === 1))
              for (const [x, y] of paint.corners)
                assert.ok(
                  x >= -1e-8 && x <= 32 + 1e-8 && y >= -1e-8 && y <= 32 + 1e-8,
                  `${visual.id}/${detail}/${phase}/${angle}: ${paint.rect}`,
                );
            assert.ok(
              image.paints
                .filter((p) => p.rotation === 1)
                .every((p) => p.color !== visual.palette.skin),
              'No portrait face appears in the overhead rig.',
            );
          }
});

test('native heading/armor/armed eligibility survive expressive clips and reduced, frozen or paused presentation', () => {
  for (const family of ACTOR_FAMILIES)
    for (const flag of ['paused', 'frozen', 'reducedEffects']) {
      const options = {
        family: family.id,
        heading: 'right',
        nextHeading: 'left',
        phase: 'warning',
        [flag]: true,
      };
      const first = soldierSpecimen({ ...options, timeMs: 0 }),
        later = soldierSpecimen({ ...options, timeMs: 3500 });
      assert.deepEqual(first.rgba, later.rgba);
      assert.equal(first.rotations[0], Math.PI / 2);
    }
  const shield = {
    family: 'shield-bearer',
    heading: 'right',
    nextHeading: 'left',
    phase: 'turning',
  };
  assert.deepEqual(soldierSpecimen(shield).rotations, [Math.PI / 2, Math.PI / 2, -Math.PI / 2]);
  assert.notEqual(
    hash(soldierSpecimen({ family: 'brace-trooper', phase: 'warning', frozen: true }).rgba),
    hash(soldierSpecimen({ family: 'brace-trooper', phase: 'rest', frozen: true }).rgba),
  );
  assert.deepEqual(
    soldierSpecimen({ family: 'guard' }).rgba,
    soldierSpecimen({ family: 'guard', armed: false }).rgba,
  );
  assert.notEqual(
    hash(soldierSpecimen({ family: 'guard' }).rgba),
    hash(soldierSpecimen({ family: 'guard', armed: true }).rgba),
  );
});

test('each family has animated non-gameplay reactions and no drawing mutates accepted state', () => {
  for (const family of ACTOR_FAMILIES) {
    const options = {
      family: family.id,
      heading: 'left',
      state: 'caught',
      animationClip: 'caught',
      timeMs: 0,
    };
    const before = structuredClone(options),
      a = soldierSpecimen(options),
      b = soldierSpecimen({ ...options, timeMs: 90 });
    assert.notEqual(hash(a.rgba), hash(b.rgba), family.id);
    assert.deepEqual(options, before);
    assert.equal(a.rotations[0], -Math.PI / 2);
  }
});

test('released, previous-pilot and overhead-v2 art remain pixel-identical to their historical source', async () => {
  const pins = JSON.parse(
    await readFile(new URL('./fixtures/soldier-art-predecessors.json', import.meta.url), 'utf8'),
  );
  for (const row of pins.rows) {
    const digest = createHash('sha256');
    let specimens = 0;
    for (const visual of ACTOR_VISUALS)
      for (const size of [16, 32])
        for (const state of ['walk', 'notice', 'recover']) {
          const target = rasterActor({ width: size });
          drawHuntActor(target.context, 0, 0, size, 0, {
            visualId: visual.id,
            artRevision: row.revision,
            state,
            phase: state === 'recover' ? 'rest' : undefined,
            heading: 'up',
            timeMs: 230,
            shadow: false,
            armed: visual.family === 'guard',
          });
          digest.update(target.rgba);
          specimens++;
        }
    assert.equal(specimens, row.specimens);
    assert.equal(digest.digest('hex'), row.rgbaSha256, row.revision);
  }
  assert.equal(
    actorArtReviewRevision({
      href: `https://game.invalid/?artReview=${INDUSTRIAL_ROSTER_ART_REVISION}`,
    }),
    INDUSTRIAL_ROSTER_ART_REVISION,
  );
  assert.equal(actorArtReviewRevision({ href: 'https://game.invalid/' }), null);
  assert.equal(actorArtReviewRevision({ href: 'https://game.invalid/?artReview=unknown' }), null);
});
