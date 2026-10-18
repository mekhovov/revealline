import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadStandaloneSoloContext, soloDemoLaunchURL } from '../demo-modes/solo-catalog.mjs';
import { PACK_LIBRARY_VERSION } from '../packs.mjs';
import {
  classicLibrarySources,
  prepareMissionLibraryIndex,
} from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { readMissionLibraryHandoff, readMissionLibraryReady } from '../mission-library/handoff.mjs';
import { demoLaunchURL } from '../demo-launch.mjs';
import { loadBuiltinSoloDemoSources } from '../demo-modes/solo-builtins.mjs';
import { SOLO_BUILTIN_DEMO_INDEX } from '../demo-modes/solo-builtins-index.mjs';
import { resolveDemoTheme } from '../demo-modes/solo.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('cross-mode Solo enumerates exact installed authored packs without downloading or writing', async () => {
  const pack = await read('../content/packs/fpv-arcade-r5.json');
  const requests = [];
  let closed = 0,
    confirmed = 0;
  const context = await loadStandaloneSoloContext({
    fetch: async (url) => {
      requests.push(url.pathname);
      const text = await readFile(url, 'utf8');
      return { ok: true, json: async () => JSON.parse(text), text: async () => text };
    },
    inventoryReader: () => ({
      snapshot: async () => ({
        sha256: 'test',
        packs: { format: PACK_LIBRARY_VERSION, packs: [pack] },
      }),
      confirm: async () => {
        confirmed++;
      },
      close: () => {
        closed++;
      },
    }),
  });
  assert.equal(closed, 1);
  assert.equal(confirmed, 1);
  assert.ok(context.entries.some((entry) => entry.sourcePackId === pack.id));
  assert.ok(!requests.some((path) => path.endsWith('fpv-arcade-r5.json')));
  const sources = await context.loadSources({});
  const index = prepareMissionLibraryIndex(await read('../content/mission-library-index.json'));
  const library = createMissionLibrary(
    classicLibrarySources(index, {
      availability: () => ({ state: 'ready' }),
      launch() {},
    }),
  );
  try {
    for (const source of sources) {
      assert.ok(source.launchURL);
      assert.equal(demoLaunchURL(source), source.launchURL);
      const url = new URL(source.launchURL);
      assert.equal(readMissionLibraryReady(url.searchParams), true);
      if (source.journeyContext || !source.entry) {
        assert.ok(
          SOLO_BUILTIN_DEMO_INDEX.some(
            (row) =>
              row.id === source.id &&
              row.libraryMissionId === readMissionLibraryHandoff(url.searchParams),
          ),
        );
        continue;
      }
      assert.ok(library.find(readMissionLibraryHandoff(url.searchParams)));
      const forged = { ...source, level: { ...source.level, revision: 'stale' } };
      assert.equal(soloDemoLaunchURL(forged, index), null);
    }
  } finally {
    library.dispose();
  }
});

test('built-in Journey sources enumerate bounded metadata and prepare only the selected native owner', async () => {
  const requests = [];
  const sources = await loadBuiltinSoloDemoSources({
    fetch: async (url) => {
      requests.push(url.pathname);
      const text = await readFile(url, 'utf8');
      return { ok: true, json: async () => JSON.parse(text), text: async () => text };
    },
  });
  assert.ok(sources.length > 0);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((path) => /catalog\.journey-(current|archive)\.json$/.test(path)));
  assert.ok(sources.every((source) => source.entry === null));
  const source = sources[0];
  const player = await source.create({});
  try {
    assert.equal(player.state.tick, 0);
    assert.ok(source.entry.campaign.levels.includes(source.level));
    const theme = resolveDemoTheme(source.entry, source.level);
    assert.ok(
      theme?.id,
      'Native authored material themes must be admitted before scene rendering.',
    );
    assert.ok(
      source.entry.manifests.some(
        (manifest) =>
          manifest.level.id === source.levelId && manifest.presentation.themeId === theme.id,
      ),
    );
    assert.equal(
      source.journeyContext.editionId,
      SOLO_BUILTIN_DEMO_INDEX.find((row) => row.id === source.id).routeId,
    );
    assert.equal(
      source.journeyContext.profile,
      null,
      'Separate built-in contexts cannot grant picture rights.',
    );
    assert.equal(requests.filter((path) => path.endsWith('.replay.json')).length, 1);
  } finally {
    player.dispose();
  }
});

test('locked or unavailable installed inventory retains base Solo without repairing storage', async () => {
  const context = await loadStandaloneSoloContext({
    fetch: async (url) => ({ ok: true, json: async () => JSON.parse(await readFile(url, 'utf8')) }),
    inventoryReader: () => {
      throw Error('Recovery lock');
    },
  });
  assert.ok(context.entries.every((entry) => entry.sourcePackId === null));
});
