import { installThemeHost } from '../presentation/theme-host.mjs';
import { TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { loadAcceptedAppearance } from '../presentation/theme-system.mjs';

// A deliberately small, code-owned Classic release. Imported artwork and a
// theme name cannot authorize different sprite bytes or gameplay geometry.
export const CLASSIC_PRESENTATION = Object.freeze({
  id: 'classic-fpv',
  revision: 1,
  assets: Object.freeze([
    Object.freeze({
      slot: 'player.scout.compact',
      sourceAsset: 'player.scout.compact.field-kit@2',
      bytes: 325,
      size: 32,
      sha256: '827da59e870daf2e8548168399449bd894b4cdf7953a1f8ca48a7ed6df8f8d91',
      url: new URL(
        '../presentation/compiled/assets/827da59e870daf2e8548168399449bd894b4cdf7953a1f8ca48a7ed6df8f8d91.png',
        import.meta.url,
      ).href,
    }),
    Object.freeze({
      slot: 'terrain.wall',
      sourceAsset: 'terrain.wall.field-kit@2',
      bytes: 146,
      size: 16,
      sha256: '326d159fab7ab655e40c493e5e3ae27713157b419788134f23363ef222ad27db',
      url: new URL(
        '../presentation/compiled/assets/326d159fab7ab655e40c493e5e3ae27713157b419788134f23363ef222ad27db.png',
        import.meta.url,
      ).href,
    }),
  ]),
});

/** Query pins, compiled edition defaults and accepted context are cosmetic only.
 * Match bootstrap precedence without giving the generic page entry a second
 * display-preference owner before Classic installs its explicit host. */
export function classicAppearanceContext(win = globalThis.window) {
  const pin = (familyId, revision) =>
    /^[a-z][a-z0-9-]{0,63}$/.test(familyId ?? '') && /^r[1-9][0-9]{0,8}$/.test(revision ?? '')
      ? { familyId, revision }
      : null;
  let accepted = null,
    requested = null;
  try {
    const params = new URL(win.location.href).searchParams;
    if (
      params.getAll('appearanceFamily').length === 1 &&
      params.getAll('appearanceRevision').length === 1
    )
      requested = pin(params.get('appearanceFamily'), params.get('appearanceRevision'));
  } catch {
    /* Embedded callers may omit a location. */
  }
  const compiled = win?.document?.documentElement?.dataset ?? {};
  requested ??= pin(compiled.appearanceFamily, compiled.appearanceRevision);
  try {
    accepted = loadAcceptedAppearance(win?.sessionStorage);
  } catch {
    /* Denied storage still permits installed, code-owned themes. */
  }
  requested ??= accepted ? pin(accepted.family.id, accepted.family.revision) : null;
  return {
    appearanceDefault: requested,
    appearanceThemes:
      accepted &&
      accepted.family.id === requested?.familyId &&
      accepted.family.revision === requested.revision
        ? [accepted]
        : [],
  };
}

async function readAsset(response, expected) {
  if (!response.ok || !response.body?.getReader) throw new Error('Classic artwork unavailable.');
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expected) throw new Error('Classic artwork exceeds its exact byte budget.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (size !== expected) throw new Error('Classic artwork byte count differs.');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Owns only shared interface appearance and two verified artwork bitmaps.
 * Gameplay/replay identity does not depend on resources arriving successfully. */
export function createClassicPresentation({
  window: win = globalThis.window,
  document: doc = win?.document ?? globalThis.document,
  displayPreferences,
  onChange = () => {},
  onWarning = () => {},
} = {}) {
  const controller = new AbortController(),
    images = new Map();
  let disposed = false,
    themeSnapshot = null,
    current;
  const theme = installThemeHost({
    document: doc,
    window: win,
    displayPreferences,
    onWarning,
    ...classicAppearanceContext(win),
  });
  function update() {
    if (disposed) return;
    const t = themeSnapshot?.tokens ?? TOKEN_DEFAULTS;
    current = Object.freeze({
      owner: CLASSIC_PRESENTATION.id,
      revision: CLASSIC_PRESENTATION.revision,
      theme: themeSnapshot,
      palette: Object.freeze({
        field: t.ink,
        alternate: t.panel,
        grid: t.line,
        text: t.text,
        muted: t.muted,
        accent: t.amber,
        safe: t.safe ?? t.cyan,
        danger: t.hazard,
      }),
      image: (slot) => (disposed ? null : (images.get(slot) ?? null)),
    });
    queueMicrotask(() => {
      if (!disposed) onChange(current);
    });
  }
  const stop = theme.subscribe((value) => {
    themeSnapshot = value;
    update();
  });
  update();
  const ready = Promise.allSettled(
    CLASSIC_PRESENTATION.assets.map(async (asset) => {
      const response = await win.fetch(asset.url, { signal: controller.signal }),
        bytes = await readAsset(response, asset.bytes),
        digest = new Uint8Array(await win.crypto.subtle.digest('SHA-256', bytes));
      if ([...digest].map((v) => v.toString(16).padStart(2, '0')).join('') !== asset.sha256)
        throw new Error('Classic artwork hash differs.');
      // Hash admission occurs before image decoding; these exact originals have
      // small, declared PNG dimensions. There is no arbitrary user-image decoder.
      const bitmap = await win.createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      if (disposed || bitmap.width !== asset.size || bitmap.height !== asset.size) {
        bitmap.close();
        if (!disposed) throw new Error('Classic artwork dimensions differ.');
        return;
      }
      images.set(asset.slot, bitmap);
      update();
    }),
  ).then((results) => {
    if (!disposed && results.some((row) => row.status === 'rejected'))
      onWarning('Classic vector artwork is active; the verified sprite release is unavailable.');
    return current;
  });
  theme.refresh();
  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    stop();
    theme.dispose();
    for (const image of images.values()) image.close();
    images.clear();
    win?.removeEventListener('pagehide', hide);
  }
  function hide(event) {
    if (!event.persisted) dispose();
  }
  win?.addEventListener('pagehide', hide);
  return Object.freeze({ snapshot: () => current, ready, theme, dispose });
}
