import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export const FPV_EXERCISE_PROTOCOL = Object.freeze({
  id: 'practice-fpv-exercise-public-ui.prototype.v2',
  sourceReviewed: '1d8b9c076',
  maximumMs: 90000,
  operationMs: 1500,
  sampleMs: 100,
  maximumSamples: 900,
  maximumHeight: 4,
  maximumVelocity: 3,
  velocityWindowMs: 400,
  maximumSampleGapMs: 750,
  targetHeight: 1.8,
  throttleHover: 0.5,
  velocityGain: 0.12,
  heightGain: 0.6,
  maximumClimb: 0.45,
  descent: -0.3,
  finalDescent: -0.15,
  minimumFlightThrottle: 0.38,
  maximumFlightThrottle: 0.62,
  groundedThrottle: 0.06,
  throttleDeadband: 0.01,
  gainsNativeTested: false,
});
const TITLES = { en: 'Lift and land', uk: 'Підйом і посадка' };
const COMPLETE = { en: 'Challenge complete', uk: 'Завдання виконано' };
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function validateSpec({ packageId, locale, mode }) {
  assert(['civilian-fpv', 'fpv-worlds'].includes(packageId), 'Unsupported exercise package.');
  assert(['en', 'uk'].includes(locale), 'Unsupported locale.');
  assert(['self-level', 'acro'].includes(mode), 'Unsupported flight mode.');
}
function boundedText(value) {
  assert(typeof value === 'string' && value.length <= 2048, 'Missing or excessive visible text.');
  return value.trim();
}
export function parseDetailedFPVHUD(details, gauge, action, locale) {
  const text = boundedText(details);
  const label = locale === 'uk' ? 'Висота' : 'Height';
  const unit = locale === 'uk' ? 'м' : 'm';
  const number = locale === 'uk' ? '(\\d+(?:,\\d+)?)' : '(\\d+(?:\\.\\d+)?)';
  const height = text.match(
    new RegExp(`^${label} ${number} ${unit} · ${number}–${number} ${unit}$`),
  );
  if (height) {
    assert.equal(boundedText(gauge), label, 'Detailed text and visible gauge disagree.');
    const [value, min, max] = height.slice(1).map((n) => Number(n.replace(',', '.')));
    const checkpoint = min === 1.2 && max === 2.4 ? 0 : min === 0 && max === 0.6 ? 1 : -1;
    assert(checkpoint >= 0, 'Visible target is not a first-exercise height band.');
    return {
      height: value,
      checkpoint,
      groundedWitness: false,
      measurementSource: 'visible Detailed HUD height',
    };
  }
  const throttleName = locale === 'uk' ? 'Газ' : 'Throttle';
  const throttle = text.match(new RegExp(`^${throttleName} ${number} % · ≤ 10 %$`));
  assert(
    throttle &&
      boundedText(gauge) === throttleName &&
      boundedText(action) === (locale === 'uk' ? 'Повністю опустіть газ' : 'Lower throttle fully'),
    'Unsupported visible HUD gauge or landing action; no height available.',
  );
  const value = Number(throttle[1].replace(',', '.')) / 100;
  assert(value > 0.1 && value <= 1, 'Invalid native landing-throttle witness.');
  // Production feedback only emits this combination after valid soft touchdown.
  // This is semantic ground evidence, not a measured/fabricated height of zero.
  return {
    height: null,
    checkpoint: 1,
    groundedWitness: true,
    gaugeThrottle: value,
    measurementSource: 'visible throttle gauge + native Lower throttle fully soft-touchdown action',
  };
}

export function parsePublicFPVSnapshot(raw, spec) {
  validateSpec(spec);
  assert.equal(raw.locale, spec.locale, 'Application locale changed.');
  assert.equal(raw.mode, spec.mode, 'Selected native flight mode changed.');
  assert.equal(raw.source, 'keyboard', 'Native input source is not keyboard.');
  assert.equal(raw.preset, 'two-stick', 'Native keyboard layout changed.');
  assert.equal(boundedText(raw.title), TITLES[spec.locale], 'Not the native first exercise.');
  if (spec.packageId === 'civilian-fpv')
    assert.match(
      boundedText(raw.courseNumber),
      /^01\s*\/\s*12\s*·/,
      'Wrong Academy course ordinal.',
    );
  assert(
    ['active', 'complete'].includes(raw.phase),
    'Flight is paused, disarmed, expired or otherwise unavailable.',
  );
  const complete = raw.phase === 'complete';
  let checkpoint,
    height = null,
    throttle = null,
    hud = {};
  if (complete) {
    assert.equal(raw.resultVisible, true, 'Native completion panel is not visible.');
    assert.equal(
      boundedText(raw.resultHeading),
      spec.packageId === 'civilian-fpv' ? TITLES[spec.locale] : COMPLETE[spec.locale],
      'Recording verification alone is not completed flight.',
    );
    checkpoint = 2;
    // Never obtain controller measurements from hidden result-scene HUD nodes.
  } else {
    assert.equal(raw.focused, true, 'Flight lost viewport focus or foreground visibility.');
    assert.equal(raw.resultVisible, false, 'Unexpected result panel during flight.');
    hud = parseDetailedFPVHUD(raw.details, raw.gauge, raw.action, spec.locale);
    ({ height, checkpoint } = hud);
    if (spec.packageId === 'civilian-fpv') {
      assert.equal(
        raw.stickModeLabel,
        spec.locale === 'uk' ? 'Органи керування · Mode 2' : 'Flight controls · Mode 2',
        'Visible left stick is not Mode 2 throttle.',
      );
      assert(
        raw.stickVisible &&
          Number.isFinite(raw.stickY) &&
          Number.isFinite(raw.stickRadius) &&
          raw.stickRadius > 0,
        'Visible throttle stick geometry unavailable.',
      );
      throttle = (1 - raw.stickY / raw.stickRadius) / 2;
      // CSS matrix serialization may round the rendered coordinate slightly.
      assert(
        throttle >= -0.00001 && throttle <= 1.00001,
        'Throttle stick outside its visible range.',
      );
      throttle = clamp(throttle, 0, 1);
    } else {
      const match = boundedText(raw.throttleText).match(/^(\d+(?:[.,]\d+)?)%$/);
      assert(match, 'Missing visible Worlds throttle percentage.');
      throttle = Number(match[1].replace(',', '.')) / 100;
    }
  }
  if (height !== null)
    assert(
      height >= 0 && height <= FPV_EXERCISE_PROTOCOL.maximumHeight,
      'Flight exceeded the bounded height envelope.',
    );
  if (throttle !== null)
    assert(throttle >= 0 && throttle <= 1, 'Throttle measurement out of range.');
  return {
    ...hud,
    height,
    throttle,
    checkpoint,
    complete,
    phase: raw.phase,
    title: raw.title,
    identitySource:
      'native DOM identity metadata; not controller measurements; requires final proof binding',
  };
}

export function estimatePublicVerticalVelocity(samples) {
  const latest = samples.at(-1);
  assert(latest && Number.isFinite(latest.height) && Number.isFinite(latest.at));
  for (let index = 1; index < samples.length; index++) {
    const gap = samples[index].at - samples[index - 1].at;
    assert(
      gap > 0 && gap <= FPV_EXERCISE_PROTOCOL.maximumSampleGapMs,
      'Stale or non-monotonic HUD sampling.',
    );
  }
  const before = [...samples]
    .reverse()
    .find((row) => latest.at - row.at >= FPV_EXERCISE_PROTOCOL.velocityWindowMs);
  if (!before) return { value: 0, ready: false };
  const value = (latest.height - before.height) / ((latest.at - before.at) / 1000);
  assert(
    Math.abs(value) <= FPV_EXERCISE_PROTOCOL.maximumVelocity,
    'Observed vertical speed exceeds the prototype envelope.',
  );
  return { value, ready: true };
}

export function publicFPVFeedback(samples) {
  const current = samples.at(-1);
  assert(current && !current.complete && [0, 1].includes(current.checkpoint));
  const lastSemanticGround = samples.findLastIndex((row) => row.groundedWitness);
  const numericSamples = samples.slice(lastSemanticGround + 1);
  const velocity = current.groundedWitness
    ? { value: null, ready: false }
    : estimatePublicVerticalVelocity(numericSamples);
  const settledGround =
    current.groundedWitness ||
    (current.checkpoint === 1 && current.height === 0 && lastSemanticGround >= 0);
  const desiredVelocity =
    current.checkpoint === 0
      ? clamp(
          FPV_EXERCISE_PROTOCOL.heightGain * (FPV_EXERCISE_PROTOCOL.targetHeight - current.height),
          -0.35,
          FPV_EXERCISE_PROTOCOL.maximumClimb,
        )
      : settledGround
        ? 0
        : current.height < 0.35
          ? FPV_EXERCISE_PROTOCOL.finalDescent
          : FPV_EXERCISE_PROTOCOL.descent;
  const desiredThrottle = settledGround
    ? FPV_EXERCISE_PROTOCOL.groundedThrottle
    : clamp(
        FPV_EXERCISE_PROTOCOL.throttleHover +
          FPV_EXERCISE_PROTOCOL.velocityGain * (desiredVelocity - velocity.value),
        FPV_EXERCISE_PROTOCOL.minimumFlightThrottle,
        FPV_EXERCISE_PROTOCOL.maximumFlightThrottle,
      );
  const error = desiredThrottle - current.throttle;
  const direction =
    Math.abs(error) <= FPV_EXERCISE_PROTOCOL.throttleDeadband ? null : error > 0 ? 'w' : 's';
  const fine = direction !== null && Math.abs(error) <= 0.06;
  return {
    desiredThrottle,
    desiredVelocity,
    velocity,
    settledGround,
    keys: direction ? [...(fine ? ['ShiftLeft'] : []), direction] : [],
  };
}

export function assertPublicFPVCompletion(samples) {
  assert(samples.length >= 4, 'Insufficient exercise progression.');
  assert(
    samples[0].checkpoint === 0 && samples[0].height === 0 && !samples[0].complete,
    'Exercise was not freshly started on the ground.',
  );
  const progress = [];
  for (const row of samples) if (progress.at(-1) !== row.checkpoint) progress.push(row.checkpoint);
  assert.deepEqual(
    progress,
    [0, 1, 2],
    'Native lift and landing progression was skipped or reset.',
  );
  assert(
    samples.some((row) => row.checkpoint < 2 && row.height >= 1.2),
    'No first-step lift observed.',
  );
  assert(
    samples.some(
      (row) => row.checkpoint === 1 && row.groundedWitness === true && row.height === null,
    ),
    'No native soft-touchdown throttle action observed.',
  );
  assert(
    samples.some((row) => row.checkpoint === 1 && row.height === 0 && row.throttle <= 0.1),
    'No grounded low-throttle landing observed.',
  );
  assert.equal(samples.at(-1).complete, true, 'Native complete outcome missing.');
}

export async function readPublicFPVSnapshot(page, packageId) {
  return page.evaluate((id) => {
    const doc = globalThis.document,
      academy = id === 'civilian-fpv';
    const node = (selector) => doc.querySelector(selector);
    const visible = (element) =>
      Boolean(
        element &&
          element.getClientRects().length &&
          globalThis.getComputedStyle(element).visibility !== 'hidden' &&
          !element.closest('[hidden]'),
      );
    const text = (selector) => (visible(node(selector)) ? node(selector).innerText : null);
    const viewport = node(academy ? '#viewport' : '#world-viewport');
    const result = node(academy ? '#complete' : '#result-panel');
    const hud = '[data-sim-hud="flight"]';
    const stick = node('#left-dot');
    const stickVisible = academy && visible(stick) && visible(stick?.parentElement);
    const stickY = stickVisible
      ? new globalThis.DOMMatrixReadOnly(globalThis.getComputedStyle(stick).transform).m42
      : null;
    return {
      locale: doc.documentElement.lang,
      // Form-control values are ordinary UI metadata, not runtime model state.
      mode: node(academy ? '#mode' : '#flight-mode')?.value,
      source: node(academy ? '#input-source' : '#flight-source')?.value,
      preset: node(academy ? '#keyboard-preset' : '#flight-keyboard-preset')?.value,
      // Identity metadata may be hidden by the maintained HUD. Never use it for
      // height, speed, throttle or progress; independent proof replay binds it.
      title: node(academy ? '#course-title' : '#flight-title')?.textContent,
      courseNumber: academy ? node('#course-number')?.textContent : null,
      phase: node(academy ? '#flight-app' : '#flight-dialog')?.dataset.flightState,
      focused:
        doc.hasFocus() &&
        !doc.hidden &&
        (doc.activeElement === viewport || viewport?.contains(doc.activeElement)),
      details: text(`${hud} [data-hud-part="details"]`),
      gauge: text(`${hud} [data-hud-part="gauge-name"]`),
      action: text(`${hud} [data-hud-part="action"]`),
      throttleText: academy ? null : text('#world-touch-throttle'),
      stickVisible,
      stickY,
      stickRadius: stickVisible ? stick.parentElement.clientWidth * 0.3 : null,
      stickModeLabel: academy ? node('#sticks')?.getAttribute('aria-label') : null,
      resultVisible: visible(result),
      resultHeading: academy ? text('#complete-title') : text('#result-panel h2'),
    };
  }, packageId);
}

export async function runPublicFPVExercise(
  page,
  { packageId, locale = 'en', mode = 'self-level', signal, onComplete, timeoutMs = 90000 } = {},
) {
  const spec = { packageId, locale, mode };
  validateSpec(spec);
  assert(
    Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 90000,
    'Invalid exercise deadline.',
  );
  assert(onComplete === undefined || typeof onComplete === 'function');
  const startedAt = Date.now(),
    end = startedAt + timeoutMs;
  const report = {
    protocol: FPV_EXERCISE_PROTOCOL.id,
    ...spec,
    exercise: 'flight-01',
    nativeCompleted: false,
    qualified: false,
    independentReplayVerified: false,
    gainsNativeTested: false,
    startedAt,
    timeoutMs,
    samples: [],
    actions: [],
    cleanup: { keysReleased: false, errors: [] },
    limitations: [
      'Untuned public-UI prototype; no browser acceptance evidence.',
      'Native completion is not proof admission or independent replay; caller owns those checks.',
      'Releasing keys retains throttle; caller must close or safely pause its isolated browser on failure.',
    ],
  };
  const owned = new Set(),
    held = new Set();
  let finished = false,
    uncertainInput = false;
  const check = () => {
    signal?.throwIfAborted();
    assert(Date.now() < end, 'Exercise deadline exceeded.');
  };
  async function bounded(action, { cleanup = false, limitMs = 1500 } = {}) {
    if (!cleanup) check();
    let timer, listener;
    try {
      const value = await Promise.race([
        Promise.resolve().then(action),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Exercise operation timed out.')),
            cleanup ? 1500 : Math.min(limitMs, Math.max(1, end - Date.now())),
          );
          if (!cleanup && signal) {
            listener = () => reject(new Error('Exercise aborted.'));
            signal.addEventListener('abort', listener, { once: true });
            if (signal.aborted) listener();
          }
        }),
      ]);
      if (!cleanup) check();
      return value;
    } finally {
      clearTimeout(timer);
      if (listener) signal.removeEventListener('abort', listener);
    }
  }
  async function keys(next) {
    for (const name of [...held].reverse())
      if (!next.includes(name)) {
        await bounded(() => page.keyboard.up(name));
        held.delete(name);
        report.actions.push({
          at: Date.now() - startedAt,
          key: name,
          action: 'up',
        });
      }
    for (const name of next)
      if (!held.has(name)) {
        owned.add(name);
        try {
          await bounded(async () => {
            await page.keyboard.down(name);
            if (finished) await page.keyboard.up(name);
          });
        } catch (error) {
          uncertainInput = true;
          throw error;
        }
        held.add(name);
        report.actions.push({
          at: Date.now() - startedAt,
          key: name,
          action: 'down',
        });
      }
  }
  try {
    while (true) {
      check();
      assert(report.samples.length < 900, 'Telemetry bound reached.');
      const sample = parsePublicFPVSnapshot(
        await bounded(() => readPublicFPVSnapshot(page, packageId)),
        spec,
      );
      sample.at = Date.now() - startedAt;
      if (!report.samples.length)
        assert(
          sample.checkpoint === 0 &&
            sample.height === 0 &&
            sample.throttle === 0 &&
            !sample.complete,
          'Require fresh armed first exercise at zero throttle.',
        );
      else {
        const last = report.samples.at(-1);
        assert(
          sample.checkpoint >= last.checkpoint && sample.checkpoint <= last.checkpoint + 1,
          'Checkpoint skipped or reset.',
        );
      }
      report.samples.push(sample);
      if (sample.complete) {
        assertPublicFPVCompletion(report.samples);
        report.nativeCompleted = true;
        await keys([]);
        if (onComplete)
          await bounded(() => onComplete(Object.freeze({ ...sample, ...spec })), { limitMs: 5000 });
        break;
      }
      const feedback = publicFPVFeedback(report.samples);
      sample.feedback = feedback;
      await keys(feedback.keys);
      await bounded(() => delay(100, undefined, { signal }));
    }
  } catch (error) {
    report.error = String(error?.message ?? error).slice(0, 1024);
  } finally {
    finished = true;
    for (const name of [...owned].reverse()) {
      try {
        await bounded(() => page.keyboard.up(name), { cleanup: true });
      } catch (error) {
        report.cleanup.errors.push(String(error?.message ?? error).slice(0, 256));
      }
    }
    report.cleanup.keysReleased = !uncertainInput && !report.cleanup.errors.length;
    report.finishedAt = Date.now();
  }
  return report;
}
