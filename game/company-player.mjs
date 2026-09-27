import { loadEditionBootstrap } from './editions/bootstrap.mjs';
import { verifyEditionAssets } from './editions/assets.mjs';
import { resolveEditionContext } from './edition-context.mjs';
import { createCompanyStorage } from './company-storage.mjs';
import { createCandidateSoloHost } from './content-design/solo-host.mjs';
import { createJourneyProfileStore } from './journey/profile.mjs';
import { claimProfileWriter } from './profile-writer.mjs';
import { BoardPainter, boardPaintSizeForRun } from './ui/render.mjs';
import { attachInput } from './ui/input.mjs';
import { Soundscape } from './ui/audio.mjs';
import { createDisplayPreferences } from './display-preferences.mjs';
import { createTouchPreferences } from './touch-preferences.mjs';
import { createAudioMaster } from './ui/audio-master.mjs';
import { createAudioPreferences } from './audio-preferences.mjs';
import { CELL, FIXED_DT, createRun, stepRun, releaseInputs } from './core/index.mjs';
import { recordInput, recordRelease, exportReplay, MAX_REPLAY_TICKS } from './replay.mjs';
import { boundedJSON, canonicalJSON } from './data-json.mjs';
import {
  validateCompanyLessons,
  createLearningAttempt,
  verifyLearningAttempt,
} from './company-campaigns/learning.mjs';
import { createCompanyLearningProofStore } from './company-campaigns/learning-proofs.mjs';
import { createLearningEvidenceObserver } from './company-campaigns/evidence.mjs';
import { mountCompanyWorkbench } from './company-campaigns/workbench.mjs';
import {
  captureCompanySession,
  restoreCompanySession,
  companyPresentationIdentity,
  companySimulationIdentity,
} from './company-session.mjs';
import {
  prepareEditionOffline,
  verifyEditionOffline,
  selectPreparedEdition,
} from './editions/offline-client.mjs';

const $ = (id) => document.getElementById(id);
const BACKUP_LIMITS = Object.freeze({
  maxBytes: 96 * 1024 * 1024,
  maxString: 8 * 1024 * 1024,
  maxNodes: 8000000,
  maxArray: 216000,
  maxDepth: 40,
});
const node = (tag, text, className) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
};
const report = (message, error = false) => {
  $('notice').textContent = message;
  $('notice').dataset.error = String(error);
  const dialog = document.querySelector('dialog[open]');
  if (dialog) {
    let status = dialog.querySelector('.dialog-status');
    if (!status) {
      status = node('p', undefined, 'dialog-status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      dialog.append(status);
    }
    status.textContent = message;
    status.dataset.error = String(error);
  }
};
const guard =
  (fn) =>
  async (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      report(error.message, true);
    }
  };
const storage = createCompanyStorage({
  getStorage: () => localStorage,
  onError: (error) => report(error.message, true),
});
const download = (filename, value) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = node('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let startupWriter = null;

async function main() {
  const standalone = document.documentElement.dataset.editionId;
  const params = new URLSearchParams(location.search);
  const rootURL = new URL('../', location.href);
  const catalogURL = new URL(
    standalone ? '../edition-catalog.json' : 'editions/catalog.json',
    location.href,
  ).href;
  const boot = await loadEditionBootstrap({
    catalogURL,
    contentBaseURL: rootURL.href,
    editionId: params.get('edition') ?? standalone ?? undefined,
    campaignId: params.get('campaign') ?? undefined,
    allowMissing: false,
  });
  const { selection, source, route, catalog } = boot;
  let version = 'DEV';
  if (standalone) {
    const response = await fetch(new URL('build-info.json', location.href));
    if (!response.ok) throw new Error('This edition is missing its build identity.');
    version = (await response.json()).version;
  }
  const context = resolveEditionContext({ editionId: selection.edition.id, version });
  const presentationIdentity = await companyPresentationIdentity(boot);
  const host = createCandidateSoloHost(source, {
    themes: boot.boot.themes.themes,
    buildVersion: version,
    corePackIds: route.corePackIds,
  });
  const lessons = validateCompanyLessons(Object.values(boot.lessons).flat());
  const writer = await claimProfileWriter(
    navigator.locks,
    `revealline.company.${context.editionId}.writer`,
  );
  startupWriter = writer;
  const profile = createJourneyProfileStore({
    profileKey: route.profileKey,
    canWrite: () => writer.writable && !storage.readError,
    onStatus: (status) => {
      if (status.error)
        report('Your progress is available in this tab. Export a backup before leaving.', true);
    },
  });
  await profile.load();
  const localLearning = new Map(),
    localClears = new Set();
  const theme = boot.boot.themes.themes.find((entry) => entry.id === selection.brand.themeId);
  if (!theme) throw new Error('This edition is missing its selected company presentation.');
  const brandAsset = (id) => catalog.assets.find((a) => a.id === id);
  const assetURL = (id) => {
    const asset = brandAsset(id);
    return asset ? new URL(asset.path, rootURL).href : null;
  };
  // All referenced bytes belong to the compiled allowlist. Identity assets are
  // verified before they can become page or player presentation.
  await verifyEditionAssets(boot, { baseURL: rootURL });
  if (selection.brand.fontAssetId && typeof FontFace === 'function') {
    const font = new FontFace('Company Brand', `url("${assetURL(selection.brand.fontAssetId)}")`);
    document.fonts.add(await font.load());
    document.documentElement.style.setProperty(
      '--brand-font',
      '"Company Brand", system-ui, sans-serif',
    );
  }
  for (const [key, value] of Object.entries(theme.palette))
    document.documentElement.style.setProperty(`--${key}`, value);
  document.documentElement.style.setProperty('--panel', theme.palette.grid);
  document.querySelector('meta[name=theme-color]').content = theme.palette.ink;
  document.title = `${selection.edition.name} · ${selection.brand.name}`;
  $('brand-name').textContent = selection.brand.name;
  $('brand-description').textContent = selection.brand.description;
  $('home-title').textContent = selection.edition.name;
  $('footer-brand').textContent = `${selection.brand.name} · Reveal / Line`;
  if (selection.brand.logoAssetId) {
    $('brand-logo').src = assetURL(selection.brand.logoAssetId);
    $('brand-logo').hidden = false;
    $('completion-emblem').src = assetURL(selection.brand.logoAssetId);
  }
  if (selection.brand.heroAssetId) $('home-art').src = assetURL(selection.brand.heroAssetId);
  $('about-copy').textContent = selection.brand.description;
  $('build-identity').textContent =
    `${selection.edition.name} · content revision ${selection.edition.revision} · engine ${version}`;
  if (standalone) $('all-worlds')?.remove();
  for (const source of new Map(
    [...(selection.brand.sources ?? []), ...lessons.flatMap((l) => l.sources)].map((s) => [
      s.url,
      s,
    ]),
  ).values()) {
    const p = node('p'),
      a = node('a', source.title);
    a.href = source.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    p.append(a);
    $('about-sources').append(p);
  }
  for (const edition of catalog.editions) {
    const option = node(
      'option',
      `${catalog.brands.find((b) => b.id === edition.brandId).name} · ${edition.name}`,
    );
    option.value = edition.id;
    $('edition-select').append(option);
  }
  $('edition-select').value = selection.edition.id;
  $('edition-select').disabled = catalog.editions.length === 1;
  const preferencesKey = 'revealline.company-accessibility.v1';
  let preferences = {
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    grid: false,
    difficulty: 'standard',
  };
  try {
    const p = JSON.parse(storage.getItem(preferencesKey));
    if (p) {
      preferences = {
        reduced: p.reduced === true,
        grid: p.grid === true,
        difficulty: ['gentle', 'standard'].includes(p.difficulty) ? p.difficulty : 'standard',
      };
    }
  } catch {}
  const displayPreferences = createDisplayPreferences({
    legacyPreferences: { reducedEffects: preferences.reduced },
    onWarning: (message) => {
      if (message) report(message, true);
    },
  });
  displayPreferences.subscribe((value) => {
    preferences.reduced = value.effectiveReducedEffects;
    $('reduced-motion').checked = value.effectiveReducedEffects;
    document.documentElement.dataset.reducedMotion = String(value.effectiveReducedEffects);
  });
  $('show-grid').checked = preferences.grid;
  $('difficulty').value = preferences.difficulty;
  for (const [id, key] of [
    ['reduced-motion', 'reduced'],
    ['show-grid', 'grid'],
    ['difficulty', 'difficulty'],
  ])
    $(id).onchange = guard(() => {
      preferences[key] = key === 'difficulty' ? $(id).value : $(id).checked;
      if (key === 'reduced') displayPreferences.set({ reducedEffects: preferences.reduced });
      storage.setItem(preferencesKey, JSON.stringify(preferences));
      document.documentElement.dataset.reducedMotion = String(preferences.reduced);
    });
  const canvas = $('board'),
    ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create the game board.');
  let painter = new BoardPainter(boot.boot.presets, {
    onAsset: (message) => {
      if (message) report(message, true);
    },
  });
  const audioMaster = createAudioMaster();
  const audioPreferences = createAudioPreferences({
    audioMaster,
    onWarning: (message) => {
      if (message) report(message, true);
    },
  });
  const sound = new Soundscape({ audioMaster });
  if (theme.soundtrack) sound.setTrack(theme.soundtrack);
  let current = null,
    pendingSession = null,
    paused = true,
    preparing = false,
    generation = 0,
    accumulator = 0,
    frame = 0,
    last = 0,
    autosave = 0,
    workbench = null,
    awarded = false;
  const isPlaying = () =>
    !!current &&
    !paused &&
    !preparing &&
    !document.querySelector('dialog[open]') &&
    !$('play-screen').hidden;
  const touchPreferences = createTouchPreferences();
  const input = attachInput({
    arena: $('arena'),
    active: isPlaying,
    onPause: () => (paused ? resume() : pause()),
    tapMode: () => true,
    continuousSteering: () => false,
    getTouchSettings: () => touchPreferences.snapshot(),
  });
  const missionFor = (id) => host.catalog.missions.find((m) => m.levelId === id);
  const lessonFor = (id) => lessons.find((l) => l.missionId === id);
  const arcadeCleared = (id) => {
    const mission = missionFor(id);
    return !!mission && (localClears.has(id) || !!profile.snapshot().clears.solo[mission.id]);
  };
  const assignment = (id) => {
    const proven = learningProofs.load(id),
      local = localLearning.get(id);
    return proven ?? (local?.status !== 'complete' ? local : null);
  };
  const rememberLearning = (attempt) => {
    if (assignment(attempt.missionId)?.status === 'complete' && attempt.status !== 'complete')
      return;
    localLearning.set(attempt.missionId, attempt);
  };
  const completed = (id) =>
    arcadeCleared(id) && (!lessonFor(id) || assignment(id)?.status === 'complete');
  const unlocked = (id) => {
    const campaign = source.campaigns.find((c) => c.missionIds.includes(id));
    const i = campaign?.missionIds.indexOf(id);
    return i === 0 || (i > 0 && completed(campaign.missionIds[i - 1]));
  };
  const currentLesson = () => current && lessonFor(current.run.levelId);
  const learningComplete = () =>
    !currentLesson() || assignment(current.run.levelId)?.status === 'complete';
  const canOpenWorkbench = () =>
    !!current &&
    !preparing &&
    (['won', 'lost'].includes(current.run.status) ||
      (current.run.status === 'running' &&
        !current.run.player.cutting &&
        current.run.cells[
          Math.floor(current.run.player.y) * current.run.width + Math.floor(current.run.player.x)
        ] === CELL.SAFE));
  const learningIdentities = new Map(
    lessons.map((lesson) => [
      lesson.missionId,
      new Set(
        host.entries.flatMap((entry) =>
          entry.campaign.levels
            .filter((level) => level.id === lesson.missionId)
            .map((level) => companySimulationIdentity(createRun(level))),
        ),
      ),
    ]),
  );
  const learningProofs = createCompanyLearningProofStore({
    editionId: context.editionId,
    storage: {
      getItem: (key) => storage.getItem(key),
      setItem(key, value) {
        if (!writer.writable) throw new Error(writer.reason);
        storage.setItem(key, value);
      },
    },
    lessons,
    acceptSimulation: (missionId, identity) =>
      learningIdentities.get(missionId)?.has(identity) === true,
  });
  const proofHydration = await learningProofs.hydrate();
  async function proveLearning(attempt, run, recorder) {
    if (attempt?.status !== 'complete') return;
    const proof = await learningProofs.prove({ attempt, replay: exportReplay(recorder, run) });
    return learningProofs.saveVerified(proof);
  }
  function creditWin() {
    if (!current || current.run.status !== 'won' || awarded) return;
    awarded = true;
    localClears.add(current.run.levelId);
    // Keep every clear exportable in this tab. The profile backend owns the
    // saving lease check and cannot persist after this tab loses write access.
    try {
      profile.record({
        type: 'complete',
        mode: 'solo',
        missionId: current.mission.id,
        runId: current.runId,
        gameplayId: companySimulationIdentity(current.run),
        difficulty: current.selection.difficulty,
      });
    } catch (error) {
      report(
        `Your connection is complete in this tab. Export a backup before leaving: ${error.message}`,
        true,
      );
    }
  }
  function save() {
    if (!current || !writer.writable) return false;
    try {
      const value = captureCompanySession({
        editionId: context.editionId,
        presentationIdentity,
        missionId: current.mission.id,
        difficulty: current.selection.difficulty,
        runId: current.runId,
        recorder: current.recorder,
        run: current.run,
        learning: current.learning,
        lesson: currentLesson(),
      });
      storage.setItem(route.sessionKey, JSON.stringify(value));
      $('continue-button').hidden = false;
      return true;
    } catch (error) {
      report(
        `Saving needs attention: ${error.message} Export a backup to keep this attempt.`,
        true,
      );
      return false;
    }
  }
  function pause({ persist = true } = {}) {
    if (!current) return;
    paused = true;
    input.clear();
    releaseInputs(current.run);
    recordRelease(current.recorder);
    accumulator = 0;
    if (persist) save();
    refresh();
  }
  function resume() {
    if (!current || preparing || ['won', 'lost'].includes(current.run.status)) return;
    input.clear();
    paused = false;
    accumulator = 0;
    last = performance.now();
    $('arena').focus();
    refresh();
  }
  function showHome() {
    // Home retires the pending replacement before its asynchronous artwork or
    // replay verification can adopt a mission and return us to play.
    generation++;
    preparing = false;
    host.preparer.cancel();
    pause();
    $('play-screen').hidden = true;
    $('home-screen').hidden = false;
    renderCampaigns();
  }
  async function start(id, { saved = null } = {}) {
    if (!saved && !unlocked(id))
      throw new Error('Complete the preceding connection and its assignment first.');
    const mission = missionFor(id);
    if (!mission) throw new Error('This mission is not part of the selected edition.');
    pause({ persist: !saved });
    const ticket = ++generation;
    preparing = true;
    report('Preparing the exact mission and its artwork…');
    let attempt, staged;
    try {
      let restored;
      if (saved) {
        restored = await restoreCompanySession(saved, {
          editionId: context.editionId,
          presentationIdentity,
          prepare: host.preparer.prepare,
          lessonFor,
        });
        attempt = restored.prepared;
      } else
        attempt = await host.preparer.prepare({
          missionId: mission.id,
          difficulty: preferences.difficulty,
          seed: 1,
          turnPolicy: 'immediate',
        });
      if (ticket !== generation) {
        if (host.preparer.current(attempt)) host.preparer.cancel();
        return;
      }
      const run = restored?.run ?? attempt.run,
        recorder = restored?.recorder ?? attempt.recorder;
      const lesson = lessonFor(run.levelId);
      const learning = restored
        ? restored.saved.learning
        : lesson
          ? createLearningAttempt(lesson, {
              attemptId: `attempt-${crypto.randomUUID()}`,
              simulationIdentity: companySimulationIdentity(run),
              seed: run.seed,
            })
          : null;
      // Decode the next actor before changing either scene or current session.
      staged = new BoardPainter(boot.boot.presets, {
        onAsset: (message) => {
          if (message) report(message, true);
        },
      });
      staged.setLevel(run.level, { seed: run.seed });
      await staged.setLook(attempt.theme, attempt.theme.player, attempt.visualOverrides);
      if (staged.lookWarning) throw new Error(staged.lookWarning);
      if (ticket !== generation) {
        if (host.preparer.current(attempt)) host.preparer.cancel();
        staged.enemyBodies.clear();
        return;
      }
      let learningNotice = '';
      if (learning?.status === 'complete') {
        try {
          if (!(await proveLearning(learning, run, recorder)))
            learningNotice =
              'Your verified assignment is kept in this tab. Export a backup to keep its replay proof.';
        } catch (error) {
          learningNotice = `The saved attempt is verified, but historical mastery needs attention: ${error.message}`;
        }
      }
      if (ticket !== generation) {
        if (host.preparer.current(attempt)) host.preparer.cancel();
        staged.enemyBodies.clear();
        return;
      }
      host.preparer.take(attempt);
      current?.picture?.release();
      current = {
        ...attempt,
        run,
        recorder,
        runId: restored?.saved.runId ?? `company-${crypto.randomUUID()}`,
        learning,
        evidenceObserver:
          restored?.evidenceObserver ??
          (lesson ? createLearningEvidenceObserver({ lesson, run }) : null),
      };
      pendingSession = null;
      painter.enemyBodies.clear();
      painter = staged;
      staged = null;
      const size = boardPaintSizeForRun(run);
      canvas.width = size.width;
      canvas.height = size.height;
      paused = true;
      awarded = arcadeCleared(run.levelId);
      accumulator = 0;
      if (learning) rememberLearning(learning);
      creditWin();
      $('home-screen').hidden = true;
      $('play-screen').hidden = false;
      $('mission-title').textContent = run.level.name;
      $('campaign-name').textContent = mission.campaignTitle;
      $('mission-brief').textContent = attempt.manifest.design.lesson;
      $('mission-route').textContent = attempt.manifest.design.routeDecision;
      $('mission-counterplay').textContent = attempt.manifest.design.counterplay;
      $('workbench-button').hidden = !lesson;
      report(
        learningNotice ||
          (writer.writable ? 'Ready. Your progress stays with this edition.' : writer.reason),
        !!learningNotice || !writer.writable,
      );
      save();
      refresh();
      $('resume-button').focus();
    } catch (error) {
      staged?.enemyBodies.clear();
      if (attempt && host.preparer.current(attempt)) host.preparer.cancel();
      if (ticket !== generation) return;
      throw error;
    } finally {
      if (ticket === generation) preparing = false;
    }
  }
  function renderCampaigns() {
    $('campaigns').replaceChildren();
    source.campaigns.forEach((campaign, index) => {
      const card = node('article', undefined, 'campaign-card');
      const first = source.missions.find((m) => m.id === campaign.missionIds[0]);
      const art = source.assets.find((a) => a.id === first.presentation.backgroundAssetId);
      const image = node('img');
      image.src = art
        ? new URL(`game/${art.path}`, rootURL).href
        : assetURL(selection.brand.heroAssetId);
      image.alt = '';
      image.loading = 'lazy';
      card.append(image);
      const content = node('div', undefined, 'campaign-card-content');
      content.append(
        node('span', `JOURNEY ${String(index + 1).padStart(2, '0')}`, 'campaign-number'),
        node('h3', campaign.name),
        node('p', first.design.lesson),
      );
      const select = node('select');
      select.setAttribute('aria-label', `Mission in ${campaign.name}`);
      campaign.missionIds.forEach((id, i) => {
        const m = source.missions.find((m) => m.id === id),
          option = node('option', `${i + 1}. ${m.name}${completed(id) ? ' ✓' : ''}`);
        option.value = id;
        option.disabled = !unlocked(id);
        select.append(option);
      });
      select.value =
        campaign.missionIds.find((id) => !completed(id) && unlocked(id)) ?? campaign.missionIds[0];
      const button = node('button', 'Enter journey →', 'primary');
      button.setAttribute('aria-label', `Enter journey: ${campaign.name}`);
      button.onclick = guard(() => start(select.value));
      const footer = node('div', undefined, 'campaign-footer');
      footer.append(
        node(
          'span',
          `${campaign.missionIds.filter(completed).length} / ${campaign.missionIds.length} connected`,
        ),
        node(
          'span',
          lessons.some((l) => l.campaignId === campaign.id) ? 'PLAY + PRACTICE' : 'ADVENTURE',
        ),
      );
      content.append(select, button, footer);
      card.append(content);
      $('campaigns').append(card);
    });
  }
  function refresh() {
    if (!current) return;
    const run = current.run,
      ended = ['won', 'lost'].includes(run.status),
      won = run.status === 'won',
      learned = learningComplete(),
      safe = canOpenWorkbench();
    // Preserve focused nodes and avoid rebuilding unchanged text every frame.
    const put = (id, property, value) => {
      const target = $(id);
      if (target[property] !== value) target[property] = value;
    };
    put('coverage', 'textContent', `${(run.coverage * 100).toFixed(1)}%`);
    put('lives', 'textContent', String(run.lives));
    put(
      'clock',
      'textContent',
      `${Math.floor(run.time / 60)}:${String(Math.floor(run.time % 60)).padStart(2, '0')}`,
    );
    put('goal', 'textContent', `${Math.round(run.level.goal.coverage * 100)}%`);
    put('play-overlay', 'hidden', !paused && !ended);
    put('completion-emblem', 'hidden', !won || !selection.brand.logoAssetId);
    put('resume-button', 'hidden', ended);
    put('retry-button', 'hidden', !ended);
    put('next-button', 'hidden', !won || !learned);
    put('pause-button', 'textContent', paused ? 'Resume' : 'Pause');
    put('pause-button', 'disabled', ended);
    put(
      'play-state',
      'textContent',
      won
        ? learned
          ? 'Connection complete.'
          : 'Picture connected. Assignment waiting.'
        : run.status === 'lost'
          ? 'Another route is waiting.'
          : run.tick === 0
            ? 'Ready to connect.'
            : 'Take your time.',
    );
    put(
      'play-detail',
      'textContent',
      won
        ? learned
          ? 'This connection is complete.'
          : 'Open the workbench to complete this connection.'
        : run.status === 'lost'
          ? 'Watch the paper tangles and try a shorter return.'
          : current.manifest.design.routeDecision,
    );
    put('resume-button', 'textContent', run.tick === 0 ? 'Start mission' : 'Return to play');
    put(
      'learning-status',
      'textContent',
      currentLesson()
        ? !safe
          ? 'Return to safe ground before opening the workbench.'
          : learned
            ? 'Assignment complete.'
            : 'Inspect → Configure → Commit. The game pauses while you work.'
        : 'An adventure mission. Follow your own route.',
    );
    put(
      'workbench-button',
      'textContent',
      current.learning?.status === 'complete'
        ? 'Review workbench'
        : learned
          ? 'Practice again'
          : 'Open workbench',
    );
    put('workbench-button', 'disabled', !safe);
  }
  function openDialog(id) {
    pause();
    $(id).querySelector('.dialog-status')?.remove();
    $(id).showModal();
  }
  $('brand-home').onclick = showHome;
  $('home-button').onclick = showHome;
  $('start-campaign').onclick = guard(() => {
    const campaign = source.campaigns.find((c) => c.id === selection.campaign.id);
    return start(
      campaign.missionIds.find((id) => !completed(id) && unlocked(id)) ?? campaign.missionIds[0],
    );
  });
  $('continue-button').hidden = !storage.getItem(route.sessionKey);
  $('continue-button').onclick = guard(() => {
    const saved = boundedJSON(pendingSession ?? storage.getItem(route.sessionKey), {
      maxBytes: 32 * 1024 * 1024,
      maxNodes: 3000000,
      maxArray: 216000,
      maxDepth: 30,
    });
    const m = host.catalog.find(saved.missionId);
    if (!m)
      throw new Error(
        'The saved mission belongs to an unavailable campaign. Its data has been kept.',
      );
    return start(m.levelId, { saved });
  });
  $('pause-button').onclick = () => (paused ? resume() : pause());
  $('resume-button').onclick = resume;
  $('retry-button').onclick = guard(() => start(current.run.levelId));
  $('next-button').onclick = guard(() => {
    if (!learningComplete()) return;
    const next = host.next(current.mission.id);
    if (next && unlocked(next.levelId)) return start(next.levelId);
    showHome();
  });
  $('edition-select').onchange = guard(async () => {
    pause();
    const editionId = $('edition-select').value;
    $('edition-select').disabled = true;
    try {
      report('Checking the selected company and its artwork…');
      const candidate = await loadEditionBootstrap({
        catalogURL,
        contentBaseURL: rootURL.href,
        editionId,
        allowMissing: false,
      });
      await verifyEditionAssets(candidate, { baseURL: rootURL });
      const staged = createCandidateSoloHost(candidate.source, {
        themes: candidate.boot.themes.themes,
        buildVersion: version,
        corePackIds: candidate.route.corePackIds,
      });
      staged.preparer.dispose();
    } catch (error) {
      $('edition-select').value = selection.edition.id;
      $('edition-select').disabled = catalog.editions.length === 1;
      throw error;
    }
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('edition', editionId);
    location.assign(url.href);
  });
  for (const [button, id] of [
    ['settings-button', 'settings-dialog'],
    ['help-button', 'help-dialog'],
    ['about-button', 'about-dialog'],
  ])
    $(button).onclick = () => openDialog(id);
  for (const button of document.querySelectorAll('[data-close]'))
    button.onclick = () => $(button.dataset.close).close();
  for (const dialog of document.querySelectorAll('dialog'))
    dialog.addEventListener('close', () => {
      input.clear();
      refresh();
    });
  $('gallery-button').onclick = () => {
    $('gallery').replaceChildren();
    for (const mission of source.missions.filter((m) => arcadeCleared(m.id))) {
      const card = node('article'),
        art = source.assets.find((a) => a.id === mission.presentation.backgroundAssetId);
      if (art) {
        const image = node('img');
        image.src = new URL(`game/${art.path}`, rootURL).href;
        image.alt = art.alt;
        card.append(image);
      }
      card.append(node('p', mission.name));
      $('gallery').append(card);
    }
    if (!$('gallery').children.length)
      $('gallery').append(node('p', 'Your completed connections will appear here.'));
    openDialog('gallery-dialog');
  };
  $('workbench-button').onclick = guard(() => {
    const lesson = currentLesson();
    if (!lesson) return;
    if (!canOpenWorkbench()) throw new Error('Return to safe ground before opening the workbench.');
    pause();
    workbench?.destroy();
    workbench = mountCompanyWorkbench($('workbench-content'), {
      lesson,
      attempt: current.learning,
      evidence: () => current.evidenceObserver.snapshot(),
      anchor: () => ({
        tick: current.run.tick,
        kind: ['won', 'lost'].includes(current.run.status) ? 'result' : 'checkpoint',
      }),
      onChange: guard(async (attempt) => {
        const active = current;
        current.learning = attempt;
        rememberLearning(attempt);
        save();
        refresh();
        if (
          attempt.status === 'complete' &&
          !(await proveLearning(attempt, active.run, active.recorder))
        )
          report(
            'Your verified assignment is kept in this tab. Export a backup to keep its replay proof.',
            true,
          );
        refresh();
      }),
      onClose: () => {
        $('workbench-dialog').close();
        refresh();
        $('workbench-button').focus();
      },
    });
    const title = $('workbench-content').querySelector('h2');
    $('workbench-dialog').setAttribute('aria-labelledby', title.id);
    $('workbench-dialog').showModal();
  });
  $('sound-button').onclick = guard(async () => {
    if (!sound.enabled) {
      await sound.enable();
      audioPreferences.setMuted(false);
    } else audioPreferences.setMuted(!audioMaster.snapshot().muted);
    $('sound-button').textContent =
      sound.enabled && !audioMaster.snapshot().muted ? 'Mute sound' : 'Enable sound';
  });
  $('export-backup').onclick = guard(() => {
    pause();
    const backup = {
      format: 'revealline-company-backup.v2',
      editionId: context.editionId,
      profile: JSON.parse(profile.export()),
      session: current
        ? captureCompanySession({
            editionId: context.editionId,
            presentationIdentity,
            missionId: current.mission.id,
            difficulty: current.selection.difficulty,
            runId: current.runId,
            recorder: current.recorder,
            run: current.run,
            learning: current.learning,
            lesson: currentLesson(),
          })
        : (pendingSession ??
          (storage.getItem(route.sessionKey)
            ? boundedJSON(storage.getItem(route.sessionKey), {
                maxBytes: 32 * 1024 * 1024,
                maxNodes: 3000000,
                maxArray: 216000,
                maxDepth: 30,
              })
            : null)),
      learning: lessons.map((l) => assignment(l.missionId)).filter(Boolean),
      learningProofs: learningProofs.exportProofs(),
      learningRecovery: learningProofs.exportRecovery(),
      legacyLearning: storage.getItem(`revealline.company-learning.${context.editionId}.v1`),
    };
    boundedJSON(backup, BACKUP_LIMITS);
    download(`${context.editionId}-progress.json`, backup);
  });
  $('import-backup').onchange = guard(async () => {
    const file = $('import-backup').files[0];
    if (!file) return;
    if (!writer.writable) throw new Error(writer.reason);
    if (file.size > BACKUP_LIMITS.maxBytes)
      throw new Error('This backup exceeds the import budget.');
    const backup = boundedJSON(await file.text(), BACKUP_LIMITS);
    if (
      !['revealline-company-backup.v1', 'revealline-company-backup.v2'].includes(backup.format) ||
      backup.editionId !== context.editionId
    )
      throw new Error('Choose a backup for this exact audience edition.');
    profile.inspectBackup(backup.profile);
    if (!Array.isArray(backup.learning) || backup.learning.length > lessons.length)
      throw new Error('Invalid learning backup.');
    const seen = new Set();
    const proofs = await learningProofs.inspectProofs(backup.learningProofs ?? []);
    const recoverySource = backup.learningRecovery ?? {
      format: 'revealline-learning-proof-recovery.v1',
      editionId: context.editionId,
      sources: [],
    };
    if (backup.legacyLearning !== undefined && backup.legacyLearning !== null) {
      if (typeof backup.legacyLearning !== 'string' || backup.legacyLearning.length > 1024 * 1024)
        throw new Error('Invalid legacy learning recovery record.');
      recoverySource.sources.push(backup.legacyLearning);
    }
    const recovery = learningProofs.inspectRecovery(recoverySource);
    for (const attempt of backup.learning) {
      const lesson = lessonFor(attempt?.missionId);
      if (
        !lesson ||
        seen.has(attempt.missionId) ||
        !verifyLearningAttempt(lesson, attempt).valid ||
        !learningIdentities.get(attempt.missionId)?.has(attempt.simulationIdentity)
      )
        throw new Error(
          'A learning transcript is duplicated or does not match this edition’s simulations.',
        );
      seen.add(attempt.missionId);
      if (
        attempt.status === 'complete' &&
        !proofs.some((proof) => canonicalJSON(proof.attempt) === canonicalJSON(attempt))
      )
        throw new Error(
          'Completed learning needs its matching replay proof. Open the backup in its matching earlier release.',
        );
    }
    if (preparing)
      throw new Error('Wait for the mission to finish preparing before importing progress.');
    pause({ persist: false });
    if (backup.session) {
      const prepared = await restoreCompanySession(backup.session, {
        editionId: context.editionId,
        presentationIdentity,
        prepare: host.preparer.prepare,
        lessonFor,
      });
      if (host.preparer.current(prepared.prepared)) host.preparer.cancel();
    }
    if (!writer.writable) throw new Error(writer.reason);
    profile.restore(backup.profile);
    let durable = await profile.flush();
    if (!writer.writable) {
      report(
        'The saving lease changed during import. Progress is kept in this tab; keep the original backup and reload before saving.',
        true,
      );
      return;
    }
    if (!learningProofs.importRecovery(recovery)) durable = false;
    if (!learningProofs.importVerified(proofs)) durable = false;
    for (const attempt of backup.learning) {
      rememberLearning(attempt);
    }
    if (backup.session)
      try {
        storage.setItem(route.sessionKey, JSON.stringify(backup.session));
      } catch {
        durable = false;
      }
    if (backup.session) {
      pendingSession = backup.session;
      current?.picture?.release();
      current = null;
      $('play-screen').hidden = true;
      $('home-screen').hidden = false;
    }
    $('continue-button').hidden = !pendingSession && !storage.getItem(route.sessionKey);
    renderCampaigns();
    report(
      durable
        ? 'Matching edition progress imported. Choose Continue when you are ready.'
        : 'Progress is imported in this tab, but storage could not keep every record. Keep your backup and export again before leaving.',
      !durable,
    );
    $('import-backup').value = '';
  });
  if (standalone) {
    $('prepare-offline').hidden = false;
    $('offline-status').textContent = 'Download and verify this edition for offline play.';
    const install = node('button', 'Use this edition in the installed app');
    install.disabled = true;
    $('prepare-offline').onclick = guard(async () => {
      $('prepare-offline').disabled = true;
      install.disabled = true;
      try {
        const prepared = await prepareEditionOffline({
          editionId: context.editionId,
          version,
          onStatus: (value) => {
            $('offline-status').textContent =
              value.status === 'downloading'
                ? 'Downloading and checking this edition…'
                : 'Verifying the saved files…';
          },
        });
        if (prepared.status === 'waiting') {
          $('offline-status').textContent =
            'The checked update is waiting. Close this edition’s open tabs and reopen it before selecting the installed version.';
          return;
        }
        await verifyEditionOffline({ editionId: context.editionId, version });
        $('offline-status').textContent = 'This edition is verified for offline play.';
        install.disabled = false;
      } catch (error) {
        $('offline-status').textContent = error.message;
        throw error;
      } finally {
        $('prepare-offline').disabled = false;
      }
    });
    install.onclick = guard(async () => {
      try {
        await selectPreparedEdition({ editionId: context.editionId, version });
        $('offline-status').textContent =
          'Your installed launcher will open this edition. The previous release is kept.';
      } catch (error) {
        $('offline-status').textContent = error.message;
        throw error;
      }
    });
    $('prepare-offline').after(install);
  }
  function update(now) {
    const dt = Math.min(0.08, Math.max(0, (now - last) / 1000));
    last = now;
    if (current) {
      if (isPlaying()) {
        accumulator += dt;
        let command = input.poll();
        while (accumulator >= FIXED_DT && ['running', 'respawning'].includes(current.run.status)) {
          if (current.recorder.ticks >= MAX_REPLAY_TICKS) {
            pause();
            report(
              'This attempt reached its recording limit. Export it or start a new mission.',
              true,
            );
            break;
          }
          if (current.run.status === 'respawning')
            command = { direction: null, boost: false, action: false, pickup: false };
          stepRun(current.run, command, FIXED_DT);
          recordInput(current.recorder, command);
          current.evidenceObserver?.observe(current.run);
          accumulator -= FIXED_DT;
          for (const event of current.run.events) sound.event(event.type, event);
          if (current.run.events.some((e) => e.type === 'capture.stopped')) {
            input.clear();
            command = { direction: null, boost: false, action: false, pickup: false };
          }
        }
      }
      if (['won', 'lost'].includes(current.run.status) && !paused) {
        pause();
        creditWin();
        save();
      }
      painter.draw(ctx, current.run, dt, {
        paused,
        reduced: preferences.reduced,
        showGrid: preferences.grid,
        fullReveal: current.run.status === 'won',
        displayCSSWidth: canvas.clientWidth,
        textFace: 'plain',
      });
      sound.update(isPlaying(), current.theme, current.run);
      refresh();
      if (now - autosave > 5000) {
        autosave = now;
        if (isPlaying()) save();
      }
    }
    frame = requestAnimationFrame(update);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('pagehide', (event) => {
    pause();
    if (event.persisted) return;
    writer.release();
    cancelAnimationFrame(frame);
    input.destroy();
    current?.picture?.release();
    host.preparer.dispose();
    sound.dispose?.();
    displayPreferences.dispose();
    touchPreferences.destroy();
    audioPreferences.dispose();
    audioMaster.dispose();
  });
  renderCampaigns();
  document.documentElement.dataset.companyState = 'ready';
  $('start-campaign').disabled = false;
  report(
    storage.readError
      ? 'Saved progress could not be read. Play is session-only; export a backup before leaving.'
      : proofHydration.rejected
        ? 'Some earlier learning records need their matching lesson revision. Their original data is retained for backup.'
        : writer.writable
          ? `${source.missions.length} connections to discover. Choose your journey.`
          : writer.reason,
    !writer.writable || !!storage.readError,
  );
  last = performance.now();
  frame = requestAnimationFrame(update);
  startupWriter = null;
  // Expose no mutable game state. Read-only diagnostics support browser checks.
  globalThis.CompanyJourney = Object.freeze({
    snapshot: () => ({
      editionId: context.editionId,
      missionId: current?.run.levelId ?? null,
      status: current?.run.status ?? 'home',
      paused,
      coverage: current?.run.coverage ?? 0,
      learning: current?.learning?.status ?? null,
      missions: source.missions.length,
    }),
  });
}

main().catch((error) => {
  startupWriter?.release();
  startupWriter = null;
  document.documentElement.dataset.companyState = 'failed';
  report(`Could not open this edition: ${error.message}`, true);
  $('start-campaign').disabled = true;
});
