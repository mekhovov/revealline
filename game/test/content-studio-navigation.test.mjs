import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contentStudioLinks, mountContentStudioLinks } from '../ui/content-studio-navigation.mjs';
import { WORKSHOP_TOOLS, workshopToolHref } from '../ui/workshop-return.mjs';

const anchorAttributes = (html) =>
  [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/\s+([^\s=/>]+)\s*=\s*"([^"]*)"/g)].map(([, name, value]) => [name, value]),
    ),
  );

test('new-tab link assertions distinguish real attributes from data-prefixed substitutes', () => {
  const [attributes] = anchorAttributes(
    '<a data-href="../?journey=authored" data-target="_blank" target="_self" data-rel="noopener" data-aria-label="Solo · authored (new tab)">',
  );
  assert.equal(attributes.href, undefined);
  assert.equal(attributes.target, '_self');
  assert.equal(attributes.rel, undefined);
  assert.equal(attributes['aria-label'], undefined);
});

for (const prefix of [
  'http://localhost/',
  'https://example.test/releases/v0.73.0/site/',
  'https://example.test/archive/releases/v0.69.0/site/',
])
  test(`Studio descendant links preserve only Journey in the exact edition ${prefix}`, () => {
    for (const tool of ['studio', 'playground'])
      for (const index of ['', 'index.html'])
        for (const journey of ['1', 'opening', 'authored']) {
          const source = `${prefix}game/${tool}/${index}?journey=${journey}&project=private-draft&practice=1&return=https://other.test#old`;
          assert.deepEqual(contentStudioLinks(source), {
            game: `${prefix}game/?journey=${journey}`,
            playground: `${prefix}game/playground/?journey=${journey}`,
            studio: `${prefix}game/studio/?journey=${journey}`,
          });
        }
    assert.equal(WORKSHOP_TOOLS.length, 9, 'No duplicate or aliased Workshop opener.');
    assert.equal(
      workshopToolHref(`${prefix}game/?journey=opening`, 'playground'),
      `${prefix}game/playground/?journey=opening`,
    );
  });

test('duplicate or malformed Journey and unrelated return hints cannot rewrite fixed destinations', () => {
  for (const query of [
    '',
    '?journey=opening&journey=authored',
    '?journey=../../elsewhere',
    '?journey=',
    '?journey=https://elsewhere.test',
    '?return=https://elsewhere.test&workshop=asset-studio',
  ])
    assert.deepEqual(contentStudioLinks(`https://example.test/game/studio/${query}`), {
      game: 'https://example.test/game/',
      playground: 'https://example.test/game/playground/',
      studio: 'https://example.test/game/studio/',
    });
  for (const page of [
    'https://example.test/game/',
    'https://example.test/authoring/asset-studio/',
    'https://example.test/game/studio-other/',
  ])
    assert.throws(() => contentStudioLinks(page), /fixed/);
});

test('early link mount assigns destinations before enabling and never focuses, reads a draft or mounts another opener', () => {
  const writes = [];
  const links = ['game', 'playground', 'studio', 'constructor'].map((key) => ({
    getAttribute: () => key,
    set href(value) {
      writes.push([key, 'href', value]);
    },
    set inert(value) {
      writes.push([key, 'inert', value]);
    },
    removeAttribute(name) {
      writes.push([key, 'remove', name]);
    },
    focus() {
      throw new Error('Navigation mounting must not focus.');
    },
  }));
  mountContentStudioLinks({
    document: {
      querySelectorAll: (selector) => {
        assert.equal(selector, '[data-content-studio-route]');
        return links;
      },
    },
    href: 'https://example.test/game/studio/?journey=opening&project=my-draft',
  });
  for (const key of ['game', 'playground', 'studio']) {
    const own = writes.filter((row) => row[0] === key);
    assert.equal(own[0][1], 'href');
    assert.deepEqual(own.at(-1), [key, 'remove', 'aria-disabled']);
  }
  assert(!writes.some((row) => row[0] === 'constructor'));
});

test('Studio preview has an exact owner and nearby returns while intentional new-tab mode tests retain their contracts', async () => {
  const studio = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const playground = await readFile(new URL('../playground/index.html', import.meta.url), 'utf8');
  assert.match(studio, /name="revealline-content-studio-preview"/);
  assert.match(studio, /data-content-studio-route="game"/);
  assert.match(studio, /data-content-studio-route="playground"/);
  assert.match(playground, /data-content-studio-route="studio"/);
  assert.match(
    studio,
    /<iframe[\s\S]*?<\/iframe>\s*<button id="preview-return">Return to draft<\/button>/,
  );
  for (const html of [studio, playground])
    assert.match(html, /content-studio-navigation-entry\.mjs/);
  const anchors = anchorAttributes(studio);
  for (const [href, label] of [
    ['../?journey=authored', 'Solo'],
    ['../couch/?journey=authored', 'Versus'],
  ]) {
    const links = anchors.filter((anchor) => anchor.href === href);
    assert.equal(links.length, 1, `Exactly one authored ${label} link.`);
    assert.equal(links[0].target, '_blank');
    assert.equal(links[0].rel, 'noopener');
    assert.equal(links[0]['aria-label'], `${label} · authored (new tab)`);
  }
  const source = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(source, /\$\('close-preview'\)\.onclick = closePreview;/);
  assert.match(source, /\$\('preview-return'\)\.onclick = closePreview;/);
  assert.match(
    source,
    /sourceChanged \|\| session\?\.status\(\)\.dirty \|\| traceRecovery\.hasUnsaved\(\)/,
  );
});
