import { createCurrentArtPreview } from '../../game/presentation/current-art.mjs';
import {
  playerRecipePreview,
  boardContextPreview,
  audioRecipePreview,
  effectRecipePreview,
  componentPreview,
  pickupKinds,
} from './scene-preview.mjs';
import { applyPresentation, canvasPresentation } from '../../game/presentation/runtime.mjs';
import { createActorPresentation, drawPresentedActor } from '../../game/ui/actor-presentation.mjs';
import { drawClassicTerrain, drawPickupIcon } from '../../game/ui/classic-view.mjs';
const fonts = new Map();
const text = (tag, value, className = '') => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
};
export async function drawAssetPreview(
  surface,
  slot,
  asset,
  resolved,
  blobs,
  { mode, background, geometry, motion = 'paused', state = 'default' },
) {
  const marker = {};
  surface.previewMarker = marker;
  surface.previewCleanup?.();
  surface.replaceChildren();
  surface.dataset.background = background;
  const urls = [];
  const unapply = applyPresentation(surface, resolved);
  const cleanups = [];
  const own = (cleanup) => (surface.previewMarker === marker ? cleanups.push(cleanup) : cleanup());
  const options = { mode, motion, state, isCurrent: () => surface.previewMarker === marker };
  surface.previewCleanup = () => {
    urls.forEach(URL.revokeObjectURL);
    cleanups.forEach((cleanup) => cleanup());
    unapply();
  };
  if (!asset) {
    surface.append(text('p', 'No binding. Upload a candidate for this slot.'));
    return;
  }
  for (const id of ['font.display', 'font.ui', 'font.numeric']) {
    const fontAsset = resolved.assets[id];
    if (fontAsset?.kind !== 'font') continue;
    const family = `RLAsset-${fontAsset.file.sha256}`,
      fontBlob = blobs.get(fontAsset.file.sha256);
    if (!fontBlob) throw new Error(`Missing bytes for ${id}. Re-import the complete theme bundle.`);
    if (!fonts.has(family))
      fonts.set(
        family,
        new FontFace(family, await fontBlob.arrayBuffer()).load().then((font) => {
          document.fonts.add(font);
          return font;
        }),
      );
    await fonts.get(family);
    if (surface.previewMarker !== marker) return;
  }
  const blob = asset.file && blobs.get(asset.file.sha256);
  if (asset.file && !blob) {
    surface.append(text('p', 'File bytes are unavailable. Re-import the complete bundle.'));
    return;
  }
  if (asset.kind === 'audio') {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    urls.push(url);
    audio.src = url;
    audio.controls = true;
    audio.preload = 'metadata';
    surface.append(audio);
    return;
  }
  if (asset.kind === 'font') {
    const family = `RLAsset-${asset.file.sha256}`;
    if (!fonts.has(family))
      fonts.set(
        family,
        new FontFace(family, await blob.arrayBuffer()).load().then((font) => {
          document.fonts.add(font);
          return font;
        }),
      );
    await fonts.get(family);
    if (surface.previewMarker !== marker) return;
    const sample = text(
      'div',
      'Лінія зв’язку · ПОЛІТ\nҐґ Єє Іі Її Йй Щщ\nEnglish · 0123456789 ₴',
      'font-file-sample',
    );
    sample.style.fontFamily = family;
    surface.append(sample);
    return;
  }
  const palette = canvasPresentation(resolved).palette;
  if (asset.kind === 'recipe' && slot.group === 'pictures') {
    const loader = createCurrentArtPreview();
    own(() => loader.close());
    surface.append(text('p', 'Loading exact current picture…'));
    try {
      const source = await loader.load(slot.id);
      if (surface.previewMarker !== marker) return;
      surface.replaceChildren();
      if (mode === 'context') {
        await boardContextPreview(
          surface,
          slot,
          asset,
          resolved,
          blobs,
          { ...options, sourcePicture: source },
          own,
        );
      } else {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          `${source.descriptor.label} — exact current source preview`,
        );
        canvas.width = source.image.width;
        canvas.height = source.image.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source.image, 0, 0);
        if (mode === 'alpha') {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let at = 0; at < pixels.data.length; at += 4) {
            const alpha = pixels.data[at + 3];
            pixels.data[at] = alpha;
            pixels.data[at + 1] = alpha;
            pixels.data[at + 2] = alpha;
            pixels.data[at + 3] = 255;
          }
          ctx.putImageData(pixels, 0, 0);
        }
        if (mode === 'native') {
          canvas.style.width = `${canvas.width}px`;
          canvas.style.maxWidth = 'none';
        }
        surface.append(canvas);
      }
      if (surface.previewMarker === marker)
        surface.append(
          text(
            'small',
            `${source.descriptor.label} · ${source.origin.label} · ${source.fit} · source stage`,
            'bounded-label',
          ),
        );
    } catch (error) {
      if (surface.previewMarker !== marker) return;
      surface.replaceChildren(text('p', error.message));
      const retry = text('button', 'Retry exact source');
      retry.type = 'button';
      retry.onclick = () =>
        drawAssetPreview(surface, slot, asset, resolved, blobs, {
          mode,
          background,
          geometry,
          motion,
          state,
        });
      surface.append(retry);
    }
    return;
  }

  if (
    mode === 'context' &&
    ['players', 'motion', 'enemies', 'terrain', 'pickups', 'effects', 'pictures'].includes(
      slot.group,
    )
  ) {
    await boardContextPreview(surface, slot, asset, resolved, blobs, options, own);
    return;
  }
  if (asset.kind === 'recipe' && slot.id.startsWith('player.')) {
    await playerRecipePreview(surface, slot, resolved, blobs, options, own);
    return;
  }
  if (asset.kind === 'recipe' && slot.group === 'audio') {
    audioRecipePreview(surface, slot, own);
    return;
  }
  if (asset.kind === 'recipe' && slot.group === 'effects') {
    effectRecipePreview(surface, slot, resolved, options, own);
    return;
  }
  if (asset.kind === 'recipe' && slot.id === 'terrain.wall') {
    await boardContextPreview(surface, slot, asset, resolved, blobs, options, own);
    return;
  }
  if (
    mode === 'context' &&
    (slot.group === 'screens' || slot.group === 'ui' || slot.group === 'icons')
  ) {
    let url = null;
    if (blob) {
      const bitmap = await createImageBitmap(blob),
        frame = asset.geometry.frame,
        canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      canvas
        .getContext('2d')
        .drawImage(
          bitmap,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          0,
          0,
          frame.width,
          frame.height,
        );
      bitmap.close();
      url = canvas.toDataURL('image/png');
      if (surface.previewMarker !== marker) return;
    }
    componentPreview(surface, slot, { ...options, assetGeometry: asset.geometry }, url);
    return;
  }
  if (asset.kind === 'image') {
    const bitmap = await createImageBitmap(blob);
    if (surface.previewMarker !== marker) {
      bitmap.close();
      return;
    }
    const frame = asset.geometry.frame,
      canvas = document.createElement('canvas');
    const contextual = mode === 'context';
    canvas.width = contextual ? 320 : frame.width;
    canvas.height = contextual ? 200 : frame.height;
    canvas.setAttribute('aria-label', `${slot.label} ${mode} preview`);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = slot.sampling !== 'nearest';
    const scale = contextual ? Math.min(1, 140 / frame.width, 120 / frame.height) : 1;
    const x = contextual ? (320 - frame.width * scale) / 2 : 0,
      y = contextual ? (200 - frame.height * scale) / 2 : 0;
    if (contextual) field(ctx, palette);
    ctx.drawImage(
      bitmap,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      x,
      y,
      frame.width * scale,
      frame.height * scale,
    );
    bitmap.close();
    if (mode === 'alpha') {
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let at = 0; at < pixels.data.length; at += 4) {
        const a = pixels.data[at + 3];
        pixels.data[at] = a;
        pixels.data[at + 1] = a;
        pixels.data[at + 2] = a;
        pixels.data[at + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    }
    if (geometry) drawGeometry(ctx, asset.geometry, x, y, scale);
    if (!contextual) {
      const displayScale =
        mode === 'native'
          ? 1
          : Math.max(1, Math.min(8, Math.floor(260 / Math.max(frame.width, frame.height))));
      canvas.style.width = `${frame.width * displayScale}px`;
      canvas.style.maxWidth = mode === 'native' ? 'none' : '100%';
    }
    surface.append(canvas);
    return;
  }
  if (slot.group === 'fonts') {
    const sample = text('div', '', 'recipe-sample');
    sample.append(
      text('p', 'Flight ready · Політ готовий', `font-${slot.id.split('.')[1]}`),
      text('p', 'Ґґ Єє Іі Її · 0123456789 ₴'),
      text('small', 'Bundled production font / source recipe', 'bounded-label'),
    );
    surface.append(sample);
    return;
  }
  if (
    slot.id.startsWith('enemy.') ||
    slot.id.startsWith('terrain.') ||
    slot.id.startsWith('pickup.')
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    field(ctx, palette);
    if (slot.id.startsWith('enemy.')) {
      const type = slot.id.slice(6),
        frames = createActorPresentation().sample(
          [{ id: 'preview', type, x: 10, y: 6, vx: 0, vy: 0 }],
          { paused: true, reduced: true, themeId: 'fpv' },
        );
      drawPresentedActor(ctx, frames.get('preview'), palette);
    }
    if (slot.id.startsWith('terrain.')) {
      const kind = slot.id.endsWith('slow') ? 'slow' : 'lethal';
      drawClassicTerrain(
        ctx,
        {
          terrain: Array.from({ length: 8 }, (_, i) => ({
            x: 7 + (i % 4),
            y: 5 + Math.floor(i / 4),
            kind,
          })),
        },
        palette,
      );
    }
    if (slot.id.startsWith('pickup.')) {
      ctx.translate(160, 100);
      ctx.scale(3, 3);
      ctx.fillStyle = palette.accent;
      const kind = pickupKinds[slot.id.slice(7)];
      if (kind) drawPickupIcon(ctx, kind);
      else {
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.fillRect(-1, -4, 2, 8);
        ctx.fillRect(-4, -1, 8, 2);
      }
    }
    surface.append(
      canvas,
      text('small', 'Bounded sample · actual game drawing helper', 'bounded-label'),
    );
    return;
  }
  componentPreview(surface, slot, options);
}
function field(ctx, palette) {
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, 320, 200);
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= 320; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 200);
    ctx.stroke();
  }
  for (let y = 0; y <= 200; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(320, y);
    ctx.stroke();
  }
  ctx.strokeStyle = palette.safe;
  ctx.strokeRect(16, 16, 288, 168);
}
function drawGeometry(ctx, geometry, x, y, scale) {
  const w = geometry.frame.width * scale,
    h = geometry.frame.height * scale;
  ctx.save();
  ctx.lineWidth = Math.max(0.5, scale);
  ctx.strokeStyle = '#78dce8';
  const b = geometry.occupiedBounds;
  if (b) ctx.strokeRect(x + b.x * w, y + b.y * h, b.width * w, b.height * h);
  const p = geometry.pivot;
  ctx.fillStyle = '#f07879';
  ctx.fillRect(x + p.x * w - 1, y + p.y * h - 1, 2, 2);
  for (const rotor of geometry.rotorAnchors) {
    ctx.beginPath();
    ctx.arc(x + rotor.x * w, y + rotor.y * h, rotor.radius * Math.min(w, h), 0, Math.PI * 2);
    ctx.stroke();
  }
  const n = geometry.nineSlice;
  if (n) {
    ctx.strokeStyle = '#f4bf62';
    ctx.strokeRect(
      x + n.left * scale,
      y + n.top * scale,
      w - (n.left + n.right) * scale,
      h - (n.top + n.bottom) * scale,
    );
  }
  ctx.restore();
}
