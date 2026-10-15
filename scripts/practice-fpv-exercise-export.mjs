import assert from 'node:assert/strict';

// Public controls only. Never read IndexedDB, app globals, or private model state.
export async function exportPublicFPVExercise(page, { packageId, locale, signal } = {}) {
  assert(['civilian-fpv', 'fpv-worlds'].includes(packageId));
  assert(['en', 'uk'].includes(locale));
  const academy = packageId === 'civilian-fpv';
  const check = () => signal?.throwIfAborted();
  const activate = async (target) => {
    check();
    await target.waitFor({ state: 'visible', timeout: 5000 });
    assert(await target.isEnabled(), 'Native export control is disabled.');
    check();
    await target.press('Enter', { timeout: 5000 });
    check();
  };
  const click = (selector) => activate(page.locator(selector));
  check();
  if (academy) {
    await click('#academy-result-home');
    await click('#academy-shell-action-settings');
    await click('#academy-settings-tab-data');
    await click('#notebook-button');
    const button = page.getByRole('button', {
      name: locale === 'uk' ? 'Експортувати перевірені спроби' : 'Export verified flight proofs',
      exact: true,
    });
    const field = page.getByRole('textbox', {
      name: locale === 'uk' ? 'Резервна копія спроб у JSON' : 'Flight proof backup JSON',
      exact: true,
    });
    const end = Date.now() + 10000;
    do {
      check();
      await activate(button);
      const json = await field.inputValue({ timeout: 3000 });
      assert(Buffer.byteLength(json) <= 2 * 1024 * 1024, 'Exercise export exceeds 2 MiB.');
      const value = JSON.parse(json);
      assert(['FlightProofBackup.v1', 'FlightProofBackup.v2'].includes(value.format));
      if (value.attempts?.length)
        return {
          json,
          source: 'Native Notebook export textarea',
          exportedAt: new Date().toISOString(),
        };
      assert(
        Date.now() < end,
        'Newly completed flight was not available in the native proof export.',
      );
      await page.waitForTimeout(200);
    } while (true);
  }
  // The result's verification message is not sufficient: independent replay
  // below still must establish complete, the exact course, practice and mode.
  await activate(
    page
      .locator('.continuous-result-actions')
      .getByRole('button', { name: locale === 'uk' ? 'Додому' : 'Home', exact: true }),
  );
  await click('#worlds-shell-action-settings');
  await click('#worlds-settings-tab-data');
  const pending = page.waitForEvent('download', { timeout: 10000 });
  const [download] = await Promise.all([pending, click('#backup-proofs')]);
  check();
  assert.equal(
    download.suggestedFilename(),
    'fpv-flights-1-of-1.json',
    'Fresh single exercise requires a single bounded backup part.',
  );
  assert.equal(await download.failure(), null, 'Native proof download failed.');
  const stream = await download.createReadStream();
  assert(stream, 'Native proof download stream unavailable.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    check();
    bytes += chunk.length;
    assert(bytes <= 2 * 1024 * 1024, 'Exercise export exceeds 2 MiB.');
    chunks.push(chunk);
  }
  return {
    json: Buffer.concat(chunks).toString('utf8'),
    source: 'Native Data backup download',
    downloadName: download.suggestedFilename(),
    exportedAt: new Date().toISOString(),
  };
}
