import { validateScenario, downloadJSON, inspectImageDataUrl } from '../content.mjs';
import { prepareScenario } from '../imports.mjs';
import { generateLevel } from '../generator.mjs';
import { verifyReplayAsync, MAX_REPLAY_BYTES } from '../replay.mjs';
const $ = (id) => document.getElementById(id),
  clone = (v) => structuredClone(v);
let campaign,
  themes,
  current,
  brush = 'wall',
  history = [],
  revision = 0,
  width = 390,
  height = 844,
  importEpoch = 0,
  replayEpoch = 0,
  replayController = null;
const beginImport = () => ({ epoch: ++importEpoch, before: JSON.stringify(current) });
const importCurrent = (ticket) => ticket.epoch === importEpoch;
const assertImportCurrent = (ticket) => {
  if (!importCurrent(ticket) || JSON.stringify(current) !== ticket.before)
    throw new Error(
      'The pack changed while this import was being read. Retry with the latest settings.',
    );
};
const status = (message, error = false) => {
  $('editor-status').textContent = message;
  $('editor-status').classList.toggle('error', error);
};
const remember = () => {
  history.push(clone(current));
  while (
    history.length > 1 &&
    (history.length > 20 ||
      history.reduce((n, item) => n + JSON.stringify(item).length, 0) > 32 * 1024 * 1024)
  )
    history.shift();
  $('undo-button').disabled = false;
};
const uid = (prefix, list) => {
  let n = 1;
  while (list.some((x) => x.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
};
function sync() {
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
    `${current.level.walls.length} wall rectangles · ${current.level.enemies.length} enemies · ${current.level.objectives.length} objectives · start ${current.level.spawn.x}, ${current.level.spawn.y}`;
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
  current = prepared.scenario;
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
}
function measure() {
  try {
    const frame = $('preview-frame'),
      doc = frame.contentDocument,
      view = frame.contentWindow,
      arena = doc?.querySelector('#arena-shell');
    if (!arena) return;
    const r = arena.getBoundingClientRect(),
      visible =
        r.left >= 0 &&
        r.top >= 0 &&
        r.right <= view.innerWidth + 1 &&
        r.bottom <= view.innerHeight + 1;
    $('layout-readout').textContent =
      `Arena ${r.width.toFixed(1)} × ${r.height.toFixed(1)} · ${visible ? 'whole arena visible' : 'scroll needed for whole arena'} · ${doc.documentElement.scrollWidth > view.innerWidth ? 'horizontal overflow' : 'no horizontal overflow'}`;
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
  campaign.levels.forEach((l, i) =>
    $('level-select').append(
      new Option(`${String(i + 1).padStart(2, '0')} / ${l.name}`, String(i)),
    ),
  );
  for (const t of themes.themes) $('theme-select').append(new Option(t.name, t.id));
  $('level-select').onchange = () => {
    remember();
    current.level = clone(campaign.levels[Number($('level-select').value)] || current.level);
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
  $('map-editor').addEventListener('pointerdown', (event) => {
    const rect = event.currentTarget.getBoundingClientRect(),
      x = Math.floor(((event.clientX - rect.left) / rect.width) * 48),
      y = Math.floor(((event.clientY - rect.top) / rect.height) * 36);
    if (x < 0 || x > 47 || y < 0 || y > 35) return;
    remember();
    const l = current.level,
      inside = x > 0 && x < 47 && y > 0 && y < 35;
    if (brush === 'wall' && inside) l.walls.push({ x, y, w: 1, h: 1 });
    else if (brush === 'enemy' && inside)
      l.enemies.push({
        id: uid('enemy', l.enemies),
        type: 'bouncer',
        x: x + 0.5,
        y: y + 0.5,
        vx: 2.5,
        vy: 2,
        radius: 0.25,
      });
    else if (brush === 'objective' && inside)
      l.objectives.push({
        id: uid('objective', l.objectives),
        x: x + 0.5,
        y: y + 0.5,
        required: true,
        hidden: false,
      });
    else if (brush === 'supply')
      l.supplies.push({ id: uid('supply', l.supplies), x: x + 0.5, y: y + 0.5, radius: 1.5 });
    else if (brush === 'spawn' && !inside) l.spawn = { x: x + 0.5, y: y + 0.5 };
    else if (brush === 'erase') {
      l.walls = l.walls.filter((w) => !(x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h));
      for (const key of ['enemies', 'objectives', 'supplies'])
        l[key] = l[key].filter((o) => Math.floor(o.x) !== x || Math.floor(o.y) !== y);
    }
    sync();
    checked();
  });
  $('undo-button').onclick = () => {
    const previous = history.pop();
    if (previous) current = previous;
    $('undo-button').disabled = !history.length;
    sync();
    checked();
  };
  $('preview-button').onclick = preview;
  $('open-preview').onclick = (event) => {
    if (!preview()) event.preventDefault();
  };
  $('export-button').onclick = () => {
    if (checked()) downloadJSON(current, `${current.level.id}.xonix.json`);
  };
  $('import-file').onchange = async () => {
    const file = $('import-file').files[0];
    if (!file) return;
    const ticket = beginImport();
    try {
      if (file.size > 22 * 1024 * 1024) throw new Error('Pack is larger than 22 MiB.');
      const candidate = JSON.parse(await file.text());
      await adopt(
        candidate.version === 'xonix-level.v1' ? { ...current, level: candidate } : candidate,
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
      if (text.length > 22 * 1024 * 1024) throw new Error('Pack is larger than 22 MiB.');
      await adopt(JSON.parse(text), 'Complete pack validated, decoded and applied.', ticket);
    } catch (error) {
      if (importCurrent(ticket)) status(`Import rejected: ${error.message}`, true);
    }
  };
  $('replay-file').onchange = async () => {
    const file = $('replay-file').files[0];
    if (!file) return;
    const epoch = ++replayEpoch;
    replayController?.abort();
    replayController = new AbortController();
    const signal = replayController.signal;
    $('replay-result').textContent = '';
    try {
      if (file.size > MAX_REPLAY_BYTES) throw new Error('Replay exceeds the import budget.');
      const text = await file.text();
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
  };
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
  $('preview-frame').addEventListener('load', measure);
  setInterval(measure, 500);
  sync();
  fit();
  preview();
} catch (error) {
  status(`Playground could not load: ${error.message}`, true);
}
