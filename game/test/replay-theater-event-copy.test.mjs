import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { replayEventRecord, replayEventText } from '../replay-theater/event-copy.mjs';

test('replay event history retranslates owned copy while preserving identifiers', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const event = replayEventRecord(
    {
      tick: 42,
      type: 'signal.changed',
      classId: 'fiber',
      primitive: 'pulse',
      resistant: true,
      zoneIds: ['relay-east'],
      reason: 'signal-interference',
    },
    0,
    (value) => String(value).slice(0, 80),
  );

  setLocale('en', { persist: false });
  assert.equal(
    replayEventText(event),
    'Tick 42 · signal.changed · fiber · pulse · interference resisted · signal-interference',
  );

  setLocale('uk', { persist: false });
  assert.equal(
    replayEventText(event),
    'Такт 42 · signal.changed · fiber · pulse · перешкоду подолано · signal-interference',
  );
});

test('replay event records keep the historical fallback tick and bounded diagnostics', () => {
  const event = replayEventRecord(
    {
      type: 'encounter'.repeat(20),
      zoneIds: [],
      reason: 'reason'.repeat(20),
    },
    17,
    (value) => String(value).slice(0, 80),
  );

  assert.equal(event.tick, 17);
  assert.equal(event.type.length, 80);
  assert.equal(event.reason.length, 80);
  assert.equal(event.interferenceResisted, false);
});
