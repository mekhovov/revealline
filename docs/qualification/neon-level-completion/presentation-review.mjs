import { BoardPainter, boardPaintSizeForRun } from '../../../game/ui/render.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../../../game/core/index.mjs';
import {
  projectClassicCurrentRulesEntry,
  CLASSIC_RULES_CURRENT,
} from '../../../game/mission-library/classic-current-rules.mjs';
import { authoritativeCheckpoint } from '../../../game/replay.mjs';
const $ = (id) => document.getElementById(id);
const root = new URL('../../../', import.meta.url),
  cache = new Map(),
  reports = new Map();
async function read(path) {
  if (!cache.has(path))
    cache.set(
      path,
      fetch(new URL(path, root)).then((r) => {
        if (!r.ok) throw Error(`${path}: ${r.status}`);
        return r.json();
      }),
    );
  return cache.get(path);
}
const [{ images }, routes, presets, baseThemes] = await Promise.all([
  read('docs/qualification/neon-level-completion/inventory.json'),
  read('docs/qualification/neon-level-completion/winning-routes.json'),
  read('authoring/motion-lab/presets.json'),
  read('game/content/themes.json'),
]);
for (let i = 0; i < Math.ceil(images.length / 7); i++)
  $('sheet').add(new Option(`${i + 1}: ${images[i * 7].title}`, String(i)));
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function download(data, name) {
  const url = URL.createObjectURL(data),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function prepare(row) {
  const source = await read(
    row.packId ? `game/content/packs/${row.packId}.json` : 'game/content/campaign.json',
  );
  const campaign = row.packId ? source.campaigns.find((c) => c.id === row.campaignId) : source;
  const recipes = (source.classRecipes ?? []).filter(
    (c) => !campaign.classIds || campaign.classIds.includes(c.id),
  );
  const route = routes.receipts.find(
    (r) =>
      r.levelId === row.id && r.difficulty === 'standard' && r.options.turnPolicy === 'grid-center',
  );
  const resolvedCampaign = { ...campaign, ...(recipes.length ? { classRecipes: recipes } : {}) };
  const entry = route
    ? projectClassicCurrentRulesEntry({ campaign: resolvedCampaign }, CLASSIC_RULES_CURRENT)
    : { campaign: resolvedCampaign };
  const level = entry.campaign.levels.find((l) => l.id === row.id);
  const options = route?.options ?? {
    seed: 1,
    ...(recipes.length ? { classRecipes: recipes, classId: recipes[0].id } : {}),
  };
  const run = createRun(level, options);
  let partial = null,
    firstCut = null;
  if (route) {
    for (const [direction, ticks] of route.segments)
      for (let t = 0; t < ticks; t++) {
        stepRun(run, { direction }, FIXED_DT);
        if (!firstCut && run.player.cutting) firstCut = structuredClone(run);
        if (!partial && run.player.cutting && run.coverage >= 0.2) partial = structuredClone(run);
      }
    if (run.status !== 'won' || authoritativeCheckpoint(run).hash !== route.checkpoint)
      throw Error(`${row.title}: route checkpoint drift`);
  } else {
    // Presentation-only masking; never recorded, saved or advertised as legal gameplay.
    for (let y = 1; y < run.height - 1; y++)
      for (let x = 1; x < run.width / 2; x++)
        if (run.cells[y * run.width + x] === CELL.FIELD) run.cells[y * run.width + x] = CELL.SAFE;
    partial = run;
  }
  partial ??= firstCut ?? run;
  const image = new Image();
  image.src = new URL(row.source, root).href;
  await image.decode();
  const bytes = await (await fetch(image.src)).arrayBuffer();
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  if (
    sha !== row.imageSHA256 ||
    image.naturalWidth !== row.width ||
    image.naturalHeight !== row.height
  )
    throw Error(`${row.title}: decoded original mismatch`);
  const theme =
    (source.themes ?? baseThemes.themes).find((t) => t.id === campaign.themeId) ??
    (source.themes ?? baseThemes.themes)[0];
  const painter = new BoardPainter(presets);
  painter.setLevel(level, { seed: 1 });
  await painter.setLook(theme, 'fpv-body', {});
  const size = boardPaintSizeForRun(partial),
    desktop = canvas(size.width, size.height),
    narrow = canvas(size.width, size.height),
    reward = canvas(size.width, size.height);
  for (const [c, width] of [
    [desktop, 600],
    [narrow, 294],
  ])
    painter.draw(c.getContext('2d'), partial, 0, {
      paused: true,
      reduced: true,
      displayCSSWidth: width,
      backdrop: { image, fit: row.fit },
    });
  painter.drawGallery(reward.getContext('2d'), { theme, level, seed: 1, image, fit: row.fit });
  const report = {
    id: row.id,
    title: row.title,
    imageSHA256: sha,
    decoded: true,
    fit: row.fit,
    width: row.width,
    height: row.height,
    frame: route ? 'legal-route live cut' : 'presentation-only half mask',
    coverage: partial.coverage,
    checkpoint: route ? authoritativeCheckpoint(run).hash : null,
    desktopCSSWidth: 600,
    narrowCSSWidth: 294,
    lookWarning: painter.lookWarning,
  };
  painter.dispose();
  return { row, desktop, narrow, reward, report };
}
$('render').onclick = async () => {
  $('render').disabled = true;
  $('download').disabled = true;
  const page = Number($('sheet').value),
    rows = images.slice(page * 7, page * 7 + 7),
    atlas = $('atlas');
  atlas.width = 1320;
  atlas.height = rows.length * 350 + 45;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, atlas.width, atlas.height);
  ctx.font = '18px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText('Desktop partial · 600 px', 12, 25);
  ctx.fillText('Narrow partial · 294 px', 624, 25);
  ctx.fillText('Settled reward fit', 930, 25);
  try {
    for (let i = 0; i < rows.length; i++) {
      const view = await prepare(rows[i]),
        y = 45 + i * 350;
      ctx.fillStyle = '#e6edf8';
      ctx.font = '18px system-ui';
      ctx.fillText(`${page * 7 + i + 1}. ${view.row.title}`, 12, y + 22);
      ctx.font = '13px system-ui';
      ctx.fillText(
        `${view.report.frame} · fit ${view.row.fit} · original ${view.row.width}×${view.row.height}`,
        12,
        y + 43,
      );
      for (const [c, x, w] of [
        [view.desktop, 12, 600],
        [view.narrow, 624, 294],
        [view.reward, 930, 378],
      ])
        ctx.drawImage(c, x, y + 54, w, Math.min(286, (w * c.height) / c.width));
      reports.set(view.row.id, view.report);
      $('status').textContent = `Rendered ${reports.size} / ${images.length}: ${view.row.title}`;
    }
    $('download').disabled = false;
    $('report').textContent = JSON.stringify([...reports.values()], null, 2);
    $('status').textContent =
      `Sheet ${page + 1} ready; ${reports.size} / ${images.length} originals decoded and rendered`;
  } catch (e) {
    $('status').textContent = e.stack;
  } finally {
    $('render').disabled = false;
  }
};
$('download').onclick = () =>
  $('atlas').toBlob((blob) =>
    download(blob, `neon-presentation-sheet-${Number($('sheet').value) + 1}.png`),
  );
$('receipt').onclick = () =>
  download(
    new Blob(
      [
        JSON.stringify(
          {
            format: 'revealline-picture-presentation-review.v1',
            scope:
              'Shipped painter; legal route-derived Neon cuts; explicitly synthetic Classic masks; no profile writes or awards',
            rows: [...reports.values()],
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
    'neon-presentation-review.json',
  );
