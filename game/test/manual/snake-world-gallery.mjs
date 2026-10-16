import { classicTerrainCacheStats } from '../../snake/classic-terrain-cache.mjs';
import { snakeReviewPage } from './snake-review-pages.mjs';
import { CLASSIC_SNAKE_LEVELS, CLASSIC_SNAKE_CHAPTERS } from '../../snake/classic-catalogue.mjs';
import { createClassicSnake, classicSnakeUsesVariableHazards } from '../../snake/classic-core.mjs';
import { drawClassicBoard } from '../../snake/classic-view.mjs';
import { CLASSIC_BOARD_STYLES, resolveClassicWorld } from '../../snake/classic-worlds.mjs';
import {
  selectSnakeVisualProof,
  createSnakeVisualFixture,
  seekSnakeVisualScenario,
} from './snake-visual-fixture.mjs';

const authoredReview = new URLSearchParams(globalThis.location.search).get('review') === 'authored';
const cases = authoredReview
  ? CLASSIC_SNAKE_LEVELS.flatMap((entry) => {
      const world = resolveClassicWorld({ levelId: entry.id, chapterId: entry.chapterId });
      return world.floorPlan
        ? [[`${world.scene} · ${world.floorPlan.name}`, entry.id, world.scene, 'solo']]
        : [];
    })
  : [
      ['Open · Orchard Research Station', 'classic-snake-open-loop', 'orchard', 'solo'],
      ['Dense · Copper Foundry', 'classic-pursuit-crossing-bursts', 'workshop', 'solo'],
      ['Wrapping · Tidal Relay Harbor', 'classic-snake-keep-the-tail', 'harbor', 'solo'],
      ['Jammer · Alpine Observatory', 'classic-field-quiet-return', 'relay', 'solo'],
      ['Shutters · Freight Switchyard', 'classic-pursuit-first-shutter', 'freight', 'solo'],
      ['Team · Basalt Gardens', 'classic-field-linked-courts', 'quarry', 'team'],
    ];
const names = ['Lively FPV', 'Toybox', 'Atmospheric Ruins', 'Night Arcade'];
const { document } = globalThis;
const $ = (id) => document.getElementById(id);
const cards = [];
async function mount() {
  let driver;
  if (!authoredReview) {
    const { proofs } = await (await fetch('../fixtures/classic-snake-v4-proofs.json')).json();
    driver = createSnakeVisualFixture(selectSnakeVisualProof(proofs));
    seekSnakeVisualScenario(driver);
  }
  const entries = cases.map(([name, id, scene, mode]) => {
    const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === id);
    return { name, scene, entry, chapterId: entry.chapterId, mode };
  });
  let pageIndex = 0;
  $('chapter-control').hidden = !authoredReview;
  $('page-controls').hidden = !authoredReview;
  if (authoredReview)
    for (const chapter of CLASSIC_SNAKE_CHAPTERS) {
      const count = entries.filter((item) => item.chapterId === chapter.id).length;
      if (!count) continue;
      const option = document.createElement('option');
      option.value = chapter.id;
      option.textContent = `${chapter.title.en} · ${count} missions`;
      $('chapter').append(option);
    }
  function paint(card, boardStyle = card.style, terrainCache = true, timeMs = 0) {
    drawClassicBoard(card.canvas, card.run, {
      boardStyle,
      terrainCache,
      boardScene: authoredReview ? 'auto' : card.scene,
      chapterId: card.entry.chapterId,
      reduced: timeMs === 0,
      flight: { timeMs },
      cssWidth: card.canvas.clientWidth || 288,
    });
    if ($('geometry').checked) {
      const ctx = card.canvas.getContext('2d'),
        sx = card.canvas.width / (card.run.level.width * 28);
      ctx.setTransform(sx, 0, 0, sx, 0, 0);
      ctx.strokeStyle = '#ff5cff';
      ctx.lineWidth = 1;
      const removed = new Set((card.run.removedWalls ?? []).map((p) => `${p.x},${p.y}`));
      for (const cell of card.run.level.walls)
        if (!removed.has(`${cell.x},${cell.y}`))
          ctx.strokeRect(cell.x * 28 + 0.5, cell.y * 28 + 0.5, 27, 27);
    }
  }
  function render() {
    cards.length = 0;
    $('boards').replaceChildren();
    document.body.dataset.width = $('width').value;
    document.body.dataset.labels = $('labels').value;
    document.body.dataset.gray = String($('gray').checked);
    const page = snakeReviewPage(entries, { chapterId: $('chapter').value, page: pageIndex });
    pageIndex = page.page;
    $('previous').disabled = page.page === 0;
    $('next').disabled = page.page + 1 >= page.pages;
    $('page-summary').textContent =
      `Missions ${page.start + 1}–${page.start + page.entries.length} of ${page.total} · Page ${page.page + 1} / ${page.pages}`;
    for (const { name, scene, entry, mode } of page.entries) {
      const run =
        scene === 'relay' && !authoredReview
          ? driver.match.runs[0]
          : createClassicSnake(entry.level, {
              mode,
              seed: 17,
              ...(classicSnakeUsesVariableHazards(entry.level) ? { hazardSeed: 17 } : {}),
            });
      for (const [index, style] of CLASSIC_BOARD_STYLES.slice(2).entries()) {
        if ($('look').value !== 'all' && $('look').value !== style) continue;
        const article = document.createElement('article'),
          title = document.createElement('h2'),
          canvas = document.createElement('canvas'),
          caption = document.createElement('small');
        title.textContent = `${name} · ${names[index]}`;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', title.textContent);
        caption.textContent = `${entry.title.en} · ${run.level.width} × ${run.level.height}`;
        article.append(title, canvas, caption);
        $('boards').append(article);
        const card = { canvas, entry, run, scene, style };
        cards.push(card);
        paint(card);
      }
    }
    $('status').textContent =
      `${cards.length} visible boards · same gameplay geometry across every look. ${authoredReview ? 'Six missions per page keep this comparison bounded.' : ''}`;
  }
  for (const id of ['look', 'width', 'labels', 'gray', 'geometry'])
    $(id).addEventListener('change', render);
  $('chapter').addEventListener('change', () => {
    pageIndex = 0;
    render();
  });
  $('previous').addEventListener('click', () => {
    pageIndex--;
    render();
  });
  $('next').addEventListener('click', () => {
    pageIndex++;
    render();
  });
  $('benchmark').addEventListener('click', () => {
    const measure = (cached) => {
      const samples = [];
      for (const card of cards) {
        paint(card, card.style, cached); // warm the current board like active play
        for (let i = 0; i < 12; i++) {
          const start = performance.now();
          paint(card, card.style, cached);
          samples.push(performance.now() - start);
        }
      }
      samples.sort((a, b) => a - b);
      return {
        median: samples[Math.floor(samples.length / 2)].toFixed(2),
        p95: samples[Math.floor(samples.length * 0.95)].toFixed(2),
      };
    };
    const before = measure(false),
      after = measure(true),
      cache = classicTerrainCacheStats(document);
    $('status').textContent =
      `Same-device synchronous redraw (not frame rate): uncached worlds median ${before.median} ms / p95 ${before.p95} ms; cached worlds median ${after.median} ms / p95 ${after.p95} ms. ${cards.length * 12} samples each. Terrain ${(cache.bytes / 1048576).toFixed(2)} / ${(cache.limit / 1048576).toFixed(0)} MiB, ${cache.entries} retained boards.`;
  });
  $('frameBenchmark').addEventListener('click', async () => {
    // A bounded animation benchmark, not an automated claim about device FPS.
    // Keep simulation frozen so the baseline and remaster render identical state.
    const sample = authoredReview
      ? [cards[0], cards.find((card) => card.entry.id !== cards[0]?.entry.id)].filter(Boolean)
      : [cards.find((c) => c.scene === 'workshop'), cards.find((c) => c.scene === 'relay')].filter(
          Boolean,
        );
    const intervals = [],
      costs = [];
    const controls = [...document.querySelectorAll('button, select, input')];
    const disabledBefore = controls.map((control) => control.disabled);
    controls.forEach((control) => {
      control.disabled = true;
    });
    $('status').textContent = `Measuring 120 frames across ${sample.length} visible boards…`;
    let previous = null,
      cancelled = false;
    try {
      for (let frame = 0; frame < 132; frame++) {
        const stamp = await new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
        if (document.hidden) {
          cancelled = true;
          break;
        }
        const start = performance.now();
        for (const card of sample) paint(card, card.style, true, stamp);
        if (frame >= 12) {
          intervals.push(stamp - previous);
          costs.push(performance.now() - start);
        }
        previous = stamp;
      }
      const percentile = (values, fraction) =>
        values
          .sort((a, b) => a - b)
          [Math.min(values.length - 1, Math.floor(values.length * fraction))].toFixed(2);
      $('status').textContent = cancelled
        ? 'Frame measurement cancelled when the page became hidden.'
        : `Two-board animation, frozen simulation: frame intervals median ${percentile(intervals, 0.5)} ms / p95 ${percentile(intervals, 0.95)} ms; draw cost median ${percentile(costs, 0.5)} ms / p95 ${percentile(costs, 0.95)} ms. ${intervals.length} samples after 12 warm-up frames. Browser scheduling and display refresh affect these values.`;
    } finally {
      controls.forEach((control, index) => {
        control.disabled = disabledBefore[index];
      });
    }
  });
  render();
}
void mount().catch((error) => {
  $('status').textContent = `Review fixture failed: ${error.message}`;
});
