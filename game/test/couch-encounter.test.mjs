import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { normalizedLevel } from '../core/level.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const pack = await read('../content/packs/sentinel-relay.json');
const proofs = await read('../replays/sentinel-routes.json');
const html = await readFile(new URL('../couch/index.html', import.meta.url), 'utf8');

async function page(
  t,
  { campaign = pack.campaigns[0], turnPolicy = 'immediate', format = 'single' } = {},
) {
  const f = await couchPage(t, { campaign, turnPolicy, seconds: '90' });
  assert.equal(f.$('race-format').value, 'single');
  if (format !== 'single') {
    f.$('race-format').value = format;
    await f.$('race-format').onchange();
  }
  const elements = Object.fromEntries(
    [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, f.$(id)]),
  );
  return {
    elements,
    renders: f.renders,
    frame: f.frame,
    key(type, direction) {
      if (!direction) return;
      f.key(
        { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[direction],
        type === 'keydown',
      );
    },
    cue(player) {
      return {
        hidden: f.$(`racer-encounter-${player}`).hidden,
        phase: f.$(`racer-encounter-${player}`).dataset.phase,
        title: f.$(`racer-encounter-title-${player}`).textContent,
        instruction: f.$(`racer-encounter-instruction-${player}`).textContent,
      };
    },
  };
}

for (const [format, turnPolicy] of [
  ['single', 'immediate'],
  ['single', 'grid-center'],
  ['first-to-two', 'immediate'],
  ['first-to-two', 'grid-center'],
]) {
  test(`${format}/${turnPolicy}: actual couch inputs keep both phase cues independent and freeze them on pause/finish`, async (t) => {
    const app = await page(t, { turnPolicy, format });
    assert.match(app.cue(0).title, /^READY · 1 \/ 2/);
    assert.deepEqual(app.cue(0), app.cue(1));
    app.elements['race-start'].onclick();
    assert.deepEqual(
      app.renders[0].level,
      normalizedLevel(applyGameplayTuning(pack.campaigns[0].levels[0], resolveGameplayTuning())),
      'The current host uses the approved v4 preset without changing authored objectives.',
    );
    const route = proofs.routes.find(
      (r) => r.variant === 'ordinary' && r.classId === 'scout' && r.turnPolicy === turnPolicy,
    );
    let direction = null;
    let paused = false;
    let divergent = false;
    // The retained route still earns the release cut at current pacing; its
    // final crossing takes four/eight more ticks under v4. Keep the historical
    // recorded proof unchanged and qualify the actual host completion exactly.
    const winTick = turnPolicy === 'immediate' ? 1796 : 1800;
    for (const [index, segment] of route.segments.entries()) {
      app.key('keyup', direction);
      // The archived route waited against the top/bottom border with null input.
      // Continuous flight uses deliberate outward headings at those same borders,
      // preserving elapsed attack cycles and every original cue/win assertion.
      direction = segment.input.direction ?? (index === 2 ? 'up' : 'down');
      app.key('keydown', direction);
      const ticks = segment.ticks + (index === route.segments.length - 1 ? winTick - 1792 : 0);
      for (let n = 0; n < ticks; n++) {
        app.frame();
        const run = app.renders[0];
        if (run.tick === 1084) {
          assert.equal(app.cue(0).phase, 'transition');
          assert.equal(app.cue(1).phase, 'active');
          assert.equal(app.cue(1).phase, encounterView(app.renders[1]).phase);
          divergent = true;
          app.elements['race-pause'].onclick();
          app.frame();
          const cues = [app.cue(0), app.cue(1)];
          assert.match(cues[0].title, /^PAUSED/);
          const states = app.renders.map((r) => JSON.stringify(r));
          app.frame(1000);
          assert.deepEqual([app.cue(0), app.cue(1)], cues);
          assert.deepEqual(
            app.renders.map((r) => JSON.stringify(r)),
            states,
          );
          app.elements['race-start'].onclick();
          app.key('keydown', direction);
          paused = true;
        }
        if (run.tick === 1791) {
          const expected = encounterView(run);
          assert.ok(expected.cutCells >= 8);
          assert.equal(app.cue(0).instruction, expected.instruction);
          assert.match(app.cue(1).instruction, /Capture the shield relay/);
        }
      }
    }
    assert.ok(paused && divergent);
    assert.equal(app.renders[0].status, 'won');
    assert.equal(app.renders[0].tick, winTick);
    assert.equal(app.renders[0].lives, 3, 'The release route remains lossless.');
    assert.equal(app.renders[1].status, 'running');
    const noun = format === 'single' ? 'race' : 'round';
    assert.equal(app.cue(0).title, `${noun.toUpperCase()} ENDED · 2 / 2 · CORE RELEASED`);
    assert.match(app.cue(0).instruction, /picture is yours/);
    assert.ok(app.cue(1).title.startsWith(`${noun.toUpperCase()} ENDED · `));
    assert.ok(app.cue(1).instruction.startsWith(`Frozen at ${noun} end. `));
    assert.ok(
      app.elements['race-start'].textContent.startsWith(
        format === 'single' ? 'Rematch:' : 'Next round:',
      ),
    );
    assert.doesNotMatch(app.cue(1).instruction, /Capture|Close|Return/);
    const ended = [app.cue(0), app.cue(1)];
    const ticks = app.renders.map((run) => run.tick);
    app.frame(2000);
    assert.deepEqual([app.cue(0), app.cue(1)], ended);
    assert.deepEqual(
      app.renders.map((run) => run.tick),
      ticks,
    );
  });
}

test('ordinary couch boards hide both empty encounter groups before and during a round', async (t) => {
  const campaign = await read('../content/campaign.json');
  const app = await page(t, { campaign });
  const empty = { hidden: true, phase: undefined, title: '', instruction: '' };
  assert.deepEqual(app.cue(0), empty);
  assert.deepEqual(app.cue(1), empty);
  app.elements['race-start'].onclick();
  for (let n = 0; n < 250; n++) app.frame();
  assert.deepEqual(app.cue(0), empty);
  assert.deepEqual(app.cue(1), empty);
});
