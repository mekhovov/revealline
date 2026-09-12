import {
  LEGACY_VERSIONS,
  ENCOUNTER_VERSIONS,
  WIDE_VERSIONS,
  versionsForCampaign,
} from './core/versions.mjs';
import {
  validateScenario,
  validateTheme,
  inspectImageDataUrl,
  VISUAL_ROLES,
  CONTENT_LIMITS,
  SCENARIO_VERSION,
  MASTERY_SCENARIO_VERSION,
  ENCOUNTER_SCENARIO_VERSION,
  WIDE_SCENARIO_VERSION,
} from './content.mjs';
import { browserDecodeImage } from './imports.mjs';
import { boundedJSON, plainObject, stableId, exactKeys, required } from './data-json.mjs';
import { createMasteryCatalog } from './mastery-catalog.mjs';
import { resolveMasteryDefinition } from './mastery.mjs';

export const PACK_VERSION = 'xonix-pack.v1';
export const MASTERY_PACK_VERSION = 'xonix-pack.v2';
export const ENCOUNTER_PACK_VERSION = 'xonix-pack.v3';
export const WIDE_PACK_VERSION = 'xonix-pack.v4';
export const PACK_LIBRARY_VERSION = 'xonix-pack-library.v1';
export const PACK_LIMITS = Object.freeze({
  maxBytes: 24 * 1024 * 1024,
  libraryBytes: 48 * 1024 * 1024,
  installed: 12,
  levels: 128,
  themes: 16,
  campaigns: 8,
  masteries: 128,
  masteryBytes: 8 * 1024,
  combinedMasteryBytes: 256 * 1024,
});
const semver = (v) =>
  typeof v === 'string' && /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.test(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const finite = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const preparedPacks = new WeakSet(),
  preparedLibraries = new WeakSet();
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const boundedPack = (candidate, library = false) =>
  boundedJSON(candidate, {
    maxBytes: library ? PACK_LIMITS.libraryBytes : PACK_LIMITS.maxBytes,
    maxNodes: 160000,
    maxDepth: 18,
    maxArray: 4096,
    maxString: CONTENT_LIMITS.maxEncodedImageChars,
  });
function trackChecks(value) {
  exactKeys(value, ['id', 'name', 'genre', 'tempo', 'root', 'scale'], 'music');
  required(stableId(value.id) && text(value.name, 120), 'Music identity is invalid.');
  required(
    ['synthwave', 'chiptune', 'rock', 'metal', 'ambient'].includes(value.genre),
    'Music genre is not registered.',
  );
  required(
    finite(value.tempo, 60, 180) && Number.isInteger(value.root) && finite(value.root, 36, 84),
    'Music tempo/root is invalid.',
  );
  required(['minor', 'major', 'dorian'].includes(value.scale), 'Music scale is not registered.');
}
export function validateMusicDescriptor(value) {
  try {
    trackChecks(boundedJSON(value));
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}
const levelKeys = [
  'version',
  'id',
  'revision',
  'name',
  'width',
  'height',
  'spawn',
  'goal',
  'walls',
  'enemies',
  'objectives',
  'supplies',
  'rules',
  'metadata',
  'signalZones',
  'hangars',
  'themeId',
  'musicId',
];
function packChecks(candidate) {
  const pack = boundedPack(candidate);
  const wide = pack.format === WIDE_PACK_VERSION;
  const encounter = pack.format === ENCOUNTER_PACK_VERSION;
  const authoredMasteries = pack.format === MASTERY_PACK_VERSION || encounter || wide;
  const versions = wide ? WIDE_VERSIONS : encounter ? ENCOUNTER_VERSIONS : LEGACY_VERSIONS;
  exactKeys(
    pack,
    [
      'format',
      'id',
      'version',
      'name',
      'description',
      'engine',
      'dependencies',
      'metadata',
      'themes',
      'classRecipes',
      'campaigns',
      'visualOverrides',
      'levelVisuals',
      'music',
      ...(authoredMasteries ? ['masteries'] : []),
    ],
    'pack',
  );
  required(
    [PACK_VERSION, MASTERY_PACK_VERSION, ENCOUNTER_PACK_VERSION, WIDE_PACK_VERSION].includes(
      pack.format,
    ) &&
      stableId(pack.id) &&
      semver(pack.version),
    'Pack format/id/version is invalid.',
  );
  required(
    pack.engine === versions.ruleset,
    `Pack requires a different engine; expected ${versions.ruleset}.`,
  );
  if (encounter || wide)
    required(
      Array.isArray(pack.masteries) && pack.masteries.length === 0,
      wide
        ? 'Wide pack v4 requires masteries: []; optional goals are not supported.'
        : 'Encounter pack v3 requires masteries: []; encounter goals are not supported.',
    );
  required(
    text(pack.name, 120) && text(pack.description, 4096),
    'Pack name/description is invalid.',
  );
  required(
    Array.isArray(pack.dependencies) && pack.dependencies.length <= 16,
    'Pack dependencies must contain at most 16 entries.',
  );
  const dependencyIds = new Set();
  for (const dependency of pack.dependencies) {
    exactKeys(dependency, ['id', 'version'], 'dependency');
    required(
      stableId(dependency.id) &&
        dependency.id !== pack.id &&
        !dependencyIds.has(dependency.id) &&
        semver(dependency.version),
      'Dependency identity/version is invalid or repeated.',
    );
    dependencyIds.add(dependency.id);
  }
  if (pack.metadata !== undefined) {
    exactKeys(pack.metadata, ['author', 'license', 'rightsStatus', 'sourceUrl'], 'pack.metadata');
    for (const [key, val] of Object.entries(pack.metadata))
      required(text(val, key === 'sourceUrl' ? 2048 : 512), `Pack metadata ${key} is invalid.`);
    if (pack.metadata.sourceUrl !== undefined) {
      let url;
      try {
        url = new URL(pack.metadata.sourceUrl);
      } catch {}
      required(
        url && ['https:', 'http:'].includes(url.protocol),
        'Pack source URL must be HTTP(S).',
      );
    }
  }
  required(
    Array.isArray(pack.themes) &&
      pack.themes.length >= 1 &&
      pack.themes.length <= PACK_LIMITS.themes,
    'Pack must contain 1..16 themes.',
  );
  const themes = new Map();
  for (const theme of pack.themes) {
    required(stableId(theme.id), 'Theme identity is reserved or invalid.');
    const check = validateTheme(theme);
    required(check.valid, check.errors.join('; '));
    required(!themes.has(theme.id), 'Theme IDs must be unique.');
    themes.set(theme.id, theme);
  }
  required(
    Array.isArray(pack.classRecipes) &&
      pack.classRecipes.length >= 1 &&
      pack.classRecipes.length <= 40,
    'Pack must contain 1..40 class recipes.',
  );
  required(
    pack.classRecipes.every((recipe) => stableId(recipe?.id)),
    'Class identity is reserved or invalid.',
  );
  required(Array.isArray(pack.music) && pack.music.length <= 32, 'Pack music budget exceeded.');
  required(
    pack.classRecipes.every((recipe) => stableId(recipe?.id)),
    'Class identity is reserved or invalid.',
  );
  const musicIds = new Set();
  for (const descriptor of pack.music) {
    trackChecks(descriptor);
    required(!musicIds.has(descriptor.id), 'Music IDs must be unique.');
    musicIds.add(descriptor.id);
  }
  required(
    Array.isArray(pack.campaigns) &&
      pack.campaigns.length >= 1 &&
      pack.campaigns.length <= PACK_LIMITS.campaigns,
    'Pack must contain 1..8 campaigns.',
  );
  const campaignIds = new Set(),
    levelIds = new Set();
  let firstScenario = null;
  for (const campaign of pack.campaigns) {
    exactKeys(
      campaign,
      ['version', 'id', 'revision', 'title', 'levels', 'classIds', 'themeId', 'musicId'],
      'campaign',
    );
    required(
      campaign.version === 'xonix-campaign.v1' &&
        stableId(campaign.id) &&
        !campaignIds.has(campaign.id) &&
        text(campaign.revision, 60) &&
        text(campaign.title, 160),
      'Pack campaign identity is invalid or duplicated.',
    );
    campaignIds.add(campaign.id);
    required(
      campaign.themeId === undefined || themes.has(campaign.themeId),
      'Campaign refers to an unknown theme.',
    );
    required(
      campaign.musicId === undefined || musicIds.has(campaign.musicId),
      'Campaign refers to unknown music.',
    );
    if (campaign.classIds !== undefined)
      required(
        Array.isArray(campaign.classIds) &&
          campaign.classIds.length > 0 &&
          campaign.classIds.every((id) => pack.classRecipes.some((c) => c.id === id)) &&
          new Set(campaign.classIds).size === campaign.classIds.length,
        'Campaign class roster is invalid.',
      );
    required(
      Array.isArray(campaign.levels) &&
        campaign.levels.length >= 1 &&
        campaign.levels.length <= PACK_LIMITS.levels,
      'Campaign must contain 1..128 maps.',
    );
    required(
      versionsForCampaign(campaign).ruleset === versions.ruleset,
      'Pack format and campaign simulation versions differ.',
    );
    for (const level of campaign.levels) {
      exactKeys(level, encounter || wide ? [...levelKeys, 'encounter'] : levelKeys, 'level');
      required(stableId(level.id), 'Level identity is reserved or invalid.');
      required(!levelIds.has(level.id), 'Level IDs must be unique across a pack.');
      levelIds.add(level.id);
      required(
        level.themeId === undefined || themes.has(level.themeId),
        'Level refers to an unknown theme.',
      );
      required(
        level.musicId === undefined || musicIds.has(level.musicId),
        'Level refers to unknown music.',
      );
      const scenario = {
        format: wide
          ? WIDE_SCENARIO_VERSION
          : encounter
            ? ENCOUNTER_SCENARIO_VERSION
            : SCENARIO_VERSION,
        level,
        theme: themes.get(level.themeId ?? campaign.themeId) ?? pack.themes[0],
        settings: {
          classId: campaign.classIds?.[0] ?? pack.classRecipes[0].id,
          turnPolicy: 'immediate',
          seed: 1,
        },
        classRecipes: pack.classRecipes,
        visualOverrides: {},
        ...(encounter || wide ? { masteryDefinition: null } : {}),
      };
      const checked = validateScenario(scenario);
      required(checked.valid, checked.errors.join('; '));
      firstScenario ??= scenario;
    }
  }
  required(levelIds.size <= PACK_LIMITS.levels, 'Pack map budget exceeded.');
  if (authoredMasteries) {
    required(
      Array.isArray(pack.masteries) && pack.masteries.length <= PACK_LIMITS.masteries,
      'Pack v2 requires masteries with at most 128 definitions.',
    );
    required(
      new TextEncoder().encode(JSON.stringify(pack.masteries)).byteLength <=
        PACK_LIMITS.combinedMasteryBytes,
      'Pack mastery definitions exceed their combined 256 KiB budget.',
    );
    const ids = new Set(),
      maps = new Set();
    pack.masteries = pack.masteries.map((candidate) => {
      const definition = resolveMasteryDefinition(
        boundedJSON(candidate, {
          maxBytes: PACK_LIMITS.masteryBytes,
          maxNodes: 256,
          maxDepth: 5,
          maxArray: 4,
          maxString: 512,
        }),
      );
      required(
        campaignIds.has(definition.campaignId),
        'Pack mastery refers to an unknown local campaign.',
      );
      const map = `${definition.campaignId}/${definition.levelId}`;
      required(!ids.has(definition.id), 'Pack mastery definition IDs must be unique.');
      required(!maps.has(map), 'Only one mastery definition may target each pack map.');
      ids.add(definition.id);
      maps.add(map);
      return definition;
    });
  }
  // Batch local context checks so a 128-map campaign is normalized only once.
  // Definitions stay beside maps; this cannot modify their existing identity.
  createMasteryCatalog(catalogEntries([pack]));
  required(plainObject(pack.visualOverrides), 'Pack visualOverrides must be an object.');
  required(
    Array.isArray(pack.levelVisuals) && pack.levelVisuals.length <= PACK_LIMITS.levels,
    'Pack per-map visual budget exceeded.',
  );
  const scopes = [{ name: 'pack', visualOverrides: pack.visualOverrides }],
    scopedLevels = new Set();
  for (const entry of pack.levelVisuals) {
    exactKeys(entry, ['levelId', 'visualOverrides'], 'levelVisuals');
    required(
      levelIds.has(entry.levelId) && !scopedLevels.has(entry.levelId),
      'Per-map artwork refers to an unknown or repeated level.',
    );
    scopedLevels.add(entry.levelId);
    scopes.push({ name: entry.levelId, visualOverrides: entry.visualOverrides });
  }
  const images = [],
    warnings = [];
  let encodedChars = 0,
    pixels = 0;
  for (const scope of scopes) {
    const check = validateScenario({ ...firstScenario, visualOverrides: scope.visualOverrides });
    required(check.valid, check.errors.join('; '));
    warnings.push(...check.warnings);
    for (const [role, descriptor] of Object.entries(scope.visualOverrides)) {
      required(VISUAL_ROLES.includes(role), 'Unknown visual role.');
      const header = inspectImageDataUrl(descriptor.dataUrl);
      required(header.valid, header.errors.join('; '));
      encodedChars += descriptor.dataUrl.length;
      pixels += header.width * header.height;
      images.push({
        role,
        scope: scope.name,
        descriptor,
        width: header.width,
        height: header.height,
      });
    }
  }
  required(
    encodedChars <= CONTENT_LIMITS.maxCombinedImageChars &&
      pixels <= CONTENT_LIMITS.maxCombinedImagePixels,
    'Pack artwork exceeds its combined encoded or decoded pixel budget.',
  );
  return { pack, images, warnings: [...new Set(warnings)] };
}
export function validatePack(value) {
  try {
    const { warnings } = packChecks(value);
    return { valid: true, errors: [], warnings };
  } catch (error) {
    return { valid: false, errors: [error.message], warnings: [] };
  }
}
function campaignData(pack, source) {
  return {
    ...structuredClone(source),
    classRecipes: structuredClone(
      pack.classRecipes.filter((recipe) => !source.classIds || source.classIds.includes(recipe.id)),
    ),
  };
}
function catalogEntries(packs) {
  return packs.flatMap((pack) =>
    pack.campaigns.map((source) => ({
      campaign: campaignData(pack, source),
      sourcePackId: pack.id,
      sourcePackFormat: pack.format,
      ...(pack.format !== PACK_VERSION
        ? {
            masteries: pack.masteries.filter((definition) => definition.campaignId === source.id),
          }
        : {}),
    })),
  );
}
async function decodeCheckedPack({ pack, images, warnings }, decodeImage) {
  required(typeof decodeImage === 'function', 'A complete image decoder is required.');
  for (const image of images) {
    const decoded = await decodeImage(image.descriptor.dataUrl, {
      role: image.role,
      scope: image.scope,
    });
    required(
      decoded?.naturalWidth === image.width && decoded?.naturalHeight === image.height,
      `${image.scope}/${image.role}: decoded dimensions do not match the image header.`,
    );
  }
  freeze(pack);
  preparedPacks.add(pack);
  return { pack, warnings };
}
/** All file/structure/image-header checks finish before the first decoder call. */
export async function preparePack(candidate, { decodeImage = browserDecodeImage, library } = {}) {
  const checked = packChecks(candidate);
  if (library !== undefined) {
    required(preparedLibraries.has(library), 'Prepare an installation against a prepared library.');
    libraryChecks([...library.packs.filter((pack) => pack.id !== checked.pack.id), checked.pack]);
  }
  return decodeCheckedPack(checked, decodeImage);
}
function dependenciesValid(packs) {
  const byId = new Map(packs.map((p) => [p.id, p]));
  required(byId.size === packs.length, 'Installed pack IDs must be unique.');
  for (const pack of packs)
    for (const dependency of pack.dependencies)
      required(
        byId.get(dependency.id)?.version === dependency.version,
        `${pack.name} requires ${dependency.id} version ${dependency.version}.`,
      );
  const visiting = new Set(),
    done = new Set();
  function visit(id) {
    if (done.has(id)) return;
    required(!visiting.has(id), 'Pack dependency cycle is not supported.');
    visiting.add(id);
    for (const d of byId.get(id).dependencies) visit(d.id);
    visiting.delete(id);
    done.add(id);
  }
  for (const id of byId.keys()) visit(id);
}
function libraryChecks(packs) {
  required(packs.length <= PACK_LIMITS.installed, 'At most 12 expansion packs can be installed.');
  dependenciesValid(packs);
  const library = { format: PACK_LIBRARY_VERSION, packs };
  // Includes byte budgets across every installed asset, before adoption/storage.
  boundedPack(library, true);
  createMasteryCatalog(catalogEntries(packs));
  return library;
}
function registeredLibrary(packs) {
  const library = libraryChecks(packs);
  freeze(library);
  preparedLibraries.add(library);
  return library;
}
export function emptyPackLibrary() {
  return registeredLibrary([]);
}
export function installPack(library, pack) {
  required(
    preparedLibraries.has(library) && preparedPacks.has(pack),
    'Install only a prepared pack into a prepared library.',
  );
  return registeredLibrary([...library.packs.filter((p) => p.id !== pack.id), pack]);
}
export function removePack(library, id) {
  required(preparedLibraries.has(library), 'Remove from a prepared pack library.');
  required(stableId(id), 'Pack identity is invalid.');
  return registeredLibrary(library.packs.filter((pack) => pack.id !== id));
}
export function exportPackLibrary(library) {
  required(preparedLibraries.has(library), 'Export a prepared pack library.');
  return JSON.stringify(library);
}
export async function importPackLibrary(candidate, { decodeImage = browserDecodeImage } = {}) {
  const value = boundedPack(candidate, true);
  exactKeys(value, ['format', 'packs'], 'pack library');
  required(
    value.format === PACK_LIBRARY_VERSION &&
      Array.isArray(value.packs) &&
      value.packs.length <= PACK_LIMITS.installed,
    'Invalid expansion library.',
  );
  // Validate every pack/dependency before allocating any browser decode surface.
  const checked = value.packs.map((pack) => packChecks(pack));
  libraryChecks(checked.map((entry) => entry.pack));
  const packs = [];
  for (const candidate of checked)
    packs.push((await decodeCheckedPack(candidate, decodeImage)).pack);
  return registeredLibrary(packs);
}
export function resolvePackCampaign(pack, campaignId) {
  required(preparedPacks.has(pack), 'Resolve a prepared pack.');
  const source = pack.campaigns.find((c) => c.id === campaignId);
  required(source, 'Unknown pack campaign.');
  const campaign = campaignData(pack, source);
  return {
    campaign,
    classRecipes: structuredClone(campaign.classRecipes),
    themes: structuredClone(pack.themes),
    visualOverrides: structuredClone(pack.visualOverrides),
    levelVisuals: structuredClone(pack.levelVisuals),
    music: structuredClone(pack.music),
    sourcePackId: pack.id,
    ...(pack.format !== PACK_VERSION
      ? {
          sourcePackFormat: pack.format,
          masteries: structuredClone(
            pack.masteries.filter((definition) => definition.campaignId === source.id),
          ),
        }
      : {}),
  };
}
export function scenarioFromPack(
  pack,
  campaignId,
  levelId,
  { classId, turnPolicy = 'immediate', seed = 1 } = {},
) {
  const resolved = resolvePackCampaign(pack, campaignId),
    level = resolved.campaign.levels.find((l) => l.id === levelId);
  required(level, 'Unknown pack map.');
  const theme =
    resolved.themes.find((t) => t.id === (level.themeId ?? resolved.campaign.themeId)) ??
    resolved.themes[0];
  const visualOverrides = {
    ...resolved.visualOverrides,
    ...(resolved.levelVisuals.find((v) => v.levelId === levelId)?.visualOverrides ?? {}),
  };
  const scenario = {
    format:
      pack.format === WIDE_PACK_VERSION
        ? WIDE_SCENARIO_VERSION
        : pack.format === ENCOUNTER_PACK_VERSION
          ? ENCOUNTER_SCENARIO_VERSION
          : pack.format === MASTERY_PACK_VERSION
            ? MASTERY_SCENARIO_VERSION
            : SCENARIO_VERSION,
    level,
    theme,
    classRecipes: resolved.classRecipes,
    settings: { classId: classId ?? resolved.classRecipes[0].id, turnPolicy, seed },
    visualOverrides,
    ...(pack.format !== PACK_VERSION
      ? {
          masteryDefinition: structuredClone(
            resolved.masteries.find((definition) => definition.levelId === levelId) ?? null,
          ),
        }
      : {}),
  };
  const music =
    resolved.music.find((track) => track.id === (level.musicId ?? resolved.campaign.musicId)) ??
    resolved.music[0];
  if (music) scenario.music = structuredClone(music);
  const check = validateScenario(scenario);
  required(check.valid, check.errors.join('; '));
  return scenario;
}
