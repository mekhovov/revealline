// Test-only Node ESM hook: observe real module loads in a fresh process, or
// reject one fixed local module to verify failure propagation. No game mocks.
export async function load(url, context, nextLoad) {
  if (process.env.ROUTE_PROBE_FAIL_SUFFIX && url.endsWith(process.env.ROUTE_PROBE_FAIL_SUFFIX))
    throw new Error('route-probe: selected module unavailable');
  const loaded = await nextLoad(url, context);
  if (url.startsWith('file:')) process.stderr.write(`ROUTE_MODULE ${JSON.stringify({ url })}\n`);
  return loaded;
}
