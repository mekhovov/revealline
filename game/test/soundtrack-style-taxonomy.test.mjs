import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_SOUNDTRACK_STYLE_IDS,
  localGenresForPublicStyles,
  publicSoundtrackStyles,
} from '../soundtrack-style-taxonomy.mjs';

test('public music styles use the player-first order with Ukrainian families last', () => {
  assert.deepEqual(PUBLIC_SOUNDTRACK_STYLE_IDS, [
    'synth',
    'metal',
    'electronic',
    'chiptune',
    'rock',
    'ambient',
    'fusion',
    'other',
    'ukrainian',
    'fpv',
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
