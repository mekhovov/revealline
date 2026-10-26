(async () => {
  const [THREE, { createFlightRenderer }, { createCombatPresentation }, { createCombatActorPresentation }, { FLIGHT_COURSES }, { createFlight }, { prepareCombatAppearancePack, prepareCombatAppearanceModels }, { clone }] = await Promise.all([
    import('/optional-practice/civilian-fpv/vendor/three.module.js'), import('/optional-practice/civilian-fpv/renderer.mjs'), import('/optional-practice/civilian-fpv/world-reaction-runtime.mjs'), import('/optional-practice/civilian-fpv/combat-actors.mjs'), import('/optional-practice/civilian-fpv/catalogue.mjs'), import('/optional-practice/civilian-fpv/model.mjs'), import('/optional-practice/civilian-fpv/combat-appearance.mjs'), import('/optional-practice/civilian-fpv/vendor/addons/utils/SkeletonUtils.js')
  ]);
  document.head.innerHTML = '<title>Controlled FPV effect workload</title><style>body{margin:0;background:#222;font:14px monospace;color:#fff}canvas{display:block;width:100vw;height:100vh}#status{position:fixed;left:12px;top:12px;background:#111c;padding:12px;white-space:pre;pointer-events:none}</style>';
  document.body.innerHTML = '<canvas></canvas><div id="status"></div>';
  const canvas = document.querySelector('canvas'), status = document.querySelector('#status');
  let effectMs = 0, actorMs = 0, activeDetail = 'high';
  const prefs = { brutal: true, blood: true, showRemains: true, enemyHealthDisplay: 'all' };
  const wrap = (factory, key) => options => { const owner = factory(options), update = owner.update; return { ...owner, update(...args) { const start = performance.now(); const result = update(...args); if (key === 'effect') effectMs += performance.now() - start; else actorMs += performance.now() - start; return result; } }; };
  const renderer = createFlightRenderer({ canvas, window, reducedMotion: false, loadGLTF: () => import('/optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js') });
  // The floor is a controlled fixture surface. This deliberately excludes production terrain admission.
  let supportCounts = { queries: 0, clear: 0, contact: 0, attached: 0, invalid: 0 };
  const floorSurface = at => ({ position: { x: at.x, y: 0, z: at.z }, normal: { x: 0, y: 1, z: 0 }, surfaceId: 'fixture-floor', localPosition: { x: at.x, y: 0, z: at.z } });
  const groundQuery = (position, normal, sweep) => {
    supportCounts.queries++;
    if (sweep?.attachment) {
      const previous = sweep.attachment;
      if (previous.surfaceId !== 'fixture-floor' || !Number.isFinite(previous.position?.x) || !Number.isFinite(previous.position?.z)) { supportCounts.invalid++; return null; }
      supportCounts.attached++;
      return { ...floorSurface(previous.position), attached: true };
    }
    if (sweep?.fromMm && sweep?.toMm && sweep.toMm.y > (sweep.radiusMm ?? 0)) { supportCounts.clear++; return { clear: true }; }
    const at = sweep?.toMm ?? position;
    if (!Number.isFinite(at?.x) || !Number.isFinite(at?.z)) { supportCounts.invalid++; return null; }
    supportCounts.contact++;
    return floorSurface(at);
  };
  renderer.configureCombatPresentation({ createPresentation: wrap(createCombatPresentation, 'effect'), createActors: wrap(createCombatActorPresentation, 'actor'), createAppearanceModels: prepareCombatAppearanceModels, cloneSkeleton: clone, preferences: () => prefs, detail: () => activeDetail, groundQuery });
  const manifestBytes = new Uint8Array(await (await fetch('/authoring/library/fpv-character-art/r2/manifest.json')).arrayBuffer());
  const modelBytes = new Uint8Array(await (await fetch('/authoring/library/fpv-character-art/r2/characters.glb')).arrayBuffer());
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', manifestBytes)), n => n.toString(16).padStart(2, '0')).join('');
  const pack = await prepareCombatAppearancePack({ manifestBytes, sha256, assets: new Map([['characters.glb', modelBytes]]) });
  const course = structuredClone(FLIGHT_COURSES[4]); course.bounds = { min: { x: -25000, y: 0, z: -30000 }, max: { x: 25000, y: 16000, z: 25000 } }; course.steps = { 'self-level': [], acro: [] };
  const base = createFlight({ course: FLIGHT_COURSES[4] }).snapshot(); Object.assign(base, { position: { x: 0, y: 11000, z: 24000 }, orientation: [-173648, 0, 0, 984808], status: 'active', step: 0, total: 0, target: null });
  const actors = Array.from({ length: 128 }, (_, i) => ({ id: 'actor-' + i, sourceId: 'source-' + i, spawnId: 'life-' + i, type: ['patrol', 'vehicle', 'drone', 'prop'][i % 4], radius: i % 4 === 1 ? 900 : 350, height: i % 4 === 0 ? 1800 : 900, position: { x: ((i % 16) - 7.5) * 2600, y: i % 4 === 2 ? 2500 : 0, z: -Math.floor(i / 16) * 3300 }, velocity: { x: 400, y: 0, z: 0 }, heading: { x: 0, y: 0, z: 1 }, status: 'active', health: 70, maxHealth: 100, appearance: { family: ['lookout','patroller','runner','sprinter','courier','guard','refuge-seeker','switchback','rendezvous-pair','shield-bearer','brace-trooper','relay-warden'][Math.floor(i / 4) % 12], cast: 'tactical', archetype: ['military-trooper', 'field-utility', 'military-uav', 'tracked-robot'][i % 4], model: 'field-utility' }, vehicleModel: 'field-utility', material: i % 4 === 0 ? 'organic' : i % 4 === 2 ? 'electronic' : 'metal' }));
  const fact = (i, tick, impact = false) => { const a = actors[i % 128], position = { x: ((i % 32) - 16) * 950, y: impact ? 0 : (i % 3) * 700, z: -(Math.floor(i / 32) % 32) * 950 }; return { type: impact ? 'surface-impact' : 'defeat', eventId: (impact ? 'impact:' : 'defeat:') + i, spawnId: 'victim-' + i, sourceId: a.sourceId, tick, position, normal: { x: 0, y: 1, z: 0 }, velocity: { x: 6000, y: 1200, z: -1000 }, weapon: i % 2 ? 'rocket' : 'autocannon', severity: 1, impactDirection: { x: 1, y: .2, z: .2 }, material: impact ? 'metal' : a.material, appearance: { ...a.appearance, type: a.type }, radius: a.radius, height: a.height, surface: floorSurface(position) }; };
  const region = () => { const root = new THREE.Group(), floor = new THREE.Mesh(new THREE.BoxGeometry(128, .2, 128), new THREE.MeshStandardMaterial({ color: '#8f9881', roughness: 1 })); floor.position.y = -.1; root.add(floor); return root; };
  const regionalState = { ...base, originMm: { x: 0, y: 0, z: 0 }, terrain: { provenance: { chunks: [{ chunkId: 'cell' }] } } }, regionManifest = { grid: { cellSizeMm: 128000 }, chunks: [{ id: 'cell', x: 0, z: 0 }] };
  const gl = canvas.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2'), gpuProbe = createFpvGpuProbe(gl);
  globalThis.__fpvGpuProbe = gpuProbe; globalThis.__fpvGpuPhase = { active: false, tag: null };
  const phases = []; for (const mode of ['native']) for (const art of ['realistic-r2']) for (const detail of ['high', 'ultra']) for (const effects of [false, true]) phases.push({ mode, art, detail, effects });
  const stats = phases.map(() => ({ cpu: [], draw: [], effect: [], actor: [], gpu: [], frame: [], heap: [], resources: [], records: [], emittedBurstGroups: 0, maxFrameIntervalMs: 0, support: null, appearance: null, visible: [], invariantErrors: [] }));
  const percentile = (list, p) => { if (!list.length) return null; const sorted = [...list].sort((a, b) => a - b); return Math.round(sorted[Math.floor((sorted.length - 1) * p)] * 1000) / 1000; };
  const startedAt = new Date().toISOString(), start = performance.now(), duration = Number(window.__fixtureSeconds || 30), warmup = Number(window.__fixtureWarmup || 5);
  let phaseIndex = -1, complete = false;
  const report = () => ({ scope: 'Controlled actual flight-renderer fixture using the generated application bundle for createCombatPresentation; synthetic accepted defeat/surface-impact facts and 128 fixed living actors. No gameplay authority, player controls or production terrain admission. Short diagnostic: native r2 only, High overall graphics with forced High/Ultra effect detail; 30 measured seconds per condition after the bounded authored-cap batching and ring-order cache fixes. This does not replace the longer forced-Ultra comparison. Infinite flat fixture floor with stable surface attachment and radius-aware swept contact. Every phase checks actual Current/r2 activation identity and enabled phases require visible settled remains with no invalid support returns. Every enabled phase begins with 1,024 destruction records and 1,024 surface-impact records, then eight mixed-material defeats plus eight impacts every two seconds. Full gore stays enabled for every measured On frame; no Blood/Remains toggles dilute the workload. Matched phase-local movement, camera, seeds, timeline and thirty-second restoration schedule. Phase screenshots are captured while paused after measurement, before changing the scene. CPU covers event ingestion, actor staging and synchronous draw; GPU uses bounded asynchronous timers around the actual renderer render call, including internal passes, sampled every 15 renders. Probe overhead is included identically in both conditions; no blocking GPU readback. Not a full-app or human gameplay acceptance.', startedAt, hardware: { userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency, pixelRatio: devicePixelRatio, width: innerWidth, height: innerHeight, gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timerQuery: Boolean(timer) }, appearanceHash: sha256, elapsedMs: performance.now() - start, completed: complete, phaseIndex, phases: phases.map((phase, i) => ({ ...phase, frames: stats[i].cpu.length, cpuP50: percentile(stats[i].cpu, .5), cpuP95: percentile(stats[i].cpu, .95), cpuP99: percentile(stats[i].cpu, .99), drawP95: percentile(stats[i].draw, .95), effectUpdateP95: percentile(stats[i].effect, .95), actorUpdateP95: percentile(stats[i].actor, .95), intervalP95: percentile(stats[i].frame, .95), gpu: gpuProbe.summary(i), gpuP95: gpuProbe.summary(i).gpuP95, heapBytes: stats[i].heap, resources: stats[i].resources.at(-1), recordCounts: stats[i].records.at(-1), emittedBurstGroups: stats[i].emittedBurstGroups, maxFrameIntervalMs: stats[i].maxFrameIntervalMs, support: stats[i].support, actualAppearance: stats[i].appearance, visibleSamples: stats[i].visible, invariantErrors: stats[i].invariantErrors })) });
  window.__fpvHarness = { report, renderer, actors, prefs };
  for (let index = 0; index < phases.length; index++) {
    globalThis.__fpvGpuPhase.active = false; phaseIndex = index; const phase = phases[index], row = stats[index]; activeDetail = phase.detail;
    supportCounts = { queries: 0, clear: 0, contact: 0, attached: 0, invalid: 0 };
    Object.assign(prefs, { blood: true, brutal: true, showRemains: true });
    if (phase.mode === 'native') renderer.setCourse(course); else renderer.setRegional({ root: region() }, regionManifest);
    renderer.setQuality('high'); renderer.setCombatActors(actors, { runId: 'stress', tick: 5000 });
    if (await renderer.setCombatAppearance(phase.art === 'realistic-r2' ? pack : null) !== true) throw Error('Appearance activation failed: ' + phase.art);
    const appearanceResources = renderer.resources();
    row.appearance = { activation: appearanceResources.combatAppearance, actors: { ready: appearanceResources.combatActors?.appearanceReady, hash: appearanceResources.combatActors?.appearanceHash }, effects: { ready: appearanceResources.combat?.appearanceReady, hash: appearanceResources.combat?.appearanceHash } };
    const realistic = phase.art === 'realistic-r2';
    if (appearanceResources.combatAppearance.state !== (realistic ? 'ready' : 'current') || Boolean(appearanceResources.combatActors?.appearanceReady) !== realistic || Boolean(appearanceResources.combat?.appearanceReady) !== realistic || (realistic && [appearanceResources.combatAppearance.sha256, appearanceResources.combatActors?.appearanceHash, appearanceResources.combat?.appearanceHash].some(hash => hash !== sha256)) || (!realistic && [appearanceResources.combatAppearance.sha256, appearanceResources.combatActors?.appearanceHash, appearanceResources.combat?.appearanceHash].some(Boolean))) throw Error('Phase appearance identity mismatch: ' + JSON.stringify(row.appearance));
    if (phase.effects) { renderer.observeCombat(Array.from({ length: 1024 }, (_, i) => fact(i, 1)), { runId: 'stress', tick: 5000 }); renderer.observeCombat(Array.from({ length: 1024 }, (_, i) => fact(i, 1, true)), { runId: 'stress', tick: 5000 }); }
    await renderer.prepare(); let began = null, previous = null, lastBurst = -1, lastRecovery = 0, serial = 1024, frame = 0;
    while (true) {
      const now = await new Promise(resolve => requestAnimationFrame(resolve)); if (began === null) began = now; const elapsed = (now - began) / 1000; if (elapsed >= duration + warmup) break;
      const tick = 5000 + Math.floor(elapsed * 50), state = { ...(phase.mode === 'regional' ? regionalState : base), ticks: tick }; const cpuStart = performance.now(); effectMs = actorMs = 0;
      actors.forEach((actor, i) => { actor.position.x = ((i % 16) - 7.5) * 2600 + Math.sin(tick / 40 + i) * 700; }); renderer.setCombatActors(actors, { runId: 'stress', tick });
      if (phase.effects && Math.floor(elapsed / 2) !== lastBurst) { lastBurst = Math.floor(elapsed / 2); row.emittedBurstGroups++; renderer.observeCombat(Array.from({ length: 8 }, () => fact(++serial, tick)), { runId: 'stress', tick }); renderer.observeCombat(Array.from({ length: 8 }, (_, i) => fact(serial - i, tick, true)), { runId: 'stress', tick }); }
      // Full gore stays enabled throughout measured On phases; preference changes have separate visual/lifecycle coverage.
      const recovery = Math.floor(elapsed / 30); if (phase.effects && elapsed > 10 && recovery !== lastRecovery) { lastRecovery = recovery; const archive = renderer.exportCombatPresentation(); renderer.restoreCombatPresentation(archive, { runId: 'stress', tick }); }
      const drawStart = performance.now();
      Object.assign(globalThis.__fpvGpuPhase, { active: elapsed >= warmup, tag: index });
      renderer.draw(state, { cameraMode: 'fpv', cameraTilt: 0, cameraFov: 70 });
      const drawMs = performance.now() - drawStart;
      const cpuMs = performance.now() - cpuStart;
      if (elapsed >= warmup) { row.cpu.push(cpuMs); row.draw.push(drawMs); row.effect.push(effectMs); row.actor.push(actorMs); if (previous !== null) { row.frame.push(now - previous); row.maxFrameIntervalMs = Math.max(row.maxFrameIntervalMs, now - previous); } if (frame % 120 === 0) { row.heap.push(performance.memory?.usedJSHeapSize ?? null); const resource = renderer.resources(); row.resources.push(resource); row.support = { ...supportCounts }; row.visible.push({ elapsed: Math.round(elapsed * 100) / 100, blood: prefs.blood, remains: prefs.showRemains, settled: resource.combat?.settled ?? 0, moving: resource.combat?.moving ?? 0, marks: resource.combat?.marks ?? 0, bursts: resource.combat?.bursts ?? 0, pending: resource.combat?.pendingFragments ?? 0, authoredClusters: resource.combat?.authoredClusters ?? 0, completeAuthoredClusters: resource.combat?.completeAuthoredClusters ?? 0, authoredRegions: resource.combat?.authoredRegions ?? 0, proceduralClusters: resource.combat?.proceduralClusters ?? 0, deferredAuthoredClusters: resource.combat?.deferredAuthoredClusters ?? 0, effectCalls: resource.combat?.calls ?? 0 }); const archive = renderer.exportCombatPresentation(); row.records.push({ remains: archive.records.length, impacts: archive.impactRecords?.length ?? 0 }); } }
      previous = now; frame++; if (frame % 30 === 0) status.textContent = JSON.stringify({ phase, elapsed: Math.round(elapsed), effects: renderer.resources().combat }, null, 2);
    }
    if (supportCounts.invalid) row.invariantErrors.push('Invalid support response');
    if (phase.effects && !row.visible.some(sample => sample.remains && sample.settled > 0)) row.invariantErrors.push('No visible settled remains during enabled phase');
    if (phase.effects && !row.visible.some(sample => sample.completeAuthoredClusters > 0 && sample.authoredRegions === sample.completeAuthoredClusters * 12)) row.invariantErrors.push('No complete authored r2 cluster'); if (row.invariantErrors.length) throw Error('Phase ' + index + ' failed: ' + row.invariantErrors.join('; '));
    globalThis.__fpvGpuPhase.active = false;
    window.__fpvCapturePhase = index;
    console.log('FIXTURE PHASE ' + index + ' ' + JSON.stringify(report().phases[index]));
    await new Promise(resolve => { const check = () => window.__fpvCapturePhase === null ? resolve() : setTimeout(check, 50); check(); });
  }
  await new Promise(resolve => setTimeout(resolve, 100)); gpuProbe.poll(); complete = true; window.__fpvResult = report(); gpuProbe.dispose(); status.textContent = 'Controlled effects comparison complete';
})().catch(error => { window.__fpvFailure = error.stack; console.error(error); });
