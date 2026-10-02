import fs from 'node:fs/promises';
import path from 'node:path';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import {
  validatePracticeDescription,
  PRACTICE_DETAILS_FORMAT,
} from '../game/optional-practice-details.mjs';
import {
  practiceDirectoryHTML,
  PRACTICE_DIRECTORY_SCRIPT,
} from '../publishing/practice-directory.mjs';
import { sourceGit } from './frozen-source.mjs';

/** Local development only. Never reviews, uploads, or changes a selector. */
export async function practicePreflight({ root, preview } = {}) {
  const ids = Object.keys(OPTIONAL_PACKAGE_POLICIES),
    reports = [],
    catalog = [],
    details = [],
    outputs = new Map();
  const version =
    'v' + JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
  const engineCommit = sourceGit(root, ['rev-parse', 'HEAD']).trim();
  const engineTree = sourceGit(root, ['rev-parse', 'HEAD^{tree}']).trim();
  for (const packageId of ids) {
    const policy = OPTIONAL_PACKAGE_POLICIES[packageId];
    const errors = [];
    for (const name of [
      ...policy.localFiles.map((name) => policy.root + name),
      ...policy.sharedFiles,
      ...policy.localeInputs,
    ]) {
      try {
        await fs.access(path.join(root, name));
      } catch {
        errors.push('Missing: ' + name);
      }
    }
    for (const license of policy.licenses) {
      if (!license.dependency || !license.license || !license.path)
        errors.push('Incomplete license inventory');
      try {
        if (!(await fs.readFile(path.join(root, license.path))).length)
          errors.push('Empty license: ' + license.path);
      } catch {
        errors.push('Missing license: ' + license.path);
      }
    }
    try {
      if (errors.length) throw new Error('Source inventory incomplete');
      const built = await buildOptionalPractice(root, {
        packageId,
        engineCommit,
        engineTree,
        basePath: '/',
      });
      const description = validatePracticeDescription(
        await fs.readFile(path.join(root, policy.root, 'package-info.json'), 'utf8'),
        packageId,
      );
      const offlineBytes = built.manifest.files.reduce((sum, row) => sum + row.bytes, 0);
      const relative = `${packageId}/releases/${version}/site/`;
      catalog.push({
        id: packageId,
        name: description.copy.en.name,
        href: `${packageId}/app/`,
        version,
        revision: built.manifest.revision,
      });
      details.push({
        id: packageId,
        revision: built.manifest.revision,
        description,
        preview: relative + policy.root + 'preview.png',
        guide: relative + policy.root + 'guide.html',
        downloadBytes: built.zip.length,
        offlineBytes,
      });
      if (preview) {
        for (const entry of built.entries) {
          outputs.set('practice/' + relative + entry.name, entry.bytes);
          if (entry.name.startsWith('launcher/'))
            outputs.set(`practice/${packageId}/app/` + entry.name.slice(9), entry.bytes);
        }
        outputs.set(
          `practice/${packageId}/app/current.json`,
          Buffer.from(
            JSON.stringify({
              id: packageId,
              version,
              scope: `../releases/${version}/site/`,
              entry: policy.entry,
            }),
          ),
        );
      }
      reports.push({
        id: packageId,
        readyToBundle: true,
        files: built.entries.length,
        offlineBytes,
        downloadBytes: built.zip.length,
        limits: policy.limits,
        revision: built.manifest.revision,
        errors,
      });
    } catch (error) {
      errors.push(error.message);
      reports.push({ id: packageId, readyToBundle: false, errors });
    }
  }
  const result = {
    format: 'revealline-practice-preflight.v1',
    publicEligible: false,
    note: 'Development preview only. Commit source, reproduce artifacts and complete all existing review gates before publication.',
    packages: reports,
  };
  if (preview) {
    if (reports.some((row) => !row.readyToBundle))
      throw new Error('Preview refused: preflight failed. ' + JSON.stringify(result));
    const output = path.resolve(root, preview);
    const relative = path.relative(root, output);
    if (!relative.startsWith('.cache/'))
      throw new Error('Preview must use a new .cache/ subdirectory.');
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.mkdir(output); // Refuse replacement of any existing preview.
    outputs.set(
      'practice/index.json',
      Buffer.from(
        JSON.stringify({ format: 'revealline-optional-package-launchers.v1', packages: catalog }),
      ),
    );
    outputs.set(
      'practice/details.json',
      Buffer.from(JSON.stringify({ format: PRACTICE_DETAILS_FORMAT, packages: details })),
    );
    outputs.set('practice/index.html', Buffer.from(practiceDirectoryHTML(catalog, details)));
    outputs.set('practice/directory.mjs', Buffer.from(PRACTICE_DIRECTORY_SCRIPT));
    outputs.set('preflight.json', Buffer.from(JSON.stringify(result, null, 2)));
    // The existing local server applies the same restrictive preview CSP.
    outputs.set(
      '.xonix-build.json',
      Buffer.from(JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 })),
    );
    for (const [name, bytes] of outputs) {
      const target = path.join(output, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    }
    result.preview = output;
  }
  return result;
}
