import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { BUILTIN_THEME_FAMILIES } from '../game/presentation/theme-system.mjs';
import { createOptionalPackageCandidate } from '../publishing/optional-package-candidate.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const interfaceKeys = [
  'workshop.appearance',
  'workshop.familyId',
  'workshop.followContext',
  'workshop.customize',
  'workshop.customized',
  'workshop.arcadeArt',
  'workshop.ornaments',
  'workshop.highContrast',
  'workshop.opaqueHud',
  'workshop.previewThemes',
  'workshop.description.follow-game',
  'workshop.description.curated',
  ...BUILTIN_THEME_FAMILIES.flatMap(({ id }) => [
    `workshop.theme.${id}`,
    `workshop.description.${id}`,
  ]),
];
const commonKeys = [
  'menuSounds',
  'menuVolume',
  'radioSounds',
  'radioVolume',
  'movementSounds',
  'movementVolume',
];
for (const packageId of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
  test(`${packageId} carries the canonical English and Ukrainian global settings labels offline`, async () => {
    // Synthetic identities exercise admission, not release qualification.
    const binding = {
      version: 'v1.2.3',
      sourceRevision: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
    };
    const built = await buildOptionalPractice(root, {
      packageId,
      engineCommit: binding.sourceRevision,
      engineTree: binding.sourceTree,
    });
    const candidate = createOptionalPackageCandidate({ built, ...binding });
    const admitted = await validateOptionalPackageAdmission(
      { format: 'revealline-optional-packages.v1', ...binding, packages: [candidate.package] },
      { read: async (row) => candidate.files.get(row.path) },
    );
    assert.equal(admitted.publicEligible, false);
    for (const name of [
      'game/ui/art/identity/fpv-line/wordmark.png',
      'game/ui/art/menu-scenes/fpv.webp',
    ])
      assert.ok(
        built.entries.some((entry) => entry.name === name),
        `${packageId} packages its menu artwork`,
      );
    const bytes = built.entries.find(({ name }) => name === 'game/i18n/catalogs.mjs').bytes;
    const text = bytes.toString();
    const marker = 'globalThis.RevealLineTranslations=';
    const catalog = JSON.parse(
      text
        .slice(text.indexOf(marker) + marker.length)
        .trim()
        .replace(/;$/, ''),
    );
    for (const locale of ['en', 'uk'])
      for (const [namespace, keys] of [
        ['interface', interfaceKeys],
        ['common', commonKeys],
      ]) {
        const canonical = JSON.parse(
          await readFile(new URL(`../game/locales/${locale}/${namespace}.json`, import.meta.url)),
        );
        for (const key of keys) {
          assert.equal(typeof canonical[key], 'string', `${locale}:${key} has canonical copy`);
          assert.equal(
            catalog[locale][namespace][key],
            canonical[key],
            `${packageId} ${locale}:${key}`,
          );
        }
      }
  });
