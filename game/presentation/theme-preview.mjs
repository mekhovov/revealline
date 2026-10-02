import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import { validateThemeBundle, resolvePresentation } from './model.mjs';
import {
  getThemeFamily,
  getInterfaceTheme,
  validateThemeFamily,
  validateInterfaceTheme,
  THEME_TOKEN_NAMES,
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  derivePairedThemeTokens,
} from './theme-system.mjs';

import { candidateIdentity, validateThemeCandidate, THEME_PREVIEW_LIMIT } from './theme-system.mjs';
export { validateThemeCandidate, THEME_PREVIEW_LIMIT } from './theme-system.mjs';
const prefix = 'revealline.theme-preview.v1.';
const latestKey = `${prefix}latest`;
const lifetime = 30 * 60 * 1000;
const previewId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** Candidate identity is separate from both the authoring document and immutable
 * built-ins. SIM resources are declarations supplied by the installed engine;
 * this contract never accepts resource URLs, shader code or executable CSS. */
export function candidateFromPresentation(
  { source, resolved },
  {
    familyId = 'industrial-workshop',
    familyRevision,
    interfaceId,
    interfaceRevision,
    format = 'ThemeCandidate.v2',
  } = {},
) {
  const legacy = format === 'ThemeCandidate.v1';
  const builtin = getThemeFamily(familyId, familyRevision ?? (legacy ? 'r1' : undefined));
  required(builtin, 'Unknown candidate family.');
  const base = getInterfaceTheme(
    interfaceId ?? builtin.interface.id,
    interfaceRevision ?? (legacy ? 'r1' : interfaceId ? undefined : builtin.interface.revision),
  );
  required(base, 'Unknown candidate interface.');
  const basis = legacy
    ? { familyId, interfaceId: base.id }
    : {
        familyId,
        familyRevision: builtin.revision,
        interfaceId: base.id,
        interfaceRevision: base.revision,
      };
  let tokens = {
    ...base.tokens,
    ...Object.fromEntries(
      THEME_TOKEN_NAMES.filter((key) => resolved.tokens[key]).map((key) => [
        key,
        resolved.tokens[key],
      ]),
    ),
    accent: resolved.tokens.amber,
    safe: resolved.tokens.success,
  };
  if (base.format === 'InterfaceTheme.v2') tokens = derivePairedThemeTokens(tokens);
  const draftInterface = {
    ...base,
    revision: 'r1',
    name: resolved.theme.name.slice(0, 80),
    tokens,
    provenance: {
      author: 'RevealLine Studio candidate',
      license: 'workspace-authored',
      source: `workspace:${source.id}@${source.revision}; interface:${base.id}@${base.revision}`,
    },
  };
  const candidateId = candidateIdentity(source, basis, draftInterface);
  const interfaceTheme = validateInterfaceTheme({ ...draftInterface, id: candidateId });
  const family = validateThemeFamily({
    ...builtin,
    id: candidateId,
    revision: 'r1',
    name: interfaceTheme.name,
    interface: { id: interfaceTheme.id, revision: interfaceTheme.revision },
  });
  return validateThemeCandidate({
    format,
    source,
    basis,
    family,
    interfaceTheme,
    simDependency: builtin.sim
      ? {
          kind: 'installed-engine-builtin',
          collection: BUILTIN_SIM_VISUAL_COLLECTIONS[builtin.sim.id],
        }
      : null,
  });
}

export function createThemeCandidate(source, options) {
  const document = validateThemeBundle(source);
  return candidateFromPresentation(
    {
      source: { id: document.id, revision: document.revision },
      resolved: resolvePresentation(document),
    },
    studioCandidateOptions(document, options),
  );
}

/** Saved exact pins win over omitted options. An explicit different family or
 * interface starts a new basis instead of borrowing the old family's pins. */
export function studioCandidateOptions(source, options = {}) {
  const document = validateThemeBundle(source);
  const explicit = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
  const basis = { ...document.appearanceBasis };
  if (explicit.familyId && explicit.familyId !== basis.familyId) {
    delete basis.familyRevision;
    delete basis.interfaceId;
    delete basis.interfaceRevision;
  } else if (explicit.interfaceId && explicit.interfaceId !== basis.interfaceId) {
    delete basis.interfaceRevision;
  }
  return { ...basis, ...explicit };
}

/** Curated interface candidates use engine-owned art. Reject changed selected
 * source assets instead of claiming that their images/fonts/audio were applied. */
export function unsupportedThemeAssignmentSlots(source, installedSource) {
  const selected = resolvePresentation(validateThemeBundle(source));
  const installed = resolvePresentation(validateThemeBundle(installedSource));
  return Object.freeze(
    [...new Set([...Object.keys(selected.assets), ...Object.keys(installed.assets)])].filter(
      (slot) =>
        canonicalJSON(selected.assets[slot] ?? null) !==
        canonicalJSON(installed.assets[slot] ?? null),
    ),
  );
}

/** One bounded, expiring preview per tab. A same-tab authoring navigation keeps
 * sessionStorage; there is no player preference, save or publication mutation. */
export function saveThemePreview(
  storage,
  candidate,
  { id = globalThis.crypto.randomUUID(), now = Date.now() } = {},
) {
  required(typeof id === 'string' && previewId.test(id), 'Invalid preview key.');
  required(
    Number.isSafeInteger(now) && now >= 0 && now <= Number.MAX_SAFE_INTEGER - lifetime,
    'Invalid preview clock.',
  );
  const value = validateThemeCandidate(candidate);
  const text = canonicalJSON({
    format: 'ThemePreview.v1',
    expires: now + lifetime,
    candidate: value,
  });
  required(
    new TextEncoder().encode(text).byteLength <= THEME_PREVIEW_LIMIT,
    'Theme preview exceeds its byte budget.',
  );
  const previous = storage.getItem(latestKey);
  storage.setItem(`${prefix}${id}`, text);
  try {
    storage.setItem(latestKey, id);
  } catch (error) {
    storage.removeItem(`${prefix}${id}`);
    throw error;
  }
  if (previous !== id && previewId.test(previous ?? '')) storage.removeItem(`${prefix}${previous}`);
  return id;
}

export function loadThemePreview(storage, id, { now = Date.now() } = {}) {
  required(typeof id === 'string' && previewId.test(id), 'Invalid preview key.');
  const key = `${prefix}${id}`,
    text = storage.getItem(key);
  required(typeof text === 'string', 'Candidate preview unavailable; reopen it from Asset Studio.');
  // Consume even a malformed or expired payload; never leave a poisoned retry.
  storage.removeItem(key);
  if (storage.getItem(latestKey) === id) storage.removeItem(latestKey);
  const value = boundedJSON(text, {
    maxBytes: THEME_PREVIEW_LIMIT,
    maxNodes: 620,
    maxDepth: 9,
    maxArray: 40,
  });
  exactKeys(value, ['format', 'expires', 'candidate'], 'theme preview');
  required(
    value.format === 'ThemePreview.v1' &&
      Number.isSafeInteger(value.expires) &&
      Number.isSafeInteger(now) &&
      value.expires > now &&
      value.expires <= now + lifetime,
    'Candidate preview expired or has an invalid clock.',
  );
  return validateThemeCandidate(value.candidate);
}
