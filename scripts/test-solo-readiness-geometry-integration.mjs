import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  qualificationReadinessOptions,
  GEOMETRY_READINESS_SOURCE,
} from './solo-qualification-readiness.mjs';
const geometryFlag = '--readiness-geometry=phase-boundary-v1';
const fixtures = {
  'first-running-v1': 'solo-remote-timing/cold-first30.qualification.fixture',
  'warm-resume-v1': 'solo-readiness-resume/warm.qualification.fixture',
  'saved-resume-v1': 'solo-readiness-font/saved-compact-v2.qualification.fixture',
};
const baseFlags = ['--work-probe', '--hitch-journal', '--cadence=settled120'];
const source = {
  revision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
  tree: '58f19392e25384620d896098fce8616b538e318d',
};
async function model() {
  return {
    parser: await import('./solo-qualification-readiness.mjs'),
    adapter: await import('./solo-remote-readiness.mjs'),
  };
}
test('geometry source binds the verified corrected layout source and rejects historical source', async () => {
  assert.deepEqual(GEOMETRY_READINESS_SOURCE, source);
  for (const [protocol, file] of Object.entries(fixtures)) {
    const bytes = await readFile(new URL('../docs/performance/fixtures/' + file, import.meta.url));
    for (const revision of [
      'c696af41857840359ae473558b90682f3d71f2db',
      '0febd334619731adc26dfa3df78aab02991563af',
    ])
      assert.throws(() =>
        qualificationReadinessOptions(
          [
            ...baseFlags,
            geometryFlag,
            '--readiness-probe=' + protocol,
            '--source-revision=' + revision,
          ],
          JSON.parse(bytes),
          bytes,
        ),
      );
  }
});
test('bound source admits only exact cold/warm/compact-saved bytes and forwards explicit geometry', async () => {
  const { parser, adapter } = await model();
  for (const [protocol, file] of Object.entries(fixtures)) {
    const bytes = await readFile(new URL('../docs/performance/fixtures/' + file, import.meta.url));
    const flags = [
      ...baseFlags,
      geometryFlag,
      '--readiness-probe=' + protocol,
      '--source-revision=' + source.revision,
    ];
    const selected = parser.qualificationReadinessOptions(flags, JSON.parse(bytes), bytes);
    assert.equal(selected.geometryObservation, 'phase-boundary-v1');
    assert.equal(selected.documents, protocol === 'saved-resume-v1' ? 2 : 1);
    const phase = protocol === 'first-running-v1' ? 'cold-first30' : protocol.replace('-v1', '');
    const plan = { sourceCohort: 'readiness-geometry-corrected-package', phase };
    const choice = adapter.geometryReadinessSelection(plan);
    plan.fixture = choice.fixture;
    for (const engine of ['chromium', 'webkit']) {
      const args = adapter.readinessArguments(
        { plan, here: '/tools/scripts', repository: '/tools' },
        { engine },
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      assert.equal(args.filter((x) => x === geometryFlag).length, 1);
      assert(args.includes('--readiness-probe=' + protocol));
      assert(args.includes('--cpu=1'));
      assert(args.includes('--cadence=settled120'));
    }
    for (const bad of [
      flags.filter((x) => x !== geometryFlag),
      flags.concat(geometryFlag),
      flags.concat('--readiness-geometry=other'),
      flags.filter((x) => !x.startsWith('--readiness-probe')),
      flags.map((x) =>
        x.startsWith('--source-revision') ? '--source-revision=' + 'a'.repeat(40) : x,
      ),
      flags.concat('--visual-quality-observation=full'),
      flags.concat('--density-comparison=full-muted-v1'),
    ])
      assert.throws(() => parser.qualificationReadinessOptions(bad, JSON.parse(bytes), bytes));
    assert.throws(() =>
      parser.qualificationReadinessOptions(
        flags,
        JSON.parse(bytes),
        Buffer.concat([bytes, Buffer.from('\n')]),
      ),
    );
  }
});
test('orphan/malformed geometry cannot silently use default observation', async () => {
  const bytes = await readFile(
    new URL('../docs/performance/fixtures/' + fixtures['first-running-v1'], import.meta.url),
  );
  for (const flags of [
    [geometryFlag],
    ['--readiness-geometry'],
    ['--readiness-geometry=unknown'],
    [geometryFlag, geometryFlag],
  ])
    assert.throws(() => qualificationReadinessOptions(flags, JSON.parse(bytes), bytes));
});
