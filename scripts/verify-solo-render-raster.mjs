/* global document, Image */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run against two local source servers. The browser dependency and executable
// are explicit caller inputs; this adds no production/browser dependency.
const [baselineURL, candidateURL, output = '/tmp/solo-render-raster'] = process.argv.slice(2);
if (!baselineURL || !candidateURL || !process.env.PLAYWRIGHT_MODULE)
  throw new Error(
    'Usage: PLAYWRIGHT_MODULE=<module> CHROME_EXECUTABLE=<browser> node scripts/verify-solo-render-raster.mjs <baseline URL> <candidate URL> [output directory]',
  );
const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE,
  headless: true,
  // Readbacks otherwise make Chrome migrate only the main canvas to software
  // after the first few samples, changing antialiasing independently of code.
  args: ['--disable-accelerated-2d-canvas'],
});
const directory = resolve(output);
await mkdir(directory, { recursive: true });
async function sample(origin) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  try {
    await page.route('**/__solo_raster_fixture__', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><body style="margin:0"><canvas></canvas></body></html>',
      }),
    );
    await page.goto(new URL('/__solo_raster_fixture__', origin).href);
    return await page.evaluate(async () => {
      const [{ BoardPainter }, { createRun }, { authoritativeCheckpoint }, presets, { themes }] =
        await Promise.all([
          import('/game/ui/render.mjs'),
          import('/game/core/index.mjs'),
          import('/game/replay.mjs'),
          fetch('/authoring/motion-lab/presets.json').then((r) => r.json()),
          fetch('/game/content/themes.json').then((r) => r.json()),
        ]);
      await document.fonts.ready;
      const painter = new BoardPainter(presets);
      painter.theme = themes.find((t) => t.id === 'ukraine');
      painter.bodyId = 'neutral-marker';
      painter.body = presets.characters[painter.bodyId];
      painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
      const makeImage = async (alternate = false) => {
        const source = document.createElement('canvas');
        source.width = 317;
        source.height = 239;
        const ctx = source.getContext('2d');
        ctx.fillStyle = alternate ? '#162d49' : '#bd804a';
        ctx.fillRect(0, 0, 317, 239);
        for (let y = 0; y < 239; y += 17)
          for (let x = 0; x < 317; x += 23) {
            ctx.fillStyle = (x + y) % 3 ? '#294e61' : '#e4d394';
            ctx.fillRect(x, y, 11, 7);
          }
        const image = new Image();
        image.src = source.toDataURL();
        await image.decode();
        return image;
      };
      painter.background = await makeImage();
      // Keep asynchronous optional catalogs out of a deterministic raster fixture.
      painter.enemyBodies.update = () => {};
      painter.enemyBodies.current = () => null;
      painter.enemyBodies.record = () => null;
      const level = {
        version: 'xonix-level.v4',
        id: 'native-raster',
        revision: '1',
        name: 'Native raster fixture',
        width: 72,
        height: 36,
        spawn: { x: 4.5, y: 0.5 },
        goal: { coverage: 0.9 },
        walls: [{ x: 20, y: 8, w: 4, h: 3 }],
        enemies: [
          { id: 'fixture-actor', type: 'bouncer', x: 50.5, y: 20.5, vx: 0, vy: 0, radius: 0.25 },
        ],
        encounter: null,
        classic: {
          version: 'classic.v1',
          terrain: [
            { id: 'slow', x: 12, y: 9, w: 1, h: 1, kind: 'slow' },
            { id: 'lethal', x: 13, y: 9, w: 1, h: 1, kind: 'lethal' },
          ],
          powerups: [],
        },
      };
      let run = createRun(level, { seed: 17 });
      const canvas = document.querySelector('canvas'),
        ctx = canvas.getContext('2d');
      let options = {
        paused: true,
        quality: 'full',
        signalReception: 'off',
        pictureInterference: false,
      };
      const results = [];
      const snapshot = (name) => {
        canvas.width = run.width * 16 || run.level.width * 16;
        canvas.height = run.height * 16 || run.level.height * 16;
        const checkpoint = JSON.stringify(authoritativeCheckpoint(run));
        painter.draw(ctx, run, 0, options);
        if (JSON.stringify(authoritativeCheckpoint(run)) !== checkpoint)
          throw new Error(`Authority changed: ${name}`);
        const bytes = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let binary = '';
        for (let i = 0; i < bytes.length; i += 32768)
          binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        results.push({
          name,
          width: canvas.width,
          height: canvas.height,
          rgba: btoa(binary),
          png: canvas.toDataURL('image/png').split(',')[1],
        });
      };
      snapshot('initial');
      snapshot('cached-repeat');
      for (let y = 5; y < 12; y++) for (let x = 4; x < 11; x++) run.cells[y * 72 + x] = 1;
      snapshot('capture');
      run.cells[5 * 72 + 4] = 0;
      run.cells[5 * 72 + 11] = 1;
      snapshot('same-coverage-swap');
      for (let y = 6; y < 9; y++) for (let x = 5; x < 8; x++) run.cells[y * 72 + x] = 0;
      snapshot('erosion');
      run.cells[8 * 72 + 19] = 1;
      run.cells[7 * 72 + 20] = 1;
      run.cells[11 * 72 + 23] = 1;
      snapshot('wall-contact');
      painter.theme = themes.find((t) => t.id === 'retro');
      snapshot('theme');
      painter.background = await makeImage(true);
      snapshot('picture');
      options = { ...options, backdrop: { image: painter.background, fit: 'contain' } };
      snapshot('contain');
      run = createRun(
        {
          version: 'xonix-level.v1',
          id: 'resized',
          revision: '1',
          name: 'Resize fixture',
          width: 48,
          height: 36,
          spawn: { x: 4.5, y: 0.5 },
          goal: { coverage: 0.9 },
          enemies: [],
        },
        { seed: 17 },
      );
      snapshot('resize');
      painter.invalidate?.();
      snapshot('restored-rebuild');
      painter.dispose();
      return results;
    });
  } finally {
    await page.close();
  }
}
try {
  const baseline = await sample(baselineURL),
    candidate = await sample(candidateURL);
  assert.deepEqual(
    candidate.map((s) => s.name),
    baseline.map((s) => s.name),
  );
  const cases = [];
  for (let i = 0; i < baseline.length; i++) {
    const a = baseline[i],
      b = candidate[i],
      ab = Buffer.from(a.rgba, 'base64'),
      bb = Buffer.from(b.rgba, 'base64');
    assert.equal(ab.length, bb.length);
    const deltaHistogram = {},
      largestChanges = [];
    let changedPixels = 0,
      maxChannelDelta = 0,
      totalChannelDelta = 0;
    for (let p = 0; p < ab.length; p += 4) {
      let changed = false;
      for (let c = 0; c < 4; c++) {
        const delta = Math.abs(ab[p + c] - bb[p + c]);
        changed ||= delta > 0;
        maxChannelDelta = Math.max(maxChannelDelta, delta);
        totalChannelDelta += delta;
      }
      if (changed) changedPixels++;
      let pixelDelta = 0;
      for (let c = 0; c < 4; c++)
        pixelDelta = Math.max(pixelDelta, Math.abs(ab[p + c] - bb[p + c]));
      if (pixelDelta) deltaHistogram[pixelDelta] = (deltaHistogram[pixelDelta] || 0) + 1;
      if (pixelDelta > 4 && largestChanges.length < 12)
        largestChanges.push({
          x: (p / 4) % a.width,
          y: Math.floor(p / 4 / a.width),
          delta: pixelDelta,
        });
    }
    cases.push({
      name: a.name,
      width: a.width,
      height: a.height,
      changedPixels,
      deltaHistogram,
      largestChanges,
      maxChannelDelta,
      meanChannelDelta: totalChannelDelta / ab.length,
      baselineSHA256: createHash('sha256').update(ab).digest('hex'),
      candidateSHA256: createHash('sha256').update(bb).digest('hex'),
    });
    await writeFile(resolve(directory, `${a.name}-baseline.png`), Buffer.from(a.png, 'base64'));
    await writeFile(resolve(directory, `${a.name}-candidate.png`), Buffer.from(b.png, 'base64'));
  }
  const report = {
    browser: browser.version(),
    baselineURL,
    candidateURL,
    scope:
      'Deterministic native software Canvas2D static full quality; decorative signal/jammer effects disabled. This is raster correctness evidence, not device performance evidence.',
    cases,
  };
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  assert.ok(
    cases.every((c) => c.changedPixels === 0),
    'Native Canvas output differs; inspect saved PNGs and report.',
  );
} finally {
  await browser.close();
}
