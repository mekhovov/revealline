// Differential source/locale admission only. No package build or capacity claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OPTIONAL_PACKAGE_POLICIES } from '../../publishing/optional-package-policy.mjs';
import {
  optionalModuleDependencies,
  projectOptionalLocale,
} from '../../scripts/build-optional-practice.mjs';

const supportFiles = ['game/ui/local-support-summary.mjs', 'game/local-support-summary.mjs'];
const root = new URL('../../', import.meta.url);
const source = (path) => readFile(new URL(path, root));

for (const [id, app, limits] of [
  ['civilian-fpv', 'app.mjs', { files: 150, bytes: 12 * 1024 * 1024 + 512 * 1024 }],
  ['fpv-worlds', 'world-app.mjs', { files: 210, bytes: 20 * 1024 * 1024 }],
])
  test(`direct ${id} support imports and existing i18n/platform dependencies use its explicit admitted closure`, async () => {
    const policy = OPTIONAL_PACKAGE_POLICIES[id];
    const allowed = new Set([
      ...policy.localFiles.map((path) => policy.root + path),
      ...policy.sharedFiles,
    ]);
    for (const path of supportFiles) assert.ok(allowed.has(path), path);
    const paths = [
      `optional-practice/civilian-fpv/${app}`,
      ...supportFiles,
      'game/i18n/index.mjs',
      'game/i18n/bootstrap.mjs',
      'game/platform.mjs',
    ];
    for (const path of paths) {
      const dependencies = optionalModuleDependencies(path, await source(path), policy);
      for (const dependency of dependencies)
        assert.ok(allowed.has(dependency), `${path} imports unadmitted ${dependency}`);
      if (path === paths[0])
        for (const support of supportFiles) assert.ok(dependencies.includes(support));
    }
    assert.deepEqual(policy.limits, limits);
  });

for (const id of ['civilian-fpv', 'fpv-worlds'])
  for (const language of ['en', 'uk'])
    test(`${id} standalone ${language} projection includes exact support messages; legacy host gains none`, async () => {
      const catalogues = {};
      for (const namespace of ['errors', 'interface', 'common'])
        catalogues[namespace] = JSON.parse(
          await source(`game/locales/${language}/${namespace}.json`),
        );
      const projected = projectOptionalLocale(catalogues, OPTIONAL_PACKAGE_POLICIES[id]);
      const keys = Object.keys(catalogues.interface).filter((key) =>
        key.startsWith('supportSummary.'),
      );
      assert.ok(keys.includes('supportSummary.game.playback-ended'));
      for (const key of keys)
        assert.equal(projected.interface[key], catalogues.interface[key], key);
      const legacy = OPTIONAL_PACKAGE_POLICIES['civilian-flight'];
      assert.ok(supportFiles.every((path) => !legacy.sharedFiles.includes(path)));
      assert.ok(
        !Object.keys(projectOptionalLocale(catalogues, legacy).interface).some((key) =>
          key.startsWith('supportSummary.'),
        ),
      );
      assert.equal(
        OPTIONAL_PACKAGE_POLICIES['civilian-flight'].sharedFiles.includes('game/platform.mjs'),
        false,
      );
      assert.deepEqual(OPTIONAL_PACKAGE_POLICIES['civilian-flight'].limits, {
        files: 98,
        bytes: 8 * 1024 * 1024,
      });
      assert.deepEqual(OPTIONAL_PACKAGE_POLICIES['fpv-worlds'].limits, {
        files: 210,
        bytes: 20 * 1024 * 1024,
      });
    });
