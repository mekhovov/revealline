// Manual source-contract checks only; no browser, native Worker, network or storage claim.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const [root, baseline, oldPlayer, inventoryPath, out] = process.argv.slice(2);
if (
  ![root, oldPlayer, inventoryPath, out].every((p) => p && path.isAbsolute(p)) ||
  !/^[a-f0-9]{40}$/.test(baseline ?? '')
)
  throw Error('ABS_ROOT BASE40 ABS_OLD_PLAYER ABS_INVENTORY ABS_NEW_RECEIPT');
const hash = (b) => createHash('sha256').update(b).digest('hex'),
  read = (p) => fs.readFile(path.join(root, p)),
  git = (p) =>
    execFileSync('git', ['show', baseline + ':' + p], {
      cwd: root,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      maxBuffer: 20 * 1024 * 1024,
    }),
  checks = [];
function check(name, value) {
  checks.push({ name, passed: !!value });
  if (!value) throw Error(name);
}
const base = 'https://raw.githubusercontent.com/mekhovov/revealline/',
  prefix = base + 'main/authoring/fpv-worlds/published/',
  legacy = prefix + 'index.json',
  oldURL = prefix + 'surface-coating-v1/index.json',
  newURL = prefix + 'ground-motion-v1/index.json';
const lib = 'optional-practice/civilian-fpv/world-library.mjs',
  worker = 'optional-practice/worker-source.mjs';
const expectedLibrary = git(lib)
  .toString()
  .replace(
    '// This endpoint only publishes packs supported by the surface-coating-v1 runtime.\n// The original index remains compatible with already cached older players.',
    '// This cohort supports ground motion support-v1 and surface-coating-v1.\n// Both older indexes retain their cached-runtime-compatible content.',
  )
  .replace('published/surface-coating-v1/index.json', 'published/ground-motion-v1/index.json');
check(
  'Readable Library differs only by reviewed endpoint/comments',
  (await read(lib)).toString() === expectedLibrary,
);
check(
  'Readable Worker differs only by exact index URL',
  (await read(worker)).toString() === git(worker).toString().replace(oldURL, newURL),
);
const module = await import(pathToFileURL(path.join(root, lib))),
  { installPracticeWorker } = await import(
    pathToFileURL(path.join(root, 'optional-practice/worker-template.mjs'))
  ),
  { installPracticeWorker: installParentWorker } = await import(
    'data:text/javascript;base64,' + git('optional-practice/worker-template.mjs').toString('base64')
  );
const inheritedRows = module.worldLibraryIndex(
    git('authoring/fpv-worlds/published/surface-coating-v1/index.json'),
  ),
  sameInheritedRows = (rows) => JSON.stringify(rows) === JSON.stringify(inheritedRows),
  feeds = [];
for (const name of ['index.json', 'surface-coating-v1/index.json', 'ground-motion-v1/index.json']) {
  const file = 'authoring/fpv-worlds/published/' + name,
    bytes = await read(file);
  feeds.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
  check(
    'Strict v1 parser accepts expected rows in ' + name,
    module.worldLibraryIndex(bytes).length === (name === 'index.json' ? 0 : inheritedRows.length),
  );
  if (name !== 'ground-motion-v1/index.json')
    check('Older feed exact ' + name, bytes.equals(git(file)));
}
check(
  'New feed copies the complete eligible surface-coating catalogue byte-exact',
  feeds[2].bytes === feeds[1].bytes && feeds[2].sha256 === feeds[1].sha256,
);
const cumulative = module.worldLibraryIndex(
  await read('authoring/fpv-worlds/published/ground-motion-v1/index.json'),
);
check(
  'Cohort retains every inherited compatible row with no additions or identity changes',
  sameInheritedRows(cumulative),
);
check(
  'Inherited catalogue retains the exact published Reservoir revision',
  cumulative.length >= 1 &&
    cumulative[0].id === 'mountain-reservoir' &&
    cumulative[0].revision === 'r16' &&
    cumulative[0].commit === 'ea57d2e321896ab873c2ca6ca06791a88362a674' &&
    cumulative[0].sha256 === '50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554' &&
    cumulative[0].bytes === 1379988 &&
    cumulative[0].courses === 8,
);
check(
  'Dropped inherited entry is refused by the identity comparison',
  !sameInheritedRows(inheritedRows.slice(1)),
);
check(
  'Changed inherited entry is refused by the identity comparison',
  !sameInheritedRows(
    inheritedRows.map((row, index) => (index === 0 ? { ...row, sha256: '0'.repeat(64) } : row)),
  ),
);
const row = {
  id: 'cohort-diagnostic',
  title: ['Diagnostic', 'Діагностика'],
  revision: 'r1',
  commit: '1'.repeat(40),
  path: 'authoring/fpv-worlds/diagnostic/distribution/r1/diagnostic.r1.rlpack',
  sha256: '2'.repeat(64),
  bytes: 3,
  courses: 1,
};
const encoded = (x) => new TextEncoder().encode(JSON.stringify(x));
check(
  'Existing row derives fixed immutable URL',
  module.worldLibraryIndex(encoded({ format: 'FPVWorldLibrary.v1', worlds: [row] }))[0].url ===
    base + row.commit + '/' + row.path,
);
for (const [name, edit] of [
  ['unknown capability key', (r) => ({ ...r, capability: 'support-v1' })],
  ['mutable commit', (r) => ({ ...r, commit: 'main' })],
  ['arbitrary URL field', (r) => ({ ...r, url: 'https://example.test/a' })],
  ['path traversal', (r) => ({ ...r, path: 'authoring/fpv-worlds/../x.rlpack' })],
]) {
  let rejected = false;
  try {
    module.worldLibraryIndex(encoded({ format: 'FPVWorldLibrary.v1', worlds: [edit(row)] }));
  } catch {
    rejected = true;
  }
  check('Closed schema rejects ' + name, rejected);
}
const catalogue = await read('authoring/fpv-worlds/published/ground-motion-v1/index.json'),
  oldWorker = await fs.readFile(
    path.join(oldPlayer, 'optional-practice/fpv-worlds/worker.js'),
    'utf8',
  );
async function request(kind, data, response = { body: catalogue, status: 200 }) {
  const fetched = [],
    events = [];
  let receive, resolve, reject;
  const done = new Promise((a, b) => {
      resolve = a;
      reject = b;
    }),
    timer = setTimeout(() => reject(Error('Bounded source worker completion timeout')), 1000);
  const scope = {
    crypto: globalThis.crypto,
    addEventListener(type, fn) {
      if (type === 'message') receive = fn;
    },
    postMessage(value) {
      events.push(value.type);
      if (value.type !== 'world-progress') resolve(value);
    },
    async fetch(url, options) {
      fetched.push({
        url,
        credentials: options.credentials,
        redirect: options.redirect,
        cache: options.cache,
      });
      return new Response(response.body, { status: response.status });
    },
  };
  try {
    if (kind === 'old')
      vm.runInNewContext(oldWorker, { self: scope, AbortController, Uint8Array, URL });
    else if (kind === 'parent') installParentWorker(scope, [], 'manual-parent-source');
    else installPracticeWorker(scope, [], 'manual-source');
    receive({ data: { type: 'world-read', ...data } });
    const result = await done;
    return {
      fetched,
      events,
      type: result.type,
      bytes: result.bytes ? Array.from(result.bytes) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
const cases = [];
for (const [kind, allowed, denied] of [
  ['old', oldURL, newURL],
  ['parent', oldURL, newURL],
  ['new', newURL, oldURL],
]) {
  const yes = await request(kind, { url: allowed, bytes: 8192 });
  cases.push({ kind, name: 'own index', ...yes });
  check(
    kind + ' exact index accepted',
    yes.type === 'world-done' &&
      yes.fetched.length === 1 &&
      Buffer.from(yes.bytes).equals(catalogue),
  );
  check(
    kind + ' index request policy exact',
    yes.fetched[0].credentials === 'omit' &&
      yes.fetched[0].redirect === 'error' &&
      yes.fetched[0].cache === 'no-store',
  );
  for (const [name, url] of [
    ['other cohort', denied],
    ['original feed', legacy],
    ['query', allowed + '?x=1'],
    ['fragment', allowed + '#x'],
    ['foreign origin', 'https://example.test/index.json'],
  ]) {
    const result = await request(kind, { url, bytes: 8192 });
    cases.push({ kind, name, ...result });
    check(
      kind + ' refuses ' + name + ' before fetch',
      result.type === 'world-error' && result.fetched.length === 0,
    );
  }
  for (const [name, data] of [
    ['wrong index budget', { url: allowed, bytes: 8191 }],
    ['index with digest', { url: allowed, bytes: 8192, sha256: '0'.repeat(64) }],
  ]) {
    const result = await request(kind, data);
    cases.push({ kind, name, ...result });
    check(
      kind + ' refuses ' + name + ' before fetch',
      result.type === 'world-error' && result.fetched.length === 0,
    );
  }
  const body = Uint8Array.of(1, 2, 3),
    url = base + row.commit + '/' + row.path;
  const pack = await request(kind, { url, bytes: body.length, sha256: hash(body) }, { body });
  check(
    kind + ' immutable pack transport unchanged',
    pack.type === 'world-done' &&
      pack.fetched.length === 1 &&
      String(pack.bytes) === String([...body]),
  );
  const wrong = await request(kind, { url, bytes: body.length, sha256: '0'.repeat(64) }, { body });
  check(
    kind + ' wrong pack hash refused',
    wrong.type === 'world-error' && wrong.fetched.length === 1,
  );
  const failed = await request(
    kind,
    { url: allowed, bytes: 8192 },
    { body: catalogue, status: 503 },
  );
  check(
    kind + ' unavailable index refused',
    failed.type === 'world-error' && failed.fetched.length === 1,
  );
}
const inventory = JSON.parse(await fs.readFile(inventoryPath)),
  inputs = [],
  changed = [];
const policyPath = 'publishing/optional-package-policy.mjs',
  policyBytes = await read(policyPath),
  { OPTIONAL_PACKAGE_POLICIES, optionalRuntimePaths } = await import(
    pathToFileURL(path.join(root, policyPath))
  ),
  policy = OPTIONAL_PACKAGE_POLICIES['fpv-worlds'],
  expectedPaths = [
    ...new Set([
      ...policy.localFiles.map((p) => policy.root + p),
      ...policy.sharedFiles.filter((p) => p !== 'game/i18n/catalogs.mjs'),
      policy.template,
      policy.launcherTemplate,
      ...policy.localeInputs,
    ]),
  ].sort();
check('Inherited current P1 policy remains byte-exact', policyBytes.equals(git(policyPath)));
check(
  'Parent admission uses the exact inherited input policy closure',
  inventory.inputs.length === expectedPaths.length &&
    JSON.stringify(inventory.inputs.map((r) => r.path).sort()) === JSON.stringify(expectedPaths),
);
check(
  'Current Worlds policy remains128 files and20MiB',
  policy.limits.files === 128 && policy.limits.bytes === 20971520,
);
const runtimePaths = [
  ...optionalRuntimePaths(policy, { launcher: true }),
  'optional-package.json',
].sort();
check(
  'Inherited runtime paths are unique and within the unchanged128-file ceiling',
  new Set(runtimePaths).size === runtimePaths.length && runtimePaths.length <= policy.limits.files,
);
const parentInputs = [];
for (const old of inventory.inputs) {
  const original = git(old.path);
  parentInputs.push({ path: old.path, bytes: original.length, sha256: hash(original) });
  if (original.length !== old.bytes || hash(original) !== old.sha256)
    throw Error('Parent admitted input differs from exact Git baseline: ' + old.path);
  const bytes = await read(old.path),
    next = { path: old.path, bytes: bytes.length, sha256: hash(bytes) };
  inputs.push(next);
  if (next.sha256 !== old.sha256)
    changed.push({ ...next, beforeBytes: old.bytes, beforeSHA256: old.sha256 });
}
check(
  'Every inherited parent committed input matches the named admission inventory',
  parentInputs.length === expectedPaths.length,
);
check(
  'Only two generated admitted inputs change',
  changed.length === 2 &&
    changed.every((r) =>
      [
        'optional-practice/worker-template.mjs',
        'optional-practice/civilian-fpv/world-reaction-runtime.mjs',
      ].includes(r.path),
    ),
);
const total = inputs.reduce((n, r) => n + r.bytes, 0);
check('Inherited20MiB source ceiling preserved', total <= policy.limits.bytes);
await fs.writeFile(
  out,
  JSON.stringify(
    {
      format: 'GroundMotionCohortSourceContract.v3',
      baseline,
      inventoryPath,
      inventorySHA256: hash(await fs.readFile(inventoryPath)),
      oldPlayer,
      oldWorkerSHA256: hash(oldWorker),
      policySHA256: hash(policyBytes),
      checks,
      feeds,
      inheritedRows,
      cases,
      changedInputs: changed,
      inputCount: inputs.length,
      runtimeMemberCount: runtimePaths.length,
      runtimePathsSHA256: hash(JSON.stringify(runtimePaths)),
      totalSourceBytes: total,
      remainingSourceBytes: policy.limits.bytes - total,
      limitations: [
        'Manual Node parser and serialized worker request contracts with an in-memory scope and stubbed Response only; not a native Worker, HTTPS, UI, storage, offline or publication qualification.',
        'Input sum is a source measurement, not fresh package admission. No runtime limits or file policy changed.',
        'Both old feeds remain exact. The new cohort copies every compatible row from its exact named parent with no additions or identity changes. The parent catalogue must include only eligible published content. This is not observation of a newly served feed.',
      ],
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    out,
    checks: checks.length,
    pass: checks.every((c) => c.passed),
    changedInputs: changed,
    totalSourceBytes: total,
    remainingSourceBytes: policy.limits.bytes - total,
  }),
);
