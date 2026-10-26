const { chromium } = require('/Users/oleksandr.mekhovov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), crypto = require('node:crypto');
const out = process.cwd() + '/docs/evidence/fpv-combat';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-component-update', '--disable-background-networking'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const report = { started: new Date().toISOString(), sources: {}, errors: [], consoleErrors: [], failedResources: [], attempts: [],
    scope: 'Three full-app Realistic Survival attempts with scripted hover, no player firing, invulnerability. Renderer resource/heap snapshots are leak diagnostics, not garbage-collection proof or human/radio acceptance.' };
  page.on('pageerror', error => report.errors.push(error.stack));
  page.on('response', response => { if (response.status() >= 400) report.failedResources.push({ url: response.url(), status: response.status() }); });
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 1000)); });
  for (const file of ['world-app.mjs', 'world-reaction-runtime.mjs', 'renderer.mjs', 'combat-actors.mjs']) report.sources[file] = crypto.createHash('sha256').update(await fs.readFile('optional-practice/civilian-fpv/' + file)).digest('hex');
  const snapshot = () => page.evaluate(() => {
    const s = fpvWorldStudio.snapshot(), e = s.state?.encounter;
    return { status: s.state?.status, ticks: e?.ticks, active: e?.actors.filter(a => a.status === 'active').length,
      art: s.combatArt, renderer: s.ghost.resources?.renderer, actors: s.ghost.resources?.combatActors,
      effects: s.ghost.resources?.combat, heap: performance.memory?.usedJSHeapSize,
      projectiles: (e?.projectiles ?? []).map(p => ({ weapon: p.weapon, owner: p.owner, position: p.position })) };
  });
  try {
    await page.addInitScript(() => localStorage.setItem('revealline.access.revealline.v1', 'fD62nYJ5uj8yGLsEBEAn2Blq8lcesFrR_gdebUswlxg'));
    await page.goto('http://127.0.0.1:8768/optional-practice/fpv-worlds/index.html?lang=en', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => globalThis.fpvWorldStudio); await page.evaluate(() => fpvWorldStudio.ready);
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(async seed => {
        const { WORLD_CATALOGUE } = await import('/optional-practice/civilian-fpv/world-catalogue.mjs');
        await fpvWorldStudio.startFlight(WORLD_CATALOGUE.find(item => item.id === 'stadium-01'), {
          mode: 'self-level', paused: true, encounter: { version: 2, activity: 'survival', difficulty: 'normal',
            population: 128, loadout: ['autocannon', 'rocket'], payload: 'bomb', ammoPreset: 'balanced',
            playerDamage: 'invulnerable', enemyDamage: 'normal', survivalMode: 'endless', seed } });
        const quality = document.getElementById('flight-quality'); quality.value = 'high'; quality.dispatchEvent(new Event('change', { bubbles: true }));
      }, 101 + attempt);
      if (attempt === 0) {
        console.log('DOWNLOADING REALISTIC ART');
        await page.evaluate(() => [...document.querySelectorAll('[data-combat-art] button')].find(button => button.textContent.startsWith('Download realistic')).click());
        await page.waitForFunction(() => fpvWorldStudio.snapshot().combatArt.installed, null, { timeout: 120000 });
        await page.evaluate(() => { const select = document.querySelector('[data-combat-art-select]'); select.value = 'realistic'; select.dispatchEvent(new Event('change', { bubbles: true })); });
      }
      await page.waitForFunction(() => fpvWorldStudio.snapshot().combatArt.active === 'realistic', null, { timeout: 120000 });
      console.log('REALISTIC ATTEMPT ' + (attempt + 1));
      const row = { attempt, prepared: await snapshot(), samples: [] };
      await page.evaluate(() => {
        document.getElementById('world-arm').click(); let held = null;
        window.__lifePilot = setInterval(() => {
          const s = fpvWorldStudio.snapshot().state; if (s.status !== 'active') return;
          const target = Math.max(.12, Math.min(.85, .5 + (2 - s.position.y / 1000) * .09 - s.velocity.y / 1000 * .13));
          const throttle = s.lastInput.throttle / 1000, next = target > throttle + .018 ? 'KeyW' : target < throttle - .018 ? 'KeyS' : null;
          if (next !== held) { if (held) window.dispatchEvent(new KeyboardEvent('keyup', { code: held, bubbles: true })); held = next; if (held) window.dispatchEvent(new KeyboardEvent('keydown', { code: held, bubbles: true })); }
        }, 100);
      });
      for (let sample = 0; sample < 20; sample++) { await page.waitForTimeout(2000); row.samples.push(await snapshot()); }
      await page.evaluate(() => { clearInterval(__lifePilot); for (const code of ['KeyW', 'KeyS']) window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); fpvWorldStudio.pause(); });
      row.end = await snapshot(); await page.screenshot({ path: `${out}/overhaul-app-realistic-attempt-${attempt + 1}.png` });
      await page.evaluate(() => document.getElementById('leave-flight').click()); await page.waitForTimeout(1000); row.closed = await snapshot();
      report.attempts.push(row); await fs.writeFile(out + '/overhaul-app-lifecycle.json', JSON.stringify(report, null, 2));
      console.log('ATTEMPT COMPLETE ' + (attempt + 1));
    }
  } catch (error) { report.failure = error.stack; report.failureState = await page.evaluate(() => ({ art: globalThis.fpvWorldStudio?.snapshot().combatArt, status: document.getElementById('flight-status')?.textContent, artStatus: document.querySelector('[data-combat-art] [role=status]')?.textContent })).catch(() => null); console.error(error); }
  finally { report.finished = new Date().toISOString(); await fs.writeFile(out + '/overhaul-app-lifecycle.json', JSON.stringify(report, null, 2)); await browser.close(); }
})();
