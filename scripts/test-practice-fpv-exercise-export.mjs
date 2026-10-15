import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { exportPublicFPVExercise } from './practice-fpv-exercise-export.mjs';

function control(action) {
  return {
    waitFor: async ({ state }) => assert.equal(state, 'visible'),
    isEnabled: async () => true,
    press: async (key) => {
      assert.equal(key, 'Enter');
      await action();
    },
    click: async () => {
      throw Error('Pointer activation must remain a separate unqualified path.');
    },
  };
}

test('Academy export uses visible native keyboard controls and localized Notebook backup', async () => {
  for (const locale of ['en', 'uk']) {
    const actions = [];
    const json = JSON.stringify({
      format: 'FlightProofBackup.v1',
      packageId: 'civilian-fpv',
      attempts: [{ unitFixture: true }],
    });
    const page = {
      locator: (selector) => control(async () => actions.push(selector)),
      getByRole: (role, { name, exact }) => {
        assert(exact);
        return role === 'button'
          ? control(async () => actions.push(name))
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
    assert.deepEqual(actions, [
      '#academy-result-home',
      '#academy-shell-action-settings',
      '#academy-settings-tab-data',
      '#notebook-button',
      locale === 'uk' ? 'Експортувати перевірені спроби' : 'Export verified flight proofs',
    ]);
    assert.equal(value.independentReplayVerified, undefined);
  }
});

test('Worlds export owns keyboard activation/download together and preserves actual bytes', async () => {
  const actions = [],
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
      ...control(async () => actions.push(selector)),
      getByRole: (role, { name }) =>
        control(async () => actions.push(selector + ':' + role + ':' + name)),
    }),
  };
  const value = await exportPublicFPVExercise(page, { packageId: 'fpv-worlds', locale: 'uk' });
  assert.equal(value.json, json);
  assert.deepEqual(actions, [
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
    ...control(async () => {
      if (selector === '#backup-proofs') throw Error('Native activation failed');
    }),
    getByRole: () => control(async () => {}),
  });
  await assert.rejects(
    exportPublicFPVExercise(page, { packageId: 'fpv-worlds', locale: 'en' }),
    /Native activation failed/,
  );
  rejectDownload(new Error('Late download failure'));
  await new Promise((resolve) => setTimeout(resolve, 20));
});

test('cancellation while awaiting a native control must not send Enter', async () => {
  for (const packageId of ['civilian-fpv', 'fpv-worlds']) {
    const controller = new AbortController();
    let presses = 0;
    const target = {
      waitFor: async () => controller.abort(),
      isEnabled: async () => true,
      press: async () => presses++,
    };
    const page = { locator: () => ({ ...target, getByRole: () => target }) };
    await assert.rejects(
      exportPublicFPVExercise(page, { packageId, locale: 'en', signal: controller.signal }),
    );
    assert.equal(presses, 0);
  }
});

test('invalid specifications, pre-aborted requests and hidden/disabled controls cannot export', async () => {
  const controller = new AbortController();
  controller.abort();
  for (const spec of [
    { packageId: 'other', locale: 'en' },
    { packageId: 'civilian-fpv', locale: 'fr' },
    ...['civilian-fpv', 'fpv-worlds'].map((packageId) => ({
      packageId,
      locale: 'en',
      signal: controller.signal,
    })),
  ])
    await assert.rejects(exportPublicFPVExercise({}, spec));
  let activated = false;
  for (const hidden of [true, false]) {
    const page = {
      locator: () => ({
        waitFor: async () => {
          if (hidden) throw Error('Hidden native control');
        },
        isEnabled: async () => false,
        press: async () => {
          activated = true;
        },
      }),
    };
    await assert.rejects(
      exportPublicFPVExercise(page, { packageId: 'civilian-fpv', locale: 'en' }),
    );
  }
  assert.equal(activated, false);
});
