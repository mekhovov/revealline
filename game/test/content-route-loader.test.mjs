import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../content-design/mode-href.mjs';

// Exact JSON bytes observed at pre-change commit 7ea5f399, before moving code.
// Includes all source content, route metadata, save/profile keys and order.
const golden = {
  opening: [20768, '0dd34097ba74c64cca71139f0656846fab3214fac925abb195acc734c73b1cf9'],
  authored: [37368, '5ae1f23d12e71adf4dc7c6bdfd6e01fe7dea760b1d75a5b74308984a7be38e63'],
  'whole-originals': [223521, 'feb4b013a8a816e0bc0364fa9dd769a51ea7c92604275657bb418e868f7a0df8'],
  'whole-originals-v2': [
    223548,
    '8fa2cc87c8346a80f464e29a373474bdeeb3d9e2623baf0f40b5900b4095f870',
  ],
  'whole-originals-v3': [
    224684,
    'de6b5b5427784354a6c66ffa7b78121ad0c1d0b0f55f5cd329c9649b34f65972',
  ],
  'whole-originals-v4': [
    226704,
    'c34a7afd7e435201c7532ee76df98f9cae8cec8ce3519a0ec9795565e365e129',
  ],
  'whole-spatial-v1': [228877, 'db5d580b22aef1253f7276bb0122540504f55cc4d79af8e344101da57af35467'],
  'whole-spatial-v2': [229396, '3c20126e35a09324001f61a781a8ae8a684cf421f9de9f5fd5fd7ed1644eab17'],
  'whole-spatial-v3': [230328, '7e8e35ad9147b75b5040db88411d337c0088ab133f5066ea5ec3eeb5ba092f4c'],
  'whole-spatial-v4': [252113, 'fd5175f63b842b7f71a11cab9e8067f6b7d9d698f026122c83ae14997a91d448'],
};

test('all supported routes are covered by independent pre-change snapshots', () => {
  assert.deepEqual(Object.keys(golden), AUTHORED_JOURNEY_ROUTE_IDS);
});
for (const id of AUTHORED_JOURNEY_ROUTE_IDS)
  test(`${id}: async and synchronous routes retain exact historical content and fresh ownership`, async () => {
    const first = await loadAuthoredJourneyRoute(id);
    const second = await loadAuthoredJourneyRoute(id);
    const sync = createAuthoredJourneyRoute(id);
    for (const route of [first, second, sync]) {
      const json = JSON.stringify(route);
      assert.deepEqual(
        [Buffer.byteLength(json), createHash('sha256').update(json).digest('hex')],
        golden[id],
      );
      assert(Object.isFrozen(route) && Object.isFrozen(route.source.missions[0]));
    }
    assert.notEqual(first, second);
    assert.notEqual(first.source, second.source);
    assert.throws(() => {
      first.source.missions[0].name = 'changed';
    }, TypeError);
  });

function probe(code, failSuffix) {
  const result = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-loader',
      new URL('./helpers/route-module-probe.mjs', import.meta.url).href,
      '--input-type=module',
      '--eval',
      code,
    ],
    {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, ROUTE_PROBE_FAIL_SUFFIX: failSuffix ?? '' },
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return {
    output: JSON.parse(result.stdout),
    modules: result.stderr
      .split('\n')
      .filter((line) => line.startsWith('ROUTE_MODULE '))
      .map((line) => JSON.parse(line.slice(13)).url),
  };
}
const loaderURL = new URL('../content-design/route-loader.mjs', import.meta.url).href;
function routeProbe(id, failSuffix) {
  return probe(
    `const {loadAuthoredJourneyRoute}=await import(${JSON.stringify(loaderURL)});
    try { const route=await loadAuthoredJourneyRoute(${JSON.stringify(id)});
      console.log(JSON.stringify({id:route?.id??null}));
    } catch(error) {console.log(JSON.stringify({error:error.message}));}`,
    failSuffix,
  );
}
const has = (result, file) => result.modules.some((url) => url.endsWith(`/${file}`));

test('Legacy and unknown IDs import no candidate factories and never interpolate a module URL', () => {
  for (const id of [
    null,
    '1',
    'legacy',
    '../whole-spatial-candidates.mjs',
    'https://example.invalid/evil.mjs',
  ]) {
    const result = routeProbe(id);
    assert.deepEqual(result.output, { id: null });
    assert(!result.modules.some((url) => url.endsWith('-candidates.mjs')));
    assert(!has(result, 'whole-spatial-data.mjs'));
  }
});

test('opening imports only its own factory; authored additionally imports Border', () => {
  for (const id of ['opening', 'authored']) {
    const result = routeProbe(id);
    assert.deepEqual(result.output, { id });
    assert(has(result, 'horizon-candidates.mjs'));
    assert.equal(has(result, 'border-candidates.mjs'), id === 'authored');
    assert(!has(result, 'whole-journey-candidates.mjs'));
    assert(!has(result, 'whole-spatial-data.mjs'));
    assert(!has(result, 'apex-candidates.mjs'));
  }
});

test('spatial review loads its validated source snapshot, not the historical chapter composers', () => {
  const result = routeProbe('whole-spatial-v4');
  assert.deepEqual(result.output, { id: 'whole-spatial-v4' });
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
  assert(!has(result, 'apex-candidates.mjs'));
});

test('historical originals still use their composer, without downloading the spatial snapshot', () => {
  const result = routeProbe('whole-originals-v4');
  assert.deepEqual(result.output, { id: 'whole-originals-v4' });
  assert(has(result, 'whole-journey-candidates.mjs'));
  assert(has(result, 'apex-candidates.mjs'));
  assert(!has(result, 'whole-spatial-data.mjs'));
});

test('selected module failure rejects instead of silently choosing Legacy or another edition', () => {
  const result = routeProbe('whole-spatial-v4', '/whole-spatial-candidates.mjs');
  assert.deepEqual(result.output, { error: 'route-probe: selected module unavailable' });
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('shared Solo, Versus and Team navigation no longer imports any candidate source factory', () => {
  for (const host of ['solo-host', 'versus-host', 'team-host']) {
    const url = new URL(`../content-design/${host}.mjs`, import.meta.url).href;
    const result = probe(
      `await import(${JSON.stringify(url)}); console.log(JSON.stringify({ok:true}));`,
    );
    assert.deepEqual(result.output, { ok: true });
    assert(!has(result, 'route.mjs'));
    assert(!result.modules.some((url) => url.endsWith('-candidates.mjs')));
    assert(!has(result, 'whole-spatial-data.mjs'));
  }
});

test('all literal lazy imports and shared modules are in the actual game build include', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const config = JSON.parse(
    await readFile(new URL('../build-config.json', import.meta.url), 'utf8'),
  );
  assert(config.include.includes('game'));
  // Scope this gate to the real game include. It is not a complete release
  // assembly/media test, and does not require unrelated sparse optional packs.
  const files = new Set(await collectBuildFiles(root, { entry: config.entry, include: ['game'] }));
  const source = await readFile(new URL(loaderURL), 'utf8');
  const imports = [...source.matchAll(/import\('(.+?)'\)/g)].map((m) => m[1]);
  assert.deepEqual(imports, [
    './whole-spatial-candidates.mjs',
    './whole-journey-candidates.mjs',
    './horizon-candidates.mjs',
    './border-candidates.mjs',
  ]);
  for (const path of [
    ...imports.map((s) => s.slice(2)),
    'route-loader.mjs',
    'route-definition.mjs',
    'sequence.mjs',
    'whole-journey-order.mjs',
  ])
    assert(files.has(`game/content-design/${path}`), `${path} must ship`);
  assert(!files.has('game/test/helpers/route-module-probe.mjs'));
});
