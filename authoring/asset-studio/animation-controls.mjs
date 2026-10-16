import { getLocale, localizedText } from '../../game/i18n/index.mjs';
import {
  createSoldierAnimation,
  validateActorAnimation,
  sampleActorAnimation,
  ACTOR_CLIPS,
} from '../../game/presentation/actor-animation.mjs';
import { pageActorArtPool } from '../../game/presentation/actor-art-pool.mjs';
import { drawHuntActor } from '../../game/hunt/actor-art.mjs';
import { actorArtReviewRevision } from '../../game/hunt/preferences.mjs';

let previewSequence = 0;

export function sameActorAnimationContext(owner, next) {
  return (
    !!owner &&
    !!next &&
    !!owner.document &&
    owner.document === next.document &&
    owner.asset?.id === next.asset?.id &&
    owner.asset?.revision === next.asset?.revision &&
    owner.slot?.id === next.slot?.id
  );
}

/** Edits the existing immutable Asset Studio document. Save, undo, .rltheme
 * export/import and theme ownership remain the parent Studio's responsibility. */
export function mountActorAnimationControls({
  document,
  after,
  getContext,
  onApply,
  onError,
  drawActor = drawHuntActor,
}) {
  const root = document.createElement('details');
  const words = (en, uk) => () => (getLocale() === 'uk' ? uk : en);
  const node = (tag, en, uk = en) => {
    const element = document.createElement(tag);
    if (en) localizedText(element, words(en, uk));
    return element;
  };
  root.append(node('summary', 'Actor animation · advanced', 'Анімація персонажа · додатково'));
  root.append(
    node(
      'p',
      'Clips change artwork only. Facing, warnings and vulnerability belong to gameplay. Stage a revision, then use the usual Save or Export collection actions.',
      'Кліпи змінюють лише зображення. Напрямок, попередження та вразливість визначає гра. Підготуйте версію, а потім збережіть або експортуйте колекцію.',
    ),
  );
  const load = node('button', 'Load current actor', 'Завантажити поточного персонажа');
  const preview = node('button', 'Check and preview', 'Перевірити та переглянути');
  const apply = node('button', 'Stage animation revision', 'Підготувати версію анімації');
  for (const button of [load, preview, apply]) {
    button.type = 'button';
    root.append(button);
  }
  const label = node('label', 'Animation descriptor', 'Опис анімації');
  const input = node('textarea');
  input.rows = 12;
  input.spellcheck = false;
  input.style.width = '100%';
  label.append(input);
  root.append(label);
  const clipLabel = node('label', 'Clip ', 'Кліп '),
    clips = node('select');
  for (const name of ACTOR_CLIPS) {
    const option = node('option', name);
    option.value = name;
    clips.append(option);
  }
  clipLabel.append(clips);
  root.append(clipLabel);
  const frameLabel = node('label', 'Presentation time (ms) ', 'Час показу (мс) '),
    time = node('input');
  time.type = 'range';
  time.min = 0;
  time.max = 0;
  time.step = 1;
  time.value = 0;
  const timeReadout = node('output'),
    showTime = () =>
      localizedText(
        timeReadout,
        () => `${time.value} / ${time.max} ${getLocale() === 'uk' ? 'мс' : 'ms'}`,
      );
  showTime();
  frameLabel.append(time, timeReadout);
  root.append(frameLabel);
  const headingLabel = node('label', 'Facing ', 'Напрямок '),
    heading = node('select');
  for (const [en, uk, value] of [
    ['North', 'Північ', 'up'],
    ['East', 'Схід', 'right'],
    ['South', 'Південь', 'down'],
    ['West', 'Захід', 'left'],
  ]) {
    const option = node('option', en, uk);
    option.value = value;
    heading.append(option);
  }
  headingLabel.append(heading);
  root.append(headingLabel);
  const specimens = node('div');
  specimens.style.display = 'flex';
  specimens.style.flexWrap = 'wrap';
  specimens.style.gap = '16px';
  const previewKey = `studio-animation-preview:${++previewSequence}`;
  // Each specimen keeps a 1:1 CSS/backing-pixel scale. The cards wrap instead
  // of shrinking a large atlas preview on a phone. Every backing is pooled.
  const samples = [16, 24, 32, 112].map((size, index) => {
    const figure = node('figure'),
      canvas = node('canvas'),
      label = node('figcaption', `${size} px`, `${size} пкс`),
      width = size + 32,
      height = 144;
    figure.style.margin = '0';
    figure.style.flex = '0 0 144px';
    canvas.width = canvas.height = 0;
    canvas.close = () => {
      canvas.width = canvas.height = 0;
    };
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.imageRendering = 'pixelated';
    figure.append(canvas, label);
    specimens.append(figure);
    return { canvas, size, width, height, light: index % 2 === 1, key: `${previewKey}:${size}` };
  });
  root.append(
    specimens,
    node(
      'p',
      '16 / 24 / 32 px and enlarged. Samples wrap without shrinking. Cyan line = authoritative facing. Transparent pixels are preserved.',
      '16 / 24 / 32 пкс і збільшення. Зразки переносяться без зменшення. Блакитна лінія — фактичний напрямок. Прозорість збережено.',
    ),
  );
  after.after(root);
  let owner = null,
    descriptor = null,
    lease = null,
    canvasLeases = [],
    generation = 0,
    pending = null,
    disposed = false;
  const release = () => {
    generation++;
    pending?.abort();
    pending = null;
    lease?.release();
    lease = null;
    for (const backing of canvasLeases) backing.release();
    canvasLeases = [];
  };
  function current() {
    const next = getContext();
    if (disposed || !sameActorAnimationContext(owner, next))
      throw new Error('The selected asset changed; load it again before staging animation.');
    return next;
  }
  function syncClipControls() {
    if (!descriptor) return;
    const requested = clips.value;
    for (const option of clips.children) {
      const supported = Object.hasOwn(descriptor.clips, option.value);
      option.disabled = !supported;
      option.hidden = !supported;
    }
    // Aim/Fire are optional. A missing clip must not silently show Idle under
    // another label, including after the author edits the descriptor.
    clips.value = Object.hasOwn(descriptor.clips, requested) ? requested : 'idle';
    const duration = descriptor.clips[clips.value].frames.reduce(
      (sum, id) => sum + descriptor.frames.find((frame) => frame.id === id).durationMs,
      0,
    );
    // Every admitted frame is reachable, including the final frame of a long
    // non-looping clip. Sampling exactly duration would wrap a looping clip.
    time.max = duration - 1;
    const previous = Number(time.value);
    time.value = Math.min(duration - 1, Math.max(0, Number.isFinite(previous) ? previous : 0));
    showTime();
  }
  function draw() {
    if (
      disposed ||
      !descriptor ||
      canvasLeases.length !== samples.length ||
      (descriptor.rig === 'sprite.v1' && !lease)
    )
      return;
    if (!sameActorAnimationContext(owner, getContext())) {
      invalidate();
      return;
    }
    for (const { canvas, size, light } of samples) {
      const ctx = canvas.getContext('2d'),
        x = 16,
        y = 16;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = light ? '#d4dcc5' : '#101923';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (descriptor.rig === 'overhead-soldier.v1') {
        const clip = ACTOR_CLIPS.includes(clips.value) ? clips.value : 'idle',
          stationaryAim = clip === 'aim' || clip === 'fire';
        // The selected clip controls only this preview's descriptor sampler.
        // Pose vocabulary stays separate from native gameplay vulnerability.
        drawActor(ctx, x, y, size, 0, {
          animation: descriptor,
          animationClip: clip,
          timeMs: Number(time.value),
          state:
            clip === 'move'
              ? 'walk'
              : clip === 'recovery'
                ? 'recover'
                : clip === 'anticipation' || stationaryAim
                  ? 'warning'
                  : clip,
          phase:
            clip === 'anticipation'
              ? 'warning'
              : clip === 'recovery'
                ? 'rest'
                : stationaryAim
                  ? clip
                  : undefined,
          heading: heading.value,
          artRevision: actorArtReviewRevision() ?? 'industrial-pilot-v1',
        });
      } else if (lease) {
        const frame = sampleActorAnimation(descriptor, {
          clip: clips.value,
          timeMs: Number(time.value),
        }).region;
        ctx.save();
        ctx.translate(x + size / 2, y + size / 2);
        ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[heading.value]);
        ctx.drawImage(
          lease.image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          -descriptor.anchors.pivot.x * size,
          -descriptor.anchors.pivot.y * size,
          size,
          size,
        );
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[heading.value]);
      ctx.strokeStyle = '#72dceb';
      ctx.beginPath();
      ctx.moveTo(0, -size / 2 - 2);
      ctx.lineTo(0, -size / 2 - 7);
      ctx.stroke();
      ctx.restore();
    }
  }
  async function check() {
    const context = current();
    descriptor = validateActorAnimation(input.value, {
      width: context.asset.file?.width,
      height: context.asset.file?.height,
    });
    syncClipControls();
    release();
    const ticket = generation;
    const controller = new AbortController();
    pending = controller;
    const obsolete = () =>
      disposed || ticket !== generation || !sameActorAnimationContext(owner, getContext());
    try {
      for (const { canvas, key, width, height } of samples) {
        const output = await pageActorArtPool(document).acquire({
          key,
          width,
          height,
          signal: controller.signal,
          load: () => {
            canvas.width = width;
            canvas.height = height;
            return canvas;
          },
        });
        if (obsolete()) {
          output.release();
          if (ticket === generation) release();
          return;
        }
        canvasLeases.push(output);
      }
      if (descriptor.rig === 'sprite.v1') {
        const file = context.asset.file,
          blob = context.blob;
        const next = await pageActorArtPool(document).acquire({
          key: file.sha256,
          width: file.width,
          height: file.height,
          signal: controller.signal,
          load: () => createImageBitmap(blob),
        });
        if (obsolete()) {
          next.release();
          if (ticket === generation) release();
          return;
        }
        lease = next;
      }
      draw();
    } catch (error) {
      if (obsolete()) {
        if (ticket === generation) release();
        return;
      }
      release();
      throw error;
    } finally {
      if (pending === controller) pending = null;
    }
  }
  const failed = (error) => {
    if (error.name !== 'AbortError' && !disposed) onError(error);
  };
  function invalidate() {
    release();
    owner = null;
    descriptor = null;
    for (const { canvas } of samples)
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  load.onclick = () => {
    try {
      release();
      owner = getContext();
      if (owner.slot?.group !== 'enemies' || owner.asset?.kind !== 'image')
        throw new Error(
          'Select an enemy image slot; procedural rigs are reviewed in the art sample.',
        );
      const base = structuredClone(
        createSoldierAnimation('studio-actor-clips', ['torso', 'arms', 'boots']),
      );
      if (owner.asset.kind === 'image') {
        base.anchors.pivot = { ...owner.asset.geometry.pivot };
        base.rig = 'sprite.v1';
        base.frames = base.frames.map((frame) => ({
          ...frame,
          region: owner.asset.geometry.frame,
        }));
      }
      input.value = JSON.stringify(owner.asset.animation ?? base, null, 2);
      void check().catch(failed);
    } catch (error) {
      onError(error);
    }
  };
  preview.onclick = () => void check().catch(failed);
  apply.onclick = () => {
    try {
      const context = current();
      const value = validateActorAnimation(input.value, {
        width: context.asset.file?.width,
        height: context.asset.file?.height,
      });
      onApply(value, context.asset);
      release();
      owner = null;
    } catch (error) {
      onError(error);
    }
  };
  time.oninput = () => {
    showTime();
    draw();
  };
  heading.oninput = draw;
  clips.oninput = () => {
    syncClipControls();
    draw();
  };
  root.addEventListener('toggle', () => {
    if (!root.open) release();
  });
  return {
    refresh() {
      if (owner && !sameActorAnimationContext(owner, getContext())) invalidate();
    },
    suspend: invalidate,
    dispose() {
      if (disposed) return;
      invalidate();
      disposed = true;
      root.remove();
    },
  };
}
