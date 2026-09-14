import { FORMATS, validateThemeBundle, resolvePresentation } from './model.mjs';
import { canonicalJSON } from '../data-json.mjs';

const reference = (record) => ({ id: record.id, revision: record.revision });
const same = (a, b) => a.id === b.id && a.revision === b.revision;
export function nextAssetRevision(document, slotId) {
  const id = `${slotId}.custom`;
  return {
    id,
    revision:
      Math.max(
        0,
        ...document.assets.filter((asset) => asset.id === id).map((asset) => asset.revision),
      ) + 1,
  };
}
/** Append immutable records; historical files remain referenced in the bundle. */
export function reviseStudioTheme(source, { assets = [], bindings = {}, tokens = {} } = {}) {
  const previous = validateThemeBundle(source);
  const next = structuredClone(previous);
  const current = next.themes.find((theme) => same(theme, next.selection.theme));
  const collection =
    next.selection.collection &&
    next.collections.find((item) => same(item, next.selection.collection));
  next.assets.push(...structuredClone(assets));
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(
        ...next.themes.filter((item) => item.id === current.id).map((item) => item.revision),
      ) + 1,
    parent: reference(current),
    tokens: { ...tokens },
    bindings: { ...collection?.bindings, ...bindings },
  };
  next.themes.push(theme);
  next.selection.theme = reference(theme);
  next.selection.collection = null;
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
/** A whole collection is checked before it becomes the selected presentation. */
export function replaceStudioCollection(
  source,
  { id, name, requiredSlots, bindings, assets = [] },
) {
  const previous = validateThemeBundle(source);
  const next = structuredClone(previous);
  const collection = {
    format: FORMATS.collection,
    id,
    name,
    revision:
      Math.max(
        0,
        ...next.collections.filter((item) => item.id === id).map((item) => item.revision),
      ) + 1,
    themeId: next.selection.theme.id,
    requiredSlots,
    bindings,
  };
  next.assets.push(...structuredClone(assets));
  next.collections.push(collection);
  next.selection.collection = reference(collection);
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
/** Identical immutable revisions are shared; conflicting/new IDs are namespaced.
 * Neither imported nor current history is rewritten.
 * The caller retains the old byte table and merges the verified imported bytes. */
export function adoptStudioBundle(source, incomingSource) {
  const previous = validateThemeBundle(source);
  const incoming = validateThemeBundle(incomingSource);
  const presentation = resolvePresentation(incoming);
  const next = structuredClone(previous);
  const used = new Set([...next.assets, ...next.collections].map((record) => record.id));
  const prefix = `import-${next.revision + 1}`;
  let namespace = prefix;
  for (
    let suffix = 1;
    [...used].some((id) => id === namespace || id.startsWith(namespace + '-'));
    suffix++
  )
    namespace = `${prefix}-${suffix}`;
  const key = (asset) => `${asset.id}@${asset.revision}`;
  const imports = new Map();
  const local = new Map(previous.assets.map((asset) => [key(asset), asset]));
  const foreign = new Map(incoming.assets.map((asset, index) => [key(asset), { asset, index }]));
  const adopt = (target) => {
    const identity = key(target);
    if (imports.has(identity)) return imports.get(identity);
    const { asset, index } = foreign.get(identity);
    const candidate = structuredClone(asset);
    // Resolve parents first: an otherwise identical child cannot retain a local
    // parent when the imported revision of that parent has different content.
    candidate.provenance.parent = asset.provenance.parent ? adopt(asset.provenance.parent) : null;
    const existing = local.get(identity);
    let result;
    if (existing && canonicalJSON(existing) === canonicalJSON(candidate)) {
      result = reference(existing);
    } else {
      result = { id: `${namespace}-${index}`, revision: 1 };
      next.assets.push({ ...candidate, ...result });
    }
    imports.set(identity, result);
    return result;
  };
  for (const asset of incoming.assets) adopt(asset);
  const current = next.themes.find((theme) => same(theme, next.selection.theme));
  const theme = {
    ...structuredClone(current),
    revision:
      Math.max(
        ...next.themes.filter((item) => item.id === current.id).map((item) => item.revision),
      ) + 1,
    tokens: { ...presentation.tokens },
  };
  next.themes.push(theme);
  next.selection.theme = reference(theme);
  const collection = {
    format: FORMATS.collection,
    id: namespace,
    revision: 1,
    name: presentation.theme.name,
    themeId: theme.id,
    requiredSlots: next.slots.filter((slot) => slot.required).map((slot) => slot.id),
    bindings: Object.fromEntries(
      Object.entries(presentation.bindings).map(([id, target]) => [
        id,
        imports.get(`${target.id}@${target.revision}`),
      ]),
    ),
  };
  next.collections.push(collection);
  next.selection.collection = reference(collection);
  next.revision++;
  return validateThemeBundle(next, { previous, expectedRevision: previous.revision });
}
export function generateAssetPrompt(slot, resolved, action = 'variation') {
  const asset = resolved.assets[slot.id];
  const audio = slot.group === 'audio',
    font = slot.group === 'fonts',
    recipeOnly = slot.kinds.length === 1 && slot.kinds[0] === 'recipe',
    music = slot.id === 'audio.music',
    name = slot.id.replaceAll('.', '-');
  const mediumBrief = audio
    ? `Create original ${music ? 'instrumental Field Kit music: a restrained synth/chiptune loop with clear loop boundaries, no vocals and room for game cues' : 'short Field Kit interface/game feedback: restrained electronic oscillator tones, a clean envelope and a distinct contour appropriate to ' + slot.label}. Keep the existing mute, volume and user-activation behavior. ${music ? 'Return a seamless 4–16-bar loop in Ogg Vorbis or MP3 and retain a lossless WAV source.' : 'Return a mono 48 kHz, 16-bit PCM WAV cue no longer than one second, without leading silence or clicks.'} Keep peaks below clipping, state the measured duration and loudness, and stay within ${slot.budget.maxBytes} bytes. Sound must never be the only indication of a game event. Visual palette tokens below identify this collection; they are not audio parameters.`
    : font
      ? `Prepare a readable licensed font for ${slot.label}, retaining its source and license notices. Return a real WOFF2 font, not lettering in an image. Verify the actual shipped binary covers English and Ukrainian, including Ґґ Єє Іі Її, punctuation, digits and ʼ ’. Preserve the role's approved weights/axes and fit; test the Standard/Large interface, 200% browser zoom, І l 1, О O 0, 01:24 and 85%. Numeric roles require equal-width digits. Report cmap coverage, metrics and file size within ${slot.budget.maxBytes} bytes.`
      : recipeOnly
        ? `Prepare a bounded code or metadata change for the existing registered recipe ${asset.recipe.id} used by ${slot.label}. Preserve the FPV Field Kit palette and deliberate square pixel clusters. This slot accepts recipe metadata only and has no image upload. Use only supported theme tokens, or the locked rotor anchors on related player body assets where applicable. Recipe metadata contains only its registered id; do not invent parameters or claim that metadata alone changes renderer behavior. Changes to procedural behavior belong in the registered source implementation. A new recipe requires implementation and review before registration or adoption. Preserve event meaning, collision geometry, input behavior, pause and reduced-motion behavior.`
        : slot.prompt;
  const output = audio
    ? `Return the retained source and prepared ${name}.${music ? 'ogg (or mp3)' : 'wav'}, full prompt, creator/license and measured codec, channel, sample-rate, duration, peak and byte-budget validation. Audition the cue alongside existing music and verify the explicit Stop/mute paths.`
    : font
      ? `Return the retained font source, license and prepared ${name}.woff2 with full prompt and actual glyph/axis/metric/byte-budget validation. Keep all UI copy as real text.`
      : recipeOnly
        ? 'Return a reviewable code or metadata patch identifying the registered source files and supported token or related body-anchor changes, full prompt, creator/license and before/after validation evidence for each affected screen. Retain the previous immutable source and asset revisions. Do not return an uploadable PNG or executable bundle content; .rltheme bundles remain data-only and cannot install code. Verify native-size readability, actual runtime bindings, pause, reduced motion and unchanged gameplay before release.'
        : `Return the unmodified source and a separate prepared ${name}.png, complete prompt, creator/license, and validation evidence. Do not bake words, telemetry, collision geometry, propeller motion or reference-game artwork into the image. Verify dimensions, alpha, occupied bounds, anchors, byte budget, native-size readability and every affected screen.`;
  const intent =
    action === 'edit'
      ? audio
        ? 'Edit the attached current audio. Preserve its event meaning, timing and approved musical character.'
        : font
          ? 'Edit or replace the attached current font. Preserve readable glyph coverage, role metrics and licensed-source requirements.'
          : recipeOnly
            ? 'Edit the existing registered recipe through a bounded code or metadata change. Preserve its identity, purpose and locked geometry.'
            : 'Edit the attached current asset. Preserve its approved silhouette and locked geometry.'
      : action === 'collection'
        ? 'Replace this asset as part of one coherent collection. Match all related slots; do not alter their identities or mechanics.'
        : 'Create a new original variation of this asset.';
  const mediumSpecific = audio || font || recipeOnly;
  const contract = mediumSpecific ? { ...slot, prompt: mediumBrief } : slot;
  const currentBrief =
    mediumSpecific && asset.provenance.prompt === slot.prompt
      ? mediumBrief
      : asset.provenance.prompt;
  const sampling = mediumSpecific
    ? ''
    : `\nTRANSPARENCY: ${slot.alpha}\nPIXEL SAMPLING: ${slot.sampling}`;
  const currentRecipe = recipeOnly
    ? `\n\nCURRENT REGISTERED RECIPE:\n${JSON.stringify(asset.recipe, null, 2)}`
    : '';
  return `${intent}\n\n${mediumBrief}\n\nTHEME: ${resolved.theme.name}\nSLOT: ${slot.id}\nUSED ON: ${slot.screens.join(', ')}\nSTATES: ${slot.states.join(', ')}\nDIMENSIONS: ${slot.dimensions ? `${slot.dimensions.width}×${slot.dimensions.height}` : audio ? 'Audio duration and encoded byte budget; no pixel dimensions' : font ? 'Font glyph metrics; no pixel canvas' : 'Registered scalable/procedural recipe'}${sampling}\nRESOLVED TOKENS:\n${JSON.stringify(resolved.tokens, null, 2)}\n\nREQUIREMENTS:\n${slot.requirements.map((line) => `- ${line}`).join('\n')}\n\nCURRENT REVISION: ${asset.id}@${asset.revision}\nCURRENT FILE AND LOCKED GEOMETRY (takes precedence over baseline geometry for edits):\n${JSON.stringify({ file: asset.file, geometry: asset.geometry }, null, 2)}${currentRecipe}\n\nCURRENT PRODUCTION BRIEF (reference context, subject to the slot requirements above):\n${currentBrief}\n\nBASELINE SLOT CONTRACT (identity retained; medium-specific generation brief):\n${JSON.stringify(contract, null, 2)}\n\n${output} A candidate is not an approved release.`;
}
