import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { attachOverflightStudioLinks } from '../overflight/studio-links.mjs';
import { overflightText } from '../overflight/copy.mjs';
import { overflightHuntText } from '../overflight/raid-copy.mjs';
import { nativeArtReviewURL } from '../ui/art-review-navigation.mjs';
import { Document } from './helpers/couch-dom.mjs';

for (const [mode, page, studio, text] of [
  ['Survivor', 'play.html', 'overflight.html', overflightText],
  ['Raid', 'raid.html', 'raid.html', overflightHuntText],
]) {
  test(`${mode}: Settings tools preserve edition, language and art context without forwarding gameplay hints`, () => {
    const doc = new Document(),
      root = doc.createElement('section'),
      prefix = 'https://example.test/archive/releases/v1/site/',
      source = `${prefix}game/overflight/${page}?seed=23&studio=overflight&return=https://other.test&artReview=industrial-roster-v3`;
    doc.body.append(root);
    let locale = 'en',
      paused = 0,
      musicOpened = 0;
    const owner = attachOverflightStudioLinks({
      document: doc,
      root,
      getLocale: () => locale,
      getCreator: () => ({
        path: `../studio/${studio}`,
        title: text(locale, 'workshop'),
        description: text(locale, 'workshopHelp'),
      }),
      destination(path) {
        const target = new URL(path, source);
        target.searchParams.set('lang', locale);
        return nativeArtReviewURL(target.href, source);
      },
      onOpen: () => paused++,
      onMusic: () => musicOpened++,
    });
    const controls = [...root.querySelectorAll('a')];
    assert.equal(controls.length, 6);
    for (const link of controls) {
      const target = new URL(link.href);
      assert.ok(target.href.startsWith(prefix));
      assert.equal(target.searchParams.get('lang'), 'en');
      assert.equal(target.searchParams.get('artReview'), 'industrial-roster-v3');
      assert.equal(target.searchParams.has('seed'), false);
      assert.equal(target.searchParams.has('return'), false);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener');
      assert.match(link.getAttribute('aria-label'), /opens in another tab/);
    }
    const creator = doc.getElementById('overflight-studio-creator'),
      sound = doc.getElementById('overflight-studio-sounds'),
      voices = doc.getElementById('overflight-studio-voices');
    assert.equal(
      new URL(creator.href).pathname,
      new URL(`${prefix}game/studio/${studio}`).pathname,
    );
    assert.equal(new URL(sound.href).searchParams.get('studio'), 'sounds');
    assert.equal(new URL(voices.href).hash, '#reaction-voice-editor-panel');
    sound.focus();
    locale = 'uk';
    owner.refresh();
    assert.equal(doc.activeElement, sound, 'Locale refresh preserves the focused link.');
    assert.match(sound.getAttribute('aria-label'), /Студія звуку/);
    assert.equal(new URL(sound.href).searchParams.get('lang'), 'uk');
    sound.emit('click');
    assert.equal(paused, 1);
    assert.equal(musicOpened, 0);
    doc.getElementById('overflight-studio-music').emit('click');
    assert.equal(musicOpened, 1);
    assert.equal(paused, 1, 'Music host owns its own pause and modal lifecycle.');
    owner.dispose();
    sound.emit('click');
    assert.equal(paused, 1, 'Disposed links retain no host callbacks.');
    assert.equal(root.children.length, 0);
  });

  test(`${mode}: Studio controls live inside the real Settings slot`, async () => {
    const tree = parse(await readFile(new URL(`../overflight/${page}`, import.meta.url), 'utf8'));
    let studios = null;
    function visit(node) {
      if (node.attrs?.some(({ name, value }) => name === 'id' && value === 'overflight-studios'))
        studios = node;
      node.childNodes?.forEach(visit);
    }
    visit(tree);
    assert.ok(studios);
    const ancestors = [];
    for (let node = studios.parentNode; node; node = node.parentNode)
      ancestors.push(node.attrs?.find(({ name }) => name === 'id')?.value);
    assert.ok(ancestors.includes('overflight-settings'));
  });
}
