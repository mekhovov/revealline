import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { exportPublicFPVExercise } from './practice-fpv-exercise-export.mjs';

test('Academy native backup follows visible result Home, Settings Data and localized Notebook export', async () => {
  for (const locale of ['en', 'uk']) {
    const clicks = [];
    const json = JSON.stringify({
      format: 'FlightProofBackup.v1',
      packageId: 'civilian-fpv',
      attempts: [{ unitFixture: true }],
    });
    const page = {
      locator: (selector) => ({ click: async () => clicks.push(selector) }),
      getByRole: (role, { name, exact }) => {
        assert(exact);
        return role === 'button'
          ? { click: async () => clicks.push(name) }
          : {
              inputValue: async () => {
                assert.equal(
                  name,
                  locale === 'uk' ? 'Резервна копія спроб у JSON' : 'Flight proof backup JSON',
                );
                return json;
              },
            };
      },
    };
    const value = await exportPublicFPVExercise(page, { packageId: 'civilian-fpv', locale });
    assert.equal(value.json, json);
    assert.deepEqual(clicks, [
      '#academy-result-home',
      '#academy-shell-action-settings',
      '#academy-settings-tab-data',
      '#notebook-button',
      locale === 'uk' ? 'Експортувати перевірені спроби' : 'Export verified flight proofs',
    ]);
    assert.equal(value.independentReplayVerified, undefined, 'Export is not replay acceptance.');
  }
});

test('Worlds backup owns click/download together and preserves the actual downloaded bytes', async () => {
  const clicks = [],
    json = '{"format":"unit-fixture-not-qualified"}';
  const download = {
    suggestedFilename: () => 'fpv-flights-1-of-1.json',
    failure: async () => null,
    createReadStream: async () => Readable.from([Buffer.from(json)]),
  };
  const page = {
    waitForEvent: async (name) => {
      assert.equal(name, 'download');
      return download;
    },
    locator: (selector) => ({
      click: async () => clicks.push(selector),
      getByRole: (role, { name }) => ({
        click: async () => clicks.push(selector + ':' + role + ':' + name),
      }),
    }),
  };
  const value = await exportPublicFPVExercise(page, { packageId: 'fpv-worlds', locale: 'uk' });
  assert.equal(value.json, json);
  assert.deepEqual(clicks, [
    '.continuous-result-actions:button:Додому',
    '#worlds-shell-action-settings',
    '#worlds-settings-tab-data',
    '#backup-proofs',
  ]);
  assert.equal(value.downloadName, 'fpv-flights-1-of-1.json');
  let rejectDownload;
  page.waitForEvent = () =>
    new Promise((_, reject) => {
      rejectDownload = reject;
    });
  page.locator = (selector) => ({
    getByRole: () => ({ click: async () => {} }),
    click: async () => {
      if (selector === '#backup-proofs') throw Error('Native click failed');
    },
  });
  await assert.rejects(
    exportPublicFPVExercise(page, { packageId: 'fpv-worlds', locale: 'en' }),
    /Native click failed/,
  );
  rejectDownload(new Error('Late download failure'));
  await new Promise((resolve) => setTimeout(resolve, 20));
});

test('invalid specifications or pre-aborted exports cannot touch the browser', async () => {
  const controller = new AbortController();
  controller.abort();
  for (const spec of [
    { packageId: 'other', locale: 'en' },
    { packageId: 'civilian-fpv', locale: 'fr' },
    { packageId: 'civilian-fpv', locale: 'en', signal: controller.signal },
  ])
    await assert.rejects(exportPublicFPVExercise({}, spec));
});
