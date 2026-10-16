import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';

test('selected edition does not request default example packs while retaining Library data controls', async (t) => {
  const fixture = await editionProviderFixture();
  const requests = [];
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    fetchResponse: (url, options) => {
      requests.push(String(url));
      return fixture.fetcher(url, options);
    },
  });
  assert.equal(page.doc.body.dataset.editionId, 'sample-public');
  assert.equal(requests.includes('content/packs/index.json'), false);
  assert.equal(page.$('builtin-packs').querySelectorAll('button').length, 0);
  assert.equal(page.$('builtin-packs').textContent, '');
  for (const id of ['install-pack', 'export-packs', 'launch-challenge'])
    assert.equal(typeof page.$(id).onclick, 'function', `${id} retains its owned handler`);
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.deepEqual(page.errors, []);
});

test('default game still loads its example pack catalogue and install controls', async (t) => {
  const requests = [];
  const page = await soloPage(t, {
    titleScreen: true,
    fetchResponse: (url) => {
      requests.push(String(url));
    },
  });
  await settle(() => page.$('builtin-packs').querySelectorAll('button').length > 0);
  assert.equal(requests.filter((url) => url === 'content/packs/index.json').length, 1);
  assert.ok(
    [...page.$('builtin-packs').querySelectorAll('button')].some((button) =>
      button.textContent.includes('fieldcraft'),
    ),
  );
  assert.deepEqual(page.errors, []);
});
