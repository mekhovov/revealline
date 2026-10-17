/* global document, Image, devicePixelRatio, btoa */
// Serialized into the owned browser. Node supplies only the same native core/replay
// interfaces for model tests; no cell mutations or injected renderer state.
export async function earnedRasterProtocol({ base, fixture, modelOnly = false }, supplied = null) {
  const [core, replay] = supplied
    ? [supplied.core, supplied.replay]
    : await Promise.all([
        import(new URL('core/index.mjs', base).href),
        import(new URL('replay.mjs', base).href),
      ]);
  const { createRun, stepRun, FIXED_DT } = core;
  const { authoritativeCheckpoint, createRecorder, recordInput, exportReplay, verifyReplay } =
    replay;
  const require = (value, label) => {
    if (!value) throw Error(label);
  };
  require(fixture.format === 'SoloEarnedRasterFixtureV1', 'Unknown earned fixture');
  require(fixture.protocol === 'earned-capture-erosion-v1', 'Unknown earned protocol');
  require(fixture.ticks === 3570 && fixture.segments.length === 17, 'Legal route bounds');
  require(fixture.stages.length === 7, 'Earned stage bound');
  const run = createRun(fixture.level, fixture.options);
  const recorder = createRecorder(fixture.level, fixture.options, 'legal-earned-raster-control');
  const selected = new Map(fixture.stages.map((stage) => [stage.tick, stage]));
  require(selected.size === 7, 'Duplicate earned stage');
  const snapshots = [],
    mechanics = { closures: 0, erosions: 0, warnings: 0, repairedCells: [] };
  const erased = new Set();
  const retainState = () => {
    const stage = selected.get(run.tick);
    if (!stage) return;
    const checkpoint = authoritativeCheckpoint(run);
    require(checkpoint.hash === stage.checkpoint, `Authoritative stage differs: ${stage.name}`);
    snapshots.push({
      ...stage,
      checkpoint,
      events: structuredClone(run.events),
      claimedCount: run.claimedCount,
      coverage: run.coverage,
    });
  };
  retainState();
  let ticks = 0;
  for (const [direction, count] of fixture.segments) {
    require(['up', 'down', 'left', 'right'].includes(direction), 'Nonpublic route input');
    require(Number.isSafeInteger(count) && count > 0 && count <= 1000, 'Segment bounds');
    for (let i = 0; i < count; i++) {
      require(run.status === 'running', 'Input after terminal state');
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      require(++ticks <= fixture.ticks, 'Route exceeded fixed ticks');
      for (const event of run.events) {
        if (event.type === 'cut.closed') mechanics.closures++;
        if (event.type === 'erosion.warning') mechanics.warnings++;
        if (event.type === 'cells.eroded') {
          mechanics.erosions++;
          for (const index of event.indices) erased.add(index);
        }
        if (event.type === 'cells.claimed')
          for (const index of event.indices)
            if (erased.has(index)) mechanics.repairedCells.push(index);
      }
      retainState();
    }
  }
  const recording = exportReplay(recorder, run),
    verification = verifyReplay(recording);
  require(ticks === fixture.ticks && run.status === 'won', 'Legal route did not finish');
  require(authoritativeCheckpoint(run).hash === fixture.checkpoint, 'Final checkpoint differs');
  require(verification.match === true, 'Source-native strict replay differs');
  require(mechanics.closures === 5 &&
    mechanics.erosions === 3 &&
    mechanics.warnings === 4, 'Earned mechanic counts differ');
  require(mechanics.repairedCells.length === 0, 'Route repair observation differs');
  require(snapshots.length === 7, 'Missing authoritative stages');
  const eventsAt = (name) => snapshots.find((stage) => stage.name === name)?.events ?? [];
  require(eventsAt('post-capture').some(
    (event) => event.type === 'cut.closed' && event.cells === 520,
  ), '520-cell capture absent');
  require(eventsAt('erosion-warning').some(
    (event) => event.type === 'erosion.warning',
  ), 'Erosion warning absent');
  require(eventsAt('post-erosion').some(
    (event) => event.type === 'cells.eroded' && event.indices.length > 0,
  ), 'Earned erosion absent');
  require(eventsAt('large-capture').some(
    (event) => event.type === 'cut.closed' && event.cells === 714,
  ), '714-cell capture absent');
  const proof = {
    ticks,
    finalCheckpoint: authoritativeCheckpoint(run),
    mechanics,
    repair: 'unobserved-no-eroded-cell-recapture-on-this-route',
    stages: snapshots,
    recording,
    replay: {
      match: verification.match,
      status: verification.state.status,
      checkpoint: authoritativeCheckpoint(verification.state),
    },
  };
  if (modelOnly) return proof;

  const [{ BoardPainter }, presets, { themes }] = await Promise.all([
    import(new URL('ui/render.mjs', base).href),
    fetch(new URL('../authoring/motion-lab/presets.json', base)).then((r) => r.json()),
    fetch(new URL('content/themes.json', base)).then((r) => r.json()),
  ]);
  await document.fonts.ready;
  const images = [];
  for (const color of ['#f72534', '#03e7de']) {
    const source = document.createElement('canvas');
    source.width = 317;
    source.height = 239;
    const context = source.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, 317, 239);
    const image = new Image();
    image.src = source.toDataURL();
    await image.decode();
    images.push(image);
    source.width = source.height = 0;
  }
  const rows = [],
    captures = [],
    failures = [],
    layerIdentities = [];
  let painterCount = 0,
    destinationCount = 0;
  const createPainter = (image, quality) => {
    require(++painterCount <= 80, 'Declared painter count exceeded');
    const painterId = painterCount;
    const painter = new BoardPainter(presets, {
      layerCanvasFactory(width, height) {
        require(layerIdentities.length < 1024, 'Owned layer identity cap');
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        layerIdentities.push({ id: layerIdentities.length + 1, painter: painterId, width, height });
        return canvas;
      },
    });
    painter.theme = themes.find((theme) => theme.id === 'ukraine');
    painter.bodyId = 'neutral-marker';
    painter.body = presets.characters[painter.bodyId];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    painter.background = image;
    // Same explicit procedural actors as the synthetic correctness control. No
    // asynchronous actor catalogue or shipped-art equivalence is claimed here.
    painter.enemyBodies.update = () => {};
    painter.enemyBodies.current = () => null;
    painter.enemyBodies.record = () => null;
    const board = document.createElement('canvas'),
      frame = document.createElement('canvas');
    board.width = fixture.level.width * 16;
    board.height = fixture.level.height * 16;
    frame.width = 1200;
    frame.height = 600;
    const context = board.getContext('2d'),
      target = frame.getContext('2d');
    target.imageSmoothingEnabled = false;
    destinationCount += 2;
    const options = {
      quality,
      paused: true,
      celebrationPaused: true,
      displayCSSWidth: 400,
      signalReception: 'off',
      signalEffectsRunning: false,
      backdrop: { image, fit: 'cover' },
    };
    return {
      id: painterId,
      rebuildControlCaches() {
        painter.invalidate();
      },
      draw(state) {
        const before = JSON.stringify(authoritativeCheckpoint(state));
        painter.draw(context, state, 0, options);
        require(JSON.stringify(authoritativeCheckpoint(state)) ===
          before, 'Painter changed authority');
        target.clearRect(0, 0, 1200, 600);
        target.drawImage(board, 0, 0, 1200, 600);
        return {
          data: target.getImageData(0, 0, 1200, 600).data,
          png: frame.toDataURL('image/png').split(',')[1],
        };
      },
      dispose() {
        painter.dispose();
        board.width = board.height = frame.width = frame.height = 0;
      },
    };
  };
  const exact = (a, b) => {
    let changedChannels = 0;
    for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) changedChannels++;
    return { equal: changedChannels === 0, changedChannels };
  };
  const compareRegion = (a, b, state, hidden) => {
    const out = { samples: 0, changed: 0, maxDelta: 0 },
      scale = 1200 / state.level.width;
    for (let y = 0; y < 600; y++)
      for (let x = 0; x < 1200; x++) {
        const cx = Math.floor(x / scale),
          cy = Math.floor(y / scale);
        if (
          x - cx * scale < 1 ||
          (cx + 1) * scale - x <= 1 ||
          y - cy * scale < 1 ||
          (cy + 1) * scale - y <= 1
        )
          continue;
        const cell = state.cells[cy * state.level.width + cx];
        if (cell !== (hidden ? 0 : 1)) continue;
        let delta = 0;
        const offset = (y * 1200 + x) * 4;
        for (let c = 0; c < 4; c++)
          delta = Math.max(delta, Math.abs(a.data[offset + c] - b.data[offset + c]));
        out.samples++;
        if (delta) out.changed++;
        out.maxDelta = Math.max(out.maxDelta, delta);
      }
    return out;
  };
  const rgba = (frame) => {
    let binary = '';
    for (let i = 0; i < frame.data.length; i += 32768)
      binary += String.fromCharCode(...frame.data.subarray(i, i + 32768));
    return btoa(binary);
  };
  const rebuilt = (image, quality, target) => {
    const painter = createPainter(image, quality);
    try {
      const state = createRun(fixture.level, fixture.options);
      let historyDraws = 0;
      const priorStage = () => {
        if (state.tick < target.tick && selected.has(state.tick)) {
          require(authoritativeCheckpoint(state).hash ===
            selected.get(state.tick).checkpoint, 'Control presentation history differs');
          painter.draw(state);
          painter.draw(state);
          historyDraws += 2;
        }
      };
      priorStage();
      history: for (const [direction, count] of fixture.segments)
        for (let i = 0; i < count; i++) {
          if (state.tick >= target.tick) break history;
          stepRun(state, { direction }, FIXED_DT);
          priorStage();
        }
      require(authoritativeCheckpoint(state).hash === target.checkpoint, 'Control target differs');
      // Only independent controls discard caches. Presentation owners keep the
      // exact preceding draw history, including paused actor facing directions.
      painter.rebuildControlCaches();
      painter.draw(state);
      return { ...painter.draw(state), historyDraws, controlOnlyInvalidation: true };
    } finally {
      painter.dispose();
    }
  };
  let stopped = false;
  for (const quality of ['full', 'reduced', 'minimal']) {
    if (stopped) break;
    const a = createPainter(images[0], quality),
      b = createPainter(images[1], quality);
    const state = createRun(fixture.level, fixture.options);
    const observe = () => {
      const stage = selected.get(state.tick);
      if (!stage) return;
      require(authoritativeCheckpoint(state).hash ===
        stage.checkpoint, 'Render replay stage differs');
      // Paired zero-dt calls have the same history in subject and control owners.
      // Only the separate controls rebuild their caches; subjects never reset.
      const firstA = a.draw(state),
        cachedA = a.draw(state);
      b.draw(state);
      const cachedB = b.draw(state);
      const rebuiltA = rebuilt(images[0], quality, stage);
      const repeatA = rebuilt(images[0], quality, stage);
      const rebuiltB = rebuilt(images[1], quality, stage);
      const controls = {
        stableA: exact(firstA, cachedA),
        deterministicA: exact(rebuiltA, repeatA),
        populatedMatchesRebuiltA: exact(cachedA, rebuiltA),
        populatedMatchesRebuiltB: exact(cachedB, rebuiltB),
      };
      const hidden = compareRegion(cachedA, cachedB, state, true);
      const exposed = compareRegion(cachedA, cachedB, state, false);
      const row = {
        quality,
        mode: stage.name,
        tick: state.tick,
        checkpoint: authoritativeCheckpoint(state),
        controls,
        hidden,
        exposed,
        owners: [a.id, b.id],
        presentationSeconds: 0,
        manualInvalidation: false,
        controlHistory: {
          precedingDraws: rebuiltA.historyDraws,
          independentRepeats: [repeatA.historyDraws, rebuiltB.historyDraws],
          controlOnlyInvalidation:
            rebuiltA.controlOnlyInvalidation &&
            repeatA.controlOnlyInvalidation &&
            rebuiltB.controlOnlyInvalidation,
        },
      };
      const deterministic = Object.values(controls).every((control) => control.equal);
      row.concealmentStatus = deterministic ? 'observed' : 'unobserved-control-difference';
      row.exposedRequired = state.claimedCount > 0;
      if (!deterministic) failures.push(`Exact painter controls differ: ${quality}/${stage.name}`);
      if (deterministic && !(hidden.samples > 1000 && hidden.changed === 0))
        failures.push(`Concealed pixels differ: ${quality}/${stage.name}`);
      if (row.exposedRequired && !(exposed.samples > 1000 && exposed.changed > exposed.samples / 2))
        failures.push(`Exposed positive control absent: ${quality}/${stage.name}`);
      rows.push(row);
      for (const [name, frame] of [
        ['cached-a', cachedA],
        ['cached-b', cachedB],
      ])
        captures.push({ name: `${quality}-${stage.name}-${name}`, png: frame.png });
      if (failures.length) {
        // Retain every comparator of the first failing row, then explicitly
        // leave remaining rows unobserved within the fixed artifact budget.
        for (const [name, frame] of [
          ['zero-a', firstA],
          ['cached-a', cachedA],
          ['cached-b', cachedB],
          ['rebuilt-a', rebuiltA],
          ['repeat-a', repeatA],
          ['rebuilt-b', rebuiltB],
        ])
          captures.push({
            name: `${quality}-${stage.name}-failure-${name}`,
            png: frame.png,
            rgba: rgba(frame),
          });
        stopped = true;
      }
    };
    try {
      observe();
      for (const [direction, count] of fixture.segments) {
        if (stopped) break;
        for (let i = 0; i < count && !stopped; i++) {
          stepRun(state, { direction }, FIXED_DT);
          observe();
        }
      }
    } finally {
      a.dispose();
      b.dispose();
    }
  }
  const expectedCases = ['full', 'reduced', 'minimal'].flatMap((quality) =>
    fixture.stages.map((stage) => ({ quality, mode: stage.name })),
  );
  return {
    format: 'SoloEarnedNativeRasterV1',
    rows,
    captures,
    failures,
    proof,
    notObserved: expectedCases.slice(rows.length),
    canvasIdentities: {
      sourceImages: 2,
      painters: painterCount,
      destinations: destinationCount,
      layers: layerIdentities,
      scope: 'Owned factory/destination counts only; not all browser canvases or GPU resources.',
    },
    environment: {
      dpr: devicePixelRatio,
      displayedCSSWidth: 400,
      framebufferWidth: 1200,
      framebufferHeight: 600,
    },
    scope:
      'Unmodified legal source-core states, strict source-native replay and exact zero-dt populated/rebuilt-cache controls with matched presentation history. Procedural actors and two colored originals; no timing, physical-device or shipped-art equivalence claim.',
  };
}
