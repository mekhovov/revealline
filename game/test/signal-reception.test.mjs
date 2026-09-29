import assert from 'node:assert/strict';
import test from 'node:test';
import { createSignalReception } from '../ui/signal-reception.mjs';
import { applyAnalogSignalNoise } from '../ui/analog-signal.mjs';

const freshRun = (patch = {}) => ({
  tick: 0,
  time: 0,
  status: 'running',
  levelId: 'signal-test',
  seed: 7,
  ...patch,
});
const playing = { mode: 'playing', running: true, reduced: false };
const lost = { mode: 'lost', running: true, reduced: false };

function surfaces() {
  const canvases = [],
    calls = [],
    stack = [];
  const target = {
    canvas: {
      pixels(width, height) {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i + 1] = data[i + 2] = 36;
          data[i + 3] = 255;
        }
        return data;
      },
    },
    globalAlpha: 0.6,
    imageSmoothingEnabled: false,
    fillStyle: 'original',
    save() {
      calls.push(['save']);
      stack.push({
        globalAlpha: this.globalAlpha,
        imageSmoothingEnabled: this.imageSmoothingEnabled,
        fillStyle: this.fillStyle,
      });
    },
    restore() {
      Object.assign(this, stack.pop());
      calls.push(['restore']);
    },
    beginPath() {
      calls.push(['beginPath']);
    },
    rect(...args) {
      calls.push(['rect', ...args]);
    },
    clip() {
      calls.push(['clip']);
    },
    drawImage(image, ...args) {
      calls.push(['image', image, this.globalAlpha, ...args]);
    },
    fillRect(...args) {
      calls.push(['fill', this.fillStyle, this.globalAlpha, ...args]);
    },
    getImageData() {
      throw Error('The reception must never read the board.');
    },
  };
  const canvasFactory = () => {
    const canvas = { width: 0, height: 0, writes: 0, reads: 0, captures: [], pixels: null };
    canvas.getContext = () => ({
      createImageData: (width, height) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData(image) {
        canvas.writes++;
        canvas.pixels = image.data.slice();
      },
      getImageData(_x, _y, width, height) {
        assert.ok(canvas.captures.length, 'Only the previously copied masked feed is readable.');
        canvas.reads++;
        return { data: target.canvas.pixels(width, height) };
      },
      drawImage(source, ...args) {
        assert.equal(source, target.canvas, 'Only the already masked composed feed may be copied.');
        canvas.captures.push({ source, args });
      },
      fillRect() {},
    });
    canvases.push(canvas);
    return canvas;
  };
  return { canvasFactory, canvases, target, calls };
}

test('Ready arms a fresh owner without covering its board; actual Start acquires once', () => {
  const receiver = createSignalReception(),
    run = freshRun();
  assert.equal(receiver.advance(run, 1, { mode: 'ready' }).kind, null);
  run.tick = 12;
  let frame = receiver.advance(run, 0, playing);
  assert.equal(frame.kind, 'acquire');
  assert.equal(frame.strength, 0.7);
  assert.equal(Object.isFrozen(frame), true);
  frame = receiver.advance(run, 0.275, playing);
  assert.ok(Math.abs(frame.strength - 0.35) < 1e-9);
  frame = receiver.advance(run, 0.275, playing);
  assert.equal(frame.kind, null);
  assert.equal(frame.strength, 0);
  assert.equal(frame.settled, true);
  run.tick = 0;
  receiver.advance(run, 0, { mode: 'ready' });
  assert.equal(
    receiver.advance(run, 0, playing).kind,
    null,
    'Same-owner reset/respawn is not another Start',
  );
});

test('first-seen fresh playing owner acquires but restored or late frames do not', () => {
  const receiver = createSignalReception();
  assert.equal(receiver.advance(freshRun({ tick: 24 }), 0, playing).kind, 'acquire');
  assert.equal(receiver.advance(freshRun({ tick: 31 }), 0, playing).kind, null);
  const restored = freshRun({ tick: 10, time: 0.1 });
  receiver.advance(restored, 0, { mode: 'ready' });
  assert.equal(receiver.advance(restored, 0, playing).kind, null);
  assert.equal(receiver.advance(freshRun({ tick: 0, status: 'won' }), 0, playing).kind, null);
});

test('Team Ready arms acquisition and paused or respawning states freeze its active frame', () => {
  const receiver = createSignalReception(),
    run = freshRun({ status: 'ready' });
  assert.equal(receiver.advance(run, 1, { mode: 'ready', running: false }).kind, null);
  run.status = 'running';
  run.tick = 1;
  const acquired = receiver.advance(run, 0.2, playing);
  assert.equal(acquired.kind, 'acquire');
  for (const status of ['paused', 'respawning']) {
    run.status = status;
    assert.deepEqual(receiver.advance(run, 3, { ...playing, running: false }), acquired);
  }
  run.status = 'running';
  const resumed = receiver.advance(run, 0.1, playing);
  assert.equal(resumed.kind, 'acquire');
  assert.ok(resumed.time > acquired.time);
  assert.ok(resumed.strength < acquired.strength);
  assert.equal(receiver.advance(run, 0.3, playing).kind, null);
  run.status = 'respawning';
  assert.equal(receiver.advance(run, 0.5, { ...playing, running: false }).kind, null);
  run.status = 'running';
  assert.equal(receiver.advance(run, 0, playing).kind, null);
});

test('a paused or respawning first observation cannot create an acquisition on later resume', () => {
  for (const status of ['paused', 'respawning']) {
    const receiver = createSignalReception(),
      run = freshRun({ status });
    assert.equal(receiver.advance(run, 0, { ...playing, running: false }).kind, null);
    run.status = 'running';
    assert.equal(receiver.advance(run, 0, playing).kind, null);
  }
});

test('paused acquisition freezes without rearming and invalid elapsed values cannot advance it', () => {
  const receiver = createSignalReception(),
    run = freshRun();
  const initial = receiver.advance(run, 0.2, playing);
  assert.deepEqual(receiver.advance(run, 100, { ...playing, running: false }), initial);
  for (const dt of [NaN, Infinity, -1])
    assert.deepEqual(receiver.advance(run, dt, playing), initial);
  assert.equal(receiver.advance(run, 0.35, playing).kind, null);
  assert.equal(receiver.advance(run, 2, { ...playing, running: false }).kind, null);
});

test('loss leaves time to read the wreck then fades into static dim snow', () => {
  const receiver = createSignalReception(),
    run = freshRun({ tick: 720, status: 'lost' });
  let frame = receiver.advance(run, 0, lost);
  assert.equal(frame.kind, 'lost');
  assert.equal(frame.strength, 0);
  frame = receiver.advance(run, 0.15, lost);
  assert.equal(frame.strength, 0);
  frame = receiver.advance(run, 0.25, lost);
  assert.ok(Math.abs(frame.strength - 0.4) < 1e-9);
  const frozen = receiver.advance(run, 20, { ...lost, running: false });
  assert.deepEqual(frozen, frame);
  frame = receiver.advance(run, 0.25, lost);
  assert.equal(frame.strength, 0.8);
  assert.equal(frame.settled, true);
  assert.deepEqual(
    receiver.advance(run, 1000, lost),
    frame,
    'Terminal noise holds its final frame',
  );
});

test('loss requires actual defeat and takes over an unfinished acquisition', () => {
  const receiver = createSignalReception(),
    run = freshRun();
  assert.equal(receiver.advance(run, 0, lost).kind, null);
  assert.equal(receiver.advance(run, 0.1, playing).kind, 'acquire');
  run.status = 'lost';
  const frame = receiver.advance(run, 0, lost);
  assert.equal(frame.kind, 'lost');
  assert.equal(frame.time, 0);
  assert.equal(frame.strength, 0);
  assert.equal(receiver.advance(freshRun({ status: 'won' }), 1, lost).kind, null);
});

test('reduced effects skip acquisition and use gentle static loss without temporal changes', () => {
  const receiver = createSignalReception(),
    run = freshRun();
  assert.equal(receiver.advance(run, 0, { ...playing, reduced: true }).kind, null);
  assert.equal(
    receiver.advance(run, 0, playing).kind,
    null,
    'Changing effects does not invent another Start',
  );
  run.status = 'lost';
  const frame = receiver.advance(run, 0, { ...lost, reduced: true });
  assert.equal(frame.kind, 'lost');
  assert.equal(frame.strength, 0.22);
  assert.equal(frame.noiseFrame, 0);
  assert.equal(frame.settled, true);
  assert.deepEqual(receiver.advance(run, 50, { ...lost, reduced: true }), frame);
});

test('off cancels an opted-in owner, while pre-adoption off-only validation does not disarm candidates', () => {
  const receiver = createSignalReception(),
    run = freshRun();
  assert.equal(receiver.advance(run, 0).kind, null);
  assert.equal(receiver.advance(run, 0, playing).kind, 'acquire');
  assert.equal(receiver.advance(run, 0, { mode: 'off' }).kind, null);
  assert.equal(receiver.advance(run, 0, playing).kind, null);
  const candidate = freshRun();
  receiver.advance(candidate, 0, { mode: 'off' });
  assert.equal(receiver.advance(candidate, 0, playing).kind, 'acquire');
});

test('off candidate validation leaves the active owner transition and cached texture unchanged', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    owner = freshRun({ tick: 100, status: 'lost' }),
    candidate = freshRun();
  const before = receiver.advance(owner, 0.4, lost);
  receiver.draw(f.target, 800, 400, before);
  const canvas = f.canvases[0];
  const preview = receiver.advance(candidate, 10, { mode: 'off' });
  assert.equal(preview.kind, null);
  assert.equal(preview.strength, 0);
  assert.equal(receiver.draw(f.target, 800, 400, preview), false);
  assert.equal(canvas.width, 512);
  assert.deepEqual(receiver.advance(owner, 0, { ...lost, running: false }), before);
  assert.equal(receiver.draw(f.target, 800, 400, before), true);
  assert.equal(canvas.writes, 1);
  assert.equal(receiver.advance(candidate, 0, playing).kind, 'acquire');
  assert.equal(canvas.width, 0, 'Only actual candidate adoption retires the old cache');
});

test('reset clears prior frames and permits a fresh lifecycle without mutating the run', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun();
  const before = structuredClone(run),
    frame = receiver.advance(run, 0.1, playing);
  receiver.draw(f.target, 800, 400, frame);
  const first = f.canvases[0];
  receiver.reset();
  assert.equal(first.width, 0);
  assert.equal(first.height, 0);
  assert.equal(receiver.draw(f.target, 800, 400, frame), false);
  assert.equal(receiver.advance(run, 0, playing).kind, 'acquire');
  assert.deepEqual(run, before);
});

test('draw grades only the bounded masked feed and applies the shared monochrome noise', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun();
  const frame = receiver.advance(run, 0, playing);
  assert.equal(receiver.draw(f.target, 2048, 1024, frame), true);
  const canvas = f.canvases[0];
  assert.equal(canvas.width, 512);
  assert.equal(canvas.height, 256);
  const expectedBase = new Uint8ClampedArray(canvas.pixels.length);
  for (let i = 0; i < expectedBase.length; i += 4) {
    expectedBase[i] = expectedBase[i + 1] = expectedBase[i + 2] = 35;
    expectedBase[i + 3] = 255;
  }
  const expected = new Uint8ClampedArray(expectedBase.length);
  applyAnalogSignalNoise(expectedBase, 512, 256, frame.noiseFrame, expected, {
    seed: frame.seed,
    strength: 0.55,
  });
  // The flat feed matches grading plus shared noise outside the few sync bands.
  const matching = canvas.pixels.filter((value, index) => value === expected[index]).length;
  assert.ok(matching / expected.length > 0.98);
  assert.equal(canvas.captures.length, 1);
  assert.deepEqual(canvas.captures[0].args, [0, 0, 2048, 1024, 0, 0, 512, 256]);
  assert.equal(canvas.reads, 1, 'Readback is confined to the bounded scratch.');
  let brightest = 0;
  for (let i = 0; i < canvas.pixels.length; i += 4) {
    assert.ok(Math.abs(canvas.pixels[i] - canvas.pixels[i + 1]) <= 7);
    assert.ok(Math.abs(canvas.pixels[i] - canvas.pixels[i + 2]) <= 7);
    assert.equal(canvas.pixels[i + 3], 255);
    brightest = Math.max(brightest, canvas.pixels[i]);
  }
  assert.ok(brightest < 180, 'The receiver texture cannot produce a bright white flash');
  assert.deepEqual(f.calls.slice(0, 4), [
    ['save'],
    ['beginPath'],
    ['rect', 0, 0, 2048, 1024],
    ['clip'],
  ]);
  assert.equal(f.calls.find(([kind]) => kind === 'image')[2], 0.6 * frame.strength);
  assert.equal(f.target.globalAlpha, 0.6);
  assert.equal(f.target.imageSmoothingEnabled, false);
});

test('receiver texture updates at most 12Hz, stays cached at rest, and changes size within the cap', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun();
  receiver.draw(f.target, 1024, 512, receiver.advance(run, 0, playing));
  const first = f.canvases[0];
  for (let i = 0; i < 5; i++)
    receiver.draw(f.target, 1024, 512, receiver.advance(run, 0.01, playing));
  assert.equal(first.writes, 1);
  assert.equal(first.reads, 1);
  assert.equal(first.captures.length, 1);
  receiver.draw(f.target, 1024, 512, receiver.advance(run, 0.04, playing));
  assert.equal(first.writes, 2);
  assert.equal(first.reads, 2);
  receiver.draw(f.target, 128, 512, receiver.advance(run, 0, playing));
  assert.equal(first.width, 0);
  assert.equal(f.canvases[1].width, 128);
  assert.equal(f.canvases[1].height, 512);
  run.status = 'lost';
  const terminal = receiver.advance(run, 0.65, lost);
  receiver.draw(f.target, 128, 512, terminal);
  const writes = f.canvases[1].writes;
  for (let i = 0; i < 5; i++) receiver.draw(f.target, 128, 512, receiver.advance(run, 1, lost));
  assert.equal(f.canvases[1].writes, writes);
  assert.equal(f.canvases[1].reads, writes);
});

test('the permitted picture loses colour and sync in narrow bands while keeping its structure', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun({ status: 'lost' }),
    width = 128,
    height = 96;
  const source = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      source[i] = 70 + x;
      source[i + 1] = 30 + y;
      source[i + 2] = 20;
      source[i + 3] = 255;
    }
  const before = source.slice();
  f.target.canvas.pixels = () => source;
  const frame = receiver.advance(run, 0.4, lost);
  receiver.draw(f.target, width, height, frame);
  const actual = f.canvases[0].pixels,
    graded = new Uint8ClampedArray(source.length),
    expected = new Uint8ClampedArray(source.length);
  let sourceChroma = 0,
    actualChroma = 0;
  for (let i = 0; i < source.length; i += 4) {
    const luma = source[i] * 0.2126 + source[i + 1] * 0.7152 + source[i + 2] * 0.0722;
    for (let c = 0; c < 3; c++) graded[i + c] = (luma + (source[i + c] - luma) * 0.08) * 0.72;
    graded[i + 3] = 255;
    sourceChroma += Math.max(...source.subarray(i, i + 3)) - Math.min(...source.subarray(i, i + 3));
    actualChroma += Math.max(...actual.subarray(i, i + 3)) - Math.min(...actual.subarray(i, i + 3));
    assert.equal(actual[i + 3], 255, 'Every shifted band and its exposed edge stays opaque.');
  }
  applyAnalogSignalNoise(graded, width, height, frame.noiseFrame, expected, {
    seed: frame.seed,
    strength: 0.9,
  });
  let changedRows = 0;
  for (let y = 0; y < height; y++)
    if (
      actual
        .subarray(y * width * 4, (y + 1) * width * 4)
        .some((value, index) => value !== expected[y * width * 4 + index])
    )
      changedRows++;
  assert.ok(changedRows > 0 && changedRows < height * 0.15, 'Sync slips stay in a few thin rows.');
  assert.ok(actualChroma < sourceChroma * 0.1, 'Loss resembles a receiver losing chroma.');
  assert.deepEqual(source, before, 'The permitted input snapshot remains unchanged.');
  assert.deepEqual(
    f.canvases[0].captures.map(({ source }) => source),
    [f.target.canvas],
  );
});

test('reduced loss has no sync displacement and freezes its masked snapshot', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun({ status: 'lost' }),
    frame = receiver.advance(run, 0, { ...lost, reduced: true });
  receiver.draw(f.target, 64, 32, frame);
  const canvas = f.canvases[0],
    expectedBase = new Uint8ClampedArray(canvas.pixels.length),
    expected = new Uint8ClampedArray(canvas.pixels.length);
  for (let i = 0; i < expectedBase.length; i += 4) {
    expectedBase[i] = expectedBase[i + 1] = expectedBase[i + 2] = 32;
    expectedBase[i + 3] = 255;
  }
  applyAnalogSignalNoise(expectedBase, 64, 32, 0, expected, { seed: frame.seed, strength: 0.25 });
  assert.deepEqual(canvas.pixels, expected);
  f.target.canvas.pixels = () => assert.fail('A frozen reception must not recapture the feed.');
  receiver.draw(f.target, 64, 32, receiver.advance(run, 100, { ...lost, reduced: true }));
  assert.equal(canvas.reads, 1);
  assert.equal(canvas.writes, 1);
});

test('transparent feed pixels cannot contribute hidden colour to a displaced signal', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun({ status: 'lost' });
  let hidden = 0;
  f.target.canvas.pixels = (width, height) => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = hidden;
      pixels[i + 1] = 255 - hidden;
      pixels[i + 2] = 180;
    }
    return pixels;
  };
  receiver.draw(f.target, 64, 32, receiver.advance(run, 0.4, lost));
  const first = f.canvases[0].pixels;
  hidden = 255;
  receiver.reset();
  receiver.draw(f.target, 64, 32, receiver.advance(run, 0.4, lost));
  assert.deepEqual(f.canvases[1].pixels, first);
});

test('unavailable masked readback retires its cache and never falls back to a raw picture', () => {
  const f = surfaces(),
    receiver = createSignalReception(f),
    run = freshRun();
  receiver.draw(f.target, 64, 32, receiver.advance(run, 0, playing));
  const first = f.canvases[0];
  f.target.canvas.pixels = () => {
    throw new Error('Tainted canvas');
  };
  assert.equal(receiver.draw(f.target, 64, 32, receiver.advance(run, 0.1, playing)), true);
  assert.equal(first.width, 0);
  assert.equal(first.height, 0);
  const reads = first.reads;
  receiver.draw(f.target, 64, 32, receiver.advance(run, 0.1, playing));
  assert.equal(first.reads, reads, 'A failed read is quarantined until size or owner changes.');
  assert.equal(f.calls.at(-2)[0], 'fill');
});

test('quiet allocation failure is cached, and disposal releases canvases and stays inert', () => {
  const f = surfaces();
  let attempts = 0;
  const receiver = createSignalReception({
    canvasFactory() {
      attempts++;
      throw Error('No canvas');
    },
  });
  const run = freshRun(),
    frame = receiver.advance(run, 0, playing);
  for (let i = 0; i < 5; i++) assert.equal(receiver.draw(f.target, 800, 400, frame), true);
  assert.equal(attempts, 1);
  assert.equal(f.calls.filter(([kind]) => kind === 'fill').length, 5);
  assert.equal(f.calls.filter(([kind]) => kind === 'image').length, 0);
  receiver.dispose();
  assert.equal(receiver.advance(run, 0, playing).kind, null);
  assert.equal(receiver.draw(f.target, 800, 400, frame), false);
  assert.equal(attempts, 1);
  const cached = createSignalReception(f);
  cached.draw(f.target, 10, 10, cached.advance(run, 0, playing));
  cached.dispose();
  cached.dispose();
  assert.equal(f.canvases[0].width, 0);
  assert.equal(f.canvases[0].height, 0);
});
