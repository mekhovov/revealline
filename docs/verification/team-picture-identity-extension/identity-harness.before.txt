import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { canvasPresentation, imagePresentation } from '../presentation/runtime.mjs';
import { teamRescueProgress } from '../couch/coop-rescue-presentation.mjs';
import {
  createStudioTeamFixture,
  TEAM_PREVIEW_SCENARIOS,
  isTeamPreviewScenarioAvailable,
} from '../../authoring/asset-studio/team-preview-fixture.mjs';

const root = new URL('../../', import.meta.url),
  read = (name) => readFile(new URL(name, root)),
  sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ancestorBytes = await read(
  'docs/verification/team-picture-identity-extension/coop-view.before.txt',
);
assert.equal(
  sha(ancestorBytes),
  '488d960661f4948340a9c0c932c09e07941282f9f74f16a8eb8cc7853a44e566',
);
// The archived painter is byte-authenticated above. Resolve only its unchanged
// relative dependencies against the real module's directory, without editing it.
const archivedModule = ancestorBytes
  .toString()
  .replace(
    /from (['"])(\.[^'"]+)\1/g,
    (_, quote, specifier) =>
      `from ${JSON.stringify(new URL(specifier, new URL('../couch/coop-view.mjs', import.meta.url)).href)}`,
  );
const { createCoopPainter: createArchivedPainter } = await import(
  `data:text/javascript;base64,${Buffer.from(archivedModule).toString('base64')}`
);
const compiled = JSON.parse(await read('game/presentation/compiled/runtime.json'));
function snapshot() {
  const resolved = structuredClone(compiled.resolved);
  const images = new Map(
    Object.entries(resolved.assets)
      .filter(([, asset]) => asset.kind === 'image')
      .map(([slot, asset]) => [
        slot,
        {
          image: Object.freeze({ slot, width: asset.file.width, height: asset.file.height }),
          geometry: imagePresentation(asset),
        },
      ]),
  );
  return {
    resolved,
    canvas: canvasPresentation(resolved),
    fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
    image: (slot) => images.get(slot) ?? null,
  };
}
function surface(width) {
  const commands = [],
    stack = [],
    initial = { globalAlpha: 1, imageSmoothingEnabled: true };
  let state = { ...initial };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key in state) return state[key];
        return (...args) => {
          commands.push([key, ...args]);
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') {
            assert.ok(stack.length, 'Canvas restore must have a matching save.');
            state = stack.pop();
          }
          if (key === 'measureText') return { width: String(args[0]).length * 0.5 };
        };
      },
      set(_, key, value) {
        commands.push(['set', key, value]);
        state[key] = value;
        return true;
      },
    },
  );
  return {
    commands,
    canvas: { width: 1152, height: 576, clientWidth: width, getContext: () => ctx },
    assertRestored() {
      assert.equal(stack.length, 0);
      assert.deepEqual(state, initial);
    },
  };
}
function activeRoles(painter, run, feedback, commands) {
  if (run.status === 'won') return [];
  const roles = [
    ...run.players.map((p) => painter.actorFrame('pilot', p.id)?.stateSlot),
    ...run.enemies
      .filter((e) => e.active !== false)
      .map((e) => painter.actorFrame('enemy', e.id)?.stateSlot),
    ...commands.filter(([name]) => name === 'drawImage').map(([, image]) => image.slot),
    ...feedback.map((event) => event.slot),
  ];
  if (run.supportEffects.some((effect) => effect.until > run.time))
    roles.push('team.support.pulse');
  if (run.enemies.some((e) => e.active !== false && e.speedScale < 1 && e.slowUntil > run.time))
    roles.push('team.enemy.slowed');
  if (run.strongholds.some((hold) => hold.emitter?.phase === 'warning'))
    roles.push('team.emitter.warning');
  if (run.impacts.length) roles.push('team.emitter.spark');
  if (run.players.some((player) => teamRescueProgress(run, player)))
    roles.push('team.rescue.progress');
  if (run.players.some((player) => player.status === 'active' && player.graceUntil > run.time))
    roles.push('team.player.recovery');
  return roles.filter((slot) => slot?.startsWith('team.'));
}

test('picture identity extension preserves all42 Team roles and exact canvas commands in command-earned scenes', (t) => {
  const look = snapshot(),
    beforeLook = JSON.stringify(look.resolved),
    expected = Object.keys(look.resolved.assets)
      .filter((slot) => slot.startsWith('team.'))
      .sort(),
    covered = new Set();
  assert.equal(expected.length, 42);
  let scenes = 0,
    comparisons = 0;
  for (const arena of ['first-connection', 'relay-yard'])
    for (const { id: scenario } of TEAM_PREVIEW_SCENARIOS) {
      if (!isTeamPreviewScenarioAvailable(arena, scenario)) continue;
      const fixture = createStudioTeamFixture({ arena, scenario }),
        run = fixture.run,
        before = structuredClone(run),
        feedback = fixture.feedback,
        previousRun = fixture.previousRun;
      scenes++;
      for (const width of [390, 1152])
        for (const reduced of [false, true])
          for (const textFace of ['pixel', 'plain'])
            for (const withPicture of [false, true]) {
              const old = surface(width),
                current = surface(width),
                priorPainter = createArchivedPainter(old.canvas),
                painter = createCoopPainter(current.canvas);
              priorPainter.setPresentation(look);
              painter.setPresentation(look);
              // Renderer boundary specimen only. Actual authenticated candidate
              // ownership/derived-run admission is qualified by candidate-team-pictures.test.mjs.
              const picture = withPicture
                ? {
                    snapshot: look,
                    choice: {
                      kind: 'image',
                      levelId: run.level.id,
                      levelRevision: run.level.revision,
                    },
                    image: { slot: `arena.${arena}`, width: 1152, height: 576 },
                    fit: 'contain',
                    sampling: 'nearest',
                  }
                : null;
              const options = { reduced, textFace, picture, feedback, previousRun };
              priorPainter.paint(run, options);
              painter.paint(run, options);
              assert.deepEqual(
                current.commands,
                old.commands,
                `${arena}/${scenario}/${width}/${reduced}/${textFace}/${withPicture}`,
              );
              old.assertRestored();
              current.assertRestored();
              assert.deepEqual(run, before, 'Neither painter may modify simulation state.');
              for (const role of activeRoles(painter, run, feedback, current.commands))
                covered.add(role);
              comparisons++;
            }
    }
  assert.deepEqual([...covered].sort(), expected);
  assert.equal(JSON.stringify(look.resolved), beforeLook);
  t.diagnostic(JSON.stringify({ scenes, comparisons, roles: covered.size }));
});

test('the immutable delta names only the changed picture-identity guard and exact evidence files', async () => {
  const extension = JSON.parse(
    await read('docs/verification/team-picture-identity-extension/review.json'),
  );
  assert.equal(extension.format, 'revealline-team-picture-identity-review.v1');
  assert.deepEqual(extension.comparison, { scenes: 31, comparisons: 496, roles: 42 });
  for (const ancestor of extension.ancestors)
    assert.equal(sha(await read(ancestor.path)), ancestor.sha256, ancestor.path);
  const historical = {
    team: JSON.parse(await read(extension.ancestors[0].path)).fingerprint.inputs,
    equipment: JSON.parse(await read('docs/verification/team-equipment-five-review/inputs.json'))
      .inputs,
  };
  for (const [group, fingerprint] of Object.entries(extension.fingerprints)) {
    const old = historical[group];
    assert.deepEqual(
      fingerprint.inputs.map((row) => row.path),
      old.map((row) => row.path),
    );
    assert.deepEqual(
      fingerprint.inputs.filter((row, i) => row.sha256 !== old[i].sha256).map((row) => row.path),
      ['game/couch/coop-view.mjs'],
    );
    const raw = [];
    for (const row of fingerprint.inputs) {
      const bytes = await read(row.path);
      assert.equal(sha(bytes), row.sha256, row.path);
      raw.push(bytes);
    }
    assert.equal(sha(Buffer.concat(raw)), fingerprint.sha256, group);
  }
  for (const evidence of extension.evidence)
    assert.equal(sha(await read(evidence.path)), evidence.sha256, evidence.path);
});
