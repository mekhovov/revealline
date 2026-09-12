import { validateScenario, downloadJSON, inspectImageDataUrl } from '../content.mjs';
import { prepareScenario } from '../imports.mjs';
import { emptyPackLibrary, exportPackLibrary, PACK_LIMITS } from '../packs.mjs';
import {
  editorScenario,
  entryScenario,
  prepareDocument,
  interactionPreset,
  PRESET_HELP,
  paintLevel,
  expansionFromScenario,
} from './model.mjs';
import { generateLevel } from '../generator.mjs';
import { verifyReplayAsync, MAX_REPLAY_BYTES } from '../replay.mjs';
const $ = (id) => document.getElementById(id),
  clone = (v) => structuredClone(v);
let campaign,
  themes,
  current,
  baseEntry,
  catalog = [],
  activeKey = 'builtin',
  packLibrary = emptyPackLibrary(),
  editRevision = 0,
  brush = 'wall',
  history = [],
  revision = 0,
  width = 390,
  height = 844,
  importEpoch = 0,
  replayEpoch = 0,
  replayController = null;
const beginImport = () => ({ epoch: ++importEpoch, editRevision, before: JSON.stringify(current) });
const importCurrent = (ticket) => ticket.epoch === importEpoch;
const assertImportCurrent = (ticket) => {
  if (
    !importCurrent(ticket) ||
    ticket.editRevision !== editRevision ||
    JSON.stringify(current) !== ticket.before
  )
    throw new Error(
      'The pack changed while this import was being read. Retry with the latest settings.',
    );
};
const status = (message, error = false) => {
  $('editor-status').textContent = message;
  $('editor-status').classList.toggle('error', error);
};
const remember = () => {
  editRevision++;
  history.push({ current: clone(current), catalog, activeKey, packLibrary });
  while (
    history.length > 1 &&
    (history.length > 20 ||
      history.reduce(
        (n, item) =>
          n + JSON.stringify(item.current).length + exportPackLibrary(item.packLibrary).length,
        0,
      ) >
        32 * 1024 * 1024)
  )
    history.shift();
  $('undo-button').disabled = false;
};
const selectedEntry = () => catalog.find((entry) => entry.key === activeKey) ?? baseEntry;
const currentTrack = () => current.music;

function useEntry(key, levelId) {
  const entry = catalog.find((item) => item.key === key);
  if (!entry) throw new Error('This campaign source is unavailable.');
  current = entryScenario(entry, levelId, current?.settings, current?.presentation);
  activeKey = key;
  campaign = entry.campaign;
  themes = { themes: entry.themes };
}
async function adoptDocument(candidate, message, ticket = beginImport()) {
  assertImportCurrent(ticket);
  const prepared = await prepareDocument(candidate, { current, packLibrary });
  assertImportCurrent(ticket);
  remember();
  if (prepared.kind === 'expansion') {
    packLibrary = prepared.packLibrary;
    catalog = [baseEntry, ...prepared.entries];
    activeKey = prepared.activeKey;
    campaign = selectedEntry().campaign;
    themes = { themes: selectedEntry().themes };
  }
  current = editorScenario(prepared.scenario);
  sync();
  status([message, ...prepared.warnings].join(' '));
  return prepared;
}
function sync() {
  $('campaign-select').replaceChildren(
    ...catalog.map((entry) => new Option(entry.label, entry.key)),
  );
  $('campaign-select').value = activeKey;
  $('source-readout').textContent =
    `${selectedEntry().label} · ${campaign.levels.length} maps. Editing a working copy; Undo returns to the previous configuration and source.`;
  $('export-catalog').disabled = !packLibrary.packs.length;
  const track = currentTrack();
  $('music-readout').textContent = track
    ? `Pack music: ${track.name} · ${track.genre} · ${track.tempo} BPM. This exact descriptor is used in practice and retained in the expansion export. Enable sound in the preview to listen.`
    : 'Original synthesized music is configured in the game audio controls.';
  for (const [id, key, fallback] of [
    ['mission-limit', 'timeLimitSeconds', 0],
    ['cut-limit', 'cutTimeLimitSeconds', 0],
    ['trail-limit', 'maxTrailCells', 0],
    ['switch-limit', 'switchCooldownSeconds', 2],
  ])
    $(id).value = current.level.rules?.[key] ?? fallback;
  const index = campaign.levels.findIndex((level) => level.id === current.level.id);
  $('level-select').replaceChildren(
    ...campaign.levels.map(
      (level, i) =>
        new Option(
          `${String(i + 1).padStart(2, '0')} / ${i === index ? current.level.name : level.name}`,
          String(i),
        ),
    ),
  );
  if (index < 0) $('level-select').append(new Option(current.level.name, 'custom'));
  $('level-select').value = index < 0 ? 'custom' : String(index);
  $('theme-select').replaceChildren(
    ...themes.themes.map(
      (theme) =>
        new Option(theme.id === current.theme.id ? current.theme.name : theme.name, theme.id),
    ),
  );
  if (!themes.themes.some((theme) => theme.id === current.theme.id))
    $('theme-select').append(new Option(current.theme.name, current.theme.id));
  $('theme-select').value = current.theme.id;
  $('terrain-style').value = current.presentation?.style || 'hybrid';
  $('show-grid').checked = current.presentation?.showGrid || false;
  $('goal-input').value = Math.round(current.level.goal.coverage * 100);
  $('speed-input').value = current.level.rules?.moveSpeed ?? 8;
  $('lives-input').value = current.level.rules?.lives ?? 3;
  $('class-select').replaceChildren();
  for (const c of current.classRecipes) $('class-select').append(new Option(c.label, c.id));
  $('class-select').value = current.settings.classId;
  $('turn-select').value = current.settings.turnPolicy;
  $('level-json').value = JSON.stringify(current.level, null, 2);
  $('theme-json').value = JSON.stringify(current.theme, null, 2);
  $('classes-json').value = JSON.stringify(current.classRecipes, null, 2);
  $('music-json').value = current.music ? JSON.stringify(current.music, null, 2) : '';
  drawMap();
  drawAssets();
}
function drawMap() {
  const c = $('map-editor').getContext('2d'),
    s = 16;
  c.fillStyle = current.theme.palette.field;
  c.fillRect(0, 0, 768, 576);
  c.fillStyle = current.theme.palette.safe;
  c.fillRect(0, 0, 768, s);
  c.fillRect(0, 560, 768, s);
  c.fillRect(0, 0, s, 576);
  c.fillRect(752, 0, s, 576);
  c.strokeStyle = current.theme.palette.grid;
  c.lineWidth = 0.6;
  for (let x = 0; x <= 768; x += s) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, 576);
    c.stroke();
  }
  for (let y = 0; y <= 576; y += s) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(768, y);
    c.stroke();
  }
  for (const zone of current.level.signalZones ?? []) {
    c.fillStyle = '#a875ce35';
    c.fillRect(zone.x * s, zone.y * s, zone.w * s, zone.h * s);
    c.strokeStyle = '#bb86d7';
    c.lineWidth = 2;
    c.setLineDash([4, 4]);
    c.strokeRect(zone.x * s, zone.y * s, zone.w * s, zone.h * s);
    c.setLineDash([]);
    c.fillStyle = '#e4c9f4';
    c.font = 'bold 10px monospace';
    c.fillText(`SIGNAL ${Math.round(zone.speedFactor * 100)}%`, zone.x * s + 3, zone.y * s + 12);
  }
  const hangars = current.level.hangars ?? [{ ...current.level.spawn, radius: 2 }];
  for (const h of hangars) {
    c.strokeStyle = '#7cdfb0';
    c.lineWidth = 2;
    c.strokeRect(h.x * s - 7, h.y * s - 7, 14, 14);
    c.fillStyle = '#7cdfb0';
    c.font = 'bold 10px monospace';
    c.fillText('H', h.x * s - 3, h.y * s + 4);
  }
  c.fillStyle = '#849496';
  for (const w of current.level.walls) c.fillRect(w.x * s, w.y * s, w.w * s, w.h * s);
  for (const e of current.level.enemies) {
    c.fillStyle = current.theme.palette.danger;
    c.beginPath();
    c.arc(e.x * s, e.y * s, e.type === 'lane-boss' ? 12 : 6, 0, Math.PI * 2);
    c.fill();
  }
  for (const o of current.level.objectives) {
    c.strokeStyle = current.theme.palette.accent;
    c.lineWidth = 2;
    c.strokeRect(o.x * s - 5, o.y * s - 5, 10, 10);
  }
  for (const p of current.level.supplies) {
    c.fillStyle = '#ffffff';
    c.fillRect(p.x * s - 3, p.y * s - 1, 6, 2);
    c.fillRect(p.x * s - 1, p.y * s - 3, 2, 6);
  }
  c.fillStyle = current.theme.palette.accent;
  c.beginPath();
  c.arc(current.level.spawn.x * s, current.level.spawn.y * s, 6, 0, Math.PI * 2);
  c.fill();
  $('map-readout').textContent =
    `${current.level.walls.length} wall rectangles · ${current.level.enemies.length} enemies · ${current.level.objectives.length} objectives · ${current.level.signalZones?.length ?? 0} signal zones · ${hangars.length} hangars · start ${current.level.spawn.x}, ${current.level.spawn.y}`;
}
function drawAssets() {
  $('asset-list').replaceChildren();
  for (const [role, item] of Object.entries(current.visualOverrides)) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = `Replacement for ${role}`;
    const name = document.createElement('span');
    name.textContent = `${role} / ${item.name || 'image'}`;
    card.append(img, name);
    $('asset-list').append(card);
  }
}
async function adopt(candidate, message, ticket = beginImport()) {
  assertImportCurrent(ticket);
  const prepared = await prepareScenario(candidate);
  assertImportCurrent(ticket);
  remember();
  current = editorScenario(prepared.scenario);
  sync();
  status([message, ...prepared.warnings].join(' '));
  return prepared;
}
function checked() {
  const result = validateScenario(current);
  if (!result.valid) {
    status(result.errors.join('\n'), true);
    return false;
  }
  return true;
}
function preview() {
  if ($('preview-mode').value === 'couch') {
    $('preview-frame').src = '../couch/?focus=1';
    $('open-preview').href = '../couch/?focus=1';
    status('Couch preview uses installed maps and packs. Solo configuration stays in the editor.');
    return true;
  }
  if (!checked()) return false;
  try {
    sessionStorage.setItem('revealline.playground.current', JSON.stringify(current));
    $('preview-frame').src = `../?practice=1&revision=${++revision}`;
    $('open-preview').href = `../?practice=1&revision=${revision}`;
    status(
      [
        'Valid configuration loaded into the real engine. Practice awards are disabled.',
        ...validateScenario(current).warnings,
      ].join(' '),
    );
    return true;
  } catch (error) {
    status(
      `Preview could not save this local pack: ${error.message}. Try smaller images or enable browser session storage.`,
      true,
    );
    return false;
  }
}
function fit() {
  const available = $('preview-stage').parentElement.clientWidth,
    scale = Math.min(1, available / width),
    frame = $('preview-frame');
  frame.width = width;
  frame.height = height;
  frame.style.transform = `scale(${scale})`;
  $('preview-stage').style.width = `${width * scale}px`;
  $('preview-stage').style.height = `${height * scale}px`;
  $('viewport-readout').textContent =
    `${width} × ${height} CSS pixels · shown at ${Math.round(scale * 100)}%`;
  measure();
}
function measure() {
  try {
    const frame = $('preview-frame'),
      doc = frame.contentDocument,
      view = frame.contentWindow,
      arena = doc?.querySelector('#arena-shell,#race-boards');
    if (!arena) return;
    const r = arena.getBoundingClientRect(),
      visible =
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= view.innerWidth + 1 &&
        r.bottom <= view.innerHeight + 1;
    $('layout-readout').textContent =
      `Arena ${r.width.toFixed(1)} × ${r.height.toFixed(1)} · top ${r.top.toFixed(0)}, bottom ${r.bottom.toFixed(0)} · ${visible ? 'whole arena visible' : 'scroll needed for whole arena'} · ${doc.documentElement.scrollWidth > view.innerWidth ? 'horizontal overflow' : 'no horizontal overflow'}`;
    const controls = [
      ...doc.querySelectorAll(
        '[data-move],#stop-button,#action-button,#pickup-button,#boost-button,#pause-button,#restart-button,#sound-button,.race-pad button,#race-start,#race-pause,#race-focus',
      ),
    ].map((button) => button.getBoundingClientRect());
    const reachable = controls.every(
      (r) =>
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= view.innerWidth + 1 &&
        r.bottom <= view.innerHeight + 1,
    );
    $('control-readout').textContent =
      `Controls: minimum ${Math.min(...controls.map((r) => r.width)).toFixed(0)} × ${Math.min(...controls.map((r) => r.height)).toFixed(0)} · ${reachable ? 'all actions visible' : 'scroll to reach some actions'}`;
  } catch {}
}
try {
  [campaign, themes] = await Promise.all([
    fetch('../content/campaign.json').then((r) => r.json()),
    fetch('../content/themes.json').then((r) => r.json()),
  ]);
  const recipes = await fetch('../content/classes.json').then((r) => r.json());
  current = {
    format: 'xonix-playground.v1',
    level: clone(campaign.levels[0]),
    theme: clone(themes.themes[0]),
    settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
    classRecipes: recipes,
    presentation: { style: 'hybrid', showGrid: false },
    visualOverrides: {},
  };
  current = editorScenario(current);
  baseEntry = {
    key: 'builtin',
    label: 'Built-in campaign',
    campaign,
    themes: themes.themes,
    classRecipes: recipes,
    visualOverrides: {},
    levelVisuals: [],
    music: [],
  };
  catalog = [baseEntry];
  $('campaign-select').onchange = () => {
    try {
      remember();
      useEntry($('campaign-select').value);
      sync();
      status('Campaign source selected. Play configuration to test this map.');
    } catch (error) {
      status(error.message, true);
    }
  };
  document.querySelectorAll('[data-preset]').forEach(
    (button) =>
      (button.onclick = async () => {
        const ticket = beginImport();
        try {
          const preset = interactionPreset(button.dataset.preset, current, recipes);
          await adopt(preset, 'Interaction preset ready. Play configuration to try it.', ticket);
          $('preset-readout').textContent = PRESET_HELP[button.dataset.preset];
          preview();
        } catch (error) {
          if (importCurrent(ticket)) status(error.message, true);
        }
      }),
  );
  fetch('../content/packs/index.json')
    .then((r) => {
      if (!r.ok) throw new Error('Example list unavailable.');
      return r.json();
    })
    .then((index) => {
      for (const entry of index.packs) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button secondary';
        button.textContent = `Load ${entry.id.replaceAll('-', ' ')}`;
        button.onclick = async () => {
          const ticket = beginImport();
          try {
            const response = await fetch(`../content/packs/${entry.path}`);
            if (!response.ok) throw new Error('Example expansion is unavailable.');
            await adoptDocument(
              await response.json(),
              'Expansion decoded. Select a campaign, map, theme and class above.',
              ticket,
            );
          } catch (error) {
            if (importCurrent(ticket)) status(error.message, true);
          }
        };
        $('example-packs').append(button);
      }
    })
    .catch((error) => status(error.message, true));
  campaign.levels.forEach((l, i) =>
    $('level-select').append(
      new Option(`${String(i + 1).padStart(2, '0')} / ${l.name}`, String(i)),
    ),
  );
  for (const t of themes.themes) $('theme-select').append(new Option(t.name, t.id));
  $('level-select').onchange = () => {
    remember();
    const level = campaign.levels[Number($('level-select').value)];
    if (level) useEntry(activeKey, level.id);
    sync();
    status('Level selected. Play configuration to test it.');
  };
  $('theme-select').onchange = () => {
    remember();
    current.theme = clone(
      themes.themes.find((t) => t.id === $('theme-select').value) || current.theme,
    );
    sync();
  };
  $('terrain-style').onchange = () => {
    remember();
    current.presentation = { ...current.presentation, style: $('terrain-style').value };
  };
  $('show-grid').onchange = () => {
    remember();
    current.presentation = { ...current.presentation, showGrid: $('show-grid').checked };
  };
  $('class-select').onchange = () => {
    remember();
    current.settings.classId = $('class-select').value;
  };
  $('turn-select').onchange = () => {
    remember();
    current.settings.turnPolicy = $('turn-select').value;
  };
  for (const [id, key] of [
    ['speed-input', 'moveSpeed'],
    ['lives-input', 'lives'],
    ['mission-limit', 'timeLimitSeconds'],
    ['cut-limit', 'cutTimeLimitSeconds'],
    ['trail-limit', 'maxTrailCells'],
    ['switch-limit', 'switchCooldownSeconds'],
  ])
    $(id).onchange = () => {
      remember();
      current.level.rules = { ...current.level.rules, [key]: Number($(id).value) };
      sync();
      checked();
    };
  $('goal-input').onchange = () => {
    remember();
    current.level.goal.coverage = Number($('goal-input').value) / 100;
    sync();
    checked();
  };
  $('generate-button').onclick = async () => {
    try {
      const level = await generateLevel($('seed-input').value);
      remember();
      current.level = level;
      current.settings.seed = parseInt(level.id.slice(10, 18), 16) >>> 0;
      sync();
      status(
        'Deterministic map generated and validated. Dynamic difficulty still needs playtesting.',
      );
    } catch (error) {
      status(error.message, true);
    }
  };
  document.querySelectorAll('[data-brush]').forEach(
    (b) =>
      (b.onclick = () => {
        brush = b.dataset.brush;
        document
          .querySelectorAll('[data-brush]')
          .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
  );
  function paintAt(x, y) {
    try {
      const level = paintLevel(current.level, brush, x, y, {
        signalWidth: Number($('signal-width').value),
        signalHeight: Number($('signal-height').value),
        speedFactor: Number($('signal-speed').value) / 100,
      });
      remember();
      current.level = level;
      $('paint-x').value = x;
      $('paint-y').value = y;
      sync();
      checked();
      status('Map edited. Play configuration to test the actual behavior.');
    } catch (error) {
      status(`Paint rejected: ${error.message}`, true);
    }
  }
  $('map-editor').addEventListener('pointerdown', (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    paintAt(
      Math.floor(((event.clientX - rect.left) / rect.width) * 48),
      Math.floor(((event.clientY - rect.top) / rect.height) * 36),
    );
  });
  $('paint-cell').onclick = () => paintAt(Number($('paint-x').value), Number($('paint-y').value));
  $('undo-button').onclick = () => {
    const previous = history.pop();
    if (previous) {
      current = previous.current;
      catalog = previous.catalog;
      activeKey = previous.activeKey;
      packLibrary = previous.packLibrary;
      campaign = selectedEntry().campaign;
      themes = { themes: selectedEntry().themes };
      editRevision++;
    }
    $('undo-button').disabled = !history.length;
    sync();
    checked();
  };
  $('preview-button').onclick = preview;
  $('open-preview').onclick = (event) => {
    if (!preview()) event.preventDefault();
  };
  $('export-button').onclick = async () => {
    try {
      if (checked())
        status((await downloadJSON(current, `${current.level.id}.xonix.json`)).message);
    } catch (error) {
      status(error.message, true);
    }
  };
  $('import-file').onchange = async () => {
    const file = $('import-file').files[0];
    if (!file) return;
    const ticket = beginImport();
    try {
      if (file.size > PACK_LIMITS.libraryBytes) throw new Error('Content is larger than 48 MiB.');
      const candidate = JSON.parse(await file.text());
      await adoptDocument(
        candidate,
        'Imported and decoded. The previous pack remains available through Undo.',
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(`Import rejected: ${error.message}`, true);
    } finally {
      if (importCurrent(ticket)) $('import-file').value = '';
    }
  };
  $('apply-json').onclick = async () => {
    const ticket = beginImport();
    try {
      const candidate = {
        ...current,
        level: JSON.parse($('level-json').value),
        theme: JSON.parse($('theme-json').value),
        classRecipes: JSON.parse($('classes-json').value),
      };
      const trackText = $('music-json').value.trim();
      if (trackText) candidate.music = JSON.parse(trackText);
      else delete candidate.music;
      if (!candidate.classRecipes.some((c) => c.id === candidate.settings.classId))
        candidate.settings = { ...candidate.settings, classId: candidate.classRecipes[0]?.id };
      await adopt(
        candidate,
        'JSON validated and applied. Play configuration to compare it.',
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(error.message, true);
    }
  };
  $('asset-file').onchange = async () => {
    const file = $('asset-file').files[0],
      role = $('asset-role').value,
      fit = $('asset-fit').value;
    if (!file) return;
    const ticket = beginImport();
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 4 * 1024 * 1024
      )
        throw new Error('Choose a PNG, JPEG or WebP up to 4 MiB.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Image file could not be read.'));
        reader.readAsDataURL(file);
      });
      const inspected = inspectImageDataUrl(dataUrl);
      if (!inspected.valid) throw new Error(inspected.errors.join(' '));
      const candidate = {
        ...current,
        visualOverrides: { ...current.visualOverrides, [role]: { dataUrl, name: file.name, fit } },
      };
      await adopt(
        candidate,
        'Artwork validated and decoded. Play configuration to see it in motion.',
        ticket,
      );
      $('asset-status').textContent =
        `${file.name}: ${inspected.width} × ${inspected.height}. Bound to ${role}; original bytes unchanged.`;
    } catch (error) {
      if (importCurrent(ticket)) status(error.message, true);
    } finally {
      if (importCurrent(ticket)) $('asset-file').value = '';
    }
  };
  $('clear-asset').onclick = () => {
    remember();
    delete current.visualOverrides[$('asset-role').value];
    drawAssets();
    $('asset-status').textContent = 'Role restored to its authored default.';
  };
  $('asset-fit').onchange = () => {
    remember();
    if (current.visualOverrides.background)
      current.visualOverrides.background.fit = $('asset-fit').value;
  };
  $('show-pack').onclick = () => {
    $('pack-json').value = JSON.stringify(current, null, 2);
  };
  $('apply-pack').onclick = async () => {
    const ticket = beginImport();
    try {
      const text = $('pack-json').value;
      if (text.length > PACK_LIMITS.libraryBytes) throw new Error('Content is larger than 48 MiB.');
      await adoptDocument(
        text,
        'Content validated, decoded and applied. Undo preserves the previous source.',
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(`Import rejected: ${error.message}`, true);
    }
  };
  $('export-expansion').onclick = async () => {
    try {
      if (!checked()) return;
      const track = currentTrack();
      const pack = expansionFromScenario(current, { music: track ? [track] : [] });
      const exported = await downloadJSON(pack, `${pack.id}.expansion.json`);
      status(
        `Edited map prepared as a complete playable expansion. ${exported.message} Import it into the main game to keep campaign progress.`,
      );
    } catch (error) {
      status(error.message, true);
    }
  };
  $('export-catalog').onclick = async () => {
    try {
      const exported = await downloadJSON(
        JSON.parse(exportPackLibrary(packLibrary)),
        'workshop-expansions.json',
      );
      status(
        `Original loaded expansion library prepared. ${exported.message} Current map edits are exported separately with Export map as expansion.`,
      );
    } catch (error) {
      status(error.message, true);
    }
  };
  async function verifyText(readText) {
    const epoch = ++replayEpoch;
    replayController?.abort();
    replayController = new AbortController();
    const signal = replayController.signal;
    $('replay-result').textContent = '';
    try {
      const text = await readText();
      if (text.length > MAX_REPLAY_BYTES) throw new Error('Replay exceeds the import budget.');
      if (epoch !== replayEpoch) return;
      status('Verifying recorded simulation…');
      const result = await verifyReplayAsync(text, {
        signal,
        onProgress: (p) => {
          if (epoch === replayEpoch)
            status(`Verifying recorded simulation… ${Math.round(p.fraction * 100)}%`);
        },
      });
      if (epoch !== replayEpoch) return;
      $('replay-result').textContent = JSON.stringify(
        { match: result.match, diagnostics: result.diagnostics, actual: result.actual.summary },
        null,
        2,
      );
      status(
        result.match
          ? 'Replay matches its full recorded simulation state.'
          : 'Replay differs: check the reported state sections.',
        !result.match,
      );
    } catch (error) {
      if (epoch === replayEpoch) status(`Replay rejected: ${error.message}`, true);
    } finally {
      if (epoch === replayEpoch) $('replay-file').value = '';
    }
  }
  $('replay-file').onchange = () => {
    const file = $('replay-file').files[0];
    if (file)
      verifyText(() => {
        if (file.size > MAX_REPLAY_BYTES) throw new Error('Replay exceeds the import budget.');
        return file.text();
      });
  };
  $('verify-replay-json').onclick = () => verifyText(() => $('replay-paste').value);
  document.querySelectorAll('[data-size]').forEach(
    (b) =>
      (b.onclick = () => {
        [width, height] = b.dataset.size.split(',').map(Number);
        document
          .querySelectorAll('[data-size]')
          .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        fit();
      }),
  );
  window.addEventListener('resize', fit);
  $('preview-mode').onchange = preview;
  $('preview-frame').addEventListener('load', () => {
    measure();
    $('preview-frame').contentDocument?.addEventListener('click', () =>
      requestAnimationFrame(measure),
    );
  });
  setInterval(measure, 500);
  sync();
  fit();
  preview();
} catch (error) {
  status(`Playground could not load: ${error.message}`, true);
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  $('boot-status').hidden = true;
}
