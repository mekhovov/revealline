import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanyWorkspaceFiles, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { validateEditionRuntimeCatalog } from '../editions/model.mjs';
import {
  DRAFT_FORMAT,
  REPORT_FORMAT,
  declaredJSONPaths,
  validateStudioDraft,
  validateStudioData,
  validateStudioReport,
  studioPreviewURL,
  assertMatchingStudioSelection,
} from '../../authoring/company-studio/model.mjs';

function fixture() {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'acme',
    editionId: 'acme-public',
    name: 'Acme',
  });
  return {
    format: DRAFT_FORMAT,
    catalog: workspace.catalog,
    files: declaredJSONPaths(workspace.catalog).map((path) => ({
      path,
      data: JSON.parse(workspace.files.get(path).toString('utf8')),
    })),
  };
}

test('studio source packet roundtrips through the actual new-company CLI workspace format', () => {
  const packet = fixture(),
    checked = validateStudioDraft(packet);
  assert.equal(checked.catalog.brands[0].id, 'acme');
  assert.equal(checked.files.size, 7);
  const imported = companyDraftFiles(JSON.stringify(packet));
  for (const [path, data] of checked.files)
    assert.deepEqual(JSON.parse(imported.files.get(path).toString('utf8')), data);
  assert.equal(imported.catalog.defaultEditionId, 'acme-public');
});

test('studio blocks missing sources, duplicate source paths and executable workspace injection', () => {
  const packet = fixture();
  assert.throws(
    () => validateStudioDraft({ ...packet, files: packet.files.slice(1) }),
    /every declared/,
  );
  assert.throws(
    () => validateStudioDraft({ ...packet, files: [...packet.files, packet.files[0]] }),
    /duplicate/,
  );
  assert.throws(
    () =>
      validateStudioDraft({
        ...packet,
        files: [...packet.files, { path: 'game/company-player.mjs', data: { script: 'no' } }],
      }),
    /Undeclared/,
  );
  assert.throws(
    () =>
      validateStudioDraft({
        ...packet,
        files: [...packet.files, { path: '../other.json', data: {} }],
      }),
    /Undeclared/,
  );
});

test('actor edits reject undeclared remote media and unbounded cosmetic motion before export', () => {
  const packet = fixture(),
    { catalog, files } = validateStudioDraft(packet),
    path = catalog.editions[0].boot.presets;
  const external = structuredClone(files.get(path));
  external.characters['neutral-marker'].src = 'https://unrelated.test/avatar.png';
  assert.throws(() => validateStudioData(path, external, catalog, files), /declared local asset/);
  const fast = structuredClone(files.get(path));
  fast.characters['neutral-marker'].bodyMotion = {
    kind: 'rigid-spin',
    radiansPerSecond: 200,
    travelGain: 0,
  };
  assert.throws(() => validateStudioData(path, fast, catalog, files), /cosmetic body motion/);
  const smuggled = structuredClone(files.get(path));
  smuggled.characters['neutral-marker'].bodyMotion = {
    kind: 'rigid-spin',
    radiansPerSecond: 1,
    travelGain: 0,
    script: 'ignored',
  };
  assert.throws(() => validateStudioData(path, smuggled, catalog, files), /not supported/);
});

test('compiled preview must match the selected draft identity, content selection and artwork pins', () => {
  const { catalog } = validateStudioDraft(fixture());
  assert.equal(
    assertMatchingStudioSelection(catalog, catalog, 'acme-public').edition.id,
    'acme-public',
  );
  const changed = structuredClone(catalog);
  changed.editions[0].name = 'Acme revised';
  assert.throws(
    () =>
      assertMatchingStudioSelection(validateEditionRuntimeCatalog(changed), catalog, 'acme-public'),
    /differs from this applied draft/,
  );
  const another = fixture();
  another.catalog = structuredClone(another.catalog);
  another.catalog.brands[0].description = 'Another story';
  assert.throws(
    () => assertMatchingStudioSelection(another.catalog, catalog, 'acme-public'),
    /differs from this applied draft/,
  );
});

test('complete studio drafts apply the compiler gate for selected presentation and asset closure', () => {
  const packet = fixture();
  packet.catalog = structuredClone(packet.catalog);
  packet.catalog.assets.push({
    id: 'unselected-avatar',
    path: 'game/editions/assets/other/avatar.png',
    sha256: '1'.repeat(64),
    bytes: 24,
    publication: 'public',
    approved: true,
    dependencies: [],
  });
  const presets = packet.files.find(
    (file) => file.path === packet.catalog.editions[0].boot.presets,
  );
  presets.data.characters['neutral-marker'].src = '../../game/editions/assets/other/avatar.png';
  assert.throws(() => validateStudioDraft(packet), /selected approved asset closure/);
  const another = fixture();
  const themes = another.files.find(
    (file) => file.path === another.catalog.editions[0].boot.themes,
  );
  themes.data.themes[0].id = 'another-company';
  assert.throws(() => validateStudioDraft(another), /selected brand/);
});

test('compiler report preserves review-required checks and only opens local company-game URLs', () => {
  const report = {
    format: REPORT_FORMAT,
    editionId: 'acme-public',
    brandId: 'acme',
    name: 'Acme',
    summary: {
      campaigns: 1,
      missions: 1,
      lessons: 0,
      assets: 0,
      runtimeFiles: 20,
      runtimeBytes: 1000,
    },
    admittedPaths: ['game/company.html'],
    excluded: { editionIds: [], brandIds: [], campaignIds: [], assetIds: [] },
    checks: [
      { id: 'playability', status: 'review-required', detail: 'A new design needs route proof.' },
    ],
    previewURL: '/dist/company-previews/acme/game/company.html',
  };
  const checked = validateStudioReport(report);
  assert.equal(checked.checks[0].status, 'review-required');
  assert.equal(
    studioPreviewURL(checked, 'http://localhost:8768/authoring/company-studio/').href,
    'http://localhost:8768/dist/company-previews/acme/game/company.html',
  );
  for (const path of [
    'https://unrelated.test/game/company.html',
    '//unrelated.test/game/company.html',
    'javascript:alert(1)',
    '/.cache/acme-preview/game/company.html',
    '/.cache/a/../game/company.html',
    '/.cache/%2e%2e/game/company.html',
    '/.cache/a/game/company.html?edition=other',
  ])
    assert.throws(() =>
      studioPreviewURL(
        { ...report, previewURL: path },
        'http://localhost:8768/authoring/company-studio/',
      ),
    );
  assert.throws(
    () => validateStudioReport({ ...report, admittedPaths: ['../outside.txt'] }),
    /admitted path/,
  );
});
