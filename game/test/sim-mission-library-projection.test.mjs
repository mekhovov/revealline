import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import {
  attachSimMissionLibraryChooser,
  createSimMissionLibrary,
} from '../../optional-practice/civilian-fpv/flight-fullscreen.mjs';
import {
  OPTIONAL_PACKAGE_POLICIES,
  optionalRuntimePaths,
} from '../../publishing/optional-package-policy.mjs';
import {
  optionalModuleDependencies,
  projectOptionalLocale,
} from '../../scripts/build-optional-practice.mjs';

const entries = Array.from({ length: 24 }, (_, index) => ({
  id: `course-${index}`,
  name: `Course ${index}`,
  campaignKey: `world-${Math.floor(index / 8)}`,
  campaignTitle: `World ${Math.floor(index / 8)}`,
  levelIndex: index % 8,
  modes: ['solo'],
  diagram: { width: 24, height: 16, course: index },
}));

function fixture(t) {
  const document = new Document(),
    launched = [],
    painted = [],
    released = [],
    library = createSimMissionLibrary([
      {
        id: 'sim-worlds',
        editionId: 'v1',
        edition: 'Simulator worlds',
        collection: 'Classic',
        entries,
        describe: (entry) => entry,
        availability: () => ({ state: 'ready' }),
        card: (entry) => entry.diagram,
        launch: (entry, options) => {
          launched.push({ entry, mode: options.mode });
          return true;
        },
      },
    ]);
  const opener = document.createElement('button');
  document.body.append(opener);
  const chooser = attachSimMissionLibraryChooser({
    document,
    library,
    supportedModes: ['solo'],
    goalPreferenceOptions: { editionId: 'sim-worlds', getStorage: () => null },
    renderPreview({ container, diagram, row, mode, document: doc }) {
      assert.equal(doc, document);
      assert.equal(mode, 'solo');
      assert.equal(diagram, entries.find((entry) => entry.id === row.runtimeId).diagram);
      const preview = doc.createElement('span');
      preview.className = 'sim-route-diagram';
      preview.textContent = row.runtimeId;
      container.append(preview);
      painted.push(row.id);
      return { release: () => released.push(row.id) };
    },
  });
  t.after(() => {
    chooser.destroy();
    library.dispose();
  });
  chooser.open(opener);
  return { document, library, chooser, launched, painted, released, opener };
}

test('projected SIM browser keeps every campaign in one gallery and launches the exact owner once', async (t) => {
  const f = fixture(t),
    { list } = f.chooser.elements,
    rail = f.document.getElementById('journey-campaign-rail');
  assert.equal(list.children.length, 24);
  assert.equal(rail.children.length, 3);
  rail.children[2].click();
  assert.equal(
    list.children.length,
    24,
    'A campaign shortcut only scrolls, never hides other worlds.',
  );
  const selected = f.document.activeElement;
  assert.equal(f.library.find(selected.dataset.missionId).runtimeId, 'course-16');
  assert.deepEqual(f.launched, []);
  await selected.onclick();
  assert.deepEqual(f.launched, [{ entry: entries[16], mode: 'solo' }]);
  assert.equal(f.chooser.elements.dialog.open, false);
  await selected.onclick();
  assert.equal(f.launched.length, 1, 'A detached or closed selection cannot launch again.');
});

test('projected preview services are lazy, disposable and retire stale filtered cards', async (t) => {
  const f = fixture(t);
  assert.equal(f.painted.length, 12, 'Fallback previews remain bounded near the viewport.');
  const original = f.chooser.elements.list.children[0];
  const search = f.document.getElementById('journey-search');
  search.value = 'Course 23';
  search.emit('input');
  assert.equal(f.chooser.elements.list.children.length, 1);
  assert.equal(f.released.length, 12);
  assert.equal(f.painted.length, 13);
  await original.onclick();
  assert.deepEqual(f.launched, []);
  f.chooser.close();
  assert.equal(f.released.length, 13, 'Closing releases the last visible host preview.');
  assert.equal(f.document.activeElement, f.opener);
});

test('SIM selector projection stays inside existing optional executable and stylesheet slots', async () => {
  const file = 'optional-practice/civilian-fpv/flight-fullscreen.mjs',
    bytes = await readFile(new URL('../../' + file, import.meta.url));
  const css = await readFile(
    new URL('../../optional-practice/civilian-fpv/flight-fullscreen.css', import.meta.url),
    'utf8',
  );
  const canonical = await readFile(new URL('../ui/journey.css', import.meta.url), 'utf8');
  assert.ok(
    css.includes(canonical.trim()),
    'The optional stylesheet contains the exact canonical browser CSS.',
  );
  for (const policy of Object.values(OPTIONAL_PACKAGE_POLICIES)) {
    const admitted = new Set(optionalRuntimePaths(policy));
    for (const dependency of optionalModuleDependencies(file, bytes, policy))
      assert.ok(admitted.has(dependency), `${dependency} must already be admitted.`);
  }
  assert.equal(
    /modules\[['"]game\/(?:core\/|coop\/|content-design\/mission-card|content-design\/picture)/.test(
      bytes.toString(),
    ),
    false,
    'Preview injection must not project the core engine or picture acquisition pipeline.',
  );
  assert.ok(
    /modules\[['"]game\/ui\/mission-library-browser\.mjs['"]\]/.test(bytes.toString()),
    'SIM uses the projected canonical browser implementation.',
  );
});

test('offline selector locale admission covers both languages, plural counts and exact-owner errors', async () => {
  const modules = [
    'game/ui/mission-library-browser.mjs',
    'game/ui/mission-library-goal.mjs',
    'game/mission-library/library.mjs',
  ];
  const literals = new Set();
  for (const file of modules) {
    const source = await readFile(new URL('../../' + file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/['"`]((?:interface|common|errors):[\w.-]+)['"`]/g))
      if (!match[1].endsWith('.')) literals.add(match[1]);
  }
  for (const locale of ['en', 'uk']) {
    const catalogues = Object.fromEntries(
      await Promise.all(
        ['interface', 'common', 'errors'].map(async (namespace) => [
          namespace,
          JSON.parse(
            await readFile(new URL(`../locales/${locale}/${namespace}.json`, import.meta.url)),
          ),
        ]),
      ),
    );
    for (const [id, policy] of Object.entries(OPTIONAL_PACKAGE_POLICIES)) {
      const projected = projectOptionalLocale(catalogues, policy);
      const selected = (namespace, key) =>
        projected[namespace]?.[key] === catalogues[namespace][key];
      for (const literal of literals) {
        const [namespace, key] = literal.split(':');
        const keys = Object.keys(catalogues[namespace]).filter(
          (item) => item === key || item.startsWith(key + '_'),
        );
        assert.ok(keys.length, `${locale} contains ${literal}`);
        for (const match of keys)
          assert.ok(
            selected(namespace, match),
            `${id}/${locale} must include ${namespace}:${match}`,
          );
      }
      for (const key of Object.keys(catalogues.errors).filter((key) =>
        key.startsWith('missionLibrary.field.'),
      ))
        assert.ok(
          selected('errors', key),
          `${id}/${locale} includes dynamic exact-owner field labels.`,
        );
      for (const key of Object.keys(catalogues.errors).filter((key) => key.startsWith('dataJson.')))
        assert.ok(
          selected('errors', key),
          'Adding owner errors preserves the existing validator messages.',
        );
      assert.equal(projected.interface.completionRewards, undefined);
      assert.ok(Object.keys(projected.interface).length < Object.keys(catalogues.interface).length);
    }
  }
});
