import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  createAnimationState,
  advanceAnimation,
  componentPose,
} from '../../motion-lab/animation.mjs';
import { playerPaintSize as actualSize } from '../../../game/ui/render.mjs';
import { validatePresentations, ROLE_IDS, BODY_IDS, wingEnvelopes } from './model.mjs';
import { paintRole, playerPaintSize } from './preview.mjs';

const text = readFileSync(new URL('./presentations.json', import.meta.url), 'utf8');
test('seven ordered independent source bodies retain exact paths and separate wing recipes', () => {
  const data = validatePresentations(text);
  assert.deepEqual(
    data.roles.map((r) => r.classId),
    ROLE_IDS,
  );
  assert.equal(new Set(data.roles.map((r) => r.body.src)).size, 7);
  assert.equal(new Set(data.roles.map((r) => JSON.stringify(r.recipe))).size, 7);
  data.roles.forEach((role, i) => {
    assert.equal(role.body.animationRecipe, `${BODY_IDS[i]}-wings`);
    assert.deepEqual(role.body.rotors, []);
    for (const b of wingEnvelopes(role.recipe.components[0]))
      assert.ok(b.left >= -0.5 && b.right <= 0.5 && b.top >= -0.5 && b.bottom <= 0.5);
  });
  data.roles[0].body.src = 'changed';
  assert.equal(
    validatePresentations(text).roles[0].body.src,
    'originals/scout.png',
    'Parsed candidates are independent.',
  );
});

test('wrong identity types, foreign files, extra state fields and crossed owners refuse', () => {
  for (const mutate of [
    (d) => {
      d.baseCommit = [d.baseCommit];
    },
    (d) => {
      d.roles[0].sha256 = [d.roles[0].sha256];
    },
    (d) => {
      d.roles[0].body.src = '../fpv-role-presentations/originals/scout.png';
    },
    (d) => {
      d.roles[0].provenance = 'provenance/carrier.json';
    },
    (d) => {
      d.roles[0].body.animationRecipe = d.roles[1].body.animationRecipe;
    },
    (d) => {
      d.roles[0].body.actionState = 'scan';
    },
    (d) => {
      d.roles[0].recipe.components[0].trigger = 'ability.used';
    },
    (d) => {
      d.roles[0].recipe.components[0].type = 'atlas';
    },
    (d) => {
      d.roles.reverse();
    },
    (d) => {
      d.runtimeBinding = {};
    },
    (d) => {
      d.roles[0].width -= 1;
    },
  ]) {
    const d = JSON.parse(text);
    mutate(d);
    assert.throws(() => validatePresentations(JSON.stringify(d)));
  }
  assert.throws(() => validatePresentations({}), /Bounded JSON/);
  assert.throws(() => validatePresentations(' '.repeat(65537)), /Bounded JSON/);
});

test('unsupported wing dimensions, same-side pivots and off-image motion envelopes refuse', () => {
  for (const mutate of [
    (c) => {
      c.anchors[0][2] = 1;
    },
    (c) => {
      c.anchors[0][0] = 0.2;
    },
    (c) => {
      c.anchors[0].push(0);
    },
    (c) => {
      c.anchors.push([0, 0, 1]);
    },
    (c) => {
      c.span = 0.7;
    },
    (c) => {
      c.chord = 0.5;
    },
    (c) => {
      c.frequencyHz = 0;
    },
    (c) => {
      c.color = 'url(other)';
    },
  ]) {
    const d = JSON.parse(text);
    mutate(d.roles[0].recipe.components[0]);
    assert.throws(() => validatePresentations(JSON.stringify(d)));
  }
});

test('existing wing clock responds to speed without rephasing or mutating data; pause and reduced motion hold it', () => {
  const data = validatePresentations(text),
    before = JSON.stringify(data);
  for (const { recipe } of data.roles) {
    const first = createAnimationState(),
      idle = advanceAnimation(first, recipe, { visualSpeed: 0, cruiseSpeed: 1 }, 1 / 60);
    const moving = advanceAnimation(first, recipe, { visualSpeed: 1, cruiseSpeed: 1 }, 1 / 60);
    assert.ok(moving.phases.wings > idle.phases.wings && idle.phases.wings > 0);
    assert.deepEqual(first, createAnimationState());
    const unchangedAtSpeedSwitch = advanceAnimation(
      moving,
      recipe,
      { visualSpeed: 2, cruiseSpeed: 1 },
      0,
    );
    assert.deepEqual(unchangedAtSpeedSwitch, moving);
    for (const option of ['paused', 'reducedMotion'])
      assert.deepEqual(
        advanceAnimation(moving, recipe, { visualSpeed: 2, cruiseSpeed: 1 }, 0.2, {
          [option]: true,
        }),
        moving,
      );
    const pose = componentPose(recipe.components[0], moving, 1, true);
    assert.equal(pose.flap, 0);
    assert.equal(pose.angle, 0);
    assert.equal(
      pose.span,
      recipe.components[0].span,
      'Reduced motion leaves a readable static wing.',
    );
  }
  assert.equal(JSON.stringify(data), before);
});

test('preview uses the actual current size helper; compact opt-in leaves old bodies, fallback and desktop contracts intact', () => {
  assert.equal(playerPaintSize, actualSize);
  for (const role of validatePresentations(text).roles) {
    const image = { naturalWidth: role.width, naturalHeight: role.height };
    const old = { ...role.body };
    delete old.compactMinimumCSSPixels;
    for (const boardWidth of [48, 72])
      for (const width of [294, 390, 600, 1152]) {
        const opts = {
          screenScale: width / (boardWidth * 16),
          canvasCSSWidth: width,
          style: 'hybrid',
          scale: 1,
        };
        const current = actualSize(role.body, image, opts),
          previous = actualSize(old, image, opts);
        if (width < 480) assert.ok(current.diameter * opts.screenScale >= 20 - 1e-9);
        else assert.deepEqual(current, previous);
        assert.deepEqual(actualSize(role.body, null, opts), actualSize(old, null, opts));
      }
  }
});

test('actual painter uses each original independently; hidden or missing attachments never substitute another body', () => {
  for (const role of validatePresentations(text).roles) {
    const image = { naturalWidth: role.width, naturalHeight: role.height, id: role.body.src },
      calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) =>
            calls.push([key, ...args]),
        set: () => true,
      },
    );
    const before = JSON.stringify(role);
    for (const heading of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      calls.length = 0;
      paintRole(ctx, role, image, createAnimationState(), { heading, showWings: true });
      assert.deepEqual(
        calls.filter(([name]) => name === 'drawImage').map((r) => r[1]),
        [image],
      );
      assert.ok(calls.some(([name, angle]) => name === 'rotate' && angle === heading));
      assert.ok(
        calls.filter(([name]) => name === 'fill').length >= 4,
        'Both real procedural wings paint beneath the original.',
      );
    }
    calls.length = 0;
    paintRole(ctx, role, image, createAnimationState(), { showWings: false });
    assert.equal(calls.filter(([name]) => name === 'drawImage').length, 1);
    assert.equal(
      calls.filter(([name]) => name === 'fill').length,
      1,
      'Only the normal shadow remains when wings are hidden.',
    );
    calls.length = 0;
    paintRole(ctx, role, null, createAnimationState());
    assert.equal(calls.filter(([name]) => name === 'drawImage').length, 0);
    assert.equal(
      calls.filter(([name]) => name === 'fill').length,
      2,
      'Missing image uses only the neutral marker and shadow.',
    );
    assert.equal(JSON.stringify(role), before);
  }
});
