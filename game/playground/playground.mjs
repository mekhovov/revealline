import { geometryForLevel } from '../core/geometry.mjs';
import { paintEditorMap, editorCellFromPointer } from './board-view.mjs';
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
  withScenarioMastery,
  withScenarioEncounter,
  withoutScenarioEncounter,
  editScenario,
  entryMastery,
} from './model.mjs';
import { generateLevel } from '../generator.mjs';
import { resolvePreviewSize } from './viewport.mjs';
import { captureControlGeometry } from './control-geometry.mjs';
import { firstFlightPreviewURL } from '../ui/first-flight-preview.mjs';
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
  const definition = current.masteryDefinition;
  const noMasteries = ['xonix-playground.v3', 'xonix-playground.v4'].includes(current.format);
  $('mastery-json').value = definition ? JSON.stringify(definition, null, 2) : '';
  $('mastery-readout').textContent =
    current.format === 'xonix-playground.v4'
      ? 'Wide edition. Optional equipment goals are unavailable; the map retains its explicit encounter or no-encounter choice.'
      : current.format === 'xonix-playground.v3'
        ? 'Staged encounter. This ruleset has no optional equipment goals; its two-stage requirements are part of the map.'
        : current.format === 'xonix-playground.v2'
          ? definition
            ? `${definition.name} · ${definition.description} References validate against this map and roster; play the route to test completion.`
            : 'No optional goal. This explicit choice is retained in practice and expansion exports.'
          : 'Legacy scenario: only exact shipped content can use its built-in goal. Copy the campaign goal to edit it explicitly, or choose no optional goal.';
  $('use-campaign-goal').disabled = noMasteries || !entryMastery(selectedEntry(), current.level.id);
  $('apply-mastery').disabled = noMasteries;
  $('clear-goal').disabled = noMasteries;
  const encounter = current.level.encounter;
  $('encounter-fields').disabled = !encounter;
  $('encounter-readout').textContent = encounter
    ? `Two-stage relay. Close ${encounter.minReleaseCutCells} new trail cells during an opening, or isolate the core to at most ${encounter.minReleaseCutCells} field cells. The sentinel must remain the only field seed. Test every class and steering mode after changing this recipe.`
    : 'Load Sentinel Relay from the expansion examples to edit its two stages. Ordinary maps keep their existing rules.';
  if (encounter)
    for (const [id, value] of [
      ['enemy', encounter.enemyId],
      ['shield', encounter.shieldObjectiveId],
      ['core', encounter.coreObjectiveId],
      ['cut', encounter.minReleaseCutCells],
      ['width', encounter.laneWidth],
      ['delay', encounter.initialDelayTicks],
      ['transition', encounter.transitionTicks],
      ['shield-warning', encounter.shielded.warningTicks],
      ['shield-active', encounter.shielded.activeTicks],
      ['shield-rest', encounter.shielded.restTicks],
      ['core-warning', encounter.exposed.warningTicks],
      ['core-active', encounter.exposed.activeTicks],
      ['core-open', encounter.exposed.openTicks],
    ])
      $(`encounter-${id}`).value = value;
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
  const { hangarCount } = paintEditorMap($('map-editor'), current);
  const { width: columns, height: rows } = geometryForLevel(current.level);
  $('paint-x').max = String(columns - 1);
  $('paint-y').max = String(rows - 1);
  $('trail-limit').max = String((columns - 2) * (rows - 2));
  $('map-readout').textContent =
    `${columns} × ${rows} cells · ${current.level.walls.length} wall rectangles · ${current.level.enemies.length} enemies · ${current.level.objectives.length} objectives · ${current.level.signalZones?.length ?? 0} signal zones · ${hangarCount} hangars · start ${current.level.spawn.x}, ${current.level.spawn.y}`;
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
  if ($('preview-mode').value === 'course') {
    try {
      const href = firstFlightPreviewURL({ turnPolicy: $('turn-select').value });
      $('preview-frame').src = href;
      $('open-preview').href = href;
      status(
        'First Flight course uses three fixed practice lessons. Your editor, history and saved configuration stay unchanged.',
      );
      return true;
    } catch (error) {
      status(`Course preview was not replaced: ${error.message}`, true);
      return false;
    }
  }
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
  geometryStale('Preview size or display scale changed. Capture again for current rectangles.');
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
function resizePreview(nextWidth, nextHeight) {
  // Validate both before adopting either dimension. The iframe URL and run stay intact.
  const next = resolvePreviewSize(nextWidth, nextHeight);
  width = next.width;
  height = next.height;
  $('preview-width').value = String(width);
  $('preview-height').value = String(height);
  document.querySelectorAll('[data-size]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.size === `${width},${height}`));
  });
  $('preview-size-status').classList.remove('error');
  $('preview-size-status').textContent = `Preview set to ${width} × ${height} CSS pixels.`;
  fit();
}
function measure() {
  try {
    const frame = $('preview-frame'),
      doc = frame.contentDocument,
      view = frame.contentWindow,
      arena = doc?.querySelector('#arena-shell,#race-boards');
    if (view)
      $('viewport-readout').textContent =
        `${width} × ${height} CSS pixels requested · frame reports ${view.innerWidth} × ${view.innerHeight} · shown at ${Math.round(Math.min(1, $('preview-stage').parentElement.clientWidth / width) * 100)}%`;
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
    ]
      .map((button) => button.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const reachable = controls.every(
      (r) =>
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= view.innerWidth + 1 &&
        r.bottom <= view.innerHeight + 1,
    );
    $('control-readout').textContent =
      `Controls: minimum ${Math.min(...controls.map((r) => r.width)).toFixed(0)} × ${Math.min(...controls.map((r) => r.height)).toFixed(0)} · ${reachable ? 'all actions visible' : 'scroll to reach some actions'}`;
    const launchVisible = (button, b) => {
      if (
        b.left < 0 ||
        b.top < 0 ||
        b.right > view.innerWidth + 1 ||
        b.bottom > view.innerHeight + 1
      )
        return false;
      const hit = doc.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return hit === button || button.contains(hit);
    };
    const launch = [...doc.querySelectorAll('#game-overlay button:not([hidden])')]
      .map((button) => ({
        button,
        label: button.textContent.trim(),
        rect: button.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    $('launch-readout').textContent = launch.length
      ? `Launch actions: ${launch.map(({ button, label, rect: b }) => `${label} ${b.width.toFixed(0)} × ${b.height.toFixed(0)} · ${launchVisible(button, b) ? 'visible in viewport' : 'scroll needed or covered'}`).join('; ')}`
      : 'No launch overlay is active.';
  } catch {}
}
let geometryCaptured = false;
let geometryDocument = null;
let geometryView = null;
function geometryStale(
  message = 'Preview activity may have changed this snapshot. Capture again.',
) {
  if (geometryCaptured) $('geometry-status').textContent = `Previous capture retained. ${message}`;
}
function geometryActivity() {
  geometryStale();
}
function observeGeometryPreview() {
  geometryDocument?.removeEventListener('click', geometryActivity);
  geometryDocument?.removeEventListener('keydown', geometryActivity);
  geometryView?.removeEventListener('scroll', geometryActivity);
  geometryView?.removeEventListener('resize', geometryActivity);
  geometryDocument = null;
  geometryView = null;
  geometryStale('Preview document reloaded. Capture again.');
  try {
    geometryDocument = $('preview-frame').contentDocument;
    geometryView = $('preview-frame').contentWindow;
    geometryDocument?.addEventListener('click', geometryActivity);
    geometryDocument?.addEventListener('keydown', geometryActivity);
    geometryView?.addEventListener('scroll', geometryActivity, { passive: true });
    geometryView?.addEventListener('resize', geometryActivity);
  } catch {
    geometryStale('This preview cannot be measured from the Playground.');
  }
}
function captureGeometry() {
  try {
    const frame = $('preview-frame');
    const report = captureControlGeometry({
      document: frame.contentDocument,
      view: frame.contentWindow,
      requested: { width, height },
      displayScale: Math.min(1, $('preview-stage').parentElement.clientWidth / width),
    });
    $('geometry-readout').textContent = JSON.stringify(report, null, 2);
    geometryCaptured = true;
    $('geometry-status').textContent =
      `Captured ${report.capturedAt}${$('preview-mode').value === 'course' ? ' · First Flight course' : ''}. Snapshot only; configuration and run are not edited.`;
  } catch (error) {
    geometryCaptured = false;
    $('geometry-readout').textContent = '';
    $('geometry-status').textContent = `Capture unavailable: ${error.message}`;
  }
}
try {
  [campaign, themes] = await Promise.all([
    fetch('../content/campaign.json').then((r) => r.json()),
    fetch('../content/themes.json').then((r) => r.json()),
  ]);
  const recipes = await fetch('../content/classes.json').then((r) => r.json());
  current = {
    format:
      campaign.levels[0].version === 'xonix-level.v3'
        ? 'xonix-playground.v4'
        : 'xonix-playground.v1',
    ...(campaign.levels[0].version === 'xonix-level.v3' ? { masteryDefinition: null } : {}),
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
          await adopt(
            preset,
            'Interaction preset ready without an optional goal. Play configuration to try it; Undo restores the previous map and goal.',
            ticket,
          );
          $('preset-readout').textContent =
            `New 48 × 36 Standard practice map. ${PRESET_HELP[button.dataset.preset]}`;
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
  $('apply-mastery').onclick = async () => {
    const ticket = beginImport();
    try {
      const definition = JSON.parse($('mastery-json').value);
      await adopt(
        withScenarioMastery(current, definition),
        'Optional goal validated and applied. Play configuration to test its actual conditions.',
        ticket,
      );
    } catch (error) {
      if (importCurrent(ticket)) status(`Goal rejected: ${error.message}`, true);
    }
  };
  $('clear-goal').onclick = () => {
    const next = withScenarioMastery(current, null);
    remember();
    current = next;
    sync();
    status('Optional goal disabled explicitly. Undo restores the previous definition.');
  };
  $('use-campaign-goal').onclick = () => {
    try {
      const definition = entryMastery(selectedEntry(), current.level.id);
      if (!definition) throw new Error('This source map has no registered goal.');
      const next = withScenarioMastery(current, definition);
      remember();
      current = next;
      sync();
      status(
        'Campaign goal copied into this editable scenario. Changes apply to this copy; practice never awards progress.',
      );
    } catch (error) {
      status(`Goal rejected: ${error.message}`, true);
    }
  };
  $('apply-encounter').onclick = () => {
    try {
      if (!current.level.encounter) throw new Error('Load a staged encounter first.');
      const number = (id) => Number($(`encounter-${id}`).value);
      const next = withScenarioEncounter(current, {
        ...current.level.encounter,
        enemyId: $('encounter-enemy').value,
        shieldObjectiveId: $('encounter-shield').value,
        coreObjectiveId: $('encounter-core').value,
        minReleaseCutCells: number('cut'),
        laneWidth: number('width'),
        initialDelayTicks: number('delay'),
        transitionTicks: number('transition'),
        shielded: {
          warningTicks: number('shield-warning'),
          activeTicks: number('shield-active'),
          restTicks: number('shield-rest'),
        },
        exposed: {
          warningTicks: number('core-warning'),
          activeTicks: number('core-active'),
          openTicks: number('core-open'),
        },
      });
      remember();
      current = next;
      sync();
      status(
        'Encounter validated and applied. Play configuration to test the timing and routes. Undo restores the prior recipe.',
      );
    } catch (error) {
      status(`Encounter rejected: ${error.message}`, true);
    }
  };
  $('remove-encounter').onclick = () => {
    try {
      const next = withoutScenarioEncounter(current);
      remember();
      current = next;
      sync();
      status(
        'Converted to an ordinary map. The sentinel was removed; both objectives and artwork remain. Undo restores the encounter.',
      );
    } catch (error) {
      status(`Conversion rejected: ${error.message}`, true);
    }
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
      try {
        const next = editScenario(current, {
          level: {
            ...current.level,
            rules: { ...current.level.rules, [key]: Number($(id).value) },
          },
        });
        remember();
        current = next;
        sync();
      } catch (error) {
        sync();
        status(`Edit rejected: ${error.message}`, true);
      }
    };
  $('goal-input').onchange = () => {
    try {
      const next = editScenario(current, {
        level: {
          ...current.level,
          goal: { ...current.level.goal, coverage: Number($('goal-input').value) / 100 },
        },
      });
      remember();
      current = next;
      sync();
    } catch (error) {
      sync();
      status(`Edit rejected: ${error.message}`, true);
    }
  };
  $('generate-button').onclick = async () => {
    const ticket = beginImport();
    try {
      const level = await generateLevel($('seed-input').value);
      assertImportCurrent(ticket);
      const next = editScenario(current, {
        ...(['xonix-playground.v3', 'xonix-playground.v4'].includes(current.format)
          ? { format: 'xonix-playground.v2', masteryDefinition: null }
          : {}),
        level,
        settings: { ...current.settings, seed: parseInt(level.id.slice(10, 18), 16) >>> 0 },
      });
      remember();
      current = next;
      sync();
      status(
        'New 48 × 36 Standard map generated and validated. This replaces the working map; Undo restores its previous edition. Dynamic difficulty still needs playtesting.',
      );
    } catch (error) {
      if (importCurrent(ticket))
        status(
          `${error.message} If the current goal names objects on the previous map, choose No optional goal before generating a new map.`,
          true,
        );
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
      const next = editScenario(current, { level });
      remember();
      current = next;
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
    const cell = editorCellFromPointer(
      current.level,
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    if (cell) paintAt(cell.x, cell.y);
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
    if (checked())
      status(
        'Previous configuration and source restored. Play configuration to refresh the preview.',
      );
  };
  $('preview-button').onclick = preview;
  $('open-preview').onclick = (event) => {
    if (!preview()) event.preventDefault();
  };
  $('export-button').onclick = async () => {
    try {
      if (checked()) {
        $('pack-json').value = JSON.stringify(current, null, 2);
        $('pack-json').closest('details').open = true;
        status((await downloadJSON(current, `${current.level.id}.xonix.json`)).message);
      }
    } catch (error) {
      status(error.message, true);
    }
  };
  $('import-file').onchange = async () => {
    const file = $('import-file').files[0];
    $('import-file').value = '';
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
    $('asset-file').value = '';
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
      $('pack-json').value = JSON.stringify(pack, null, 2);
      $('pack-json').closest('details').open = true;
      const exported = await downloadJSON(pack, `${pack.id}.expansion.json`);
      status(
        `Edited map prepared as a complete playable expansion.${current.masteryDefinition ? ` Its goal now belongs to the new campaign ${current.level.id}; the new definition identity is separate from the source goal.` : ''} ${exported.message} Import it into the main game to keep campaign progress.`,
      );
    } catch (error) {
      status(error.message, true);
    }
  };
  $('export-catalog').onclick = async () => {
    try {
      $('pack-json').value = exportPackLibrary(packLibrary);
      $('pack-json').closest('details').open = true;
      const exported = await downloadJSON(
        JSON.parse($('pack-json').value),
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
    }
  }
  $('replay-file').onchange = () => {
    const file = $('replay-file').files[0];
    $('replay-file').value = '';
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
        resizePreview(...b.dataset.size.split(','));
      }),
  );
  $('preview-size-form').onsubmit = (event) => {
    event.preventDefault();
    try {
      resizePreview($('preview-width').value, $('preview-height').value);
    } catch (error) {
      $('preview-size-status').classList.add('error');
      $('preview-size-status').textContent = `${error.message} The previous preview size is kept.`;
    }
  };
  window.addEventListener('resize', fit);
  $('capture-geometry').addEventListener('click', () => requestAnimationFrame(captureGeometry));
  $('preview-mode').onchange = preview;
  $('preview-frame').addEventListener('load', () => {
    observeGeometryPreview();
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
