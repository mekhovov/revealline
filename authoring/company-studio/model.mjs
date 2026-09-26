import {
  boundedJSON,
  canonicalJSON,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import {
  editionRelativePath,
  freezeEdition,
  resolveEditionSelection,
  validateEditionRuntimeCatalog,
} from '../../game/editions/model.mjs';
import {
  validateEditionCampaignProject,
  validateEditionLessonBundle,
} from '../../game/editions/project.mjs';
import { projectEditionThemeSelection } from '../../game/editions/selected-presentation.mjs';
import { validateCompanyLessons } from '../../game/company-campaigns/learning.mjs';
import { validateTheme } from '../../game/content.mjs';
import { validateAnimationRecipes } from '../motion-lab/animation.mjs';
import {
  validateEditionPresetMotion,
  validateEditionPresentation,
} from '../../game/editions/presets.mjs';

export const DRAFT_FORMAT = 'revealline-company-source-draft.v1';
export const REPORT_FORMAT = 'revealline-company-studio-report.v2';
export const STUDIO_REPORT_CHECKS = Object.freeze(
  [
    {
      id: 'schemas',
      status: 'passed',
      detail: 'Brand, edition, campaign and learning ownership boundaries validated.',
    },
    {
      id: 'assets',
      status: 'passed',
      detail: 'Selected media bytes match their declared approval, SHA-256 and byte count.',
    },
    {
      id: 'exclusion',
      status: 'passed',
      detail:
        'Other editions and authoring registries are absent from the admitted player inventory.',
    },
    {
      id: 'dependencies',
      status: 'passed',
      detail: 'Local imports and declared assets resolve within the standalone artifact.',
    },
    {
      id: 'playability',
      status: 'review-required',
      detail:
        'Compilation does not approve route playability, artwork, accessibility or human learning. Record these reviews separately.',
    },
  ].map(Object.freeze),
);
export function declaredJSONPaths(catalog) {
  return [
    ...new Set([
      ...catalog.campaigns.flatMap((campaign) => [
        campaign.sourcePath,
        ...(campaign.lessonPath ? [campaign.lessonPath] : []),
      ]),
      ...catalog.editions.flatMap((edition) => Object.values(edition.boot ?? {})),
    ]),
  ];
}
export function validateStudioData(path, input, catalog, files = new Map()) {
  required(
    declaredJSONPaths(catalog).includes(path),
    'This JSON path is not declared by the catalog.',
  );
  const data = boundedJSON(input);
  const campaign = catalog.campaigns.find((entry) => entry.sourcePath === path);
  if (campaign) return validateEditionCampaignProject(data, campaign).source;
  const lessonCampaign = catalog.campaigns.find((entry) => entry.lessonPath === path);
  if (lessonCampaign) {
    const lessons = validateCompanyLessons(data);
    required(
      lessons.every((lesson) => lesson.campaignId === lessonCampaign.id),
      'A lesson belongs to another campaign.',
    );
    const project = files.get(lessonCampaign.sourcePath);
    if (project) validateEditionLessonBundle(lessons, project);
    return lessons;
  }
  if (catalog.editions.some((edition) => edition.boot?.themes === path)) {
    required(
      Array.isArray(data.themes) && data.themes.length > 0 && data.themes.length <= 32,
      'A theme file needs a bounded theme array.',
    );
    for (const theme of data.themes) {
      const checked = validateTheme(theme);
      required(checked.valid, checked.errors.join(' '));
    }
  }
  if (catalog.editions.some((edition) => edition.boot?.presets === path)) {
    required(
      data.characters && typeof data.characters === 'object' && !Array.isArray(data.characters),
      'Character presets are required.',
    );
    validateAnimationRecipes(data);
    validateEditionPresetMotion(data);
    for (const body of Object.values(data.characters)) {
      if (body.src) {
        const url = new URL(body.src, 'https://studio.invalid/authoring/motion-lab/');
        required(
          url.origin === 'https://studio.invalid' &&
            !url.search &&
            !url.hash &&
            catalog.assets.some((asset) => `/${asset.path}` === url.pathname),
          'Player artwork must refer to a declared local asset.',
        );
      }
    }
  }
  return freezeEdition(data);
}
export function validateStudioDraft(input) {
  const draft = boundedJSON(input, {
    maxBytes: 16 * 1024 * 1024,
    maxNodes: 400000,
    maxArray: 8192,
  });
  exactKeys(draft, ['format', 'catalog', 'files'], 'company source draft');
  required(
    draft.format === DRAFT_FORMAT && Array.isArray(draft.files) && draft.files.length <= 2000,
    'Invalid company source draft.',
  );
  const catalog = validateEditionRuntimeCatalog(draft.catalog),
    files = new Map();
  const allowed = new Set(declaredJSONPaths(catalog));
  for (const file of draft.files) {
    exactKeys(file, ['path', 'data'], 'draft file');
    required(
      allowed.has(file.path) && !files.has(file.path),
      'Undeclared or duplicate draft path.',
    );
    files.set(file.path, file.data);
  }
  required(
    [...allowed].every((path) => files.has(path)),
    'The draft must contain every declared JSON source file.',
  );
  for (const [path, data] of files) files.set(path, validateStudioData(path, data, catalog, files));
  for (const edition of catalog.editions) {
    required(
      edition.boot?.themes && edition.boot?.presets,
      'Each edition needs declared presentation files.',
    );
    validateEditionPresentation({
      catalog,
      editionId: edition.id,
      themes: files.get(edition.boot.themes),
      presets: files.get(edition.boot.presets),
    });
  }
  return { catalog, files };
}
export function validateStudioReport(input) {
  const report = boundedJSON(input, { maxBytes: 4 * 1024 * 1024, maxArray: 8192, maxNodes: 60000 });
  required(
    report.format === REPORT_FORMAT &&
      stableId(report.editionId) &&
      stableId(report.brandId) &&
      typeof report.name === 'string' &&
      report.name.length <= 160,
    'Import a current v2 compiler report with a valid edition identity.',
  );
  required(
    report.summary &&
      ['campaigns', 'missions', 'lessons', 'assets', 'runtimeFiles', 'runtimeBytes'].every(
        (key) => Number.isSafeInteger(report.summary[key]) && report.summary[key] >= 0,
      ),
    'Invalid compiler summary.',
  );
  required(
    Array.isArray(report.admittedPaths) &&
      report.admittedPaths.every(editionRelativePath) &&
      new Set(report.admittedPaths).size === report.admittedPaths.length,
    'Invalid admitted path list.',
  );
  required(
    report.excluded &&
      ['editionIds', 'brandIds', 'campaignIds', 'assetIds'].every(
        (key) => Array.isArray(report.excluded[key]) && report.excluded[key].every(stableId),
      ),
    'Invalid exclusion report.',
  );
  required(
    canonicalJSON(report.checks) === canonicalJSON(STUDIO_REPORT_CHECKS),
    'Compiler checks are missing or changed. Compile a fresh report; it cannot approve human review.',
  );
  required(
    report.artifact?.path === 'edition-build.json' &&
      Number.isSafeInteger(report.artifact.bytes) &&
      report.artifact.bytes > 0 &&
      report.artifact.bytes <= 4 * 1024 * 1024 &&
      /^[a-f0-9]{64}$/.test(report.artifact.sha256),
    'The compiler report must pin its actual build manifest.',
  );
  exactKeys(report.artifact, ['path', 'bytes', 'sha256'], 'compiler artifact');
  required(
    report.previewURL === null || typeof report.previewURL === 'string',
    'Invalid preview path.',
  );
  return freezeEdition(report);
}
export function studioPreviewURL(report, baseURL) {
  const path = report.previewURL;
  required(
    typeof path === 'string' &&
      /^\/[A-Za-z0-9_./-]+\/game\/company\.html$/.test(path) &&
      !path.startsWith('//') &&
      path
        .slice(1)
        .split('/')
        .every((part) => !part.startsWith('.')),
    'Choose a local compiled company-game preview path.',
  );
  const base = new URL(baseURL),
    url = new URL(path, base);
  required(
    ['http:', 'https:'].includes(url.protocol) &&
      url.origin === base.origin &&
      !url.search &&
      !url.hash,
    'Preview must use this server’s origin.',
  );
  return url;
}
export function studioSelection(catalog, editionId) {
  const selection = resolveEditionSelection(catalog, { editionId });
  const ids = new Set(),
    assets = new Map(catalog.assets.map((asset) => [asset.id, asset]));
  const add = (id) => {
    if (ids.has(id)) return;
    ids.add(id);
    assets.get(id).dependencies.forEach(add);
  };
  [selection.edition, selection.brand, ...selection.campaigns]
    .flatMap((record) => record.assetIds ?? [])
    .forEach(add);
  return { ...selection, assets: catalog.assets.filter((asset) => ids.has(asset.id)) };
}
/** Match the compiler's existing, data-only projection. Unselected themes are
 * removed in both views; selected theme edits and other brand pins stay exact. */
export function projectStudioSelection(catalog, editionId, files = new Map()) {
  const selection = studioSelection(catalog, editionId);
  const projectedFiles = new Map(files);
  if (!selection.brand.themeIds) return { ...selection, files: projectedFiles };
  const projects = selection.campaigns.map((campaign) => {
    const source = files.get(campaign.sourcePath);
    required(source, 'Load every selected campaign before verifying the preview.');
    return validateEditionCampaignProject(source, campaign).source;
  });
  const themePath = selection.edition.boot?.themes;
  required(files.has(themePath), 'Load selected theme source before verifying the preview.');
  const projected = projectEditionThemeSelection({
    brand: selection.brand,
    projects,
    themes: files.get(themePath),
  });
  projectedFiles.set(themePath, projected.themes);
  return { ...selection, brand: projected.brand, files: projectedFiles };
}
export function assertMatchingStudioSelection(draft, built, editionId, files = new Map()) {
  const a = projectStudioSelection(draft, editionId, files),
    b = studioSelection(built, editionId);
  for (const key of ['edition', 'brand', 'campaigns', 'assets'])
    required(
      canonicalJSON(a[key]) === canonicalJSON(b[key]),
      'The compiled preview differs from this applied draft. Compile and import a fresh report.',
    );
  return b;
}
