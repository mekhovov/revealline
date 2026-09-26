import { exportJSONFile } from './platform.mjs';
import { validateTrack } from './ui/music.mjs';
import { validateLevel, validateClassRecipes, CLASSES, TURN_POLICIES } from './core/index.mjs';
import { resolveMasteryContext } from './mastery-catalog.mjs';
import { t } from './i18n/index.mjs';

const plain = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const own = (v, k) => Object.hasOwn(v, k);
const stableId = (v) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const VISUAL_ROLES = Object.freeze([
  'background',
  'player',
  'enemy',
  'patrol',
  'boss',
  'objective',
  'supply',
  'wall',
]);
// These roles belong only to the Classic transport; legacy role acceptance stays fixed.
export const CLASSIC_VISUAL_ROLES = Object.freeze([
  'contour',
  'rover',
  'eroder',
  'slowTerrain',
  'lethalTerrain',
  'lifePickup',
  'speedPickup',
  'slowPickup',
  'freezePickup',
]);
export const SCENARIO_VERSION = 'xonix-playground.v1';
export const MASTERY_SCENARIO_VERSION = 'xonix-playground.v2';
export const ENCOUNTER_SCENARIO_VERSION = 'xonix-playground.v3';
export const WIDE_SCENARIO_VERSION = 'xonix-playground.v4';
export const CLASSIC_SCENARIO_VERSION = 'xonix-playground.v5';
export const FOUNDATION_SCENARIO_VERSION = 'xonix-playground.v6';
export const RELAY_SCENARIO_VERSION = 'xonix-playground.v7';
export const DIRECTIONAL_SCENARIO_VERSION = 'xonix-playground.v8';
export const SENTINEL_SCENARIO_VERSION = 'xonix-playground.v9';

/** A preview uses the authored definition's campaign ID and this single map.
 * It is deliberately separate from any installed campaign or award authority.
 */
export function scenarioMasteryCampaign(scenario, classRecipes = CLASSES) {
  return {
    version: 'xonix-campaign.v1',
    id: scenario.masteryDefinition.campaignId,
    revision: '1',
    title: scenario.level.name.slice(0, 160),
    levels: [scenario.level],
    classRecipes: scenario.classRecipes ?? classRecipes,
  };
}
export const CONTENT_LIMITS = Object.freeze({
  maxImageBytes: 4 * 1024 * 1024,
  maxEncodedImageChars: 6 * 1024 * 1024,
  maxCombinedImageChars: 20 * 1024 * 1024,
  maxImagePixels: 16_000_000,
  maxImageSide: 8192,
  maxCombinedImagePixels: 32_000_000,
  maxMetadataChars: 16_384,
  maxContentChars: 65_536,
  maxClassBodies: 40,
});
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const result = (errors, extra = {}) => ({
  valid: errors.length === 0,
  errors: [...new Set(errors)].slice(0, 40),
  ...extra,
});
const contentError = (key, values) => t(`errors:content.${key}`, values);
const keys = (value, allowed, path, errors) => {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      errors.push(contentError('unsupportedField', { path: `${path}.${key}` }));
};

// Imported packs are JSON, not executable objects. Bound the walk before calling
// the kernel validators, which deliberately allow presentation metadata on levels.
function checkJSON(value, path = 'content') {
  const errors = [],
    ancestors = new Set();
  let nodes = 0,
    chars = 0,
    mediaChars = 0;
  function visit(item, where, depth) {
    if (errors.length >= 40) return;
    if (++nodes > 10_000) {
      errors.push(contentError('valueBudget'));
      return;
    }
    if (depth > 12) {
      errors.push(contentError('nestingBudget', { path: where }));
      return;
    }
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) errors.push(contentError('finiteNumber', { path: where }));
      return;
    }
    if (typeof item === 'string') {
      if (/^content\.visualOverrides\.[^.]+\.dataUrl$/.test(where)) {
        mediaChars += item.length;
        if (item.length > CONTENT_LIMITS.maxEncodedImageChars)
          errors.push(contentError('imageBudget', { path: where }));
      } else {
        chars += item.length;
        if (item.length > 4096) errors.push(contentError('textBudget', { path: where }));
      }
      return;
    }
    if (
      typeof item !== 'object' ||
      (Array.isArray(item) ? Object.getPrototypeOf(item) !== Array.prototype : !plain(item))
    ) {
      errors.push(contentError('plainJson', { path: where }));
      return;
    }
    if (ancestors.has(item)) {
      errors.push(contentError('cycle', { path: where }));
      return;
    }
    ancestors.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item),
      names = Object.keys(descriptors);
    if (Array.isArray(item) && item.length > 256) {
      errors.push(contentError('arrayBudget', { path: where }));
      ancestors.delete(item);
      return;
    }
    if (names.length > 257) {
      errors.push(contentError('fieldBudget', { path: where }));
      ancestors.delete(item);
      return;
    }
    if (Object.getOwnPropertySymbols(item).length)
      errors.push(contentError('symbolKeys', { path: where }));
    for (const key of names) {
      if (Array.isArray(item) && key === 'length') continue;
      const descriptor = descriptors[key];
      if (Array.isArray(item) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length)) {
        errors.push(contentError('arrayProperties', { path: where }));
        continue;
      }
      if (forbidden.has(key)) {
        errors.push(contentError('forbiddenKey', { path: `${where}.${key}` }));
        continue;
      }
      if (!descriptor.enumerable || !own(descriptor, 'value')) {
        errors.push(contentError('ordinaryJson', { path: `${where}.${key}` }));
        continue;
      }
      if (key.length > 120) {
        errors.push(contentError('fieldNameBudget', { path: where }));
        continue;
      }
      chars += key.length;
      visit(descriptor.value, `${where}.${key}`, depth + 1);
    }
    if (Array.isArray(item) && names.length - 1 !== item.length)
      errors.push(contentError('sparseArray', { path: where }));
    ancestors.delete(item);
  }
  visit(value, path, 0);
  if (chars > CONTENT_LIMITS.maxContentChars) errors.push(contentError('combinedTextBudget'));
  if (mediaChars > CONTENT_LIMITS.maxCombinedImageChars)
    errors.push(contentError('combinedArtworkBudget'));
  return errors;
}
function metadata(value, path, errors) {
  if (!plain(value)) {
    errors.push(contentError('objectRequired', { path }));
    return;
  }
  const limits = {
    title: 160,
    description: 4096,
    author: 160,
    sourceUrl: 2048,
    license: 512,
    rightsStatus: 160,
  };
  keys(value, Object.keys(limits), path, errors);
  for (const [key, max] of Object.entries(limits))
    if (own(value, key) && !text(value[key], max))
      errors.push(contentError('boundedText', { path: `${path}.${key}`, max }));
  if (typeof value.sourceUrl === 'string')
    try {
      if (!['http:', 'https:'].includes(new URL(value.sourceUrl).protocol)) throw new Error();
    } catch {
      errors.push(contentError('httpUrl', { path: `${path}.sourceUrl` }));
    }
  if (JSON.stringify(value).length > CONTENT_LIMITS.maxMetadataChars)
    errors.push(contentError('metadataBudget', { path }));
}
function themeChecks(theme, errors) {
  if (!plain(theme)) {
    errors.push('theme must be an object');
    return;
  }
  keys(
    theme,
    [
      'id',
      'name',
      'subtitle',
      'family',
      'player',
      'classBodies',
      'scene',
      'enemyShape',
      'patrolShape',
      'bossShape',
      'palette',
      'labels',
      'metadata',
    ],
    'theme',
    errors,
  );
  for (const key of ['id', 'family', 'player'])
    if (!stableId(theme[key]) || forbidden.has(theme[key]))
      errors.push(`theme.${key} must be a non-reserved stable identifier`);
  if (own(theme, 'classBodies')) {
    if (!plain(theme.classBodies))
      errors.push('theme.classBodies must be a mapping of class IDs to body preset IDs');
    else {
      if (Object.keys(theme.classBodies).length > CONTENT_LIMITS.maxClassBodies)
        errors.push(
          `theme.classBodies may contain at most ${CONTENT_LIMITS.maxClassBodies} entries`,
        );
      for (const [classId, bodyId] of Object.entries(theme.classBodies)) {
        if (!stableId(classId) || forbidden.has(classId))
          errors.push('theme.classBodies keys must be non-reserved stable class IDs');
        if (!stableId(bodyId) || forbidden.has(bodyId))
          errors.push(`theme.classBodies.${classId} must be a non-reserved stable body preset ID`);
      }
    }
  }
  for (const key of ['name', 'subtitle'])
    if (!text(theme[key], 120))
      errors.push(`theme.${key} must be nonempty text of at most 120 characters`);
  if (!['dawn', 'heritage', 'arcade', 'network'].includes(theme.scene))
    errors.push('theme.scene is not registered');
  for (const role of ['enemyShape', 'patrolShape', 'bossShape'])
    if (
      !['tank', 'drone', 'radar', 'moth', 'spark', 'orb', 'cube', 'flower', 'core'].includes(
        theme[role],
      )
    )
      errors.push(`theme.${role} is not registered`);
  const paletteKeys = [
    'ink',
    'paper',
    'muted',
    'accent',
    'safe',
    'danger',
    'field',
    'grid',
    'sky',
    'land',
  ];
  if (!plain(theme.palette)) errors.push('theme.palette must be an object');
  else {
    keys(theme.palette, paletteKeys, 'theme.palette', errors);
    for (const key of paletteKeys)
      if (typeof theme.palette[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(theme.palette[key]))
        errors.push(`theme.palette.${key} must be #rrggbb`);
  }
  const labelKeys = ['objective', 'supply', 'enemy', 'boss', 'currency', 'ability'];
  if (!plain(theme.labels)) errors.push('theme.labels must be an object');
  else {
    keys(theme.labels, labelKeys, 'theme.labels', errors);
    for (const key of labelKeys)
      if (!text(theme.labels[key], 60))
        errors.push(`theme.labels.${key} must be nonempty text of at most 60 characters`);
  }
  if (own(theme, 'metadata')) metadata(theme.metadata, 'theme.metadata', errors);
}
export function validateTheme(theme) {
  const errors = checkJSON(theme, 'theme');
  if (!errors.length) themeChecks(theme, errors);
  return result(errors);
}

/** Presentation recommendation only. The caller must check registered presets and
 * cosmetic ownership; this function never grants unlocks or changes a class recipe.
 * Unregistered pack IDs remain valid references for the caller's neutral fallback.
 */
export function recommendedBody(theme, classId, fallback = theme?.player || 'neutral-marker') {
  const mapping = theme?.classBodies;
  const value =
    plain(mapping) && stableId(classId) && !forbidden.has(classId) && own(mapping, classId)
      ? mapping[classId]
      : null;
  if (stableId(value) && !forbidden.has(value)) return value;
  return stableId(fallback) && !forbidden.has(fallback) ? fallback : 'neutral-marker';
}

const u16be = (b, p) => (b[p] << 8) | b[p + 1];
const u16le = (b, p) => b[p] | (b[p + 1] << 8);
const u24le = (b, p) => b[p] | (b[p + 1] << 8) | (b[p + 2] << 16);
const u32be = (b, p) => (b[p] * 0x1000000 + b[p + 1] * 0x10000 + b[p + 2] * 0x100 + b[p + 3]) >>> 0;
const u32le = (b, p) => (b[p] + b[p + 1] * 0x100 + b[p + 2] * 0x10000 + b[p + 3] * 0x1000000) >>> 0;
const ascii = (b, p, n) => String.fromCharCode(...b.subarray(p, p + n));
function pngSize(bytes) {
  if (
    bytes.length < 45 ||
    ascii(bytes, 0, 8) !== '\x89PNG\r\n\x1a\n' ||
    u32be(bytes, 8) !== 13 ||
    ascii(bytes, 12, 4) !== 'IHDR'
  )
    throw new Error('PNG signature or IHDR is invalid');
  const size = { width: u32be(bytes, 16), height: u32be(bytes, 20) };
  let p = 8,
    data = false,
    end = false;
  while (p + 12 <= bytes.length) {
    const length = u32be(bytes, p),
      kind = ascii(bytes, p + 4, 4);
    if (p + 12 + length > bytes.length) throw new Error('PNG chunk is truncated');
    if (kind === 'IHDR' && p !== 8) throw new Error('PNG has multiple frame headers');
    if (kind === 'acTL') throw new Error('Animated PNG is not supported in static visual roles');
    if (kind === 'IDAT') data = true;
    p += 12 + length;
    if (kind === 'IEND') {
      end = true;
      break;
    }
  }
  if (!data || !end || p !== bytes.length)
    throw new Error('PNG must contain complete image data and IEND');
  return size;
}
function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('JPEG signature is invalid');
  let p = 2,
    size = null;
  while (p < bytes.length) {
    if (bytes[p++] !== 0xff) throw new Error('JPEG marker is invalid');
    while (bytes[p] === 0xff) p++;
    const marker = bytes[p++];
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (p + 2 > bytes.length) throw new Error('JPEG segment is truncated');
    const length = u16be(bytes, p);
    if (length < 2 || p + length > bytes.length) throw new Error('JPEG segment is truncated');
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      if (length < 8 || size) throw new Error('JPEG frame header is invalid or repeated');
      size = { height: u16be(bytes, p + 3), width: u16be(bytes, p + 5) };
    }
    if (marker === 0xda) break;
    p += length;
  }
  if (!size) throw new Error('JPEG dimensions are missing');
  return size;
}
function webpSize(bytes) {
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP' ||
    u32le(bytes, 4) + 8 !== bytes.length
  )
    throw new Error('WebP RIFF container is invalid');
  let p = 12,
    canvas = null,
    frame = null;
  while (p + 8 <= bytes.length) {
    const kind = ascii(bytes, p, 4),
      length = u32le(bytes, p + 4),
      start = p + 8,
      end = start + length;
    if (end > bytes.length) throw new Error('WebP chunk is truncated');
    if (kind === 'VP8X') {
      if (length !== 10 || canvas) throw new Error('WebP canvas header is invalid or repeated');
      if (bytes[start] & 2)
        throw new Error('Animated WebP is not supported in static visual roles');
      canvas = { width: 1 + u24le(bytes, start + 4), height: 1 + u24le(bytes, start + 7) };
    }
    if (kind === 'VP8 ') {
      if (frame || length < 10 || ascii(bytes, start + 3, 3) !== '\x9d\x01\x2a')
        throw new Error('WebP frame header is invalid or repeated');
      frame = { width: u16le(bytes, start + 6) & 0x3fff, height: u16le(bytes, start + 8) & 0x3fff };
    }
    if (kind === 'VP8L') {
      if (frame || length < 5 || bytes[start] !== 0x2f)
        throw new Error('WebP lossless frame header is invalid or repeated');
      const bits = u32le(bytes, start + 1);
      frame = { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (kind === 'ANIM' || kind === 'ANMF')
      throw new Error('Animated WebP is not supported in static visual roles');
    p = end + (length % 2);
  }
  if (p !== bytes.length || !frame) throw new Error('WebP image frame is missing or truncated');
  if (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))
    throw new Error('WebP canvas/frame dimensions disagree');
  return frame;
}
/** Read bounded media headers before allocating an Image. This is not a decoder:
 * callers must still await successful browser decoding before replacing a valid asset.
 * Original bytes are never converted or rewritten. No SVG, URL, script or animation.
 */
export function inspectImageDataUrl(dataUrl) {
  const errors = [];
  let mime, width, height, byteLength;
  if (typeof dataUrl !== 'string' || dataUrl.length > CONTENT_LIMITS.maxEncodedImageChars)
    return result(['Image exceeds the encoded budget or is not a string']);
  const match = /^data:image\/(png|jpeg|webp);base64,/.exec(dataUrl);
  if (!match) return result(['Image requires an embedded PNG, JPEG or WebP data URL']);
  mime = `image/${match[1]}`;
  const encoded = dataUrl.slice(match[0].length);
  if (!encoded.length || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
    return result(['Image base64 is malformed']);
  byteLength =
    (encoded.length / 4) * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (byteLength > CONTENT_LIMITS.maxImageBytes)
    return result(['Image exceeds the 4 MiB original-byte budget']);
  try {
    const binary = atob(encoded),
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      size =
        match[1] === 'png'
          ? pngSize(bytes)
          : match[1] === 'jpeg'
            ? jpegSize(bytes)
            : webpSize(bytes);
    ({ width, height } = size);
    if (
      !width ||
      !height ||
      width > CONTENT_LIMITS.maxImageSide ||
      height > CONTENT_LIMITS.maxImageSide ||
      width * height > CONTENT_LIMITS.maxImagePixels
    )
      errors.push('Image exceeds 8192 pixels per side or the 16 megapixel budget');
  } catch (error) {
    errors.push(error.message || 'Image header could not be read');
  }
  return result(errors, { mime, width, height, byteLength });
}
export function validateScenario(value, { classRecipes: defaultRecipes = CLASSES } = {}) {
  const errors = checkJSON(value),
    warnings = [];
  if (errors.length) return result(errors, { warnings });
  if (
    !plain(value) ||
    ![
      SCENARIO_VERSION,
      MASTERY_SCENARIO_VERSION,
      ENCOUNTER_SCENARIO_VERSION,
      WIDE_SCENARIO_VERSION,
      CLASSIC_SCENARIO_VERSION,
      FOUNDATION_SCENARIO_VERSION,
      RELAY_SCENARIO_VERSION,
      DIRECTIONAL_SCENARIO_VERSION,
      SENTINEL_SCENARIO_VERSION,
    ].includes(value.format)
  )
    return result(['Expected a supported xonix-playground.v1..v9 format'], {
      warnings,
    });
  const sentinel = value.format === SENTINEL_SCENARIO_VERSION;
  const directional = value.format === DIRECTIONAL_SCENARIO_VERSION || sentinel;
  const relays = value.format === RELAY_SCENARIO_VERSION || directional;
  const foundations = value.format === FOUNDATION_SCENARIO_VERSION || relays;
  const classic = value.format === CLASSIC_SCENARIO_VERSION || foundations;
  const wide = value.format === WIDE_SCENARIO_VERSION;
  const hasEncounter = value.format === ENCOUNTER_SCENARIO_VERSION;
  const hasMastery = value.format === MASTERY_SCENARIO_VERSION || hasEncounter || wide || classic;
  keys(
    value,
    [
      'format',
      'level',
      'theme',
      'settings',
      'classRecipes',
      'visualOverrides',
      'presentation',
      'metadata',
      'music',
      ...(hasMastery ? ['masteryDefinition'] : []),
    ],
    'scenario',
    errors,
  );
  errors.push(...validateLevel(value.level).errors);
  if (
    plain(value.level) &&
    value.level.version !==
      (sentinel
        ? 'xonix-level.v8'
        : directional
          ? 'xonix-level.v7'
          : relays
            ? 'xonix-level.v6'
            : foundations
              ? 'xonix-level.v5'
              : classic
                ? 'xonix-level.v4'
                : wide
                  ? 'xonix-level.v3'
                  : hasEncounter
                    ? 'xonix-level.v2'
                    : 'xonix-level.v1')
  )
    errors.push('Scenario and level simulation versions must match');
  themeChecks(value.theme, errors);
  if (plain(value.level)) {
    if (!text(value.level.name, 280))
      errors.push('level.name must be nonempty text of at most 280 characters');
    if (!text(value.level.revision, 80))
      errors.push('level.revision must be nonempty text of at most 80 characters');
    if (own(value.level, 'metadata')) metadata(value.level.metadata, 'level.metadata', errors);
  }
  const recipes = own(value, 'classRecipes') ? value.classRecipes : defaultRecipes;
  const recipeJSON = checkJSON(recipes, 'classRecipes');
  errors.push(...recipeJSON);
  if (!recipeJSON.length) {
    errors.push(...validateClassRecipes(recipes).errors);
    if (Array.isArray(recipes))
      for (const c of recipes)
        if (plain(c))
          for (const [key, max] of [
            ['label', 80],
            ['description', 600],
            ['revision', 80],
          ])
            if (!text(c[key], max))
              errors.push(`classRecipes.${key} must be nonempty text of at most ${max} characters`);
  }
  if (!plain(value.settings)) errors.push('settings must be an object');
  else {
    keys(value.settings, ['classId', 'turnPolicy', 'seed'], 'settings', errors);
    if (
      recipeJSON.length ||
      !Array.isArray(recipes) ||
      !recipes.some((c) => plain(c) && c.id === value.settings.classId)
    )
      errors.push('Unknown class');
    if (!TURN_POLICIES.includes(value.settings.turnPolicy)) errors.push('Unknown turn policy');
    if (
      !Number.isInteger(value.settings.seed) ||
      value.settings.seed < 0 ||
      value.settings.seed > 0xffffffff
    )
      errors.push('seed must be uint32');
  }
  if (own(value, 'presentation')) {
    if (!plain(value.presentation)) errors.push('presentation must be an object');
    else {
      keys(value.presentation, ['style', 'showGrid'], 'presentation', errors);
      if (!['microtile', 'props', 'hybrid'].includes(value.presentation.style))
        errors.push('presentation.style must be microtile, props or hybrid');
      if (typeof value.presentation.showGrid !== 'boolean')
        errors.push('presentation.showGrid must be boolean');
    }
  }
  if (own(value, 'metadata')) metadata(value.metadata, 'scenario.metadata', errors);
  if (own(value, 'music'))
    errors.push(...validateTrack(value.music).errors.map((error) => `music: ${error}`));
  if (hasMastery) {
    if (!own(value, 'masteryDefinition'))
      errors.push('scenario.masteryDefinition is required; use null for no optional goal');
    else if ((hasEncounter || wide || classic) && value.masteryDefinition !== null)
      errors.push(
        classic
          ? 'Classic scenarios require masteryDefinition:null; optional goals are not supported by this ruleset'
          : wide
            ? 'Wide scenarios require masteryDefinition:null; optional goals are not supported by this ruleset'
            : 'Encounter scenarios require masteryDefinition:null; optional goals are not supported by this ruleset',
      );
    else if (value.masteryDefinition !== null && !errors.length) {
      try {
        resolveMasteryContext({
          campaign: scenarioMasteryCampaign(value, recipes),
          definition: value.masteryDefinition,
        });
      } catch (error) {
        errors.push(`masteryDefinition: ${error.message}`);
      }
    }
  }
  if (!plain(value.visualOverrides)) errors.push('visualOverrides must be an object');
  else {
    let totalPixels = 0;
    for (const [role, item] of Object.entries(value.visualOverrides)) {
      if (!VISUAL_ROLES.includes(role) && !(classic && CLASSIC_VISUAL_ROLES.includes(role))) {
        errors.push(`Unknown visual role ${role}`);
        continue;
      }
      if (!plain(item)) {
        errors.push(`${role} must be an image descriptor`);
        continue;
      }
      keys(item, ['dataUrl', 'name', 'fit', 'metadata'], role, errors);
      if (own(item, 'name') && !text(item.name, 240))
        errors.push(`${role}.name must be nonempty text of at most 240 characters`);
      if (own(item, 'fit') && !['contain', 'cover'].includes(item.fit))
        errors.push(`${role}.fit must be contain or cover`);
      if (own(item, 'metadata')) metadata(item.metadata, `${role}.metadata`, errors);
      const inspected = inspectImageDataUrl(item.dataUrl);
      errors.push(...inspected.errors.map((e) => `${role}: ${e}`));
      if (inspected.valid) totalPixels += inspected.width * inspected.height;
    }
    if (totalPixels > CONTENT_LIMITS.maxCombinedImagePixels)
      errors.push('Combined decoded artwork exceeds the 32 megapixel budget');
    if (own(value.visualOverrides, 'player'))
      warnings.push(
        'Player artwork keeps the selected body’s existing rotor and attachment anchors. Check alignment; artwork does not change collision geometry or abilities.',
      );
  }
  return result(errors, { warnings });
}
export function downloadJSON(value, name) {
  return exportJSONFile(value, name);
}
