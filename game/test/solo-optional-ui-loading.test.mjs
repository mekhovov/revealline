import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('ordinary Solo can load the edition entry without evaluating optional edition panels', () => {
  const entry = new URL('../ui/edition-solo.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-loader',
      new URL('./helpers/route-module-probe.mjs', import.meta.url).href,
      '--input-type=module',
      '--eval',
      `const module = await import(${JSON.stringify(entry)}); console.log(typeof module.mountEditionSoloUI);`,
    ],
    {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, ROUTE_PROBE_FAIL_SUFFIX: '/edition-rewards.mjs' },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'function');
  for (const panel of ['navigation', 'lessons', 'mastery', 'rewards', 'expedition', 'play-layout'])
    assert.equal(
      result.stderr.includes(`/edition-${panel}.mjs`),
      false,
      `${panel} must wait for an edition mount`,
    );
});
