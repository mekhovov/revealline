import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

const describe = (error, limit = 2048) => String(error?.stack ?? error).slice(0, limit);
const remember = (report, stage, error) => {
  report.secondaryDiagnostics ??= [];
  if (report.secondaryDiagnostics.length < 8)
    report.secondaryDiagnostics.push({ stage, error: describe(error) });
};
const failed = (report, error) => {
  report.complete = false;
  report.failure ??= describe(error, 8192);
};
const bounded = async (work, timeoutMs) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Operation exceeded ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** Keep the prior report until a complete replacement can be atomically adopted. */
export async function writeQualificationReport(
  path,
  report,
  { fs = { writeFile, rename, rm }, token = randomUUID(), onCleanupError = () => {} } = {},
) {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${token}.tmp`);
  const body = `${JSON.stringify(report, null, 2)}\n`;
  let owned = false;
  try {
    // ENOSPC may leave a partial temporary file, but never truncates the old report.
    try {
      await fs.writeFile(temporary, body, { flag: 'wx' });
      owned = true;
    } catch (error) {
      owned = error.code !== 'EEXIST';
      throw error;
    }
    await fs.rename(temporary, path);
    owned = false;
  } finally {
    if (owned) {
      try {
        await fs.rm(temporary, { force: true });
      } catch (error) {
        onCleanupError(error);
      }
    }
  }
}

/** A dead page or failed screenshot must not replace the primary failure. */
export async function diagnoseQualificationFailure({
  report,
  error,
  page,
  screenshotPath,
  readState,
  timeoutMs = 2000,
}) {
  failed(report, error);
  if (!page) return;
  if (readState) {
    try {
      report.failureState = await bounded(readState, timeoutMs);
    } catch (failure) {
      remember(report, 'failure-state', failure);
    }
  }
  try {
    report.visibleText = (
      await bounded(() => page.locator('body').innerText({ timeout: timeoutMs }), timeoutMs)
    ).slice(0, 12000);
  } catch (failure) {
    remember(report, 'failure-body-text', failure);
  }
  try {
    await bounded(() => page.screenshot({ path: screenshotPath, timeout: timeoutMs }), timeoutMs);
  } catch (failure) {
    remember(report, 'failure-screenshot', failure);
  }
}

/** Cleanup is independent of storage; stdout remains useful when the disk is full. */
export async function finishQualification({
  report,
  reportPath,
  browser,
  writeReport = writeQualificationReport,
  emit = (summary) => console.log(JSON.stringify(summary)),
  closeTimeoutMs = 10000,
}) {
  report.browserCloseAttempted = !!browser;
  try {
    if (browser) await bounded(() => browser.close(), closeTimeoutMs);
    report.browserCloseCompleted = !!browser;
  } catch (error) {
    failed(report, new Error('Qualification browser cleanup failed.', { cause: error }));
    remember(report, 'browser-close', error);
    report.browserCloseCompleted = false;
  }
  report.finished = new Date().toISOString();
  try {
    await writeReport(reportPath, report, {
      onCleanupError: (error) => remember(report, 'temporary-report-cleanup', error),
    });
  } catch (error) {
    failed(report, new Error('Qualification report could not be saved.', { cause: error }));
    remember(report, 'final-report-write', error);
  }
  const summary = {
    reportPath,
    complete: report.complete,
    checks: report.checks?.length ?? 0,
    failure: report.failure,
    browserCloseAttempted: report.browserCloseAttempted,
    browserCloseCompleted: report.browserCloseCompleted,
    secondaryDiagnostics: report.secondaryDiagnostics ?? [],
  };
  emit(summary);
  return summary;
}
