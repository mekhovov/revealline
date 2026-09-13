#!/usr/bin/env node
/** Original pressure chapter. Older packs and the six owned reward images stay immutable. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePack } from '../../../game/packs.mjs';

const field = (id, x, y, vx, vy) => ({ id, type: 'bouncer', x, y, vx, vy, radius: 0.3 });
const rover = (id, x, y, vx, vy) => ({ ...field(id, x, y, vx, vy), type: 'claimed-rover' });
const eroder = (id, x, y, vx, vy) => ({ ...field(id, x, y, vx, vy), type: 'eroder' });
const contour = (id, x, y, side, speed) => ({
  id,
  type: 'contour-patrol',
  edge: { x, y, side },
  clockwise: true,
  speed,
  radius: 0.25,
});
const lane = (id, x, y, axis, warningSeconds, period) => ({
  id,
  type: 'lane-boss',
  x,
  y,
  axis,
  warningSeconds,
  activeSeconds: 0.75,
  period,
  laneWidth: 1.25,
  radius: 0.38,
});
const wall = (x, y, w, h) => ({ x, y, w, h });
const terrain = (id, kind, x, y, w, h) => ({ id, kind, x, y, w, h });
const pickup = (id, kind, x, y) => ({ id, kind, x, y });
const pressure = (id, mode = 'trail-pursuit', intensity = 0) => ({
  id,
  mode,
  senseRadius: 16 + intensity * 2,
  scanTicks: 60,
  warningTicks: 90 - intensity * 12,
  commitTicks: 144 + intensity * 12,
  cooldownTicks: 300 - intensity * 24,
  leadTicks: mode === 'head-intercept' ? 36 : 0,
});

export function buildPressureChapters(prior, homeward) {
  assert.equal(prior.id, 'fpv-arcade-r4');
  assert.equal(homeward.id, 'homeward-skies');
  const pack = structuredClone(prior);
  pack.id = 'fpv-arcade-r5';
  pack.version = '5.0.0';
  pack.name = 'FPV Front · Pressure Lines';
  pack.description =
    'Three direction-only Arcade missions. Watch a hunter lock its target, choose a different exit, and secure the cut before its impact catches you. Walls, patrols, erosion and timed lanes create different route choices. Three original First Light pictures accompany these new pressure layouts. The separate Frontier Lines chapter adds three more missions and pictures.';
  pack.themes[0].subtitle = 'Pressure Lines · Arcade';
  const campaign = pack.campaigns[0];
  campaign.id = 'fpv-pressure-lines';
  campaign.revision = '1';
  campaign.title = pack.name;
  const template = prior.campaigns[0].levels[0];
  const recipes = [
    {
      id: 'orchard-crossing',
      name: 'Orchard Crossing',
      coverage: 0.68,
      medals: [34, 58],
      spawn: { x: 36.5, y: 0.5 },
      walls: [wall(18, 11, 2, 9), wall(51, 18, 2, 9)],
      enemies: [
        field('orchard-hunter', 17.5, 7.5, 9, 6),
        field('east-crosser', 57.5, 27.5, -8, -7),
        field('south-crosser', 29.5, 28.5, 7, -8),
        contour('orchard-contour', 1, 26, 'west', 6),
      ],
      pressures: [pressure('orchard-hunter')],
      terrain: [terrain('orchard-mud', 'slow', 40, 14, 4, 5)],
      powerups: [pickup('orchard-speed', 'player-speed', 12.5, 10.5)],
      lesson:
        'A bracketed hunter locks a point on your unfinished cut. Change your route before it commits. Two offset walls divide your exits; the contour patrol follows secured boundaries. Mud slows only your craft. A speed pickup rewards the western detour.',
    },
    {
      id: 'courtyard-exits',
      name: 'Courtyard Exits',
      coverage: 0.74,
      medals: [44, 72],
      spawn: { x: 0.5, y: 18.5 },
      walls: [wall(22, 5, 2, 10), wall(22, 23, 2, 8), wall(48, 7, 2, 10), wall(48, 25, 2, 6)],
      enemies: [
        field('courtyard-hunter', 35.5, 7.5, 8, 7),
        field('courtyard-interceptor', 60.5, 25.5, -8, -7),
        field('west-crosser', 10.5, 28.5, 7, -8),
        rover('courtyard-rover', 12.5, 8.5, 7, 4.5),
      ],
      pressures: [
        pressure('courtyard-hunter'),
        pressure('courtyard-interceptor', 'head-intercept'),
      ],
      terrain: [
        terrain('west-mud', 'slow', 17, 16, 4, 4),
        terrain('east-mud', 'slow', 51, 19, 4, 4),
      ],
      powerups: [
        pickup('courtyard-slow', 'enemy-slow', 10.5, 12.5),
        pickup('courtyard-freeze', 'enemy-freeze', 59.5, 20.5),
      ],
      lesson:
        'The interceptor aims ahead of your visible heading, then keeps that target. Bait its warning and choose another exit. Wall gaps and mud make the direct crossing risky. A rover wakes on revealed ground; keep your return route clear.',
    },
    {
      id: 'night-crossfire',
      name: 'Night Crossfire',
      coverage: 0.8,
      medals: [50, 82],
      spawn: { x: 36.5, y: 0.5 },
      walls: [wall(13, 12, 13, 2), wall(47, 24, 13, 2)],
      enemies: [
        field('night-hunter', 12.5, 24.5, 9, 7),
        field('night-interceptor', 61.5, 8.5, -8, 8),
        field('night-center', 36.5, 28.5, 7, -9),
        lane('signal-lane', 53.5, 18.5, 'horizontal', 1.4, 5.2),
        contour('night-contour', 8, 1, 'north', 7),
      ],
      pressures: [
        pressure('night-hunter', 'trail-pursuit', 1),
        pressure('night-interceptor', 'head-intercept', 1),
      ],
      terrain: [
        terrain('night-mud', 'slow', 32, 14, 5, 5),
        terrain('night-hot-zone', 'lethal', 56, 5, 5, 3),
      ],
      powerups: [
        pickup('night-freeze', 'enemy-freeze', 43.5, 30.5),
        pickup('night-life', 'extra-life', 9.5, 18.5),
      ],
      lesson:
        'Read the horizontal lane warning before crossing. Hunters pressure unfinished lines while the boundary patrol follows captured ground. Freeze stops enemy motion and their pursuit clock; the marked hot zone stays lethal while hidden.',
    },
    {
      id: 'copper-switchyard',
      name: 'Copper Switchyard',
      coverage: 0.8,
      medals: [54, 88],
      spawn: { x: 0.5, y: 17.5 },
      walls: [wall(14, 6, 2, 18), wall(29, 13, 2, 16), wall(44, 6, 2, 18), wall(59, 13, 2, 16)],
      enemies: [
        field('switch-hunter', 22.5, 9.5, 8, 8),
        field('switch-interceptor', 52.5, 27.5, -9, -7),
        field('switch-west', 8.5, 29.5, 7, -9),
        field('switch-east', 65.5, 8.5, -7, 9),
        contour('switch-contour', 1, 28, 'west', 7.5),
      ],
      pressures: [
        pressure('switch-hunter', 'trail-pursuit', 1),
        pressure('switch-interceptor', 'head-intercept', 1),
      ],
      terrain: [terrain('switch-mud', 'slow', 33, 7, 6, 4)],
      powerups: [
        pickup('switch-speed', 'player-speed', 36.5, 30.5),
        pickup('switch-slow', 'enemy-slow', 7.5, 5.5),
      ],
      lesson:
        'Alternating barriers create long routes and shorter side pockets. Walls do not finish a cut: reconnect to revealed ground. Distributed patrols prevent one long crossing from emptying the whole picture. Choose where to establish the next safe boundary.',
    },
    {
      id: 'river-frontiers',
      name: 'River Frontiers',
      coverage: 0.83,
      medals: [58, 94],
      spawn: { x: 36.5, y: 35.5 },
      walls: [wall(17, 9, 12, 2), wall(17, 23, 12, 2), wall(45, 9, 12, 2), wall(45, 23, 12, 2)],
      enemies: [
        field('river-hunter', 11.5, 17.5, 9, 7),
        field('river-interceptor', 62.5, 18.5, -8, 9),
        field('river-center', 35.5, 7.5, -7, 9),
        eroder('river-eroder', 37.5, 28.5, -7, -5),
        rover('river-rover', 22.5, 17.5, 7, 5),
        contour('river-contour', 66, 1, 'north', 7.5),
      ],
      pressures: [
        pressure('river-hunter', 'trail-pursuit', 2),
        pressure('river-interceptor', 'head-intercept', 1),
      ],
      terrain: [terrain('river-mud', 'slow', 32, 14, 7, 4)],
      powerups: [
        pickup('river-freeze', 'enemy-freeze', 9.5, 28.5),
        pickup('river-life', 'extra-life', 61.5, 6.5),
      ],
      lesson:
        'An eroder threatens secured frontier cells; recapturing them restores coverage without farming points. A rover and contour patrol occupy different safe routes. Keep two exits and watch the hunter before extending your line.',
    },
    {
      id: 'last-beacon',
      name: 'Last Beacon',
      coverage: 0.85,
      medals: [64, 105],
      spawn: { x: 36.5, y: 0.5 },
      walls: [wall(18, 10, 14, 2), wall(40, 10, 14, 2), wall(18, 24, 14, 2), wall(40, 24, 14, 2)],
      enemies: [
        field('beacon-hunter', 12.5, 27.5, 9, 8),
        field('beacon-interceptor', 60.5, 8.5, -9, 8),
        field('beacon-center', 34.5, 29.5, 8, -9),
        lane('beacon-horizontal', 56.5, 18.5, 'horizontal', 1.3, 5.1),
        lane('beacon-vertical', 36.5, 17.5, 'vertical', 1.5, 6.7),
        eroder('beacon-eroder', 8.5, 15.5, 7, 5),
        contour('beacon-contour', 8, 1, 'north', 8),
      ],
      pressures: [
        pressure('beacon-hunter', 'trail-pursuit', 2),
        pressure('beacon-interceptor', 'head-intercept', 2),
      ],
      terrain: [
        terrain('beacon-mud', 'slow', 32, 13, 4, 4),
        terrain('beacon-hot-zone', 'lethal', 57, 28, 5, 3),
      ],
      powerups: [
        pickup('beacon-freeze', 'enemy-freeze', 64.5, 20.5),
        pickup('beacon-life', 'extra-life', 9.5, 6.5),
      ],
      lesson:
        'Two lanes run on different warning cycles. Secure small exits before a long crossing, bait a locked interceptor, and protect your frontier from erosion. The freeze detour can create an opening; no manual equipment shortcuts are enabled.',
    },
  ];
  campaign.levels = recipes.map((recipe, index) => {
    const level = structuredClone(template);
    for (const key of ['id', 'name', 'spawn', 'walls', 'enemies']) level[key] = recipe[key];
    level.revision = '1';
    level.goal.coverage = recipe.coverage;
    level.rules.timeMedals = recipe.medals;
    level.rules.timeLimitSeconds = 180;
    level.musicId = pack.music[index % pack.music.length].id;
    level.classic.terrain = recipe.terrain;
    level.classic.powerups = recipe.powerups;
    level.classic.enemyPressure = { version: 'enemy-pressure.v1', actors: recipe.pressures };
    level.metadata = {
      title: recipe.name,
      description: `Reveal ${Math.round(recipe.coverage * 100)}%. ${recipe.lesson} Tap a direction to fly; closing a cut stops the craft. Choose a fresh direction to continue.`,
      author: 'RevealLine',
      license: 'Original project content',
      rightsStatus:
        'Original pressure layout. Existing owned First Light/Homeward Skies reward art; not new artwork or a reference-game copy.',
    };
    return level;
  });
  const pictures = [...prior.levelVisuals, ...homeward.levelVisuals];
  assert.equal(pictures.length, recipes.length);
  pack.levelVisuals = pictures.map((picture, index) => ({
    ...structuredClone(picture),
    levelId: recipes[index].id,
  }));
  const frontier = structuredClone(pack);
  frontier.id = 'fpv-pressure-frontier';
  frontier.version = '1.0.0';
  frontier.name = 'FPV Front · Frontier Lines';
  frontier.description =
    'Three advanced direction-only missions: alternating wall routes, erosion and crossfire. Recommended after Pressure Lines. Each has a different owned Homeward Skies picture reward.';
  frontier.themes[0].subtitle = 'Frontier Lines · Arcade';
  frontier.campaigns[0].id = 'fpv-pressure-frontier';
  frontier.campaigns[0].title = frontier.name;
  frontier.campaigns[0].levels = frontier.campaigns[0].levels.slice(3);
  frontier.levelVisuals = frontier.levelVisuals.slice(3);
  campaign.levels = campaign.levels.slice(0, 3);
  pack.levelVisuals = pack.levelVisuals.slice(0, 3);
  for (const edition of [pack, frontier]) {
    const checked = validatePack(edition);
    assert.equal(checked.valid, true, checked.errors.join('; '));
  }
  return [pack, frontier];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL('../../../', import.meta.url);
  const inputs = [];
  for (const [name, hash] of [
    ['fpv-arcade-r4', 'a7ab557d69f2bdd5473ee85d62ee0e7a03e6e75f01e79cc0dc7654b1c5ae6703'],
    ['homeward-skies', '4793e07a45484238bae483e2a2e9354c6d29e0ad2ba2d8d708169bd9e0250b8b'],
  ]) {
    const bytes = await readFile(new URL(`game/content/packs/${name}.json`, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
    inputs.push(JSON.parse(bytes));
  }
  for (const pack of buildPressureChapters(...inputs)) {
    const output = new URL(`game/content/packs/${pack.id}.json`, root);
    if (!process.argv.slice(2).length) {
      assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), pack);
      console.log(`${pack.id} matches its authored recipes and existing owned pictures.`);
    } else {
      assert.deepEqual(process.argv.slice(2), ['--write']);
      await writeFile(output, JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
    }
  }
}
