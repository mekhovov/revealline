import { createCreatorStore, loadInstalledCreatorBundle } from './installed.mjs';
import { createCreatorRuntime, creatorAttemptKey, creatorProfileKey } from './runtime.mjs';
import { BoardPainter, boardPaintSizeForRun } from '../ui/render.mjs';
import { attachInput } from '../ui/input.mjs';
import { FIXED_DT } from '../core/index.mjs';
import { createJourneyProfileStore } from '../journey/profile.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { SESSION_STORAGE_BYTES } from '../sessions.mjs';
import { downloadCreatorFile } from './download.mjs';
import { createCreatorVictoryStoryHost } from './victory-story-host.mjs';
import { createCreatorPlayerVictoryStory } from './player-victory-story.mjs';

const $ = (id) => document.getElementById(id);
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
};
const fail = (error) => status(error.message || 'This operation could not finish.', true);
const store = createCreatorStore();
const edition = new URLSearchParams(location.search).get('edition');
let runtime,
  painter,
  input,
  profile,
  lease,
  pack,
  paused = true,
  busy = true,
  ended = false,
  savedRaw = null,
  accumulator = 0,
  previousTime = null,
  frameId,
  lastSaveTick = 0,
  pictureURL,
  pictureSha256,
  storyPlayer,
  nextMissionId = null;
const saveKey = creatorAttemptKey(edition);
function persistAttempt() {
  const attempt = runtime?.current();
  if (!attempt || !['running', 'respawning'].includes(attempt.run.status)) return;
  try {
    if (!lease?.writable) throw new Error(lease?.reason || 'Saving is unavailable.');
    const saved = JSON.stringify(runtime.suspend());
    if (new TextEncoder().encode(saved).length > SESSION_STORAGE_BYTES)
      throw new Error('Attempt exceeds the local save budget. Download it to keep it.');
    if (localStorage.getItem(saveKey) !== savedRaw)
      throw new Error(
        'The saved attempt changed in another tab. Download this attempt before reloading.',
      );
    localStorage.setItem(saveKey, saved);
    savedRaw = saved;
    $('save-status').textContent = 'Unfinished attempt saved on this device.';
  } catch (error) {
    $('save-status').textContent = `${error.message} Download the unfinished attempt to keep it.`;
  }
}
function pause() {
  if (!runtime?.current() || paused) return;
  paused = true;
  input?.clear();
  runtime.pause();
  accumulator = 0;
  persistAttempt();
  $('pause').textContent = 'Resume';
  status('Paused. Resume when you are ready.');
}
function setRunning() {
  paused = false;
  input.clear();
  previousTime = null;
  accumulator = 0;
  $('pause').textContent = 'Pause';
  $('arena').focus();
  status('Close a line on safe ground to reveal your picture.');
}
function updateControls() {
  const hasRun = !!runtime?.current();
  $('start').disabled = busy || !runtime || (hasRun && !ended);
  $('resume').hidden = !savedRaw || hasRun;
  $('resume').disabled = busy;
  $('pause').disabled = busy || !hasRun || ended;
  $('retry').disabled = busy || !hasRun;
  $('export-attempt').disabled = busy || !hasRun || ended;
  $('difficulty').disabled = busy || (hasRun && !ended);
  $('steering').disabled = busy || (hasRun && !ended);
  $('import-attempt').disabled = busy || !runtime;
  $('import-progress').disabled = busy || !profile;
  $('export-progress').disabled = busy || !profile;
  $('next').disabled = busy;
}
async function operation(action) {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    await action();
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    updateControls();
  }
}
async function showEarned(preferredMissionId = null) {
  const project = pack.manifest.content.project;
  const clears = profile.snapshot().clears.solo;
  const missions = preferredMissionId
    ? [
        project.missions.find(({ id }) => id === preferredMissionId),
        ...project.missions.filter(({ id }) => id !== preferredMissionId),
      ]
    : project.missions;
  const mission = missions.find(
    (candidate) => candidate && clears[candidate.id]?.gameplayId.startsWith(`${pack.editionId}:`),
  );
  if (!mission) {
    $('earned').hidden = true;
    return null;
  }
  const receipt = clears[mission.id];
  const picture = project.assets.find(({ id }) => id === mission.presentation.backgroundAssetId);
  const runtimePicture = pack.assets.find(({ sha256 }) => sha256 === picture?.sha256);
  if (!picture || !runtimePicture)
    throw new Error('The earned mission picture is missing from this installed edition.');
  if (pictureSha256 !== picture.sha256) {
    if (pictureURL) URL.revokeObjectURL(pictureURL);
    pictureURL = URL.createObjectURL(runtimePicture.blob);
    pictureSha256 = picture.sha256;
  }
  $('earned-picture').src = pictureURL;
  $('earned-picture').alt = picture.alt;
  if ($('earned-picture').parentElement !== $('creator-story-stage'))
    $('creator-story-stage').replaceChildren($('earned-picture'));
  $('earned-caption').textContent =
    `${mission.name} · completed on ${receipt.difficulty}. ${pack.manifest.content.credits.picture}`;
  $('earned').hidden = false;
  return Object.freeze({
    mission,
    posterAsset: picture,
    posterElement: $('earned-picture'),
  });
}
async function adoptDisplay(attempt, running) {
  storyPlayer?.reset();
  painter.setLevel(attempt.run.level, { seed: attempt.run.seed });
  await painter.setLook(attempt.theme, 'neutral-marker');
  const size = boardPaintSizeForRun(attempt.run);
  $('board').width = size.width;
  $('board').height = size.height;
  $('title').textContent =
    `${pack.review.name} · ${attempt.manifest.name ?? attempt.run.level.name}`;
  $('difficulty').value = attempt.selection.difficulty;
  $('steering').value = attempt.selection.turnPolicy;
  ended = false;
  nextMissionId = null;
  paused = true;
  lastSaveTick = attempt.run.tick;
  $('next').hidden = true;
  persistAttempt();
  if (running) setRunning();
  else {
    $('pause').textContent = 'Resume';
    status('Saved attempt restored. Press Resume to continue.');
  }
}
async function finish() {
  ended = true;
  paused = true;
  busy = true;
  updateControls();
  input.clear();
  if (runtime.current().run.status === 'won') {
    status('Picture revealed. Verifying your completion…');
    try {
      const receipt = await runtime.completion();
      profile.record(receipt);
      await profile.flush();
      const missionId = receipt.missionId,
        earned = await showEarned(missionId);
      nextMissionId = runtime.nextMissionId(missionId);
      status(
        nextMissionId
          ? 'Level complete. Your picture is saved; continue when you are ready.'
          : 'Campaign complete. Your pictures are in this campaign’s collection.',
      );
      $('next').hidden = false;
      $('next').textContent = nextMissionId ? 'Next level' : 'Back to my creations';
      if (earned)
        void storyPlayer.show({
          receipt,
          posterElement: earned.posterElement,
          posterAsset: earned.posterAsset,
        });
    } catch (error) {
      fail(error);
    }
  } else status('Try another crossing. Retry starts the same mission with the same rules.');
  try {
    if (
      lease.writable &&
      (runtime.current().run.status !== 'won' || profile.status().durable) &&
      localStorage.getItem(saveKey) === savedRaw
    ) {
      localStorage.removeItem(saveKey);
      savedRaw = null;
      if (runtime.current().run.status === 'won')
        $('save-status').textContent = 'Completion saved on this device.';
    }
  } catch {
    /* Progress export and Next remain available when local storage refuses access. */
  }
  busy = false;
  updateControls();
}
function frame(time) {
  frameId = requestAnimationFrame(frame);
  const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;
  const attempt = runtime?.current();
  if (!attempt || !painter) return;
  if (!paused && !busy && !ended) {
    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      const command = input.poll();
      if (paused || busy || ended) break;
      runtime.step(command);
      accumulator -= FIXED_DT;
      if (['won', 'lost'].includes(attempt.run.status)) {
        void finish();
        break;
      }
    }
    if (!ended && attempt.run.tick - lastSaveTick >= 600) {
      lastSaveTick = attempt.run.tick;
      persistAttempt();
    }
  }
  painter.draw($('board').getContext('2d'), attempt.run, dt, {
    paused,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    fullReveal: attempt.run.status === 'won',
    backdrop: attempt.picture,
  });
  $('hud').textContent =
    `${Math.round(attempt.run.coverage * 100)}% revealed · ${attempt.run.lives} lives · ${attempt.run.score} points${paused && !ended ? ' · Paused' : ''}`;
}
$('start').onclick = () =>
  operation(async () =>
    adoptDisplay(
      await runtime.start({ difficulty: $('difficulty').value, turnPolicy: $('steering').value }),
      true,
    ),
  );
$('resume').onclick = () =>
  operation(async () => adoptDisplay(await runtime.restore(savedRaw), false));
$('retry').onclick = () =>
  operation(async () => {
    pause();
    const current = runtime.current().selection;
    await adoptDisplay(await runtime.start(current), true);
  });
$('pause').onclick = () => {
  if (paused) setRunning();
  else pause();
};
$('next').onclick = () => {
  if (!nextMissionId) return void (location.href = './#installed');
  const missionId = nextMissionId;
  void operation(async () => {
    const current = runtime.current().selection;
    await adoptDisplay(
      await runtime.start({
        missionId,
        difficulty: current.difficulty,
        turnPolicy: current.turnPolicy,
      }),
      true,
    );
  });
};
$('export-attempt').onclick = () => {
  try {
    pause();
    downloadCreatorFile(
      new Blob([JSON.stringify(runtime.suspend(), null, 2)], { type: 'application/json' }),
      'revealline-custom-attempt.json',
    );
  } catch (error) {
    fail(error);
  }
};
$('import-attempt').onchange = () =>
  operation(async () => {
    const file = $('import-attempt').files[0];
    if (!file || file.size > SESSION_STORAGE_BYTES)
      throw new Error('Choose an attempt file under 2 MiB.');
    pause();
    await adoptDisplay(await runtime.restore(await file.text()), false);
  });
$('export-progress').onclick = () => {
  try {
    downloadCreatorFile(
      new Blob([profile.export()], { type: 'application/json' }),
      'revealline-custom-progress.json',
    );
  } catch (error) {
    fail(error);
  }
};
$('import-progress').onchange = () =>
  operation(async () => {
    const file = $('import-progress').files[0];
    if (!file || file.size > 8 * 1024 * 1024)
      throw new Error('Choose a bounded campaign progress backup.');
    profile.restore(await file.text());
    await profile.flush();
    storyPlayer.reset();
    await showEarned();
  });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);
window.addEventListener('pagehide', () => {
  pause();
  lease?.release();
  storyPlayer?.dispose();
  runtime?.dispose();
  input?.destroy();
  store.close();
  cancelAnimationFrame(frameId);
  if (pictureURL) URL.revokeObjectURL(pictureURL);
});
try {
  pack = await loadInstalledCreatorBundle(store, edition);
  const response = await fetch('../../authoring/motion-lab/presets.json');
  if (!response.ok) throw new Error('Game presentation presets are unavailable.');
  painter = new BoardPainter(await response.json());
  lease = await claimProfileWriter(navigator.locks, `revealline.creator.${edition}`);
  const profileKey = creatorProfileKey(edition);
  profile = createJourneyProfileStore({
    profileKey,
    ...(lease.writable
      ? {}
      : {
          backend: {
            profileKey,
            read: async () =>
              (await import('../journey/profile.mjs')).createJourneyBackend({ profileKey }).read(),
            commit: async () => {
              throw new Error(lease.reason);
            },
          },
        }),
    onStatus: (value) => {
      if (value.error) $('save-status').textContent = `Session only: ${value.error}`;
    },
  });
  await profile.load();
  runtime = createCreatorRuntime(pack);
  storyPlayer = createCreatorPlayerVictoryStory({
    runtime,
    host: createCreatorVictoryStoryHost({
      document,
      nodes: {
        surface: $('earned'),
        stage: $('creator-story-stage'),
        status: $('creator-story-status'),
        retry: $('creator-story-retry'),
      },
    }),
    nodes: {
      surface: $('earned'),
      stage: $('creator-story-stage'),
      status: $('creator-story-status'),
      retry: $('creator-story-retry'),
    },
  });
  input = attachInput({
    arena: $('arena'),
    continuousSteering: () => true,
    active: () => !paused && !busy && !ended,
    onPause: () => (paused ? setRunning() : pause()),
  });
  try {
    savedRaw = localStorage.getItem(saveKey);
  } catch {
    $('save-status').textContent =
      'Local attempt storage is unavailable. Download an attempt before leaving.';
  }
  $('title').textContent = pack.review.name;
  status(
    savedRaw
      ? 'An unfinished attempt is available. Resume it or start the mission again.'
      : 'Ready to play your installed Custom campaign.',
  );
  if (!lease.writable) $('save-status').textContent = lease.reason;
  await showEarned();
  busy = false;
  updateControls();
  frameId = requestAnimationFrame(frame);
} catch (error) {
  busy = false;
  updateControls();
  fail(error);
}
