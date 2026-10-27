#!/usr/bin/env node
/** Author and independently verify exact browser-native complete performances. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { survivalDemoInventory } from '../game/demo-modes/survival-catalog.mjs';
import { SURVIVAL_DEMO_RUNTIME_VARIANTS } from '../game/demo-modes/survival-runtime-variants.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const runtime = args.runtime ?? 'playwright';
const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
const engine = args.browser ?? 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const baseURL = args.url ?? 'http://127.0.0.1:8768';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
const browser = await playwright[engine].launch({
  headless: true,
  ...(args.executable ? { executablePath: args.executable } : {}),
});
const context = await browser.newContext();
const salt = Buffer.from('password-gate-test');
const verifier = pbkdf2Sync('fixture-password', salt, 150000, 32, 'sha256').toString('base64url');
// Ephemeral local testing credential only. Production access metadata is untouched.
await context.route(`${baseURL}/**`, async (route) => {
  if (route.request().resourceType() !== 'document') return route.continue();
  const response = await route.fetch();
  let body = await response.text();
  for (const [name, value] of [
    ['salt', salt.toString('base64url')],
    ['verifier', verifier],
    ['id', 'demo-browser-fixture'],
  ])
    body = body.replace(
      new RegExp(`(name="revealline-access-${name}"\\s+content=")[^"]+`),
      `$1${value}`,
    );
  await route.fulfill({ response, body });
});
const page = await context.newPage();
const reports = [];
try {
  await page.goto(`${baseURL}/game/?journey=legacy`);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.locator('#shell-demo-all').waitFor({ state: 'visible', timeout: 30000 });
  for (const entry of survivalDemoInventory()) {
    const start = performance.now();
    const proof = await page.evaluate(
      async ({ levelId, check, engine }) => {
        const { survivalDemoInventory } = await import('/game/demo-modes/survival-catalog.mjs');
        const { authorSurvivalDemo } = await import('/game/demo-modes/survival-authoring.mjs');
        const { verifySurvivalDemo } = await import('/game/demo-modes/survival-replay.mjs');
        const entry = survivalDemoInventory().find((item) => item.levelId === levelId);
        const proof = check
          ? await (await fetch(`/game/demo-data/survival/${levelId}.${engine}.replay.json`)).json()
          : await authorSurvivalDemo(entry);
        await verifySurvivalDemo(entry, proof);
        return proof;
      },
      { levelId: entry.levelId, check: args.check !== undefined, engine },
    );
    if (args.check === undefined)
      await writeFile(
        new URL(
          `../game/demo-data/survival/${entry.levelId}.${engine}.replay.json`,
          import.meta.url,
        ),
        `${JSON.stringify(proof)}\n`,
      );
    reports.push({
      levelId: entry.levelId,
      outcome: proof.outcome,
      ticks: proof.ticks,
      checkpoints: proof.checkpoints.length,
      summary: proof.summary,
    });
    console.log(
      `${engine}: ${entry.levelId} verified ${proof.outcome} at ${proof.ticks}, ${Math.round(performance.now() - start)}ms`,
    );
  }
  if (args.check === undefined) {
    await writeFile(
      new URL(`../game/demo-data/survival/catalog.${engine}.json`, import.meta.url),
      `${JSON.stringify({ engine, version: browser.version(), entries: reports }, null, 2)}\n`,
    );
    const index = new URL('../game/demo-modes/survival-runtime-variants.mjs', import.meta.url);
    const variants = [...SURVIVAL_DEMO_RUNTIME_VARIANTS];
    if (!variants.includes(engine)) variants.push(engine);
    await writeFile(
      index,
      `// Generated only after complete native authoring and independent verification.\nexport const SURVIVAL_DEMO_RUNTIME_VARIANTS = ${JSON.stringify(variants)};\n`,
    );
  }
} finally {
  await browser.close();
}
console.log(
  `${reports.length}/${survivalDemoInventory().length} ${engine} Survival demonstrations qualified.`,
);
