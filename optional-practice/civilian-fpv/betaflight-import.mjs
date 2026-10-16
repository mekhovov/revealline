import { boundedJSON, canonicalJSON } from '../../game/data-json.mjs';
import { createRateProfile, validateRateProfile } from './rates.mjs';

// Only these tagged schemas have been checked. A family name is deliberately not
// enough to reconstruct a sparse diff, since omitted values are meaningful.
export const BETAFLIGHT_IMPORT_VERSIONS = Object.freeze([
  '4.5.2',
  '4.5.5',
  '2025.12.4',
  '2025.12.5',
  '2026.6.2',
]);
export const RATE_TRANSFER_FORMAT = 'FpvRateTransfer.v1';
const AXES = ['roll', 'pitch', 'yaw'];
const ALGORITHMS = ['betaflight', 'raceflight', 'kiss', 'actual', 'quick'];
const LIMITS = {
  betaflight: [255, 100],
  raceflight: [200, 255],
  kiss: [255, 99],
  actual: [200, 200],
  quick: [255, 200],
};
const MAX_TEXT_BYTES = 1024 * 1024;
const clone = (value) => JSON.parse(JSON.stringify(value));
const modelForVersion = (version) =>
  version.startsWith('4.5.') ? 'betaflight-4.5' : 'betaflight-2025.12';

export class BetaflightImportError extends Error {
  constructor(code, message, line = null) {
    super(line === null ? message : `Line ${line}: ${message}`);
    this.name = 'BetaflightImportError';
    this.code = code;
    this.line = line;
  }
}
function need(condition, code, message, line) {
  if (!condition) throw new BetaflightImportError(code, message, line);
}
function checkedText(text, maxBytes = MAX_TEXT_BYTES) {
  need(
    typeof text === 'string' && new TextEncoder().encode(text).length <= maxBytes,
    'text-size',
    'Configuration text is missing or too large.',
  );
  need(
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text),
    'invalid-text',
    'Configuration contains unsupported control characters.',
  );
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  need(
    lines.length <= 20000 && lines.every((line) => line.length <= 8192),
    'text-size',
    'Configuration has too many lines or an oversized line.',
  );
  return lines;
}
function checkedVersion(version) {
  need(
    BETAFLIGHT_IMPORT_VERSIONS.includes(version),
    'unsupported-version',
    `Choose a verified Betaflight version: ${BETAFLIGHT_IMPORT_VERSIONS.join(', ')}.`,
  );
  return version;
}
function integer(value, min, max, line, field) {
  need(
    /^\d+$/u.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= min &&
      Number(value) <= max,
    'invalid-value',
    `${field} must be an integer from ${min} to ${max}.`,
    line,
  );
  return Number(value);
}
function flat(profile) {
  const out = { rates_type: profile.algorithm, quickrates_rc_expo: profile.quickRatesRcExpo };
  for (const axis of AXES) {
    out[`${axis}_rc_rate`] = profile.axes[axis].rcRate;
    out[`${axis}_srate`] = profile.axes[axis].rate;
    out[`${axis}_expo`] = profile.axes[axis].expo;
    out[`${axis}_rate_limit`] = profile.axes[axis].limit;
  }
  Object.assign(out, {
    throttle_model: profile.throttle.model,
    thr_mid: profile.throttle.mid,
    thr_expo: profile.throttle.expo,
    thr_hover: profile.throttle.hover,
    throttle_limit_type: profile.throttle.limitType,
    throttle_limit_percent: profile.throttle.limitPercent,
  });
  return out;
}

/** Defaults read from controlrate_profile.c, rc_controls.h and common_pre.h at
 * each advertised tag. Board/custom-build overrides are not inferred. */
export function betaflightDefaultRateProfile(sourceVersion) {
  checkedVersion(sourceVersion);
  const profile = createRateProfile();
  profile.algorithm = 'actual';
  for (const axis of AXES) profile.axes[axis] = { rcRate: 7, rate: 67, expo: 0, limit: 1998 };
  profile.quickRatesRcExpo = false;
  profile.throttle = {
    model: modelForVersion(sourceVersion),
    mid: 50,
    expo: 0,
    hover: 50,
    limitType: 'off',
    limitPercent: 100,
  };
  return validateRateProfile(profile);
}

/** Parse data, never execute CLI. No storage is changed, even if a later line
 * fails. The caller reviews this result and explicitly creates/assigns profiles. */
export function parseBetaflightConfiguration(
  text,
  { kind = 'patch', sourceVersion = null, baseline = null, selectedProfile = null } = {},
) {
  need(
    ['complete', 'diff', 'patch'].includes(kind),
    'invalid-kind',
    'Choose complete configuration, sparse diff, or patch.',
  );
  const lines = checkedText(text);
  const headers = new Set();
  for (const line of lines) {
    if (/^\s*#?\s*Betaflight\b/iu.test(line)) {
      const match = line.match(/\b(?:4\.\d+\.\d+|20\d\d\.\d+\.\d+)\b/u);
      if (match) headers.add(match[0]);
    }
  }
  need(headers.size <= 1, 'version-conflict', 'The text contains conflicting firmware headers.');
  const header = [...headers][0] ?? null;
  need(
    !header || !sourceVersion || sourceVersion === header,
    'version-conflict',
    'The selected firmware version conflicts with the file header.',
  );
  sourceVersion = header || sourceVersion;
  if (sourceVersion) checkedVersion(sourceVersion);
  need(
    sourceVersion || kind === 'patch',
    'source-version-required',
    'This file has no firmware header. Choose its source firmware version.',
  );
  need(
    kind !== 'patch' || baseline,
    'baseline-required',
    'Choose the rate profile to use as the patch baseline.',
  );
  const original = baseline
    ? validateRateProfile(baseline)
    : betaflightDefaultRateProfile(sourceVersion);
  const defaultProfile = sourceVersion ? betaflightDefaultRateProfile(sourceVersion) : null;
  let rateIndex = 0,
    pidIndex = 0;
  const profiles = new Map();
  const unapplied = [],
    normalizations = [],
    warnings = [],
    commands = [];
  const initial = () => clone(kind === 'patch' ? original : defaultProfile);
  const at = (index) => {
    if (!profiles.has(index))
      profiles.set(index, { index, name: '', profile: initial(), assigned: new Set() });
    return profiles.get(index);
  };
  at(0);
  for (let n = 0; n < lines.length; n++) {
    const lineNumber = n + 1;
    const raw = lines[n].trim();
    need(
      !raw.startsWith('#$'),
      'unresolved-preset',
      'Resolve preset options and includes before importing this patch.',
      lineNumber,
    );
    const line = raw.replace(/\s*#.*$/u, '').trim();
    if (!line) continue;
    let match;
    if ((match = line.match(/^(rateprofile|profile)\s+(\d+)$/iu))) {
      // Pinned upstream builds have four of each. Other custom counts require a
      // separately verified schema; a PID profile never changes the rate index.
      const index = integer(match[2], 0, 3, lineNumber, match[1]);
      if (match[1].toLowerCase() === 'rateprofile') {
        rateIndex = index;
        at(index);
      } else pidIndex = index;
      commands.push({ line: lineNumber, command: match[1].toLowerCase(), index });
      continue;
    }
    if (/^(?:rateprofile|profile)\b/iu.test(line)) {
      throw new BetaflightImportError(
        'invalid-profile',
        'Expected a supported profile index from 0 to 3.',
        lineNumber,
      );
    }
    if (/^defaults\b/iu.test(line)) {
      need(
        /^defaults(?:\s+nosave)?$/iu.test(line),
        'unsupported-defaults',
        'Only full defaults and defaults nosave are supported; group resets need resolved CLI.',
        lineNumber,
      );
      need(
        defaultProfile,
        'source-version-required',
        'Choose the source firmware version before applying defaults.',
        lineNumber,
      );
      profiles.clear();
      rateIndex = 0;
      pidIndex = 0;
      profiles.set(0, { index: 0, name: '', profile: clone(defaultProfile), assigned: new Set() });
      // Subsequent profile selections must start from firmware defaults, including
      // a patch whose original baseline was non-default.
      for (let index = 1; index < 4; index++)
        profiles.set(index, {
          index,
          name: '',
          profile: clone(defaultProfile),
          assigned: new Set(),
        });
      commands.push({ line: lineNumber, command: 'defaults' });
      continue;
    }
    if ((match = line.match(/^set\s+([a-z0-9_]+)\s*=\s*(.*)$/iu))) {
      const key = match[1].toLowerCase(),
        value = match[2].trim(),
        item = at(rateIndex);
      const p = item.profile;
      let supported = true;
      if (key === 'rates_type') {
        need(
          ALGORITHMS.includes(value.toLowerCase()),
          'invalid-value',
          'Unsupported rate algorithm.',
          lineNumber,
        );
        p.algorithm = value.toLowerCase();
      } else if (key === 'quickrates_rc_expo') {
        need(
          /^(ON|OFF)$/iu.test(value),
          'invalid-value',
          'quickrates_rc_expo must be ON or OFF.',
          lineNumber,
        );
        p.quickRatesRcExpo = value.toUpperCase() === 'ON';
      } else if (key === 'rateprofile_name') {
        need(
          value.length <= 8,
          'invalid-value',
          'Betaflight rate profile names have at most eight characters.',
          lineNumber,
        );
        item.name = value === '-' ? '' : value;
      } else if ((match = key.match(/^(roll|pitch|yaw)_(rc_rate|srate|expo|rate_limit)$/u))) {
        const fields = {
          rc_rate: ['rcRate', 1, 255],
          srate: ['rate', 0, 255],
          expo: ['expo', 0, 100],
          rate_limit: ['limit', 200, 1998],
        };
        const [field, min, max] = fields[match[2]];
        p.axes[match[1]][field] = integer(value, min, max, lineNumber, key);
      } else if (['thr_mid', 'thr_expo', 'thr_hover'].includes(key)) {
        const targetModel = sourceVersion ? modelForVersion(sourceVersion) : p.throttle.model;
        if (key === 'thr_hover' && targetModel === 'betaflight-4.5') {
          throw new BetaflightImportError(
            'unsupported-setting',
            'thr_hover does not exist in Betaflight 4.5.',
            lineNumber,
          );
        }
        need(
          kind !== 'patch' || targetModel === p.throttle.model,
          'throttle-model-mismatch',
          'This patch uses a different throttle model. Choose a baseline with the source firmware throttle model.',
          lineNumber,
        );
        p.throttle.model = targetModel;
        p.throttle[{ thr_mid: 'mid', thr_expo: 'expo', thr_hover: 'hover' }[key]] = integer(
          value,
          0,
          100,
          lineNumber,
          key,
        );
      } else if (key === 'throttle_limit_type') {
        need(
          /^(OFF|SCALE|CLIP)$/iu.test(value),
          'invalid-value',
          'Throttle limit type must be OFF, SCALE, or CLIP.',
          lineNumber,
        );
        p.throttle.limitType = value.toLowerCase();
      } else if (key === 'throttle_limit_percent') {
        p.throttle.limitPercent = integer(value, 25, 100, lineNumber, key);
      } else supported = false;
      if (supported) item.assigned.add(key);
      else
        unapplied.push({
          line: lineNumber,
          key,
          value,
          pidProfile: pidIndex,
          rateProfile: rateIndex,
          reason: 'No verified SIM adapter; remains unapplied.',
        });
      continue;
    }
    need(!/^set\b/iu.test(line), 'invalid-assignment', 'Malformed set assignment.', lineNumber);
    // These lines are ordinary CLI transcript markers, not actions in the SIM.
    if (
      /^(?:save|version|exit|dump(?:\s+(?:all|rates|profile|master))?|diff(?:\s+(?:all|rates|profile|master))?|batch\s+(?:start|end))$/iu.test(
        line,
      )
    )
      continue;
    unapplied.push({
      line: lineNumber,
      command: line,
      pidProfile: pidIndex,
      rateProfile: rateIndex,
      reason: 'CLI commands are never executed.',
    });
  }
  if (selectedProfile !== null) {
    need(
      Number.isInteger(selectedProfile) && selectedProfile >= 0 && selectedProfile < 4,
      'invalid-profile',
      'Select a source rate profile from 0 to 3.',
    );
    rateIndex = selectedProfile;
    at(rateIndex);
  }
  const resolved = [];
  const inferredDefaults = [];
  for (const item of [...profiles.values()].sort((a, b) => a.index - b.index)) {
    const [rcMax, rateMax] = LIMITS[item.profile.algorithm];
    for (const axis of AXES) {
      for (const [field, max] of [
        ['rcRate', rcMax],
        ['rate', rateMax],
      ]) {
        const before = item.profile.axes[axis][field];
        if (before > max) {
          item.profile.axes[axis][field] = max;
          normalizations.push({
            profile: item.index,
            field: `axes.${axis}.${field}`,
            before,
            after: max,
            reason: 'Firmware algorithm limit applied at configuration validation.',
          });
        }
      }
    }
    const profile = validateRateProfile(item.profile);
    if (kind !== 'patch' || commands.some((command) => command.command === 'defaults')) {
      for (const [key, value] of Object.entries(flat(profile))) {
        if (
          key !== 'throttle_model' &&
          !(key === 'thr_hover' && profile.throttle.model === 'betaflight-4.5') &&
          !item.assigned.has(key)
        )
          inferredDefaults.push({ profile: item.index, field: key, value, sourceVersion });
      }
    }
    resolved.push({
      index: item.index,
      name: item.name,
      profile,
      assignedFields: [...item.assigned],
    });
  }
  const selected = resolved.find((item) => item.index === rateIndex);
  const before = flat(original),
    after = flat(selected.profile);
  const changedFields = Object.keys(after)
    .filter((key) => before[key] !== after[key])
    .map((field) => ({ field, before: before[field], after: after[field] }));
  if (!header && sourceVersion)
    warnings.push('Source version was selected manually because the file has no firmware header.');
  if (kind !== 'patch')
    warnings.push(
      'Omitted settings use the pinned upstream defaults; custom firmware or board-specific defaults are not inferred.',
    );
  if (unapplied.length)
    warnings.push(
      'Only supported rates and throttle settings transfer. Aircraft, hardware, PID, filtering and RC smoothing remain unapplied.',
    );
  return {
    format: 'BetaflightRateImport.v1',
    kind,
    sourceVersion,
    selectedProfile: rateIndex,
    profile: selected.profile,
    name: selected.name,
    profiles: resolved,
    changedFields,
    inferredDefaults,
    normalizations,
    unapplied,
    warnings,
    commands,
  };
}

export function exportNativeRateProfile(profile) {
  return `${JSON.stringify({ format: RATE_TRANSFER_FORMAT, profile: validateRateProfile(profile) }, null, 2)}\n`;
}
export function importNativeRateProfile(text) {
  const data = boundedJSON(text, { maxBytes: 16384, maxNodes: 200, maxArray: 16, maxDepth: 8 });
  need(
    data?.format === RATE_TRANSFER_FORMAT &&
      Object.keys(data).length === 2 &&
      Object.hasOwn(data, 'profile'),
    'invalid-native-profile',
    'This is not a supported SIM rate profile file.',
  );
  return validateRateProfile(data.profile);
}

/** A rate-only patch: no save/defaults, PID, hardware, or assignment changes. */
export function exportBetaflightRates(
  input,
  { targetVersion, profileIndex = null, includeThrottle = true } = {},
) {
  checkedVersion(targetVersion);
  const profile = validateRateProfile(input);
  need(
    profileIndex === null ||
      (Number.isInteger(profileIndex) && profileIndex >= 0 && profileIndex < 4),
    'invalid-profile',
    'Target rate profile must be from 0 to 3.',
  );
  need(
    !includeThrottle || profile.throttle.model === modelForVersion(targetVersion),
    'throttle-model-mismatch',
    'Target firmware uses a different throttle curve. Export rotation rates only or choose a matching firmware version.',
  );
  const values = flat(profile);
  delete values.throttle_model;
  if (!includeThrottle)
    for (const key of [
      'thr_mid',
      'thr_expo',
      'thr_hover',
      'throttle_limit_type',
      'throttle_limit_percent',
    ])
      delete values[key];
  if (modelForVersion(targetVersion) === 'betaflight-4.5') delete values.thr_hover;
  const lines = [
    `# Betaflight ${targetVersion}`,
    '# SIM rotation rates and supported throttle settings; review before applying.',
  ];
  if (profileIndex !== null) lines.push(`rateprofile ${profileIndex}`);
  for (const [key, value] of Object.entries(values)) {
    const text =
      typeof value === 'boolean'
        ? value
          ? 'ON'
          : 'OFF'
        : typeof value === 'string'
          ? value.toUpperCase()
          : value;
    lines.push(`set ${key} = ${text}`);
  }
  return `${lines.join('\n')}\n`;
}

function bundlePath(path, from = '') {
  need(
    typeof path === 'string' &&
      path.length > 0 &&
      path.length <= 512 &&
      !/^(?:\/|[a-z]+:)/iu.test(path) &&
      !/[\\\u0000]/u.test(path),
    'invalid-path',
    'Preset paths must stay within the supplied local bundle.',
  );
  const parts = from ? from.split('/').slice(0, -1) : [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      need(
        parts.length > 0,
        'invalid-path',
        'Preset paths must stay within the supplied local bundle.',
      );
      parts.pop();
    } else parts.push(part);
  }
  need(parts.length > 0, 'invalid-path', 'Preset path must name a file.');
  return parts.join('/');
}

/** Resolve only uploaded local text. Metadata is inert text, including markup
 * and links. Options from includes are exposed only by matching root options,
 * as in Betaflight's documented dummy-option convention. */
export function resolveBetaflightPresetBundle({ files, entry, options = {} }) {
  files = boundedJSON(files, {
    maxBytes: MAX_TEXT_BYTES,
    maxNodes: 260,
    maxDepth: 2,
    maxString: MAX_TEXT_BYTES,
  });
  options = boundedJSON(options, { maxBytes: 32768, maxNodes: 260, maxDepth: 2, maxString: 512 });
  need(
    files && typeof files === 'object' && !Array.isArray(files),
    'invalid-bundle',
    'Supply a local preset text bundle.',
  );
  need(
    options &&
      typeof options === 'object' &&
      !Array.isArray(options) &&
      Object.values(options).every((value) => typeof value === 'boolean'),
    'invalid-options',
    'Preset option selections must be true or false.',
  );
  const bundle = new Map();
  let totalBytes = 0;
  for (const [path, text] of Object.entries(files)) {
    const normalized = bundlePath(path);
    need(
      !bundle.has(normalized),
      'duplicate-path',
      'The bundle contains duplicate normalized paths.',
    );
    checkedText(text);
    totalBytes += new TextEncoder().encode(text).length;
    need(
      totalBytes <= MAX_TEXT_BYTES && bundle.size < 128,
      'bundle-size',
      'The preset bundle is too large.',
    );
    bundle.set(normalized, text);
  }
  const root = bundlePath(entry);
  need(bundle.has(root), 'missing-dependency', `Missing preset file: ${root}.`);
  const parsed = new Map(),
    metadata = [],
    visibleOptions = [],
    allOptions = [],
    groups = [];
  let forceOptionsReview = false;
  const parse = (path) => {
    if (parsed.has(path)) return parsed.get(path);
    const nodes = [],
      names = new Set();
    let option = null,
      group = null;
    for (const [offset, raw] of checkedText(bundle.get(path)).entries()) {
      const line = offset + 1,
        text = raw.trim();
      let match;
      if ((match = text.match(/^#\$\s+OPTION_GROUP BEGIN:\s*(\(EXCLUSIVE\))?\s*(.+)$/u))) {
        need(
          !group && !option,
          'unsupported-nesting',
          'Nested option groups are not supported.',
          line,
        );
        group = { name: match[2], exclusive: Boolean(match[1]), path };
        need(
          !groups.some((item) => item.path === path && item.name === group.name),
          'duplicate-group',
          'Option group names must be unique within a preset.',
          line,
        );
        groups.push(group);
      } else if (/^#\$\s+OPTION_GROUP END$/u.test(text)) {
        need(group && !option, 'unbalanced-options', 'Unexpected option group end.', line);
        group = null;
      } else if (
        (match = text.match(/^#\$\s+OPTION BEGIN(?:\s+\((CHECKED|UNCHECKED)\))?:\s*(.+)$/u))
      ) {
        need(!option, 'unsupported-nesting', 'Nested options are not supported.', line);
        need(!names.has(match[2]), 'duplicate-option', `Duplicate option: ${match[2]}.`, line);
        names.add(match[2]);
        option = {
          name: match[2],
          defaultChecked: match[1] === 'CHECKED',
          group: group?.name ?? null,
          path,
        };
        allOptions.push(option);
        if (path === root) visibleOptions.push(option);
      } else if (/^#\$\s+OPTION END$/u.test(text)) {
        need(option, 'unbalanced-options', 'Unexpected option end.', line);
        option = null;
      } else if (
        (match = text.match(/^#\$\s+(INCLUDE|INCLUDE_WARNING|INCLUDE_DISCLAIMER):\s*(.+)$/u))
      ) {
        let dependency;
        // Official presets use paths rooted at presets/. Local bundles may also
        // use paths relative to the including file.
        if (match[2].startsWith('presets/')) dependency = bundlePath(match[2]);
        else dependency = bundlePath(match[2], path);
        need(
          bundle.has(dependency),
          'missing-dependency',
          `Missing bundled dependency: ${dependency}.`,
          line,
        );
        nodes.push({ type: match[1], path: dependency, option: option?.name ?? null, line });
      } else if ((match = text.match(/^#\$\s+([A-Z_]+)(?::\s*(.*))?$/u))) {
        need(
          !['OPTION', 'OPTION_GROUP'].includes(match[1]),
          'unsupported-directive',
          'Unsupported or malformed preset option directive.',
          line,
        );
        if (path === root) {
          if (match[1] === 'FORCE_OPTIONS_REVIEW')
            forceOptionsReview = match[2] === undefined || match[2].trim().toUpperCase() === 'TRUE';
          else metadata.push({ field: match[1], text: match[2] ?? '' });
        }
      } else {
        need(
          !text.startsWith('#$'),
          'unsupported-directive',
          'Unsupported or malformed preset directive.',
          line,
        );
        nodes.push({ type: 'text', text: raw, option: option?.name ?? null, line });
      }
    }
    need(!option && !group, 'unbalanced-options', `Unclosed option or group in ${path}.`);
    parsed.set(path, nodes);
    return nodes;
  };
  parse(root);
  const selected = new Map(
    visibleOptions.map((option) => [
      option.name,
      Object.hasOwn(options, option.name) ? options[option.name] : option.defaultChecked,
    ]),
  );
  for (const name of Object.keys(options))
    need(selected.has(name), 'unknown-option', `Unknown preset option: ${name}.`);
  const dependencies = [],
    warnings = [],
    output = [];
  let expandedLines = 0,
    metadataBytes = 0;
  const visit = (path, stack, active) => {
    need(
      !stack.includes(path),
      'include-cycle',
      `Preset include cycle: ${[...stack, path].join(' → ')}.`,
    );
    need(stack.length < 16, 'include-depth', 'Preset includes are nested too deeply.');
    const nodes = parse(path);
    dependencies.push({ path, active });
    for (const node of nodes) {
      need(++expandedLines <= 20000, 'bundle-size', 'Expanded preset has too many lines.');
      const enabled = active && (node.option === null || selected.get(node.option) === true);
      if (node.option !== null && !selected.has(node.option) && !warnings.includes(node.option))
        warnings.push(node.option);
      if (node.type === 'INCLUDE') visit(node.path, [...stack, path], enabled);
      else if (node.type === 'INCLUDE_WARNING' || node.type === 'INCLUDE_DISCLAIMER') {
        dependencies.push({ path: node.path, active: enabled });
        if (enabled) {
          metadataBytes += new TextEncoder().encode(bundle.get(node.path)).length;
          need(
            metadataBytes <= MAX_TEXT_BYTES,
            'bundle-size',
            'Expanded preset metadata is too large.',
          );
          metadata.push({ field: node.type.slice(8), text: bundle.get(node.path) });
        }
      } else if (enabled) output.push(node.text);
    }
  };
  visit(root, [], true);
  for (const group of groups) {
    if (group.exclusive)
      need(
        allOptions.filter(
          (option) =>
            option.path === group.path && option.group === group.name && selected.get(option.name),
        ).length <= 1,
        'exclusive-options',
        `Choose at most one option in ${group.name}.`,
      );
  }
  const text = `${output.join('\n')}\n`;
  checkedText(text);
  return {
    format: 'BetaflightPresetResolution.v1',
    entry: root,
    text,
    options: visibleOptions.map((option) => ({ ...option, checked: selected.get(option.name) })),
    groups,
    dependencies,
    metadata,
    forceOptionsReview,
    warnings: warnings.map(
      (name) =>
        `Included option “${name}” is inactive because the entry preset does not expose it.`,
    ),
    identity: canonicalJSON({ entry: root, text, options: [...selected] }),
  };
}
