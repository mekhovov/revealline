import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalPracticeCatalogURL,
  validateOptionalPracticeCatalog,
  loadOptionalPracticeCatalog,
} from '../optional-practice-catalog.mjs';
import { mountOptionalPracticePanel } from '../ui/optional-practice-panel.mjs';
import { optionalPracticeSourcePreviews } from '../optional-practice-preview.mjs';
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
    'game/controller-lab/',
    'game/controller-lab/index.html',
    'releases/v1.2.3/site/game/controller-lab/',
    'editions/fpv-learning/releases/v1.2.3/site/game/controller-lab/index.html',
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

test('unqualified source previews are limited to the loopback source entry', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const previews = optionalPracticeSourcePreviews(
      `http://${host}:8768/game/index.html?edition=fpv-learning`,
    );
    assert.deepEqual(previews, [
      {
        id: 'civilian-flight',
        titleKey: 'assistedSourcePreview',
        url: `http://${host}:8768/optional-practice/civilian-flight/`,
      },
      {
        id: 'civilian-fpv',
        titleKey: 'fpvSourcePreview',
        url: `http://${host}:8768/optional-practice/civilian-fpv/`,
      },
    ]);
  }
  for (const href of [
    'https://example.test/game/index.html',
    'http://localhost.evil.test/game/index.html',
    'http://user@localhost/game/index.html',
    'http://localhost/current-abc/game/index.html',
    'http://localhost/editions/fpv-learning/releases/v1.2.3/site/game/index.html',
    'http://localhost/releases/v1.2.3/site/game/index.html',
    'http://localhost/game/controller-lab/',
    'http://localhost/game/company.html',
    'file:///game/index.html',
    'invalid',
  ])
    assert.deepEqual(optionalPracticeSourcePreviews(href), [], href);
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
  await waitFor(() => !doc.getElementById('optional-practice-refresh').disabled);
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('a'), null);
});

test('Home and More share one public loader and restore the actual opener without resuming play', async (t) => {
  const doc = new Document(),
    container = doc.createElement('nav'),
    home = doc.createElement('button');
  doc.body.append(container, home);
  let pauses = 0,
    requests = 0;
  const panel = mountOptionalPracticePanel({
    document: doc,
    container,
    href: 'https://example.test/game/index.html',
    pause() {
      pauses++;
    },
    fetcher: async () => {
      requests++;
      return new Response(JSON.stringify(catalog));
    },
  });
  t.after(() => panel.dispose());
  panel.open(home);
  panel.open(home);
  await waitFor(() => doc.getElementById('optional-practice-dialog').querySelector('a'));
  assert.equal(pauses, 1);
  assert.equal(requests, 1);
  assert.equal(doc.activeElement.id, 'optional-practice-close');
  doc.getElementById('optional-practice-close').click();
  assert.equal(doc.activeElement, home);
  const more = doc.getElementById('shell-optional-practice');
  more.click();
  doc.getElementById('optional-practice-close').click();
  assert.equal(doc.activeElement, more);
  assert.equal(pauses, 2);
  panel.open(home);
  home.remove();
  doc.body.focus();
  panel.close({ restoreFocus: false });
  assert.equal(doc.activeElement, doc.body);
  doc.body.append(home);
  panel.open(home);
  doc.body.focus();
  doc.focused = false;
  panel.close();
  assert.equal(doc.activeElement, doc.body, 'Background closing cannot steal focus');
});

test('local gym and FPV previews stay separate and usable while the public catalog is unavailable', async (t) => {
  const doc = new Document(),
    container = doc.createElement('nav');
  doc.body.append(container);
  let requests = 0;
  const panel = mountOptionalPracticePanel({
    document: doc,
    container,
    href: 'http://127.0.0.1:8768/game/index.html?edition=fpv-learning',
    pause() {},
    fetcher: async () => {
      requests++;
      return new Response('', { status: 404 });
    },
  });
  t.after(() => panel.dispose());
  assert.equal(requests, 0);
  panel.open();
  const dialog = doc.getElementById('optional-practice-dialog');
  const preview = dialog.querySelector('[data-practice-source-preview]');
  assert.equal(preview.href, 'http://127.0.0.1:8768/optional-practice/civilian-flight/');
  assert.equal(preview.target, '_blank');
  assert.equal(preview.rel, 'noopener noreferrer');
  await waitFor(() => !doc.getElementById('optional-practice-refresh').disabled);
  assert.equal(requests, 1);
  assert.equal(dialog.querySelectorAll('a').length, 2);
  const fpv = dialog.querySelectorAll('[data-practice-source-preview]')[1];
  assert.equal(fpv.href, 'http://127.0.0.1:8768/optional-practice/civilian-fpv/');
  assert.equal(fpv.target, '_blank');
  assert.equal(fpv.rel, 'noopener noreferrer');
  assert.match(fpv.textContent, /source preview · unqualified/);
  panel.close();
  panel.open();
  assert.equal(dialog.querySelectorAll('[data-practice-source-preview]').length, 2);
});
