import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { setLocale } from '../i18n/index.mjs';
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
const recordedTextWidth = (text, font) =>
  String(text).length * Number(font.match(/([\d.]+)px/)[1]) * 0.64;
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
              width: recordedTextWidth(args[0], state.font),
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
// Compare the painted footprint, not whether the helper uses translated local
// coordinates or direct board coordinates. Reject stretched/shifted contacts.
function pilotContactArcs(view, player) {
  const unit = view.canvas.width / view.run.width;
  return view.calls.filter((call) => {
    if (call.name !== 'arc') return false;
    const [a, b, c, d, e, f] = call.state.matrix;
    const [x, y, radius] = call.args;
    const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;
    return (
      near(a * x + c * y + e, player.x * unit) &&
      near(b * x + d * y + f, player.y * unit) &&
      near(radius * Math.hypot(a, b), player.radius * unit) &&
      near(radius * Math.hypot(c, d), player.radius * unit) &&
      near(a * c + b * d, 0)
    );
  });
}

function assertPreparedPilotContacts(view) {
  for (const player of view.run.players) {
    const arcs = pilotContactArcs(view, player);
    assert.ok(arcs.length > 0, `Pilot ${player.id + 1} retains the exact physical footprint`);
    // The last matching path is the foreground contact above all actor art.
    const last = view.calls.indexOf(arcs.at(-1));
    const end = view.calls.findIndex((call, index) => index > last && call.name === 'restore');
    assert.ok(end > last);
    const painted = view.calls.slice(last + 1, end);
    assert.equal(
      painted.some((call) => call.name === 'fill'),
      false,
    );
    const strokes = painted.filter((call) => call.name === 'stroke');
    assert.equal(strokes.length, 2);
    assert.deepEqual(
      strokes.map((call) => call.state.strokeStyle),
      ['#07111c', player.id === 0 ? palette.accent : palette.safe],
    );
    const cssCell = view.canvas.clientWidth / view.run.width;
    assert.deepEqual(
      strokes.map((call) => call.state.lineWidth),
      [3 / cssCell, 1 / cssCell],
    );
  }
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
    // Prepared art keeps an unfilled foreground circle at its exact true head.
    assertPreparedPilotContacts({ ...v, run });
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

test('Standard Team commands equal the omitted preference with exact unfilled pilot contacts', () => {
  for (const textFace of ['pixel', 'plain']) {
    const options = { textFace, reduced: true };
    const omitted = labelStudy(362, options),
      explicit = labelStudy(362, { ...options, textSize: 'standard' });
    assert.deepEqual(explicit.calls, omitted.calls);
    assertPreparedPilotContacts(omitted);
    assertPreparedPilotContacts(explicit);
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
        const contacts = (view) => pilotContactArcs(view, player);
        assert.ok(contacts(large).length > 0);
        assert.deepEqual(
          contacts(large),
          contacts(standard),
          'Contact radius and foreground commands stay exact',
        );
      }
      assertPreparedPilotContacts(standard);
      assertPreparedPilotContacts(large);
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

// These are renderer-state fixtures, not a claim that keyboard play reached
// each state. The recorder supplies deterministic 0.64em text widths; it does
// not substitute for native Plain/Theme-font glyph or raster qualification.
function relayCrowdingStudy(
  phase,
  {
    textFace,
    reduced,
    status,
    outcome = null,
    width = 212,
    slowed = phase === 'both-slowed' ? 2 : phase === 'slowed' ? 1 : 0,
  },
) {
  const run = createCoop(RELAY_YARD),
    view = surface(width),
    painter = createCoopPainter(view.canvas),
    hunters = run.enemies.filter((enemy) => enemy.type === 'hunter');
  assert.equal(hunters.length, 2);
  run.status = status;
  run.time = 2;
  run.tick = 240;
  run.team.reserves = 0;
  run.players[0].status = 'downed';
  for (const enemy of hunters) {
    enemy.phase = phase.endsWith('slowed') ? 'patrol' : phase;
    if (phase === 'warning') {
      enemy.target = 1;
      enemy.targetPoint = { x: 51.5, y: 18.5 };
    }
  }
  for (const enemy of hunters.slice(0, slowed)) {
    enemy.speedScale = 0.5;
    enemy.slowUntil = 3;
  }
  if (outcome) run.events = [{ type: outcome, players: [0, 1], tick: run.tick, time: run.time }];
  const before = structuredClone(run);
  const paintOptions = { textFace, textSize: 'large', reduced };
  painter.setPresentation(snapshot);
  painter.paint(run, paintOptions);
  assert.deepEqual(run, before, 'Crowding presentation must not change the authoritative state.');
  return { run, painter, paintOptions, ...view };
}

function paintedCueBounds(view) {
  const cssScale = view.canvas.clientWidth / view.canvas.width,
    cssBounds = (call, rect) =>
      Object.fromEntries(
        Object.entries(bounds(call, rect)).map(([key, value]) => [key, value * cssScale]),
      );
  return view.calls.flatMap((call, index) => {
    if (call.name !== 'fillText') return [];
    assert.equal(call.args.length, 3, 'Required text cannot use maxWidth to squeeze its glyphs.');
    assert.equal(call.state.textAlign, 'center');
    assert.equal(call.state.textBaseline, 'middle');
    const [text, x, y] = call.args,
      height = Number(call.state.font.match(/([\d.]+)px/)[1]),
      width = recordedTextWidth(text, call.state.font),
      previous = view.calls[index - 1],
      backing =
        previous?.name === 'fillRect' && previous.state.fillStyle === '#07111c'
          ? cssBounds(previous, previous.args)
          : null;
    let badge = null;
    if (['1', '2'].includes(text)) {
      const pathStart = view.calls
          .slice(0, index)
          .findLastIndex((entry) => entry.name === 'beginPath'),
        path = view.calls.slice(pathStart + 1, index),
        circle = path.find((entry) => entry.name === 'arc'),
        points = path.filter((entry) => ['moveTo', 'lineTo'].includes(entry.name));
      assert.equal(path.find((entry) => entry.name === 'fill')?.state.fillStyle, '#07111c');
      if (circle) {
        const [cx, cy, radius] = circle.args;
        badge = cssBounds(circle, [cx - radius, cy - radius, radius * 2, radius * 2]);
      } else {
        assert.equal(points.length, 4, 'The second pilot keeps its complete diamond badge.');
        const xs = points.map((entry) => entry.args[0]),
          ys = points.map((entry) => entry.args[1]);
        badge = cssBounds(points[0], [
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        ]);
      }
    }
    return [
      {
        text,
        cssFontSize: height * Math.hypot(call.state.matrix[2], call.state.matrix[3]) * cssScale,
        textBounds: cssBounds(call, [x - width / 2, y - height / 2, width, height]),
        backing,
        badge,
      },
    ];
  });
}

const overlap = (a, b) =>
  a.left < b.right - 1e-9 &&
  a.right > b.left + 1e-9 &&
  a.top < b.bottom - 1e-9 &&
  a.bottom > b.top + 1e-9;

function assertSlowRings(view, expectedHunters) {
  const cssScale = view.canvas.clientWidth / view.canvas.width,
    rings = view.calls.flatMap((call, index) => {
      if (call.name !== 'arc' || call.args[0] !== 0 || call.args[1] !== 0 || call.args[2] !== 0.88)
        return [];
      assert.equal(view.calls[index - 1].name, 'beginPath');
      assert.equal(view.calls[index - 2].name, 'setLineDash');
      assert.deepEqual(view.calls[index - 2].args, [[0.16, 0.12]]);
      const stroke = view.calls[index + 1];
      assert.equal(
        stroke.name,
        'stroke',
        'The actual slow ring must be stroked, not just described.',
      );
      assert.equal(stroke.state.lineWidth, 0.11);
      assert.equal(stroke.state.globalAlpha, 1);
      // This existing layout snapshot has no registered Support decoration;
      // the functional ring must therefore retain its original fallback ink.
      assert.equal(stroke.state.strokeStyle, '#e6f8ff');
      return [{ x: call.state.matrix[4] * cssScale, y: call.state.matrix[5] * cssScale }];
    }),
    cell = view.canvas.clientWidth / view.run.width;
  assert.equal(rings.length, expectedHunters.length);
  for (const [index, enemy] of expectedHunters.entries()) {
    assert.ok(Math.abs(rings[index].x - enemy.x * cell) < 1e-9);
    assert.ok(Math.abs(rings[index].y - enemy.y * cell) < 1e-9);
  }
}

function assertCrowdingCues(view, roleLabels, context) {
  const labels = paintedCueBounds(view),
    required = ['1', '2', '+', 'A', 'B', 'ЩИТ', ...roleLabels];
  assert.deepEqual(
    labels.map((label) => label.text).sort(),
    [...required].sort(),
    'Every full role/state, anchor, shield and pilot cue must survive; duplicate roles count separately.',
  );
  assert.equal(
    view.painter.cueLayout?.requested,
    required.length - 1,
    'Required placement requests include one shared downed numeral/+ badge; optional outcome banners cannot poison their packing.',
  );
  assert.equal(view.painter.cueLayout.painted, required.length - 1);
  assert.equal(view.painter.cueLayout.compact, true);
  assert.equal(
    labels.filter((label) => label.backing).length,
    required.length - 2,
    'Every caption has its own rectangular backing; the two pilot numerals use circle/diamond badges.',
  );
  assert.equal(labels.filter((label) => label.badge).length, 2);
  const cell = 212 / view.run.width,
    circleEnvelope = (x, y, radius, extra = 0) => ({
      left: (x - radius) * cell - extra,
      right: (x + radius) * cell + extra,
      top: (y - radius) * cell - extra,
      bottom: (y + radius) * cell + extra,
    }),
    exclusions = [
      ...view.run.players.map((player) => ({
        kind: `pilot ${player.id}`,
        ...circleEnvelope(player.x, player.y, player.radius, 2),
      })),
      ...view.run.enemies
        .filter((enemy) => enemy.active)
        .map((enemy) => ({
          kind: `enemy contact ${enemy.id}`,
          ...circleEnvelope(enemy.x, enemy.y, enemy.radius + 3 / 32),
        })),
      ...view.run.enemies
        .filter((enemy) => enemy.active && enemy.phase === 'warning' && enemy.targetPoint)
        .map((enemy) => ({
          kind: `locked target ${enemy.id}`,
          ...circleEnvelope(enemy.targetPoint.x, enemy.targetPoint.y, 0.75 + 0.05),
        })),
    ];
  assert.equal(
    exclusions.filter((rect) => rect.kind.startsWith('enemy contact')).length,
    4,
    'Both authored Hunters and both drifters contribute their actual contact exclusion.',
  );
  if (view.run.enemies.some((enemy) => enemy.phase === 'warning'))
    assert.equal(exclusions.filter((rect) => rect.kind.startsWith('locked target')).length, 2);
  for (const label of labels) {
    const minimum = ['1', '2'].includes(label.text) ? (14 * 4) / 3 : 16;
    assert.ok(label.cssFontSize >= minimum - 1e-9, JSON.stringify(label));
    for (const rect of [label.textBounds, label.backing, label.badge].filter(Boolean)) {
      assert.ok(
        rect.left >= -1e-9 &&
          rect.top >= -1e-9 &&
          rect.right <= 212 + 1e-9 &&
          rect.bottom <= 106 + 1e-9,
        JSON.stringify({ context, label }),
      );
      const covered = exclusions.filter((exclusion) => overlap(rect, exclusion));
      assert.deepEqual(covered, [], JSON.stringify({ context, label, covered }));
    }
    if (label.backing)
      assert.ok(
        label.backing.left <= label.textBounds.left + 1e-9 &&
          label.backing.top <= label.textBounds.top + 1e-9 &&
          label.backing.right >= label.textBounds.right - 1e-9 &&
          label.backing.bottom >= label.textBounds.bottom - 1e-9,
        `Backing must retain its complete text envelope: ${JSON.stringify(label)}`,
      );
  }
  const conflicts = [];
  for (let first = 0; first < labels.length; first++)
    for (let second = first + 1; second < labels.length; second++) {
      const a = labels[first],
        b = labels[second];
      if (
        overlap(a.textBounds, b.textBounds) ||
        overlap(a.backing ?? a.badge ?? a.textBounds, b.backing ?? b.badge ?? b.textBounds)
      )
        conflicts.push({ first: a, second: b });
    }
  assert.deepEqual(conflicts, [], JSON.stringify({ context, conflicts }));
  assert.deepEqual(
    view.painter.cueLayout.unplaced,
    [],
    JSON.stringify({ context, ...view.painter.cueLayout }),
  );
  assert.equal(view.painter.cueLayout.strategy, 'packed');
  return labels;
}

for (const [phase, roleLabels] of [
  ['patrol', ['МИСЛИВЕЦЬ', 'МИСЛИВЕЦЬ']],
  ['warning', ['LOCK 2', 'LOCK 2']],
  ['commit', ['РИВОК', 'РИВОК']],
  ['recovery', ['ВІДНОВЛЕННЯ', 'ВІДНОВЛЕННЯ']],
  // At compact widths the full functional status replaces only its own
  // generic idle Hunter title. It cannot replace a warning/charge/recovery.
  ['slowed', ['МИСЛИВЕЦЬ', 'УПОВІЛЬНЕНО']],
  ['both-slowed', ['УПОВІЛЬНЕНО', 'УПОВІЛЬНЕНО']],
])
  test(`212 CSS px Ukrainian Large Relay ${phase} retains complete distinct cue plates`, (t) => {
    setLocale('uk', { persist: false });
    t.after(() => setLocale('en', { persist: false }));
    for (const textFace of ['plain', 'pixel'])
      for (const reduced of [false, true])
        for (const status of ['running', 'paused']) {
          const view = relayCrowdingStudy(phase, { textFace, reduced, status });
          assertCrowdingCues(view, roleLabels, { phase, textFace, reduced, status });
        }
  });

test('362 CSS px Ukrainian Large Relay keeps legacy full role/danger and Slowed captions', (t) => {
  setLocale('uk', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
  for (const [phase, caption] of [
    ['patrol', 'МИСЛИВЕЦЬ'],
    ['warning', 'LOCK 2'],
    ['commit', 'РИВОК'],
    ['recovery', 'ВІДНОВЛЕННЯ'],
  ])
    for (const textFace of ['plain', 'pixel'])
      for (const reduced of [false, true])
        for (const status of ['running', 'paused']) {
          const view = relayCrowdingStudy(phase, {
              textFace,
              reduced,
              status,
              width: 362,
              slowed: 2,
            }),
            labels = paintedCueBounds(view);
          assert.deepEqual(
            labels.map((label) => label.text).sort(),
            ['1', '2', '+', 'A', 'B', 'ЩИТ', caption, caption, 'УПОВІЛЬНЕНО', 'УПОВІЛЬНЕНО'].sort(),
            JSON.stringify({ phase, textFace, reduced, status }),
          );
          assert.equal(
            view.painter.cueLayout,
            null,
            'Wider boards keep their existing layout path.',
          );
          for (const label of labels.filter((item) =>
            [caption, 'УПОВІЛЬНЕНО'].includes(item.text),
          )) {
            assert.ok(label.cssFontSize >= 16 - 1e-9);
            assert.ok(
              label.backing,
              'Both legacy role and status captions keep their full backings.',
            );
          }
          assertSlowRings(
            view,
            view.run.enemies.filter((enemy) => enemy.type === 'hunter'),
          );
        }
});

for (const [phase, danger] of [
  ['warning', 'LOCK 2'],
  ['commit', 'РИВОК'],
  ['recovery', 'ВІДНОВЛЕННЯ'],
])
  test(`212 CSS px slowed ${phase} Hunters retain full danger captions, arrows and dashed rings`, (t) => {
    setLocale('uk', { persist: false });
    t.after(() => setLocale('en', { persist: false }));
    for (const textFace of ['plain', 'pixel'])
      for (const reduced of [false, true])
        for (const status of ['running', 'paused']) {
          const view = relayCrowdingStudy(phase, { textFace, reduced, status, slowed: 2 });
          // Compact active states consolidate the full danger caption and ↓
          // slow marker; the translated Help legend and two unchanged dashed
          // rings retain its meaning without a second long caption per Hunter.
          assertCrowdingCues(view, [`${danger} ↓`, `${danger} ↓`], {
            phase,
            slowed: 2,
            textFace,
            reduced,
            status,
          });
          assertSlowRings(
            view,
            view.run.enemies.filter((enemy) => enemy.type === 'hunter'),
          );

          view.run.time = 3;
          view.run.tick += 1;
          const expired = structuredClone(view.run);
          view.calls.length = 0;
          view.painter.paint(view.run, view.paintOptions);
          assertCrowdingCues(view, [danger, danger], {
            phase,
            textFace,
            reduced,
            status,
            expiredAt: view.run.time,
          });
          assertSlowRings(view, []);
          assert.deepEqual(
            view.run,
            expired,
            'Expiry presentation must not change the actual phase.',
          );
        }
  });

for (const [outcome, banner] of [
  ['cut.joint', '1 + 2 · JOINT CUT'],
  ['team.recovery', '1 + 2 · TEAM RECOVERY'],
])
  test(`212 CSS px required cues remain complete with an active ${outcome} outcome`, (t) => {
    setLocale('uk', { persist: false });
    t.after(() => setLocale('en', { persist: false }));
    for (const textFace of ['plain', 'pixel'])
      for (const reduced of [false, true])
        for (const status of ['running', 'paused']) {
          const options = { textFace, reduced, status },
            baseline = relayCrowdingStudy('patrol', options),
            view = relayCrowdingStudy('patrol', { ...options, outcome });
          assert.ok(
            view.calls.some((call) => call.name === 'measureText' && call.args[0] === banner),
            'The current event must reach outcome presentation; this is not an inactive-feedback test.',
          );
          assert.ok(
            !view.calls.some((call) => call.name === 'fillText' && call.args[0] === banner),
            'The optional full banner is wider than this arena and must not squeeze its text.',
          );
          const labels = assertCrowdingCues(view, ['МИСЛИВЕЦЬ', 'МИСЛИВЕЦЬ'], {
            ...options,
            outcome,
          });
          assert.equal(view.painter.cueLayout.optionalOmitted, 1);
          assert.deepEqual(
            labels,
            paintedCueBounds(baseline),
            'An omitted optional outcome must not disturb any required cue placement.',
          );
        }
  });

test('compact cue packing reuses identical geometry and invalidates changed arena or warnings', (t) => {
  setLocale('uk', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
  const view = relayCrowdingStudy('patrol', {
      textFace: 'plain',
      reduced: true,
      status: 'running',
    }),
    original = paintedCueBounds(view),
    before = structuredClone(view.run);
  assert.equal(view.painter.cueLayout.cached, false);
  view.calls.length = 0;
  view.painter.paint(view.run, view.paintOptions);
  assert.equal(view.painter.cueLayout.cached, true);
  assert.deepEqual(paintedCueBounds(view), original);
  assert.deepEqual(view.run, before);

  view.canvas.clientWidth = 213;
  view.calls.length = 0;
  view.painter.paint(view.run, view.paintOptions);
  assert.equal(view.painter.cueLayout.cached, false);
  const resized = paintedCueBounds(view);
  assert.notDeepEqual(resized, original);
  view.calls.length = 0;
  view.painter.paint(view.run, view.paintOptions);
  assert.equal(view.painter.cueLayout.cached, true);
  assert.deepEqual(paintedCueBounds(view), resized);
  assert.deepEqual(view.run, before);

  for (const enemy of view.run.enemies.filter((actor) => actor.type === 'hunter')) {
    enemy.phase = 'warning';
    enemy.target = 1;
    enemy.targetPoint = { x: view.run.players[1].x, y: view.run.players[1].y };
  }
  const warning = structuredClone(view.run);
  view.calls.length = 0;
  view.painter.paint(view.run, view.paintOptions);
  assert.equal(view.painter.cueLayout.cached, false);
  assert.equal(
    view.calls.filter((call) => call.name === 'fillText' && call.args[0] === 'LOCK 2').length,
    2,
  );
  assert.ok(!view.calls.some((call) => call.name === 'fillText' && call.args[0] === 'МИСЛИВЕЦЬ'));
  assert.deepEqual(view.run, warning);
});

test('a moved locked target invalidates warm packing without changing warning text', (t) => {
  setLocale('uk', { persist: false });
  t.after(() => setLocale('en', { persist: false }));
  const view = relayCrowdingStudy('warning', {
      textFace: 'plain',
      reduced: true,
      status: 'running',
    }),
    previousShield = paintedCueBounds(view).find((label) => label.text === 'ЩИТ').backing,
    hunter = view.run.enemies.find((enemy) => enemy.type === 'hunter'),
    cell = 212 / view.run.width;
  view.calls.length = 0;
  view.painter.paint(view.run, view.paintOptions);
  assert.equal(view.painter.cueLayout.cached, true);
  hunter.targetPoint = {
    x: (previousShield.left + previousShield.right) / 2 / cell,
    y: (previousShield.top + previousShield.bottom) / 2 / cell,
  };
  const before = structuredClone(view.run);
  view.calls.length = 0;
  view.painter.paint(view.run, view.paintOptions);
  assert.equal(view.painter.cueLayout.cached, false);
  assertCrowdingCues(view, ['LOCK 2', 'LOCK 2'], { movedTarget: hunter.targetPoint });
  assert.deepEqual(view.run, before);
});

test('an accepted won picture clears the last compact cue layout', () => {
  const view = relayCrowdingStudy('patrol', {
    textFace: 'plain',
    reduced: true,
    status: 'running',
  });
  assert.ok(view.painter.cueLayout?.requested > 0);
  view.run.status = 'won';
  const before = structuredClone(view.run),
    image = { width: 1152, height: 576 },
    picture = Object.freeze({
      snapshot,
      image,
      choice: Object.freeze({
        kind: 'image',
        levelId: view.run.level.id,
        levelRevision: view.run.level.revision,
      }),
      fit: 'contain',
      sampling: 'nearest',
    });
  view.calls.length = 0;
  view.painter.paint(view.run, { ...view.paintOptions, picture });
  assert.ok(view.calls.some((call) => call.name === 'drawImage' && call.args[0] === image));
  assert.equal(view.calls.filter((call) => call.name === 'fillText').length, 0);
  assert.equal(
    view.painter.cueLayout,
    null,
    'The completed picture cannot expose stale cue counts.',
  );
  assert.deepEqual(view.run, before);
});

test('replacing or removing presentation clears its previous compact cue layout', () => {
  for (const replacement of [snapshot, null]) {
    const view = relayCrowdingStudy('patrol', {
      textFace: 'plain',
      reduced: true,
      status: 'running',
    });
    assert.ok(view.painter.cueLayout?.requested > 0);
    const before = structuredClone(view.run);
    view.painter.setPresentation(replacement);
    assert.equal(view.painter.cueLayout, null);
    view.calls.length = 0;
    view.painter.paint(view.run, view.paintOptions);
    assert.equal(
      view.painter.cueLayout.cached,
      false,
      'Presentation replacement retires old packing.',
    );
    assert.deepEqual(view.run, before);
  }
});
