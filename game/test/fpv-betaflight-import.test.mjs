import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
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
  previewBetaflightImport,
  previewNativeRateImport,
  validateRateImportReceipt,
  RATE_IMPORT_RECEIPT_BYTES,
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

test('explicit unsupported firmware headers never become missing headers or verified release tags', async () => {
  const baseline = betaflightDefaultRateProfile('2026.6.2'),
    original = structuredClone(baseline);
  for (const version of [
    '3.5.7',
    '5.0.0',
    '2030.12.1',
    '4.5.2-RC1',
    '2026.6.2-dev',
    '2026.6.2-RC.1',
    '2026.6.2+local.1',
    '2026.6.2-dev+custom.1',
  ]) {
    const source = `# Betaflight / STM32F405 (S405) ${version} (abcdef) MSP API: 1.47\nset roll_srate = 83`;
    for (const kind of ['complete', 'diff', 'patch']) {
      const options = { kind, ...(kind === 'patch' ? { baseline } : {}) };
      fails(() => parseBetaflightConfiguration(source, options), 'unsupported-version');
      fails(
        () => parseBetaflightConfiguration(source, { ...options, sourceVersion: '2026.6.2' }),
        'version-conflict',
      );
      await assert.rejects(
        previewBetaflightImport(source, options),
        (error) => error instanceof BetaflightImportError && error.code === 'unsupported-version',
      );
      assert.deepEqual(
        baseline,
        original,
        'Failed interpretation must preserve the patch baseline',
      );
    }
  }
  fails(
    () =>
      parseBetaflightConfiguration('# Betaflight 2026.6.2\n# Betaflight 2026.6.2-dev', {
        kind: 'diff',
      }),
    'version-conflict',
  );
});

test('exact release headers retain their source version and genuinely headerless patches remain supported', () => {
  for (const version of BETAFLIGHT_IMPORT_VERSIONS) {
    const result = parseBetaflightConfiguration(
      `# Betaflight / STM32F405 (S405) ${version} (abcdef) MSP API: 1.47\nset roll_srate = 83`,
      { kind: 'diff' },
    );
    assert.equal(result.sourceVersion, version);
    assert.equal(result.sourceVersionOrigin, 'header');
    assert.equal(result.profile.axes.roll.rate, 83);
  }
  const result = parseBetaflightConfiguration('dump rates\nset roll_srate = 83', {
    kind: 'patch',
    baseline: betaflightDefaultRateProfile('2026.6.2'),
  });
  assert.equal(result.sourceVersion, null);
  assert.equal(result.sourceVersionOrigin, 'unspecified');
  assert.equal(result.profile.axes.roll.rate, 83);
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

test('preset option matching agrees with the tagged App while preserving original labels', async () => {
  const cases = JSON.parse(
    readFileSync(
      new URL('./fixtures/fpv/betaflight-preset-option-case.json', import.meta.url),
      'utf8',
    ),
  );
  for (const observation of cases.observations) {
    const resolution = resolveBetaflightPresetBundle({
      files: cases.files,
      entry: cases.entry,
      options: observation.options,
    });
    assert.deepEqual(
      resolution.text.trim().split('\n').filter(Boolean),
      observation.upstreamCommands,
      observation.name,
    );
    assert.deepEqual(
      resolution.options.map((option) => option.name),
      ['Race rates', 'Smooth rates'],
    );
    assert.deepEqual(
      resolution.options.filter((option) => option.checked).map((option) => option.name),
      observation.checkedOptions,
    );
    assert.deepEqual(resolution.warnings, []);
    assert.deepEqual(
      JSON.parse(resolution.identity).options,
      resolution.options.map((option) => [option.name, option.checked]),
    );
    const { provenance } = await previewBetaflightImport(resolution.text, {
      kind: 'patch',
      baseline: createRateProfile(),
      presetBundle: { files: cases.files, entry: cases.entry, options: observation.options },
    });
    assert.deepEqual(
      provenance.preset.options.entries.map((entry) => JSON.parse(entry)),
      resolution.options,
    );
    for (const [path, contents] of Object.entries(cases.files))
      assert.ok(
        provenance.preset.files.entries.includes(
          `${sha(contents)} ${Buffer.byteLength(contents)} ${path}`,
        ),
      );
  }
  const explicit = resolveBetaflightPresetBundle({
    files: cases.files,
    entry: cases.entry,
    options: { 'RACE RATES': false, 'smooth rates': true },
  });
  assert.equal(explicit.text.trim(), 'set roll_srate = 80');
  fails(
    () =>
      resolveBetaflightPresetBundle({
        files: cases.files,
        entry: cases.entry,
        options: { 'SMOOTH RATES': true },
      }),
    'exclusive-options',
  );
});

test('explicit preset review flags match tagged App boolean metadata and survive transfer receipts', async () => {
  const cases = JSON.parse(
    readFileSync(
      new URL('./fixtures/fpv/betaflight-preset-review-boolean.json', import.meta.url),
      'utf8',
    ),
  );
  for (const observation of cases.observations) {
    const files = { 'main.txt': `${observation.line}\n${cases.payload}` },
      bundle = { files, entry: 'main.txt' },
      resolved = resolveBetaflightPresetBundle(bundle);
    assert.equal(resolved.forceOptionsReview, observation.upstreamForceOptionsReview);
    assert.equal(resolved.text.trim(), cases.payload);
    const { provenance } = await previewBetaflightImport(resolved.text, {
      kind: 'patch',
      baseline: createRateProfile(),
      presetBundle: bundle,
    });
    assert.ok(
      provenance.preset.metadata.entries.some((entry) => {
        const metadata = JSON.parse(entry);
        return (
          metadata.field === 'FORCE_OPTIONS_REVIEW' &&
          metadata.value === observation.upstreamForceOptionsReview
        );
      }),
    );
  }
  assert.equal(
    resolveBetaflightPresetBundle({
      files: { 'main.txt': `#$ FORCE_OPTIONS_REVIEW\n${cases.payload}` },
      entry: 'main.txt',
    }).forceOptionsReview,
    true,
    'Keep the existing bare-directive compatibility behavior',
  );
});

test('case-only duplicate preset options and selections are rejected without mutating inputs', () => {
  const files = {
    'main.txt': '#$ OPTION BEGIN (CHECKED): Race\n#$ OPTION END\n#$ INCLUDE: child.txt',
    'child.txt': '#$ OPTION BEGIN (UNCHECKED): RACE\nset roll_srate = 90\n#$ OPTION END',
  };
  const options = { Race: true, RACE: false };
  const before = JSON.stringify({ files, options });
  fails(
    () => resolveBetaflightPresetBundle({ files, entry: 'main.txt', options }),
    'duplicate-option',
  );
  assert.equal(JSON.stringify({ files, options }), before);
  for (const path of ['main.txt', 'child.txt']) {
    const duplicate = {
      ...files,
      [path]: `${files[path]}\n#$ OPTION BEGIN (UNCHECKED): race\n#$ OPTION END`,
    };
    fails(
      () => resolveBetaflightPresetBundle({ files: duplicate, entry: 'main.txt' }),
      'duplicate-option',
    );
  }
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

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
test('import receipts pin exact UTF-8 source, firmware choice, source profile and interpreted review', async () => {
  const source =
    '\uFEFF# Betaflight 2026.6.2\r\nrateprofile 1\r\nset rates_type = KISS\r\nset roll_srate = 200\r\nset p_roll = 80\r\n';
  const result = await previewBetaflightImport(source, { kind: 'diff' });
  const receipt = result.provenance;
  assert.equal(receipt.source.sha256, sha(source));
  assert.equal(receipt.source.bytes, Buffer.byteLength(source));
  assert.notEqual(receipt.source.sha256, sha(source.replace(/\r/gu, '').slice(1)));
  assert.deepEqual(receipt.firmware, { version: '2026.6.2', origin: 'header' });
  assert.equal(receipt.sourceProfile, 1);
  assert.equal(receipt.operation, 'diff');
  assert.equal(receipt.baseline.kind, 'firmware-defaults');
  assert.equal(receipt.resultSha256, sha(canonicalJSON(result.profile)));
  assert.ok(
    receipt.review.applied.entries.some(
      (item) => item.includes('roll_srate') && item.includes('99'),
    ),
  );
  assert.ok(
    receipt.review.normalizations.entries.some(
      (item) => item.includes('200') && item.includes('99'),
    ),
  );
  assert.ok(receipt.review.ignored.entries.some((item) => item.includes('p_roll')));
  assert.ok(receipt.review.inferred.total > 0);
  assert.equal(
    (
      await previewBetaflightImport('set roll_srate = 80', {
        kind: 'complete',
        sourceVersion: '4.5.5',
      })
    ).provenance.firmware.origin,
    'manual',
  );
});

test('firmware-default patch baselines resolve the same verified header as the import and receipt', async () => {
  for (const version of BETAFLIGHT_IMPORT_VERSIONS) {
    const source = `# Betaflight ${version}\nset roll_srate = 81`;
    const result = await previewBetaflightImport(source, {
      kind: 'patch',
      baseline: 'firmware-defaults',
    });
    assert.equal(result.sourceVersion, version);
    assert.equal(result.profile.axes.roll.rate, 81);
    assert.deepEqual(result.profile.throttle, betaflightDefaultRateProfile(version).throttle);
    assert.deepEqual(result.provenance.firmware, { version, origin: 'header' });
    assert.equal(result.provenance.baseline.kind, 'firmware-defaults');
    assert.equal(
      result.provenance.baseline.sha256,
      sha(canonicalJSON(betaflightDefaultRateProfile(version))),
    );
  }
  const options = { kind: 'patch', baseline: 'firmware-defaults' };
  fails(
    () => parseBetaflightConfiguration('set roll_srate = 81', options),
    'source-version-required',
  );
  fails(
    () => parseBetaflightConfiguration('# Betaflight 4.5.9\nset roll_srate = 81', options),
    'unsupported-version',
  );
  fails(
    () =>
      parseBetaflightConfiguration('# Betaflight 4.5.2\nset roll_srate = 81', {
        ...options,
        sourceVersion: '2026.6.2',
      }),
    'version-conflict',
  );
  const manual = await previewBetaflightImport('set roll_srate = 81', {
    ...options,
    sourceVersion: '4.5.2',
  });
  assert.deepEqual(manual.provenance.firmware, { version: '4.5.2', origin: 'manual' });
});

test('headerless patch receipts retain the exact baseline and do not invent source firmware', async () => {
  const baseline = createRateProfile({ axes: { pitch: { expo: 25 } } });
  const original = structuredClone(baseline);
  const options = {
    kind: 'patch',
    baseline,
    baselineKind: 'draft',
    baselineIdentity: { profileId: 'pilot', revision: 3 },
  };
  const pending = previewBetaflightImport('set yaw_srate = 88', options);
  baseline.axes.pitch.expo = 50;
  options.baselineIdentity.revision = 4;
  const { provenance, profile } = await pending;
  assert.deepEqual(provenance.firmware, { version: null, origin: 'unspecified' });
  assert.deepEqual(provenance.baseline, {
    kind: 'draft',
    sha256: sha(canonicalJSON(original)),
    profileId: 'pilot',
    revision: 3,
  });
  assert.equal(profile.axes.pitch.expo, 25);
  assert.equal(provenance.review.inferred.total, 0);
});

test('preset receipts pin every original file and preserve ordered inactive includes and option choices', async () => {
  const files = {
    'rates/main.txt':
      '#$ DESCRIPTION: <script>inert()</script>\r\n#$ INCLUDE: base.txt\r\n#$ OPTION BEGIN (UNCHECKED): Fast\r\n#$ INCLUDE: fast.txt\r\n#$ OPTION END\r\n#$ INCLUDE: base.txt',
    'rates/base.txt': '\uFEFFset yaw_srate = 80\r\n',
    'rates/fast.txt': 'set yaw_srate = 90\n',
  };
  const bundle = { files, entry: 'rates/main.txt', options: { Fast: false } };
  const resolved = resolveBetaflightPresetBundle(bundle);
  const pending = previewBetaflightImport(resolved.text, {
    kind: 'patch',
    baseline: createRateProfile(),
    presetBundle: bundle,
  });
  const original = structuredClone(bundle);
  files['rates/fast.txt'] = 'set yaw_srate = 99';
  bundle.options.Fast = true;
  const { provenance } = await pending;
  assert.equal(provenance.source.kind, 'preset');
  assert.equal(provenance.source.sha256, sha(resolved.text));
  for (const [path, source] of Object.entries(original.files))
    assert.ok(
      provenance.preset.files.entries.includes(
        `${sha(source)} ${Buffer.byteLength(source)} ${path}`,
      ),
    );
  assert.equal(provenance.preset.includes.total, 4);
  assert.match(provenance.preset.includes.entries[2], /"active":false/);
  assert.match(provenance.preset.options.entries[0], /"checked":false/);
  assert.ok(provenance.preset.metadata.entries.some((item) => item.includes('<script>')));
  assert.match(provenance.preset.resolutionSha256, /^[a-f0-9]{64}$/u);
  await assert.rejects(
    previewBetaflightImport(resolved.text, {
      kind: 'patch',
      baseline: createRateProfile(),
      presetBundle: bundle,
    }),
    /Resolve the selected preset/,
  );
});

test('large inert import reviews are bounded and disclose shortened metadata without losing exact source identity', async () => {
  const source = Array.from(
    { length: 1000 },
    (_, i) => `set hardware_${i} = ${'я'.repeat(1000)}`,
  ).join('\n');
  // Stay within the existing 1 MiB CLI cap while exercising large UTF-8 values.
  const bounded = source.slice(0, source.indexOf('\n', 400000));
  const { provenance } = await previewBetaflightImport(bounded, {
    kind: 'diff',
    sourceVersion: '2026.6.2',
  });
  assert.equal(provenance.source.sha256, sha(bounded));
  assert.ok(provenance.review.ignored.total > 100);
  assert.equal(provenance.review.ignored.entries.length, 12);
  assert.equal(provenance.review.ignored.shortened, true);
  assert.ok(Buffer.byteLength(JSON.stringify(provenance)) < RATE_IMPORT_RECEIPT_BYTES);
  assert.deepEqual(validateRateImportReceipt(provenance), provenance);
  for (const mutate of [
    (value) => {
      value.format = 'FpvRateImportReceipt.v2';
    },
    (value) => {
      value.futureHardwareAdapter = true;
    },
    (value) => {
      value.review.ignored.entries[0] = '\u0000active';
    },
    (value) => {
      value.source.sha256 = 'invalid';
    },
    (value) => {
      value.review.ignored.shortened = false;
    },
  ]) {
    const invalid = structuredClone(provenance);
    mutate(invalid);
    assert.throws(() => validateRateImportReceipt(invalid));
  }
});

test('native imports produce a receipt while portable curve exports remain free of provenance', async () => {
  const source = `\uFEFF${exportNativeRateProfile(createRateProfile())}`;
  const result = await previewNativeRateImport(source);
  assert.equal(result.provenance.source.sha256, sha(source));
  assert.equal(result.provenance.operation, 'native');
  assert.equal(result.provenance.baseline, null);
  assert.deepEqual(Object.keys(JSON.parse(exportNativeRateProfile(result.profile))).sort(), [
    'format',
    'profile',
  ]);
});
