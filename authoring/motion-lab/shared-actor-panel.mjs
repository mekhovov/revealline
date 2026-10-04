import { getLocale, localizedText, t } from '../../game/i18n/index.mjs';
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../../game/hunt/actor-catalog.mjs';
import {
  drawHuntActor,
  OVERHEAD_ACTOR_ART_REVISION,
  INDUSTRIAL_ROSTER_ART_REVISION,
} from '../../game/hunt/actor-art.mjs';
import { actorArtReviewRevision } from '../../game/hunt/preferences.mjs';
import { pageActorArtPool } from '../../game/presentation/actor-art-pool.mjs';
import { createPreviewLoop } from './preview-loop.mjs';
import { ACTOR_FRAME_FIELDS, createSharedActorStudy } from './shared-actor-study.mjs';

let instance = 0;
const key = (name) => `tools:motionLab.sharedActor.${name}`;
const headings = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

/** A secondary shared-rig editor. The older player sandbox retains its own
 * contracts. Only one of the two previews receives explicit playback intent. */
export function mountSharedActorPanel({
  root,
  document: doc = root.ownerDocument,
  window: host = doc.defaultView ?? globalThis.window,
  reducedEffects = false,
  onPlay = () => {},
}) {
  const artRevision =
      actorArtReviewRevision(host?.location) === INDUSTRIAL_ROSTER_ART_REVISION
        ? INDUSTRIAL_ROSTER_ART_REVISION
        : OVERHEAD_ACTOR_ART_REVISION,
    study = createSharedActorStudy({ artRevision }),
    listeners = [],
    pool = pageActorArtPool(doc);
  const identity = `motion-actor-${++instance}`;
  let disposed = false,
    playing = false,
    reduced = reducedEffects,
    leases = [],
    pending = null;
  const listen = (node, type, fn) => {
    node.addEventListener(type, fn);
    listeners.push(() => node.removeEventListener(type, fn));
  };
  const node = (tag, text, id) => {
    const element = doc.createElement(tag);
    if (id) element.id = `shared-actor-${id}`;
    if (text) localizedText(element, () => t(key(text)));
    return element;
  };
  const field = (name, control) => {
    const wrapper = node('div'),
      label = node('label', name);
    wrapper.className = 'field';
    label.htmlFor = control.id;
    wrapper.append(label, control);
    return wrapper;
  };
  const button = (name) => {
    const element = node('button', name, name);
    element.type = 'button';
    return element;
  };
  const select = (id, choices) => {
    const element = node('select', null, id);
    for (const [value, label] of choices) {
      const option = node('option');
      option.value = value;
      localizedText(option, label);
      element.append(option);
    }
    return element;
  };
  const translated = (names) => names.map((name) => [name, () => t(key(name))]);
  root.append(node('summary', 'title'), node('p', 'scope'));
  const controls = node('div');
  controls.className = 'shared-actor-controls';
  const family = select(
    'family',
    ACTOR_FAMILIES.map((item) => [item.id, () => item.name[getLocale() === 'uk' ? 'uk' : 'en']]),
  );
  const cast = select(
    'cast',
    ACTOR_CASTS.map((item) => [item.id, () => item.name[getLocale() === 'uk' ? 'uk' : 'en']]),
  );
  const heading = select('heading', translated(Object.keys(headings)));
  const clip = select('clip', []),
    frame = select('frame', []);
  const background = select('background', translated(['dark', 'light']));
  family.value = 'courier';
  cast.value = 'rivals';
  heading.value = 'up';
  background.value = 'dark';
  controls.append(
    field('family', family),
    field('cast', cast),
    field('heading', heading),
    field('clip', clip),
    field('frame', frame),
    field('background', background),
  );
  const actions = node('div');
  actions.className = 'shared-actor-actions';
  const play = button('play'),
    previous = button('previous'),
    next = button('next');
  actions.append(play, previous, next);
  const overlay = node('input', null, 'overlay');
  overlay.type = 'checkbox';
  overlay.checked = true;
  const overlayLabel = node('label');
  overlayLabel.className = 'check';
  overlayLabel.append(overlay, node('span', 'overlay'));
  const loopControl = node('input', null, 'loop');
  loopControl.type = 'checkbox';
  const loopLabel = node('label');
  loopLabel.className = 'check';
  loopLabel.append(loopControl, node('span', 'loop'));
  actions.append(overlayLabel, loopLabel);
  const specimens = node('div');
  specimens.className = 'shared-actor-specimens';
  const samples = [16, 24, 32, 112].map((size) => {
    const figure = node('figure'),
      canvas = node('canvas');
    const caption = node('figcaption');
    canvas.width = canvas.height = 0;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = canvas.style.height = `${size + 32}px`;
    canvas.close = () => {
      canvas.width = canvas.height = 0;
    };
    localizedText(caption, () => t(key('specimen'), { size }));
    figure.append(canvas, caption);
    specimens.append(figure);
    return { canvas, size };
  });
  const readout = node('p', null, 'readout'),
    effects = node('p', null, 'effects');
  const edit = node('div');
  edit.className = 'shared-actor-controls';
  const inputs = {};
  for (const [name, bounds] of Object.entries(ACTOR_FRAME_FIELDS)) {
    const input = node('input', null, name);
    input.type = 'number';
    input.min = bounds.min;
    input.max = bounds.max;
    input.step = 1;
    inputs[name] = input;
    edit.append(field(name, input));
  }
  const exchange = node('details'),
    source = node('textarea', null, 'source');
  source.rows = 12;
  source.spellcheck = false;
  source.maxLength = 131072;
  const importButton = button('import'),
    exportButton = button('export');
  const exchangeActions = node('div');
  exchangeActions.className = 'shared-actor-actions';
  exchangeActions.append(importButton, exportButton);
  const studio = node('a', 'studio');
  studio.href = '../asset-studio/';
  studio.setAttribute('data-workshop-tool', 'asset-studio');
  exchange.append(
    node('summary', 'exchange'),
    node('p', 'handoff'),
    field('source', source),
    exchangeActions,
    studio,
  );
  const status = node('p', 'ready', 'status');
  status.setAttribute('role', 'status');
  root.append(
    controls,
    actions,
    specimens,
    node('p', 'specimens'),
    readout,
    effects,
    edit,
    node('p', 'editing'),
    exchange,
    status,
  );
  source.value = study.exportJSON();
  const showStatus = (name) => localizedText(status, () => t(key(name)));

  function sync({ rebuild = false } = {}) {
    if (disposed) return;
    const value = study.snapshot({ reducedEffects: reduced });
    if (rebuild) {
      clip.replaceChildren();
      for (const name of Object.keys(value.descriptor.clips)) {
        const option = node('option', name);
        option.value = name;
        clip.append(option);
      }
      clip.value = value.clip;
      frame.replaceChildren();
      value.descriptor.clips[value.clip].frames.forEach((id, index) => {
        const option = node('option');
        option.value = String(index);
        option.textContent = `${index + 1} · ${id}`;
        frame.append(option);
      });
    }
    frame.value = String(value.frameIndex);
    for (const [name, input] of Object.entries(inputs)) input.value = String(value.frame[name]);
    inputs.accessory.disabled =
      artRevision !== INDUSTRIAL_ROSTER_ART_REVISION &&
      (value.family !== 'courier' || !value.descriptor.parts.includes('satchel'));
    loopControl.checked = value.descriptor.clips[value.clip].loop;
    localizedText(play, () => t(key(playing ? 'pause' : 'play')));
    play.setAttribute('aria-pressed', String(playing));
    play.disabled = leases.length !== samples.length;
    localizedText(readout, () =>
      t(key('frameReadout'), {
        id: value.descriptor.id,
        revision: value.descriptor.revision,
        frame: value.frameIndex + 1,
        count: value.descriptor.clips[value.clip].frames.length,
        visible: value.visibleFrame.id,
      }),
    );
    localizedText(effects, () => t(key(reduced ? 'reduced' : 'full')));
  }

  function draw() {
    if (disposed || !root.open || leases.length !== samples.length) return;
    const value = study.snapshot({ reducedEffects: reduced });
    for (const { canvas, size } of samples) {
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = background.value === 'light' ? '#d4dcc5' : '#101923';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawHuntActor(ctx, 16, 16, size, 0, {
        family: value.family,
        cast: cast.value,
        heading: heading.value,
        artRevision,
        animation: value.descriptor,
        animationClip: value.clip,
        state: value.clip,
        timeMs: value.timeMs,
        reducedEffects: reduced,
        armed: value.family === 'guard',
        shadow: false,
      });
      if (overlay.checked) {
        const center = 16 + size / 2,
          [dx, dy] = headings[heading.value];
        ctx.strokeStyle = '#6ce0f6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(center - 2, center);
        ctx.lineTo(center + 2, center);
        ctx.moveTo(center, center - 2);
        ctx.lineTo(center, center + 2);
        ctx.moveTo(center, center);
        ctx.lineTo(center + dx * (size / 2 + 8), center + dy * (size / 2 + 8));
        ctx.stroke();
      }
    }
  }
  function pause() {
    if (disposed) return;
    playing = false;
    preview.setRunning(false);
    sync();
  }
  function release() {
    pending?.abort();
    pending = null;
    for (const lease of leases) lease.release();
    leases = [];
  }
  async function open() {
    release();
    sync();
    const controller = new AbortController();
    pending = controller;
    try {
      for (const { canvas, size } of samples) {
        const lease = await pool.acquire({
          key: `${identity}:${size}`,
          width: size + 32,
          height: size + 32,
          signal: controller.signal,
          load() {
            canvas.width = canvas.height = size + 32;
            return canvas;
          },
        });
        if (disposed || pending !== controller || !root.open) {
          lease.release();
          return;
        }
        leases.push(lease);
      }
      showStatus('ready');
      sync();
      draw();
    } catch (error) {
      if (!disposed && pending === controller) {
        release();
        if (error.name !== 'AbortError') showStatus('unavailable');
        sync();
      }
    } finally {
      if (pending === controller) pending = null;
    }
  }
  const preview = createPreviewLoop({
    document: doc,
    window: host,
    onFrame(_time, dt) {
      if (!reduced) study.advance(dt * 1000);
      sync();
      draw();
    },
    onInterrupt: pause,
    onPageHide: release,
    onDispose() {
      disposed = true;
      playing = false;
      release();
      listeners.splice(0).forEach((remove) => remove());
    },
  });
  const change = (operation, rebuild = false) => {
    if (disposed) return;
    // Do not refresh controls before reading the just-edited native value.
    playing = false;
    preview.setRunning(false);
    try {
      operation();
      showStatus('edited');
    } catch (error) {
      showStatus(error.message === 'atlas' ? 'atlas' : 'invalid');
    }
    sync({ rebuild });
    draw();
  };
  listen(root, 'toggle', (event) => {
    if (event.target !== root) return;
    if (root.open) void open();
    else {
      pause();
      release();
      sync();
    }
  });
  listen(host, 'pageshow', () => {
    if (root.open && !disposed) void open();
  });
  listen(play, 'click', () => {
    if (disposed || !root.open || leases.length !== samples.length || !preview.canRun) return;
    if (playing) pause();
    else {
      onPlay();
      playing = true;
      preview.setRunning(true);
      sync();
    }
  });
  listen(root, 'keydown', (event) => {
    if (event.key === 'Escape') {
      pause();
      event.stopPropagation();
    }
  });
  listen(previous, 'click', () => change(() => study.stepFrame(-1)));
  listen(next, 'click', () => change(() => study.stepFrame(1)));
  listen(family, 'change', () => change(() => study.selectFamily(family.value), true));
  listen(clip, 'change', () => change(() => study.selectClip(clip.value), true));
  listen(frame, 'change', () => change(() => study.seekFrame(Number(frame.value))));
  listen(loopControl, 'change', () => change(() => study.setLoop(loopControl.checked)));
  for (const input of [cast, heading, background, overlay]) listen(input, 'change', draw);
  for (const [name, input] of Object.entries(inputs)) {
    listen(input, 'focus', pause);
    listen(input, 'change', () =>
      change(() => study.editFrame({ [name]: input.value === '' ? NaN : Number(input.value) })),
    );
  }
  listen(source, 'focus', pause);
  listen(importButton, 'click', () => change(() => study.importJSON(source.value), true));
  listen(exportButton, 'click', () => {
    if (disposed) return;
    pause();
    source.value = study.exportJSON();
    showStatus('exported');
  });
  preview.setReady();
  sync({ rebuild: true });
  if (root.open) void open();
  return Object.freeze({
    pause,
    refresh() {
      sync();
      draw();
    },
    setReducedEffects(value) {
      reduced = value === true;
      sync();
      draw();
    },
    dispose: preview.dispose,
  });
}
