/** Reuse the established bounded command controller with this exact paired source. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
assert(process.argv[2], 'Provide the prepared hillside directory');
process.argv[3] = resolve(process.argv[2], 'preparation.json');
await import('../tropical-coast/verify-commanded-flight.mjs');
