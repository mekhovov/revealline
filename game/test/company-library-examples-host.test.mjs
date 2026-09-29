import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

test('an edition uses its explicit empty example catalogue without fetching omitted default content', async (t) => {
  const fixture = await editionProviderFixture(),
    requested = [];
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    async fetchResponse(url) {
      const pathname = new URL(url, 'http://localhost/game/').pathname;
      requested.push(pathname);
      if (pathname === '/game/content/packs/index.json')
        return new Response('Omitted from the selected edition', { status: 404 });
      return fixture.fetcher(url);
    },
  });
  const examples = page.$('builtin-packs');
  await settle(() => ['ready', 'error'].includes(examples.children[0]?.dataset.state));
  assert.equal(page.doc.body.dataset.editionId, 'sample-public');
  assert.equal(requested.includes('/game/content/packs/index.json'), false);
  assert.equal(examples.querySelectorAll('button').length, 0);
  assert.equal(examples.children[0].dataset.state, 'ready');
  assert.equal(examples.children[0].hidden, true);
  assert.equal(examples.children[0].textContent, '');
  assert.deepEqual(page.errors, []);
});

test('the default Library still fetches examples and installs the selected pack through its existing flow', async (t) => {
  const requested = [];
  const page = await soloPage(t, {
    titleScreen: true,
    fetchResponse(url) {
      requested.push(String(url));
      if (url === 'content/packs/index.json')
        return new Response(
          JSON.stringify({ packs: [{ id: 'fieldcraft', path: 'fieldcraft.json' }] }),
        );
    },
  });
  const examples = page.$('builtin-packs');
  await settle(() => examples.querySelectorAll('button').length === 1);
  assert.equal(requested.filter((url) => url === 'content/packs/index.json').length, 1);
  assert.equal(examples.children[0].dataset.state, 'ready');
  assert.equal(examples.children[0].hidden, true);
  page.$('shell-workshop').click();
  page.$('shell-library').click();
  page.doc.querySelector('[data-library-panel="packs"]').click();
  const install = examples.querySelector('button');
  assert.equal(install.textContent, 'Install fieldcraft');
  install.click();
  await settle(() => /Validated and installed/.test(page.$('pack-status').textContent));
  assert.equal(requested.filter((url) => url === 'content/packs/fieldcraft.json').length, 1);
  assert.ok(
    [...page.$('installed-packs').querySelectorAll('button')].some((button) =>
      button.textContent.startsWith('Play '),
    ),
  );
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(page.errors, []);
});
