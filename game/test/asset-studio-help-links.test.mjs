import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';

test('Studio production guides and their local Markdown destinations ship together', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const config = JSON.parse(await fs.readFile(path.join(root, 'game/build-config.json'), 'utf8'));
  const pending = ['docs/presentation-system.md', 'docs/field-kit-production.md'];
  const seen = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (seen.has(name)) continue;
    seen.add(name);

    // Expand only the real allowlist entries covering this destination. Other game
    // assets are irrelevant to this bounded documentation check; source existence
    // alone is insufficient because an unlisted document is not published.
    const include = config.include.filter(
      (entry) => name === entry || name.startsWith(entry + '/'),
    );
    assert.ok(include.length, 'Unshipped Studio help destination: ' + name);
    const files = new Set(await collectBuildFiles(root, { entry: name, include }));
    assert.ok(files.has(name), 'Missing Studio help destination: ' + name);
    if (!name.endsWith('.md')) continue;

    const source = await fs.readFile(path.join(root, name), 'utf8');
    // These guides use inline Markdown links, including relative destinations.
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const reference = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) continue;
      const destination = reference.split(/[?#]/, 1)[0];
      if (!destination) continue;
      assert.ok(!destination.startsWith('/'), 'Root-relative Studio help link: ' + reference);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), destination));
      assert.ok(!target.startsWith('../'), 'Studio help link escapes the release: ' + reference);
      pending.push(target);
    }
  }
});
