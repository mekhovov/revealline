import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element } from './helpers/couch-dom.mjs';
import { createReferenceScrollAdapter, attachReferenceMedia } from '../ui/authoring-reference.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

test('reference reading scrolls by bounded viewport steps, exits, and invalidates when hidden', () => {
  const doc = new Document(),
    button = new Element(doc, 'button'),
    moves = [];
  doc.body.append(button);
  const adapter = createReferenceScrollAdapter(button, {
    innerHeight: 800,
    scrollBy: (delta) => moves.push(delta),
  });
  assert.equal(adapter.enter(), true);
  assert.equal(adapter.isCurrent(), true);
  adapter.handle({ direction: 'down' });
  adapter.handle({ direction: 'left' });
  assert.deepEqual(moves, [
    { left: 0, top: 480, behavior: 'instant' },
    { left: -480, top: 0, behavior: 'instant' },
  ]);
  assert.equal(adapter.handle({ back: true }), 'cancel');
  adapter.exit();
  assert.equal(adapter.isCurrent(), false);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  adapter.enter();
  doc.hidden = true;
  assert.equal(adapter.isCurrent(), false);
});

function mediaFixture() {
  const doc = new Document(),
    media = new Element(doc, 'audio');
  Object.assign(media, {
    paused: true,
    muted: false,
    controls: true,
    currentTime: 0,
    duration: 120,
    playCalls: 0,
    pauseCalls: 0,
    async play() {
      this.playCalls++;
      this.paused = false;
    },
    pause() {
      this.pauseCalls++;
      this.paused = true;
    },
  });
  doc.body.append(media);
  const owner = attachReferenceMedia(media),
    [play, mute, seek] = media.nextSibling.children;
  return { doc, media, owner, play, mute, seek };
}

test('reference media needs explicit play, supports mute/seek and restores native controls on disposal', async () => {
  const { media, owner, play, mute, seek } = mediaFixture();
  assert.equal(media.playCalls, 0);
  assert.equal(media.controls, false);
  await play.onclick();
  assert.equal(media.paused, false);
  mute.onclick();
  assert.equal(media.muted, true);
  seek.value = '150';
  seek.oninput();
  assert.equal(media.currentTime, 120);
  await play.onclick();
  assert.equal(media.paused, true);
  owner.destroy();
  assert.equal(media.controls, true);
  assert.equal(media.nextSibling, null);
  assert([...media.listeners.values()].every((listeners) => listeners.size === 0));
});

test('reference media releases a pending playback request when its scope is paused or destroyed', async () => {
  const { media, owner, play } = mediaFixture();
  let finish;
  media.play = () =>
    new Promise((resolve) => {
      finish = () => {
        media.paused = false;
        resolve();
      };
    });
  const pending = play.onclick();
  owner.pause();
  finish();
  await pending;
  assert.equal(media.paused, true);
  const next = play.onclick();
  owner.destroy();
  finish();
  await next;
  assert.equal(media.paused, true);
  assert.equal(media.controls, true);
});

test('reference media position and state labels follow EN/UK/EN without seeking or changing playback', async () => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  const { doc, media, owner, play, mute, seek } = mediaFixture();
  try {
    await play.onclick();
    mute.onclick();
    seek.focus();
    seek.value = '42';
    for (const locale of ['en', 'uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.equal(
        seek.getAttribute('aria-label'),
        locale === 'uk' ? 'Позиція відтворення' : 'Playback position',
      );
      assert.equal(play.textContent, locale === 'uk' ? 'Пауза' : 'Pause');
      assert.equal(mute.textContent, locale === 'uk' ? 'Увімкнути звук' : 'Unmute');
      assert.equal(doc.activeElement, seek);
      assert.equal(seek.value, '42');
      assert.equal(media.currentTime, 0);
      assert.equal(media.paused, false);
      assert.equal(media.muted, true);
      assert.equal(media.playCalls, 1);
      assert.equal(media.pauseCalls, 0);
    }
    seek.oninput();
    assert.equal(media.currentTime, 42);
    await play.onclick();
    assert.equal(media.paused, true);
  } finally {
    owner.destroy();
    setLocale(previous, { persist: false });
  }
});
