// Component-only native pointer evidence, never packaged flight qualification.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  fpvObservationDeadline as deadline,
  closeFPVObservationResources,
} from './fpv-observation-artifact.mjs';
import { acquirePointerResource } from './observe-practice-pointer.mjs';

const [playwrightModule, output, ...extra] = process.argv.slice(2);
assert(playwrightModule && output && !extra.length, 'Use external Playwright and new output.');
await mkdir(output);
const source = await readFile(new URL('../game/ui/continuous-play.mjs', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = {
  format: 'ContinuousPlayPointerComponentObservation.v1',
  createdAt: new Date().toISOString(),
  source: { path: 'game/ui/continuous-play.mjs', bytes: source.length, sha256: hash(source) },
  qualified: false,
  completed: false,
  cases: [],
  resourceAcquisitions: [],
  limitations: [
    'Native mouse and keyboard in an isolated result-row component fixture, not actual flight completion or physical touch/controller evidence.',
    'Exact source module is served unchanged; fixture supplies result state and centered/wrapping layout.',
  ],
};
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:16px system-ui;margin:20px;background:#24292b;color:white}
button{font:inherit;min-height:44px;padding:10px}
#actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:8px}
</style></head><body><h1>Result-row component fixture</h1><div id="actions">
<button id="next">Next exercise</button><button id="retry">Retry</button><button id="home">Home</button>
</div><output id="activated">none</output><script type="module">
import {createContinuousPlayController,mountContinuousPlayControls,continuousPlayPreferences} from '/continuous-play.mjs';
const locale=new URL(location).searchParams.get('lang');
if(locale==='uk'){next.textContent='Наступна вправа';retry.textContent='Повторити';home.textContent='Додому'}
const controller=createContinuousPlayController({preferences:continuousPlayPreferences({storage:null,window:null})});
mountContinuousPlayControls({parent:actions,primaryAction:next,controller,locale});
for(const button of [next,retry,home])button.addEventListener('click',()=>activated.textContent=button.id);
controller.subscribe(state=>actions.dataset.phase=state.phase);
controller.begin({identity:'fixture',outcome:'won',canAdvance:true});
document.body.dataset.ready='yes';
</script></body></html>`;
report.observerSha256 = hash(await readFile(new URL(import.meta.url)));
report.fixtureSha256 = hash(Buffer.from(html));
let browser;
const server = createServer((request, response) => {
  if (request.url === '/continuous-play.mjs') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(source);
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(html);
  }
});
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
  browser = await acquirePointerResource(
    report.resourceAcquisitions,
    'browser',
    () => chromium.launch({ channel: 'chrome', headless: true, timeout: 30000 }),
    (value) => value.close(),
    35000,
  );
  report.browser = browser.version();
  for (const width of [1440, 600, 375]) {
    for (const locale of ['en', 'uk']) {
      for (const method of ['pointer', 'release-outside', 'keyboard']) {
        const row = { width, locale, method, passed: false, errors: [] };
        report.cases.push(row);
        const page = await acquirePointerResource(
          report.resourceAcquisitions,
          `${width}-${locale}-${method}-page`,
          () => browser.newPage({ viewport: { width, height: 900 } }),
          (value) => value.close(),
        );
        page.on('pageerror', (error) => row.errors.push(error.message));
        try {
          await page.goto(`http://127.0.0.1:${server.address().port}/?lang=${locale}`);
          await page.locator('body[data-ready="yes"]').waitFor();
          const home = page.locator('#home');
          row.before = await home.boundingBox();
          if (method === 'keyboard') {
            await home.press('Enter');
          } else {
            await page.mouse.move(
              row.before.x + row.before.width / 2,
              row.before.y + row.before.height / 2,
            );
            await page.mouse.down();
            row.afterDown = await home.boundingBox();
            row.phaseAfterDown = await page.locator('#actions').getAttribute('data-phase');
            if (method === 'release-outside') await page.mouse.move(1, 1);
            await page.mouse.up();
          }
          row.activated = await page.locator('#activated').innerText();
          assert.equal(row.activated, method === 'release-outside' ? 'none' : 'home');
          if (method !== 'keyboard') {
            assert.deepEqual(row.afterDown, row.before, 'Pointer-down moved the result target.');
            assert.equal(row.phaseAfterDown, 'cancelled', 'Countdown must cancel immediately.');
          }
          assert.deepEqual(row.errors, []);
          row.passed = true;
        } catch (error) {
          row.failure = error.message;
        } finally {
          try {
            const screenshot = await page.screenshot({ timeout: 5000 });
            const name = `${width}-${locale}-${method}.png`;
            await writeFile(path.join(output, name), screenshot, { flag: 'wx' });
            row.screenshot = { path: name, bytes: screenshot.length, sha256: hash(screenshot) };
          } finally {
            await deadline(page.close(), 5000, 'Page cleanup');
          }
        }
      }
    }
  }
} catch (error) {
  report.failure = error.message;
} finally {
  report.cleanup = await closeFPVObservationResources([
    ...(browser ? [['browser', () => browser.close()]] : []),
    [
      'server',
      () =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections?.();
        }),
    ],
  ]);
  if (report.resourceAcquisitions.some((row) => row.pending || (row.timedOut && !row.lateClosed)))
    report.cleanup.completed = false;
  report.completed =
    !report.failure &&
    report.cleanup.completed &&
    report.cases.length === 18 &&
    report.cases.every((row) => row.passed);
  await writeFile(path.join(output, 'observation.json'), JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
  });
}
console.log(
  JSON.stringify({
    completed: report.completed,
    passed: report.cases.filter((row) => row.passed).length,
    cases: report.cases.length,
  }),
);
if (!report.completed) process.exitCode = 1;
