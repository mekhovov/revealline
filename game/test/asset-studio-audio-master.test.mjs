import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element } from './helpers/couch-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { drawAssetPreview } from '../../authoring/asset-studio/preview.mjs';
import { attachStudioAuditionLifecycle } from '../../authoring/asset-studio/audition-lifecycle.mjs';
import { audioRecipePreview } from '../../authoring/asset-studio/scene-preview.mjs';

// Real preview ownership, media binding and Soundscape execute. DOM metadata and
// Web Audio scheduling are finite models: these are not decode/audibility tests.
class PreviewElement extends Element {
  constructor(doc, tag) {
    super(doc, tag);
    this.style.getPropertyValue = (key) => this.style[key] || '';
    this.style.removeProperty = (key) => delete this.style[key];
    this.volume = 1;
    this.muted = false;
    this.readyState = 0;
    this.paused = true;
    this.currentTime = 0;
    this.plays = 0;
  }
  play() {
    this.plays++;
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute(key) {
    super.removeAttribute(key);
    if (key === 'src') this.src = '';
  }
}

function boundary(t) {
  const doc = new Document(),
    savedGlobals = new Map(),
    urls = new Map(),
    revoked = [],
    frames = new Map();
  let sequence = 0;
  doc.createElement = (tag) => new PreviewElement(doc, tag);
  const replace = (key, value) => {
    if (!savedGlobals.has(key))
      savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  replace('document', doc);
  replace('requestAnimationFrame', (fn) => {
    frames.set(++sequence, fn);
    return sequence;
  });
  replace('cancelAnimationFrame', (id) => frames.delete(id));
  const originalCreate = URL.createObjectURL,
    originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => {
    const url = `blob:studio-master-${++sequence}`;
    urls.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
    urls.delete(url);
  };
  const cleanups = [];
  t.after(() => {
    for (const cleanup of cleanups.reverse()) cleanup();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { doc, urls, revoked, frames, replace, own: (fn) => cleanups.push(fn) };
}

function mediaPreview(h, audioMaster, label) {
  const surface = h.doc.createElement('div'),
    status = h.doc.createElement('p'),
    cancel = h.doc.createElement('button'),
    original = new Blob([`${label} metadata fixture`]),
    resolved = resolvePresentation(createDefaultThemeBundle());
  h.doc.body.append(surface, status, cancel);
  h.own(() => surface.previewCleanup?.());
  const draw = () =>
    drawAssetPreview(
      surface,
      { id: 'audio.music', group: 'audio', label: 'Music original' },
      { kind: 'audio', file: { sha256: label } },
      resolved,
      new Map([[label, original]]),
      {
        mode: 'native',
        background: 'checker',
        audioMaster,
        label,
        statusTarget: status,
        cancelButton: cancel,
      },
    );
  const ready = async (pending) => {
    const media = surface.querySelector('audio');
    media.readyState = 1;
    media.emit('loadedmetadata');
    await pending;
    return media;
  };
  return { surface, status, cancel, original, draw, ready };
}

test('saved and draft native auditions share master output while keeping independent local faders and cleanup', async (t) => {
  const h = boundary(t),
    master = createAudioMaster({ muted: false, volume: 0.5 }),
    saved = mediaPreview(h, master, 'Saved preview'),
    draft = mediaPreview(h, master, 'Draft preview');
  const a = await saved.ready(saved.draw()),
    b = await draft.ready(draft.draw());
  assert.equal(a.plays + b.plays, 0, 'Preparing metadata never starts either audition');
  assert.equal(h.urls.size, 2);
  assert.equal(h.urls.get(a.src), saved.original);
  assert.equal(h.urls.get(b.src), draft.original);
  await a.play();
  await b.play();
  a.currentTime = 4;
  b.currentTime = 9;
  const local = saved.surface.querySelector('input');
  local.value = '0.4';
  local.oninput();
  assert.equal(a.volume, 0.2);
  assert.equal(b.volume, 0.5);
  master.setMuted(true);
  master.setVolume(0.25);
  assert.equal(a.muted, true);
  assert.equal(b.muted, true);
  assert.equal(a.volume, 0.1);
  assert.equal(b.volume, 0.25);
  assert.deepEqual([a.paused, b.paused, a.currentTime, b.currentTime], [false, false, 4, 9]);
  a.volume = 1;
  a.muted = false;
  a.emit('volumechange');
  assert.equal(a.volume, 0.1);
  assert.equal(a.muted, true);
  assert.equal(local.value, '0.4');
  const oldURL = a.src,
    next = saved.draw();
  assert.equal(a.muted, true);
  assert.equal(a.paused, true);
  assert.equal(a.src, '');
  assert.deepEqual(h.revoked, [oldURL]);
  const c = await saved.ready(next);
  master.setMuted(false);
  master.setVolume(0.8);
  assert.equal(a.volume, 0.1, 'Replaced media no longer follows the authority');
  assert.equal(a.muted, true);
  assert.equal(b.volume, 0.8);
  assert.equal(b.muted, false);
  assert.equal(b.plays, 1, 'Replacing saved preview does not resume draft');
  assert.equal(c.plays, 0);
  assert.equal(c.volume, 0.8);
  assert.equal(h.urls.size, 2);
});

test('Stop waiting releases a pending native preview and late metadata cannot restore sound or output', async (t) => {
  const h = boundary(t),
    master = createAudioMaster({ muted: false, volume: 0.5 }),
    preview = mediaPreview(h, master, 'Pending preview'),
    pending = preview.draw(),
    media = preview.surface.querySelector('audio'),
    lateReady = [...media.listeners.get('loadedmetadata')][0];
  preview.cancel.onclick();
  assert.equal(media.muted, true);
  assert.equal(media.paused, true);
  assert.equal(media.src, '');
  assert.equal(h.urls.size, 0);
  master.setVolume(1);
  master.setMuted(false);
  lateReady();
  await pending;
  assert.equal(media.muted, true);
  assert.equal(media.volume, 0.5);
  assert.equal(media.plays, 0);
  assert.equal(media.src, '');
  assert.equal(preview.status.dataset.state, 'detached');
  assert.equal(h.revoked.length, 1);
});

function recipePreview(h, master, id) {
  const audio = audioHarness(),
    pending = deferred(),
    gains = [],
    createGain = audio.context.createGain.bind(audio.context),
    surface = h.doc.createElement('div');
  h.own(() => audio.soundscape.dispose());
  audio.context.createGain = () => {
    const node = createGain();
    gains.push(node);
    return node;
  };
  audio.context.resume = () =>
    pending.promise.then(() => {
      if (audio.context.state !== 'closed') audio.context.state = 'running';
    });
  h.replace('AudioContext', function () {
    return audio.context;
  });
  h.doc.body.append(surface);
  let cleanup;
  audioRecipePreview(
    surface,
    { id, label: 'Registered audio' },
    (fn) => {
      cleanup = fn;
      h.own(fn);
    },
    { audioMaster: master },
  );
  const [play, stop] = surface.querySelectorAll('button');
  return { ...audio, surface, gains, pending, play, stop, cleanup };
}

for (const id of ['audio.music', 'audio.capture']) {
  test(`${id} keeps the shared mute gate through delayed context resume and retains its local attenuation`, async (t) => {
    const h = boundary(t),
      master = createAudioMaster({ muted: false, volume: 0.5 }),
      recipe = recipePreview(h, master, id),
      starting = recipe.play.onclick();
    master.setMuted(true);
    assert.equal(recipe.gains[0].gain.value, 0);
    recipe.pending.resolve();
    await starting;
    assert.equal(recipe.gains[0].gain.value, 0);
    assert.match(recipe.surface.textContent, /master sound is muted/);
    const voices = recipe.sources.length;
    master.setMuted(false);
    assert.equal(recipe.gains[0].gain.value, 0.175, '35% audition × 50% master');
    assert.equal(recipe.sources.length, voices, 'Unmute does not schedule a new audition');
    assert.doesNotMatch(
      recipe.surface.textContent,
      /master sound is muted/,
      'Unmute repaints the active audition caption.',
    );
    recipe.stop.onclick();
    master.setVolume(1);
    assert.equal(recipe.gains[0].gain.value, 0);
    assert.equal(recipe.context.state, 'suspended');
    assert.equal(h.frames.size, 0);
  });

  test(`${id} teardown before context readiness fences late procedural playback`, async (t) => {
    const h = boundary(t),
      master = createAudioMaster({ muted: false, volume: 0.5 }),
      recipe = recipePreview(h, master, id),
      starting = recipe.play.onclick();
    recipe.cleanup();
    recipe.pending.resolve();
    await starting;
    master.setVolume(1);
    assert.equal(recipe.context.state, 'closed');
    assert.equal(recipe.sources.length, 0);
    assert.equal(recipe.gains[0].gain.value, 0);
    assert.equal(h.frames.size, 0);
    assert.doesNotMatch(recipe.surface.textContent, /Playing the registered/);
  });
}

test('hidden Studio native auditions retire both previews and return requires explicit Play', async (t) => {
  const h = boundary(t),
    master = createAudioMaster({ muted: false, volume: 0.5 }),
    previews = [
      mediaPreview(h, master, 'Saved lifecycle'),
      mediaPreview(h, master, 'Draft lifecycle'),
    ];
  let draws = [];
  const lifecycle = attachStudioAuditionLifecycle({
    document: h.doc,
    isAudition: () => true,
    stop: () => previews.forEach(({ surface }) => surface.previewCleanup()),
    restore: () => {
      draws = previews.map((preview) => preview.draw());
    },
  });
  h.own(() => lifecycle.dispose());
  const a = await previews[0].ready(previews[0].draw()),
    b = await previews[1].ready(previews[1].draw());
  for (const [index, volume] of [0.4, 0.8].entries()) {
    const fader = previews[index].surface.querySelector('input');
    fader.value = String(volume);
    fader.oninput();
  }
  await a.play();
  await b.play();
  assert.deepEqual([a.volume, b.volume], [0.2, 0.4]);
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.deepEqual([a.paused, b.paused, a.muted, b.muted], [true, true, true, true]);
  assert.deepEqual([a.src, b.src], ['', '']);
  assert.equal(h.urls.size, 0);
  assert.equal(h.revoked.length, 2);
  master.setMuted(true);
  master.setVolume(0.9);
  master.setMuted(false);
  assert.equal(a.muted && b.muted, true, 'Authority changes cannot reopen disposed auditions.');
  assert.equal(a.plays + b.plays, 2);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  const c = await previews[0].ready(draws[0]),
    d = await previews[1].ready(draws[1]);
  assert.deepEqual([c.plays, d.plays, c.volume, d.volume], [0, 0, 0.9, 0.9]);
  assert.equal(h.urls.size, 2);
  await c.play();
  assert.equal(c.plays, 1);
  assert.equal(d.plays, 0, 'The other preview retains independent playback intent.');
});

test('hidden interruption settles pending metadata and fences its late callback', async (t) => {
  const h = boundary(t),
    master = createAudioMaster({ muted: false, volume: 0.5 }),
    preview = mediaPreview(h, master, 'Pending hidden lifecycle'),
    pending = preview.draw(),
    media = preview.surface.querySelector('audio'),
    lateReady = [...media.listeners.get('loadedmetadata')][0];
  let restored = 0;
  const lifecycle = attachStudioAuditionLifecycle({
    document: h.doc,
    isAudition: () => true,
    stop: () => preview.surface.previewCleanup(),
    restore: () => restored++,
  });
  h.own(() => lifecycle.dispose());
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  await pending;
  master.setMuted(false);
  lateReady();
  assert.deepEqual([media.plays, media.paused, media.muted, media.src], [0, true, true, '']);
  assert.equal(h.urls.size, 0);
  assert.equal(preview.surface.previewMarker, null);
  lifecycle.dispose();
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(restored, 0, 'Terminal disposal suppresses deferred restoration.');
});

test('audition lifecycle ignores focus, non-audio slots and duplicate events, and retires its listener', () => {
  const doc = new Document();
  let audio = false,
    stopped = 0,
    restored = 0;
  const lifecycle = attachStudioAuditionLifecycle({
    document: doc,
    isAudition: () => audio,
    stop: () => stopped++,
    restore: () => restored++,
  });
  doc.hidden = true;
  doc.emit('visibilitychange');
  doc.hidden = false;
  doc.emit('visibilitychange');
  assert.deepEqual([stopped, restored], [0, 0]);
  audio = true;
  doc.emit('blur');
  assert.equal(stopped, 0, 'File-picker focus loss does not interrupt a visible audition.');
  doc.hidden = true;
  doc.emit('visibilitychange');
  doc.emit('visibilitychange');
  assert.equal(stopped, 1);
  audio = false;
  doc.hidden = false;
  doc.emit('visibilitychange');
  assert.equal(restored, 0, 'A new non-audio selection owns its own preview.');
  audio = true;
  doc.hidden = true;
  doc.emit('visibilitychange');
  doc.hidden = false;
  doc.emit('visibilitychange');
  doc.emit('visibilitychange');
  assert.deepEqual([stopped, restored], [2, 1]);
  lifecycle.dispose();
  lifecycle.dispose();
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.deepEqual([stopped, restored], [2, 1]);
  assert.equal(doc.listeners.get('visibilitychange')?.size || 0, 0);
});

for (const id of ['audio.music', 'audio.capture']) {
  test(`${id} caption tracks only accepted playback and cannot replace idle/loading/Stop/error feedback`, async (t) => {
    const h = boundary(t),
      master = createAudioMaster({ muted: true, volume: 0.13 });
    const recipe = recipePreview(h, master, id);
    const caption = () => recipe.surface.querySelector('.operation-status-label').textContent;
    const changeOutput = () => {
      master.setMuted(!master.snapshot().muted);
      master.setVolume(0.5);
    };
    const idle = caption();
    changeOutput();
    assert.equal(caption(), idle);
    const pending = recipe.play.onclick();
    const loading = caption();
    assert.match(loading, /Preparing/);
    changeOutput();
    assert.equal(caption(), loading, 'Master changes do not turn pending playback into success.');
    recipe.stop.onclick();
    const stopped = caption();
    changeOutput();
    assert.equal(caption(), stopped);
    recipe.pending.resolve();
    await pending;
    assert.equal(caption(), stopped, 'Late Play cannot replace Stop.');
    recipe.context.resume = async () => {
      throw new Error('Denied fixture');
    };
    await recipe.play.onclick();
    const error = caption();
    assert.equal(error, 'Audio is unavailable.');
    changeOutput();
    assert.equal(caption(), error, 'Master changes preserve failure and explicit retry.');
    recipe.context.resume = async () => {
      recipe.context.state = 'running';
    };
    master.setMuted(true);
    await recipe.play.onclick();
    assert.match(caption(), /master sound is muted/);
    const sources = recipe.sources.length;
    master.setMuted(false);
    assert.equal(caption(), 'Playing the registered Soundscape recipe.');
    master.setVolume(0);
    assert.match(caption(), /volume is zero/);
    master.setVolume(0.13);
    assert.equal(caption(), 'Playing the registered Soundscape recipe.');
    assert.equal(recipe.sources.length, sources, 'Repainting never schedules another sound.');
    recipe.cleanup();
    const disposed = caption();
    changeOutput();
    assert.equal(caption(), disposed, 'Retired captions unsubscribe from the authority.');
  });
}

test('saved and draft recipe captions have independent playback ownership under one master', async (t) => {
  const h = boundary(t),
    master = createAudioMaster({ muted: true, volume: 0.13 });
  const saved = recipePreview(h, master, 'audio.capture');
  const startingSaved = saved.play.onclick();
  saved.pending.resolve();
  await startingSaved;
  const draft = recipePreview(h, master, 'audio.music');
  const startingDraft = draft.play.onclick();
  master.setMuted(false);
  assert.match(saved.surface.textContent, /Playing the registered/);
  assert.match(draft.surface.textContent, /Preparing/);
  draft.pending.resolve();
  await startingDraft;
  master.setMuted(true);
  assert.match(saved.surface.textContent, /master sound is muted/);
  assert.match(draft.surface.textContent, /master sound is muted/);
  saved.stop.onclick();
  master.setMuted(false);
  assert.match(saved.surface.textContent, /Audition stopped/);
  assert.doesNotMatch(saved.surface.textContent, /Playing the registered/);
  assert.match(draft.surface.textContent, /Playing the registered/);
});

test('native preview metadata statuses do not adopt procedural playback captions on master edits', async (t) => {
  const h = boundary(t),
    master = createAudioMaster({ muted: true, volume: 0.13 });
  const saved = mediaPreview(h, master, 'Native status saved'),
    draft = mediaPreview(h, master, 'Native status draft');
  const a = await saved.ready(saved.draw()),
    waiting = draft.draw();
  const pendingStatus = draft.status.textContent;
  await a.play();
  master.setMuted(false);
  assert.match(saved.status.textContent, /ready/);
  assert.equal(draft.status.textContent, pendingStatus);
  assert.equal(a.plays, 1);
  draft.surface.querySelector('audio').emit('error');
  await waiting;
  const failure = draft.status.textContent;
  assert.match(failure, /metadata could not be decoded/);
  master.setMuted(true);
  master.setVolume(0.5);
  assert.equal(draft.status.textContent, failure);
  assert.match(saved.status.textContent, /ready/);
  assert.equal(a.plays, 1, 'Native transport remains governed by its own controls.');
});
