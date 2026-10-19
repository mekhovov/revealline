#!/usr/bin/env node
/** Read-only native admission using the same candidate resolution as the demo host. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { survivalDemoInventory } from '../game/demo-modes/survival-catalog.mjs';
import { createSurvivalDemoAdapter } from '../game/demo-modes/survival.mjs';
import { SURVIVAL_DEMO_RUNTIME_VARIANTS } from '../game/demo-modes/survival-runtime-variants.mjs';
import { SURVIVAL_DEMO_SIMULATION_IDENTITY } from '../game/demo-modes/survival-simulation-identity.mjs';

const sha256 = (body) => createHash('sha256').update(body).digest('hex');
const root = fileURLToPath(new URL('..', import.meta.url));

/** Resolve a committed recording through production admission; always retire its player. */
export async function resolveNativeSurvivalRecording(entry, { signal, reportPreparation } = {}) {
  const required = survivalDemoInventory().find((row) => row.id === entry?.id);
  if (!required || required.levelId !== entry.levelId || required.variantId !== entry.variantId)
    throw new TypeError('Native Survival admission requires an authored standard entry.');
  const attempts = [];
  let payload, variant, player;
  const adapter = createSurvivalDemoAdapter({
    engineHint: null,
    fetch: async (url, { signal: fetchSignal } = {}) => {
      try {
        const body = await readFile(url, { encoding: 'utf8', signal: fetchSignal });
        payload = { body, replayURL: url.href };
        return { ok: true, text: async () => body };
      } catch (error) {
        if (error.code === 'ENOENT') return { ok: false };
        throw error;
      }
    },
  });
  const source = adapter.enumerateSources().find((row) => row.id === required.id);
  try {
    player = await source.create({
      signal,
      reportPreparation(stage, details) {
        if (stage === 'candidate') {
          variant = details.variant;
          attempts.push({ variant });
        } else if (stage === 'candidate-failed') attempts.at(-1).failureCode = details.code;
        else if (stage === 'candidate-verified') attempts.at(-1).verified = true;
        reportPreparation?.(stage, details);
      },
    });
    assert.equal(player.phase, 'paused');
    assert.equal(player.state.tick, 0);
    assert.ok(payload && attempts.at(-1)?.verified);
    assert.ok(attempts.length <= SURVIVAL_DEMO_RUNTIME_VARIANTS.length + 1);
    return {
      source,
      recording: JSON.parse(payload.body),
      replayURL: payload.replayURL,
      recordingSHA256: sha256(payload.body),
      variant,
      attempts,
    };
  } catch (error) {
    error.nativeSurvivalAttempts = attempts;
    throw error;
  } finally {
    await player?.dispose();
  }
}

async function main(argv) {
  const args = new Map();
  for (const item of argv) {
    const match = /^--(out|timeout-ms)=(.+)$/.exec(item);
    if (!match || args.has(match[1]))
      throw new TypeError('Use --out=path and --timeout-ms=300000.');
    args.set(match[1], match[2]);
  }
  const timeoutMs = Number(args.get('timeout-ms') ?? 300000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 900000)
    throw new RangeError('Native admission timeout must be 1000–900000ms.');
  const output = resolve(args.get('out') ?? '.cache/survival-native-qualification.json');
  try {
    await stat(output);
    throw new Error('Refusing to replace an existing native admission receipt.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const started = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);
  const report = {
    format: 'SurvivalNativeQualificationV1',
    complete: false,
    started: new Date().toISOString(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 65536,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    }).trim(),
    environment: {
      node: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      arch: process.arch,
    },
    simulationIdentity: SURVIVAL_DEMO_SIMULATION_IDENTITY,
    timeoutMs,
    qualification:
      'Production candidate resolution performs full independent native replay, terminal outcome and meaningful-progress verification before returning a paused player. No renderer, persistence, capture, generation or adoption.',
    checks: [],
  };
  const inventory = survivalDemoInventory();
  try {
    for (const entry of inventory) {
      let selected;
      const itemStarted = performance.now();
      console.log(JSON.stringify({ stage: 'source-started', id: entry.id }));
      try {
        selected = await resolveNativeSurvivalRecording(entry, { signal });
        const { recording } = selected;
        assert.ok(['won', 'lost'].includes(recording.outcome));
        assert.ok(
          recording.summary.stats.kills > 0 &&
            recording.summary.stats.xpCollected > 0 &&
            recording.summary.stats.upgradesChosen > 0,
        );
        report.checks.push({
          id: entry.id,
          verified: true,
          variant: selected.variant,
          replayFile: fileURLToPath(selected.replayURL).slice(root.length),
          recordingSHA256: selected.recordingSHA256,
          contentIdentity: recording.contentIdentity,
          ticks: recording.ticks,
          outcome: recording.outcome,
          checkpoints: recording.checkpoints.length,
          progress: {
            kills: recording.summary.stats.kills,
            xpCollected: recording.summary.stats.xpCollected,
            upgrades: recording.summary.stats.upgradesChosen,
            rerolls: recording.summary.stats.rerollsUsed,
          },
          attempts: selected.attempts,
          elapsedMs: performance.now() - itemStarted,
        });
      } catch (error) {
        report.checks.push({
          id: entry.id,
          verified: false,
          attempts: error.nativeSurvivalAttempts ?? [],
          error: { name: error.name, message: error.message, code: error.code, tick: error.tick },
          elapsedMs: performance.now() - itemStarted,
        });
      }
      const result = report.checks.at(-1);
      console.log(
        JSON.stringify({
          stage: 'source-finished',
          id: entry.id,
          verified: result.verified,
          variant: result.variant,
          errorCode: result.error?.code,
          tick: result.error?.tick,
          elapsedMs: result.elapsedMs,
        }),
      );
      if (signal.aborted) break;
    }
    report.complete =
      report.checks.length === inventory.length &&
      report.checks.every((row) => row.verified) &&
      performance.now() - started < timeoutMs;
  } catch (error) {
    report.failure = { name: error.name, message: error.message };
  }
  report.counts = {
    required: inventory.length,
    checked: report.checks.length,
    verified: report.checks.filter((row) => row.verified).length,
  };
  report.elapsedMs = performance.now() - started;
  report.finished = new Date().toISOString();
  const body = JSON.stringify(report, null, 2) + '\n';
  assert.ok(
    Buffer.byteLength(body) <= 256 * 1024,
    'Native admission receipt exceeds its fixed budget.',
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, body, { flag: 'wx' });
  console.log(JSON.stringify({ output, complete: report.complete, counts: report.counts }));
  if (!report.complete) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main(process.argv.slice(2));
