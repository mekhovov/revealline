import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REMOTE_TEAM_NAVIGATION } from '../game/content-design/remote-team-navigation-registry.mjs';
import { selectOfflineCore } from './offline-core-closure.mjs';

test('published Solo retains exact display assets while its unused source adapter stays optional', async () => {
  const names = [
    'game/app.mjs',
    'game/mission-library/remote-team-display.mjs',
    'game/content-design/remote-team-navigation-registry.mjs',
    'game/content-design/route-snapshot.mjs',
    ...REMOTE_TEAM_NAVIGATION.map((descriptor) => `game/content-design/${descriptor.path}`),
  ];
  const entries = await Promise.all(
    names.map(async (name) => ({
      name,
      bytes: await readFile(new URL(`../${name}`, import.meta.url)),
    })),
  );
  entries.push({
    name: 'game/index.html',
    bytes: Buffer.from('<script type="module" src="app.mjs"></script>'),
  });
  const { retained, optional } = selectOfflineCore(entries, new Set());
  assert(retained.has('game/app.mjs'));
  assert(!retained.has('game/mission-library/remote-team-display.mjs'));
  assert(optional.includes('game/mission-library/remote-team-display.mjs'));
  let total = 0;
  for (const descriptor of REMOTE_TEAM_NAVIGATION) {
    const name = `game/content-design/${descriptor.path}`;
    assert(
      retained.has(name),
      'Existing runtime-directory policy must cache every exact display asset.',
    );
    const bytes = entries.find((entry) => entry.name === name).bytes;
    assert.equal(bytes.length, descriptor.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
    total += bytes.length;
  }
  assert.equal(
    total,
    669955,
    'Account for the reviewed display bytes, rather than treating metadata as free.',
  );
  assert(total < 4 * 1024 * 1024);
});

test('display loading remains a literal package dependency and never enters route/native admission', async () => {
  const adapter = await readFile(
    new URL('../game/mission-library/remote-team-display.mjs', import.meta.url),
    'utf8',
  );
  const app = await readFile(new URL('../game/app.mjs', import.meta.url), 'utf8');
  const build = JSON.parse(await readFile(new URL('../game/build-config.json', import.meta.url)));
  assert(app.includes("'./mission-library/remote-team-display.mjs'"));
  assert(adapter.includes("'../content-design/remote-team-navigation-registry.mjs'"));
  assert(adapter.includes('readPublishedSnapshot(descriptor, options)'));
  assert(
    !/admitPublished|loadRouteSnapshot|createCandidateTeamHost|createTeamExpansionCandidates/.test(
      adapter,
    ),
  );
  assert(build.include.some((item) => item === 'game' || item.path === 'game'));
  for (const descriptor of REMOTE_TEAM_NAVIGATION)
    assert(/^runtime\/remote-team-[a-z]+\.json$/.test(descriptor.path));
});
