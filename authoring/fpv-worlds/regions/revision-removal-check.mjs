import { verifyRevisionRemoval } from './revision-removal-scenario.mjs';
const run = document.querySelector('#run'),
  output = document.querySelector('#result');
const base = new URL('./urban-bando/delivery-review-r1/', import.meta.url);
async function bytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fixture source unavailable: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
run.onclick = async () => {
  run.disabled = true;
  output.textContent = 'Checking new isolated fixture databases…';
  try {
    const result = await verifyRevisionRemoval({
      indexedDB,
      descriptorBytes: await bytes(new URL('delivery.json', base)),
      readSource: (path) => bytes(new URL(path, base)),
    });
    output.textContent = `PASS ${result.cases.length}/${result.cases.length}\n${JSON.stringify(result, null, 2)}`;
  } catch (error) {
    output.textContent = `FAIL ${error.message}`;
  } finally {
    run.disabled = false;
  }
};
