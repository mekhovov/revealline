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

// Historical JSON bytes observed at pre-change commit 7ea5f399; explicit v5
// addition is independently compared with canonical composition in snapshot tests.
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
  'whole-spatial-v5': [252377, '74162393aa803207f7e933f4ded83a64a6b223c926aecc5be7bffd113fd959fe'],
  'whole-spatial-v6': [254781, 'c884d472a6b895157f8391db2c3408722ddb7d506f85b70c47185e69f724ea76'],
  'whole-spatial-v7': [255610, 'd809ffcf9884e85d3dd778d4824ad1797ae76b5fe18c0f0c6382f9042c5f193c'],
  'whole-spatial-v8': [257423, 'e5092f194c459c9c4f618832d54e7769b28ac894bac097a8e91fdc6ed22e2c0e'],
  'whole-spatial-v9': [257778, '80d2406bece474a0dc169e9d8ea31b473d04d68144e8df6dd4eff41c7850e27a'],
  'whole-spatial-v10': [258783, '04b2c25e1e6bbbf8890b89a6661ec80fadac53f280ae2ae2caf77fd3de3ed4fc'],
  'whole-spatial-v11': [259575, '3d7b5b67d5d78a3f25a8108468385f9a6f1b2520fc12b275bcc3bf952ae0d978'],
  'whole-spatial-v12': [260606, '93ff983369b33f0b0cf005ddd3e3112475c8af6ac5d3d43ef1bdbe49e9df2325'],
  'whole-spatial-v13': [261539, 'dbad0867d7642b78fe46d8eb1b1bf13d367d433248b673b0f00933fdc79491c2'],
  'whole-spatial-v14': [262645, 'a5fa79c0174104525174559a7701c6241c747b2df3d8fc1f99484cfbca8312ef'],
  'whole-spatial-v15': [263597, 'bd832d139178a8e82dbb8eea68aca94ee2e1b395897bcf6818af1cbb7966c6c9'],
  'whole-ornament-v1': [260665, '3b29bc220cdb06a33fedefabb6adec9527bd10902a9dd44899270e885ddfc4ad'],
  'whole-ornament-v2': [266314, '3f0116efe9cb9b2e134fb60dd252ac5bfbd44758a993e18a56abb2131ca10a1b'],
};

test('all supported routes are covered by pinned edition snapshots', () => {
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

test('Horizon successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v11');
  assert.deepEqual(result.output, { id: 'whole-spatial-v11' });
  assert(has(result, 'horizon-next-batch-candidates.mjs'));
  assert(has(result, 'spatial-next-batch-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Border successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v12');
  assert.deepEqual(result.output, { id: 'whole-spatial-v12' });
  assert(has(result, 'border-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'horizon-next-batch-candidates.mjs'));
  assert(has(result, 'spatial-next-batch-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Border and Signal successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v13');
  assert.deepEqual(result.output, { id: 'whole-spatial-v13' });
  assert(has(result, 'border-signal-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'border-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'horizon-next-batch-candidates.mjs'));
  assert(has(result, 'spatial-next-batch-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Early cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v14');
  assert.deepEqual(result.output, { id: 'whole-spatial-v14' });
  assert(has(result, 'early-cultural-routes-candidates.mjs'));
  assert(has(result, 'border-signal-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'border-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'horizon-next-batch-candidates.mjs'));
  assert(has(result, 'spatial-next-batch-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Signal cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v15');
  assert.deepEqual(result.output, { id: 'whole-spatial-v15' });
  assert(has(result, 'signal-cultural-routes-candidates.mjs'));
  assert(has(result, 'early-cultural-routes-candidates.mjs'));
  assert(has(result, 'border-signal-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'border-cultural-next-batch-candidates.mjs'));
  assert(has(result, 'horizon-next-batch-candidates.mjs'));
  assert(has(result, 'spatial-next-batch-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('ornament editions import only their bounded opt-in source chain', () => {
  const study = routeProbe('whole-ornament-v1');
  assert.deepEqual(study.output, { id: 'whole-ornament-v1' });
  assert(has(study, 'ukrainian-ornament-candidates.mjs'));
  assert(!has(study, 'ukrainian-ornament-atlas.mjs'));
  const atlas = routeProbe('whole-ornament-v2');
  assert.deepEqual(atlas.output, { id: 'whole-ornament-v2' });
  assert(has(atlas, 'ukrainian-ornament-atlas.mjs'));
  assert(has(atlas, 'ukrainian-ornament-candidates.mjs'));
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
    './signal-cultural-routes-candidates.mjs',
    './early-cultural-routes-candidates.mjs',
    './border-signal-cultural-next-batch-candidates.mjs',
    './border-cultural-next-batch-candidates.mjs',
    './ukrainian-ornament-atlas.mjs',
    './ukrainian-ornament-candidates.mjs',
    './horizon-next-batch-candidates.mjs',
    './spatial-next-batch-candidates.mjs',
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
