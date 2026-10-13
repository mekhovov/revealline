import { CLASSIC_SNAKE_LEVELS } from '../../snake/classic-catalogue.mjs';
import { createClassicSnake, classicSnakeUsesVariableHazards } from '../../snake/classic-core.mjs';
import { drawClassicBoard } from '../../snake/classic-view.mjs';
import { CLASSIC_BOARD_STYLES } from '../../snake/classic-worlds.mjs';
import {
  selectSnakeVisualProof,
  createSnakeVisualFixture,
  seekSnakeVisualScenario,
} from './snake-visual-fixture.mjs';

const cases = [
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
  const { proofs } = await (await fetch('../fixtures/classic-snake-v4-proofs.json')).json();
  const driver = createSnakeVisualFixture(selectSnakeVisualProof(proofs));
  seekSnakeVisualScenario(driver);
  const entries = cases.map(([name, id, scene, mode]) => {
    const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === id);
    return {
      name,
      scene,
      entry,
      run:
        scene === 'relay'
          ? driver.match.runs[0]
          : createClassicSnake(entry.level, {
              mode,
              seed: 17,
              ...(classicSnakeUsesVariableHazards(entry.level) ? { hazardSeed: 17 } : {}),
            }),
    };
  });
  function paint(card, boardStyle = card.style) {
    drawClassicBoard(card.canvas, card.run, {
      boardStyle,
      boardScene: card.scene,
      chapterId: card.entry.chapterId,
      reduced: true,
      cssWidth: card.canvas.clientWidth || 288,
    });
  }
  function render() {
    cards.length = 0;
    $('boards').replaceChildren();
    document.body.dataset.width = $('width').value;
    document.body.dataset.labels = $('labels').value;
    for (const { name, scene, entry, run } of entries)
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
    $('status').textContent = `${cards.length} boards · same gameplay geometry across every look.`;
  }
  for (const id of ['look', 'width', 'labels']) $(id).addEventListener('change', render);
  $('benchmark').addEventListener('click', () => {
    const measure = (original) => {
      const samples = [];
      for (let i = 0; i < 5; i++)
        for (const card of cards) {
          const start = performance.now();
          paint(card, original ? 'theme' : card.style);
          samples.push(performance.now() - start);
        }
      samples.sort((a, b) => a - b);
      return {
        median: samples[Math.floor(samples.length / 2)].toFixed(2),
        p95: samples[Math.floor(samples.length * 0.95)].toFixed(2),
      };
    };
    const before = measure(true),
      after = measure(false);
    $('status').textContent =
      `Same-device synchronous redraw (not frame rate): Game Theme median ${before.median} ms / p95 ${before.p95} ms; worlds median ${after.median} ms / p95 ${after.p95} ms. ${cards.length * 5} samples each.`;
  });
  render();
}
void mount().catch((error) => {
  $('status').textContent = `Review fixture failed: ${error.message}`;
});
