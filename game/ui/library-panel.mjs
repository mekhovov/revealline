import { prepareBackup, exportBackup, MAX_BACKUP_BYTES } from '../backup.mjs';
import { importLibrary, exportLibrary, campaignKey, libraryCapacity } from '../library.mjs';
import {
  preparePack,
  installPack,
  removePack,
  importPackLibrary,
  exportPackLibrary,
} from '../packs.mjs';
import { downloadJSON } from '../content.mjs';
import { BoardPainter } from './render.mjs';
import { createRun } from '../core/index.mjs';
import { challengeCampaign } from '../challenges.mjs';
const $ = (id) => document.getElementById(id);
const button = (label, fn) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'button secondary';
  b.textContent = label;
  b.onclick = fn;
  return b;
};
const status = (id, error) =>
  ($(id).textContent = error instanceof Error ? error.message : String(error));
const fileText = async (file, max = 32 * 1024 * 1024) => {
  if (!file) throw new Error('Choose a JSON file.');
  if (file.size > max) throw new Error('This file exceeds the import budget.');
  return file.text();
};

export function attachLibraryPanel(api) {
  let previousLibrary = null,
    previousBackup = null,
    busy = false,
    view = null,
    galleryFrame = 0,
    viewGeneration = 0,
    returnToCollection = true;
  let galleryPage = 0,
    scorePage = 0;
  const galleryPainter = new BoardPainter(api.get().presets);
  function open(panel = 'scores') {
    api.pause();
    for (const id of ['scores', 'saves', 'packs', 'challenges'])
      $(`library-${id}`).hidden = id !== panel;
    refresh();
    if (!$('library-dialog').open) $('library-dialog').showModal();
  }
  function paginate(id, page, total, size, change) {
    const pages = Math.max(1, Math.ceil(total / size)),
      nav = $(id);
    nav.replaceChildren();
    const previous = button('Previous', () => change(page - 1)),
      next = button('Next', () => change(page + 1)),
      label = document.createElement('span');
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    label.textContent = `${total} entries · page ${page + 1} of ${pages}`;
    nav.append(previous, label, next);
  }
  function renderScores() {
    const { library } = api.get();
    $('scoreboard').replaceChildren();
    const groups = Map.groupBy
      ? Map.groupBy(library.scores, (s) => s.boardId)
      : library.scores.reduce(
          (m, s) => m.set(s.boardId, [...(m.get(s.boardId) || []), s]),
          new Map(),
        );
    const query = $('score-search').value.toLowerCase().trim(),
      matches = [...groups.values()].filter((entries) =>
        `${entries[0].levelName} ${entries[0].classRoute.join(' ')}`.toLowerCase().includes(query),
      );
    scorePage = Math.min(scorePage, Math.max(0, Math.ceil(matches.length / 10) - 1));
    for (const entries of matches.slice(scorePage * 10, scorePage * 10 + 10)) {
      const group = document.createElement('section'),
        title = document.createElement('h3'),
        copy = document.createElement('p');
      title.textContent = entries[0].levelName;
      copy.className = 'micro-note';
      copy.textContent = `${entries[0].classRoute.join(' → ')} · ${entries[0].turnPolicy} · seed ${entries[0].seed}`;
      group.append(title, copy);
      const list = document.createElement('ol');
      for (const entry of [...entries].sort((a, b) => b.score - a.score || a.time - b.time)) {
        const li = document.createElement('li');
        li.textContent = `${entry.score.toLocaleString()} points · ${entry.time.toFixed(2)}s · ${entry.medal} · ${entry.completedAt.slice(0, 10)}`;
        list.append(li);
      }
      group.append(list);
      $('scoreboard').append(group);
    }
    if (!matches.length)
      $('scoreboard').textContent = library.scores.length
        ? 'No scores match this search.'
        : 'Your first completed flight will appear here.';
    paginate('score-pages', scorePage, matches.length, 10, (p) => {
      scorePage = p;
      renderScores();
    });
  }
  $('score-search').oninput = () => {
    scorePage = 0;
    renderScores();
  };
  $('gallery-search').oninput = () => {
    galleryPage = 0;
    populateGallery();
  };
  function refresh() {
    renderScores();
    $('undo-library').disabled = !previousLibrary;
    $('undo-backup').disabled = !previousBackup;
    const usage = libraryCapacity(api.get().library);
    $('library-capacity').textContent =
      `${usage.gallery} / ${usage.maxGallery} pictures · ${usage.campaigns} / ${usage.maxCampaigns} campaigns · ${usage.percent.toFixed(1)}% of profile budget. Old pictures are preserved; export archives before reaching capacity.`;
    const saved = api.saved();
    $('suspended-status').textContent = saved
      ? `Saved flight: ${saved.replay?.level?.name || 'Unknown'} · ${typeof saved.savedAt === 'string' ? saved.savedAt.replace('T', ' ').slice(0, 19) : 'Date unavailable'}`
      : 'No suspended attempt. Use Save & pause during a flight.';
    $('resume-save').disabled = !saved;
    $('installed-packs').replaceChildren();
    for (const pack of api.get().packs.packs) {
      const row = document.createElement('article');
      const title = document.createElement('strong');
      title.textContent = `${pack.name} · ${pack.version}`;
      const p = document.createElement('p');
      p.textContent = pack.description;
      row.append(title, p);
      for (const source of pack.campaigns)
        row.append(
          button(`Play ${source.title || source.name || source.id}`, () => {
            api.select(
              api.catalog().find((c) => c.sourcePackId === pack.id && c.campaign.id === source.id),
            );
            $('library-dialog').close();
          }),
        );
      row.append(
        button('Remove from device', () =>
          task('pack-status', async () => {
            await api.setPacks(removePack(api.get().packs, pack.id));
            refresh();
            status(
              'pack-status',
              'Pack removed. Its player records are preserved; reinstall it to view its pictures.',
            );
          }),
        ),
      );
      $('installed-packs').append(row);
    }
  }
  $('library-dialog').addEventListener('cancel', (e) => {
    if (busy) e.preventDefault();
  });
  function backupOptions() {
    return {
      campaigns: [api.base().campaign],
      resolveCampaign: (key) => {
        const match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)\//.exec(key);
        if (!match) return null;
        return challengeCampaign(match[1], match[2], api.base().classRecipes);
      },
    };
  }
  function backupContents() {
    const { library, packs } = api.get();
    return { library, packs, session: api.currentSession() };
  }
  async function task(id, fn) {
    if (busy) return;
    busy = true;
    const controls = [...$('library-dialog').querySelectorAll('button,input,select,textarea')].map(
      (element) => ({ element, disabled: element.disabled }),
    );
    for (const { element } of controls) element.disabled = true;
    status(id, 'Checking…');
    try {
      await fn();
    } catch (e) {
      status(id, e);
    } finally {
      busy = false;
      for (const { element, disabled } of controls)
        if (element.isConnected) element.disabled = disabled;
      refresh();
    }
  }
  async function install(candidate) {
    await task('pack-status', async () => {
      const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      let next;
      if (parsed.format === 'xonix-pack-library.v1') next = await importPackLibrary(parsed);
      else {
        const prepared = await preparePack(parsed);
        next = installPack(api.get().packs, prepared.pack);
      }
      await api.setPacks(next);
      refresh();
      status(
        'pack-status',
        'Validated and installed. Choose Play above or use the Campaign selector.',
      );
    });
  }
  async function importSave(candidate) {
    await task('save-status', async () => {
      if (
        typeof candidate === 'string' &&
        new TextEncoder().encode(candidate).byteLength > MAX_BACKUP_BYTES
      )
        throw new Error('This backup exceeds the import budget.');
      const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      if (parsed.format === 'xonix-backup.v1') {
        const prepared = await prepareBackup(parsed, backupOptions());
        let old = null;
        try {
          if (api.canSnapshotBackup())
            old = await prepareBackup(
              { format: 'xonix-backup.v1', ...backupContents() },
              backupOptions(),
            );
        } catch {}
        const applied = await api.applyBackup(prepared);
        previousBackup = old;
        previousLibrary = null;
        $('undo-library').disabled = true;
        $('undo-backup').disabled = false;
        refresh();
        status(
          'save-status',
          `Complete backup restored. Your saved flight is ready to load. ${old ? 'Undo restores the previous collection, packs and saved flight.' : 'The previous data could not form a verified backup, so Undo is unavailable.'} ${applied.warning || ''}`,
        );
        return;
      }
      if (parsed.format === 'xonix-session.v1') {
        await api.restore(parsed);
        $('library-dialog').close();
        return;
      }
      const next = importLibrary(parsed, { campaigns: api.catalog().map((c) => c.campaign) });
      previousLibrary = api.get().library;
      const result = api.setLibrary(next);
      $('undo-library').disabled = false;
      refresh();
      status(
        'save-status',
        result.ok
          ? 'Player library loaded. Previous library is available with Undo.'
          : result.warning,
      );
    });
  }
  $('library-button').onclick = () => open();
  for (const b of document.querySelectorAll('[data-library-panel]'))
    b.onclick = () => open(b.dataset.libraryPanel);
  $('export-backup').onclick = () =>
    task('save-status', async () => {
      const text = await exportBackup(backupContents(), backupOptions());
      $('save-json').value = text;
      const exported = await downloadJSON(JSON.parse(text), 'revealline-complete-backup.json');
      status(
        'save-status',
        `Complete backup prepared: player library, packs and saved flight. ${exported.message} ${api.sessionNote?.() || ''}`,
      );
    });
  $('undo-backup').onclick = () =>
    task('save-status', async () => {
      if (!previousBackup) return;
      await api.applyBackup(previousBackup);
      previousBackup = null;
      previousLibrary = null;
      $('undo-backup').disabled = true;
      $('undo-library').disabled = true;
      refresh();
      status('save-status', 'Previous collection, packs and saved flight restored.');
    });
  $('export-library').onclick = () =>
    task('save-status', async () => {
      const text = exportLibrary(api.get().library);
      $('save-json').value = text;
      const exported = await downloadJSON(JSON.parse(text), 'revealline-player-library.json');
      status(
        'save-status',
        `Library prepared. ${exported.message} Keep packs and attempt files alongside it.`,
      );
    });
  $('import-save').onclick = () => importSave($('save-json').value);
  $('save-file').onchange = () =>
    task('save-status', async () => {
      const text = await fileText($('save-file').files[0], MAX_BACKUP_BYTES);
      busy = false;
      await importSave(text);
    });
  $('undo-library').onclick = () => {
    if (previousLibrary) {
      const result = api.setLibrary(previousLibrary);
      if (result.ok) previousLibrary = null;
      $('undo-library').disabled = true;
      refresh();
      status(
        'save-status',
        result.ok
          ? 'Previous player library restored.'
          : `Previous library is active for this session. ${result.warning}`,
      );
    }
  };
  $('resume-save').onclick = () =>
    task('save-status', async () => {
      await api.restore(api.saved());
      $('library-dialog').close();
    });
  $('export-session').onclick = () =>
    task('save-status', async () => {
      const s = api.suspend();
      $('save-json').value = JSON.stringify(s, null, 2);
      const exported = await downloadJSON(s, 'revealline-suspended-flight.json');
      status(
        'save-status',
        `Unfinished flight prepared with verified-input recovery data. ${exported.message}`,
      );
    });
  $('install-pack').onclick = () => install($('pack-json').value);
  $('pack-file').onchange = () =>
    task('pack-status', async () => {
      const text = await fileText($('pack-file').files[0], 64 * 1024 * 1024);
      busy = false;
      await install(text);
    });
  $('export-packs').onclick = () =>
    task('pack-status', async () => {
      const text = exportPackLibrary(api.get().packs);
      $('pack-json').value = text;
      const exported = await downloadJSON(JSON.parse(text), 'revealline-expansion-packs.json');
      status(
        'pack-status',
        `Installed packs prepared with their original embedded images. ${exported.message}`,
      );
    });
  $('challenge-date').value = new Date().toISOString().slice(0, 10);
  $('launch-challenge').onclick = () => {
    try {
      const c = challengeCampaign(
        $('challenge-date').value,
        $('challenge-kind').value,
        api.base().classRecipes,
      );
      api.select({ ...api.base(), campaign: c });
      $('library-dialog').close();
    } catch (e) {
      status('challenge-status', e);
    }
  };
  fetch('content/packs/index.json')
    .then((r) => {
      if (!r.ok) throw new Error('Example packs could not load.');
      return r.json();
    })
    .then((index) => {
      for (const pack of index.packs) {
        $('builtin-packs').append(
          button(`Install ${pack.id.replaceAll('-', ' ')}`, async () => {
            await task('pack-status', async () => {
              const r = await fetch(`content/packs/${pack.path}`);
              if (!r.ok) throw new Error('Example pack is unavailable.');
              const data = await r.json();
              busy = false;
              await install(data);
            });
          }),
        );
      }
    })
    .catch((e) => status('pack-status', e));

  function resolvePicture(item) {
    const entry = api.catalog().find((e) => campaignKey(e.campaign) === item.campaignKey);
    if (!entry) return null;
    const level = entry.campaign.levels.find((l) => l.id === item.levelId);
    const theme = entry.themes.find((t) => t.id === item.themeId);
    if (!level || !theme) return null;
    const visualOverrides = {
      ...entry.visualOverrides,
      ...entry.levelVisuals?.find((v) => v.levelId === item.levelId)?.visualOverrides,
    };
    return { entry, level, theme, visualOverrides, item };
  }
  async function drawPicture(canvas, picture, accept = () => true) {
    const args = {
      theme: picture.theme,
      level: picture.level,
      seed: picture.item.seed ?? 1,
      width: canvas.width,
      height: canvas.height,
    };
    if (picture.visualOverrides.background) {
      const image = new Image();
      image.src = picture.visualOverrides.background.dataUrl;
      await image.decode();
      args.image = image;
      args.fit = picture.visualOverrides.background.fit;
    }
    if (accept() && canvas.isConnected) galleryPainter.drawGallery(canvas.getContext('2d'), args);
  }
  function populateGallery() {
    $('gallery-grid').replaceChildren();
    const worlds = new Map(
      api.catalog().map((entry) => [campaignKey(entry.campaign), entry.themes]),
    );
    const query = $('gallery-search').value.toLowerCase().trim(),
      items = api
        .get()
        .library.gallery.filter((item) =>
          `${item.levelName} ${item.themeId} ${worlds.get(item.campaignKey)?.find((theme) => theme.id === item.themeId)?.name || ''}`
            .toLowerCase()
            .includes(query),
        );
    galleryPage = Math.min(galleryPage, Math.max(0, Math.ceil(items.length / 12) - 1));
    for (const item of items.slice(galleryPage * 12, galleryPage * 12 + 12)) {
      const picture = resolvePicture(item);
      const card = document.createElement('button');
      card.className = 'gallery-card';
      card.type = 'button';
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvas.setAttribute('aria-hidden', 'true');
      const title = document.createElement('strong');
      title.textContent = item.levelName;
      const copy = document.createElement('span');
      copy.textContent = picture
        ? `${picture.theme.name} · ${item.medal.toUpperCase()} · ${item.score.toLocaleString()}`
        : 'Reinstall this picture’s pack to view';
      card.append(canvas, title, copy);
      card.disabled = !picture;
      card.onclick = () => openPicture(picture);
      $('gallery-grid').append(card);
      if (picture)
        drawPicture(canvas, picture).catch(() => {
          copy.textContent = 'Picture could not decode. Reinstall its pack.';
        });
    }
    if (!items.length)
      $('gallery-grid').textContent = api.get().library.gallery.length
        ? 'No pictures match this search.'
        : 'A picture is waiting behind your first completed mission.';
    paginate('gallery-pages', galleryPage, items.length, 12, (p) => {
      galleryPage = p;
      populateGallery();
    });
  }
  async function openPicture(picture) {
    const generation = ++viewGeneration;
    cancelAnimationFrame(galleryFrame);
    returnToCollection = true;
    view = picture;
    $('gallery-view-title').textContent = picture.level.name;
    $('gallery-view-meta').textContent =
      `${picture.theme.name} / ${picture.item.medal.toUpperCase()}`;
    $('collection-dialog').close();
    $('gallery-view-dialog').showModal();
    try {
      await drawPicture(
        $('gallery-canvas'),
        picture,
        () => generation === viewGeneration && view === picture,
      );
    } catch (e) {
      if (generation === viewGeneration && view === picture)
        $('gallery-view-meta').textContent = e.message;
    }
  }
  $('gallery-replay').onclick = () => {
    if (view) {
      returnToCollection = false;
      api.select(view.entry, {
        levelId: view.level.id,
        themeId: view.theme.id,
        seed: view.item.seed ?? 1,
      });
      $('gallery-view-dialog').close();
    }
  };
  $('gallery-animate').onclick = async () => {
    if (!view) return;
    const picture = view,
      generation = ++viewGeneration;
    cancelAnimationFrame(galleryFrame);
    await galleryPainter.setLook(picture.theme, picture.theme.player, picture.visualOverrides);
    if (generation !== viewGeneration || view !== picture || !$('gallery-view-dialog').open) return;
    galleryPainter.setLevel?.(picture.level, { seed: picture.item.seed ?? 1 });
    galleryPainter.startCelebration?.({
      levelId: picture.level.id,
      seed: picture.item.seed ?? 1,
      reduced: api.get().library.preferences.reducedEffects,
    });
    // The gallery owns a presentation-only completed view; it never enters progression.
    const state = createRun(picture.level, {
      seed: picture.item.seed ?? 1,
      classRecipes: picture.entry.classRecipes,
      classId: picture.entry.classRecipes[0].id,
    });
    state.status = 'won';
    let last = performance.now();
    const frame = (now) => {
      if (!$('gallery-view-dialog').open || generation !== viewGeneration || view !== picture)
        return;
      galleryPainter.draw(
        $('gallery-canvas').getContext('2d'),
        state,
        Math.min((now - last) / 1000, 0.1),
        {
          paused: true,
          fullReveal: true,
          reduced: api.get().library.preferences.reducedEffects,
          celebrationPaused: document.hidden,
        },
      );
      last = now;
      if (galleryPainter.celebrationStatus?.active) galleryFrame = requestAnimationFrame(frame);
    };
    galleryFrame = requestAnimationFrame(frame);
  };
  $('gallery-view-dialog').addEventListener('close', () => {
    cancelAnimationFrame(galleryFrame);
    viewGeneration++;
    view = null;
    if (returnToCollection) {
      populateGallery();
      $('collection-dialog').showModal();
    }
  });
  return { open, refresh, populateGallery };
}
