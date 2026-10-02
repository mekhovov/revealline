import { createHuntDestruction } from '../../game/hunt/destruction.mjs';
import { huntDestructionBudget } from '../../game/hunt/destruction-budget.mjs';
import { HUNT_PRESENTATION_CATALOG } from '../../game/hunt/presentation-catalog.mjs';
import { drawCombatScrap } from '../../game/ui/combat-presentation.mjs';
import { Soundscape } from '../../game/ui/audio.mjs';
import { dialogueChannel } from '../../game/ui/dialogue-channel.mjs';
import { REACTION_VOICE_PILOT } from '../../game/audio/reactions/pilot.mjs';
import { createReactionVoiceCache } from '../../game/journey/reaction-voice-cache.mjs';
import { createReactionVoiceLibrary } from '../../game/journey/reaction-voice-library.mjs';

const status = document.querySelector('#status'),
  report = document.querySelector('#report');
const buttons = [...document.querySelectorAll('button:not(#cancel)')];
const cancel = document.querySelector('#cancel'),
  results = {};
let operation = null;
const aborted = () => new DOMException('Review operation cancelled.', 'AbortError');
const check = (signal) => {
  if (signal.aborted) throw aborted();
};
const nextFrame = (signal) =>
  new Promise((resolve, reject) => {
    check(signal);
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(aborted());
    };
    const frame = requestAnimationFrame((time) => {
      signal.removeEventListener('abort', abort);
      resolve(time);
    });
    signal.addEventListener('abort', abort, { once: true });
  });
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)] ?? null,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null,
    max: sorted.at(-1) ?? null,
  };
};
function publish() {
  report.textContent = JSON.stringify(
    {
      observedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      presentationCatalog: HUNT_PRESENTATION_CATALOG.version,
      scope: 'Explicit desktop review; no suite verdict or listening approval.',
      results,
    },
    null,
    2,
  );
}
async function run(name, work) {
  if (operation) return;
  operation = new AbortController();
  buttons.forEach((button) => (button.disabled = true));
  cancel.disabled = false;
  status.textContent = `${name} in progress…`;
  try {
    results[name] = await work(operation.signal);
    status.textContent = `${name} observations recorded.`;
  } catch (error) {
    results[name] = { error: error.message, cancelled: error.name === 'AbortError' };
    status.textContent = `${name}: ${error.message}`;
  } finally {
    operation = null;
    buttons.forEach((button) => (button.disabled = false));
    cancel.disabled = true;
    publish();
  }
}
cancel.onclick = () => operation?.abort();
addEventListener('pagehide', () => operation?.abort());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) operation?.abort();
});

async function destruction(signal, reduced) {
  const ctx = document.querySelector('#scene').getContext('2d');
  const blood = document.querySelector('#graphic').checked;
  const owners = [{}, {}],
    boards = owners.map(() => createHuntDestruction());
  let preemptions = 0;
  const preview = createHuntDestruction({ preview: true, onPreempt: () => preemptions++ });
  const view = () => ({ valid: true, status: 'running', tick: 0, eliminations: [] });
  const views = [view(), view()],
    previewView = view(),
    previewOwner = {};
  const marks = (cycle) =>
    Array.from({ length: 24 }, (_, i) => ({
      id: `${cycle}-${i}`,
      kind: i % 2 ? 'guard' : 'runner',
      cause: i % 3 ? 'capture' : 'ram',
      x: 4 + (i % 8) * 3,
      y: 4 + Math.floor(i / 8) * 5,
      tick: cycle * 24,
    }));
  const options = (index) => ({
    key: owners[index],
    brutal: true,
    blood,
    reduced,
    sources: [{ x: 3, y: 4, direction: 'right' }],
  });
  const durations = [],
    intervals = [],
    maxByBoard = [
      { particles: 0, envelopes: 0 },
      { particles: 0, envelopes: 0 },
    ];
  let previous = null,
    maxParticles = 0,
    maxEnvelopes = 0,
    maxAllocated = 0,
    maxOwners = 0;
  const began = performance.now();
  try {
    preview.advance(previewView, 0, { key: previewOwner, brutal: true, blood });
    previewView.eliminations = marks('preview');
    preview.advance(previewView, 0, { key: previewOwner, brutal: true, blood });
    const previewAllocation = preview.snapshot();
    for (let frame = 0; frame < 180; frame++) {
      const now = await nextFrame(signal),
        start = performance.now();
      if (previous !== null) intervals.push(now - previous);
      const dt = previous === null ? 0 : Math.min(0.1, (now - previous) / 1000);
      previous = now;
      const cycle = Math.floor(frame / 24);
      if (frame % 24 === 0)
        for (let index = 0; index < 2; index++) {
          boards[index].reset();
          views[index].eliminations = [];
          boards[index].advance(views[index], 0, options(index));
          views[index].eliminations = marks(cycle);
        }
      ctx.fillStyle = '#202c36';
      ctx.fillRect(0, 0, 960, 320);
      for (let index = 0; index < 2; index++) {
        views[index].tick = frame;
        boards[index].advance(views[index], dt, options(index));
        ctx.save();
        ctx.translate(index * 480, 0);
        drawCombatScrap(
          ctx,
          views[index],
          {},
          { screenScale: 1, showScrap: true, brutal: true, blood, reduced },
        );
        boards[index].draw(ctx);
        ctx.restore();
      }
      // A settings/Studio preview must not gain an extra slot beside active gameplay.
      previewView.eliminations = [...marks(`preview-${frame}`)];
      preview.advance(previewView, dt, { key: previewOwner, brutal: true, blood, reduced });
      preview.draw(ctx);
      const snapshots = boards.map((board) => board.snapshot()),
        allocation = huntDestructionBudget.snapshot();
      maxParticles = Math.max(
        maxParticles,
        snapshots.reduce((sum, s) => sum + s.particles, preview.snapshot().particles),
      );
      maxEnvelopes = Math.max(
        maxEnvelopes,
        snapshots.reduce((sum, s) => sum + s.envelopes, preview.snapshot().envelopes),
      );
      maxAllocated = Math.max(maxAllocated, allocation.particles);
      maxOwners = Math.max(maxOwners, allocation.owners);
      snapshots.forEach((snapshot, index) => {
        for (const field of ['particles', 'envelopes'])
          maxByBoard[index][field] = Math.max(maxByBoard[index][field], snapshot[field]);
      });
      durations.push(performance.now() - start);
    }
    const beforePause = boards.map((board) => board.snapshot());
    boards.forEach((board, index) => {
      board.advance(views[index], 0.1, { ...options(index), paused: true });
      board.draw(ctx);
    });
    preview.reset();
    const afterPause = boards.map((board) => board.snapshot());
    // Final screenshot guides are outside the measured frame loop.
    ctx.save();
    ctx.strokeStyle = '#607386';
    ctx.lineWidth = 1;
    for (const x of [0.5, 480.5, 959.5]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 320);
      ctx.stroke();
    }
    ctx.fillStyle = '#edf3f8';
    ctx.font = '14px system-ui';
    ctx.fillText('Board 1 · 30 × 20 cells · 16 px/cell', 12, 22);
    ctx.fillText('Board 2 · 30 × 20 cells · 16 px/cell', 492, 22);
    ctx.restore();
    boards.forEach((board) => board.reset());
    return {
      reduced,
      blood,
      frames: 180,
      settledClustersPerBoard: 24,
      simultaneousBoards: 2,
      canvasPixels: [960, 320],
      cellPixels: 16,
      boardWorldCells: [30, 20],
      elapsedMs: performance.now() - began,
      drawCpuMs: stats(durations),
      rafIntervalMs: stats(intervals),
      maxParticles,
      maxEnvelopes,
      maxAllocated,
      maxOwners,
      maxByBoard,
      previewAllocation,
      previewPreemptions: preemptions,
      beforePause,
      afterPause,
      afterReset: huntDestructionBudget.snapshot(),
      limitation:
        'Synthetic Canvas presentation workload; not a full gameplay frame benchmark or low-end qualification.',
    };
  } finally {
    boards.forEach((board) => board.reset());
    preview.reset();
  }
}

async function silentSound() {
  const sound = new Soundscape();
  if (!sound.setup()) throw new Error('Web Audio is unavailable.');
  // No source is connected to an audible destination during review operations.
  sound.master.disconnect();
  const silence = sound.context.createGain();
  silence.gain.value = 0;
  silence.connect(sound.context.destination);
  sound.master.connect(silence);
  sound.enabled = true;
  sound.configureDialogue({ enabled: true, volume: 0.65 });
  sound.applyVolumes();
  await sound.context.resume();
  return sound;
}
const bundledLibrary = () => createReactionVoiceLibrary({ indexedDB: null, channelName: null });
async function pilot(signal) {
  const sound = await silentSound(),
    library = bundledLibrary();
  const cache = createReactionVoiceCache({ sound, library });
  let index = 0,
    maxLoading = 0;
  const clips = [],
    began = performance.now();
  try {
    const worker = async () => {
      while (index < REACTION_VOICE_PILOT.length) {
        check(signal);
        const clip = REACTION_VOICE_PILOT[index++],
          started = performance.now();
        const loading = cache.load(clip.lineId, clip.locale);
        maxLoading = Math.max(maxLoading, cache.snapshot().loading);
        const loaded = await loading;
        check(signal);
        const buffer = cache.get(clip.lineId, clip.locale);
        clips.push({
          lineId: clip.lineId,
          locale: clip.locale,
          file: clip.file,
          containerBytes: clip.bytes,
          loaded,
          elapsedMs: performance.now() - started,
          duration: buffer?.duration,
          channels: buffer?.numberOfChannels,
          sampleRate: buffer?.sampleRate,
          decodedBytes: buffer ? buffer.length * buffer.numberOfChannels * 4 : null,
        });
      }
    };
    const abort = () => void cache.cancel();
    signal.addEventListener('abort', abort, { once: true });
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      signal.removeEventListener('abort', abort);
    }
    const buffer = cache.get(REACTION_VOICE_PILOT[0].lineId, 'en'),
      lifecycle = {};
    const first = sound.playDialogue(buffer);
    lifecycle.firstOwner = dialogueChannel.snapshot();
    const second = sound.playDialogue(buffer);
    lifecycle.replacement = {
      firstEnded: first?.ended,
      secondActive: !!second && !second.ended,
      channel: dialogueChannel.snapshot(),
    };
    sound.feedbackDirector.load('warning');
    await sound.feedbackDirector.pending.get('warning');
    check(signal);
    const warning = sound.feedbackDirector.play('warning', { priority: 5 });
    lifecycle.warning = {
      warningSourceStarted: !!warning,
      dialogueEnded: second?.ended,
      channel: dialogueChannel.snapshot(),
    };
    sound.stopVoices();
    const pausedVoice = sound.playDialogue(buffer);
    sound.pause();
    lifecycle.pause = {
      dialogueEnded: pausedVoice?.ended,
      channel: dialogueChannel.snapshot(),
      voices: sound.voices.size,
    };
    const missingLibrary = createReactionVoiceLibrary({
      indexedDB: null,
      channelName: null,
      fetch: async () => new Response('', { status: 404 }),
    });
    const missingCache = createReactionVoiceCache({ sound, library: missingLibrary });
    lifecycle.missingRecording = {
      loaded: await missingCache.load(REACTION_VOICE_PILOT[0].lineId, 'en'),
      cache: missingCache.snapshot(),
    };
    missingCache.dispose();
    missingLibrary.close();
    const beforeDispose = cache.snapshot();
    cache.dispose();
    await cache.ready();
    library.close();
    await sound.dispose();
    return {
      elapsedMs: performance.now() - began,
      clips: clips.sort((a, b) => a.file.localeCompare(b.file)),
      maxLoading,
      beforeDispose,
      afterDispose: cache.snapshot(),
      contextReleased: sound.context === null,
      lifecycle,
      limitation:
        'Silent browser decoding and source lifecycle only; pronunciation, audibility, quality, and human transcription are unqualified.',
    };
  } finally {
    cache.dispose();
    library.close();
    await sound.dispose();
  }
}
function wav(buffer) {
  const samples = buffer.getChannelData(0),
    bytes = new ArrayBuffer(44 + samples.length * 2),
    data = new DataView(bytes);
  const text = (offset, value) =>
    [...value].forEach((character, index) =>
      data.setUint8(offset + index, character.charCodeAt(0)),
    );
  text(0, 'RIFF');
  data.setUint32(4, bytes.byteLength - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, buffer.sampleRate, true);
  data.setUint32(28, buffer.sampleRate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  text(36, 'data');
  data.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) =>
    data.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true),
  );
  return new Blob([bytes], { type: 'audio/wav' });
}
async function persistence(signal) {
  const name = `revealline-review-only-${crypto.randomUUID()}`,
    sound = await silentSound();
  const open = () =>
    createReactionVoiceLibrary({
      indexedDB: { open: (_name, version) => indexedDB.open(name, version) },
      channelName: null,
    });
  let library = open(),
    result = { temporaryDatabase: name, productionDatabaseWritten: false };
  try {
    const clip = REACTION_VOICE_PILOT[0],
      original = await library.resolve(clip.lineId, clip.locale, { signal });
    const buffer = await sound.context.decodeAudioData(original.bytes.slice(0));
    check(signal);
    const replacement = await library.replace({
      lineId: clip.lineId,
      locale: clip.locale,
      blob: wav(buffer),
      duration: buffer.duration,
      kind: 'generated',
      credit:
        'Disposable review: PCM copy of original Apple-generated pilot, unchanged transcript.',
      signal,
    });
    const exportText = await library.exportBundle();
    library.close();
    library = open();
    const reopened = await library.describe(clip.lineId, clip.locale),
      active = await library.resolve(clip.lineId, clip.locale, { signal });
    await library.select(clip.lineId, clip.locale, null);
    const restored = await library.resolve(clip.lineId, clip.locale, { signal });
    const imported = await library.importBundle(exportText, { signal });
    const afterImport = await library.describe(clip.lineId, clip.locale);
    result = {
      ...result,
      lineId: clip.lineId,
      locale: clip.locale,
      originalHash: original.sha256,
      replacementHash: replacement.active,
      activeHashAfterReopen: active.sha256,
      retainedRevisionsAfterReopen: reopened.revisions.length,
      archivedOriginalHash: reopened.original.sha256,
      restoredHash: restored.sha256,
      importedRecords: imported,
      activeHashAfterImport: afterImport.active,
      revisionCountAfterImport: afterImport.revisions.length,
      bundleBytes: new TextEncoder().encode(exportText).length,
    };
  } finally {
    library.close();
    await sound.dispose();
    result.cleanup = await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve('temporary database deleted');
      request.onerror = () => resolve(`delete error: ${request.error?.message}`);
      request.onblocked = () => resolve('delete blocked');
    });
  }
  return result;
}
document.querySelector('#measure-destruction').onclick = () =>
  run('destruction', (signal) => destruction(signal, false));
document.querySelector('#measure-reduced').onclick = () =>
  run('reduced', (signal) => destruction(signal, true));
document.querySelector('#inspect-pilot').onclick = () => run('pilot', pilot);
document.querySelector('#inspect-persistence').onclick = () => run('persistence', persistence);
