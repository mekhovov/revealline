import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMusicCredit } from '../ui/music-credit.mjs';
import { Document } from './helpers/couch-dom.mjs';

function setup() {
  const doc = new Document(),
    pause = doc.createElement('button');
  pause.textContent = 'Pause';
  pause.setAttribute('aria-label', 'Pause game');
  pause.setAttribute('aria-description', 'Existing instruction');
  doc.body.append(pause);
  pause.focus();
  let clicks = 0;
  pause.onclick = () => clicks++;
  const credit = attachMusicCredit({
    document: doc,
    root: doc.body,
    pauseButton: pause,
    prefix: 'test',
  });
  return { doc, pause, credit, clicks: () => clicks };
}
const recording = {
  title: 'Orchard night',
  artist: 'Original artist',
  fileName: 'original mix 01.mp3',
  kind: 'mp3',
  websites: [{ url: 'javascript:alert(1)' }, { url: 'https://artist.example/music' }],
};
test('track changes expose complete metadata without replacing Pause or moving focus', () => {
  const f = setup(),
    initial = f.credit.element;
  f.credit.render({ track: recording, playing: true, volume: 1 }, { muted: false, volume: 1 });
  assert.equal(f.doc.activeElement, f.pause);
  assert.equal(f.pause.textContent, 'Pause');
  assert.equal(f.pause.getAttribute('aria-label'), 'Pause game');
  assert.equal(f.pause.getAttribute('data-track-caption'), '♪ Orchard night');
  assert.match(initial.textContent, /Original artist/);
  assert.match(initial.textContent, /original mix 01.mp3/);
  assert.equal(initial.querySelector('a').getAttribute('href'), 'https://artist.example/music');
  f.credit.render(
    { track: { ...recording, title: 'Another track' }, playing: true, volume: 1 },
    { muted: true, volume: 1 },
  );
  assert.equal(f.credit.element, initial);
  assert.equal(f.doc.activeElement, f.pause);
  assert.equal(f.pause.getAttribute('data-track-caption'), 'Muted: Another track');
  assert.equal(f.clicks(), 0);
  f.pause.click();
  assert.equal(f.clicks(), 1);
  f.credit.dispose();
  f.credit.render({ track: recording });
  assert.equal(f.pause.getAttribute('aria-description'), 'Existing instruction');
  assert.equal(f.pause.getAttribute('data-track-caption'), null);
  assert.equal(f.doc.contains(initial), false);
});
test('missing credits, synthesis and unsafe websites have truthful non-link fallbacks', () => {
  const f = setup();
  f.credit.render({
    track: {
      kind: 'synth',
      title: 'Soft signal',
      rights: { source: 'https://user:password@artist.example' },
    },
  });
  assert.match(f.credit.element.textContent, /Artist not recorded/);
  assert.match(f.credit.element.textContent, /Built-in synthesized music/);
  assert.match(f.credit.element.textContent, /Source website not recorded/);
  assert.equal(f.credit.element.querySelector('a').getAttribute('href'), null);
  f.credit.render({
    track: { kind: 'mp3', title: '<img src=x>', rights: { source: 'https://artist.example' } },
  });
  assert.match(f.credit.element.textContent, /Original filename not recorded/);
  assert.equal(f.credit.element.querySelectorAll('img').length, 0);
  assert.equal(f.credit.element.querySelector('a').getAttribute('href'), 'https://artist.example/');
  f.credit.dispose();
});
