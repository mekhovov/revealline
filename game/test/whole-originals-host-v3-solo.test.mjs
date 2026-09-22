import test from 'node:test';
import { qualifySolo } from './whole-originals-host-scenarios.mjs';

test('whole-originals-v3:71 real Solo host clears retain exact themes and originals across70 Next actions and a failed preload', (t) =>
  qualifySolo(t, 'whole-originals-v3'));
