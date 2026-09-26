import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boundedJSON, canonicalJSON, required, exactKeys } from '../game/data-json.mjs';
import { validateEditionId } from '../game/edition-context.mjs';
import {
  createEditionRuntimeCatalog,
  editionRelativePath,
  validateEditionRuntimeCatalog,
} from '../game/editions/model.mjs';
import {
  TRAIL_IMPACT_JOURNEY_POLICY,
  CURRENT_PRESSURE_ACTOR_CATALOG,
  PRESSURE_DIFFICULTY_CATALOG,
} from '../game/content-design/catalogs.mjs';
import { CLASSES } from '../game/core/index.mjs';
import { REPORT_FORMAT, STUDIO_REPORT_CHECKS } from '../authoring/company-studio/model.mjs';
import { createStarterProject } from '../game/content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import {
  collectEditionEngineFiles,
  compileEdition,
  collectEditionSelectedFiles,
  writeEdition,
} from './compile-edition.mjs';
import { editionPublicationAssets } from '../publishing/edition-admission.mjs';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (value) => Buffer.from(canonicalJSON(value) + '\n');
const decode = (bytes) => boundedJSON(bytes.toString('utf8'));

/** A complete new-company workspace in the existing formats, with one playable
 * neutral mission and explicit local asset slots ready for original artwork. */
export function createCompanyWorkspaceFiles({
  brandId,
  editionId = `${brandId}-public`,
  name,
  description = 'A new world of shared connections.',
  sharedAssets = [],
  sharedFiles = new Map(),
}) {
  validateEditionId(brandId);
  validateEditionId(editionId);
  required(
    typeof name === 'string' && name.trim() && name.length <= 160,
    'A company name is required.',
  );
  const campaignId = `${editionId}-campaign`,
    missionId = `${editionId}-01`,
    mapId = `${editionId}-map`,
    themeId = `${brandId}-world`;
  const project = createStarterProject(`${editionId}-source`);
  project.policyId = TRAIL_IMPACT_JOURNEY_POLICY.id;
  project.actorCatalogId = CURRENT_PRESSURE_ACTOR_CATALOG.id;
  project.difficultyCatalogId = PRESSURE_DIFFICULTY_CATALOG.id;
  project.name = `${name} journey`;
  project.revision = '1';
  project.maps[0].id = mapId;
  project.maps[0].name = `${name} welcome plaza`;
  project.missions[0].id = missionId;
  project.missions[0].name = 'The first connection';
  project.missions[0].modes = ['solo'];
  project.missions[0].map.id = mapId;
  project.missions[0].presentation.themeId = themeId;
  project.campaigns[0].id = campaignId;
  project.campaigns[0].name = `${name} journey`;
  project.campaigns[0].missionIds = [missionId];
  project.packs[0].id = `${editionId}-pack`;
  project.packs[0].name = `${name} journey`;
  project.packs[0].campaignIds = [campaignId];
  const compiled = compileContentProject(project),
    files = new Map(sharedFiles),
    sourcePath = `game/content/company-campaigns/${campaignId}.json`;
  files.set(sourcePath, json(project));
  const brand = {
    format: 'revealline-brand-pack.v1',
    id: brandId,
    revision: 1,
    name,
    description,
    publication: 'public',
    themeId,
    actorSetId: 'neutral-marker',
    logoAssetId: null,
    heroAssetId: null,
    iconAssetId: null,
    fontAssetId:
      sharedAssets.find((asset) => /\.(?:ttf|otf|woff2?)$/i.test(asset.path))?.id ?? null,
    assetIds: sharedAssets.map((asset) => asset.id),
  };
  const boot = Object.fromEntries(
    ['campaign', 'themes', 'presets', 'classes', 'packs', 'archives'].map((key) => [
      key,
      `game/content/company-boot/${editionId}/${key}.json`,
    ]),
  );
  const edition = {
    format: 'revealline-edition.v1',
    id: editionId,
    revision: 1,
    name: `${name} journey`,
    brandId,
    audience: 'everyone',
    campaignIds: [campaignId],
    entryCampaignId: campaignId,
    modes: ['solo'],
    publication: 'public',
    boot,
  };
  const theme = {
    id: themeId,
    name: name.slice(0, 120),
    subtitle: description.slice(0, 120),
    family: 'company',
    player: 'neutral-marker',
    scene: 'network',
    enemyShape: 'cube',
    patrolShape: 'spark',
    bossShape: 'core',
    classBodies: Object.fromEntries(
      ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'].map((id) => [
        id,
        'neutral-marker',
      ]),
    ),
    labels: {
      objective: 'Connection',
      supply: 'Support station',
      enemy: 'Tangle',
      boss: 'Backlog',
      currency: 'Connections',
      ability: 'Support',
    },
    palette: {
      ink: '#142333',
      paper: '#FFFFFF',
      muted: '#A5BACF',
      accent: '#72D0ED',
      safe: '#96D4AD',
      danger: '#FFA58F',
      field: '#142333',
      grid: '#29445F',
      sky: '#E1F1F7',
      land: '#315574',
    },
  };
  const content = {
    campaign: {
      version: 'xonix-campaign.v1',
      id: campaignId,
      revision: '1',
      title: `${name} journey`,
      levels: [resolveMission(compiled, missionId, { mode: 'solo', difficulty: 'standard' }).level],
    },
    themes: { version: 'xonix-themes.v1', themes: [theme] },
    presets: {
      version: '1.0.0',
      characters: {
        'neutral-marker': {
          label: 'Community marker',
          src: null,
          sourceStatus: 'Original neutral placeholder',
          widthCells: 1.5,
          heightCells: 1.5,
          headingOffsetDegrees: 0,
          sampling: 'linear',
          rotors: [],
          animationRecipe: 'still',
        },
      },
      animationRecipes: { still: { label: 'Rigid body', components: [] } },
    },
    classes: structuredClone(CLASSES),
    packs: { format: 'xonix-pack-index.v1', packs: [] },
    archives: { format: 'xonix-pack-index.v1', packs: [] },
  };
  for (const [key, file] of Object.entries(boot)) files.set(file, json(content[key]));
  const catalog = createEditionRuntimeCatalog({
    brands: [brand],
    editions: [edition],
    campaigns: [
      {
        id: campaignId,
        revision: '1',
        name: `${name} journey`,
        brandId,
        publication: 'public',
        sourcePath,
        assetIds: [],
        modes: ['solo'],
      },
    ],
    assets: sharedAssets,
    defaultEditionId: editionId,
  });
  files.set('game/editions/catalog.json', json(catalog));
  files.set(
    'README.md',
    Buffer.from(
      `# ${name} company workspace\n\nEdit the existing ContentProjectV1 source for maps and missions. Boot themes define palette, labels and actor presets. Add approved original media to the asset ledger in game/editions/catalog.json with exact SHA-256, byte count and dependencies; reference it from the brand or campaign assetIds. Add a per-campaign lessonPath for validated learning records. Open source-draft.json in the Company Studio to edit the whole initial workspace.\n\nValidate and create a whole-game preview from the Reveal / Line repository:\n\n\`node scripts/company-studio.mjs validate --workspace PATH --edition ${editionId}\`\n\n\`node scripts/company-studio.mjs preview --workspace PATH --edition ${editionId} --out dist/company-previews/${editionId}\`\n\nChoose a fresh output directory for each preview. Hidden directories cannot be served by the standard development server. The neutral mission is a starting design, not route-qualified content. Review accessibility, company asset rights, lesson facts and route proofs before publishing. The compiler produces a sidecar exclusion report and does not publish anything.\n`,
    ),
  );
  return { files, catalog };
}

export function companySourceDraft({ catalog, files }) {
  editionPublicationAssets(catalog, files);
  const retainedPaths = new Set(
    catalog.editions.flatMap((edition) =>
      (edition.presentationHistory ?? []).map((record) => record.path),
    ),
  );
  const paths = new Set([
    ...catalog.editions.flatMap((edition) => [
      ...Object.values(edition.boot ?? {}),
      ...(edition.presentationHistory ?? []).map((record) => record.path),
    ]),
    ...catalog.campaigns.flatMap((campaign) => [
      campaign.sourcePath,
      ...(campaign.lessonPath ? [campaign.lessonPath] : []),
    ]),
  ]);
  return {
    format: 'revealline-company-source-draft.v1',
    catalog,
    files: [...paths].map((name) => {
      required(files.has(name), `Missing draft source: ${name}`);
      return {
        path: name,
        data: retainedPaths.has(name)
          ? new TextDecoder('utf-8', { fatal: true }).decode(files.get(name))
          : decode(files.get(name)),
      };
    }),
  };
}

export function companyDraftFiles(source) {
  const draft = boundedJSON(source, {
    maxBytes: 16 * 1024 * 1024,
    maxString: 4 * 1024 * 1024,
    maxNodes: 400000,
    maxArray: 8192,
  });
  exactKeys(draft, ['format', 'catalog', 'files'], 'Company source draft');
  required(
    draft.format === 'revealline-company-source-draft.v1' &&
      Array.isArray(draft.files) &&
      draft.files.length <= 2000,
    'Invalid company source draft.',
  );
  const catalog = validateEditionRuntimeCatalog(draft.catalog);
  const retainedPaths = new Set(
    catalog.editions.flatMap((edition) =>
      (edition.presentationHistory ?? []).map((record) => record.path),
    ),
  );
  const allowed = new Set([
    ...catalog.editions.flatMap((edition) => [
      ...Object.values(edition.boot ?? {}),
      ...(edition.presentationHistory ?? []).map((record) => record.path),
    ]),
    ...catalog.campaigns.flatMap((campaign) => [
      campaign.sourcePath,
      ...(campaign.lessonPath ? [campaign.lessonPath] : []),
    ]),
  ]);
  const files = new Map([['game/editions/catalog.json', json(catalog)]]);
  for (const entry of draft.files) {
    exactKeys(entry, ['path', 'data'], 'Company draft file');
    required(
      allowed.has(entry.path) && editionRelativePath(entry.path) && !files.has(entry.path),
      'Draft JSON must have a unique declared runtime path.',
    );
    if (retainedPaths.has(entry.path)) {
      required(
        typeof entry.data === 'string',
        'Retained draft snapshots need their exact original JSON text.',
      );
      files.set(entry.path, Buffer.from(entry.data, 'utf8'));
    } else files.set(entry.path, json(entry.data));
  }
  editionPublicationAssets(catalog, files);
  return { catalog, files };
}

async function copyApprovedMedia(catalog, files, mediaRoot) {
  const root = await fs.realpath(mediaRoot);
  for (const asset of catalog.editions
    ? editionPublicationAssets(catalog, files)
    : catalog.assets) {
    required(
      asset.publication === 'public' && asset.approved,
      'Draft media needs explicit publication approval.',
    );
    const actual = await fs.realpath(path.join(root, asset.path));
    required(
      actual.startsWith(`${root}${path.sep}`),
      'Draft media escapes its original workspace.',
    );
    const bytes = await fs.readFile(actual);
    required(
      bytes.length === asset.bytes &&
        createHash('sha256').update(bytes).digest('hex') === asset.sha256,
      'Draft media differs from its declared source revision.',
    );
    files.set(asset.path, bytes);
  }
}

export function companyStudioReport(sourceCatalog, result, { previewURL = null } = {}) {
  if (previewURL?.split('/').some((segment) => segment.startsWith('.'))) previewURL = null;
  const source = validateEditionRuntimeCatalog(sourceCatalog),
    selected = result.runtimeCatalog,
    assets = editionPublicationAssets(selected, result.files);
  const edition = selected.editions[0],
    campaignSources = selected.campaigns.map((campaign) =>
      decode(result.files.get(campaign.sourcePath)),
    );
  const exclusion = (key) =>
    source[key]
      .filter((record) => !selected[key].some((item) => item.id === record.id))
      .map((record) => record.id);
  return {
    format: REPORT_FORMAT,
    artifact: {
      path: 'edition-build.json',
      bytes: result.files.get('edition-build.json').length,
      sha256: createHash('sha256').update(result.files.get('edition-build.json')).digest('hex'),
    },
    editionId: edition.id,
    brandId: edition.brandId,
    name: edition.name,
    summary: {
      campaigns: selected.campaigns.length,
      missions: campaignSources.reduce((sum, project) => sum + project.missions.length, 0),
      lessons: selected.campaigns.reduce(
        (sum, campaign) =>
          sum + (campaign.lessonPath ? decode(result.files.get(campaign.lessonPath)).length : 0),
        0,
      ),
      assets: assets.length,
      runtimeFiles: result.files.size,
      runtimeBytes: [...result.files.values()].reduce((sum, bytes) => sum + bytes.length, 0),
    },
    admittedPaths: [...result.files.keys()].sort(),
    excluded: {
      editionIds: exclusion('editions'),
      brandIds: exclusion('brands'),
      campaignIds: exclusion('campaigns'),
      assetIds: source.assets
        .filter(
          (asset) =>
            !assets.some(
              (selected) => selected.path === asset.path && selected.sha256 === asset.sha256,
            ),
        )
        .map((asset) => asset.id),
    },
    checks: STUDIO_REPORT_CHECKS,
    previewURL,
  };
}

export async function compileCompanyWorkspace({
  workspace = engineRoot,
  editionId,
  version = 'DEV',
  offline = null,
}) {
  const workspaceRoot = await fs.realpath(workspace),
    catalog = decode(await fs.readFile(path.join(workspaceRoot, 'game/editions/catalog.json')));
  const files = await collectEditionEngineFiles({ root: engineRoot }),
    enginePaths = [...files.keys()];
  const selected = await collectEditionSelectedFiles({
    catalog,
    editionIds: [editionId],
    read: async (file) => {
      required(editionRelativePath(file), 'Invalid workspace source path.');
      const actual = await fs.realpath(path.join(workspaceRoot, file));
      required(
        actual.startsWith(`${workspaceRoot}${path.sep}`),
        'Workspace source symlink escapes its directory.',
      );
      const stat = await fs.stat(actual);
      required(
        stat.isFile() && stat.size <= 32 * 1024 * 1024,
        'Workspace source exceeds its file budget.',
      );
      return fs.readFile(actual);
    },
  });
  for (const [name, bytes] of selected) files.set(name, bytes);
  const result = await compileEdition({
    catalog,
    editionIds: [editionId],
    files,
    enginePaths,
    version,
    offline,
  });
  return { result, report: companyStudioReport(catalog, result), catalog };
}

async function writeCompanyWorkspace(output, result) {
  // The destination itself remains new-only. Documented nested output paths
  // should work in a fresh checkout without a manual parent-directory step.
  await fs.mkdir(path.dirname(output), { recursive: true });
  await writeEdition(output, result);
}

async function main(args) {
  const command = args.shift(),
    options = {};
  required(
    ['init', 'import-draft', 'validate', 'preview', 'export'].includes(command),
    'Choose init, import-draft, validate, preview or export.',
  );
  for (let i = 0; i < args.length; i += 2) {
    required(
      [
        '--brand',
        '--edition',
        '--name',
        '--workspace',
        '--out',
        '--version',
        '--offline-base-path',
        '--file',
        '--media-root',
      ].includes(args[i]) &&
        args[i + 1] &&
        !Object.hasOwn(options, args[i].slice(2)),
      'Invalid or duplicate company studio option.',
    );
    options[args[i].slice(2)] = args[i + 1];
  }
  if (command === 'import-draft') {
    required(
      options.file && options.workspace,
      'Choose a source draft and a new workspace directory.',
    );
    const draft = companyDraftFiles(await fs.readFile(path.resolve(options.file), 'utf8'));
    await copyApprovedMedia(
      draft.catalog,
      draft.files,
      path.resolve(options['media-root'] ?? engineRoot),
    );
    await writeCompanyWorkspace(path.resolve(options.workspace), draft);
    process.stdout.write(
      `Imported ${draft.files.size} draft files. Run validate for the chosen edition before preview.\n`,
    );
    return;
  }
  if (command === 'init') {
    required(options.workspace, 'Choose a new workspace directory.');
    const currentCatalog = decode(
      await fs.readFile(path.join(engineRoot, 'game/editions/catalog.json')),
    );
    const sharedAssets = currentCatalog.assets.filter((asset) =>
        [
          'game/editions/assets/shared/Poppins-Regular.ttf',
          'game/editions/assets/shared/Poppins-OFL.txt',
        ].includes(asset.path),
      ),
      sharedFiles = new Map();
    required(
      sharedAssets.length === 2,
      'The neutral template needs its approved UI font and license.',
    );
    await copyApprovedMedia({ assets: sharedAssets }, sharedFiles, engineRoot);
    const draft = createCompanyWorkspaceFiles({
      brandId: options.brand,
      editionId: options.edition,
      name: options.name,
      sharedAssets,
      sharedFiles,
    });
    draft.files.set('source-draft.json', json(companySourceDraft(draft)));
    await writeCompanyWorkspace(path.resolve(options.workspace), draft);
    process.stdout.write(
      `Created ${draft.catalog.defaultEditionId} workspace (${draft.files.size} files).\n`,
    );
    return;
  }
  required(options.edition, 'Choose a registered edition.');
  const { result, report, catalog } = await compileCompanyWorkspace({
    workspace: path.resolve(options.workspace ?? engineRoot),
    editionId: options.edition,
    version: options.version ?? 'DEV',
    offline: options['offline-base-path'] ? { basePath: options['offline-base-path'] } : null,
  });
  if (command !== 'validate') {
    required(options.out, 'Choose a new output directory.');
    const output = path.resolve(options.out),
      relative = path.relative(engineRoot, output);
    await writeCompanyWorkspace(output, result);
    const previewURL =
      relative &&
      !relative.split(path.sep).some((segment) => segment.startsWith('.')) &&
      !path.isAbsolute(relative)
        ? `/${relative.split(path.sep).join('/')}/game/company.html`
        : null;
    const complete = companyStudioReport(catalog, result, { previewURL });
    await fs.writeFile(`${output}.report.json`, json(complete), { flag: 'wx' });
    process.stdout.write(`${JSON.stringify({ ...complete, admittedPaths: undefined })}\n`);
  } else process.stdout.write(`${JSON.stringify(report)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
