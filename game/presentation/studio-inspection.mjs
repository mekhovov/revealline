import { resolvePresentation, presentationCoverage, LIMITS } from './model.mjs';
import { encodePresentationDocument } from './document-codec.mjs';
import { createThemeCandidate } from './theme-preview.mjs';
import { resolvePresentation as resolveInterface, getInterfaceTheme } from './theme-system.mjs';

function luminance(color) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    .map((value) => {
      const c = parseInt(value, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function tokenContrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

/** Evidence describes exact selected revisions. Token checks do not certify
 * textured backgrounds, screenshots, motion readability, or actual rendering. */
export function inspectStudioTheme(document, slotId = document.slots[0].id, options = {}) {
  const resolved = resolvePresentation(document);
  const coverage = presentationCoverage(document);
  const slot = document.slots.find((row) => row.id === slotId);
  if (!slot) throw new Error('Unknown Studio asset slot.');
  const asset = resolved.assets[slotId];
  const files = new Map(
    document.assets.filter((row) => row.file).map((row) => [row.file.sha256, row.file]),
  );
  const selectedFiles = new Map(
    Object.values(resolved.assets)
      .filter((row) => row.file)
      .map((row) => [row.file.sha256, row.file]),
  );
  const candidate = createThemeCandidate(document, options),
    runtime = resolveInterface({
      themeFamily: candidate.family,
      interfaceTheme: candidate.interfaceTheme,
      interfaceBasis: candidate.basis,
    }),
    base = getInterfaceTheme(candidate.basis.interfaceId, candidate.basis.interfaceRevision);
  const contrast = [
    ['text', 'panel', 4.5],
    ['muted', 'panel', 4.5],
    ['text', 'panelRaised', 4.5],
    ['cyan', 'panel', 3],
  ].map(([foreground, background, minimum]) => {
    const ratio = tokenContrast(resolved.tokens[foreground], resolved.tokens[background]);
    return {
      foreground,
      background,
      ratio,
      minimum,
      passes: ratio >= minimum,
      scope: 'solid-token-only',
    };
  });
  for (const [role, component] of Object.entries(runtime.components)) {
    const pairs = { ...component.states, selected: component.selection };
    for (const [state, pair] of Object.entries(pairs)) {
      const ratio = tokenContrast(pair.foreground, pair.background),
        minimum = state === 'disabled' ? 3 : 4.5;
      contrast.push({
        role,
        state,
        foreground: pair.foreground,
        background: pair.background,
        ratio,
        minimum,
        passes: ratio >= minimum,
        scope: 'resolved-component-solid-center',
      });
    }
    for (const surface of ['panel', 'panelRaised']) {
      const ratio = tokenContrast(component.focus.color, runtime.tokens[surface]);
      contrast.push({
        role,
        state: 'focus',
        foreground: component.focus.color,
        background: runtime.tokens[surface],
        ratio,
        minimum: 3,
        passes: ratio >= 3,
        scope: 'focus-ring-adjacent-surface',
      });
    }
  }
  return {
    format: 'revealline-theme-inspection.v2',
    document: { id: document.id, revision: document.revision },
    theme: resolved.theme,
    coverage,
    contrast,
    candidate: {
      format: candidate.format,
      basis: candidate.basis,
      sourcePalette: {
        document: candidate.source,
        theme: resolved.theme,
        source: 'workspace-authored',
        note: 'Colors come from this selected workspace revision; the family supplies component recipes and declared engine dependencies.',
      },
      recipeProvenance: base.provenance,
      interfaceRevision: candidate.interfaceTheme.revision,
      components: Object.keys(runtime.components),
      reviewRequired: [
        'textured edges',
        'actual focus and input behavior',
        'artwork silhouettes',
        'motion readability',
        'SIM flight visibility',
      ],
    },
    bytes: {
      metadata: new TextEncoder().encode(encodePresentationDocument(document)).byteLength,
      metadataLimit: LIMITS.manifestBytes,
      selectedFiles: [...selectedFiles.values()].reduce((sum, file) => sum + file.bytes, 0),
      historyFiles: [...files.values()].reduce((sum, file) => sum + file.bytes, 0),
      uniqueFiles: files.size,
    },
    role: {
      id: slot.id,
      label: slot.label,
      screens: slot.screens,
      states: slot.states,
      asset: asset
        ? {
            id: asset.id,
            revision: asset.revision,
            kind: asset.kind,
            recipe: asset.recipe,
            file: asset.file,
            geometry: asset.geometry,
            provenance: asset.provenance,
            quality: asset.quality,
          }
        : null,
      dependencies: slot.dependencies.map((id) => ({ id, asset: resolved.bindings[id] ?? null })),
    },
  };
}
