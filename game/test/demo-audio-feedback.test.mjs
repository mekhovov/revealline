import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDemoEvents, updateDemoFeedback } from '../demo-audio-feedback.mjs';

test('demo routes the same full event batch and run context as ordinary gameplay', () => {
  const calls = [],
    sound = {
      feedback: (...args) => calls.push(['feedback', ...args]),
      events: (...args) => calls.push(['events', ...args]),
    },
    state = { status: 'running', activeClassId: 'carrier' },
    theme = { id: 'fpv' },
    events = [
      { type: 'cut.closed', tick: 42 },
      { type: 'cells.claimed', tick: 42 },
    ],
    feedback = { version: 'campaign-feedback.v1' },
    source = { entry: { campaignFeedback: feedback } };
  updateDemoFeedback(sound, { active: true, theme, state, bodyId: 'fpv-carrier-v1' });
  emitDemoEvents(sound, events, state, theme, {
    bodyId: 'fpv-carrier-v1',
    source,
  });
  assert.deepEqual(calls, [
    ['feedback', true, theme, state, { bodyId: 'fpv-carrier-v1', board: 'demo' }],
    [
      'events',
      events,
      state,
      theme,
      {
        bodyId: 'fpv-carrier-v1',
        board: 'demo',
        resultContext: {
          owned: false,
          mode: 'solo',
          outcome: 'running',
          feedback,
        },
      },
    ],
  ]);
});
