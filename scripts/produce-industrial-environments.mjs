import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalJSON } from '../game/data-json.mjs';
import { createPursuitCampaignCandidates } from '../game/content-design/pursuit-campaign-candidates.mjs';
import { createContentExecutionCatalog } from '../game/content-design/execution.mjs';
import {
  CLASSIC_SNAKE_V3_CHAPTERS,
  CLASSIC_SNAKE_V3_LEVELS,
} from '../game/snake/classic-catalogue-v3.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { prepareRunningEnemyLevel } from '../game/hunt/running-enemies.mjs';
import { prepareTeamRunningEnemies } from '../game/hunt/team-running-enemies.mjs';
import {
  EXPRESSIVE_HUNT_CHAPTERS,
  EXPRESSIVE_HUNT_COURSES,
} from '../optional-practice/civilian-fpv/expressive-hunt-courses.mjs';
import {
  NATIVE_PURSUIT_CATALOGUE,
  NATIVE_PURSUIT_V2_CATALOGUE,
  NATIVE_PURSUIT_PLAYLIST,
} from '../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { validateWorldCourse } from '../optional-practice/civilian-fpv/world-model.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import {
  INDUSTRIAL_ENVIRONMENT_REVISION,
  industrialMaterialPixels,
} from '../game/presentation/industrial-materials.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { decodePresentationDocument } from '../game/presentation/document-codec.mjs';
import { FORMATS, validateThemeBundle, resolvePresentation } from '../game/presentation/model.mjs';
import { exportThemeBundle, importThemeBundle } from '../game/presentation/bundle.mjs';
import { adoptStudioBundle, reviseStudioTheme } from '../game/presentation/studio-session.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const INDUSTRIAL_ENVIRONMENT_DIRECTORY = 'authoring/industrial-art-review/environments-v1';
export const INDUSTRIAL_ENVIRONMENT_DATA_PATH =
  'game/presentation/industrial-environments-data.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identity = (value) => sha(canonicalJSON(value));
const ref = ({ id, revision }) => ({ id, revision });
const chapterUkrainian = {
  'Patrol District': 'Патрульний район',
  'Escape Lines': 'Шляхи втечі',
  'Guarded Crossings': 'Охоронювані переходи',
  'Specialist Circuit': 'Маршрут спеціалістів',
  'Shared Bearings': 'Спільні орієнтири',
  'Pincer Grounds': 'Майданчик кліщів',
  'Return Workshop': 'Майстерня повернення',
  'Material Exchange': 'Обмін матеріалами',
  'Window Partners': 'Партнери біля вікон',
  'Two-Pilot Finale': 'Фінал двох пілотів',
};
const title = (value) =>
  typeof value === 'string' ? { en: value, uk: chapterUkrainian[value] ?? value } : value;
const material = (name, variant) => ({ material: name, variant });
// Existing six-family pixels; four restrained wear variations. These define
// presentation only and never assign a new blocking/slow/lethal terrain type.
const finishes = [
  ['masonry', 0, 'earth', 0, 'metal', 0, 'timber', 0],
  ['timber', 1, 'earth', 2, 'metal', 1, 'timber', 1],
  ['concrete', 2, 'damaged', 0, 'metal', 2, 'timber', 2],
  ['damaged', 1, 'earth', 3, 'metal', 3, 'timber', 3],
  ['masonry', 2, 'earth', 1, 'metal', 0, 'timber', 1],
  ['timber', 0, 'earth', 3, 'metal', 1, 'timber', 0],
  ['metal', 2, 'damaged', 2, 'metal', 3, 'timber', 2],
  ['masonry', 3, 'timber', 2, 'metal', 0, 'timber', 3],
  ['damaged', 3, 'earth', 0, 'metal', 1, 'timber', 0],
  ['concrete', 1, 'damaged', 1, 'metal', 2, 'timber', 1],
  ['timber', 3, 'earth', 1, 'metal', 0, 'timber', 3],
  ['masonry', 1, 'damaged', 3, 'metal', 2, 'timber', 2],
  ['concrete', 0, 'earth', 2, 'metal', 3, 'timber', 0],
  ['damaged', 2, 'earth', 0, 'metal', 1, 'timber', 1],
];

function definition(chapter, index) {
  const [wall, w, ground, g, hazard, h, wood, t] = finishes[index];
  const value = {
    id: `industrial-env-${chapter.id}`,
    revision: 1,
    artRevision: INDUSTRIAL_ENVIRONMENT_REVISION,
    collection: { id: 'military-field', revision: 'r1' },
    materialRevision: INDUSTRIAL_ENVIRONMENT_REVISION,
    arcade: {
      'terrain.wall': material(wall, w),
      'terrain.slow': material(ground, g),
      'terrain.lethal': material(hazard, h),
    },
    sim: {
      concrete: material(wall, w),
      grass: material(ground, g),
      steel: material(hazard, h),
      timber: material(wood, t),
    },
  };
  // Bind the native outputs, including real play scales and SIM's existing map size.
  const assets = [
    ...new Map(
      [...Object.values(value.arcade), ...Object.values(value.sim)].map((binding) => [
        canonicalJSON(binding),
        binding,
      ]),
    ).values(),
  ].map((binding) => ({
    ...binding,
    frames: [16, 24, 32, 128].map((size) => ({
      size,
      sha256: sha(
        industrialMaterialPixels({ width: size, height: size }, binding.material, {
          revision: value.materialRevision,
          variant: binding.variant,
        }).rgba,
      ),
    })),
  }));
  return { ...value, assets, appearanceSha256: identity({ ...value, assets }) };
}

export async function collectIndustrialEnvironmentSources() {
  const chapters = [],
    sources = [],
    rooms = [];
  const add = (engine, mode, source, origin, chapter, launch, extra = {}) => {
    const tuple = [
      engine,
      mode,
      origin.catalogueId,
      origin.catalogueRevision,
      origin.sourceForm,
      source.version ?? source.format,
      source.id,
      String(source.revision),
    ];
    const row = {
      sourceKey: `ie1-${createHash('sha256').update(canonicalJSON(tuple)).digest('base64url')}`,
      tuple,
      source,
      contentSha256: identity(source),
      chapterId: chapter.id,
      launch,
      ...extra,
    };
    sources.push(row);
    return row;
  };
  for (const mode of ['solo', 'versus', 'team']) {
    const project = createPursuitCampaignCandidates({ team: mode === 'team' }),
      catalogue = createContentExecutionCatalog(project, { mode });
    if (mode !== 'versus')
      for (const chapter of project.campaigns)
        chapters.push({
          id: chapter.id,
          title: title(chapter.name),
          engine: 'capture',
          modes: mode === 'team' ? ['team'] : ['solo', 'versus'],
        });
    for (const entry of catalogue.entries) {
      const chapter = chapters.find((c) => c.id === entry.campaignId);
      for (const level of entry.campaign.levels) {
        const href =
          mode === 'solo'
            ? 'game/'
            : mode === 'versus'
              ? 'game/couch/'
              : 'game/couch/relay-rescue.html';
        const launch = {
          href: `${href}?journey=pursuit-campaigns-v1&lang=en`,
          kind: 'collection',
          missionId: level.id,
          campaignId: chapter.id,
          difficulty: entry.difficulty,
        };
        const row = add(
          'capture',
          mode,
          level,
          {
            catalogueId: project.id,
            catalogueRevision: project.revision,
            sourceForm: `compiled-native-v1:${entry.policyVersion}:${entry.difficulty}`,
          },
          chapter,
          launch,
        );
        if (mode !== 'solo' && entry.difficulty === 'standard')
          rooms.push({
            id: `capture:${mode}:${chapter.id}:${level.id}`,
            family: 'capture',
            mode,
            level,
            chapter,
            sourceKey: row.sourceKey,
          });
      }
    }
  }
  for (const chapter of CLASSIC_SNAKE_V3_CHAPTERS)
    chapters.push({ ...chapter, engine: 'snake', modes: ['solo', 'versus', 'team'] });
  for (const entry of CLASSIC_SNAKE_V3_LEVELS) {
    const chapter = chapters.find((c) => c.id === entry.chapterId);
    for (const mode of ['solo', 'versus', 'team']) {
      const row = add(
        'snake',
        mode,
        entry.level,
        {
          catalogueId: 'classic-catalogue',
          catalogueRevision: 'classic-catalogue-v3',
          sourceForm: 'authored',
        },
        chapter,
        {
          href: `game/snake/play.html?mode=${mode}&level=${entry.id}&lang=en`,
          kind: 'exact',
          missionId: entry.id,
        },
      );
      if (mode !== 'solo')
        rooms.push({
          id: `snake:${mode}:${entry.id}`,
          family: 'snake',
          mode,
          level: entry.level,
          chapter,
          sourceKey: row.sourceKey,
        });
    }
  }
  for (const chapter of EXPRESSIVE_HUNT_CHAPTERS)
    chapters.push({ ...chapter, engine: 'sim', modes: ['self-level', 'acro'] });
  const expressiveIdentity = `fpv-expressive-hunt:${dataIdentity(EXPRESSIVE_HUNT_COURSES)}`;
  for (const [index, source] of EXPRESSIVE_HUNT_COURSES.entries()) {
    const chapter = chapters.find(
      (c) => c.id === EXPRESSIVE_HUNT_CHAPTERS[Math.floor(index / 6)].id,
    );
    for (const mode of ['self-level', 'acro'])
      add(
        'sim',
        mode,
        validateWorldCourse(source),
        {
          catalogueId: expressiveIdentity,
          catalogueRevision: '1',
          sourceForm: 'validated-native-v1',
        },
        chapter,
        {
          href: `optional-practice/fpv-worlds/?snake-course=${source.id}&lang=en`,
          kind: 'exact',
          missionId: source.id,
        },
      );
  }
  const nativeEntries = [...NATIVE_PURSUIT_CATALOGUE, ...NATIVE_PURSUIT_V2_CATALOGUE];
  for (const [index, pin] of NATIVE_PURSUIT_PLAYLIST.entries.entries()) {
    const entry = nativeEntries.find(
      (e) => e.id === pin.levelId && e.packIdentity === pin.packIdentity,
    );
    if (!entry) throw new Error('The exact native pursuit source is unavailable.');
    const chapter = chapters.find(
      (c) => c.id === (index < 3 ? 'ground-routes' : 'approach-windows'),
    );
    for (const mode of ['self-level', 'acro'])
      add(
        'sim',
        mode,
        validateWorldCourse(entry.course),
        {
          catalogueId: entry.packIdentity,
          catalogueRevision: '1',
          sourceForm: 'validated-native-v1',
        },
        chapter,
        {
          href: `optional-practice/fpv-worlds/?snake-course=${entry.id}&lang=en`,
          kind: 'exact',
          missionId: entry.id,
        },
        { supplementalNative: true },
      );
  }
  const roomAliases = [];
  for (const entry of rooms) {
    const seen = new Map();
    for (const pace of ['normal', 'slow', 'fast'])
      for (const targets of ['authored', 'moving', 'varied']) {
        const prepared =
          entry.family === 'snake'
            ? prepareClassicSnakeLevel(entry, {
                pace,
                format: 'campaign',
                targetRules: targets,
                preset: 'classic',
              })
            : targets === 'authored'
              ? entry.level
              : entry.mode === 'team'
                ? prepareTeamRunningEnemies(entry.level, {
                    style: targets === 'varied' ? 'varied' : 'original',
                  })
                : prepareRunningEnemyLevel(entry.level, {
                    style: targets === 'varied' ? 'varied' : 'original',
                  });
        const level = prepared.level ?? prepared,
          hash = identity(level);
        let row = seen.get(hash);
        if (!row) {
          row = add(
            entry.family,
            entry.mode,
            level,
            {
              catalogueId: entry.id,
              catalogueRevision: 'rooms-v1',
              sourceForm: `room-native-v1:${pace}:${targets}`,
            },
            entry.chapter,
            {
              href: `game/online/?recipe=${encodeURIComponent(entry.id)}&pace=${pace}&targets=${targets}&seed=17`,
              kind: 'room',
              missionId: level.id,
            },
            { roomCatalogueId: entry.id, originalSourceKey: entry.sourceKey },
          );
          seen.set(hash, row);
        }
        roomAliases.push({
          catalogueId: entry.id,
          pace,
          targets,
          sourceKey: row.sourceKey,
          contentSha256: hash,
        });
      }
  }
  if (chapters.length !== 14)
    throw new Error('The environment batch requires exactly fourteen existing chapters.');
  return { chapters, sources, roomAliases };
}

export function assertIndustrialEnvironmentRetention(previous, next) {
  if (!previous) return;
  const nextSources = new Map(next.sources.map((row) => [row[0], row]));
  for (const row of previous.sources) {
    const current = nextSources.get(row[0]);
    const expand = (data, item) => [
      item[0],
      data.owners[item[1]],
      data.formats[item[2]],
      ...item.slice(3, 6),
      [
        data.definitions[item[6]].id,
        data.definitions[item[6]].revision,
        data.definitions[item[6]].appearanceSha256,
      ],
      ...item.slice(7),
    ];
    if (!current || canonicalJSON(expand(previous, row)) !== canonicalJSON(expand(next, current)))
      throw new Error(`Retained environment source changed or disappeared: ${row[0]}`);
  }
  const nextDefs = new Map(next.definitions.map((d) => [`${d.id}@${d.revision}`, d]));
  for (const definition of previous.definitions)
    if (
      canonicalJSON(nextDefs.get(`${definition.id}@${definition.revision}`)) !==
      canonicalJSON(definition)
    )
      throw new Error(`Retained environment definition changed: ${definition.id}`);
  const aliases = new Map(
    next.roomAliases.map((row) => [row.slice(0, 3).join('\0'), canonicalJSON(row)]),
  );
  for (const row of previous.roomAliases)
    if (aliases.get(row.slice(0, 3).join('\0')) !== canonicalJSON(row))
      throw new Error('A retained native room preparation changed.');
}

// Source catalogues may contain newly authored picture slots which the published
// Studio has not adopted. A full transport must use the actual loaded contract,
// not prove compatibility by importing into its own broader source registry.
async function publishedStudioBaseline() {
  const bytes = await readFile(resolve(root, 'game/presentation/compiled/studio.json')),
    published = validateThemeBundle(decodePresentationDocument(bytes.toString('utf8'))),
    base = structuredClone(createDefaultThemeBundle()),
    approved = new Map(published.slots.map((slot) => [slot.id, slot]));
  base.slots = base.slots.filter((slot) => approved.has(slot.id));
  if (
    base.slots.length !== published.slots.length ||
    base.slots.some((slot) => canonicalJSON(slot) !== canonicalJSON(approved.get(slot.id)))
  )
    throw new Error('The published Studio slot contract needs an explicit compatible producer.');
  base.slots = structuredClone(published.slots);
  for (const theme of base.themes)
    theme.bindings = Object.fromEntries(
      Object.entries(theme.bindings).filter(([id]) => approved.has(id)),
    );
  const used = new Set(
    base.themes.flatMap(({ bindings }) =>
      Object.values(bindings).map(({ id, revision }) => `${id}@${revision}`),
    ),
  );
  base.assets = base.assets.filter(({ id, revision }) => used.has(`${id}@${revision}`));
  return {
    base: validateThemeBundle(base),
    published,
    contract: { slots: published.slots.length, sourceSha256: sha(bytes) },
  };
}

async function chapterPackage(definition, chapter, studio) {
  const base = studio.base,
    slots = base.slots.filter((s) => Object.hasOwn(definition.arcade, s.id)),
    assets = [],
    bindings = {},
    payloads = new Map();
  for (const slot of slots) {
    const binding = definition.arcade[slot.id],
      pixels = industrialMaterialPixels(slot.dimensions, binding.material, {
        revision: definition.materialRevision,
        variant: binding.variant,
      }),
      png = encodeSpritePNG(pixels);
    const asset = {
      format: FORMATS.asset,
      id: `industrial-env-v1-${binding.material}-${binding.variant}`,
      revision: 1,
      kind: 'image',
      description: `Original opaque ${binding.material}, restrained wear variation ${binding.variant + 1}.`,
      provenance: {
        creator: 'RevealLine',
        source: 'game/presentation/industrial-materials.mjs',
        license: 'Original project artwork.',
        prompt:
          'Approved overhead industrial materials. Opaque complete cell, restrained grain; native hazard markers remain separate. No collision or gameplay changes.',
        parent: null,
      },
      file: {
        sha256: sha(png),
        bytes: png.length,
        mime: 'image/png',
        width: pixels.width,
        height: pixels.height,
      },
      recipe: null,
      geometry: structuredClone(slot.geometry),
      quality: { stage: 'produced', evidence: [] },
    };
    if (!assets.some((item) => item.id === asset.id)) assets.push(asset);
    bindings[slot.id] = ref(asset);
    payloads.set(asset.file.sha256, new Blob([png], { type: 'image/png' }));
  }
  const revised = structuredClone(reviseStudioTheme(base, { assets, bindings }));
  revised.id = definition.id;
  revised.themes.at(-1).name = `${chapter.title.en} · Industrial environment`;
  const document = validateThemeBundle(revised);
  const bundle = await exportThemeBundle(document, payloads),
    imported = await importThemeBundle(bundle, { decodeImage: null });
  const bytes = Buffer.from(await bundle.arrayBuffer()),
    roundTrip = Buffer.from(
      await (await exportThemeBundle(imported.document, imported.assets)).arrayBuffer(),
    );
  if (!bytes.equals(roundTrip))
    throw new Error(`Environment package changed during round trip: ${chapter.id}`);
  const adopted = resolvePresentation(adoptStudioBundle(studio.published, imported.document));
  for (const slot of slots)
    if (
      adopted.assets[slot.id].file.sha256 !==
      assets.find((a) => a.id === bindings[slot.id].id).file.sha256
    )
      throw new Error(`Studio environment binding was not admitted: ${slot.id}`);
  return {
    bytes,
    document,
    payloads,
    decodedBytes: assets.reduce((sum, a) => sum + a.file.width * a.file.height * 4, 0),
    assets: assets.map((a) => ({ id: a.id, revision: a.revision, ...a.file })),
  };
}

export async function createIndustrialEnvironmentBatch({ previous = null } = {}) {
  const { chapters, sources, roomAliases } = await collectIndustrialEnvironmentSources(),
    definitions = chapters.map(definition),
    owners = [],
    formats = [];
  const index = (table, value) => {
    let i = table.findIndex((item) => canonicalJSON(item) === canonicalJSON(value));
    if (i < 0) {
      i = table.length;
      table.push(value);
    }
    return i;
  };
  const data = {
    format: 'revealline-industrial-environments.v1',
    definitions,
    owners,
    formats,
    sources: sources.map((row) => [
      row.sourceKey,
      index(owners, row.tuple.slice(0, 5)),
      index(formats, row.tuple[5]),
      row.tuple[6],
      row.tuple[7],
      row.contentSha256,
      chapters.findIndex((c) => c.id === row.chapterId),
      ...(row.roomCatalogueId ? [row.roomCatalogueId] : []),
    ]),
    roomAliases: roomAliases.map((row) => [
      row.catalogueId,
      row.pace,
      row.targets,
      row.sourceKey,
      row.contentSha256,
    ]),
  };
  if (new Set(data.sources.map((row) => row[0])).size !== data.sources.length)
    throw new Error('Duplicate environment source tuple; revise its source form explicitly.');
  assertIndustrialEnvironmentRetention(previous, data);
  const files = new Map(),
    inventory = [],
    studio = await publishedStudioBaseline();
  for (const [index, chapter] of chapters.entries()) {
    const def = definitions[index],
      pack = await chapterPackage(def, chapter, studio),
      path = `${INDUSTRIAL_ENVIRONMENT_DIRECTORY}/${chapter.id}.rltheme`;
    files.set(path, pack.bytes);
    inventory.push({
      ...chapter,
      definition: { id: def.id, revision: def.revision, appearanceSha256: def.appearanceSha256 },
      arcade: def.arcade,
      sim: def.sim,
      levelCount: new Set(
        sources
          .filter((row) => row.chapterId === chapter.id && !row.roomCatalogueId)
          .map((row) => row.tuple[6]),
      ).size,
      sourceIds: [
        ...new Set(
          sources
            .filter((row) => row.chapterId === chapter.id && !row.roomCatalogueId)
            .map((row) => row.tuple[6]),
        ),
      ],
      links: [
        ...new Map(
          sources
            .filter((row) => row.chapterId === chapter.id && !row.roomCatalogueId)
            .map((row) => [
              `${row.tuple[1]}:${row.launch.href}`,
              { mode: row.tuple[1], href: row.launch.href },
            ]),
        ).values(),
      ],
      package: {
        path,
        href: path,
        bytes: pack.bytes.length,
        sha256: sha(pack.bytes),
        decodedBytes: pack.decodedBytes,
        assets: pack.assets,
      },
      missions: sources
        .filter((row) => row.chapterId === chapter.id && !row.roomCatalogueId)
        .map((row) => ({
          sourceKey: row.sourceKey,
          engine: row.tuple[0],
          mode: row.tuple[1],
          origin: {
            catalogueId: row.tuple[2],
            catalogueRevision: row.tuple[3],
            sourceForm: row.tuple[4],
          },
          format: row.tuple[5],
          id: row.tuple[6],
          revision: row.tuple[7],
          contentSha256: row.contentSha256,
          title:
            row.tuple[0] === 'snake'
              ? CLASSIC_SNAKE_V3_LEVELS.find((entry) => entry.id === row.tuple[6]).title
              : row.source.locales?.en?.title
                ? {
                    en: row.source.locales.en.title,
                    uk: row.source.locales.uk?.title ?? row.source.locales.en.title,
                  }
                : title(row.source.name ?? row.source.id),
          launch: row.launch,
          ...(row.supplementalNative ? { supplementalNative: true } : {}),
        })),
    });
  }
  const module =
    Buffer.from(`/** Generated immutable admission rows. Retain previous rows; regenerate with scripts/produce-industrial-environments.mjs. */\n// prettier-ignore
export const INDUSTRIAL_ENVIRONMENT_DATA = ${JSON.stringify(data)};\n`);
  files.set(INDUSTRIAL_ENVIRONMENT_DATA_PATH, module);
  const report = {
    format: 'revealline-industrial-environment-inventory.v1',
    materialRevision: INDUSTRIAL_ENVIRONMENT_REVISION,
    studioContract: studio.contract,
    variantDescription:
      'Four restrained wear variations per material; chapter combinations supply broad visual differences.',
    chapters: inventory,
    roomPreparations: roomAliases.length,
    roomSources: sources.filter((row) => row.roomCatalogueId).length,
    moduleBytes: module.length,
    packageBytes: inventory.reduce((sum, row) => sum + row.package.bytes, 0),
    decodedBytesPerChapterMax: Math.max(...inventory.map((row) => row.package.decodedBytes)),
    scope:
      'Produced and software-admitted, presentation only. No new missions, gameplay policy, automatic default promotion or human/device acceptance.',
  };
  files.set(
    `${INDUSTRIAL_ENVIRONMENT_DIRECTORY}/inventory.json`,
    Buffer.from(JSON.stringify(report, null, 2) + '\n'),
  );
  return { data, files, inventory: report, sources };
}

export async function produceIndustrialEnvironments({ outputRoot = root, check = false } = {}) {
  let previous = null;
  try {
    previous = (
      await import(
        `${pathToFileURL(resolve(outputRoot, INDUSTRIAL_ENVIRONMENT_DATA_PATH)).href}?retention=${Date.now()}`
      )
    ).INDUSTRIAL_ENVIRONMENT_DATA;
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
  const batch = await createIndustrialEnvironmentBatch({ previous });
  for (const [path, bytes] of batch.files) {
    const file = resolve(outputRoot, path);
    if (check) {
      if (!(await readFile(file)).equals(bytes))
        throw new Error(`Stale environment output: ${path}`);
    } else {
      await mkdir(dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      try {
        await writeFile(temp, bytes);
        await rename(temp, file);
      } finally {
        await rm(temp, { force: true });
      }
    }
  }
  return {
    files: batch.files.size,
    sourceRows: batch.data.sources.length,
    roomRows: batch.inventory.roomSources,
    roomPreparations: batch.inventory.roomPreparations,
    moduleBytes: batch.inventory.moduleBytes,
    packageBytes: batch.inventory.packageBytes,
    decodedBytesPerChapterMax: batch.inventory.decodedBytesPerChapterMax,
  };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const index = process.argv.indexOf('--output-root');
  console.log(
    JSON.stringify(
      await produceIndustrialEnvironments({
        outputRoot: index < 0 ? root : resolve(process.argv[index + 1]),
        check: process.argv.includes('--check'),
      }),
    ),
  );
}
