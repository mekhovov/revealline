/* global document */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json' };

/** Real WebGL preparation regression, without an access-controlled app entry or flight model. */
export async function smokeRegionalRenderer({ playwrightModule, output } = {}) {
  const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
  const sources = {},
    errors = [],
    missing = [],
    changedDuringRun = new Set();
  const pin = (name, bytes) => {
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (sources[name] && sources[name] !== hash) changedDuringRun.add(name);
    else if (!sources[name]) sources[name] = hash;
  };
  pin('scripts/smoke-fpv-regional-renderer.mjs', await readFile(fileURLToPath(import.meta.url)));
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1);
      if (!name) {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(
          '<!doctype html><title>TEST FIXTURE · Regional renderer</title><canvas width="320" height="240" style="width:320px;height:240px"></canvas>',
        );
        return;
      }
      const filename = path.resolve(root, name);
      if (
        !filename.startsWith(root) ||
        name.split('/').some((part) => part.startsWith('.')) ||
        !mime[path.extname(name)]
      ) {
        response.writeHead(404).end();
        return;
      }
      const bytes = await readFile(filename);
      pin(name, bytes);
      response.writeHead(200, {
        'Content-Type': mime[path.extname(name)],
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      missing.push(request.url);
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const probe = await page.evaluate(async () => {
      const THREE = await import('/optional-practice/civilian-fpv/vendor/three.module.js');
      const { createFlightRenderer } = await import('/optional-practice/civilian-fpv/renderer.mjs');
      const canvas = document.querySelector('canvas');
      const renderer = createFlightRenderer({ canvas });
      if (!renderer.available) throw new Error('Real WebGL renderer unavailable');
      const gl = canvas.getContext('webgl2');
      const drawErrors = [],
        cases = [];
      let phase = 'setup',
        drawCalls = 0;
      const drawElements = gl.drawElements.bind(gl);
      gl.drawElements = (...args) => {
        drawElements(...args);
        drawCalls++;
        const error = gl.getError();
        if (error !== gl.NO_ERROR) drawErrors.push({ phase, error });
      };
      const session = { root: new THREE.Group() };
      renderer.setRegional(session, {
        grid: { cellSizeMm: 128000 },
        chunks: [{ id: 'probe', x: 0, z: 0 }],
      });
      const geometry = new THREE.BoxGeometry(8, 1, 8);
      const material = new THREE.MeshStandardMaterial({ color: 0x568234 });
      const state = {
        originMm: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 2000, z: 4000 },
        orientation: [0, 0, 0, 1000000],
        ticks: 0,
        terrain: { provenance: { chunks: [{ chunkId: 'probe' }] } },
      };
      const camera = { cameraMode: 'overview', cameraFov: 82, cameraTilt: 0 };
      let admitted = null;
      async function prepare(label, quality) {
        phase = label;
        renderer.setQuality(quality);
        const group = new THREE.Group(),
          mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        group.add(mesh);
        const before = drawCalls;
        await renderer.prepareRegionalFrame(group);
        const receipt = renderer.regionalPreparation();
        if (receipt.status !== 'prepared' || drawCalls === before)
          throw new Error('Preparation did not upload geometry');
        cases.push({ phase, receipt, drawCalls: drawCalls - before });
        admitted?.removeFromParent();
        admitted = group;
        session.root.add(group);
        phase = `${label}:visible`;
        if (!renderer.draw(state, camera)) throw new Error('Visible Regional frame failed');
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const first = pixels.slice(0, 4);
        let differentPixels = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] !== first[0] || pixels[i + 1] !== first[1] || pixels[i + 2] !== first[2])
            differentPixels++;
        const error = gl.getError();
        if (error !== gl.NO_ERROR) drawErrors.push({ phase, error });
        if (differentPixels < 100) throw new Error('Visible frame contains no rendered terrain');
        cases.push({ phase, differentPixels });
      }
      try {
        await prepare('cold-balanced', 'balanced');
        await prepare('warm-balanced', 'balanced');
        await prepare('resize-high', 'high');
        await prepare('no-shadows-low', 'low');
        await prepare('restore-balanced', 'balanced');
        return { webgl: gl.getParameter(gl.VERSION), drawCalls, drawErrors, cases };
      } finally {
        renderer.dispose();
        geometry.dispose();
        material.dispose();
      }
    });
    const finalSources = {};
    for (const name of Object.keys(sources)) {
      const bytes = await readFile(path.join(root, name));
      finalSources[name] = createHash('sha256').update(bytes).digest('hex');
      pin(name, bytes);
    }
    const report = {
      format: 'FpvRegionalRendererSmoke.v1',
      browser: await browser.version(),
      passed:
        !errors.length && !missing.length && !probe.drawErrors.length && !changedDuringRun.size,
      errors,
      missing,
      ...probe,
      sources,
      finalSources,
      changedDuringRun: [...changedDuringRun],
    };
    if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    if (!report.passed)
      throw new Error(`Regional WebGL preparation failed: ${JSON.stringify(probe.drawErrors)}`);
    return report;
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = { '--playwright': 'playwrightModule', '--output': 'output' }[process.argv[i]];
    if (!key || !process.argv[i + 1]) throw new Error('Usage: --playwright MODULE [--output FILE]');
    options[key] = process.argv[i + 1];
  }
  const result = await smokeRegionalRenderer(options);
  console.log(
    JSON.stringify({
      passed: result.passed,
      browser: result.browser,
      drawCalls: result.drawCalls,
      cases: result.cases.length,
    }),
  );
}
