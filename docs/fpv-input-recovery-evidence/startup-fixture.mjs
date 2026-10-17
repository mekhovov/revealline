/** Local synthetic network failure; no public access gate or credential is used. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { observeFPVStartup } from '../../scripts/smoke-fpv-public-fresh-install.mjs';
const { chromium } = await import(pathToFileURL(process.argv[2]));
const report = { format: 'FpvStartupFailureFixture.v1', generatedAt: new Date().toISOString(), passed: false,
  scope: 'Synthetic local page with a stalled script and a 404; tests diagnostic capture, not the cause of the earlier public timeout.' };
const server = createServer((req, res) => {
  if (req.url.startsWith('/pending.mjs')) return;
  if (req.url.startsWith('/missing.mjs')) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html data-access-state="unlocked" data-mode-shell-pending="true"><script async src="/pending.mjs?omitted=query"></script><script async src="/missing.mjs"></script><script type="text/plain" data-access-type="module"></script><body>Local synthetic startup fixture</body></html>');
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browser = browser.version();
  const page = await browser.newPage();
  await assert.rejects(observeFPVStartup(page, report, 'synthetic-script-stall', async () => {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('[data-mode-action="settings"]'), null, { timeout: 1000 });
  }), /Timeout 1000ms/);
  const startup = report.startups[0];
  assert.equal(startup.passed, false);
  assert.equal(startup.state.access, 'unlocked');
  assert.equal(startup.state.shellPending, true);
  assert.equal(startup.state.inertScriptCount, 1);
  assert.equal(startup.state.settingsPresent, false);
  assert(startup.requests.some(row => row.resource === '/pending.mjs' && row.finishedMs === undefined));
  assert(startup.requests.some(row => row.resource === '/missing.mjs' && row.status === 404));
  assert(!JSON.stringify(startup).includes('omitted=query'));
  report.passed = true;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  report.sources = await Promise.all(['scripts/smoke-fpv-public-fresh-install.mjs', 'docs/fpv-input-recovery-evidence/startup-fixture.mjs'].map(async path => {
    const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  await writeFile('docs/fpv-input-recovery-startup-fixture.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({passed: report.passed, state: report.startups?.[0].state}));
