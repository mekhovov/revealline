/* global document, window, Image, ImageData, devicePixelRatio, requestAnimationFrame, atob, btoa */
// Frozen synthetic protocol bodies. Browser/process admission belongs to the common hosted owner.
import assert from 'node:assert/strict';

// prettier-ignore
export const fullProtocol = async ({ base, fixture }) => {
    const [{ BoardPainter }, { createRun, stepRun, FIXED_DT }, { authoritativeCheckpoint }, { jammerPictureStrength }, presets, { themes }] = await Promise.all([
      import(new URL('ui/render.mjs', base).href), import(new URL('core/index.mjs', base).href),
      import(new URL('replay.mjs', base).href), import(new URL('ui/jammer-picture.mjs', base).href),
      fetch(new URL('../authoring/motion-lab/presets.json', base)).then((r) => r.json()),
      fetch(new URL('content/themes.json', base)).then((r) => r.json()),
    ]);
    const failures = [];
    const check = (condition, message) => { if (!condition) failures.push(message); };
    const initial = createRun(fixture.level, { ...fixture.options, seed: 1 });
    const states = { settled: structuredClone(initial), acquire: structuredClone(initial) };
    const run = structuredClone(initial);
    for (let count = 0; count < 1440 && (!states.warning || !states.active); count++) {
      stepRun(run, {}, FIXED_DT);
      const boss = run.enemies.find((enemy) => enemy.type === 'lane-boss');
      if (['warning', 'active'].includes(boss?.bossPhase) && !states[boss.bossPhase]) states[boss.bossPhase] = structuredClone(run);
    }
    check(states.warning && states.active, 'Model did not reach both actual lane phases within12seconds');
    // A declared visual-only claim patch creates a large revealed region. This
    // is not an earned capture or performance workload and is never exported as one.
    for (const state of Object.values(states)) for (let y = 3; y < 12; y++) for (let x = 3; x < 18; x++) state.cells[y * state.level.width + x] = 1;
    const images = [];
    for (const color of ['#f72534', '#03e7de']) {
      const source = document.createElement('canvas'); source.width = 317; source.height = 239;
      const ctx = source.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, source.width, source.height);
      const image = new Image(); image.src = source.toDataURL(); await image.decode(); images.push(image);
    }
    await document.fonts.ready;
    const draw = (state, quality, image, mode, control = null, replacement = null) => {
      const value = structuredClone(state);
      if (control === 'actor-removed') value.enemies = value.enemies.filter((enemy) => enemy.type !== 'bouncer');
      if (control === 'lane-disabled') for (const enemy of value.enemies) if (enemy.type === 'lane-boss') enemy.bossPhase = 'rest';
      const checkpoint = JSON.stringify(authoritativeCheckpoint(value));
      const painter = new BoardPainter(presets); painter.theme = themes.find((theme) => theme.id === 'ukraine');
      painter.bodyId = 'neutral-marker'; painter.body = presets.characters[painter.bodyId]; painter.recipe = presets.animationRecipes[painter.body.animationRecipe]; painter.background = image;
      // Deliberate procedural fixture: async optional actor catalogues are not
      // observed here. Shipped-art identity remains a separate qualification.
      painter.enemyBodies.update = () => {}; painter.enemyBodies.current = () => null; painter.enemyBodies.record = () => null;
      const board = document.createElement('canvas'); board.width = value.level.width * 16; board.height = value.level.height * 16;
      const ctx = board.getContext('2d'), frame = document.createElement('canvas');
      frame.width = 1200; frame.height = Math.round(1200 * board.height / board.width);
      frame.style.width = '400px'; frame.style.height = `${frame.height / 3}px`;
      const target = frame.getContext('2d'); target.imageSmoothingEnabled = false;
      const options = { quality, paused: false, displayCSSWidth: 400, signalReception: mode === 'acquire' ? 'ready' : 'off', signalEffectsRunning: true, backdrop: { image, fit: 'cover' } };
      if (mode === 'acquire') painter.draw(ctx, value, 0, options);
      options.signalReception = mode === 'acquire' ? 'playing' : 'off';
      const capture = (dt) => {
        painter.draw(ctx, value, dt, options);
        check(JSON.stringify(authoritativeCheckpoint(value)) === checkpoint, 'Painter changed authority');
        target.clearRect(0, 0, frame.width, frame.height); target.drawImage(board, 0, 0, frame.width, frame.height);
        return { data: target.getImageData(0, 0, frame.width, frame.height).data, png: frame.toDataURL('image/png').split(',')[1] };
      };
      const frames = [capture(0.1), capture(0.15)], replacements = [];
      // Match zero-dt redraw bookkeeping (e.g. sampled rotor rates) before
      // comparing cache identities; do not mistake a redraw difference for a leak.
      const zeroDtControl = capture(0), zeroDtRepeat = capture(0);
      if (replacement) {
        // Exercise ordinary source-identity invalidation on the same populated
        // painter and run. No manual invalidate/reset; clocks remain at0.25s.
        options.backdrop = { image: replacement, fit: 'cover' };
        replacements.push(capture(0));
        options.backdrop = { image, fit: 'cover' };
        replacements.push(capture(0));
      }
      painter.dispose(); return { frames, replacements, zeroDtControl, zeroDtRepeat, width: frame.width, height: frame.height, checkpoint };
    };
    const differences = (a, b, state, filter) => {
      const scale = a.width / state.level.width, out = { samples: 0, changed: 0, maxDelta: 0 };
      for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
        const cx = Math.floor(x / scale), cy = Math.floor(y / scale);
        if (cx >= state.level.width || cy >= state.level.height) continue;
        // Exclude one output-pixel margin at cell edges. The retained source
        // canvas uses exact16px cells; the declared display is400CSSpx/DPR3.
        if (x - cx * scale < 1 || (cx + 1) * scale - x <= 1 || y - cy * scale < 1 || (cy + 1) * scale - y <= 1) continue;
        if (!filter(cx, cy, state.cells[cy * state.level.width + cx])) continue;
        const offset = (y * a.width + x) * 4; let delta = 0;
        for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a.data[offset + c] - b.data[offset + c]));
        out.samples++; if (delta) out.changed++; out.maxDelta = Math.max(out.maxDelta, delta);
      }
      return out;
    };
    const exactDifference = (a, b) => {
      if (a.data.length !== b.data.length) return { equal: false, changedChannels: null };
      let changedChannels = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) changedChannels++;
      return { equal: changedChannels === 0, changedChannels };
    };
    const rows = [], captures = [];
    for (const quality of ['full', 'reduced', 'minimal']) for (const [mode, state] of Object.entries(states)) {
      const a = draw(state, quality, images[0], mode, null, images[1]), b = draw(state, quality, images[1], mode), repeat = draw(state, quality, images[0], mode);
      const row = { quality, mode, dimensions: { width: a.width, height: a.height }, checkpoint: JSON.parse(a.checkpoint), jammerStrength: jammerPictureStrength(state), frames: [], controls: {}, determinism: a.frames.map((frame, i) => exactDifference(frame, repeat.frames[i])) };
      const deterministic = row.determinism.every((value) => value.equal);
      row.concealmentStatus = deterministic ? 'observed' : 'unobserved-nondeterministic-control';
      check(deterministic, `Identical-input raster differs; concealment unobserved: ${quality}/${mode}`);
      if (!deterministic) repeat.frames.forEach((frame, index) => captures.push({ name: `${quality}-${mode}-${index}-repeat-a`, png: frame.png }));
      for (let index = 0; index < 2; index++) {
        const af = { ...a.frames[index], width: a.width, height: a.height }, bf = { ...b.frames[index], width: b.width, height: b.height };
        const hidden = differences(af, bf, state, (x, y, cell) => cell === 0), exposed = differences(af, bf, state, (x, y, cell) => cell === 1 && x >= 3 && x < 18 && y >= 3 && y < 12);
        if (deterministic) check(hidden.samples > 10000 && hidden.changed === 0, `Hidden picture leaks: ${quality}/${mode}/${index}`);
        check(exposed.samples > 1000 && exposed.changed > exposed.samples / 2, `Exposed picture control did not differ: ${quality}/${mode}/${index}`);
        row.frames.push({ index, hidden, exposed });
        captures.push({ name: `${quality}-${mode}-${index}-picture-a`, png: a.frames[index].png }, { name: `${quality}-${mode}-${index}-picture-b`, png: b.frames[index].png });
      }
      const before = { ...a.zeroDtRepeat, width: a.width, height: a.height }, replaced = { ...a.replacements[0], width: a.width, height: a.height };
      row.sameOwnerReplacement = {
        presentationSeconds: 0.25, sequence: ['picture-a', 'picture-b', 'picture-a'], manualInvalidation: false,
        hidden: differences(before, replaced, state, (x, y, cell) => cell === 0),
        exposed: differences(before, replaced, state, (x, y, cell) => cell === 1 && x >= 3 && x < 18 && y >= 3 && y < 12),
        zeroDtStability: exactDifference(a.zeroDtControl, a.zeroDtRepeat),
        matchesFreshB: exactDifference(a.replacements[0], b.zeroDtRepeat),
        restoredMatchesOriginalA: exactDifference(a.replacements[1], a.zeroDtRepeat),
      };
      row.sameOwnerReplacement.status = deterministic && row.sameOwnerReplacement.zeroDtStability.equal ? 'observed' : 'unobserved-control-difference';
      check(row.sameOwnerReplacement.zeroDtStability.equal, `Zero-dt redraw not stable; replacement unobserved: ${quality}/${mode}`);
      if (row.sameOwnerReplacement.status === 'observed') {
        check(row.sameOwnerReplacement.hidden.changed === 0, `Same-owner hidden picture leaks: ${quality}/${mode}`);
        check(row.sameOwnerReplacement.matchesFreshB.equal, `Populated painter failed source replacement: ${quality}/${mode}`);
        check(row.sameOwnerReplacement.restoredMatchesOriginalA.equal, `Populated painter failed source restoration: ${quality}/${mode}`);
      }
      check(row.sameOwnerReplacement.exposed.changed > row.sameOwnerReplacement.exposed.samples / 2, `Source replacement did not alter exposed picture: ${quality}/${mode}`);
      captures.push({ name: `${quality}-${mode}-same-owner-before-a`, png: a.zeroDtRepeat.png }, { name: `${quality}-${mode}-same-owner-b`, png: a.replacements[0].png }, { name: `${quality}-${mode}-same-owner-restored-a`, png: a.replacements[1].png });
      row.temporalExposed = differences({ ...a.frames[0], width: a.width, height: a.height }, { ...a.frames[1], width: a.width, height: a.height }, state, (x, y, cell) => cell === 1 && x >= 3 && x < 18 && y >= 3 && y < 12);
      if (quality === 'full' && mode !== 'settled') check(row.temporalExposed.changed > 0, `Expected animated reception absent: ${mode}`);
      if (quality !== 'full') check(row.temporalExposed.changed === 0, `Reduced decoration still animated: ${quality}/${mode}`);
      const actor = state.enemies.find((enemy) => enemy.type === 'bouncer');
      if (actor) {
        const control = draw(state, quality, images[0], mode, 'actor-removed');
        row.controls.actor = differences({ ...a.frames[1], width: a.width, height: a.height }, { ...control.frames[1], width: a.width, height: a.height }, state, (x, y, cell) => cell === 0 && Math.abs(x + 0.5 - actor.x) < 2 && Math.abs(y + 0.5 - actor.y) < 2);
        check(row.controls.actor.changed > 0, `Actor visibility control absent: ${quality}/${mode}`);
      }
      if (mode === 'warning' || mode === 'active') {
        const control = draw(state, quality, images[0], mode, 'lane-disabled');
        row.controls.lane = differences({ ...a.frames[1], width: a.width, height: a.height }, { ...control.frames[1], width: a.width, height: a.height }, state, (x, y, cell) => cell === 0);
        check(row.controls.lane.changed > 0, `Lane warning/active cue absent: ${quality}/${mode}`);
      }
      rows.push(row);
    }
    return { rows, captures, failures, environment: { dpr: devicePixelRatio, displayedCSSWidth: 400, framebufferWidth: 1200 }, scope: 'Synthetic fixture claim cells and actor/lane negative controls; not legal-play evidence. Two opaque pictures differ everywhere; hidden-cell interiors must be independent of them. Positive exposed-picture and cue tests prevent a blank painter from passing.' };
  };

// prettier-ignore
export const prefixProtocol = async ({ base, fixture }) => {
    const [{ BoardPainter }, { createRun, stepRun, FIXED_DT }, { authoritativeCheckpoint }, { jammerPictureStrength }, presets, { themes }] = await Promise.all([
      import(new URL('ui/render.mjs', base).href), import(new URL('core/index.mjs', base).href),
      import(new URL('replay.mjs', base).href), import(new URL('ui/jammer-picture.mjs', base).href),
      fetch(new URL('../authoring/motion-lab/presets.json', base)).then((r) => r.json()),
      fetch(new URL('content/themes.json', base)).then((r) => r.json()),
    ]);
    const failures = [];
    const check = (condition, message) => { if (!condition) failures.push(message); };
    const initial = createRun(fixture.level, { ...fixture.options, seed: 1 });
    const states = { settled: structuredClone(initial), acquire: structuredClone(initial) };
    const run = structuredClone(initial);
    for (let count = 0; count < 1440 && (!states.warning || !states.active); count++) {
      stepRun(run, {}, FIXED_DT);
      const boss = run.enemies.find((enemy) => enemy.type === 'lane-boss');
      if (['warning', 'active'].includes(boss?.bossPhase) && !states[boss.bossPhase]) states[boss.bossPhase] = structuredClone(run);
    }
    check(states.warning && states.active, 'Model did not reach both actual lane phases within12seconds');
    // A declared visual-only claim patch creates a large revealed region. This
    // is not an earned capture or performance workload and is never exported as one.
    for (const state of Object.values(states)) for (let y = 3; y < 12; y++) for (let x = 3; x < 18; x++) state.cells[y * state.level.width + x] = 1;
    const images = [];
    for (const color of ['#f72534', '#03e7de']) {
      const source = document.createElement('canvas'); source.width = 317; source.height = 239;
      const ctx = source.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, source.width, source.height);
      const image = new Image(); image.src = source.toDataURL(); await image.decode(); images.push(image);
    }
    await document.fonts.ready;
    const draw = (state, quality, image, mode, control = null, replacement = null) => {
      const value = structuredClone(state);
      if (control === 'actor-removed') value.enemies = value.enemies.filter((enemy) => enemy.type !== 'bouncer');
      if (control === 'lane-disabled') for (const enemy of value.enemies) if (enemy.type === 'lane-boss') enemy.bossPhase = 'rest';
      const checkpoint = JSON.stringify(authoritativeCheckpoint(value));
      const painter = new BoardPainter(presets); painter.theme = themes.find((theme) => theme.id === 'ukraine');
      painter.bodyId = 'neutral-marker'; painter.body = presets.characters[painter.bodyId]; painter.recipe = presets.animationRecipes[painter.body.animationRecipe]; painter.background = image;
      // Deliberate procedural fixture: async optional actor catalogues are not
      // observed here. Shipped-art identity remains a separate qualification.
      painter.enemyBodies.update = () => {}; painter.enemyBodies.current = () => null; painter.enemyBodies.record = () => null;
      const board = document.createElement('canvas'); board.width = value.level.width * 16; board.height = value.level.height * 16;
      const ctx = board.getContext('2d'), frame = document.createElement('canvas');
      frame.width = 1200; frame.height = Math.round(1200 * board.height / board.width);
      frame.style.width = '400px'; frame.style.height = `${frame.height / 3}px`;
      const target = frame.getContext('2d'); target.imageSmoothingEnabled = false;
      const options = { quality, paused: false, displayCSSWidth: 400, signalReception: mode === 'acquire' ? 'ready' : 'off', signalEffectsRunning: true, backdrop: { image, fit: 'cover' } };
      if (mode === 'acquire') painter.draw(ctx, value, 0, options);
      options.signalReception = mode === 'acquire' ? 'playing' : 'off';
      const capture = (dt) => {
        painter.draw(ctx, value, dt, options);
        check(JSON.stringify(authoritativeCheckpoint(value)) === checkpoint, 'Painter changed authority');
        target.clearRect(0, 0, frame.width, frame.height); target.drawImage(board, 0, 0, frame.width, frame.height);
        return { data: target.getImageData(0, 0, frame.width, frame.height).data, png: frame.toDataURL('image/png').split(',')[1] };
      };
      const frames = [capture(0.1), capture(0.15)], replacements = [];
      // Match zero-dt redraw bookkeeping (e.g. sampled rotor rates) before
      // comparing cache identities; do not mistake a redraw difference for a leak.
      const zeroDtControl = capture(0), zeroDtRepeat = capture(0);
      if (replacement) {
        // Exercise ordinary source-identity invalidation on the same populated
        // painter and run. No manual invalidate/reset; clocks remain at0.25s.
        options.backdrop = { image: replacement, fit: 'cover' };
        replacements.push(capture(0));
        options.backdrop = { image, fit: 'cover' };
        replacements.push(capture(0));
      }
      painter.dispose(); return { frames, replacements, zeroDtControl, zeroDtRepeat, width: frame.width, height: frame.height, checkpoint };
    };
    const differences = (a, b, state, filter) => {
      const scale = a.width / state.level.width, out = { samples: 0, changed: 0, maxDelta: 0 };
      for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
        const cx = Math.floor(x / scale), cy = Math.floor(y / scale);
        if (cx >= state.level.width || cy >= state.level.height) continue;
        // Exclude one output-pixel margin at cell edges. The retained source
        // canvas uses exact16px cells; the declared display is400CSSpx/DPR3.
        if (x - cx * scale < 1 || (cx + 1) * scale - x <= 1 || y - cy * scale < 1 || (cy + 1) * scale - y <= 1) continue;
        if (!filter(cx, cy, state.cells[cy * state.level.width + cx])) continue;
        const offset = (y * a.width + x) * 4; let delta = 0;
        for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a.data[offset + c] - b.data[offset + c]));
        out.samples++; if (delta) out.changed++; out.maxDelta = Math.max(out.maxDelta, delta);
      }
      return out;
    };
    const exactDifference = (a, b) => {
      if (a.data.length !== b.data.length) return { equal: false, changedChannels: null };
      let changedChannels = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) changedChannels++;
      return { equal: changedChannels === 0, changedChannels };
    };
    const rows = [], captures = [];
    prefix: for (const quality of ['full', 'reduced', 'minimal']) for (const [mode, state] of Object.entries(states)) {
      const a = draw(state, quality, images[0], mode, null, images[1]), b = draw(state, quality, images[1], mode), repeat = draw(state, quality, images[0], mode);
      const row = { quality, mode, dimensions: { width: a.width, height: a.height }, checkpoint: JSON.parse(a.checkpoint), jammerStrength: jammerPictureStrength(state), frames: [], controls: {}, determinism: a.frames.map((frame, i) => exactDifference(frame, repeat.frames[i])) };
      const deterministic = row.determinism.every((value) => value.equal);
      row.concealmentStatus = deterministic ? 'observed' : 'unobserved-nondeterministic-control';
      check(deterministic, `Identical-input raster differs; concealment unobserved: ${quality}/${mode}`);
      if (!deterministic) repeat.frames.forEach((frame, index) => captures.push({ name: `${quality}-${mode}-${index}-repeat-a`, png: frame.png }));
      for (let index = 0; index < 2; index++) {
        const af = { ...a.frames[index], width: a.width, height: a.height }, bf = { ...b.frames[index], width: b.width, height: b.height };
        const hidden = differences(af, bf, state, (x, y, cell) => cell === 0), exposed = differences(af, bf, state, (x, y, cell) => cell === 1 && x >= 3 && x < 18 && y >= 3 && y < 12);
        if (deterministic) check(hidden.samples > 10000 && hidden.changed === 0, `Hidden picture leaks: ${quality}/${mode}/${index}`);
        check(exposed.samples > 1000 && exposed.changed > exposed.samples / 2, `Exposed picture control did not differ: ${quality}/${mode}/${index}`);
        row.frames.push({ index, hidden, exposed });
        captures.push({ name: `${quality}-${mode}-${index}-picture-a`, png: a.frames[index].png }, { name: `${quality}-${mode}-${index}-picture-b`, png: b.frames[index].png });
      }
      const before = { ...a.zeroDtRepeat, width: a.width, height: a.height }, replaced = { ...a.replacements[0], width: a.width, height: a.height };
      row.sameOwnerReplacement = {
        presentationSeconds: 0.25, sequence: ['picture-a', 'picture-b', 'picture-a'], manualInvalidation: false,
        hidden: differences(before, replaced, state, (x, y, cell) => cell === 0),
        exposed: differences(before, replaced, state, (x, y, cell) => cell === 1 && x >= 3 && x < 18 && y >= 3 && y < 12),
        zeroDtStability: exactDifference(a.zeroDtControl, a.zeroDtRepeat),
        matchesFreshB: exactDifference(a.replacements[0], b.zeroDtRepeat),
        restoredMatchesOriginalA: exactDifference(a.replacements[1], a.zeroDtRepeat),
      };
      row.sameOwnerReplacement.status = deterministic && row.sameOwnerReplacement.zeroDtStability.equal ? 'observed' : 'unobserved-control-difference';
      check(row.sameOwnerReplacement.zeroDtStability.equal, `Zero-dt redraw not stable; replacement unobserved: ${quality}/${mode}`);
      if (row.sameOwnerReplacement.status === 'observed') {
        check(row.sameOwnerReplacement.hidden.changed === 0, `Same-owner hidden picture leaks: ${quality}/${mode}`);
        check(row.sameOwnerReplacement.matchesFreshB.equal, `Populated painter failed source replacement: ${quality}/${mode}`);
        check(row.sameOwnerReplacement.restoredMatchesOriginalA.equal, `Populated painter failed source restoration: ${quality}/${mode}`);
      }
      check(row.sameOwnerReplacement.exposed.changed > row.sameOwnerReplacement.exposed.samples / 2, `Source replacement did not alter exposed picture: ${quality}/${mode}`);
      captures.push({ name: `${quality}-${mode}-same-owner-before-a`, png: a.zeroDtRepeat.png }, { name: `${quality}-${mode}-same-owner-b`, png: a.replacements[0].png }, { name: `${quality}-${mode}-same-owner-restored-a`, png: a.replacements[1].png });
      row.temporalExposed = differences({ ...a.frames[0], width: a.width, height: a.height }, { ...a.frames[1], width: a.width, height: a.height }, state, (x, y, cell) => cell === 1 && x >= 3 && x < 18 && y >= 3 && y < 12);
      if (quality === 'full' && mode !== 'settled') check(row.temporalExposed.changed > 0, `Expected animated reception absent: ${mode}`);
      if (quality !== 'full') check(row.temporalExposed.changed === 0, `Reduced decoration still animated: ${quality}/${mode}`);
      const actor = state.enemies.find((enemy) => enemy.type === 'bouncer');
      if (actor) {
        const control = draw(state, quality, images[0], mode, 'actor-removed');
        row.controls.actor = differences({ ...a.frames[1], width: a.width, height: a.height }, { ...control.frames[1], width: a.width, height: a.height }, state, (x, y, cell) => cell === 0 && Math.abs(x + 0.5 - actor.x) < 2 && Math.abs(y + 0.5 - actor.y) < 2);
        check(row.controls.actor.changed > 0, `Actor visibility control absent: ${quality}/${mode}`);
      }
      if (mode === 'warning' || mode === 'active') {
        const control = draw(state, quality, images[0], mode, 'lane-disabled');
        row.controls.lane = differences({ ...a.frames[1], width: a.width, height: a.height }, { ...control.frames[1], width: a.width, height: a.height }, state, (x, y, cell) => cell === 0);
        check(row.controls.lane.changed > 0, `Lane warning/active cue absent: ${quality}/${mode}`);
      }
      rows.push(row);
      if (rows.length === 2) break prefix;
    }
    return { rows, captures, failures, environment: { dpr: devicePixelRatio, displayedCSSWidth: 400, framebufferWidth: 1200 }, scope: 'Synthetic fixture claim cells and actor/lane negative controls; not legal-play evidence. Two opaque pictures differ everywhere; hidden-cell interiors must be independent of them. Positive exposed-picture and cue tests prevent a blank painter from passing.' };
  };

// prettier-ignore
export const primitiveProtocol = async({pngInputs,atlasInputs,historical})=>{
    const require=(condition,message)=>{if(!condition)throw new Error(message);};
    const binary=(base64)=>Uint8ClampedArray.from(atob(base64),(char)=>char.charCodeAt(0));
    const encoded=(bytes)=>{let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);};
    const opaque=(bytes)=>{for(let i=3;i<bytes.length;i+=4)if(bytes[i]!==255)return false;return true;};
    const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
    const decoder=document.createElement('canvas');decoder.width=768;decoder.height=576;const decoderContext=decoder.getContext('2d');
    const decode=async(entry)=>{const image=new Image();image.src='data:image/png;base64,'+entry.base64;await image.decode();require(image.naturalWidth===768&&image.naturalHeight===576,'PNG dimensions');decoderContext.clearRect(0,0,768,576);decoderContext.drawImage(image,0,0);return decoderContext.getImageData(0,0,768,576).data;};
    const postTint=[];for(const entry of pngInputs)postTint.push(await decode(entry));
    require(equal(postTint[0],postTint[1]),'Independent post-tint decodes differ');require(postTint.every(opaque),'Post-tint data must be opaque');
    const frameBytes=atlasInputs.map((entry)=>({...entry,data:binary(entry.base64)}));
    for(const entry of frameBytes)require(entry.data.length===16384&&opaque(entry.data),'Atlas byte/alpha premise');
    const makeAtlas=(which)=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');for(let frame=0;frame<4;frame++){const entry=frameBytes.find((value)=>value.owner===which&&value.index===frame);require(!!entry,'Four declared atlas frames required');ctx.putImageData(new ImageData(entry.data,64,64),frame*64,0);}return {canvas,attributes:ctx.getContextAttributes?.()??null};};
    const sources={S0:makeAtlas(5),S1:makeAtlas(7),S2:makeAtlas(5)};
    require(JSON.stringify(sources.S0.attributes)===JSON.stringify(sources.S1.attributes)&&JSON.stringify(sources.S0.attributes)===JSON.stringify(sources.S2.attributes),'Atlas context attributes differ');
    const destinations={};
    const state=(ctx)=>({width:ctx.canvas.width,height:ctx.canvas.height,attributes:ctx.getContextAttributes?.()??null,transform:Array.from(['a','b','c','d','e','f'],(key)=>ctx.getTransform()[key]),globalAlpha:ctx.globalAlpha,operation:ctx.globalCompositeOperation,smoothing:ctx.imageSmoothingEnabled,smoothingQuality:ctx.imageSmoothingQuality??null,filter:ctx.filter??null,shadowColor:ctx.shadowColor,shadowBlur:ctx.shadowBlur,shadowOffsetX:ctx.shadowOffsetX,shadowOffsetY:ctx.shadowOffsetY});
    const sequence=[['D0','S0'],['D1','S1'],['D0','S1'],['D1','S0'],['D2','S2'],['D3','S2']];
    const outputs=[];
    for(let index=0;index<sequence.length;index++){
      const [destination,source]=sequence[index];
      if(!destinations[destination]){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;destinations[destination]=canvas.getContext('2d');}
      const ctx=destinations[destination];
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;if('filter'in ctx)ctx.filter='none';ctx.shadowColor='rgba(0,0,0,0)';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
      ctx.putImageData(new ImageData(postTint[0],768,576),0,0);
      ctx.save();ctx.beginPath();ctx.rect(0,0,768,576);ctx.clip();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha*=0.6389932381667919;ctx.globalAlpha*=0.9;
      const before=state(ctx);require(before.operation==='soft-light'&&before.globalAlpha===0.6389932381667919*0.9&&!before.smoothing,'Actual draw state mismatch');
      ctx.drawImage(sources[source].canvas,64,0,64,64,0,0,768,576);ctx.restore();
      // Exactly one destination readback per declared draw. There is no warmup.
      const data=ctx.getImageData(0,0,768,576).data;
      require(opaque(data),'Opaque soft-light result premise');
      if(outputs.length)require(JSON.stringify(before)===JSON.stringify(outputs[0].before),'Unexpected actual draw-state difference');
      outputs.push({order:index+1,destination,source,before,after:state(ctx),data,rgba:encoded(data)});
    }
    require(outputs.length===6&&Object.keys(destinations).length===4,'Fixed draw coverage');
    // Historical PNG decoding occurs only after all six draws/readbacks.
    const historicalPixels=[];for(const entry of historical)historicalPixels.push(await decode(entry));
    const differences=(a,b)=>{require(a.length===b.length,'Comparison length');let changedChannels=0,changedPixels=0,maxDelta=0;const examples=[];for(let i=0;i<a.length;i+=4){let pixelChanged=false;for(let channel=0;channel<4;channel++){const delta=Math.abs(a[i+channel]-b[i+channel]);if(delta){changedChannels++;pixelChanged=true;maxDelta=Math.max(maxDelta,delta);if(examples.length<32)examples.push({pixel:i/4,channel,a:a[i+channel],b:b[i+channel]});}}if(pixelChanged)changedPixels++;}return {equal:changedChannels===0,changedChannels,changedPixels,maxDelta,examples};};
    const pairwise=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)pairwise.push({a:a+1,b:b+1,...differences(outputs[a].data,outputs[b].data)});
    const historicalComparisons=[];for(const output of outputs)for(let index=0;index<2;index++)historicalComparisons.push({order:output.order,historicalOwner:historical[index].owner,...differences(output.data,historicalPixels[index])});
    return {postTintDecodedRGBA:encoded(postTint[0]),premises:{independentPostTintEquality:true,opaqueSources:true,opaquePostTint:true},sourceAttributes:Object.fromEntries(Object.entries(sources).map(([name,value])=>[name,value.attributes])),outputs:outputs.map(({data,...entry})=>entry),pairwise,historicalComparisons,scope:'Six explicit canonical primitive draws; no per-frame hook, no live game, no backend/history reset inference.'};
  };

// prettier-ignore
export const compositorProtocol = async ({ base, fixture }) => {
    const [{ BoardPainter }, { createRun }, { authoritativeCheckpoint }, presets, { themes }] = await Promise.all([
      import(new URL('ui/render.mjs', base).href), import(new URL('core/index.mjs', base).href), import(new URL('replay.mjs', base).href),
      fetch(new URL('../authoring/motion-lab/presets.json', base)).then((r) => r.json()), fetch(new URL('content/themes.json', base)).then((r) => r.json()),
    ]);
    const initial = createRun(fixture.level, { ...fixture.options, seed: 1 });
    for (let y = 3; y < 12; y++) for (let x = 3; x < 18; x++) initial.cells[y * initial.level.width + x] = 1;
    const images = [];
    for (const color of ['#f72534', '#03e7de']) {
      // Same source-image recipe as the retained readback fixture. This does
      // not read the displayed image or alter browser privacy configuration.
      const source = document.createElement('canvas'); source.width = 317; source.height = 239;
      const c = source.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, source.width, source.height);
      const image = new Image(); image.src = source.toDataURL(); await image.decode(); images.push(image);
    }
    await document.fonts.ready;
    document.body.replaceChildren(); document.body.style.margin = '0'; document.documentElement.style.margin = '0';
    let owner = null, serial = 0;
    const witness = () => ({ serial: owner.serial, image: owner.imageIndex, tick: owner.run.tick, levelId: owner.run.level.id,
      checkpoint: authoritativeCheckpoint(owner.run), painterTime: owner.painter.time, generation: owner.painter.preparationGeneration,
      paintRevision: owner.painter.paintRevision, draws: owner.draws, board: [owner.board.width, owner.board.height],
      frame: [owner.frame.width, owner.frame.height], connected: owner.frame.isConnected, fontsStatus: document.fonts.status,
      imageReady: images.every((i) => i.complete && i.naturalWidth === 317 && i.naturalHeight === 239),
      contextLost: Boolean(owner.ctx.isContextLost?.() || owner.target.isContextLost?.()),
      rectangle: (() => { const r = owner.frame.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(), dpr: devicePixelRatio });
    const draw = (dt) => {
      owner.painter.draw(owner.ctx, owner.run, dt, owner.options); owner.draws++;
      if (JSON.stringify(authoritativeCheckpoint(owner.run)) !== owner.checkpoint) throw new Error('Painter changed authoritative state');
      owner.target.clearRect(0, 0, owner.frame.width, owner.frame.height);
      owner.target.drawImage(owner.board, 0, 0, owner.frame.width, owner.frame.height);
    };
    window.compositorFixture = {
      create(imageIndex) {
        owner?.painter.dispose(); owner?.frame.remove();
        const run = structuredClone(initial), painter = new BoardPainter(presets);
        painter.theme = themes.find((theme) => theme.id === 'ukraine'); painter.bodyId = 'neutral-marker';
        painter.body = presets.characters[painter.bodyId]; painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
        painter.background = images[imageIndex]; painter.enemyBodies.update = () => {}; painter.enemyBodies.current = () => null; painter.enemyBodies.record = () => null;
        const board = document.createElement('canvas'); board.width = run.level.width * 16; board.height = run.level.height * 16;
        const frame = document.createElement('canvas'); frame.width = 1200; frame.height = Math.round(1200 * board.height / board.width);
        frame.style.width = '400px'; frame.style.height = `${frame.height / 3}px`; frame.style.display = 'block';
        const target = frame.getContext('2d'); target.imageSmoothingEnabled = false;
        owner = { serial: ++serial, run, painter, board, frame, ctx: board.getContext('2d'), target, imageIndex, draws: 0, checkpoint: JSON.stringify(authoritativeCheckpoint(run)),
          options: { quality: 'full', paused: false, displayCSSWidth: 400, signalReception: 'ready', signalEffectsRunning: true, backdrop: { image: images[imageIndex], fit: 'cover' } } };
        document.body.replaceChildren(frame); painter.draw(owner.ctx, run, 0, owner.options); owner.draws++; owner.options.signalReception = 'playing';
        if (JSON.stringify(authoritativeCheckpoint(run)) !== owner.checkpoint) throw new Error('Preparation draw changed authority');
        return witness();
      },
      draw(dt, replacement) { if (replacement !== null) { owner.imageIndex = replacement; owner.options.backdrop = { image: images[replacement], fit: 'cover' }; } draw(dt); return witness(); },
      witness,
      async waitForFixedSubmission() { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return witness(); },
      dispose() { owner?.painter.dispose(); owner?.frame.remove(); owner = null; },
    };
    return { width: initial.level.width, height: initial.level.height, cells: Array.from(initial.cells), checkpoint: authoritativeCheckpoint(initial), scope: 'Original synthetic full/acquire case only; claimed cells are fixture data, not legal gameplay.' };
  };

// prettier-ignore
export async function captureCompositor({page, report, output, hash, writeFile, resolve, bounded}) {
 const expectedRectangle={x:0,y:0,width:400,height:300};
 const rawPNGs=new Map();
  const capture = async (name, dt, replacement = null) => {
    const row = { name, dt, replacement, startedAt: new Date().toISOString() }; report.captures.push(row);
    row.afterDraw = await page.evaluate(({ dt, replacement }) => window.compositorFixture.draw(dt, replacement), { dt, replacement });
    row.beforeScreenshot = await bounded('two fixed rAF opportunities', () => page.evaluate(() => window.compositorFixture.waitForFixedSubmission()));
    assert.equal(JSON.stringify(row.beforeScreenshot), JSON.stringify(row.afterDraw), 'Owner/readiness changed before screenshot');
    const rect = row.beforeScreenshot.rectangle;
    assert.deepEqual(rect, expectedRectangle);
    assert.equal(row.beforeScreenshot.dpr, 3); assert.equal(row.beforeScreenshot.connected, true);
    assert.equal(row.beforeScreenshot.contextLost, false); assert.equal(row.beforeScreenshot.imageReady, true); assert.equal(row.beforeScreenshot.fontsStatus, 'loaded');
    const bytes = await page.screenshot({ clip: rect, scale: 'device', animations: 'allow', caret: 'hide', timeout: 10000 });
    row.afterScreenshot = await page.evaluate(() => window.compositorFixture.witness());
    row.ownerStable = JSON.stringify(row.afterScreenshot) === JSON.stringify(row.beforeScreenshot);
    row.file = resolve(output, `${name}.png`); row.bytes = bytes.length; row.sha256 = hash(bytes); row.completedAt = new Date().toISOString();
    await writeFile(row.file, bytes, { flag: 'wx' }); rawPNGs.set(name, bytes);
    assert.equal(row.ownerStable, true, 'Owner/readiness changed during screenshot');
  };
  await page.evaluate(() => window.compositorFixture.create(0));
  await capture('a-010', .1); await capture('a-025', .15); await capture('a-zero-control', 0); await capture('a-zero-repeat', 0);
  await capture('a-replaced-b', 0, 1); await capture('a-restored-a', 0, 0);
  for (const [name, image] of [['b', 1], ['repeat-a', 0]]) {
    await page.evaluate((image) => window.compositorFixture.create(image), image);
    await capture(`${name}-010`, .1); await capture(`${name}-025`, .15); await capture(`${name}-zero-control`, 0); await capture(`${name}-zero-repeat`, 0);
  }
  await page.evaluate(() => window.compositorFixture.dispose());

 return rawPNGs;
}

// prettier-ignore
export function analyzeCompositor(report,rawPNGs,PNG){
 const expectedBitmap={width:1200,height:900};
  const pixels = new Map([...rawPNGs].map(([name, bytes]) => { const png = PNG.sync.read(bytes); assert.equal(png.width, expectedBitmap.width); assert.equal(png.height, expectedBitmap.height); return [name, png]; }));
  const compare = (left, right, region = 'all') => {
    const a = pixels.get(left), b = pixels.get(right), state = report.fixture, scale = a.width / state.width;
    let samples = 0, changedPixels = 0, changedChannels = 0, maxDelta = 0;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      if (region !== 'all') {
        const cx = Math.floor(x / scale), cy = Math.floor(y / scale);
        if (cx >= state.width || cy >= state.height || x - cx * scale < 1 || (cx + 1) * scale - x <= 1 || y - cy * scale < 1 || (cy + 1) * scale - y <= 1) continue;
        const cell = state.cells[cy * state.width + cx];
        if (region === 'hidden' ? cell !== 0 : !(cell === 1 && cx >= 3 && cx < 18 && cy >= 3 && cy < 12)) continue;
      }
      samples++; let changed = false;
      for (let c = 0; c < 4; c++) { const offset = (y * a.width + x) * 4 + c, d = Math.abs(a.data[offset] - b.data[offset]); if (d) { changed = true; changedChannels++; maxDelta = Math.max(maxDelta, d); } }
      if (changed) changedPixels++;
    }
    return { left, right, region, samples, changedPixels, changedChannels, maxDelta };
  };
  report.controls = [compare('a-010', 'repeat-a-010'), compare('a-025', 'repeat-a-025'), compare('a-zero-control', 'a-zero-repeat'), compare('b-zero-control', 'b-zero-repeat'), compare('repeat-a-zero-control', 'repeat-a-zero-repeat'), compare('a-zero-repeat', 'repeat-a-zero-repeat')];
  report.replacement = [compare('a-replaced-b', 'b-zero-repeat'), compare('a-restored-a', 'a-zero-repeat')];
  report.hidden = [compare('a-010', 'b-010', 'hidden'), compare('a-025', 'b-025', 'hidden'), compare('a-zero-repeat', 'a-replaced-b', 'hidden')];
  report.exposed = [compare('a-010', 'b-010', 'exposed'), compare('a-025', 'b-025', 'exposed'), compare('a-zero-repeat', 'a-replaced-b', 'exposed')];
  report.temporalExposed = compare('a-010', 'a-025', 'exposed');
  for (const c of [...report.controls, ...report.replacement]) if (c.changedPixels !== 0) report.invariantFailures.push(`Exact pixel control differs: ${c.left}/${c.right}`);
  for (const c of report.hidden) if (c.samples <= 10000 || c.changedPixels !== 0) report.invariantFailures.push(`Concealed-pixel comparison fails: ${c.left}/${c.right}`);
  for (const c of report.exposed) if (c.samples <= 1000 || c.changedPixels <= c.samples / 2) report.invariantFailures.push(`Exposed positive control fails: ${c.left}/${c.right}`);
  if (report.temporalExposed.changedPixels === 0) report.invariantFailures.push('Acquisition animation positive control fails');
  report.concealmentStatus = report.controls.every((c) => c.changedPixels === 0) ? (report.hidden.every((c) => c.changedPixels === 0 && c.samples > 10000) ? 'observed-equal-composited-interiors' : 'failed-hidden-comparison') : 'unobserved-identical-input-control-failed';
  assert.equal(report.invariantFailures.length, 0, 'One or more strict compositor invariants failed');

 return report;
}
