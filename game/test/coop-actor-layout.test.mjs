import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';

const compiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const palette = {
  ink: '#f6f3e8',
  paper: '#071527',
  muted: '#a8b8cc',
  accent: '#ffd64a',
  safe: '#67aaff',
  danger: '#ff7169',
  field: '#10243e',
  grid: '#182b43',
  sky: '#233950',
  land: '#526e67',
};
const snapshot = {
  canvas: { palette, motionScale: 1 },
  fonts: { ui: 'Prepared UI', numeric: 'Prepared Mono' },
  image(slot) {
    const asset = compiled.resolved.assets[slot];
    if (!asset) return null;
    const geometry = imagePresentation(asset);
    return {
      image: { slot, width: geometry.frame.width, height: geometry.frame.height },
      geometry,
    };
  },
};
function surface(width = 362) {
  const calls = [],
    stack = [];
  let state = {
    matrix: [1, 0, 0, 1, 0, 0],
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    font: '10px sans-serif',
  };
  const multiply = ([a, b, c, d, e, f]) => {
    const [g, h, i, j, k, l] = state.matrix;
    state.matrix = [
      g * a + i * b,
      h * a + j * b,
      g * c + i * d,
      h * c + j * d,
      g * e + i * f + k,
      h * e + j * f + l,
    ];
  };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, state: { ...state, matrix: [...state.matrix] } });
          if (name === 'save') stack.push({ ...state, matrix: [...state.matrix] });
          if (name === 'restore') state = stack.pop();
          if (name === 'translate') multiply([1, 0, 0, 1, ...args]);
          if (name === 'scale') multiply([args[0], 0, 0, args[1], 0, 0]);
          if (name === 'rotate') {
            const c = Math.cos(args[0]),
              s = Math.sin(args[0]);
            multiply([c, s, -s, c, 0, 0]);
          }
          if (name === 'measureText')
            return {
              width: String(args[0]).length * Number(state.font.match(/([\d.]+)px/)[1]) * 0.64,
            };
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return {
    canvas: { width: 1152, height: 576, clientWidth: width, getContext: () => ctx },
    calls,
    ctx,
  };
}
function bounds(call, rectangle = call.args.slice(1)) {
  const [a, b, c, d, e, f] = call.state.matrix;
  const [x, y, w, h] = rectangle;
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
  return {
    left: Math.min(...corners.map((p) => p[0])),
    right: Math.max(...corners.map((p) => p[0])),
    top: Math.min(...corners.map((p) => p[1])),
    bottom: Math.max(...corners.map((p) => p[1])),
  };
}

test('portrait functional player numerals retain at least fourteen CSS pixels', () => {
  const run = createCoop(FIRST_CONNECTION),
    v = surface(),
    p = createCoopPainter(v.canvas);
  p.setPresentation(snapshot);
  p.paint(run);
  for (const id of ['1', '2']) {
    const label = v.calls.find((c) => c.name === 'fillText' && c.args[0] === id);
    assert.ok(label);
    const css = (Number(label.state.font.match(/([\d.]+)px/)[1]) * 362) / 72;
    assert.ok(css >= 14 - 1e-9, `${id} is ${css} CSS pixels`);
  }
});
test('pilot complete image frames remain within the arena at the true boundary', () => {
  const run = createCoop(FIRST_CONNECTION),
    v = surface(),
    p = createCoopPainter(v.canvas);
  run.players[0].x = 0.5;
  run.players[0].y = 0.5;
  run.players[1].x = 71.5;
  run.players[1].y = 35.5;
  const before = structuredClone(run);
  p.setPresentation(snapshot);
  p.paint(run);
  for (const call of v.calls.filter(
    (c) => c.name === 'drawImage' && c.args[0].slot.startsWith('player.'),
  )) {
    const b = bounds(call);
    assert.ok(b.left >= 0 && b.top >= 0 && b.right <= 1152 && b.bottom <= 576, JSON.stringify(b));
  }
  assert.deepEqual(run, before);
});

// Pure layout cases complement command observations; neither proves native glyph readability.
import {
  coopCueScale,
  coopBodyBounds,
  coopPilotBodyOffset,
  placeCoopCue,
} from '../couch/coop-actor-layout.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { drawPresentedActor } from '../ui/actor-presentation.mjs';

for (const detail of ['compact', 'detailed']) {
  test(`${detail} full frame, motor and nose bounds stay inside every corner through heading and banking`, () => {
    const prepared = snapshot.image(`player.scout.${detail}`),
      geometry = prepared.geometry,
      adapter = createCoopActorPresentation();
    adapter.setPresentation(snapshot);
    for (const width of [240, 320, 362, 1152, 1900]) {
      adapter.update(createCoop(FIRST_CONNECTION), { canvasCSSWidth: width });
      const original = adapter.frame('pilot', 0);
      for (const [x, y] of [
        [8, 8],
        [1144, 8],
        [8, 568],
        [1144, 568],
      ])
        for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5])
          for (const bank of [-0.15, 0, 0.15]) {
            const frame = { x, y, heading, bank, diameter: original.diameter };
            const margin = 1152 / width,
              offset = coopPilotBodyOffset(frame, geometry, 1152, 576, margin),
              box = coopBodyBounds(frame, geometry);
            assert.ok(x + offset.x + box.left >= margin - 1e-9);
            assert.ok(x + offset.x + box.right <= 1152 - margin + 1e-9);
            assert.ok(y + offset.y + box.top >= margin - 1e-9);
            assert.ok(y + offset.y + box.bottom <= 576 - margin + 1e-9);
            assert.deepEqual(frame, { x, y, heading, bank, diameter: original.diameter });
            const v = surface(width);
            drawPresentedActor(
              v.ctx,
              {
                ...original,
                ...frame,
                phase: 0.37,
                style: detail === 'compact' ? 'microtile' : 'hybrid',
              },
              palette,
              prepared.image,
              geometry,
              null,
              { bodyOffset: offset },
            );
            for (const call of v.calls) {
              if (call.name === 'arc') break; // The authoritative contact is intentionally unshifted.
              if (!['drawImage', 'fillRect'].includes(call.name)) continue;
              const drawn = bounds(call, call.name === 'fillRect' ? call.args : undefined);
              assert.ok(
                drawn.left >= 0 && drawn.top >= 0 && drawn.right <= 1152 && drawn.bottom <= 576,
                JSON.stringify({ detail, width, heading, bank, drawn }),
              );
            }
          }
    }
  });
}

test('body offset leaves shared default drawing exact and contact at its real pixel position', () => {
  const run = createCoop(FIRST_CONNECTION),
    adapter = createCoopActorPresentation();
  adapter.setPresentation(snapshot);
  adapter.update(run, { canvasCSSWidth: 362 });
  const frame = adapter.frame('pilot', 0),
    prepared = snapshot.image(frame.sourceSlot),
    a = surface(),
    b = surface(),
    c = surface();
  drawPresentedActor(a.ctx, frame, palette, prepared.image, prepared.geometry);
  drawPresentedActor(b.ctx, frame, palette, prepared.image, prepared.geometry, null, {});
  drawPresentedActor(c.ctx, frame, palette, prepared.image, prepared.geometry, null, {
    bodyOffset: { x: Infinity, y: 0 },
  });
  assert.deepEqual(b.calls, a.calls);
  assert.deepEqual(c.calls, a.calls);
  const shifted = surface();
  drawPresentedActor(shifted.ctx, frame, palette, prepared.image, prepared.geometry, null, {
    bodyOffset: { x: 16, y: 12 },
  });
  const ring = shifted.calls.find((call) => call.name === 'arc' && call.args[2] === frame.radius);
  assert.deepEqual(ring.state.matrix, [1, 0, 0, 1, Math.round(frame.x), Math.round(frame.y)]);
  const image = shifted.calls.find((call) => call.name === 'drawImage'),
    plain = a.calls.find((call) => call.name === 'drawImage');
  assert.equal(image.state.matrix[4] - plain.state.matrix[4], 16);
  assert.equal(image.state.matrix[5] - plain.state.matrix[5], 12);
});

for (const textFace of ['plain', 'pixel'])
  test(`${textFace} portrait cues and player identities retain CSS size without covering true heads`, () => {
    const run = createCoop(FIRST_CONNECTION),
      v = surface(),
      p = createCoopPainter(v.canvas);
    run.players[0].status = 'downed';
    run.players[1].graceUntil = 10;
    const hunter = run.enemies.find((e) => e.type === 'hunter');
    Object.assign(hunter, { phase: 'warning', target: 0, targetPoint: { x: 25, y: 10 } });
    const before = structuredClone(run);
    p.setPresentation(snapshot);
    p.paint(run, { textFace, reduced: true });
    const labels = v.calls.filter((c) => c.name === 'fillText');
    for (const text of ['1', '2', '+', 'LOCK 1'])
      assert.ok(
        labels.some((c) => c.args[0] === text),
        text,
      );
    for (const label of labels) {
      const cssSize = (Number(label.state.font.match(/([\d.]+)px/)[1]) * 362) / 72;
      assert.ok(cssSize >= (['1', '2'].includes(label.args[0]) ? 14 : 12) - 1e-9);
    }
    const identity = labels.find((c) => c.args[0] === '1');
    assert.equal(identity.state.matrix[0], 16);
    // The final colored circle remains at the authoritative head and exact radius.
    for (const player of run.players)
      assert.ok(
        v.calls.some(
          (c) =>
            c.name === 'arc' &&
            c.args[0] === player.x &&
            c.args[1] === player.y &&
            c.args[2] === player.radius,
        ),
      );
    const cell = 362 / run.width,
      heads = run.players.map((player) => ({
        left: player.x * cell - player.radius * cell - 2,
        right: player.x * cell + player.radius * cell + 2,
        top: player.y * cell - player.radius * cell - 2,
        bottom: player.y * cell + player.radius * cell + 2,
      }));
    function clearHeads(rect) {
      assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= 362 && rect.bottom <= 181);
      for (const head of heads)
        assert.equal(
          rect.left < head.right &&
            rect.right > head.left &&
            rect.top < head.bottom &&
            rect.bottom > head.top,
          false,
        );
    }
    for (const call of v.calls.filter(
      (c) => c.name === 'fillRect' && c.state.fillStyle === '#07111c',
    )) {
      const rect = bounds(call, call.args);
      for (const key of ['left', 'right', 'top', 'bottom']) rect[key] *= 362 / 1152;
      if (rect.bottom - rect.top >= 12) clearHeads(rect); // Label plates, not tiny contact pixels.
    }
    for (const id of ['1', '2']) {
      const label = labels.find((c) => c.args[0] === id),
        x = label.args[1] * cell,
        y = label.args[2] * cell,
        radius = id === '1' ? 10 : 12;
      clearHeads({ left: x - radius, right: x + radius, top: y - radius, bottom: y + radius });
    }
    assert.deepEqual(run, before);
  });

test('complete CSS cue plates avoid both pilot heads and remain in the 362 by181 arena', () => {
  const heads = [
      { left: 0, top: 0, right: 7, bottom: 7 },
      { left: 355, top: 174, right: 362, bottom: 181 },
    ],
    occupied = [];
  for (const [x, y, width, height] of [
    [2, 2, 30, 24],
    [360, 179, 24, 24],
    [2, 2, 72, 18],
    [360, 179, 82, 18],
    [181, 90, 18, 18],
  ]) {
    const r = placeCoopCue({
      x,
      y,
      width,
      height,
      arenaWidth: 362,
      arenaHeight: 181,
      heads,
      occupied,
    });
    assert.ok(r);
    assert.ok(r.left >= 0 && r.top >= 0 && r.right <= 362 && r.bottom <= 181);
    for (const h of heads)
      assert.equal(
        r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top,
        false,
      );
    occupied.push(r);
  }
  const scale = coopCueScale(362);
  assert.equal(scale.font(0.66, 14) * scale.cell, 14);
  assert.equal(scale.font(0.57, 12) * scale.cell, 12);
});

test('Large scales Team canvas type after its CSS-size clamp without changing cell geometry', () => {
  for (const width of [292, 362, 1152]) {
    const standard = coopCueScale(width),
      large = coopCueScale(width, 72, 'large');
    assert.equal(standard.cell, large.cell);
    assert.equal(standard.width, large.width);
    for (const [cells, minimum] of [
      [0.57, 12],
      [0.66, 14],
      [2, 12],
    ])
      assert.equal(large.font(cells, minimum), standard.font(cells, minimum) * (4 / 3));
  }
  assert.throws(() => coopCueScale(362, 72, 'tiny'), /Unsupported text size/);
});

function labelStudy(width = 362, options = {}) {
  const run = createCoop(FIRST_CONNECTION),
    v = surface(width),
    painter = createCoopPainter(v.canvas);
  run.players[0].status = 'downed';
  run.players[1].graceUntil = 10;
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  Object.assign(hunter, { phase: 'warning', target: 0, targetPoint: { x: 25, y: 10 } });
  const before = structuredClone(run);
  painter.setPresentation(snapshot);
  painter.paint(run, options);
  assert.deepEqual(run, before, 'Text preferences must not alter the authoritative run');
  return { run, ...v };
}

test('Standard Team commands retain the pre-Large-preference baseline', () => {
  const baseline = {
    pixel: '0c396f52408c0e8de8a052974b1c9b4d52c805bded20259bb55570b23cf214d4',
    plain: '2bf0c9bd9b797d11960ceef870006d11ef14739d267ddc4789caa0b2d6012c0b',
  };
  for (const textFace of ['pixel', 'plain']) {
    const options = { textFace, reduced: true };
    const omitted = labelStudy(362, options),
      explicit = labelStudy(362, { ...options, textSize: 'standard' });
    assert.deepEqual(explicit.calls, omitted.calls);
    assert.equal(
      createHash('sha256').update(JSON.stringify(omitted.calls)).digest('hex'),
      baseline[textFace],
    );
  }
});

test('Large enlarges actual player, downed and warning labels while preserving prepared bodies and contacts', () => {
  for (const width of [292, 362, 1152])
    for (const textFace of ['plain', 'pixel']) {
      const standard = labelStudy(width, { textFace, reduced: true }),
        large = labelStudy(width, { textFace, textSize: 'large', reduced: true });
      const labels = (view) => view.calls.filter((call) => call.name === 'fillText');
      for (const text of ['1', '2', '+', 'LOCK 1']) {
        const before = labels(standard).find((call) => call.args[0] === text),
          after = labels(large).find((call) => call.args[0] === text);
        assert.ok(before && after, `${width}px must retain ${text}`);
        const size = (call) => Number(call.state.font.match(/([\d.]+)px/)[1]);
        assert.ok(
          Math.abs(size(after) - size(before) * (4 / 3)) < 1e-9,
          `${text} must honor Large`,
        );
      }
      const bodies = (view) => view.calls.filter((call) => call.name === 'drawImage');
      assert.deepEqual(
        bodies(large),
        bodies(standard),
        'Image transforms and source frames stay exact',
      );
      const cell = width / large.run.width;
      const heads = large.run.players.map((player) => ({
        left: player.x * cell - player.radius * cell - 2,
        right: player.x * cell + player.radius * cell + 2,
        top: player.y * cell - player.radius * cell - 2,
        bottom: player.y * cell + player.radius * cell + 2,
      }));
      const clearHeads = (rect) => {
        assert.ok(
          rect.left >= 0 && rect.top >= 0 && rect.right <= width && rect.bottom <= width / 2,
          JSON.stringify({ width, rect }),
        );
        for (const head of heads)
          assert.equal(
            rect.left < head.right &&
              rect.right > head.left &&
              rect.top < head.bottom &&
              rect.bottom > head.top,
            false,
            'Large label must not cover a real pilot head',
          );
      };
      for (const call of large.calls.filter(
        (entry) => entry.name === 'fillRect' && entry.state.fillStyle === '#07111c',
      )) {
        const rect = bounds(call, call.args);
        for (const key of ['left', 'right', 'top', 'bottom']) rect[key] *= width / 1152;
        if (rect.bottom - rect.top >= 16 - 1e-9) clearHeads(rect);
      }
      for (const id of ['1', '2']) {
        const label = labels(large).find((call) => call.args[0] === id),
          x = label.args[1] * cell,
          y = label.args[2] * cell,
          radius = (id === '1' ? 10 : 12) * (4 / 3);
        clearHeads({ left: x - radius, right: x + radius, top: y - radius, bottom: y + radius });
      }
      for (const player of large.run.players) {
        const contacts = (view) =>
          view.calls.filter(
            (call) =>
              call.name === 'arc' &&
              call.args[0] === player.x &&
              call.args[1] === player.y &&
              call.args[2] === player.radius,
          );
        assert.ok(contacts(large).length > 0);
        assert.deepEqual(
          contacts(large),
          contacts(standard),
          'Contact radius and foreground commands stay exact',
        );
      }
    }
});

test('crowded Team labels keep their measured size instead of covering a pilot or shrinking text', () => {
  const request = { x: 30, y: 20, width: 40, height: 24, arenaWidth: 60, arenaHeight: 40 };
  assert.equal(placeCoopCue({ ...request, width: 61 }), null);
  assert.equal(
    placeCoopCue({ ...request, heads: [{ left: 0, top: 0, right: 60, bottom: 40 }] }),
    null,
  );
});

test('invalid canvas text size fails before drawing or mutating the Team run', () => {
  const run = createCoop(FIRST_CONNECTION),
    before = structuredClone(run),
    v = surface();
  const painter = createCoopPainter(v.canvas);
  painter.setPresentation(snapshot);
  assert.throws(() => painter.paint(run, { textSize: 'tiny' }), /Unsupported text size/);
  assert.deepEqual(v.calls, []);
  assert.deepEqual(run, before);
});
