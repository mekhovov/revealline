import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pagesSmokePlan, encodePagesReport, redactPagesText } from './solo-pages-smoke.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function validatePagesDispatch(env, expected, node = process.versions.node) {
  assert.equal(env.GITHUB_REPOSITORY, 'mekhovov/revealline');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REF, 'refs/heads/main');
  assert.match(expected, /^[a-f0-9]{40}$/);
  assert.equal(env.GITHUB_SHA, expected);
  assert.equal(node, '22.13.1');
  assert(['chromium', 'webkit'].includes(env.PAGES_SMOKE_ENGINE), 'Fixed browser engine required');
  assert(
    typeof env.REVEALLINE_PAGES_TEST_PASSWORD === 'string' &&
      env.REVEALLINE_PAGES_TEST_PASSWORD.length > 0 &&
      env.REVEALLINE_PAGES_TEST_PASSWORD.length <= 512 &&
      !env.REVEALLINE_PAGES_TEST_PASSWORD.includes('\0'),
    'Protected Pages credential required',
  );
}
export function pagesSourceIdentity(expected) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: repository,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    }).trim();
  assert.equal(git('rev-parse', 'HEAD'), expected);
  assert.equal(git('status', '--porcelain=v1', '--untracked-files=no'), '');
  return { revision: expected, tree: git('rev-parse', 'HEAD^{tree}') };
}
export function assessOwnedPagesSmoke(report, owner, expected, engine) {
  assert(['chromium', 'webkit'].includes(engine), 'Fixed browser engine required');
  assert.equal(report.engine, engine);
  assert(
    typeof report.browserVersion === 'string' &&
      report.browserVersion.length > 0 &&
      report.browserVersion.length <= 128,
    'Bounded actual browser version required',
  );
  assert.equal(owner.status, 'closed');
  assert.equal(owner.exitCode, 0);
  assert.equal(owner.violation, null);
  assert.equal(owner.forcedCleanup, false);
  assert(!owner.cleanupUnconfirmed);
  assert.deepEqual(owner.survivors, []);
  assert.deepEqual(owner.ambiguous, []);
  assert.equal(report.format, 'RevealLinePublishedPagesSmokeReportV1');
  assert.equal(report.status, 'passed-controls');
  assert.equal(report.controlsComplete, true);
  assert(!report.failure && !report.cleanupFailure);
  assert.equal(report.expectedRevision, expected);
  assert.equal(report.profile, 'fresh-ephemeral');
  assert.equal(report.performanceExcluded, true);
  assert.deepEqual(report.cleanup, { context: 'closed', browser: 'closed' });
  assert.equal(report.bindingBefore.sourceRevision, expected);
  assert.deepEqual(report.bindingBefore, report.bindingAfter);
  assert.deepEqual(report.stages, [
    'ordinary-password-accepted',
    'solo-direct-start-pause-resume',
    'missions-current-selection',
    'settings-demo-return',
    'team-versus-public-return',
  ]);
  assert.equal(report.pages.length, 2);
  for (const page of report.pages) {
    assert.equal(page.total, 0);
    assert.equal(page.overflow, false);
    assert.deepEqual(page.events, []);
  }
  return {
    status: 'passed-controls',
    engine,
    performanceExcluded: true,
    scope:
      'Fixed public high-use flows on one stable deployed revision. Not whole-app or performance qualification.',
  };
}
export async function runOwnedPagesSmoke({
  expectedRevision,
  playwrightPath,
  output,
  env = process.env,
  owner = null,
  sourceIdentity = pagesSourceIdentity,
  platformNode = process.versions.node,
}) {
  const password = env.REVEALLINE_PAGES_TEST_PASSWORD;
  const engine = env.PAGES_SMOKE_ENGINE;
  const plan = await pagesSmokePlan();
  const summary = {
    format: 'RevealLinePublishedPagesSmokeOwnerV1',
    status: 'failed',
    expectedRevision,
    engine,
    performanceExcluded: true,
    retry: false,
  };
  let privateRoot;
  await mkdir(output, { mode: 0o700 });
  const publish = async (name, value, cap = 1024 ** 2) => {
    const text = encodePagesReport(value, password, cap);
    await writeFile(join(output, name), text, { flag: 'wx', mode: 0o600 });
    return {
      path: name,
      bytes: Buffer.byteLength(text),
      sha256: createHash('sha256').update(text).digest('hex'),
    };
  };
  try {
    validatePagesDispatch(env, expectedRevision, platformNode);
    summary.sourceBefore = await sourceIdentity(expectedRevision);
    assert(
      playwrightPath.endsWith('/node_modules/playwright/index.mjs'),
      'Fixed Playwright entry required',
    );
    const installed = JSON.parse(
      await readFile(join(dirname(playwrightPath), 'package.json'), 'utf8'),
    );
    assert.equal(installed.version, plan.playwright);
    privateRoot = await mkdtemp(join(tmpdir(), 'rl-pages-smoke-'));
    const log = join(privateRoot, 'child.log');
    const rawReport = join(privateRoot, 'report.json');
    const ownerPath = join(privateRoot, 'owner.json');
    const childEnv = {};
    for (const key of [
      'PATH',
      'HOME',
      'TMPDIR',
      'TMP',
      'TEMP',
      'LANG',
      'LC_ALL',
      'DISPLAY',
      'XAUTHORITY',
      'PLAYWRIGHT_BROWSERS_PATH',
      'LD_LIBRARY_PATH',
    ])
      if (env[key] !== undefined) childEnv[key] = env[key];
    childEnv.REVEALLINE_PAGES_TEST_PASSWORD = password;
    childEnv.CI = 'true';
    const runtime = owner ? null : await import('./run-solo-remote-correctness.mjs');
    const run = owner ?? runtime.ownedCommand;
    const inspect = async () => {
      const fs = await statfs(privateRoot);
      assert(Number(fs.bavail) * Number(fs.bsize) >= 256 * 1024 ** 2, 'Pages smoke disk reserve');
      if (runtime)
        assert(
          (await runtime.liveEvidenceSize(privateRoot)) <= plan.privateEvidenceBytes,
          'Private evidence cap',
        );
    };
    summary.command = await run(
      [
        process.execPath,
        fileURLToPath(new URL('./solo-pages-smoke.mjs', import.meta.url)),
        expectedRevision,
        engine,
        playwrightPath,
        rawReport,
      ],
      {
        cwd: repository,
        env: childEnv,
        log,
        receipt: ownerPath,
        timeoutMs: plan.ownerTimeoutMs,
        rssBytes: plan.rssBytes,
        outputBytes: plan.privateOutputBytes,
        inspect,
      },
    );
    // Private raw streams are never uploaded or printed. Redact even unexpected child output.
    const logStat = await stat(log);
    assert(logStat.size <= plan.privateOutputBytes, 'Private child output cap');
    const childLog = redactPagesText(
      await readFile(log, 'utf8'),
      password,
      plan.privateOutputBytes,
    );
    summary.log = await publish('child-log.json', {
      sourceBytes: logStat.size,
      truncated: childLog.length > 65536,
      output: childLog.slice(0, 65536),
    });
    const reportStat = await stat(rawReport);
    assert(reportStat.size <= plan.reportBytes, 'Child report byte cap');
    const report = JSON.parse(await readFile(rawReport, 'utf8'));
    summary.report = await publish('report.json', report, plan.reportBytes);
    summary.sourceAfter = await sourceIdentity(expectedRevision);
    assert.deepEqual(summary.sourceAfter, summary.sourceBefore, 'Tooling source changed');
    summary.assessment = assessOwnedPagesSmoke(report, summary.command, expectedRevision, engine);
    summary.status = 'passed-controls';
  } catch (error) {
    summary.failure = redactPagesText(error?.message ?? error, password);
  } finally {
    if (!summary.sourceAfter && summary.sourceBefore) {
      try {
        summary.sourceAfter = await sourceIdentity(expectedRevision);
        assert.deepEqual(summary.sourceAfter, summary.sourceBefore, 'Tooling source changed');
      } catch (error) {
        summary.sourceFailure = redactPagesText(error?.message ?? error, password);
        summary.status = 'failed';
      }
    }
    if (privateRoot) {
      if (!summary.command) {
        try {
          const path = join(privateRoot, 'owner.json');
          assert((await stat(path)).size <= 1024 ** 2);
          summary.unreturnedOwnerRecord = JSON.parse(await readFile(path, 'utf8'));
        } catch {
          summary.ownerRecordUnavailable = true;
        }
      }
      // Preserve any partial redacted report after owner failure, never promote it.
      if (!summary.report) {
        try {
          const raw = join(privateRoot, 'report.json');
          assert((await stat(raw)).size <= plan.reportBytes);
          summary.report = await publish(
            'report.json',
            JSON.parse(await readFile(raw, 'utf8')),
            plan.reportBytes,
          );
        } catch {
          summary.partialReportUnavailable = true;
        }
      }
      try {
        await rm(privateRoot, { recursive: true, force: true });
      } catch {
        summary.privateCleanupFailure = true;
        summary.status = 'failed';
      }
    }
    try {
      await publish('summary.json', summary, plan.reportBytes);
    } catch {
      summary.status = 'failed';
      summary.receiptFailure = true;
      await writeFile(
        join(output, 'failure-envelope.json'),
        JSON.stringify({
          format: summary.format,
          status: 'failed',
          expectedRevision,
          receiptFailure: true,
          performanceExcluded: true,
        }) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    }
  }
  return summary;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [expectedRevision, playwrightPath, output] = process.argv.slice(2);
  try {
    const result = await runOwnedPagesSmoke({ expectedRevision, playwrightPath, output });
    process.exitCode = result.status === 'passed-controls' ? 0 : 1;
  } catch {
    // Never serialize an uncaught Playwright call log or environment-bearing error.
    process.stderr.write('Published Pages smoke failed; inspect sanitized retained evidence.\n');
    process.exitCode = 1;
  }
}
