import { readFile } from 'node:fs/promises';

const bounded = async (work, timeoutMs, label) => {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** Own one export from an isolated qualification page. Reading an intercepted
 * Blob does not establish that the browser has completed its actual download. */
export async function readQualificationJSONDownload({
  page,
  trigger,
  timeoutMs = 10000,
  cleanupTimeoutMs = 1000,
  read = readFile,
}) {
  let download,
    primaryError,
    result,
    failed = false,
    active = true;
  const deadline = performance.now() + timeoutMs;
  const current = () => {
    if (!active || performance.now() >= deadline)
      throw new Error(`Export download exceeded ${timeoutMs}ms.`);
  };
  let acceptDownload;
  const started = new Promise((resolve) => {
    acceptDownload = resolve;
  });
  const onDownload = (value) => {
    download = value;
    acceptDownload(value);
  };
  page.once('download', onDownload);
  try {
    result = await bounded(
      async () => {
        await trigger();
        current();
        const owned = await started;
        current();
        const failure = await owned.failure();
        current();
        if (failure !== null) throw new Error(`Export download failed: ${failure}`);
        const file = await owned.path();
        current();
        if (!file) throw new Error('Export download did not provide a completed local artifact.');
        const bytes = await read(file, 'utf8');
        current();
        return JSON.parse(bytes);
      },
      timeoutMs,
      'Export download',
    );
  } catch (error) {
    failed = true;
    primaryError = error;
  } finally {
    active = false;
    page.off('download', onDownload);
    if (download) {
      try {
        await bounded(
          async () => {
            // Start both independently: deletion can wait for the cancellation,
            // while a broken cancellation must not prevent an attempted deletion.
            const outcomes = await Promise.allSettled([
              ...(failed ? [Promise.resolve().then(() => download.cancel())] : []),
              Promise.resolve().then(() => download.delete()),
            ]);
            const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
            if (failures.length)
              throw new AggregateError(
                failures.map((outcome) => outcome.reason),
                'Export artifact cleanup failed.',
              );
          },
          cleanupTimeoutMs,
          'Export artifact cleanup',
        );
      } catch (error) {
        if (failed)
          throw new AggregateError(
            [primaryError, error],
            'Export failed and its artifact cleanup failed.',
            { cause: primaryError },
          );
        throw error;
      }
    }
  }
  if (failed) throw primaryError;
  return result;
}
