import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';

test('Studio pressure action clearly scopes all missions and only prepares explicit inspection', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="pressure-edition" aria-describedby="pressure-edition-help"/);
  assert(html.includes('Inspect pressure-v2 copy of current draft'));
  assert(html.includes('for all missions in the current draft'));
  assert(html.replace(/\s+/g, ' ').includes('nothing is published'));
  const start = host.indexOf("$('pressure-edition').onclick");
  const action = host.slice(start, host.indexOf("$('opening').onclick", start));
  assert.match(action, /if \(!discardSource\(\)\) return/);
  assert.match(action, /withPressureDifficulty\(session.current\(\)\)/);
  assert.match(action, /sourceChanged = true/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session.replace|queueSave|launchPreview/);
  assert(action.indexOf('inspected = null') < action.indexOf('withPressureDifficulty'));
  assert(action.indexOf("$('apply').disabled = true") < action.indexOf('withPressureDifficulty'));
  const render = host.slice(
    host.indexOf('function render('),
    host.indexOf('function syncStructure('),
  );
  assert(
    render.includes(
      "$('pressure-edition').disabled = project.difficultyCatalogId === 'journey-difficulty-v2'",
    ),
  );
});

test('inspecting a pictured chapter keeps draft immutable; explicit adoption and Undo restore exact editions', () => {
  const source = createCrosswindCandidates({ artwork: true }),
    original = structuredClone(source);
  const session = createContentDraftSession(source);
  const candidate = withPressureDifficulty(session.current());
  assert.deepEqual(session.current(), original);
  assert.equal(session.canUndo(), false);
  assert.deepEqual(candidate.assets, source.assets);
  assert.deepEqual(candidate.maps, source.maps);
  session.replace(candidate);
  assert.equal(session.current().difficultyCatalogId, 'journey-difficulty-v2');
  assert.equal(session.canUndo(), true);
  const old = compileContentProject(source),
    next = compileContentProject(session.current());
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const a = resolveMission(old, mission.id, { difficulty }),
        b = resolveMission(next, mission.id, { difficulty });
      assert.notEqual(a.simulationIdentity, b.simulationIdentity);
      assert.deepEqual(
        next.missions.find((m) => m.id === mission.id).presentation,
        mission.presentation,
      );
      assert.equal(b.level.rules.moveSpeed, a.level.rules.moveSpeed);
      assert.deepEqual(b.level.directionalFields, a.level.directionalFields);
    }
  session.undo();
  assert.deepEqual(session.current(), original);
  session.redo();
  assert.deepEqual(session.current(), candidate);
  assert.deepEqual(source, original);
});
