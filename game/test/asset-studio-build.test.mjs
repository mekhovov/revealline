import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBuildConfig, collectBuildFiles } from '../../scripts/game-cli.mjs';

test('the release allowlist includes the Studio and its complete static module graph', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const config = await readBuildConfig(root);
  const files = new Set(await collectBuildFiles(root, config));
  const pending = ['authoring/asset-studio/studio.mjs'];
  const seen = new Set();
  for (const entry of [
    'authoring/asset-studio/index.html',
    'authoring/asset-studio/studio.css',
    'docs/asset-studio.md',
    'docs/presentation-system.md',
    'game/ui/field-kit-fonts.css',
    'game/ui/field-kit-tokens.css',
    'game/ui/field-kit-components.css',
    'game/ui/operation-status.css',
    'game/ui/direct-tool-launch.js',
    'authoring/motion-lab/presets.json',
    'game/content/packs/fpv-arcade-r5.json',
  ])
    assert.ok(files.has(entry), 'Missing Studio dependency: ' + entry);
  while (pending.length) {
    const name = pending.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    assert.ok(files.has(name), 'Missing Studio module: ' + name);
    const source = await fs.readFile(path.join(root, name), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
      assert.ok(files.has(target), 'Missing static Studio import: ' + target);
      if (target.endsWith('.mjs')) pending.push(target);
    }
  }
  assert.ok(seen.has('game/presentation/current-art.mjs'));
  assert.ok(seen.has('game/presentation/studio-store.mjs'));
  assert.ok(seen.has('game/ui/render.mjs'));
  assert.ok(seen.has('game/multiplayer.mjs'));
  assert.ok(seen.has('game/couch/coop-view.mjs'));
  assert.ok(seen.has('game/couch/coop-picture-bindings.mjs'));
  assert.ok(seen.has('authoring/asset-studio/team-preview-fixture.mjs'));
});
