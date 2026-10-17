import { overflightFieldKitArt } from '../../game/presentation/overflight-field-kit-art.mjs';
import {
  overflightEffectLayers,
  paintOverflightEffectGeometry,
  OVERFLIGHT_MOTION_PROFILE,
} from '../../game/presentation/overflight-motion.mjs';
import { t, localizedText, localizedAttribute } from '../../game/i18n/index.mjs';

/** A scrubbed source preview uses the same bounded profile as the horde renderer. */
export function mountOverflightMotionPanel(root) {
  if (!root) return { dispose() {} };
  const doc = root.ownerDocument;
  const el = (tag, key) => {
    const node = doc.createElement(tag);
    if (key) localizedText(node, () => t(key));
    return node;
  };
  const summary = el('summary', 'tools:motionLab.overflightEffects.heading');
  const note = el('p', 'tools:motionLab.overflightEffects.description');
  const select = el('select');
  localizedAttribute(select, 'aria-label', () => t('tools:motionLab.overflightEffects.effect'));
  for (const [kind, key] of [
    ['drop', 'tools:motionLab.overflightEffects.drop'],
    ['pulse', 'tools:motionLab.overflightEffects.pulse'],
    ['warning', 'tools:motionLab.overflightEffects.warning'],
    ['hostile-impact', 'tools:motionLab.overflightEffects.hostileImpact'],
    ['slow-field', 'tools:motionLab.overflightEffects.slowField'],
    ['chain', 'tools:motionLab.overflightEffects.chain'],
  ]) {
    const option = el('option', key);
    option.value = kind;
    select.append(option);
  }
  const age = el('input');
  age.type = 'range';
  age.min = '0';
  age.max = '100';
  age.value = '25';
  localizedAttribute(age, 'aria-label', () =>
    t('tools:motionLab.overflightEffects.animationProgress'),
  );
  const reduced = el('input');
  reduced.type = 'checkbox';
  const reducedLabel = el('label', 'tools:motionLab.overflightEffects.reducedEffects');
  reducedLabel.prepend(reduced);
  const canvas = el('canvas');
  canvas.width = 320;
  canvas.height = 180;
  canvas.style.imageRendering = 'pixelated';
  canvas.setAttribute('role', 'img');
  localizedAttribute(canvas, 'aria-label', () => t('tools:motionLab.overflightEffects.preview'));
  const frames = new Map();
  const sourceFrame = (layer) => {
    const key = `${layer.frame}:${layer.tint}`;
    if (frames.has(key)) return frames.get(key);
    const source = el('canvas');
    const pixels = overflightFieldKitArt(layer.frame);
    source.width = source.height = pixels ? 16 : 48;
    const context = source.getContext('2d');
    if (pixels) {
      const data = context.createImageData(16, 16);
      data.data.set(pixels.rgba);
      context.putImageData(data, 0, 0);
    } else if (
      !paintOverflightEffectGeometry(context, layer.frame, {
        color: `#${layer.tint.toString(16).padStart(6, '0')}`,
      })
    )
      throw new Error(`Unknown shared Overflight effect frame: ${layer.frame}`);
    frames.set(key, source);
    return source;
  };
  const readout = el('output');
  function draw() {
    const kind = select.value,
      layers = overflightEffectLayers({
        kind,
        age: Number(age.value) / 100,
        life: 1,
        radius: 38,
        x: 0,
        y: 0,
        x2: 78,
        y2: -22,
        reducedEffects: reduced.checked,
      });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111a16';
    ctx.fillRect(0, 0, 320, 180);
    // The same atlas template pixels, logical sizes, tint and layer order as
    // native play. Only the specimen origin differs from a world-space effect.
    for (const layer of layers) {
      ctx.save();
      ctx.translate((kind === 'chain' ? 120 : 160) + layer.dx, 90 + layer.dy);
      ctx.rotate(layer.rotation);
      ctx.globalAlpha = layer.alpha;
      ctx.drawImage(
        sourceFrame(layer),
        -layer.width / 2,
        -layer.height / 2,
        layer.width,
        layer.height,
      );
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    readout.textContent = `${OVERFLIGHT_MOTION_PROFILE.id}@${OVERFLIGHT_MOTION_PROFILE.revision} · ${age.value}%`;
  }
  for (const control of [select, age, reduced]) control.addEventListener('input', draw);
  root.replaceChildren(summary, note, select, age, reducedLabel, canvas, readout);
  draw();
  return {
    dispose() {
      for (const control of [select, age, reduced]) control.removeEventListener('input', draw);
      for (const source of frames.values()) source.width = source.height = 0;
      frames.clear();
      canvas.width = canvas.height = 0;
    },
    refresh: draw,
  };
}
