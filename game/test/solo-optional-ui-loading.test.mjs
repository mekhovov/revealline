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

// A fresh process proves the browser module is not already cached by another
// test. Refusing it must not prevent the real Solo host from starting/resuming.
test('ordinary Solo Start and Resume do not evaluate the optional Missions chooser', () => {
  const fixture = new URL('./helpers/solo-dom.mjs', import.meta.url).href;
  const replay = new URL('../replay.mjs', import.meta.url).href;
  const env = { ...process.env, ROUTE_PROBE_FAIL_SUFFIX: '/journey-chooser.mjs' };
  delete env.NODE_TEST_CONTEXT; // This nested process owns its own human-readable TAP stream.
  const result = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-loader',
      new URL('./helpers/route-module-probe.mjs', import.meta.url).href,
      '--input-type=module',
      '--eval',
      `import test from 'node:test';
       import assert from 'node:assert/strict';
       import { soloPage } from ${JSON.stringify(fixture)};
       import { authoritativeCheckpoint } from ${JSON.stringify(replay)};
       test('real Solo remains independent of the optional chooser', async (t) => {
         const page = await soloPage(t, { titleScreen: true });
         page.$('shell-featured').click();
         await page.waitUntilRunning();
         const run = page.rendered.run;
         const checkpoint = authoritativeCheckpoint(run);
         page.$('pause-button').click();
         assert.equal(page.doc.body.dataset.flightState, 'paused');
         page.$('start-button').click();
         await page.waitUntilRunning();
         assert.equal(page.rendered.run, run);
         assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
         assert.equal(page.doc.body.dataset.flightState, 'running');
         assert.equal(!!page.$('journey-chooser'), false);
         assert.deepEqual(page.errors, []);
         page.$('pause-button').click();
         page.$('shell-menu').click();
         const missions = page.$('shell-play');
         const original = missions.onclick;
         let opening;
         missions.onclick = function (...args) { return (opening = original.apply(this, args)); };
         missions.focus();
         missions.click();
         assert(opening instanceof Promise);
         await opening;
         assert.match(page.$('mission-library-opening-status').textContent, /retry/i);
         assert.equal(!!page.$('journey-chooser'), false);
         assert.equal(page.rendered.run, run);
         assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
         assert.equal(page.doc.body.dataset.flightState, 'paused');
         assert.deepEqual(page.errors, []);
       });`,
    ],
    {
      encoding: 'utf8',
      timeout: 15000,
      env,
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /^# pass 1$/m);
  for (const module of ['journey-chooser', 'mission-library-chooser', 'mission-library-browser'])
    assert.equal(result.stderr.includes(`/${module}.mjs`), false, module);
});
