import { localizedText } from '../i18n/index.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { huntText } from '../hunt/copy.mjs';
import {
  createHuntDestruction,
  drawHumanoidPixelBody,
  drawHuntRemains,
} from '../hunt/destruction.mjs';

export function attachDestructionControls({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  container,
  prefix = '',
  getStorage,
  writable,
  reduced = () =>
    doc.body?.dataset.effects === 'reduced' ||
    win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
} = {}) {
  const preferences = createDestructionPreferences({
    window: win,
    ...(getStorage ? { getStorage } : {}),
    ...(writable ? { writable } : {}),
  });
  const root = doc.createElement('div');
  root.className = 'hunt-destruction-controls';
  const input = (name, labelKey) => {
    const label = doc.createElement('label');
    label.className = 'settings-check';
    const control = doc.createElement('input');
    control.type = 'checkbox';
    control.id = `${prefix}${name}`;
    const span = doc.createElement('span');
    localizedText(span, () => huntText(labelKey));
    label.append(control, span);
    root.append(label);
    return control;
  };
  const brutal = input('brutal-destruction', 'brutal'),
    blood = input('blood-body-parts', 'blood');
  const help = doc.createElement('p');
  help.className = 'micro-note';
  localizedText(help, () => huntText('brutalHelp'));
  root.append(help);
  const status = doc.createElement('p');
  status.className = 'micro-note';
  status.setAttribute('role', 'status');
  root.append(status);
  const retry = doc.createElement('button');
  retry.type = 'button';
  localizedText(retry, () => huntText('retry'));
  root.append(retry);
  const preview = doc.createElement('button');
  preview.type = 'button';
  localizedText(preview, () => huntText('preview'));
  root.append(preview);
  const canvas = doc.createElement('canvas');
  canvas.width = 320;
  canvas.height = 120;
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  root.append(canvas);
  container?.append(root);
  const fx = createHuntDestruction({ preview: true, onPreempt: () => stopPreview() });
  let frame = null,
    revision = 0,
    disposed = false;
  const stopPreview = () => {
    revision++;
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    canvas.hidden = true;
    fx.reset();
  };
  const render = (choice) => {
    brutal.checked = choice.brutal;
    blood.checked = choice.blood;
    blood.disabled = !choice.brutal;
    status.hidden = retry.hidden = choice.durable;
    localizedText(status, () => (choice.durable ? '' : huntText('saving')));
    stopPreview();
  };
  const visibility = () => {
    if (doc.hidden) stopPreview();
  };
  const reducedMedia = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  doc.addEventListener('visibilitychange', visibility);
  reducedMedia?.addEventListener?.('change', stopPreview);
  const unsubscribe = preferences.subscribe(render);
  const chooseBrutal = () => preferences.set({ brutal: brutal.checked });
  const chooseBlood = () => preferences.set({ blood: blood.checked });
  const save = () => preferences.retry();
  const animate = () => {
    stopPreview();
    const currentRevision = revision;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.hidden = false;
    let began = null,
      previous = null;
    const view = { valid: true, eliminations: [] },
      owner = {};
    const draw = (now) => {
      if (disposed || doc.hidden || currentRevision !== revision) {
        stopPreview();
        return;
      }
      began ??= now;
      previous ??= now;
      const age = (now - began) / 1000,
        choice = preferences.snapshot();
      view.eliminations =
        age >= 0.55
          ? [{ id: 'preview-runner', kind: 'runner', cause: 'ram', x: 10, y: 3.75, tick: 1 }]
          : [];
      fx.advance(view, (now - previous) / 1000, { key: owner, ...choice, reduced: reduced() });
      if (currentRevision !== revision) return;
      previous = now;
      ctx.fillStyle = '#181e25';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!view.eliminations.length) {
        ctx.save();
        ctx.translate(144, 44);
        ctx.scale(2, 2);
        drawHumanoidPixelBody(ctx, { kind: 'runner' });
        ctx.restore();
      } else drawHuntRemains(ctx, view.eliminations[0], { unit: 2, ...choice });
      fx.draw(ctx, { unit: 2 });
      if (age < 1.8) frame = win.requestAnimationFrame(draw);
      else frame = null;
    };
    frame = win.requestAnimationFrame(draw);
  };
  brutal.addEventListener('change', chooseBrutal);
  blood.addEventListener('change', chooseBlood);
  retry.addEventListener('click', save);
  preview.addEventListener('click', animate);
  win?.addEventListener?.('pagehide', stopPreview);
  return Object.freeze({
    snapshot: preferences.snapshot,
    dispose() {
      disposed = true;
      stopPreview();
      unsubscribe();
      preferences.dispose();
      brutal.removeEventListener('change', chooseBrutal);
      blood.removeEventListener('change', chooseBlood);
      retry.removeEventListener('click', save);
      preview.removeEventListener('click', animate);
      win?.removeEventListener?.('pagehide', stopPreview);
      doc.removeEventListener('visibilitychange', visibility);
      reducedMedia?.removeEventListener?.('change', stopPreview);
      root.remove();
    },
  });
}
