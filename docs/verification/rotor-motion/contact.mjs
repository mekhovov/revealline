import { loadBenchmarkCatalog } from '../../../authoring/playable-benchmark/catalog.mjs';
import { prepareBenchmarkScene } from '../../../authoring/playable-benchmark/scene.mjs';
import { acquireScoutComparison } from '../../../authoring/playable-benchmark/candidate-appearance.mjs';
import { createCoop } from '../../../game/coop/core.mjs';
import { FIRST_CONNECTION } from '../../../game/coop/first-connection.mjs';
import { createCoopPainter } from '../../../game/couch/coop-view.mjs';
import { playerPaintSize } from '../../../game/ui/render.mjs';
import { createAnimationState } from '../../../authoring/motion-lab/animation.mjs';
import { retainControlFocus } from '../../../authoring/game-feel-lab/lifecycle.mjs';

const DIRECTIONS = ['up', 'right', 'down', 'left'];
const BACKGROUNDS = { dark: '#07111c', bright: '#dcc99b' };
const WIDTHS = { solo: [360, 472, 1152, 432], team: [360, 480, 1280] };
const SIZES = [20, 24, 32, 23];
const TILE = 64;
const $ = (id) => document.getElementById(id);
const close = (a, b) => Math.abs(a - b) < 1e-7;
const insist = (condition, message) => {
  if (!condition) throw new Error(message);
};
const raster = (width, height) =>
  Object.assign(document.createElement('canvas'), { width, height });

/** Synthetic copied checkpoints only. Never mutate the shared scene's live run. */
export function contactFixtureRun(base, { mode, placement, heading }) {
  const run = structuredClone(base);
  const width = run.width ?? run.level.width;
  const height = run.height ?? run.level.height;
  const x = ['edge', 'corner'].includes(placement) ? 0.5 : width / 2;
  const y = placement === 'corner' ? 0.5 : height / 2;
  run.status = 'running';
  run.tick = 0;
  run.time = 0;
  run.events = [];
  run.cells.fill(0);
  run.enemies = placement === 'overlap' ? run.enemies.slice(0, 1) : [];
  for (const enemy of run.enemies) Object.assign(enemy, { x: x + 0.8, y: y + 0.3, vx: 0, vy: 0 });
  if (mode === 'solo') {
    Object.assign(run.player, { x, y, direction: DIRECTIONS[heading], graceUntil: 0, speed: 0 });
  } else {
    run.strongholds = [];
    run.supportEffects = [];
    for (const player of run.players)
      Object.assign(player, {
        x: x + (player.id === 0 ? 0 : placement === 'overlap' ? 3 : 10),
        y,
        direction: DIRECTIONS[heading],
        graceUntil: 0,
        cutting: false,
        trail: [],
        status: 'active',
      });
  }
  return run;
}

/** Observe exact renderer arguments independently of Canvas getTransform(),
 * whose returned matrix may already have float32 raster-backend rounding. */
export function contactCommandTransform() {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const multiply = ([a, b, c, d, e, f]) => {
    const [aa, bb, cc, dd, ee, ff] = matrix;
    matrix = [
      aa * a + cc * b,
      bb * a + dd * b,
      aa * c + cc * d,
      bb * c + dd * d,
      aa * e + cc * f + ee,
      bb * e + dd * f + ff,
    ];
  };
  return {
    read() {
      const [a, b, c, d, e, f] = matrix;
      return { a, b, c, d, e, f };
    },
    observe(method, args) {
      if (method === 'save') stack.push(matrix.slice());
      else if (method === 'restore' && stack.length) matrix = stack.pop();
      else if (method === 'scale') multiply([args[0], 0, 0, args[1], 0, 0]);
      else if (method === 'translate') multiply([1, 0, 0, 1, args[0], args[1]]);
      else if (method === 'rotate') {
        const cosine = Math.cos(args[0]),
          sine = Math.sin(args[0]);
        multiply([cosine, sine, -sine, cosine, 0, 0]);
      } else if (method === 'transform') multiply(args);
      else if (method === 'resetTransform') matrix = [1, 0, 0, 1, 0, 0];
      else if (method === 'setTransform')
        matrix =
          args.length === 6
            ? args.slice()
            : ['a', 'b', 'c', 'd', 'e', 'f'].map(
                (key, index) => args[0]?.[key] ?? [1, 0, 0, 1, 0, 0][index],
              );
    },
  };
}

/** Canvas may round its lineWidth getter. Check the renderer's exact accepted
 * assignments while preserving that readback separately as raster evidence. */
export function contactCommandStrokeWidth(initial = 1) {
  let width = initial;
  const stack = [];
  return {
    read: () => width,
    assign(value) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) width = value;
    },
    observe(method) {
      if (method === 'save') stack.push(width);
      else if (method === 'restore' && stack.length) width = stack.pop();
    },
  };
}

/** Real Canvas2D calls plus a read-only command/pixel observer. No cue is suppressed. */
function observeContext(ctx, contacts, playerImage, geometry) {
  const strokes = [],
    bodies = [],
    observedArcStrokes = [];
  let circle = null,
    command = 0,
    lastImage = -1;
  const methods = new Map();
  const transform = contactCommandTransform();
  const strokeWidth = contactCommandStrokeWidth(ctx.lineWidth);
  const proxy = new Proxy(ctx, {
    get(target, key) {
      if (typeof target[key] !== 'function') return target[key];
      if (!methods.has(key))
        methods.set(key, (...args) => {
          const order = ++command;
          transform.observe(key, args);
          strokeWidth.observe(key);
          if (key === 'beginPath') circle = null;
          if (key === 'arc') {
            const m = transform.read();
            const [x, y, radius, start, end] = args;
            circle = {
              x: m.a * x + m.c * y + m.e,
              y: m.b * x + m.d * y + m.f,
              radius: radius * Math.hypot(m.a, m.b),
              start,
              end,
              arguments: [x, y, radius, start, end],
              transform: m,
            };
          }
          if (key === 'drawImage') {
            lastImage = order;
            if (args[0] === playerImage) {
              const m = transform.read();
              const rect = args.length === 9 ? args.slice(5) : args.slice(1);
              const [x, y, width, height] = rect;
              const px = x + width * geometry.pivot.x,
                py = y + height * geometry.pivot.y;
              bodies.push({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f });
            }
          }
          const match =
            key === 'stroke' &&
            circle &&
            contacts.findIndex(
              (contact) =>
                close(circle.x, contact.x) &&
                close(circle.y, contact.y) &&
                close(circle.radius, contact.radius),
            );
          if (key === 'stroke' && circle) {
            const native = target.getTransform();
            observedArcStrokes.push({
              ...circle,
              order,
              commandWidth: strokeWidth.read(),
              nativeReadbackWidth: target.lineWidth,
              nativeTransform: {
                a: native.a,
                b: native.b,
                c: native.c,
                d: native.d,
                e: native.e,
                f: native.f,
              },
              matchedContact: match,
              color: target.strokeStyle,
            });
            if (observedArcStrokes.length > 24) observedArcStrokes.shift();
          }
          if (match !== false && match !== null && match >= 0) {
            const matrix = transform.read();
            const scale = Math.hypot(matrix.a, matrix.b);
            const width = strokeWidth.read() * scale;
            const left = Math.max(0, Math.floor(circle.x - circle.radius - 3));
            const top = Math.max(0, Math.floor(circle.y - circle.radius - 3));
            const w = Math.min(target.canvas.width - left, Math.ceil(circle.radius * 2 + 7));
            const h = Math.min(target.canvas.height - top, Math.ceil(circle.radius * 2 + 7));
            const before = target.getImageData(left, top, w, h).data;
            const value = target[key](...args);
            const after = target.getImageData(left, top, w, h).data;
            const contributions = [];
            for (let i = 0; i < before.length; i += 4)
              if (before.slice(i, i + 4).some((byte, channel) => byte !== after[i + channel]))
                contributions.push({
                  x: left + ((i / 4) % w),
                  y: top + Math.floor(i / 4 / w),
                  rgba: after.slice(i, i + 4),
                });
            strokes.push({
              ...circle,
              contact: match,
              width,
              commandWidth: strokeWidth.read(),
              nativeReadbackWidth: target.lineWidth,
              nativeRasterWidth: target.lineWidth * scale,
              color: target.strokeStyle,
              alpha: target.globalAlpha,
              order,
              changed: contributions.length,
              contributions,
              region: { left, top, width: w, height: h },
            });
            return value;
          }
          return target[key](...args);
        });
      return methods.get(key);
    },
    set(target, key, value) {
      target[key] = value;
      if (key === 'lineWidth') strokeWidth.assign(value);
      return true;
    },
  });
  return {
    ctx: proxy,
    strokes,
    bodies,
    observedArcStrokes,
    get lastImage() {
      return lastImage;
    },
  };
}

function makeEngine(owner, presets) {
  const native = raster(1, 1),
    context = native.getContext('2d', { willReadFrequently: true });
  const teamBase = createCoop(FIRST_CONNECTION);
  const solid = raster(2, 1);
  const theme = owner.painters[0].theme;
  const defaultStyle = owner.painters[0].style;
  let team = null;
  const teamAppearance = (snapshot) => {
    if (snapshot === owner.actors.snapshot) return snapshot;
    for (const id of [1, 2])
      for (const treatment of ['compact', 'detailed'])
        insist(
          owner.actors.snapshot.resolved.assets[`team.pilot.p${id}.normal.${treatment}`]?.recipe
            ?.id === 'team.pilot.v1',
          'This Team release does not inherit the Scout; candidate Team preview is unavailable.',
        );
    // Only inheritance recipes/geometry metadata are borrowed. No approved pin or
    // release/source identity is attached to this unapproved image adapter.
    return { resolved: owner.actors.snapshot.resolved, image: snapshot.image };
  };
  function render(config, snapshot, contactStyle) {
    const { mode, sizeIndex, heading, background, reduced } = config;
    const width = WIDTHS[mode][sizeIndex];
    const run = contactFixtureRun(mode === 'solo' ? owner.session.run : teamBase, config);
    const before = JSON.stringify(run);
    const columns = run.width ?? run.level.width,
      rows = run.height ?? run.level.height;
    native.width = width;
    native.height = Math.round((width * rows) / columns);
    const cell = width / columns;
    const players =
      mode === 'solo' ? [{ ...run.player, radius: run.rules.playerRadius }] : run.players;
    const contacts = players.map((player) => ({
      x: player.x * cell,
      y: player.y * cell,
      radius: player.radius * cell,
    }));
    const treatment = width < 480 ? 'compact' : 'detailed';
    const sprite = snapshot.image(`player.scout.${treatment}`);
    const observer = observeContext(context, contacts, sprite.image, sprite.geometry);
    let diameter;
    if (mode === 'solo') {
      const painter = owner.painters[0];
      painter.setLevel(run.level, { seed: 1 });
      painter.animation = createAnimationState();
      painter.heading = (heading * Math.PI) / 2;
      painter.bank = 0;
      painter.speedRatio = 0;
      painter.theme = { ...theme, coverColor: BACKGROUNDS[background] };
      // Default Solo sizing skips 24px at the compact/desktop threshold.
      // Calibrate through existing bounded cosmetic options, never raster scaling.
      const calibrated = sizeIndex === 1;
      const playerScale = calibrated ? (24 * columns * 16) / (width * 34 * 1.15) : 1;
      painter.style = calibrated ? 'props' : defaultStyle;
      const body = presets.characters['fpv-scout-v1'];
      diameter =
        (playerPaintSize(body, sprite.image, {
          screenScale: width / (columns * 16),
          canvasCSSWidth: width,
          style: painter.style,
          scale: playerScale,
          geometry: sprite.geometry,
        }).diameter *
          cell) /
        16;
      observer.ctx.save();
      observer.ctx.scale(cell / 16, cell / 16);
      painter.draw(observer.ctx, run, 0, {
        paused: true,
        reduced,
        displayCSSWidth: width,
        playerScale,
        actorAppearance: { style: 'fpv', snapshot },
        backdrop: { image: solid, fit: 'contain' },
        feedbackComparison: contactStyle === undefined ? undefined : { contactStyle },
      });
      observer.ctx.restore();
    } else {
      team?.setPresentation(null);
      team = createCoopPainter({
        width: native.width,
        height: native.height,
        clientWidth: width,
        getContext: () => observer.ctx,
      });
      team.setPresentation({
        canvas: { palette: { ...theme.palette, field: BACKGROUNDS[background] }, motionScale: 1 },
        fonts: { ui: '"Field Kit UI", sans-serif', numeric: '"Field Kit Mono", monospace' },
      });
      team.paint(run, {
        reduced,
        actorAppearance: { style: 'fpv', snapshot: teamAppearance(snapshot) },
        feedbackComparison: contactStyle === undefined ? undefined : { contactStyle },
      });
      diameter = (team.actorFrame('pilot', 0).diameter * cell) / 16;
    }
    insist(before === JSON.stringify(run), 'Renderer changed the frozen fixture state.');
    for (const stroke of observer.strokes) {
      const { left, top, width, height } = stroke.region;
      const final = context.getImageData(left, top, width, height).data;
      stroke.visible = stroke.contributions.filter(({ x, y, rgba }) => {
        const offset = ((y - top) * width + x - left) * 4;
        return rgba.every((byte, index) => byte === final[offset + index]);
      }).length;
      delete stroke.contributions;
    }
    let crop;
    // At most two 64x64 readbacks. Retain only pilot 0's canvas for the preview;
    // default and difference checks inspect the independent pixels for both.
    const contactCrops = contacts.map((contact, index) => {
      const canvas = raster(TILE, TILE),
        ctx = canvas.getContext('2d');
      const left = Math.floor(contact.x - TILE / 2),
        top = Math.floor(contact.y - TILE / 2);
      ctx.fillStyle = '#43515b';
      ctx.fillRect(0, 0, TILE, TILE);
      ctx.drawImage(native, -left, -top);
      const pixels = ctx.getImageData(0, 0, TILE, TILE).data;
      if (index === 0) crop = canvas;
      else canvas.width = 0;
      return { pixels, left, top };
    });
    return {
      crop,
      contactCrops,
      contacts,
      diameter,
      observer,
      mode,
      cell,
      config,
    };
  }
  return {
    render,
    dispose() {
      team?.setPresentation(null);
      team = null;
      native.width = 0;
      solid.width = 0;
    },
  };
}

export function equalContactPixels(first, second) {
  return (
    first.contactCrops.length === second.contactCrops.length &&
    first.contactCrops.every((crop, index) => {
      const other = second.contactCrops[index];
      return (
        crop.left === other.left &&
        crop.top === other.top &&
        crop.pixels.length === other.pixels.length &&
        crop.pixels.every((byte, pixel) => byte === other.pixels[pixel])
      );
    })
  );
}

export function compareContactPixels(standard, fine) {
  let changed = 0,
    outside = 0;
  insist(
    standard.contactCrops.length === standard.contacts.length &&
      fine.contactCrops.length === standard.contacts.length,
    'Each expected contact needs its own native crop.',
  );
  for (const [index, crop] of standard.contactCrops.entries()) {
    const other = fine.contactCrops[index];
    insist(
      crop.left === other.left &&
        crop.top === other.top &&
        crop.pixels.length === other.pixels.length,
      'Contact crop geometry differs.',
    );
    for (let i = 0; i < crop.pixels.length; i += 4) {
      if (!crop.pixels.slice(i, i + 4).some((byte, channel) => byte !== other.pixels[i + channel]))
        continue;
      changed++;
      const x = ((i / 4) % TILE) + crop.left + 0.5,
        y = Math.floor(i / 4 / TILE) + crop.top + 0.5;
      const backing = standard.mode === 'solo' ? (3 * standard.cell) / 16 : 3;
      if (
        !standard.contacts.some(
          (contact) =>
            Math.abs(Math.hypot(x - contact.x, y - contact.y) - contact.radius) <=
            backing / 2 + 1.5,
        )
      )
        outside++;
    }
  }
  return { changed, outside };
}

function checkFrame(frame, style) {
  const { observer, contacts, cell, mode } = frame;
  insist(close(frame.diameter, SIZES[frame.config.sizeIndex]), 'Occupied-size target differs.');
  for (let id = 0; id < contacts.length; id++) {
    const strokes = observer.strokes.filter((stroke) => stroke.contact === id);
    insist(
      strokes.length === 2,
      `Expected exactly one two-stroke physical contact circle per pilot. ${JSON.stringify({
        pilot: id,
        expected: contacts[id],
        matched: strokes.length,
        bodies: observer.bodies,
        observedArcStrokes: observer.observedArcStrokes,
      })}`,
    );
    const unit = mode === 'solo' ? cell / 16 : 1;
    insist(
      close(strokes[0].width, (style === 'fine-outline' ? 2 : 3) * unit) &&
        close(strokes[1].width, unit),
      `Contact stroke width differs. ${JSON.stringify({
        expected: [(style === 'fine-outline' ? 2 : 3) * unit, unit],
        observed: strokes.map(
          ({ width, commandWidth, nativeReadbackWidth, nativeRasterWidth }) => ({
            width,
            commandWidth,
            nativeReadbackWidth,
            nativeRasterWidth,
          }),
        ),
      })}`,
    );
    insist(
      strokes.every((stroke) => close(stroke.start, 0) && close(stroke.end, Math.PI * 2)),
      'Physical contact circle is incomplete.',
    );
    insist(
      strokes.every((stroke) => close(stroke.alpha, mode === 'solo' ? 0.85 : 1)),
      'Contact opacity differs.',
    );
    insist(strokes[0].order > observer.lastImage, 'Contact was painted below an actor image.');
    insist(
      strokes[1].changed > 0 && strokes[1].visible > 0,
      'Bright foreground stroke made no surviving visible native pixels.',
    );
  }
  insist(observer.bodies.length > 0, 'The exact native Scout image was not drawn.');
  if (['edge', 'corner'].includes(frame.config.placement))
    insist(
      !close(observer.bodies[0].x, contacts[0].x) || !close(observer.bodies[0].y, contacts[0].y),
      'Edge fixture did not exercise illustration offset.',
    );
}

let scene = null,
  engine = null,
  candidate = null,
  pending = null;
let generation = 0,
  checking = false,
  disposed = false,
  loadedChoice = 'approved';
const snapshot = () => candidate?.snapshot ?? scene?.actors.snapshot;
const cancel = () => {
  generation++;
  pending?.abort();
  pending = null;
  checking = false;
};
function controls() {
  $('check').disabled = !scene || Boolean(pending) || checking;
  $('load').disabled = Boolean(pending) || checking;
  for (const id of ['mode', 'background', 'placement', 'reduced', 'actors'])
    $(id).disabled = checking;
}
function identity() {
  $('identity').textContent = JSON.stringify(
    {
      mission: { id: scene.entry.id, revision: scene.entry.manifest.level.revision },
      approvedActorPin: scene.actors.pin(),
      candidate: candidate?.provenance ?? null,
      fixture: 'Copied state; synthetic field/positions; no simulation advance',
    },
    null,
    2,
  );
}
function makeGrid(activeEngine, activeSnapshot) {
  const fragment = document.createDocumentFragment();
  const config = {
    mode: $('mode').value,
    background: $('background').value,
    placement: $('placement').value,
    reduced: $('reduced').checked,
  };
  for (let sizeIndex = 0; sizeIndex < WIDTHS[config.mode].length; sizeIndex++) {
    const figure = document.createElement('figure'),
      caption = document.createElement('figcaption');
    const width = WIDTHS[config.mode][sizeIndex];
    const calibration =
      config.mode === 'solo' && sizeIndex === 1
        ? ` · calibrated props style / player scale ${((24 * 1152) / (width * 34 * 1.15)).toFixed(8)}; not default gameplay size`
        : ' · default sizing';
    caption.textContent = `${SIZES[sizeIndex]}px native actor envelope · ${width}px board · ${width < 480 ? 'compact' : 'detailed'} source${calibration}`;
    const wrap = document.createElement('div');
    wrap.className = 'pixels';
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = '<span>Standard · ↑ → ↓ ←</span><span>Fine outline · ↑ → ↓ ←</span>';
    const canvas = raster(512, 256),
      ctx = canvas.getContext('2d');
    canvas.setAttribute(
      'aria-label',
      `${config.mode}, ${SIZES[sizeIndex]} pixel actors, standard and fine outline in four headings; below enlarged three times`,
    );
    ctx.imageSmoothingEnabled = false;
    for (const [column, style] of ['standard', 'fine-outline'].entries())
      for (let heading = 0; heading < 4; heading++) {
        const frame = activeEngine.render({ ...config, sizeIndex, heading }, activeSnapshot, style);
        ctx.drawImage(frame.crop, column * 256 + heading * TILE, 0);
        if (heading === 0) ctx.drawImage(frame.crop, column * 256 + 32, 64, 192, 192);
      }
    wrap.append(legend, canvas);
    figure.append(caption, wrap);
    fragment.append(figure);
  }
  return fragment;
}
function paint() {
  if (!engine || disposed || document.hidden) return;
  $('grid').replaceChildren(makeGrid(engine, snapshot()));
}
async function load() {
  cancel();
  const controller = new AbortController();
  pending = controller;
  const ticket = generation,
    choice = $('actors').value;
  const owned = () => !disposed && generation === ticket && !controller.signal.aborted;
  const restore = retainControlFocus($('load'), document);
  let nextScene = null,
    nextCandidate = null,
    nextEngine = null;
  $('status').textContent =
    choice === 'v5'
      ? 'Checking v5 manifest, source fingerprints, native PNG bytes and geometry…'
      : 'Loading the approved exact actor lease…';
  controls();
  try {
    if (!scene) {
      const [catalog, response] = await Promise.all([
        loadBenchmarkCatalog(),
        fetch(new URL('../../../authoring/motion-lab/presets.json', import.meta.url), {
          signal: controller.signal,
        }),
      ]);
      insist(response.ok, 'Character presets are unavailable.');
      const presets = await response.json();
      nextScene = await prepareBenchmarkScene(catalog.entries[0], {
        catalog,
        presets,
        signal: controller.signal,
      });
      nextEngine = makeEngine(nextScene, presets);
    }
    const source = nextScene ?? scene;
    if (choice === 'v5')
      nextCandidate = await acquireScoutComparison(source.actors.snapshot, {
        construction: 'reference-v5',
        signal: controller.signal,
      });
    if (!owned()) return;
    const grid = makeGrid(nextEngine ?? engine, nextCandidate?.snapshot ?? source.actors.snapshot);
    const previous = candidate;
    scene = source;
    engine = nextEngine ?? engine;
    candidate = nextCandidate;
    nextScene = null;
    nextEngine = null;
    nextCandidate = null;
    loadedChoice = choice;
    previous?.release();
    identity();
    $('grid').replaceChildren(grid);
    $('status').textContent =
      `Ready. ${choice === 'v5' ? 'V5 is an unapproved source override.' : 'Exact approved FPV actors loaded.'} Static native crops; checks have not run.`;
    $('report').textContent = 'Checks have not run for this source.';
  } catch (error) {
    if (owned()) {
      $('actors').value = loadedChoice;
      $('status').textContent = `Could not load: ${error.message} Previous accepted view remains.`;
    }
  } finally {
    nextCandidate?.release();
    nextEngine?.dispose();
    nextScene?.dispose();
    if (owned()) {
      pending = null;
      controls();
    }
    restore(owned());
  }
}
async function check() {
  if (!engine || pending || checking) return;
  cancel();
  checking = true;
  const ticket = generation,
    current = snapshot();
  const owned = () => !disposed && ticket === generation && !document.hidden;
  const restore = retainControlFocus($('check'), document);
  controls();
  $('status').textContent = 'Checking bounded native fixtures…';
  let cases = 0,
    changed = 0,
    comparedContactCrops = 0;
  try {
    for (const mode of ['solo', 'team'])
      for (const reduced of [false, true])
        for (const background of ['dark', 'bright'])
          for (const placement of ['interior', 'edge', 'corner', 'overlap'])
            for (let sizeIndex = 0; sizeIndex < WIDTHS[mode].length; sizeIndex++) {
              // Extra natural 23px coverage is bounded to interior fixtures.
              if (sizeIndex === 3 && placement !== 'interior') continue;
              await new Promise((resolve) => setTimeout(resolve, 0));
              if (!owned()) return;
              for (let heading = 0; heading < 4; heading++) {
                const config = { mode, reduced, background, placement, sizeIndex, heading };
                const label = JSON.stringify(config);
                try {
                  const standard = engine.render(config, current, 'standard');
                  const fine = engine.render(config, current, 'fine-outline');
                  const omitted = engine.render(config, current, undefined);
                  checkFrame(standard, 'standard');
                  checkFrame(fine, 'fine-outline');
                  insist(
                    equalContactPixels(standard, omitted),
                    'Explicit standard changed omitted/default raster.',
                  );
                  const difference = compareContactPixels(standard, fine);
                  insist(
                    difference.changed > 0 && difference.outside === 0,
                    'Style difference was absent or escaped contact region.',
                  );
                  changed += difference.changed;
                  comparedContactCrops += standard.contactCrops.length;
                  cases++;
                } catch (error) {
                  throw new Error(`${label}: ${error.message}`);
                }
              }
            }
    if (owned()) {
      $('report').textContent = JSON.stringify(
        {
          status: 'pass',
          source: loadedChoice,
          cases,
          nativeRenders: cases * 3,
          comparedContactCrops,
          nativeContactCrops: comparedContactCrops * 3,
          changedPixelsAcrossContactCrops: changed,
          pixelScope:
            'One native 64×64 crop per expected pilot contact; overlapping crops count repeated pixels separately. Preview shows the first pilot only.',
          solo24Calibration: {
            viewportWidth: 472,
            occupiedPixels: 24,
            style: 'props',
            playerScale: (24 * 1152) / (472 * 34 * 1.15),
            defaultGameplaySize: false,
          },
          extraNaturalSolo: {
            viewportWidth: 432,
            occupiedPixels: 23,
            cases: 16,
            placement: 'interior',
          },
          checks: [
            'Exact true-circle centre/radius and complete arc',
            'Unchanged bright width and visible pixel contribution',
            'Contact above all actor images',
            '20/24/32 occupied-size envelopes',
            'Illustration offset at edges',
            'Omitted/default native raster identity in every pilot crop',
            'Changes bounded to contact regions in every pilot crop',
            'No fixture state mutation',
          ],
          limitation:
            'Actual renderer pixel evidence on synthetic frozen checkpoints; not human readability, mission, art, performance or device approval.',
        },
        null,
        2,
      );
      $('status').textContent =
        `${cases} native fixture comparisons passed. Human readability remains a separate review.`;
    }
  } catch (error) {
    if (owned()) {
      $('status').textContent = 'A native fixture check failed.';
      $('report').textContent = error.message;
    }
  } finally {
    if (owned()) {
      checking = false;
      controls();
    }
    restore(owned());
  }
}
function suspend() {
  cancel();
  controls();
  $('actors').value = loadedChoice;
  $('status').textContent = scene
    ? 'Paused static study. Any pending load or check was cancelled.'
    : 'Loading was cancelled. Choose Load exact sources to retry.';
}
function dispose() {
  if (disposed) return;
  cancel();
  disposed = true;
  engine?.dispose();
  candidate?.release();
  scene?.dispose();
  engine = null;
  candidate = null;
  scene = null;
}
if (typeof document !== 'undefined') {
  $('load').addEventListener('click', load);
  $('actors').addEventListener('change', load);
  $('check').addEventListener('click', check);
  for (const id of ['mode', 'background', 'placement', 'reduced'])
    $(id).addEventListener('change', () => {
      try {
        paint();
      } catch (error) {
        $('status').textContent = `Could not render: ${error.message}`;
      }
    });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) suspend();
    else dispose();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      controls();
      paint();
    }
  });
  load();
}
