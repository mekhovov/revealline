import { createPresentationHost } from '../presentation/host.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { loadAcceptedAppearance } from '../presentation/theme-system.mjs';
import { actorArtReviewRevision } from '../hunt/preferences.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import {
  selectedArcadeCollection,
  industrialTexturePixels,
} from '../presentation/industrial-arcade.mjs';

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

/** Uses the same authenticated board-art provider as Capture and Team.
 * Gameplay/replay identity does not depend on resources arriving successfully. */
export function createClassicPresentation({
  window: win = globalThis.window,
  document: doc = win?.document ?? globalThis.document,
  displayPreferences,
  onChange = () => {},
  onWarning = () => {},
} = {}) {
  const controller = new AbortController(),
    derived = new Map(),
    artwork = createPresentationHost({
      profile: 'board',
      document: doc,
      fetch: (...args) => win.fetch(...args),
    });
  let disposed = false,
    themeSnapshot = null,
    artRevision = actorArtReviewRevision(win?.location),
    current;
  function clearDerived() {
    for (const canvas of derived.values()) canvas.width = canvas.height = 0;
    derived.clear();
  }
  function imageFor(slot) {
    if (disposed) return null;
    const frame = artwork.current()?.image(slot),
      image = frame?.image ?? null,
      collection = selectedArcadeCollection(theme.effectivePreferences());
    if (!image || slot !== 'terrain.wall' || collection?.id !== 'military-field') return image;
    if (
      frame.asset?.id !== `${slot}.field-kit` ||
      !INDUSTRIAL_BUILTIN_SPRITES[slot]?.includes(frame.asset?.file?.sha256)
    )
      return image;
    if (derived.has(slot)) return derived.get(slot);
    try {
      const canvas = doc.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return image;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      pixels.data.set(
        industrialTexturePixels(
          { width: canvas.width, height: canvas.height, rgba: pixels.data },
          slot,
          collection,
          { reviewRevision: artRevision },
        ).rgba,
      );
      context.putImageData(pixels, 0, 0);
      derived.set(slot, canvas);
      return canvas;
    } catch {
      return image;
    }
  }
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
      image: imageFor,
      asset: (slot) => artwork.current()?.image(slot) ?? null,
      actorArtBudget: () => artwork.current()?.actorArtBudget() ?? null,
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
  const ready = artwork
    .load({ signal: controller.signal })
    .then(() => {
      update();
      return current;
    })
    .catch(() => {
      if (!disposed)
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
    artwork.close();
    clearDerived();
    win?.removeEventListener('pagehide', hide);
  }
  function hide(event) {
    if (!event.persisted) dispose();
  }
  win?.addEventListener('pagehide', hide);
  return Object.freeze({
    snapshot: () => current,
    ready,
    theme,
    async readAudio(slot, options) {
      await ready;
      const snapshot = artwork.current();
      if (disposed || slot !== 'audio.pickup' || snapshot?.resolved.assets[slot]?.kind !== 'audio')
        return null;
      return artwork.readAudio(slot, { ...options, snapshot });
    },
    setArtRevision(revision) {
      if (revision === artRevision) return;
      artRevision = revision;
      clearDerived();
    },
    dispose,
  });
}
