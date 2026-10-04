/** Manual host-fixture inputs only. No production controller or unit coverage. */
import * as fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
const sha = (v) => createHash('sha256').update(v).digest('hex');
const source = await fs.readFile(
  new URL('../authoring/fpv-worlds/demonstrations/generate-warehouse.mjs', import.meta.url),
  'utf8',
);
const controller = source.slice(
  source.indexOf('const response ='),
  source.indexOf('await initWorldRuntime();'),
);
const needle = 'clamp((destination[k] - s.position[k]) * 0.8, -3000, 3000)';
if (controller.split(needle).length !== 2) throw Error('Warehouse pilot source changed');
const pilot = vm.runInNewContext(
  controller.replace(
    needle,
    'clamp((destination[k] - s.position[k]) * 0.8, target.type === "gate" ? -350 : -3000, target.type === "gate" ? 350 : 3000)',
  ) + '\npilot',
);
const rows = [],
  checks = [];
const check = (name, passed, detail = {}) => {
  checks.push({ name, passed, ...detail });
  if (!passed) throw Error(name + JSON.stringify(detail));
};
await initWorldRuntime();
for (const mode of ['self-level', 'acro']) {
  const entry = WORLD_CATALOGUE.find((e) => e.id === 'warehouse-02');
  const reference = {
    ...WORLD_DEMONSTRATIONS.find((e) => e.proof.course === entry.id && e.proof.mode === mode).proof,
    session: 'practice',
  };
  const f = createWorldFlight({ course: entry.course, mode, response: reference.response });
  const recorder = createWorldRecorder(f, { session: 'practice' });
  const ctx = { step: -1 };
  let prefix;
  try {
    f.arm();
    for (let i = 0; i < 20000 && f.snapshot().status === 'active'; i++) {
      const before = f.snapshot();
      f.step(JSON.parse(JSON.stringify(pilot(before, entry.course, mode, ctx))));
      recorder.record();
      if (f.snapshot().status !== 'active') {
        const proof = recorder.export();
        prefix = {
          ...proof,
          frames: proof.frames.slice(0, -1),
          finalStateIdentity: worldStateIdentity(before),
        };
      }
    }
    const proof = recorder.export();
    const result = await replayWorldFlight(entry.course, proof, { includeSectors: true });
    const best = await replayWorldFlight(entry.course, reference, { includeSectors: true });
    check(
      `${mode} slower attempt completes by ordinary recorded controls`,
      result.state.status === 'complete' &&
        result.state.contacts === 0 &&
        result.state.health === 100,
    );
    const longest = result.sectors.reduce((a, b) => (a.ticks >= b.ticks ? a : b));
    const loss = result.sectors
      .map((s) => ({ index: s.index, ticks: s.ticks - best.sectors[s.index].ticks }))
      .sort((a, b) => b.ticks - a.ticks)[0];
    check(
      `${mode} longest completed section and greatest positive loss are authored gates`,
      entry.course.steps[mode][longest.index].type === 'gate' &&
        entry.course.steps[mode][loss.index].type === 'gate' &&
        loss.ticks > 0,
      { longest, loss },
    );
    const restored = await replayWorldFlight(entry.course, prefix, { includeSectors: true });
    check(
      `${mode} prefix is an independently replayed nonterminal practice flight`,
      restored.state.status === 'active' && restored.state.ticks === proof.frames.length - 1,
    );
    rows.push({
      entry,
      reference,
      prefix,
      proof,
      sectors: result.sectors,
      referenceSectors: best.sectors,
      longest,
      loss,
    });
  } finally {
    f.dispose();
  }
}
function prefixFor(entry, proof) {
  const f = createWorldFlight({ course: entry.course, mode: proof.mode, response: proof.response });
  const recorder = createWorldRecorder(f, { session: 'practice' });
  try {
    f.arm();
    for (const [roll, pitch, yaw, throttle, actions] of proof.frames.slice(0, -1)) {
      f.step({ roll, pitch, yaw, throttle, actions }, { quantized: true });
      recorder.record();
    }
    const prefix = recorder.export();
    f.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
    check(
      entry.id + ' / ' + proof.mode + ' final ordinary neutral tick completes',
      f.snapshot().status === 'complete',
    );
    return prefix;
  } finally {
    f.dispose();
  }
}
const negativeEntry = WORLD_CATALOGUE.find((e) => e.id === 'woodland-01');
const negative = {
  ...WORLD_DEMONSTRATIONS.find(
    (e) => e.proof.course === negativeEntry.id && e.proof.mode === 'self-level',
  ).proof,
  session: 'practice',
};
const prefix = prefixFor(negativeEntry, negative);
const foundation = JSON.parse(
  await fs.readFile(
    new URL(
      '../authoring/fpv-worlds/demonstrations/optional/foundation-self-level-v1.json',
      import.meta.url,
    ),
  ),
);
for (const row of rows) {
  const entry = BEGINNER_CATALOGUE.find((e) => e.id === 'beginner-24');
  const source =
    row.proof.mode === 'acro'
      ? WORLD_DEMONSTRATIONS.find((e) => e.proof.course === entry.id && e.proof.mode === 'acro')
      : foundation.records.find((e) => e.course.id === entry.id);
  const proof = { ...source.proof, session: 'practice' };
  row.lesson = { entry, prefix: prefixFor(entry, proof) };
  prefixFor(row.entry, row.proof);
}
const output = {
  format: 'FPVGateCoachingInputs.v1',
  controller: {
    path: 'authoring/fpv-worlds/demonstrations/generate-warehouse.mjs',
    sha256: sha(source),
    change:
      'Only gate approach/crossing speed limited to 350mm/s, original authored course/physics and ordinary inputs. Not shipped.',
  },
  checks,
  rows,
  negative: { entry: negativeEntry, prefix, proof: negative },
};
await fs.mkdir(new URL('../dist/fpv-gate-coaching-inputs/', import.meta.url), { recursive: true });
await fs.writeFile(
  new URL('../dist/fpv-gate-coaching-inputs/inputs.json', import.meta.url),
  JSON.stringify(output),
);
console.log(
  JSON.stringify(
    {
      checks,
      rows: rows.map((r) => ({
        mode: r.proof.mode,
        ticks: r.proof.frames.length,
        longest: r.longest,
        loss: r.loss,
      })),
      bytes: Buffer.byteLength(JSON.stringify(output)),
      sha256: sha(JSON.stringify(output)),
    },
    null,
    2,
  ),
);
