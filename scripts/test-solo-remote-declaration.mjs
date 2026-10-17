import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { timingMatrix, sustainedMatrix } from './solo-remote-sustained.mjs';
import { supplementalMatrix } from './solo-remote-supplemental.mjs';

const root = new URL('../', import.meta.url);
const comparisonModules = [
  'scripts/solo-remote-sustained.mjs',
  'scripts/solo-qualification.mjs',
  'scripts/solo-qualification-observation.mjs',
];

for (const lane of ['timing', 'sustained', 'supplemental']) {
  const modules =
    lane === 'supplemental' ? ['scripts/solo-remote-supplemental.mjs'] : comparisonModules;
  test(`${lane} declaration imports only its ${modules.length} local modules and selected manifest`, async (t) => {
    const temporary = await realpath(await mkdtemp(join(tmpdir(), 'solo-declare-')));
    t.after(() => rm(temporary, { recursive: true, force: true }));
    const manifestPath = `docs/performance/solo-remote-${lane}-plan.json`;
    for (const path of [...modules, manifestPath]) {
      const target = join(temporary, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await readFile(new URL(path, root)), { flag: 'wx' });
    }
    const manifest = JSON.parse(await readFile(join(temporary, manifestPath)));
    const actual = execFileSync(
      process.execPath,
      [
        join(temporary, modules[0]),
        lane === 'timing' ? 'timing-matrix-plan' : 'matrix-plan',
        join(temporary, manifestPath),
      ],
      { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, cwd: temporary },
    );
    const expected =
      lane === 'timing'
        ? timingMatrix(manifest)
        : lane === 'sustained'
          ? sustainedMatrix(manifest)
          : supplementalMatrix(manifest);
    assert.equal(actual, `matrix=${JSON.stringify(expected)}\n`);
    assert.equal(expected.include.length, lane === 'supplemental' ? 2 : 6);
  });

  test(`${lane} uses exact-file sparse checkout only for declaration, preserving observation bounds`, async () => {
    const workflow = await readFile(
      new URL(`.github/workflows/solo-remote-${lane}-temporary.yml`, root),
      'utf8',
    );
    const [declaration, observation] = workflow.split(
      lane === 'supplemental' ? '  preflight:\n' : '  sustained:\n',
    );
    assert(declaration && observation);
    assert(
      declaration.includes(
        `github.event.before == '${lane === 'timing' ? '69fdc854ecc07eca46a3becc3e38c233a3865fb0' : 'aeadf7f43a8c1aba3af78d6cc8713666b4af49f1'}'`,
      ),
    );
    assert.match(declaration, /timeout-minutes: 5/);
    assert.match(declaration, /sparse-checkout-cone-mode: false/);
    assert.match(declaration, /fetch-depth: 1/);
    assert(!declaration.includes('filter:'));
    const sparse = declaration
      .split('          sparse-checkout: |\n')[1]
      .split('      - timeout-minutes: 1')[0]
      .trim()
      .split('\n')
      .map((line) => line.trim());
    assert.deepEqual(sparse, [
      ...modules.map((path) => '/' + path),
      `/docs/performance/solo-remote-${lane}-plan.json`,
    ]);
    assert(!observation.includes('sparse-checkout'));
    assert.match(observation, /ref: b11745223861c3973ad4bf440cc536198b8e0371/);
    assert.match(observation, /ref: 3adcd53792043ef02459e86168c6b33a66d6ef00/);
    assert.match(observation, /timeout-minutes: \$\{\{ matrix\.stepMinutes \}\}/);
    assert.match(
      observation,
      /timeout --signal=TERM --kill-after=30s \$\{\{ matrix\.outerSeconds \}\}s/,
    );
    assert.match(observation, /scripts\/test-solo-remote-declaration\.mjs/);
  });
}
