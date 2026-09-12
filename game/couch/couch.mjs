import { createDuel, stepDuel, pauseDuel, resumeDuel } from '../multiplayer.mjs';
import { FIXED_DT, releaseInputs } from '../core/index.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { readAssetStore } from '../storage.mjs';
import { importPackLibrary, resolvePackCampaign } from '../packs.mjs';
import { Soundscape, DEFAULT_TRACKS } from '../ui/audio.mjs';
import { recommendedBody } from '../content.mjs';
import { emptyProgress, unlockedBodies } from '../progress.mjs';
const $ = (id) => document.getElementById(id);
const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return r.json();
};
try {
  const [campaign, registry, themes, presets] = await Promise.all([
    json('../content/campaign.json'),
    json('../content/classes.json'),
    json('../content/themes.json'),
    json('../../authoring/motion-lab/presets.json'),
  ]);
  const maps = campaign.levels.map((level) => ({
    key: level.id,
    level,
    classes: registry,
    themes: themes.themes,
    visualOverrides: {},
    defaultThemeId: level.themeId || campaign.themeId,
    track: null,
  }));
  try {
    const saved = await readAssetStore(
      `revealline.packs.${document.querySelector('meta[name="revealline-offline"]') ? 'release' : 'dev'}.v1`,
    );
    if (saved) {
      const installed = await importPackLibrary(saved);
      for (const pack of installed.packs)
        for (const c of pack.campaigns) {
          const resolved = resolvePackCampaign(pack, c.id);
          for (const level of c.levels)
            maps.push({
              key: `${pack.id}/${c.id}/${level.id}`,
              level,
              defaultThemeId: level.themeId || c.themeId,
              track:
                resolved.music.find((track) => track.id === (level.musicId || c.musicId)) || null,
              classes: resolved.classRecipes,
              themes: resolved.themes,
              visualOverrides: {
                ...resolved.visualOverrides,
                ...resolved.levelVisuals.find((v) => v.levelId === level.id)?.visualOverrides,
              },
            });
        }
    }
  } catch (e) {
    $('race-message').textContent = `Pack loading: ${e.message}`;
  }
  for (const m of maps) $('race-level').append(new Option(m.level.name, m.key));
  for (const t of themes.themes) $('race-theme').append(new Option(t.name, t.id));
  for (const c of registry) $('race-class').append(new Option(c.label, c.id));
  const painters = [new BoardPainter(presets), new BoardPainter(presets)];
  const sound = new Soundscape();
  const freeBodies = unlockedBodies(emptyProgress(campaign));
  function bodyFor(theme, classId) {
    const candidate = recommendedBody(theme, classId);
    return Object.hasOwn(presets.characters, candidate) && freeBodies.has(candidate)
      ? candidate
      : freeBodies.has(theme.player)
        ? theme.player
        : 'neutral-marker';
  }
  let selectedMapKey = null;
  const contexts = [0, 1].map((i) => $(`race-canvas-${i}`).getContext('2d'));
  let match,
    theme,
    accumulator = 0,
    last = 0,
    won = [0, 0],
    finished = false;
  $('race-tap').checked = matchMedia('(pointer: coarse)').matches;
  $('race-reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clear() {
    input.clear();
    accumulator = 0;
  }
  function prepare() {
    clear();
    const entry = maps.find((m) => m.key === $('race-level').value),
      level = entry.level;
    const classId = entry.classes.some((c) => c.id === $('race-class').value)
      ? $('race-class').value
      : entry.classes[0].id;
    $('race-class').replaceChildren(...entry.classes.map((c) => new Option(c.label, c.id)));
    $('race-class').value = classId;
    const themeId =
      selectedMapKey !== entry.key && entry.defaultThemeId
        ? entry.defaultThemeId
        : $('race-theme').value;
    selectedMapKey = entry.key;
    theme = entry.themes.find((t) => t.id === themeId) || entry.themes[0];
    $('race-theme').replaceChildren(...entry.themes.map((t) => new Option(t.name, t.id)));
    $('race-theme').value = theme.id;
    match = createDuel(
      level,
      { seed: 2026, turnPolicy: $('race-turn').value, classId, classRecipes: entry.classes },
      { seconds: Number($('race-time').value) },
    );
    sound.reset();
    sound.setTrack(entry.track || DEFAULT_TRACKS[0]);
    painters.forEach((p) => {
      p.setLook(theme, bodyFor(theme, $('race-class').value), entry.visualOverrides);
      p.setLevel?.(level, { seed: 2026 });
      p.skipCelebration?.();
    });
    finished = false;
    $('race-start').textContent = 'Start round ↗';
    $('race-message').textContent =
      'Both boards use the same map, class and seed. Ready when you are.';
  }
  function pause() {
    sound.pause();
    if (!match || match.status === 'finished') return;
    pauseDuel(match);
    clear();
    $('race-start').textContent = 'Resume round →';
    $('race-message').textContent = 'Both players are paused. Resume when everyone is ready.';
  }
  $('race-start').onclick = () => {
    if (match.status === 'finished') {
      if (won.some((n) => n >= 2)) won = [0, 0];
      prepare();
    }
    clear();
    resumeDuel(match);
    focusBoards(true);
    sound.resume().catch(() => {});
    $('race-message').textContent = 'Make your line count. First clear wins.';
    input.focus();
  };
  $('race-pause').onclick = pause;
  function focusBoards(on) {
    document.body.classList.toggle('race-focus', on);
    $('race-focus').textContent = on ? 'Show setup' : 'Focus boards';
  }
  $('race-focus').onclick = () => {
    const on = !document.body.classList.contains('race-focus');
    if (!on && match?.status === 'running') pause();
    focusBoards(on);
  };
  $('race-reset').onclick = () => {
    won = [0, 0];
    focusBoards(false);
    prepare();
  };
  for (const id of ['race-level', 'race-class', 'race-turn', 'race-time'])
    $(id).onchange = () => {
      won = [0, 0];
      prepare();
    };
  $('race-theme').onchange = () => {
    const entry = maps.find((m) => m.key === $('race-level').value);
    theme = entry.themes.find((t) => t.id === $('race-theme').value);
    painters.forEach((p) =>
      p.setLook(theme, bodyFor(theme, $('race-class').value), entry.visualOverrides),
    );
  };
  $('race-audio').onclick = async () => {
    try {
      const on = await sound.toggle();
      $('race-audio').textContent = on ? 'Mute music ♫' : 'Enable music ♫';
    } catch (e) {
      $('race-message').textContent = e.message;
    }
  };
  $('race-tap').onchange = clear;
  const input = attachCouchInput({
    active: () => match?.status === 'running',
    tapMode: () => $('race-tap').checked,
    onPause: pause,
    onStop: (player) => {
      if (match) releaseInputs(match.runs[player]);
    },
    onPads: (count) => {
      $('race-pad-status').textContent =
        `${count} standard controller${count === 1 ? '' : 's'} connected · keyboard and touch remain available. Escape pauses both boards.`;
    },
  });
  function frame(now) {
    const dt = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    input.poll();
    if (match.status === 'running') {
      if (dt > 0.25) pause();
      else {
        accumulator += dt;
        while (accumulator + 1e-9 >= FIXED_DT && match.status === 'running') {
          const before = match.runs.map((r) => r.tick);
          stepDuel(match, input.consume());
          accumulator -= FIXED_DT;
          for (let i = 0; i < 2; i++)
            if (match.runs[i].tick !== before[i]) {
              painters[i].effectsFor(match.runs[i].events);
              for (const event of match.runs[i].events) sound.event(event);
            }
        }
      }
    }
    if (match.status === 'finished' && !finished) {
      finished = true;
      clear();
      if (match.winner !== null) won[match.winner]++;
      const name =
        match.winner === 0 ? 'Sunflower' : match.winner === 1 ? 'Skyline' : 'Both players';
      $('race-message').textContent =
        `${match.winner === null ? 'Draw' : `${name} wins the round`}. ${match.reason}.${won.some((n) => n >= 2) ? ` ${name} wins the match!` : ''}`;
      $('race-start').textContent = won.some((n) => n >= 2)
        ? 'Play another match ↗'
        : 'Next round ↗';
      painters.forEach((p, i) => {
        if (match.runs[i].status === 'won')
          p.startCelebration?.({
            levelId: match.runs[i].levelId,
            seed: 2026,
            reduced: $('race-reduced').checked,
          });
      });
    }
    $('series-score').textContent = `${won[0]} : ${won[1]}`;
    const left = Math.max(0, Math.ceil((match.limitTicks - match.tick) / 120));
    $('race-clock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i];
      $(`racer-stats-${i}`).textContent =
        `${(run.coverage * 100).toFixed(1)}% · ${run.lives} lives · ${run.score} points`;
      $(`racer-state-${i}`).textContent = match.status === 'running' ? run.status : match.status;
      painters[i].draw(contexts[i], run, Math.min(dt, 0.1), {
        paused: match.status !== 'running',
        reduced: $('race-reduced').checked,
        fullReveal: run.status === 'won',
        celebrationPaused: document.hidden,
      });
    }
    sound.update(
      match.status === 'running',
      theme,
      match.runs.find((r) => !['won', 'lost'].includes(r.status)) || match.runs[0],
    );
    requestAnimationFrame(frame);
  }
  prepare();
  if (new URLSearchParams(location.search).get('focus') === '1') focusBoards(true);
  requestAnimationFrame(frame);
} catch (error) {
  $('race-message').textContent = `The race could not load: ${error.message}`;
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  $('boot-status').hidden = true;
}
