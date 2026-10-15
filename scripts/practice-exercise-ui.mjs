import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

// This first slice intentionally does not implement FPV retained-throttle control.
export const PRACTICE_EXERCISE_UI = Object.freeze({
  protocol: 'practice-exercise-public-ui.gym.v1',
  package: 'civilian-flight',
  exercise: 'lift-and-land',
  mode: 'assisted',
  locales: Object.freeze(['en', 'uk']),
  maximumMs: 90_000,
  operationMs: 1500,
  sampleMs: 100,
  maximumSamples: 950,
  liftLowMetres: 0.95,
  liftHighMetres: 1.05,
  maximumHeightMetres: 1.8,
});
const completedText = {
  en: 'Practice route complete',
  uk: 'Тренувальний маршрут завершено',
};

export function parseGymExerciseSnapshot(raw, locale) {
  assert(PRACTICE_EXERCISE_UI.locales.includes(locale), 'Unsupported exercise locale.');
  assert.equal(raw.locale, locale, 'The visible application locale changed.');
  assert.equal(raw.drill, 'lift-and-land', 'Select the native first Gym exercise.');
  assert.equal(raw.visible, true, 'Exercise HUD is not visible.');
  const values = raw.readout.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  assert.equal(values?.length, 4, 'Expected position, height and heading measurements.');
  const [x, z, height, heading] = values;
  assert(values.every(Number.isFinite), 'Non-finite measurement.');
  assert(x === 10 && z === 16 && heading === 0, 'Exercise left the initial vertical route.');
  assert(
    height >= 0 && height <= PRACTICE_EXERCISE_UI.maximumHeightMetres,
    'Height exceeds the declared exercise bounds.',
  );
  const progress = raw.status.match(/(?:^|\s)([0-2])\/2\s*$/);
  assert(progress, 'Expected native two-checkpoint progress.');
  const checkpoint = Number(progress[1]);
  const complete = raw.status.startsWith(`${completedText[locale]} · `);
  if (checkpoint === 2 || complete || raw.phase === 'results') {
    assert(
      complete && checkpoint === 2 && raw.phase === 'results',
      'Inconsistent completion witnesses.',
    );
    assert(
      raw.verified && height === 0,
      'Completion needs native replay checkmark and ground return.',
    );
  } else {
    assert.equal(raw.phase, 'playing', 'Exercise paused or left active flight.');
    assert.equal(raw.focused, true, 'Exercise lost foreground or arena focus.');
    assert.equal(raw.verified, false, 'Fresh exercise already carries a completion checkmark.');
  }
  return { x, z, height, heading, checkpoint, complete, phase: raw.phase, status: raw.status };
}

export function gymExerciseKey(sample) {
  if (sample.complete) return null;
  if (sample.checkpoint === 1) return sample.height > 0 ? 'f' : null;
  if (sample.height < PRACTICE_EXERCISE_UI.liftLowMetres) return 'r';
  if (sample.height > PRACTICE_EXERCISE_UI.liftHighMetres) return 'f';
  return null;
}

export function assertGymExerciseProgress(samples) {
  assert(samples.length >= 3, 'No full exercise progression was observed.');
  assert.equal(samples[0].checkpoint, 0, 'Exercise must start before the first checkpoint.');
  assert.equal(samples[0].height, 0, 'Exercise must start on the ground.');
  const progression = [];
  for (const sample of samples) {
    if (progression.at(-1) !== sample.checkpoint) progression.push(sample.checkpoint);
  }
  assert.deepEqual(
    progression,
    [0, 1, 2],
    'Require observed ordered lift and landing checkpoints.',
  );
  assert(
    samples.some((sample) => sample.height >= 0.85),
    'No genuine lift was observed.',
  );
  assert(samples.at(-1).complete && samples.at(-1).height === 0, 'No completed ground return.');
}

export function describeGymTranscript(json) {
  assert(
    typeof json === 'string' && Buffer.byteLength(json) <= 131072,
    'Transcript exceeds the public export bound.',
  );
  const trace = JSON.parse(json);
  assert.deepEqual(Object.keys(trace).sort(), [
    'catalogueIdentity',
    'commands',
    'drillId',
    'format',
  ]);
  assert.equal(trace.format, 'revealline-practice-transcript.v1');
  assert.equal(trace.drillId, 'lift-and-land', 'Export changed to another drill.');
  assert.match(trace.catalogueIdentity, /^[a-f0-9]{16}$/);
  assert(
    Array.isArray(trace.commands) && trace.commands.length > 0 && trace.commands.length <= 12000,
    'Invalid transcript command count.',
  );
  let ticks = 0;
  for (const command of trace.commands) {
    assert.deepEqual(Object.keys(command).sort(), ['input', 'ticks']);
    assert(
      Number.isSafeInteger(command.ticks) && command.ticks >= 1 && command.ticks <= 200,
      'Invalid transcript tick count.',
    );
    ticks += command.ticks;
    assert.deepEqual(Object.keys(command.input).sort(), ['pitch', 'roll', 'throttle', 'yaw']);
    assert(
      Object.values(command.input).every(
        (value) => Number.isFinite(value) && value >= -1 && value <= 1,
      ),
      'Invalid recorded input.',
    );
  }
  assert(ticks <= 72000, 'Transcript tick budget exceeded.');
  return {
    json,
    format: trace.format,
    catalogueIdentity: trace.catalogueIdentity,
    drillId: trace.drillId,
    commandCount: trace.commands.length,
    ticks,
    independentReplayVerified: false,
  };
}

export async function exportGymExerciseTranscript(page, operation = (run) => run()) {
  for (const selector of ['#gym-shell-action-settings', '#gym-settings-tab-data']) {
    await operation(() => page.locator(selector).waitFor({ state: 'visible' }));
    await operation(() => page.locator(selector).press('Enter'));
  }
  const textarea = page.locator('#catalogue');
  const disclosure = textarea.locator('..');
  if ((await operation(() => disclosure.getAttribute('open'))) === null) {
    const summary = disclosure.locator('summary');
    await operation(() => summary.waitFor({ state: 'visible' }));
    await operation(() => summary.press('Enter'));
  }
  await operation(() => page.locator('#export-trace').waitFor({ state: 'visible' }));
  await operation(() => page.locator('#export-trace').press('Enter'));
  await operation(() => textarea.waitFor({ state: 'visible' }));
  return describeGymTranscript(await operation(() => textarea.inputValue()));
}

async function readGym(page) {
  // Read only public DOM: no runtime models, recorded inputs, storage or hooks.
  return page.evaluate(() => {
    const doc = globalThis.document;
    const node = (id) => doc.getElementById(id);
    const visible = (element) =>
      Boolean(
        element &&
          element.getClientRects().length &&
          globalThis.getComputedStyle(element).visibility !== 'hidden' &&
          !element.closest('[hidden]'),
      );
    const drill = node('drill');
    const arena = node('arena');
    return {
      locale: doc.documentElement.lang,
      drill: drill?.value,
      verified: drill?.selectedOptions[0]?.textContent.trim().startsWith('✓') === true,
      readout: node('readout')?.innerText ?? '',
      status: node('status')?.innerText ?? '',
      phase: doc.querySelector('[data-mode-play-shell="gym-shell"]')?.dataset.phase,
      visible: visible(node('readout')) && visible(node('status')),
      focused:
        doc.hasFocus() &&
        !doc.hidden &&
        (doc.activeElement === arena || arena?.contains(doc.activeElement)),
    };
  });
}

// Preconditions: an isolated page, native first drill freshly started, arena
// focused using normal UI, no other actor holding input keys. Caller owns auth,
// candidate binding and browser cleanup. Never use this as human qualification.
export async function runGymLiftAndLand(
  page,
  {
    locale = 'en',
    mode = 'assisted',
    signal,
    onComplete,
    timeoutMs = PRACTICE_EXERCISE_UI.maximumMs,
  } = {},
) {
  assert(PRACTICE_EXERCISE_UI.locales.includes(locale), 'Unsupported exercise locale.');
  assert.equal(mode, 'assisted', 'Gym supports only the declared assisted mode.');
  assert(
    onComplete === undefined || typeof onComplete === 'function',
    'Invalid completion observer.',
  );
  assert(
    Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 90_000,
    'Invalid exercise deadline.',
  );
  const startedAt = Date.now(),
    deadline = startedAt + timeoutMs;
  const report = {
    protocol: PRACTICE_EXERCISE_UI.protocol,
    package: 'civilian-flight',
    exercise: 'lift-and-land',
    locale,
    mode,
    completed: false,
    qualified: false,
    startedAt,
    timeoutMs,
    samples: [],
    actions: [],
    cleanup: { released: false, errors: [] },
    limitations: [
      'Public Gym exercise only; no FPV modes, real hardware, human learning or campaign-win qualification.',
      'Native session checkmark is replay-backed; the exported transcript still requires independent off-browser replay against its frozen catalogue.',
    ],
  };
  const owned = new Set();
  let held = null,
    finished = false,
    timedOutInput = false;
  const check = () => {
    signal?.throwIfAborted();
    assert(Date.now() < deadline, 'Exercise deadline exceeded.');
  };
  async function bounded(operation, { cleanup = false, limitMs = 1500 } = {}) {
    if (!cleanup) check();
    const ms = cleanup ? 1500 : Math.min(limitMs, Math.max(1, deadline - Date.now()));
    let timer, listener;
    try {
      const result = await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Exercise operation timed out.')), ms);
          if (!cleanup && signal) {
            listener = () => reject(new Error('Exercise aborted.'));
            signal.addEventListener('abort', listener, { once: true });
            if (signal.aborted) listener();
          }
        }),
      ]);
      if (!cleanup) check();
      return result;
    } finally {
      clearTimeout(timer);
      if (listener) signal.removeEventListener('abort', listener);
    }
  }
  async function key(next) {
    if (next === held) return;
    if (held) {
      await bounded(() => page.keyboard.up(held));
      report.actions.push({ at: Date.now() - startedAt, key: held, action: 'up' });
      held = null;
    }
    if (next) {
      owned.add(next);
      try {
        await bounded(async () => {
          await page.keyboard.down(next);
          // A protocol operation cannot be cancelled. A late input must not
          // survive cleanup or turn an unverified result into a pass.
          if (finished) await page.keyboard.up(next);
        });
      } catch (error) {
        timedOutInput = true;
        throw error;
      }
      held = next;
      report.actions.push({ at: Date.now() - startedAt, key: next, action: 'down' });
    }
  }
  try {
    while (true) {
      check();
      assert(
        report.samples.length < PRACTICE_EXERCISE_UI.maximumSamples,
        'Telemetry bound reached.',
      );
      const sample = parseGymExerciseSnapshot(await bounded(() => readGym(page)), locale);
      sample.at = Date.now() - startedAt;
      if (!report.samples.length) {
        assert(
          sample.checkpoint === 0 && sample.height === 0 && !sample.complete,
          'Require a fresh, started ground exercise.',
        );
      } else {
        const prior = report.samples.at(-1).checkpoint;
        assert(
          sample.checkpoint >= prior && sample.checkpoint <= prior + 1,
          'Checkpoint progression skipped or reset.',
        );
      }
      report.samples.push(sample);
      if (sample.complete) {
        assertGymExerciseProgress(report.samples);
        report.nativeCompleted = true;
        await key(null);
        if (onComplete)
          await bounded(() => onComplete(Object.freeze({ ...sample, locale, mode })), {
            limitMs: 5000,
          });
        report.transcript = await exportGymExerciseTranscript(page, bounded);
        report.completed = true;
        break;
      }
      await key(gymExerciseKey(sample));
      await bounded(() => delay(PRACTICE_EXERCISE_UI.sampleMs, undefined, { signal }));
    }
  } catch (error) {
    report.error = String(error?.message ?? error).slice(0, 1024);
  } finally {
    finished = true;
    for (const name of owned) {
      try {
        await bounded(() => page.keyboard.up(name), { cleanup: true });
      } catch (error) {
        report.cleanup.errors.push(String(error?.message ?? error).slice(0, 256));
      }
    }
    report.cleanup.released = !timedOutInput && !report.cleanup.errors.length;
    report.completed &&= report.cleanup.released;
    report.finishedAt = Date.now();
  }
  return report;
}

export const completePublicGymExercise = runGymLiftAndLand;
