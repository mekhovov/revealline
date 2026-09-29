import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';

// Exercise the actual include list without producing a build, decoding images,
// rewriting assets or broadening any mode's offline-core closure.
test('integrated authoring tools retain their new modules and explicit reference files in distribution', async () => {
  const root = new URL('../../', import.meta.url);
  const files = new Set(await collectBuildFiles(fileURLToPath(root)));
  for (const name of [
    'authoring/motion-lab/rotor-editor.mjs',
    'authoring/motion-lab/parts-editor.mjs',
    'authoring/motion-lab/inspection-travel.mjs',
    'authoring/game-feel-lab/index.html',
    'authoring/game-feel-lab/background.mjs',
    'authoring/game-feel-lab/lifecycle.mjs',
    'authoring/game-feel-lab/render.mjs',
    'authoring/game-feel-lab/sequence.mjs',
    'authoring/game-feel-lab/workshop.mjs',
    'authoring/game-feel-lab/workshop.css',
    'authoring/library/real-world-references/synevyr-lake-rafts.jpg',
    'authoring/library/real-world-references/synevyr-lake-rafts.json',
    'authoring/asset-studio/rotor-controls.mjs',
    'authoring/asset-studio/artwork-collection.mjs',
    'authoring/asset-studio/artwork-comparison.mjs',
    'authoring/asset-studio/artwork-derivative.mjs',
    'authoring/asset-studio/artwork-panel.mjs',
    'docs/artwork-collection-packets.md',
  ])
    assert.ok(files.has(name), `Missing authoring dependency: ${name}`);
  assert.equal(
    files.has('game/test/fixtures/artwork-collection-revision7.json'),
    false,
    'Metadata-only regression fixture is not a distributed image cohort',
  );
  const config = JSON.parse(await readFile(new URL('game/build-config.json', root), 'utf8'));
  assert.ok(
    !config.include.includes('authoring/library/real-world-references'),
    'Only explicitly reviewed reference files are included, not future sibling assets',
  );
});
