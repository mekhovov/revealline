import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import {
  BETAFLIGHT_IMPORT_VERSIONS,
  BetaflightImportError,
  betaflightDefaultRateProfile,
  parseBetaflightConfiguration,
  exportBetaflightRates,
  exportNativeRateProfile,
  importNativeRateProfile,
  resolveBetaflightPresetBundle,
} from '../../optional-practice/civilian-fpv/betaflight-import.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/fpv/betaflight-import-schema.json', import.meta.url), 'utf8'),
);
const parse = (text, options = {}) =>
  parseBetaflightConfiguration(text, { kind: 'diff', sourceVersion: '2026.6.2', ...options });
const fails = (fn, code) =>
  assert.throws(fn, (error) => error instanceof BetaflightImportError && error.code === code);

test('all advertised versions reconstruct defaults independently captured from tagged source', () => {
  assert.deepEqual(
    BETAFLIGHT_IMPORT_VERSIONS,
    fixture.versions.map((item) => item.version),
  );
  for (const item of fixture.versions) {
    const { profile, inferredDefaults } = parse(
      `# Betaflight / STM32F405 (S405) ${item.version}\n# no changed values\nsave`,
      { sourceVersion: null },
    );
    assert.equal(profile.algorithm, item.algorithm);
    assert.equal(profile.quickRatesRcExpo, item.quickRatesRcExpo);
    for (const axis of ['roll', 'pitch', 'yaw']) {
      assert.deepEqual(profile.axes[axis], {
        rcRate: item.defaults.rcRate,
        rate: item.defaults.rate,
        expo: item.defaults.axisExpo,
        limit: item.axisLimit,
      });
    }
    assert.deepEqual(profile.throttle, {
      model: item.defaults.hover === null ? 'betaflight-4.5' : 'betaflight-2025.12',
      mid: item.defaults.mid,
      expo: item.defaults.expo,
      hover: item.defaults.hover ?? 50,
      limitType: item.limitType,
      limitPercent: item.defaults.limitPercent,
    });
    assert.ok(inferredDefaults.length >= 18);
    assert.ok(
      item.sources.every(
        (source) =>
          source.url.includes(`/${item.version}/`) && /^[a-f0-9]{64}$/u.test(source.sha256),
      ),
    );
  }
});

test('headerless dump rates needs a version, unsupported tags and conflicting headers do not guess', () => {
  fails(
    () => parseBetaflightConfiguration('rateprofile 0\nset roll_srate = 83', { kind: 'complete' }),
    'source-version-required',
  );
  assert.equal(
    parse('rateprofile 0\nset roll_srate = 83', { kind: 'complete' }).profile.axes.roll.rate,
    83,
  );
  fails(() => parse('', { sourceVersion: '4.5' }), 'unsupported-version');
  fails(() => parse('# Betaflight 4.5.2'), 'version-conflict');
  fails(
    () => parse('# Betaflight 4.5.2\n# Betaflight 4.5.5', { sourceVersion: null }),
    'version-conflict',
  );
});

test('profiles and assignments are sequential; PID namespace cannot redirect rate settings', () => {
  const result = parse(`rateprofile 1
set roll_rc_rate = 15
profile 3
set roll_rc_rate = 18
set p_roll = 90
rateprofile 2
set roll_rc_rate = 23
rateprofile 1
set roll_expo = 20
rateprofile 2`);
  assert.equal(result.selectedProfile, 2);
  assert.equal(result.profile.axes.roll.rcRate, 23);
  assert.equal(result.profiles.find((item) => item.index === 1).profile.axes.roll.rcRate, 18);
  assert.equal(result.profiles.find((item) => item.index === 1).profile.axes.roll.expo, 20);
  assert.deepEqual(result.unapplied[0], {
    line: 5,
    key: 'p_roll',
    value: '90',
    pidProfile: 3,
    rateProfile: 1,
    reason: 'No verified SIM adapter; remains unapplied.',
  });
  assert.equal(
    parse('rateprofile 1\nset yaw_srate = 75\nrateprofile 2', { selectedProfile: 1 }).profile.axes
      .yaw.rate,
    75,
  );
  fails(() => parse('rateprofile 4'), 'invalid-value');
  fails(() => parse('profile banana'), 'invalid-profile');
});

test('ordered defaults resets earlier assignments, selections and untouched profiles', () => {
  const baseline = createRateProfile({ axes: { roll: { rcRate: 40 } } });
  const result = parse(
    `rateprofile 1
set roll_srate = 88
defaults nosave
set yaw_expo = 15
rateprofile 1`,
    { kind: 'patch', baseline },
  );
  assert.equal(result.profile.axes.roll.rcRate, 7);
  assert.equal(result.profile.axes.roll.rate, 67);
  assert.equal(result.profiles[0].profile.axes.yaw.expo, 15);
  fails(() => parse('defaults group_id 6'), 'unsupported-defaults');
  fails(
    () => parseBetaflightConfiguration('defaults nosave', { kind: 'patch', baseline }),
    'source-version-required',
  );
});

test('preset patches preserve unspecified axes and throttle and cannot mutate a supplied baseline', () => {
  const baseline = createRateProfile({
    throttle: { mid: 40, expo: 35, hover: 27, limitType: 'scale', limitPercent: 75 },
    axes: { yaw: { expo: 21 } },
  });
  const saved = structuredClone(baseline);
  const result = parseBetaflightConfiguration('set roll_rc_rate = 22\nset roll_srate = 91', {
    kind: 'patch',
    baseline,
  });
  assert.deepEqual(result.profile.throttle, baseline.throttle);
  assert.deepEqual(result.profile.axes.yaw, baseline.axes.yaw);
  assert.deepEqual(baseline, saved);
  assert.equal(result.inferredDefaults.length, 0);
  assert.deepEqual(
    result.changedFields.map((field) => field.field),
    ['roll_rc_rate', 'roll_srate'],
  );
  fails(() => parseBetaflightConfiguration('set roll_expo = 25'), 'baseline-required');
});

test('algorithm changes use ordered CLI native units and report firmware clamps', () => {
  const result = parse('set roll_rc_rate = 250\nset roll_srate = 220\nset rates_type = KISS');
  assert.equal(result.profile.algorithm, 'kiss');
  assert.equal(result.profile.axes.roll.rcRate, 250);
  assert.equal(result.profile.axes.roll.rate, 99);
  assert.deepEqual(result.normalizations, [
    {
      profile: 0,
      field: 'axes.roll.rate',
      before: 220,
      after: 99,
      reason: 'Firmware algorithm limit applied at configuration validation.',
    },
  ]);
  assert.equal(
    parse('set rates_type = KISS\nset rates_type = RACEFLIGHT\nset roll_srate = 220').profile.axes
      .roll.rate,
    220,
  );
});

test('malformed supported settings reject the whole preview instead of partially applying', () => {
  const baseline = createRateProfile(),
    saved = structuredClone(baseline);
  for (const line of [
    'set roll_rc_rate = NaN',
    'set roll_rc_rate = 0',
    'set yaw_expo = 101',
    'set pitch_srate = 1.5',
    'set roll_rate_limit = 1999',
    'set rates_type = FUTURE',
    'set quickrates_rc_expo = yes',
    'set throttle_limit_type = MAGIC',
    'set throttle_limit_percent = 24',
    'set rateprofile_name = toolongname',
  ]) {
    fails(() => parse(`set roll_expo = 10\n${line}`, { kind: 'patch', baseline }), 'invalid-value');
  }
  fails(() => parse('set roll_expo 20'), 'invalid-assignment');
  assert.deepEqual(baseline, saved);
  fails(() => parse('x'.repeat(1024 * 1024 + 1)), 'text-size');
  fails(() => parse('\0'), 'invalid-text');
});

test('unsupported hardware/controller settings and arbitrary CLI commands remain inert', () => {
  const result = parse(`set rc_smoothing = ON
set deadband = 7
set motor_output_limit = 75
set tpa_rate = 65
set gyro_lpf1_static_hz = 250
resource MOTOR 1 A08
feature AIRMODE
set roll_expo = 12`);
  assert.equal(result.profile.axes.roll.expo, 12);
  assert.equal(result.unapplied.length, 7);
  assert.equal(result.profile.throttle.limitPercent, 100);
  assert.ok(result.unapplied.every((field) => !Object.hasOwn(result.profile, field.key)));
});

test('new throttle schema must be explicit; version-mismatched patches cannot silently change curves', () => {
  assert.equal(parse('set thr_hover = 35').profile.throttle.hover, 35);
  fails(() => parse('set thr_hover = 35', { sourceVersion: '4.5.2' }), 'unsupported-setting');
  const baseline = betaflightDefaultRateProfile('4.5.2');
  fails(() => parse('set thr_expo = 35', { kind: 'patch', baseline }), 'throttle-model-mismatch');
  assert.equal(
    parse('set throttle_limit_percent = 80', { kind: 'patch', baseline }).profile.throttle.model,
    'betaflight-4.5',
  );
});

test('native transfers and matching target CLI round trip without calibration or aircraft fields', () => {
  for (const version of BETAFLIGHT_IMPORT_VERSIONS) {
    const profile = betaflightDefaultRateProfile(version);
    profile.algorithm = 'quick';
    profile.quickRatesRcExpo = true;
    profile.axes.roll.rcRate = 103;
    profile.axes.yaw.expo = 25;
    profile.throttle.expo = 20;
    profile.throttle.limitType = 'clip';
    profile.throttle.limitPercent = 85;
    assert.deepEqual(importNativeRateProfile(exportNativeRateProfile(profile)), profile);
    const text = exportBetaflightRates(profile, { targetVersion: version, profileIndex: 2 });
    assert.deepEqual(parseBetaflightConfiguration(text, { kind: 'complete' }).profile, profile);
    assert.ok(!/^save$/mu.test(text));
    assert.ok(!/^defaults/mu.test(text));
  }
  const profile = createRateProfile();
  fails(
    () => exportBetaflightRates(profile, { targetVersion: '4.5.2' }),
    'throttle-model-mismatch',
  );
  assert.ok(
    !exportBetaflightRates(profile, { targetVersion: '4.5.2', includeThrottle: false }).includes(
      'set thr_',
    ),
  );
  fails(
    () =>
      importNativeRateProfile(
        JSON.stringify({ format: 'FpvRateTransfer.v1', profile, ignored: true }),
      ),
    'invalid-native-profile',
  );
});

test('local bundles resolve ordered includes, options, exclusive groups and inert descriptions', () => {
  const files = {
    'presets/test/main.txt': `#$ TITLE: Local rates
#$ DESCRIPTION: <script>never execute</script>
#$ FORCE_OPTIONS_REVIEW: TRUE
#$ INCLUDE: presets/test/base.txt
set roll_expo = 20
#$ OPTION_GROUP BEGIN: (EXCLUSIVE) Feel
#$ OPTION BEGIN (CHECKED): Smooth
set roll_expo = 40
#$ OPTION END
#$ OPTION BEGIN (UNCHECKED): Direct
set roll_expo = 0
#$ OPTION END
#$ OPTION_GROUP END
#$ INCLUDE_WARNING: warning.txt`,
    'presets/test/base.txt': '#$ TITLE: ignored included title\nset roll_rc_rate = 21',
    'presets/test/warning.txt': '<a href="https://example.invalid">inert warning</a>',
  };
  const result = resolveBetaflightPresetBundle({ files, entry: 'presets/test/main.txt' });
  assert.equal(result.forceOptionsReview, true);
  assert.equal(result.options.find((item) => item.name === 'Smooth').checked, true);
  assert.equal(
    result.metadata.find((item) => item.field === 'DESCRIPTION').text,
    '<script>never execute</script>',
  );
  assert.equal(result.metadata.filter((item) => item.field === 'TITLE').length, 1);
  assert.equal(
    parseBetaflightConfiguration(result.text, { baseline: createRateProfile() }).profile.axes.roll
      .expo,
    40,
  );
  const direct = resolveBetaflightPresetBundle({
    files,
    entry: 'presets/test/main.txt',
    options: { Smooth: false, Direct: true },
  });
  assert.equal(
    parseBetaflightConfiguration(direct.text, { baseline: createRateProfile() }).profile.axes.roll
      .expo,
    0,
  );
  fails(
    () =>
      resolveBetaflightPresetBundle({
        files,
        entry: 'presets/test/main.txt',
        options: { Direct: true },
      }),
    'exclusive-options',
  );
  fails(
    () =>
      resolveBetaflightPresetBundle({
        files,
        entry: 'presets/test/main.txt',
        options: { Missing: true },
      }),
    'unknown-option',
  );
});

test('included options need explicit matching root option; repeated includes retain order', () => {
  const files = {
    'main.txt': `#$ OPTION BEGIN (CHECKED): Exposed
#$ OPTION END
#$ INCLUDE: child.txt
set roll_srate = 90
#$ INCLUDE: child.txt`,
    'child.txt': `set roll_srate = 75
#$ OPTION BEGIN (UNCHECKED): Exposed
set yaw_expo = 20
#$ OPTION END
#$ OPTION BEGIN (CHECKED): Hidden
set yaw_expo = 70
#$ OPTION END`,
  };
  const result = resolveBetaflightPresetBundle({ files, entry: 'main.txt' });
  const profile = parseBetaflightConfiguration(result.text, {
    baseline: createRateProfile(),
  }).profile;
  assert.equal(profile.axes.roll.rate, 75);
  assert.equal(profile.axes.yaw.expo, 20);
  assert.equal(result.warnings.length, 1);
});

test('preset includes reject missing, cyclic, escaping and unsupported nested dependencies before apply', () => {
  const resolve = (files) => resolveBetaflightPresetBundle({ files, entry: 'main.txt' });
  fails(() => resolve({ 'main.txt': '#$ INCLUDE: missing.txt' }), 'missing-dependency');
  fails(
    () => resolve({ 'main.txt': '#$ INCLUDE: child.txt', 'child.txt': '#$ INCLUDE: main.txt' }),
    'include-cycle',
  );
  for (const path of ['../outside.txt', '/outside.txt', 'https://example.com/a', '..\\outside.txt'])
    fails(() => resolve({ 'main.txt': `#$ INCLUDE: ${path}` }), 'invalid-path');
  fails(
    () => resolve({ 'main.txt': '#$ OPTION BEGIN: A\n#$ OPTION BEGIN: B' }),
    'unsupported-nesting',
  );
  fails(() => resolve({ 'main.txt': '#$ OPTION BEGIN: A' }), 'unbalanced-options');
  fails(() => resolve({ 'main.txt': '#$ OPTION END' }), 'unbalanced-options');
  fails(() => parse('#$ INCLUDE: child.txt'), 'unresolved-preset');
  fails(
    () =>
      resolve({
        'main.txt': '#$ OPTION BEGIN (UNCHECKED): Hidden\n#$ INCLUDE: child.txt\n#$ OPTION END',
        'child.txt': '#$ INCLUDE: main.txt',
      }),
    'include-cycle',
  );
});
