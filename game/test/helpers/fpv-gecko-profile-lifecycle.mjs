/** Diagnostic-only lifecycle: preserve failures without claiming resource closure. */
export async function recordContactBaseline(report, replay, save) {
  try {
    report.node = await replay();
    if (!report.node.matched) throw new Error('Node replay mismatch; browser capture prohibited');
    await save();
    return true;
  } catch (error) {
    report.error = String(error.stack ?? error);
    report.completedAt = new Date().toISOString();
    await save();
    return false;
  }
}

export async function closeContactCapture(report, closeBrowser, closeServer) {
  const outcomes = await Promise.allSettled([
    Promise.resolve().then(closeBrowser),
    Promise.resolve().then(closeServer),
  ]);
  report.cleanup = Object.fromEntries(
    outcomes.map((outcome, index) => [
      index ? 'server' : 'browser',
      outcome.status === 'fulfilled'
        ? { closed: true }
        : { closed: false, error: String(outcome.reason?.stack ?? outcome.reason) },
    ]),
  );
  report.ownedBrowserAndServerClosed = outcomes.every((outcome) => outcome.status === 'fulfilled');
  if (!report.ownedBrowserAndServerClosed)
    report.cleanupError = 'One or more owned resources did not confirm closure';
}
