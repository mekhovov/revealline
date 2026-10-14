import test from 'node:test';
import assert from 'node:assert/strict';
import { overflightLaunchURL } from '../fpv-entry.mjs';
import {
  OVERFLIGHT_OPERATIONS,
  overflightRememberedOperationURL,
} from '../overflight/operation-view.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightPackage,
  createOverflightLibrary,
  exportOverflightPackage,
  importOverflightPackage,
} from '../overflight/community.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import {
  createOverflightRiyPackage,
  createOverflightRiyLibrary,
  exportOverflightRiyPackage,
  importOverflightRiyPackage,
} from '../overflight/riy-community.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightHuntPackage,
  createOverflightHuntLibrary,
  exportOverflightHuntPackage,
  importOverflightHuntPackage,
} from '../overflight/raid-community.mjs';
import { raidStudioRuntimePath } from '../studio/raid-preview-mode.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const families = [
  {
    id: 'overflight',
    create: createOverflightProject,
    compile: compileOverflightProject,
    pack: createOverflightPackage,
    library: createOverflightLibrary,
    export: exportOverflightPackage,
    import: importOverflightPackage,
    operations: ['overflight'],
  },
  {
    id: 'overflight-riy',
    create: createOverflightRiyProject,
    compile: compileOverflightRiyProject,
    pack: createOverflightRiyPackage,
    library: createOverflightRiyLibrary,
    export: exportOverflightRiyPackage,
    import: importOverflightRiyPackage,
    operations: ['overflight-riy'],
  },
  {
    id: 'overflight-hunt',
    create: createOverflightHuntProject,
    compile: compileOverflightHuntProject,
    pack: createOverflightHuntPackage,
    library: createOverflightHuntLibrary,
    export: exportOverflightHuntPackage,
    import: importOverflightHuntPackage,
    operations: ['overflight-hunt', 'time-attack', 'marathon'],
  },
];
const root = 'https://example.test/editions/game/releases/v0.151.1/site/';

// Exercise the same launch construction used by both native Creators, including
// the historical Survivor helper's family=1 marker. The receiving host must keep
// the explicit project and select its own native library, irrespective of Home.
function creatorLaunch(operation, identity) {
  if (['overflight-hunt', 'time-attack', 'marathon'].includes(operation))
    return new URL(
      raidStudioRuntimePath(operation, { community: identity }),
      root + 'game/studio/raid.html',
    );
  const url = new URL(overflightLaunchURL(root + 'game/studio/overflight.html', 'uk'));
  url.searchParams.set('community', identity);
  if (operation === 'overflight-riy') url.searchParams.set('operation', 'riy');
  return url;
}
function runtimeFamily(url) {
  if (url.pathname.endsWith('/raid.html')) return 'overflight-hunt';
  if (url.searchParams.get('operation') === 'riy' || url.searchParams.get('prototype') === 'riy')
    return 'overflight-riy';
  return 'overflight';
}

for (const family of families)
  for (const rulesVersion of [1, 4])
    test(`${family.id} rules ${rulesVersion}: Creator-installed project opens its own native library for every remembered operation`, async () => {
      const indexedDB = managedIndexedDB().indexedDB;
      const libraries = Object.fromEntries(
        families.map((entry) => [entry.id, entry.library({ indexedDB })]),
      );
      try {
        const source = family.create({ rulesVersion });
        const compiled = family.compile(source);
        const imported = await family.import(family.export(family.pack(source)));
        const identity = await libraries[family.id].install(imported);
        for (const operation of family.operations)
          for (const { id: remembered } of OVERFLIGHT_OPERATIONS)
            for (const withLegacyFamilyMarker of [false, true]) {
              const sourceURL = creatorLaunch(operation, identity);
              if (withLegacyFamilyMarker) sourceURL.searchParams.set('family', '1');
              else sourceURL.searchParams.delete('family');
              const before = sourceURL.href;
              const redirect = overflightRememberedOperationURL(before, remembered);
              const launch = new URL(redirect ?? before);
              assert.equal(launch.href, before, `${operation} must beat remembered ${remembered}`);
              assert.equal(runtimeFamily(launch), family.id);
              assert.equal(launch.searchParams.get('community'), identity);
              const loaded = await libraries[runtimeFamily(launch)].load(
                launch.searchParams.get('community'),
              );
              assert.deepEqual(family.compile(loaded.project), compiled);
            }
      } finally {
        for (const library of Object.values(libraries)) library.dispose();
      }
    });

test('explicit preview and legacy operation links beat family restoration, while generic Home still restores it', () => {
  for (const { id: remembered } of OVERFLIGHT_OPERATIONS) {
    for (const explicit of [
      'play.html?studio=overflight',
      'play.html?studio=overflight-riy&operation=riy',
      'play.html?prototype=riy',
      'play.html?operation=riy',
      'raid.html?studio=overflight-hunt',
      'raid.html?studio=overflight-hunt&operation=time-attack',
      'raid.html?studio=overflight-hunt&operation=marathon',
      'raid.html',
    ]) {
      const url = new URL(root + 'game/overflight/' + explicit);
      url.searchParams.set('family', '1');
      url.searchParams.set('lang', 'uk');
      url.searchParams.set('appearance', 'accepted');
      assert.equal(overflightRememberedOperationURL(url.href, remembered), null);
    }
    const home = new URL(root + 'game/overflight/play.html?family=1&lang=uk');
    const restored = new URL(overflightRememberedOperationURL(home.href, remembered));
    const selected = OVERFLIGHT_OPERATIONS.find(({ id }) => id === remembered);
    const expected = new URL(selected.path, home);
    assert.equal(restored.pathname, expected.pathname);
    assert.equal(restored.searchParams.get('operation'), expected.searchParams.get('operation'));
    assert.equal(restored.searchParams.get('lang'), 'uk');
  }
});
