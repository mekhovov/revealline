import { CLASSIC_MISSION_COMPOSITIONS } from './classic-compositions.mjs';
import { CLASSIC_STRUCTURE_REVISION } from './classic-structure-art.mjs';
import {
  CLASSIC_SNAKE_OPERATION_CHAPTERS_B,
  CLASSIC_SNAKE_OPERATION_LEVELS_B,
} from './classic-catalogue-operations-b.mjs';
import {
  CLASSIC_SNAKE_OPERATION_CHAPTERS_A,
  CLASSIC_SNAKE_OPERATION_LEVELS_A,
} from './classic-catalogue-operations-a.mjs';
/** Cosmetic composition only. Never part of a level recipe, random stream or proof.
 * Shared material/actor providers remain the owners of artwork bytes. */
export const CLASSIC_WORLD_REVISION = 'snake-worlds-v7';
export const CLASSIC_BOARD_STYLES = Object.freeze([
  'theme',
  'retro',
  'living-circuit',
  'toybox',
  'atmospheric-ruins',
  'night-arcade',
  'fpv-battlefield',
]);
export const CLASSIC_BOARD_SCENES = Object.freeze([
  'auto',
  'orchard',
  'workshop',
  'relay',
  'freight',
  'harbor',
  'quarry',
]);
export const isClassicWorldStyle = (style) => CLASSIC_BOARD_STYLES.slice(2).includes(style);

// Explicit chapter art direction; community chapters use a neutral opening
// composition, never an ID hash pretending to be authored scenery.
const chapters = [
  ['first-coils', 'orchard', 'nursery', 'rows'],
  ['wide-turns', 'orchard', 'irrigation-court', 'court'],
  ['island-circuits', 'harbor', 'pump-islands', 'quays'],
  ['moving-quarry', 'freight', 'loading-bays', 'bays'],
  ['borderless-routes', 'harbor', 'tidal-loops', 'quays'],
  ['chicanes', 'freight', 'shunting-yard', 'tracks'],
  ['shared-circuits', 'workshop', 'assembly-hall', 'bays'],
  ['final-weave', 'quarry', 'survey-terraces', 'court'],
  ['patrol-routes', 'relay', 'antenna-court', 'court'],
  ['escape-lines', 'orchard', 'glasshouse-paths', 'rows'],
  ['burst-timing', 'workshop', 'pressure-room', 'tracks'],
  ['route-windows', 'workshop', 'valve-court', 'court'],
  ['field-supplies', 'freight', 'supply-depot', 'bays'],
  ['combined-pursuit', 'quarry', 'reclaimed-courts', 'court'],
  ['twin-intercepts', 'harbor', 'twin-docks', 'quays'],
  ['moving-windows', 'freight', 'shutter-yard', 'tracks'],
  ['signal-tactics', 'relay', 'receiver-array', 'tracks'],
  ['patrol-frontiers', 'quarry', 'perimeter-gardens', 'rows'],
  ['field-mastery', 'relay', 'summit-station', 'court'],
  ['crossing-routes', 'freight', 'crossing-platforms', 'tracks'],
  ['changing-shortcuts', 'workshop', 'service-works', 'bays'],
  ['hidden-signals', 'relay', 'listening-post', 'rows'],
  ['expedition-circuits', 'quarry', 'expedition-courts', 'court'],
];
export const CLASSIC_CHAPTER_COMPOSITIONS = Object.freeze(
  Object.fromEntries([
    ...chapters.map(([chapter, scene, mood, zoning]) => [
      `classic-snake-${chapter}`,
      Object.freeze({ scene, mood, zoning }),
    ]),
    ...[...CLASSIC_SNAKE_OPERATION_CHAPTERS_A, ...CLASSIC_SNAKE_OPERATION_CHAPTERS_B].map(
      (chapter) => [chapter.id, Object.freeze(chapter.composition)],
    ),
  ]),
);

const missionCompositions = new Map(
  [...CLASSIC_SNAKE_OPERATION_LEVELS_A, ...CLASSIC_SNAKE_OPERATION_LEVELS_B].map((entry) => [
    entry.id,
    entry.composition,
  ]),
);

export function resolveClassicWorld({
  boardStyle = 'living-circuit',
  boardScene = 'auto',
  chapterId = '',
  levelId = '',
} = {}) {
  const authored = missionCompositions.get(levelId) ?? CLASSIC_CHAPTER_COMPOSITIONS[chapterId];
  const scene =
    CLASSIC_BOARD_SCENES.includes(boardScene) && boardScene !== 'auto'
      ? boardScene
      : (authored?.scene ?? 'orchard');
  const sceneKit = {
    orchard: ['glasshouse', 'leaves'],
    workshop: ['boiler', 'fan'],
    relay: ['antenna', 'windsock'],
    freight: ['container', 'lamps'],
    harbor: ['pump', 'water'],
    quarry: ['terrace', 'leaves'],
  };
  const explicitScene = boardScene !== 'auto' && scene !== authored?.scene;
  return Object.freeze({
    version: 2,
    structureRevision: CLASSIC_STRUCTURE_REVISION,
    actorSet: 'snake-tactical-silhouettes-v1',
    reactions: 'material-consequences-v1',
    revision: CLASSIC_WORLD_REVISION,
    scene,
    treatment: CLASSIC_BOARD_STYLES.includes(boardStyle) ? boardStyle : 'living-circuit',
    composition: authored?.mood ?? 'open-court',
    zoning: authored?.zoning ?? 'court',
    ...(CLASSIC_MISSION_COMPOSITIONS[levelId] ?? {}),
    ...(explicitScene ? { structure: sceneKit[scene][0], ambient: sceneKit[scene][1] } : {}),
  });
}

export function classicBoardPreferences(params, saved = {}) {
  const board = params.get('board') ?? saved.boardStyle;
  const scene = params.get('scene') ?? saved.boardScene;
  return {
    boardStyle: CLASSIC_BOARD_STYLES.includes(board) ? board : 'living-circuit',
    boardScene: CLASSIC_BOARD_SCENES.includes(scene) ? scene : 'auto',
  };
}
