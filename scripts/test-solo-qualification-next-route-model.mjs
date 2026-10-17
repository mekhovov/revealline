import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { executeNextRoute, NEXT_ROUTE_PROTOCOL } from './solo-qualification-next-route.mjs';
import { createRun, stepRun, FIXED_DT, releaseInputs } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';
import { attachInput } from '../game/ui/input.mjs';
import { createSceneClock } from '../game/ui/scene-clock.mjs';
const definitions = JSON.parse(
  await fs.readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-sustained/next-geometric-model.fixture',
      import.meta.url,
    ),
  ),
).rows;
const configs = [30, 40, 45, 60, 90, 120, 144].flatMap((hz) =>
  [0, 16, 50, 100, [0, 100], [100, 0], [0, 16, 50, 100], [100, 50, 16, 0]].map((delays) => ({
    hz,
    delays: Array.isArray(delays) ? delays : [delays],
  })),
);
for (const initialDelayMs of [0, 100])
  test(
    `all eleven routes tolerate 56 schedules with initial neutral delay ${initialDelayMs}ms`,
    { timeout: 120000 },
    async () => {
      const failures = [];
      let totalSteps = 0,
        cases = 0;
      for (const d of definitions)
        for (const c of configs) {
          const run = createRun(d.level, d.options),
            rec = createRecorder(d.level, d.options),
            clock = createSceneClock(),
            win = new EventTarget(),
            arena = new EventTarget();
          globalThis.window = win;
          globalThis.document = {
            querySelectorAll: () => [],
            querySelector: () => null,
            hidden: false,
          };
          const input = attachInput({
            arena,
            continuousSteering: () => true,
            active: () => run.status === 'running',
            readControllerCommand: () => ({
              direction: null,
              boost: false,
              action: false,
              pickup: false,
            }),
          });
          let now = 0,
            callback = 1,
            acc = 0,
            di = 0;
          clock.sample(0, true);
          const frame = 1000 / c.hz;
          function advance(ms) {
            const end = now + ms;
            while (callback * frame <= end + 1e-7) {
              const at = callback++ * frame;
              const t = clock.sample(at, true);
              assert(!t.interrupted);
              acc += t.elapsedSeconds;
              let controls = input.poll();
              while (acc + 1e-9 >= FIXED_DT && run.status === 'running') {
                const command = { ...controls, switchClass: null };
                stepRun(run, command, FIXED_DT);
                recordInput(rec, command);
                acc -= FIXED_DT;
                assert(++totalSteps <= 3000000);
                if (run.events.some((e) => e.type === 'capture.stopped')) {
                  input.clear();
                  controls = { direction: null, boost: false, action: false, pickup: false };
                }
              }
            }
            now = end;
          }
          const read = async (id, begin) => ({
            phase: run.status === 'won' ? 'picture' : 'running',
            autoNext: false,
            mission: run.level.id,
            status: run.status,
            tick: run.tick,
            lives: run.lives,
            claimedCount: run.claimedCount,
            trail: { length: run.trail.length },
            player: { x: run.player.x, y: run.player.y, speed: run.player.speed },
            enemies: run.enemies.map((e) => ({
              id: e.id,
              x: e.x,
              y: e.y,
              vx: e.vx ?? null,
              vy: e.vy ?? null,
            })),
            ...(begin
              ? {
                  level: run.level,
                  options: { seed: run.seed, classId: run.classId, turnPolicy: run.turnPolicy },
                }
              : {}),
          });
          const key = (type) => async (code) => {
            advance(c.delays[di++ % c.delays.length]);
            const e = new Event(type, { cancelable: true });
            Object.defineProperties(e, {
              code: { value: code },
              key: { value: code },
              repeat: { value: false },
            });
            win.dispatchEvent(e);
          };
          advance(initialDelayMs);
          const record = {};
          let failure = null;
          try {
            await executeNextRoute({
              action: {
                type: 'authored-next-route',
                protocol: NEXT_ROUTE_PROTOCOL,
                mission: d.id,
                timeoutMs: 60000,
              },
              read,
              keyboard: { down: key('keydown'), up: key('keyup') },
              wait: async (ms) => advance(ms),
              now: () => now,
              deadline: 1200000,
              record,
            });
          } catch (e) {
            failure = String(e.message);
          }
          input.clear();
          releaseInputs(run);
          recordRelease(rec);
          const replay = exportReplay(rec, run);
          assert(verifyReplay(replay).match);
          input.destroy();
          cases++;
          if (failure)
            failures.push({ id: d.id, config: c, failure, stage: record.stages.at(-1)?.id });
          assert.equal(run.lives, 3);
          assert.equal(run.status, 'won');
        }
      assert.equal(cases, 616);
      assert.deepEqual(failures, []);
      assert(totalSteps > 1000000 && totalSteps <= 3000000);
    },
  );
