const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/oleksandr.mekhovov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

// This uses a fresh Playwright browser context, real host controls, and the public
// read-only archive store API. It never attaches to an existing browser, changes
// production modules, replaces clocks, or manufactures accepted simulation ticks.
const base = process.env.FPV_BASE_URL || 'http://127.0.0.1:8768';
const out = path.resolve('docs/evidence/fpv-combat');
const stem = process.env.REPORT_STEM || 'overhaul-archive-host-browser';
const targetTicks = Number(process.env.ACCEPTED_TICKS || 3050);
const expectedDurableTick = Math.floor(targetTicks / 3000) * 3000;
const reportPath = path.join(out, `${stem}.json`);
const report = {
  started: new Date().toISOString(),
  scope: 'Isolated Chrome context; native stadium hunting; real accepted simulation and IndexedDB; host export, resume, close, saved/file Watch, Continue. No performance qualification.',
  targetTicks,
  fullMinuteCapture: targetTicks >= 3000,
  pageErrors: [],
  consoleErrors: [],
  failedResponses: [],
  checkpoints: [],
};
let browser;
let page;
const writeReport = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));
const mark = async (name, extra = {}) => {
  const state = await page.evaluate(() => {
    const s = fpvWorldStudio.snapshot();
    return {
      course: s.course,
      ticks: s.state?.ticks,
      status: s.state?.status,
      position: s.state?.position,
      encounterTicks: s.state?.encounter?.ticks,
      runId: s.state?.encounter?.runId,
      kills: s.state?.encounter?.kills,
      shots: s.state?.encounter?.shots,
      recording: s.state?.combatRecording,
      archive: s.combatArchive,
      playback: s.combatPlayback,
      mode: document.getElementById('flight-mode').value,
      statusText: document.getElementById('flight-status').textContent,
      archiveText: document.querySelector('[data-combat-archives] [role=status]')?.textContent,
      dialogOpen: document.getElementById('flight-dialog').open,
      otherDialogs: [...document.querySelectorAll('dialog[open]:not(#flight-dialog)')].map((d) => d.id),
    };
  });
  report.checkpoints.push({ name, at: new Date().toISOString(), ...state, ...extra });
  await writeReport();
  console.log(JSON.stringify({ name, ticks: state.ticks, archive: state.archive?.state, playback: state.playback?.cursor }));
  return state;
};
const button = (name) => page.getByRole('button', { name, exact: true });
const closeSettings = async () => {
  for (let i = 0; i < 4 && await page.locator('#sim-settings').evaluate((e) => e.open); i++)
    await page.keyboard.press('Escape');
};
const openArchives = async () => {
  if (!await page.locator('#sim-settings').evaluate((e) => e.open)) {
    if (!await button('Settings').isVisible()) {
      await page.locator('#world-viewport').focus();
      await page.keyboard.press('KeyP');
    }
    await button('Settings').click();
  }
  await page.getByRole('tab', { name: 'Gameplay', exact: true }).click();
  const details = page.locator('[data-combat-archives]');
  if (!await details.evaluate((e) => e.open)) await details.locator('summary').click();
  await button('Refresh saved recordings').click();
};
const listArchives = () =>
  page.evaluate(async () => {
    const { createEncounterArchiveStore } = await import('/optional-practice/civilian-fpv/encounter-session.mjs');
    const store = createEncounterArchiveStore({ indexedDB });
    try {
      return await store.list();
    } finally {
      store.close();
    }
  });
const start = (mode = 'self-level') =>
  page.evaluate(async (mode) => {
    const { WORLD_CATALOGUE } = await import('/optional-practice/civilian-fpv/world-catalogue.mjs');
    await fpvWorldStudio.startFlight(WORLD_CATALOGUE.find((e) => e.id === 'stadium-01'), {
      mode,
      paused: true,
      encounter: {
        version: 2, activity: 'hunting', difficulty: 'normal', population: 12,
        loadout: ['autocannon', 'rocket'], payload: 'bomb', ammoPreset: 'balanced',
        playerDamage: 'invulnerable', enemyDamage: 'one-hit', seed: 101,
      },
    });
  }, mode);
const arm = async () => {
  await closeSettings();
  if (await page.locator('#worlds-shell-action-pause-resume').isVisible())
    await page.locator('#worlds-shell-action-pause-resume').click();
  else await page.locator('#world-flight-resume').click();
};
const hover = () =>
  page.evaluate(() => {
    let held = null;
    window.__archiveProbePilot = setInterval(() => {
      const s = fpvWorldStudio.snapshot().state;
      if (s?.status !== 'active') return;
      const target = 2.5;
      const desired = Math.max(.12, Math.min(.85, .5 + (target - s.position.y / 1000) * .09 - s.velocity.y / 1000 * .13));
      const throttle = s.lastInput?.throttle / 1000 || 0;
      const next = desired > throttle + .018 ? 'KeyW' : desired < throttle - .018 ? 'KeyS' : null;
      if (held !== next) {
        if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: held, key: held === 'KeyW' ? 'w' : 's', bubbles: true }));
        held = next;
        if (held) window.dispatchEvent(new KeyboardEvent('keydown', { code: held, key: held === 'KeyW' ? 'w' : 's', bubbles: true }));
      }
    }, 100);
  });
const pause = async () => {
  await page.evaluate(() => {
    clearInterval(window.__archiveProbePilot);
    for (const code of ['KeyW', 'KeyS']) window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'KeyW' ? 'w' : 's', bubbles: true }));
    fpvWorldStudio.pause();
  });
};
async function waitTicks(ticks, timeout = 100000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => fpvWorldStudio.snapshot().state);
    if (s.ticks >= ticks) return;
    assert.equal(s.status, 'active', 'Flight stopped before target accepted tick');
    await page.waitForTimeout(Math.max(250, Math.min(10000, deadline - Date.now(), (ticks - s.ticks) * 20 + 100)));
    await mark('minute-progress');
  }
  throw new Error(`Timed out reaching accepted tick ${ticks}`);
}
async function waitVerified(name, expectedTick) {
  const deadline = Date.now() + 110000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => fpvWorldStudio.snapshot());
    if (s.combatPlayback?.error) throw new Error(s.combatPlayback.error);
    if (s.combatPlayback?.verified) {
      assert.equal(s.state.ticks, expectedTick);
      return mark(name);
    }
    await page.waitForTimeout(10000);
    await mark(`${name}-progress`);
  }
  throw new Error(`Timed out waiting for ${name}`);
}
async function closeFlight() {
  await closeSettings();
  await page.evaluate(() => document.getElementById('leave-flight').click());
  await page.waitForFunction(() => !document.getElementById('flight-dialog').open);
  assert.equal((await page.evaluate(() => fpvWorldStudio.snapshot())).state, undefined);
}
const saveDownload = async (action, name) => {
  const pending = page.waitForEvent('download', { timeout: 30000 });
  await action();
  const download = await pending;
  const filename = path.join(out, name);
  await download.saveAs(filename);
  const bytes = await fs.readFile(filename);
  return { filename, bytes, packet: JSON.parse(bytes.toString()), suggestedFilename: download.suggestedFilename() };
};
(async () => {
  try {
    await fs.mkdir(out, { recursive: true });
    const prior = await fs.readFile(path.join(out, 'overhaul-app-replay.cjs'), 'utf8');
    const accessToken = process.env.FPV_ACCESS_TOKEN || prior.match(/localStorage\.setItem\('revealline\.access\.revealline\.v1','([^']+)'/)[1];
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: [
        '--disable-component-update', '--disable-background-networking',
        '--disk-cache-size=1048576', '--media-cache-size=1048576',
      ],
    });
    report.browser = browser.version();
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', (e) => report.pageErrors.push(e.stack));
    page.on('console', (m) => {
      if (m.type() === 'error' && report.consoleErrors.length < 30)
        report.consoleErrors.push({ message: m.text(), location: m.location() });
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && report.failedResponses.length < 30) report.failedResponses.push({ status: r.status(), url: r.url() });
    });
    await page.addInitScript((token) => localStorage.setItem('revealline.access.revealline.v1', token), accessToken);
    await page.goto(`${base}/optional-practice/fpv-worlds/index.html?lang=en`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => globalThis.fpvWorldStudio);
    await page.evaluate(() => fpvWorldStudio.ready);
    report.sources = {};
    for (const file of ['world-app.mjs', 'encounter-session.mjs', 'aircraft-archive.mjs']) {
      const served = await page.request.get(`${base}/optional-practice/civilian-fpv/${file}`);
      report.sources[file] = {
        servedSha256: crypto.createHash('sha256').update(await served.body()).digest('hex'),
        workspaceSha256: crypto.createHash('sha256').update(await fs.readFile(`optional-practice/civilian-fpv/${file}`)).digest('hex'),
      };
    }
    assert.deepEqual(await listArchives(), [], 'Fresh browser context should have no prior archives');
    if (process.env.FOLLOWUP_PACKAGE) {
      report.scope = 'Isolated Chrome with component updates/background networking disabled and 1 MiB disk/media caches; import existing real-minute archive, verify playback, Continue and export continued complete chain. No new minute capture or performance qualification.';
      report.fullMinuteCapture = false;
      report.importedFullMinute = true;
      report.continueOnly = process.env.FOLLOWUP_CONTINUE_ONLY === '1';
      if (report.continueOnly) {
        report.scope = 'Isolated Chrome with component updates/background networking disabled and 1 MiB disk/media caches; Continue an existing real-minute archive, advance, export the preserved complete history and close. No new capture minute, replay repetition, or performance qualification.';
        for (const source of Object.values(report.sources))
          assert.equal(source.servedSha256, source.workspaceSha256);
      }
      let bytes = await fs.readFile(process.env.FOLLOWUP_PACKAGE);
      if (process.env.FOLLOWUP_PACKAGE.endsWith('.gz')) bytes = zlib.gunzipSync(bytes);
      const packet = JSON.parse(bytes.toString());
      const upload = { name: 'combat-full-minute.json', mimeType: 'application/json', buffer: bytes };
      const inspected = await page.evaluate(async (packet) => {
        const { inspectEncounterArchive } = await import('/optional-practice/civilian-fpv/encounter-session.mjs');
        const { recovery, summary } = inspectEncounterArchive(packet);
        return { recovery, summary };
      }, packet);
      report.import = {
        file: process.env.FOLLOWUP_PACKAGE, bytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        summary: inspected.summary, launch: inspected.recovery.launch,
      };
      if (!report.continueOnly) {
        await start('acro');
        await openArchives();
        await page.locator('[data-encounter-controls] input[type=file]').nth(1).setInputFiles(upload);
        await page.waitForFunction(() => !!fpvWorldStudio.snapshot().combatPlayback);
        assert.equal(await page.locator('#sim-settings').evaluate((e) => e.open), false);
        assert.equal(await page.locator('#flight-mode').inputValue(), inspected.recovery.launch.mode);
        await waitVerified('full-minute-file-verified', inspected.summary.to);
        await closeFlight();
      }
      if (process.env.CONTINUE_GATE) {
        console.log('AWAIT CONTINUE RUNTIME CONFIRMATION');
        const deadline = Date.now() + 180000;
        let ready = false;
        while (Date.now() < deadline) {
          try {
            await fs.access(process.env.CONTINUE_GATE);
            ready = true;
            break;
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        assert(ready, 'Continue runtime confirmation did not arrive within three minutes');
        // Load the confirmed staged runtime instead of retaining old ES modules.
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForFunction(() => globalThis.fpvWorldStudio);
        await page.evaluate(() => fpvWorldStudio.ready);
        report.continueSources = {};
        for (const file of ['world-app.mjs', 'encounter-session.mjs', 'aircraft-archive.mjs']) {
          const served = await page.request.get(`${base}/optional-practice/civilian-fpv/${file}`);
          report.continueSources[file] = {
            servedSha256: crypto.createHash('sha256').update(await served.body()).digest('hex'),
            workspaceSha256: crypto.createHash('sha256').update(await fs.readFile(`optional-practice/civilian-fpv/${file}`)).digest('hex'),
          };
          assert.equal(report.continueSources[file].servedSha256, report.continueSources[file].workspaceSha256);
        }
      }
      await start('acro');
      await openArchives();
      await page.locator('[data-encounter-controls] input[type=file]').first().setInputFiles(upload);
      await page.waitForFunction((tick) => {
        const s = fpvWorldStudio.snapshot();
        return !s.combatPlayback && s.state?.status === 'paused' && s.state.ticks === tick;
      }, inspected.summary.to, { timeout: 60000 });
      const restored = await mark('full-minute-continue-restored');
      assert.deepEqual(restored.otherDialogs, []);
      assert.equal(restored.mode, inspected.recovery.launch.mode);
      assert.equal(restored.runId, packet.manifest.config.runId);
      assert.deepEqual(restored.position, inspected.recovery.gameplay.physical.state.position);
      await page.waitForFunction(() => fpvWorldStudio.snapshot().combatArchive?.durableTo >= 3000);
      await arm();
      await hover();
      await waitTicks(restored.ticks + 50, 15000);
      await pause();
      const advanced = await mark('full-minute-continue-advanced');
      assert.equal(advanced.archive.state, 'recording');
      assert.equal(advanced.archive.error, null);
      await openArchives();
      const continued = await saveDownload(
        () => button('Export current recording').click(),
        `${stem}-continued.json`,
      );
      const continuedSummary = await page.evaluate(async (packet) => {
        const { inspectEncounterArchive } = await import('/optional-practice/civilian-fpv/encounter-session.mjs');
        return inspectEncounterArchive(packet).summary;
      }, continued.packet);
      assert.equal(continuedSummary.to, advanced.ticks);
      assert.equal(continued.packet.segments[0].record.segment.from, 0);
      assert.equal(continued.packet.segments[0].record.segment.to, 3000);
      assert.deepEqual(
        continued.packet.segments[0].record.segment,
        packet.segments[0].record.segment,
        'Continued archive must preserve the original sealed minute exactly',
      );
      const originalPartial = inspected.recovery.gameplay.recording.frames;
      assert.deepEqual(
        continued.packet.segments.at(-1).record.recovery.gameplay.recording.frames.slice(0, originalPartial.length),
        originalPartial,
        'Continued archive must preserve the original partial minute exactly',
      );
      report.continuedExport = {
        bytes: continued.bytes.length, summary: continuedSummary,
        originalSealedTicks: 3000, originalPartialTicks: originalPartial.length,
        originalPrefixMatches: true,
      };
      await fs.writeFile(`${continued.filename}.gz`, zlib.gzipSync(continued.bytes));
      await fs.unlink(continued.filename);
      await page.screenshot({ path: path.join(out, `${stem}.png`) });
      await closeFlight();
      report.closedRows = await listArchives();
      assert(report.closedRows.some((r) => r.state === 'ended' && r.endTick === advanced.ticks));
      assert.deepEqual(report.pageErrors, []);
      report.passed = true;
      return;
    }
    await start();
    await openArchives();
    await arm();
    await pause();
    await openArchives();
    await arm();
    await hover();
    await mark('started');
    await waitTicks(targetTicks);
    await pause();
    await page.waitForFunction((expected) => fpvWorldStudio.snapshot().combatArchive?.durableTo >= expected, expectedDurableTick);
    await openArchives();
    report.minuteRows = await listArchives();
    assert.equal(report.minuteRows.length, 1);
    assert.equal(report.minuteRows[0].state, 'open');
    assert.equal(report.minuteRows[0].endTick, expectedDurableTick);
    const beforeExport = await mark('minute-durable');
    const current = await saveDownload(() => button('Export current recording').click(), `${stem}-current.json`);
    const inspected = await page.evaluate(async (packet) => {
      const { inspectEncounterArchive } = await import('/optional-practice/civilian-fpv/encounter-session.mjs');
      const { recovery, summary } = inspectEncounterArchive(packet);
      return { recovery, summary };
    }, current.packet);
    report.export = {
      bytes: current.bytes.length, suggestedFilename: current.suggestedFilename,
      summary: inspected.summary, launch: inspected.recovery.launch,
      baseIdentity: inspected.recovery.gameplay.identity.base,
      finalSession: inspected.recovery.gameplay.session,
    };
    assert.equal(inspected.summary.to, beforeExport.ticks);
    assert.equal(inspected.recovery.launch.mode, 'self-level');
    assert.equal(inspected.recovery.gameplay.identity.base.mode, 'self-level');
    assert.equal((await mark('exported-current')).archive.state, 'recording');
    assert.equal((await listArchives())[0].state, 'open', 'Export should not finish durable archive');
    await arm();
    await hover();
    await waitTicks(beforeExport.ticks + 100, 20000);
    await pause();
    const continued = await mark('continued-after-export');
    assert(continued.ticks > beforeExport.ticks);
    assert.equal(continued.runId, beforeExport.runId);
    await closeFlight();
    report.closedRows = await listArchives();
    const finished = report.closedRows.find((r) => r.id === report.minuteRows[0].id);
    assert.equal(finished.state, 'ended');
    assert.equal(finished.endTick, continued.ticks);
    await mark('closed-and-saved');
    await start('acro');
    await openArchives();
    await page.getByRole('combobox', { name: 'Saved combat recording', exact: true }).selectOption(finished.id);
    await button('Watch selected recording').click();
    await page.waitForFunction(() => !!fpvWorldStudio.snapshot().combatPlayback);
    assert.equal(await page.locator('#sim-settings').evaluate((e) => e.open), false, 'Watch selected should close Settings before playback');
    assert.equal(await page.locator('#flight-mode').inputValue(), 'self-level');
    await waitVerified('watch-selected-verified', finished.endTick);
    await closeFlight();
    await mark('closed-playback');
    await start('acro');
    await openArchives();
    await page.locator('[data-encounter-controls] input[type=file]').nth(1).setInputFiles(current.filename);
    await page.waitForFunction(() => !!fpvWorldStudio.snapshot().combatPlayback);
    assert.equal(await page.locator('#sim-settings').evaluate((e) => e.open), false, 'Watch file should close Settings before playback');
    assert.equal(await page.locator('#flight-mode').inputValue(), 'self-level');
    await waitVerified('watch-file-verified', inspected.summary.to);
    await closeFlight();
    await start('acro');
    await openArchives();
    await page.locator('[data-encounter-controls] input[type=file]').first().setInputFiles(current.filename);
    await page.waitForFunction((expected) => {
      const s = fpvWorldStudio.snapshot();
      return !s.combatPlayback && s.state?.status === 'paused' && s.state.ticks === expected;
    }, inspected.summary.to, { timeout: 60000 });
    const restored = await mark('continue-file-restored');
    assert.deepEqual(restored.otherDialogs, [], 'Continue should return to the paused flight');
    assert.equal(restored.mode, 'self-level');
    assert.equal(restored.runId, beforeExport.runId);
    assert.deepEqual(restored.position, beforeExport.position);
    await arm();
    await hover();
    await waitTicks(restored.ticks + 50, 15000);
    await pause();
    await mark('continue-file-advanced');
    await openArchives();
    await page.screenshot({ path: path.join(out, `${stem}.png`) });
    await closeFlight();
    assert.deepEqual(report.pageErrors, []);
    await fs.writeFile(`${current.filename}.gz`, zlib.gzipSync(current.bytes));
    await fs.unlink(current.filename);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack;
    process.exitCode = 1;
    if (page && !page.isClosed()) {
      try {
        report.failureUI = await page.evaluate(() => ({
          flight: document.getElementById('flight-status')?.textContent,
          studio: document.getElementById('studio-status')?.textContent,
          body: document.body.innerText.slice(-15000),
        }));
        await page.screenshot({ path: path.join(out, `${stem}-failure.png`) });
      } catch {}
    }
    console.error(error.stack);
  } finally {
    if (browser) await browser.close();
    report.finished = new Date().toISOString();
    report.browserClosed = true;
    await writeReport();
    console.log(JSON.stringify({ passed: report.passed, failure: report.failure, pageErrors: report.pageErrors, browserClosed: report.browserClosed }));
  }
})();
