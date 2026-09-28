import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalPracticeCatalogURL,
  validateOptionalPracticeCatalog,
  loadOptionalPracticeCatalog,
} from '../optional-practice-catalog.mjs';
import { mountOptionalPracticePanel } from '../ui/optional-practice-panel.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
const catalog = {
  format: 'revealline-optional-package-launchers.v1',
  packages: [
    {
      id: 'civilian-flight',
      name: 'Civilian flight practice',
      href: 'civilian-flight/app/',
      version: 'v1.2.3',
      revision: '1',
    },
  ],
};
const indexURL = 'https://example.test/project/practice/index.json';

test('optional navigation resolves source and frozen default/edition hosts without forwarding query choices', () => {
  for (const suffix of [
    'game/index.html',
    'releases/v1.2.3/site/game/index.html',
    'editions/coupa-all/releases/v1.2.3/site/game/company.html',
  ])
    assert.equal(
      optionalPracticeCatalogURL(
        'https://example.test/project/' + suffix + '?edition=evil&url=https://evil.test',
      ),
      indexURL,
    );
  assert.equal(optionalPracticeCatalogURL('file:///tmp/game/index.html'), null);
  assert.equal(optionalPracticeCatalogURL('https://example.test/unknown/'), null);
});

test('launcher catalog rejects external links, encoded paths, duplicates and oversized responses', async () => {
  assert.equal(
    validateOptionalPracticeCatalog(catalog, indexURL)[0].url,
    'https://example.test/project/practice/civilian-flight/app/',
  );
  for (const href of [
    'https://evil.test/',
    '//evil.test/',
    '../game/',
    'civilian-flight/app/?x=1',
    'civilian-flight/%61pp/',
  ]) {
    const broken = structuredClone(catalog);
    broken.packages[0].href = href;
    assert.throws(() => validateOptionalPracticeCatalog(broken, indexURL));
  }
  const duplicate = structuredClone(catalog);
  duplicate.packages.push(duplicate.packages[0]);
  assert.throws(() => validateOptionalPracticeCatalog(duplicate, indexURL));
  await assert.rejects(
    loadOptionalPracticeCatalog(indexURL, { fetcher: async () => new Response(' '.repeat(16385)) }),
    /too large/,
  );
  assert.deepEqual(
    await loadOptionalPracticeCatalog(indexURL, {
      fetcher: async () => new Response('', { status: 404 }),
    }),
    [],
  );
});

test('shared practice entry is explicit, pauses once and never prefetches package bytes', async (t) => {
  const doc = new Document(),
    container = doc.createElement('nav');
  doc.body.append(container);
  const requests = [];
  let pauses = 0;
  const panel = mountOptionalPracticePanel({
    document: doc,
    container,
    href: 'https://example.test/project/game/index.html',
    pause() {
      pauses++;
    },
    async fetcher(url, options) {
      requests.push({ url, options });
      return new Response(JSON.stringify(catalog));
    },
  });
  t.after(() => panel.dispose());
  assert.equal(requests.length, 0);
  const opener = doc.getElementById('shell-optional-practice');
  opener.click();
  await waitFor(() => doc.getElementById('optional-practice-dialog').querySelector('a'));
  assert.equal(pauses, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, indexURL);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.credentials, 'omit');
  const dialog = doc.getElementById('optional-practice-dialog'),
    link = dialog.querySelector('a');
  assert.equal(link.href, 'https://example.test/project/practice/civilian-flight/app/');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  dialog.close();
  assert.equal(doc.activeElement, opener);
  assert.equal(dialog.querySelector('a'), null);
  panel.dispose();
  assert.equal(doc.getElementById('optional-practice-dialog'), null);
});

test('closing an in-flight optional catalog discards late results and restores its opener', async (t) => {
  const doc = new Document(),
    container = doc.createElement('nav');
  doc.body.append(container);
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const panel = mountOptionalPracticePanel({
    document: doc,
    container,
    href: 'https://example.test/project/game/index.html',
    pause() {},
    fetcher: () => pending,
  });
  t.after(() => panel.dispose());
  const opener = doc.getElementById('shell-optional-practice');
  opener.click();
  const dialog = doc.getElementById('optional-practice-dialog');
  dialog.close();
  finish(new Response(JSON.stringify(catalog)));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dialog.open, false);
  assert.equal(dialog.querySelector('a'), null);
  assert.equal(doc.activeElement, opener);
});

test('a stalled optional catalog times out and leaves an explicit retry available', async (t) => {
  const doc = new Document(),
    container = doc.createElement('nav');
  doc.body.append(container);
  const panel = mountOptionalPracticePanel({
    document: doc,
    container,
    href: 'https://example.test/project/game/index.html',
    pause() {},
    timeoutMs: 5,
    fetcher(_url, { signal }) {
      return new Promise((_resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        ),
      );
    },
  });
  t.after(() => panel.dispose());
  doc.getElementById('shell-optional-practice').click();
  const dialog = doc.getElementById('optional-practice-dialog');
  await waitFor(() => !dialog.querySelector('button').disabled);
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('a'), null);
});
