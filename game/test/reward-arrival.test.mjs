import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRewardAge,
  animateRewardArrival,
  REWARD_BOARD_SECONDS,
  REWARD_STORY_SECONDS,
} from '../ui/reward-arrival.mjs';

test('reward timing leaves a fully revealed board, then a full image before video', () => {
  assert.ok(REWARD_BOARD_SECONDS >= 0.85 + 1.5);
  assert.ok(REWARD_STORY_SECONDS >= REWARD_BOARD_SECONDS + 1);
  let age = 0;
  for (let i = 0; i < 20; i++) age = advanceRewardAge(age, 0.1);
  assert.ok(age < REWARD_BOARD_SECONDS);
  assert.equal(advanceRewardAge(age, 100, true), age);
  assert.equal(advanceRewardAge(age, NaN), age);
  assert.equal(advanceRewardAge(age, 100), age + 0.1);
});

test('arrival uses the contained picture geometry and reduced motion never animates', () => {
  const calls = [];
  const element = {
    naturalWidth: 1280,
    naturalHeight: 640,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    animate: (...args) => calls.push(args),
  };
  const from = { left: 140, top: 100, width: 1000, height: 500 };
  animateRewardArrival(element, from);
  assert.equal(calls[0][0][0].transform, 'translate(0px, -50px) scale(0.78125)');
  animateRewardArrival(element, from, true);
  assert.equal(calls.length, 1);
});
