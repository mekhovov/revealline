import test from 'node:test';
import assert from 'node:assert/strict';
import { attachArtworkMotion, artworkMotionMode } from '../ui/menu-scene-motion.mjs';
import { MENU_SCENES } from '../ui/menu-scene-catalog.mjs';

function events(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    listeners,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) {
      listeners.get(name)?.delete(callback);
    },
    emit(name, event = {}) {
      for (const callback of [...(listeners.get(name) ?? [])]) callback(event);
    },
  });
}

// Model GPU ownership and submitted uniforms; these checks do not claim shader
// rasterization. Browser review separately compiles and displays the real shader.
function fixture({ loaded = true, width = 2048, height = 1152, unavailable = false } = {}) {
  const rafs = new Map(),
    calls = [],
    uploads = [],
    draws = [],
    uniforms = {},
    resources = new Set(),
    deleted = [],
    scratch = [],
    readiness = [];
  let next = 0;
  const state = { compile: true, link: true, uploadError: false, drawError: false, error: 0 };
  const constants = [
    'VERTEX_SHADER',
    'FRAGMENT_SHADER',
    'COMPILE_STATUS',
    'LINK_STATUS',
    'ARRAY_BUFFER',
    'STATIC_DRAW',
    'FLOAT',
    'TEXTURE0',
    'TEXTURE_2D',
    'TEXTURE_WRAP_S',
    'TEXTURE_WRAP_T',
    'CLAMP_TO_EDGE',
    'TEXTURE_MIN_FILTER',
    'TEXTURE_MAG_FILTER',
    'LINEAR',
    'UNPACK_FLIP_Y_WEBGL',
    'RGBA',
    'UNSIGNED_BYTE',
    'TRIANGLES',
  ];
  const gl = Object.fromEntries(constants.map((name, index) => [name, index + 1]));
  Object.assign(gl, {
    NO_ERROR: 0,
    getShaderParameter: () => state.compile,
    getProgramParameter: () => state.link,
    getAttribLocation: () => 0,
    getUniformLocation: (_program, name) => name,
    getError: () => state.error,
    isContextLost: () => false,
    uniform1i: (name, value) => {
      uniforms[name] = value;
    },
    uniform3f: (name, ...values) => {
      uniforms[name] = values;
    },
    uniform4fv: (name, value) => {
      uniforms[name] = Array.from(value);
    },
    texImage2D(...args) {
      if (state.uploadError) throw new Error('Unusable image');
      const source = args.at(-1);
      uploads.push({ source, width: source.width, height: source.height });
    },
    drawArrays(...args) {
      if (state.drawError) throw new Error('Lost draw');
      draws.push({ args, uniforms: structuredClone(uniforms) });
    },
  });
  for (const name of ['Shader', 'Program', 'Buffer', 'Texture']) {
    gl[`create${name}`] = () => {
      const resource = { kind: name, id: next++ };
      resources.add(resource);
      return resource;
    };
    gl[`delete${name}`] = (resource) => {
      assert.ok(resources.delete(resource), 'A live GPU handle is released exactly once.');
      deleted.push(resource);
    };
  }
  for (const name of [
    'shaderSource',
    'compileShader',
    'attachShader',
    'linkProgram',
    'useProgram',
    'bindBuffer',
    'bufferData',
    'enableVertexAttribArray',
    'vertexAttribPointer',
    'activeTexture',
    'bindTexture',
    'texParameteri',
    'pixelStorei',
    'viewport',
  ])
    gl[name] = (...args) => calls.push([name, ...args]);
  const win = {
    requestAnimationFrame(callback) {
      const id = ++next;
      rafs.set(id, callback);
      assert.equal(rafs.size, 1, 'Only one animation callback may be owned.');
      return id;
    },
    cancelAnimationFrame(id) {
      rafs.delete(id);
    },
  };
  const doc = {
    defaultView: win,
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = {
        width: 0,
        height: 0,
        getContext(type) {
          assert.equal(type, '2d');
          return { drawImage: (...args) => calls.push(['reduceImage', ...args]) };
        },
      };
      scratch.push(canvas);
      return canvas;
    },
  };
  const image = events({
    src: 'https://game.example/fpv.webp',
    complete: loaded,
    naturalWidth: loaded ? width : 0,
    naturalHeight: loaded ? height : 0,
    width,
    height,
  });
  const canvas = events({
    ownerDocument: doc,
    hidden: false,
    width: 0,
    height: 0,
    getContext(type, options) {
      calls.push(['getContext', type, options]);
      return unavailable ? null : gl;
    },
  });
  function attach(profile = MENU_SCENES.fpv) {
    return attachArtworkMotion({
      canvas,
      image,
      profile,
      onReady: (value) => readiness.push(value),
    });
  }
  return {
    attach,
    canvas,
    image,
    state,
    gl,
    calls,
    uploads,
    draws,
    resources,
    deleted,
    scratch,
    readiness,
    rafs,
    frame(stamp) {
      for (const [id, callback] of [...rafs]) {
        rafs.delete(id);
        callback(stamp);
      }
    },
  };
}

test('a decoded bitmap renders once before readiness, with bounded opaque single-texture output', () => {
  const f = fixture(),
    owner = f.attach();
  assert.deepEqual(f.readiness, [false, true]);
  assert.equal(f.canvas.hidden, false);
  assert.equal(f.draws.length, 1);
  assert.equal(f.rafs.size, 0, 'An attached owner starts paused.');
  assert.equal(f.uploads.length, 1);
  assert.deepEqual([f.canvas.width, f.canvas.height], [1600, 900]);
  assert.deepEqual([f.uploads[0].width, f.uploads[0].height], [1600, 900]);
  assert.equal(f.scratch.length, 1);
  assert.equal(f.scratch[0].width, 0, 'Temporary whole-image reduction releases its bitmap.');
  assert.equal(f.calls.find(([name]) => name === 'reduceImage')[1], f.image);
  assert.deepEqual(f.calls.find(([name]) => name === 'getContext').slice(1), [
    'webgl',
    {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    },
  ]);
  for (const axis of [f.gl.TEXTURE_WRAP_S, f.gl.TEXTURE_WRAP_T])
    assert.ok(
      f.calls.some(
        ([name, target, key, value]) =>
          name === 'texParameteri' &&
          target === f.gl.TEXTURE_2D &&
          key === axis &&
          value === f.gl.CLAMP_TO_EDGE,
      ),
    );
  owner.update({ profile: MENU_SCENES.fpv });
  owner.setRunning(false);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.draws.length, 1);
  assert.equal(f.image.src, 'https://game.example/fpv.webp');
  owner.dispose();
  assert.equal(f.resources.size, 0);
});

test('pending/replaced images keep the original fallback until the matching whole bitmap renders', () => {
  const f = fixture({ loaded: false }),
    owner = f.attach();
  owner.setRunning(true);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.readiness, [false]);
  f.image.complete = true;
  f.image.naturalWidth = 2048;
  f.image.naturalHeight = 1152;
  f.image.emit('load');
  assert.equal(f.uploads.length, 1);
  assert.equal(f.rafs.size, 1);
  f.image.src = 'https://game.example/fpv-portrait.webp';
  f.image.complete = false;
  owner.update({ profile: MENU_SCENES.fpv, vertical: true });
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.rafs.size, 0);
  f.image.emit('load');
  assert.equal(f.uploads.length, 1, 'An obsolete load cannot publish a still-pending replacement.');
  f.image.complete = true;
  f.image.naturalWidth = 1024;
  f.image.naturalHeight = 1792;
  f.image.emit('load');
  assert.equal(f.uploads.length, 2);
  assert.ok(f.canvas.width * f.canvas.height <= 1600 * 900);
  assert.ok(Math.max(f.canvas.width, f.canvas.height) <= 1600);
  assert.ok(Math.abs(f.canvas.width / f.canvas.height - 1024 / 1792) < 0.001);
  assert.deepEqual(f.readiness, [false, true, false, true]);
  assert.equal(f.draws.at(-1).uniforms.u_count, MENU_SCENES.fpv.portraitEnvironment.length);
  owner.dispose();
});

test('the owned clock is capped, preserves phase through pause and ignores long background gaps', () => {
  const f = fixture({ width: 1000, height: 600 }),
    owner = f.attach();
  owner.setRunning(true);
  for (let stamp = 0; stamp <= 1000; stamp += 10) f.frame(stamp);
  assert.ok(f.draws.length > 20 && f.draws.length <= 31);
  assert.equal(f.uploads.length, 1, 'Animation changes uniforms, never the texture.');
  const before = f.draws.at(-1),
    drawCount = f.draws.length;
  assert.deepEqual(before.uniforms.u_camera, [1.025, 0, 0]);
  assert.notDeepEqual(before.uniforms['u_motion[0]'], f.draws[0].uniforms['u_motion[0]']);
  owner.setRunning(false);
  assert.equal(f.rafs.size, 0);
  f.frame(300000);
  assert.equal(f.draws.length, drawCount);
  owner.setRunning(true);
  f.frame(300000);
  assert.equal(f.draws.length, drawCount, 'Resume first establishes its new clock origin.');
  f.frame(300040);
  const resumed = f.draws.at(-1).uniforms['u_motion[0]'];
  for (let i = 0; i < resumed.length; i++)
    assert.ok(Math.abs(resumed[i] - before.uniforms['u_motion[0]'][i]) < 0.1);
  f.frame(900000);
  assert.deepEqual(
    f.draws.at(-1).uniforms['u_motion[0]'],
    resumed,
    'A long RAF stall cannot fast-forward.',
  );
  owner.dispose();
});

test('the scene camera stays fixed for two minutes while bounded local picture phases animate', () => {
  const f = fixture({ width: 1000, height: 600 }),
    owner = f.attach({ ...MENU_SCENES.fpv, cameraDuration: 1e9 });
  owner.setRunning(true);
  for (let stamp = 0; stamp <= 120000; stamp += 100) f.frame(stamp);
  for (const { uniforms } of f.draws) {
    const [zoom, x, y] = uniforms.u_camera;
    assert.deepEqual([zoom, x, y], [1.025, 0, 0]);
    for (const pan of [x, y]) {
      assert.ok(0.5 - 0.5 / zoom + pan - 0.011 > 0);
      assert.ok(0.5 + 0.5 / zoom + pan + 0.011 < 1);
    }
    const motion = uniforms['u_motion[0]'];
    for (let i = 0; i < uniforms.u_count; i++) {
      assert.ok(motion[i * 4 + 3] >= 0);
      assert.ok(motion[i * 4 + 3] <= Math.PI * 2 + 1e-6);
      if (motion[i * 4] === 1) {
        assert.ok(Math.abs(motion[i * 4 + 1]) <= 0.008);
        assert.ok(Math.abs(motion[i * 4 + 2]) <= 0.00065);
      }
      if (motion[i * 4] === 4)
        for (let channel = 1; channel < 4; channel++)
          assert.ok(motion[i * 4 + channel] >= 0 && motion[i * 4 + channel] <= 1);
    }
  }
  assert.equal(f.uploads.length, 1);
  owner.dispose();
});

test('art without qualified regions stays at source scale and never owns an animation callback', () => {
  const f = fixture({ width: 1000, height: 600 }),
    profile = { environment: [], portraitEnvironment: [] },
    owner = f.attach(profile);
  assert.equal(artworkMotionMode(profile), 'static');
  assert.deepEqual(f.draws[0].uniforms.u_camera, [1, 0, 0]);
  owner.setRunning(true);
  assert.equal(f.rafs.size, 0);
  for (let stamp = 0; stamp <= 120000; stamp += 100) f.frame(stamp);
  assert.equal(f.draws.length, 1);
  owner.setRunning(false);
  owner.setRunning(true);
  f.frame(600000);
  owner.update();
  assert.equal(f.draws.length, 1, 'The host alone owns any entrance animation.');
  assert.equal(f.rafs.size, 0);
  f.canvas.emit('webglcontextlost', { preventDefault() {} });
  f.resources.clear();
  f.canvas.emit('webglcontextrestored');
  assert.deepEqual(f.draws.at(-1).uniforms.u_camera, [1, 0, 0]);
  assert.equal(f.rafs.size, 0, 'Context restoration cannot create idle frame work.');
  f.image.src = 'https://game.example/next.webp';
  owner.update();
  assert.deepEqual(f.draws.at(-1).uniforms.u_camera, [1, 0, 0]);
  assert.equal(f.rafs.size, 0);
  owner.update({ profile: MENU_SCENES.fpv });
  assert.equal(f.rafs.size, 1, 'An actual region profile may start its feature clock.');
  owner.update({ profile });
  assert.equal(f.rafs.size, 0, 'Removing the regions cancels the previously queued clock.');
  assert.deepEqual(f.draws.at(-1).uniforms.u_camera, [1, 0, 0]);
  owner.dispose();
});

test('single-source sky drift visibly moves smooth painted features and remains inside each qualified anchor', () => {
  for (const width of [50, 2]) {
    const f = fixture({ width: 1000, height: 600 }),
      owner = f.attach({
        environment: [{ kind: 'cloud', x: 20, y: 20, width, height: 20, duration: 16, delay: -4 }],
      });
    owner.setRunning(true);
    for (let stamp = 0; stamp <= 32000; stamp += 50) f.frame(stamp);
    const horizontal = [],
      maxShift = Math.min(0.008, (width / 100) * 0.08);
    let previous = null;
    for (const { uniforms } of f.draws) {
      assert.deepEqual(uniforms.u_camera, [1.025, 0, 0]);
      const [kind, x, y] = uniforms['u_motion[0]'];
      assert.equal(kind, 1);
      assert.ok(Math.abs(x) <= maxShift + 1e-9);
      assert.ok(Math.abs(y) <= 0.00065);
      if (previous !== null)
        assert.ok(Math.abs(x - previous) < 0.0003, 'Phase wraps never jump a source feature.');
      horizontal.push(x);
      previous = x;
    }
    const range = Math.max(...horizontal) - Math.min(...horizontal);
    assert.ok(range > maxShift * 1.4, 'The source displacement does not cancel itself.');
    if (width === 50) {
      assert.ok(range * 1600 > 18, 'Cloud landmarks travel visibly on a full-size source.');
      assert.ok(
        Math.abs(horizontal[60] - horizontal[0]) * 1600 > 5,
        'The first three seconds have visible sky motion.',
      );
    }
    // For a smooth source gradient, this is the single texture sample the
    // shader consumes; opposite copies no longer cancel all first-order motion.
    const gradient = horizontal.map((offset) => 80 + 160 * (0.45 - offset));
    assert.ok(Math.max(...gradient) - Math.min(...gradient) > maxShift * 200);
    owner.dispose();
  }
});

test('steam flow resets only its zero-weight sample while its source column can sway', () => {
  for (const kind of ['steam']) {
    const f = fixture({ width: 1000, height: 600 }),
      owner = f.attach({
        environment: [{ kind, x: 20, y: 20, width: 50, height: 40, duration: 4, delay: 0 }],
      });
    owner.setRunning(true);
    for (let stamp = 0; stamp <= 9000; stamp += 50) f.frame(stamp);
    let prior = null,
      wraps = 0;
    // Reconstruct only the shader's submitted convex blend on a smooth sample
    // signal. This checks real uploaded coefficients at both reset boundaries.
    const sample = (offset) => Math.sin((0.45 - offset * 0.006) * 80);
    for (const { uniforms } of f.draws) {
      assert.deepEqual(uniforms.u_camera, [1.025, 0, 0]);
      const [, a, b, weight] = uniforms['u_motion[0]'];
      assert.ok(a >= 0 && a <= 1 && b >= 0 && b <= 1);
      assert.ok(weight >= 0 && weight <= 1);
      const value = sample(a - 0.5) * weight + sample(b - 0.5) * (1 - weight);
      if (prior) {
        if (a < prior.a) {
          wraps++;
          assert.ok(weight < 0.03, 'The resetting first sample contributes no visible seam.');
        } else assert.ok(a - prior.a < 0.02, 'First phase advances in one direction.');
        if (b < prior.b) {
          wraps++;
          assert.ok(1 - weight < 0.03, 'The resetting second sample contributes no visible seam.');
        } else assert.ok(b - prior.b < 0.02, 'Second phase advances in one direction.');
        assert.ok(
          Math.abs(value - prior.value) < 0.01,
          'Phase reset keeps the blended image continuous.',
        );
      }
      prior = { a, b, value };
    }
    assert.ok(wraps >= 4);
    owner.dispose();
  }
});

test('only validated source-coordinate environment anchors move, with portrait selection independent of upload', () => {
  const f = fixture({ width: 1000, height: 600 });
  const profile = {
    environment: [
      { kind: 'building', x: 0, y: 0, width: 100, height: 100 },
      { kind: 'cloud', x: 95, y: 0, width: 20, height: 20 },
      { kind: 'water', x: 20, y: 70, width: 30, height: 10, duration: 5 },
      { kind: 'foliage', x: 60, y: 40, width: 20, height: 20, duration: 16 },
    ],
    portraitEnvironment: [{ kind: 'lamp', x: 5, y: 49, width: 12, height: 3, duration: 4.8 }],
  };
  const original = structuredClone(profile),
    owner = f.attach(profile);
  assert.equal(artworkMotionMode(profile), 'regions');
  assert.equal(artworkMotionMode({ environment: profile.environment.slice(0, 2) }), 'static');
  assert.equal(artworkMotionMode(profile, true), 'regions');
  assert.equal(f.draws.at(-1).uniforms.u_count, 2);
  assert.equal(f.draws.at(-1).uniforms['u_motion[0]'][0], 2);
  assert.equal(f.draws.at(-1).uniforms['u_motion[0]'][4], 5);
  owner.update({ vertical: true });
  assert.equal(f.draws.at(-1).uniforms.u_count, 1);
  assert.equal(f.draws.at(-1).uniforms['u_motion[0]'][0], 3);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(profile, original);
  owner.dispose();
});

test('context loss falls back, restoration retains phase, and disposal releases handles and listeners', () => {
  const f = fixture({ width: 1000, height: 600 }),
    owner = f.attach();
  owner.setRunning(true);
  f.frame(0);
  f.frame(100);
  const before = f.draws.at(-1).uniforms.u_camera;
  let prevented = false;
  f.canvas.emit('webglcontextlost', {
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(f.canvas.hidden, true);
  assert.equal(f.rafs.size, 0);
  f.resources.clear(); // Browser invalidates all handles when the context is lost.
  f.canvas.emit('webglcontextrestored');
  assert.equal(f.canvas.hidden, false);
  assert.deepEqual(f.draws.at(-1).uniforms.u_camera, before);
  assert.equal(f.uploads.length, 2);
  owner.setRunning(false);
  owner.dispose();
  owner.dispose();
  assert.equal(f.resources.size, 0);
  assert.equal(f.deleted.length, 5);
  assert.equal(f.canvas.width, 0);
  assert.equal(f.canvas.height, 0);
  assert.equal(f.canvas.hidden, true);
  assert.ok(
    [...f.canvas.listeners.values(), ...f.image.listeners.values()].every((set) => !set.size),
  );
  const count = f.draws.length;
  f.image.emit('load');
  f.canvas.emit('webglcontextrestored');
  owner.setRunning(true);
  owner.update({ profile: MENU_SCENES.retro });
  assert.equal(f.draws.length, count);
  assert.equal(f.rafs.size, 0);
});

test('unavailable, failed shader and rejected upload all leave the untouched image fallback', () => {
  for (const failure of ['unavailable', 'compile', 'uploadError', 'error']) {
    const f = fixture({ unavailable: failure === 'unavailable' });
    if (failure === 'compile') f.state.compile = false;
    if (failure === 'uploadError') f.state.uploadError = true;
    if (failure === 'error') f.state.error = 1282;
    const owner = f.attach();
    assert.deepEqual(f.readiness, [false]);
    assert.equal(f.canvas.hidden, true);
    assert.equal(f.resources.size, 0);
    assert.equal(f.canvas.width, 0);
    const attempts = f.calls.length;
    owner.update();
    owner.setRunning(true);
    assert.equal(f.calls.length, attempts, 'A failed source is not retried each host update.');
    assert.equal(f.rafs.size, 0);
    assert.equal(f.image.src, 'https://game.example/fpv.webp');
    owner.dispose();
  }
});

test('a subsequent successful image load recovers a failed source without duplicate owners', () => {
  const f = fixture();
  f.state.uploadError = true;
  const owner = f.attach();
  owner.setRunning(true);
  f.state.uploadError = false;
  f.image.emit('load');
  assert.deepEqual(f.readiness, [false, true]);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.rafs.size, 1);
  assert.ok(f.scratch.every((canvas) => canvas.width === 0 && canvas.height === 0));
  owner.dispose();
});
