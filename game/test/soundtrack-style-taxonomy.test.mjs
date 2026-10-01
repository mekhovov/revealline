import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PUBLIC_SOUNDTRACK_STYLE_IDS,
  PUBLIC_SOUNDTRACK_STYLE_IDS,
  localGenresForPublicStyles,
  publicSoundtrackStyles,
  publicSoundtrackStylesForLocalGenres,
} from '../soundtrack-style-taxonomy.mjs';

test('public music styles use the player-first order with Ukrainian families last', () => {
  assert.deepEqual(PUBLIC_SOUNDTRACK_STYLE_IDS, [
    'synth',
    'metal',
    'chiptune',
    'rock',
    'electronic',
    'ambient',
    'fusion',
    'other',
    'ukrainian',
    'fpv',
  ]);
  assert.deepEqual(DEFAULT_PUBLIC_SOUNDTRACK_STYLE_IDS, [
    'synth',
    'metal',
    'chiptune',
    'rock',
    'electronic',
    'ambient',
    'fusion',
    'other',
  ]);
});

test('Latin FPV does not enter the Cyrillic FPV style and UA aliases Ukrainian', () => {
  assert.deepEqual(publicSoundtrackStyles(['metal', 'FPV']), ['metal']);
  assert.deepEqual(publicSoundtrackStyles(['ФПВ', 'UA']), ['ukrainian', 'fpv']);
});

test('synth and electronic are separate while multi-family recordings also join fusion', () => {
  assert.deepEqual(publicSoundtrackStyles(['synthwave']), ['synth']);
  assert.deepEqual(publicSoundtrackStyles(['electro', 'techno']), ['electronic']);
  assert.deepEqual(publicSoundtrackStyles(['synth-metal']), ['synth', 'metal', 'fusion']);
});

test('public styles map to the closest built-in and uploaded music families', () => {
  assert.deepEqual(localGenresForPublicStyles(['synth', 'electronic', 'ukrainian']), [
    'synth90s',
    'electronic',
    'ukrainian',
  ]);
  assert.deepEqual(localGenresForPublicStyles(['fpv']), []);
});

test('saved local genre mixes restore the matching public style controls', () => {
  assert.deepEqual(publicSoundtrackStylesForLocalGenres(['synth90s', 'metal']), ['synth', 'metal']);
  assert.deepEqual(
    publicSoundtrackStylesForLocalGenres([
      'synth90s',
      'metal',
      'electronic',
      'chiptune',
      'rock',
      'ambient',
      'cinematic',
      'acoustic',
      'ukrainian',
    ]),
    PUBLIC_SOUNDTRACK_STYLE_IDS,
  );
});
