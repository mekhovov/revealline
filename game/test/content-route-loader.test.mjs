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
  'whole-spatial-v16': [264185, 'cb4761bfb1b528c0264de5b44ab9bb1e05b7d1b9bff752ba50828fbd1b650b8e'],
  'whole-spatial-v17': [265782, '615510f0643bc972817bdf0d285a00bc6986a3bfb04667754393dc509929b0ea'],
  'whole-spatial-v18': [267605, '2eef985ba79babbac1a1b761f039dd6678bd447fbd02c18eb28367d20a5fdedb'],
  'whole-spatial-v19': [269126, 'd0e631a5b8551d422ee6b3d5a2476aa25bdf38b824bdd86def06312f0c10658e'],
  'whole-spatial-v20': [270352, '505b52ec7be45d06c71ccbfdaa6ab23a962dc6777d147c619cd0d0e6b33abe1d'],
  'whole-spatial-v21': [271337, '45eff01ef344cb77700977c7135a265e9e0c7c2c7ff1e7f3366644c8517473b8'],
  'whole-spatial-v22': [273373, '4268a186d8565460ee8efc5566f0571d8150ec4d665380fbe329fdbd214b4072'],
  'whole-spatial-v23': [275331, '3b006b71af58209831aa9973dad88d47405188d0c8f28bad74d0ec03bd52a660'],
  'whole-spatial-v24': [276540, '54af78a72743cfb23ae5c9d091aec92e9f4a63a588aacd81953949c2ad4d5385'],
  'whole-spatial-v25': [277154, '26cafd633827012c3c8729329bb2fad0c3feedd2637c2e257bf50d8e123585e7'],
  'whole-spatial-v26': [279214, '6ff6965830e88fde5f8b4093b613b4221e8be1dbed12e08533f12224a4d2253f'],
  'whole-spatial-v27': [280620, '495b6a7263c5909c24bec10d706359fa2035d4dfff247b271135774f729af9b7'],
  'whole-spatial-v28': [282309, '7f71aa07c97da8c086c50b89193b9f20476dd27d1d4ae719891f809bcf99af10'],
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

test('Neon cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v16');
  assert.deepEqual(result.output, { id: 'whole-spatial-v16' });
  assert(has(result, 'neon-cultural-routes-candidates.mjs'));
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

test('Neon cultural finale imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v17');
  assert.deepEqual(result.output, { id: 'whole-spatial-v17' });
  assert(has(result, 'neon-cultural-routes-finale-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-candidates.mjs'));
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

test('Rover cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v18');
  assert.deepEqual(result.output, { id: 'whole-spatial-v18' });
  assert(has(result, 'rover-cultural-routes-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-finale-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-candidates.mjs'));
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

test('Fractured Grid cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v19');
  assert.deepEqual(result.output, { id: 'whole-spatial-v19' });
  assert(has(result, 'fracture-cultural-routes-candidates.mjs'));
  assert(has(result, 'rover-cultural-routes-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-finale-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-candidates.mjs'));
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

test('Phaseworks cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v20');
  assert.deepEqual(result.output, { id: 'whole-spatial-v20' });
  assert(has(result, 'phaseworks-cultural-routes-candidates.mjs'));
  assert(has(result, 'fracture-cultural-routes-candidates.mjs'));
  assert(has(result, 'rover-cultural-routes-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-finale-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-candidates.mjs'));
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

test('Livewire cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v21');
  assert.deepEqual(result.output, { id: 'whole-spatial-v21' });
  assert(has(result, 'livewire-cultural-routes-candidates.mjs'));
  assert(has(result, 'phaseworks-cultural-routes-candidates.mjs'));
  assert(has(result, 'fracture-cultural-routes-candidates.mjs'));
  assert(has(result, 'rover-cultural-routes-candidates.mjs'));
  assert(has(result, 'neon-cultural-routes-finale-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Relay cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v22');
  assert.deepEqual(result.output, { id: 'whole-spatial-v22' });
  assert(has(result, 'relay-cultural-routes-candidates.mjs'));
  assert(has(result, 'livewire-cultural-routes-candidates.mjs'));
  assert(has(result, 'phaseworks-cultural-routes-candidates.mjs'));
  assert(has(result, 'fracture-cultural-routes-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Crosswind cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v23');
  assert.deepEqual(result.output, { id: 'whole-spatial-v23' });
  assert(has(result, 'crosswind-cultural-routes-candidates.mjs'));
  assert(has(result, 'relay-cultural-routes-candidates.mjs'));
  assert(has(result, 'livewire-cultural-routes-candidates.mjs'));
  assert(has(result, 'phaseworks-cultural-routes-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Sentinel cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v24');
  assert.deepEqual(result.output, { id: 'whole-spatial-v24' });
  assert(has(result, 'sentinel-cultural-routes-candidates.mjs'));
  assert(has(result, 'crosswind-cultural-routes-candidates.mjs'));
  assert(has(result, 'relay-cultural-routes-candidates.mjs'));
  assert(has(result, 'livewire-cultural-routes-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Apex cultural successor imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v25');
  assert.deepEqual(result.output, { id: 'whole-spatial-v25' });
  assert(has(result, 'apex-cultural-routes-candidates.mjs'));
  assert(has(result, 'sentinel-cultural-routes-candidates.mjs'));
  assert(has(result, 'crosswind-cultural-routes-candidates.mjs'));
  assert(has(result, 'relay-cultural-routes-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Relay cultural completion imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v26');
  assert.deepEqual(result.output, { id: 'whole-spatial-v26' });
  assert(has(result, 'relay-cultural-completion-candidates.mjs'));
  assert(has(result, 'apex-cultural-routes-candidates.mjs'));
  assert(has(result, 'relay-cultural-routes-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Crosswind cultural completion imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v27');
  assert.deepEqual(result.output, { id: 'whole-spatial-v27' });
  assert(has(result, 'crosswind-cultural-completion-candidates.mjs'));
  assert(has(result, 'relay-cultural-completion-candidates.mjs'));
  assert(has(result, 'apex-cultural-routes-candidates.mjs'));
  assert(has(result, 'crosswind-cultural-routes-candidates.mjs'));
  assert(has(result, 'whole-spatial-data.mjs'));
  assert(!has(result, 'whole-journey-candidates.mjs'));
  assert(!has(result, 'horizon-candidates.mjs'));
});

test('Fracture and Apex cultural completion imports only its bounded successor chain', () => {
  const result = routeProbe('whole-spatial-v28');
  assert.deepEqual(result.output, { id: 'whole-spatial-v28' });
  assert(has(result, 'fracture-apex-cultural-completion-candidates.mjs'));
  assert(has(result, 'crosswind-cultural-completion-candidates.mjs'));
  assert(has(result, 'relay-cultural-completion-candidates.mjs'));
  assert(has(result, 'apex-cultural-routes-candidates.mjs'));
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
    './fracture-apex-cultural-completion-candidates.mjs',
    './crosswind-cultural-completion-candidates.mjs',
    './relay-cultural-completion-candidates.mjs',
    './apex-cultural-routes-candidates.mjs',
    './sentinel-cultural-routes-candidates.mjs',
    './crosswind-cultural-routes-candidates.mjs',
    './relay-cultural-routes-candidates.mjs',
    './livewire-cultural-routes-candidates.mjs',
    './phaseworks-cultural-routes-candidates.mjs',
    './fracture-cultural-routes-candidates.mjs',
    './rover-cultural-routes-candidates.mjs',
    './neon-cultural-routes-finale-candidates.mjs',
    './neon-cultural-routes-candidates.mjs',
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
