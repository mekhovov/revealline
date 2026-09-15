(async () => {
  // A genuinely new, out-of-worker-scope pathname. Query-only busting is invalid here:
  // the product worker strips search parameters before matching its offline inventory.
  const url = new URL(`/__p01_refusal_probe__/${crypto.randomUUID()}`, location.origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const started = performance.now();
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal });
    return { expected: 'network refusal', outcome: 'response-received', status: response.status, type: response.type,
      elapsedMs: performance.now() - started, time: new Date().toISOString(), origin: url.origin,
      warning: 'A response, including HTTP 404, does not prove network refusal. Check proxy/CDP evidence.' };
  } catch (error) {
    return { expected: 'network refusal', outcome: 'rejected', errorName: error.name, message: error.message,
      elapsedMs: performance.now() - started, time: new Date().toISOString(), origin: url.origin,
      warning: 'Requires matching proxy CONNECT refusal and launch-argument evidence; an unrelated network failure or timeout is insufficient.' };
  } finally {
    clearTimeout(timer);
  }
})()
