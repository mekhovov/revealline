import test from 'node:test';
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {
  createCompanyWorkspaceFiles,
  companyDraftFiles,
  companyStudioReport,
  companySourceDraft,
} from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { projectEditionEnglishLocalization } from '../../scripts/edition-localization.mjs';
import { validateEditionPresetMotion } from '../editions/presets.mjs';
import { validateBrandPack } from '../editions/model.mjs';

test('new companies use the same complete source workspace and player compiler', async () => {
  const source = createCompanyWorkspaceFiles({
    brandId: 'new-company',
    editionId: 'new-company-adventure',
    name: 'New Company',
  });
  const result = await compileEdition({
    catalog: source.catalog,
    editionIds: ['new-company-adventure'],
    files: source.files,
  });
  const report = companyStudioReport(source.catalog, result, {
    previewURL: '/preview/game/company.html',
  });
  assert.equal(report.brandId, 'new-company');
  assert.equal(report.summary.missions, 1);
  assert.equal(report.summary.campaigns, 1);
  assert.equal(report.previewURL, '/preview/game/company.html');
  assert.equal(
    companyStudioReport(source.catalog, result, { previewURL: '/.cache/preview/game/company.html' })
      .previewURL,
    null,
  );
  assert.ok(!report.admittedPaths.includes('README.md'));
  assert.equal(report.checks.find((row) => row.id === 'playability').status, 'review-required');
  assert.throws(
    () => createCompanyWorkspaceFiles({ brandId: '../bad', name: 'Bad' }),
    /edition identity/,
  );
});

test('a bounded studio draft roundtrips source JSON and refuses undeclared payload paths', () => {
  const source = createCompanyWorkspaceFiles({ brandId: 'new-company', name: 'New Company' });
  assert.deepEqual(companyDraftFiles(companySourceDraft(source)).catalog, source.catalog);
  const draft = {
    format: 'revealline-company-source-draft.v1',
    catalog: source.catalog,
    files: [...source.files]
      .filter(([name]) => name.endsWith('.json') && name !== 'game/editions/catalog.json')
      .map(([name, bytes]) => ({ path: name, data: JSON.parse(bytes) })),
  };
  const restored = companyDraftFiles(draft);
  for (const [name, bytes] of restored.files) assert.deepEqual(bytes, source.files.get(name));
  draft.files.push({ path: 'authoring/private.json', data: { secret: 'never publish' } });
  assert.throws(() => companyDraftFiles(draft), /unique declared runtime/);
});

test('English edition projection removes other languages and legacy campaign translations', () => {
  const resources = {
    en: {
      interface: { ready: 'Ready' },
      gameplay: { score: 'Score' },
      content: { secret: 'Unselected campaign sentence' },
      website: { old: 'Old site' },
    },
    uk: { interface: { ready: 'Non-English sentinel' } },
  };
  const encoded = LZString.compressToBase64(JSON.stringify(resources));
  const source = new Map([
    [
      'game/i18n/catalogs.mjs',
      Buffer.from(
        `// Codec license retained.\nglobalThis.RevealLineTranslations = JSON.parse(decode(${JSON.stringify(encoded)}));`,
      ),
    ],
    ['game/i18n/bootstrap.mjs', Buffer.from("const locales = ['en', 'uk']; export {locales};")],
    [
      'game/i18n/content-registry.mjs',
      Buffer.from("export default { 'old-campaign': {secret:'Unselected content'} };"),
    ],
  ]);
  const original = Buffer.from(source.get('game/i18n/catalogs.mjs'));
  const output = projectEditionEnglishLocalization(source),
    code = output.get('game/i18n/catalogs.mjs').toString();
  const literal = JSON.parse(code.match(/decode\(("[^"]*")\)/)[1]);
  assert.deepEqual(JSON.parse(LZString.decompressFromBase64(literal)), {
    en: { interface: { ready: 'Ready' }, gameplay: { score: 'Score' } },
  });
  assert.ok(code.startsWith('// Codec license retained.'));
  assert.equal(
    output.get('game/i18n/bootstrap.mjs').toString(),
    "const locales = ['en']; export {locales};",
  );
  assert.ok(!output.get('game/i18n/content-registry.mjs').toString().includes('old-campaign'));
  assert.deepEqual(source.get('game/i18n/catalogs.mjs'), original);
});

test('publication sources and motion are bounded before an edition becomes active', () => {
  const source = createCompanyWorkspaceFiles({ brandId: 'new-company', name: 'New Company' });
  const brand = structuredClone(source.catalog.brands[0]);
  brand.sources = [
    { title: 'Official company', url: 'https://example.com/company', kind: 'official' },
  ];
  assert.equal(validateBrandPack(brand).sources.length, 1);
  brand.sources[0].url = 'javascript:alert(1)';
  assert.throws(() => validateBrandPack(brand), /public HTTPS/);
  const preset = {
    characters: {
      logo: { bodyMotion: { kind: 'rigid-spin', radiansPerSecond: 0.6, travelGain: 0.3 } },
    },
  };
  assert.ok(Object.isFrozen(validateEditionPresetMotion(preset)));
  preset.characters.logo.bodyMotion.radiansPerSecond = 200;
  assert.throws(() => validateEditionPresetMotion(preset), /cosmetic body motion/);
  preset.characters.logo.bodyMotion.radiansPerSecond = 0.6;
  preset.characters.logo.bodyMotion.script = 'https://untrusted.test/code';
  assert.throws(() => validateEditionPresetMotion(preset), /not supported/);
});
