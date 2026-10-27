/** Private migration evidence for ONE reviewed historical snapshot. Not a publisher. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, lstat, realpath, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execute = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const HISTORICAL_PRACTICE_PIN = Object.freeze({
  sourceRevision: '98ad85164737a647a00d5855cd56cc5f2e2ec610',
  sourceTree: '57e1d094b4794500323174b114c676e23808007a',
  envelopeSha256: '9bd5187f27e7cb794fd9d686a180e594c609fd0908237d21e01a6863b0159d55',
  version: 'v0.142.4',
});
export const HISTORICAL_ADMISSION_CLOSURE = Object.freeze({
  'publishing/optional-package-admission.mjs':
    'e49701a01371787b65b98b7b2d3e1986cd9beb6400b29f4e39ef9b01ce389979',
  'publishing/optional-package-policy.mjs':
    'a1ffe903f87e601bf18866a17665e8dfab12669b875d48530c661d949f31525f',
  'publishing/edition-admission.mjs':
    '936e55362766423809dcc3157d6208141e40d264fdeb3283a5778bc6cf6d4152',
  'publishing/edition-zip.mjs': '437c01641e8cf8e6e4bf201f42eab19e035f9f5919ec70417331d51ef58f56c4',
  'game/optional-practice-details.mjs':
    '6487bd845b3b96f0fea3e1ac4e7740e2a4dcb9f995798096db866a7b659362d5',
  'game/data-json.mjs': '9ce33d6173f3cba8587ed7a7f1924c66e9d9c86ffa59b37a743764ea0b01f7bd',
  'game/i18n/index.mjs': '29f40a6d92826ced1eb53283ed32e342ac6e95920abbf8d549f2d78e65b48d07',
  'game/i18n/bootstrap.mjs': '242e4791b2202d2644b91df5aa76355019890525af774ee2e795c937988b0395',
  'game/i18n/catalogs.mjs': '719c9f94aae2e4abca27e519f8e5037c774f23d181d6a320a95b11e99a74ec54',
  'game/vendor/i18next-26.4.2.min.js':
    'eb0dd6d72e8f756b90faf864853af2a17870fe97b54473b7c34494870c65901c',
  'game/presentation/theme-system.mjs':
    '317e107e509f94449050c52f1756bd8436691f0d92bb8185aed697b3ba3127d6',
  'game/editions/package-budget.mjs':
    '0b8191091e2868194ab372aca3c5d130f9b61c18db9711062fb418869138262e',
  'game/edition-context.mjs': '4c7ada4dd368e5be53979299010482c0feaed63df9908411b38f3c826e0a2401',
});
const PACKAGE_IDS = ['civilian-flight', 'civilian-fpv', 'fpv-worlds'];
const ROLES = ['manifest', 'distribution', 'sourceInventory', 'sourceArchive'];
const safePath = (value) =>
  typeof value === 'string' &&
  value.length <= 240 &&
  /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(value);

export function assertPinnedHistoricalEnvelope(bytes) {
  assert(
    Buffer.isBuffer(bytes) && bytes.length <= 1024 * 1024,
    'Bounded historical envelope required.',
  );
  const envelope = JSON.parse(bytes.toString('utf8'));
  assert.equal(
    envelope.sourceRevision,
    HISTORICAL_PRACTICE_PIN.sourceRevision,
    'Unreviewed historical commit.',
  );
  assert.equal(
    envelope.sourceTree,
    HISTORICAL_PRACTICE_PIN.sourceTree,
    'Unreviewed historical tree.',
  );
  assert.equal(envelope.version, HISTORICAL_PRACTICE_PIN.version, 'Unreviewed historical version.');
  assert.equal(
    hash(bytes),
    HISTORICAL_PRACTICE_PIN.envelopeSha256,
    'Unreviewed historical envelope.',
  );
  assert.deepEqual(envelope.packages.map((row) => row.id).sort(), PACKAGE_IDS);
  return envelope;
}

export function assertHistoricalDependencies(name, bytes) {
  assert(Object.hasOwn(HISTORICAL_ADMISSION_CLOSURE, name), 'Unknown historical executable.');
  const pending = [parse(bytes.toString(), { ecmaVersion: 'latest', sourceType: 'module' })];
  while (pending.length) {
    const node = pending.pop();
    assert(node.type !== 'ImportExpression', 'Historical admission may not load dynamic code.');
    assert(
      !(node.type === 'CallExpression' && node.callee?.name === 'require'),
      'CommonJS dependencies are not admitted.',
    );
    if (
      node.source &&
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)
    ) {
      const value = node.source.value;
      if (!['node:path', 'node:util', 'node:crypto'].includes(value)) {
        assert(
          typeof value === 'string' && value.startsWith('.'),
          'Unexpected historical dependency.',
        );
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), value));
        assert(
          Object.hasOwn(HISTORICAL_ADMISSION_CLOSURE, resolved),
          'Unpinned historical dependency.',
        );
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter((child) => child?.type));
      else if (value?.type) pending.push(value);
    }
  }
}

export function assertHistoricalClosure(files) {
  assert(files instanceof Map);
  assert.deepEqual(
    [...files.keys()].sort(),
    Object.keys(HISTORICAL_ADMISSION_CLOSURE).sort(),
    'Exact historical executable closure required.',
  );
  for (const [name, expected] of Object.entries(HISTORICAL_ADMISSION_CLOSURE)) {
    const bytes = files.get(name);
    assert(
      Buffer.isBuffer(bytes) && bytes.length <= 2 * 1024 * 1024,
      'Historical source byte limit.',
    );
    assert.equal(hash(bytes), expected, `Historical executable changed: ${name}`);
    assertHistoricalDependencies(name, bytes);
  }
}

export function assertHistoricalArtifact(pin, bytes) {
  assert(
    pin &&
      safePath(pin.path) &&
      !pin.path.includes('/') &&
      Number.isSafeInteger(pin.bytes) &&
      pin.bytes > 0 &&
      pin.bytes <= 40 * 1024 * 1024 &&
      /^[a-f0-9]{64}$/.test(pin.sha256),
    'Invalid historical artifact pin.',
  );
  assert(
    Buffer.isBuffer(bytes) && bytes.length === pin.bytes && hash(bytes) === pin.sha256,
    `Historical artifact changed: ${pin.path}`,
  );
}

export function assertHistoricalCommittedInputs(inventories, committed) {
  const verified = new Map();
  for (const inventory of inventories) {
    assert.equal(inventory.sourceRevision, HISTORICAL_PRACTICE_PIN.sourceRevision);
    assert.equal(inventory.sourceTree, HISTORICAL_PRACTICE_PIN.sourceTree);
    assert(
      Array.isArray(inventory.inputs) &&
        inventory.inputs.length > 0 &&
        inventory.inputs.length <= 256,
    );
    for (const row of inventory.inputs) {
      assert(
        safePath(row.path) &&
          Number.isSafeInteger(row.bytes) &&
          row.bytes >= 0 &&
          row.bytes <= 32 * 1024 * 1024 &&
          /^[a-f0-9]{64}$/.test(row.sha256),
        'Invalid historical committed input.',
      );
      const bytes = committed.get(row.path);
      assert(
        Buffer.isBuffer(bytes) && bytes.length === row.bytes && hash(bytes) === row.sha256,
        `Historical input differs from committed Git blob: ${row.path}`,
      );
      verified.set(row.path, { path: row.path, bytes: row.bytes, sha256: row.sha256 });
    }
  }
  return [...verified.values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function committedBlobs(names) {
  assert(names.length > 0 && names.length <= 512 && names.every(safePath));
  const output = await new Promise((resolve, reject) => {
    const child = execFile(
      'git',
      ['-C', ROOT, 'cat-file', '--batch'],
      {
        env: {},
        encoding: 'buffer',
        timeout: 30000,
        killSignal: 'SIGKILL',
        maxBuffer: 64 * 1024 * 1024,
      },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
    child.stdin.on('error', reject);
    child.stdin.end(
      names.map((name) => `${HISTORICAL_PRACTICE_PIN.sourceRevision}:${name}\n`).join(''),
    );
  });
  const files = new Map();
  let offset = 0;
  for (const name of names) {
    const end = output.indexOf(10, offset);
    assert(end >= offset, 'Missing historical Git blob header.');
    const match = output
      .subarray(offset, end)
      .toString()
      .match(/^([a-f0-9]{40}) blob (\d+)$/);
    assert(match, `Missing historical committed file: ${name}`);
    const size = Number(match[2]);
    assert(Number.isSafeInteger(size) && size <= 32 * 1024 * 1024);
    const bytes = Buffer.from(output.subarray(end + 1, end + 1 + size));
    assert.equal(bytes.length, size);
    assert.equal(output[end + 1 + size], 10);
    const gitHash = createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex');
    assert.equal(gitHash, match[1], 'Git blob framing or identity changed.');
    files.set(name, bytes);
    offset = end + size + 2;
  }
  assert.equal(offset, output.length, 'Extra historical Git blob output.');
  return files;
}

const PROGRAM = `
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=process.argv[1];
const {validateOptionalPackageAdmission}=await import(pathToFileURL(root+'/publishing/optional-package-admission.mjs'));
const envelope=JSON.parse(await readFile(root+'/artifacts/optional-packages.json','utf8'));
const result=await validateOptionalPackageAdmission(envelope,{read:pin=>readFile(root+'/artifacts/'+pin.path)});
assert.equal(result.publicEligible,false);
process.stdout.write(JSON.stringify(result));
`;

export async function admitPinnedHistoricalPractice(bundleDirectory) {
  const bundle = await realpath(bundleDirectory);
  async function readBounded(name, limit) {
    assert(safePath(name) && !name.includes('/'));
    const filename = path.join(bundle, name),
      info = await lstat(filename);
    assert(
      info.isFile() && info.size <= limit,
      'Historical artifact must be a bounded regular file.',
    );
    const bytes = await readFile(filename);
    assert(bytes.length <= limit);
    return bytes;
  }
  const envelopeBytes = await readBounded('optional-packages.json', 1024 * 1024);
  const envelope = assertPinnedHistoricalEnvelope(envelopeBytes);
  const { stdout: tree } = await execute(
    'git',
    ['-C', ROOT, 'rev-parse', `${HISTORICAL_PRACTICE_PIN.sourceRevision}^{tree}`],
    { env: {}, timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 1024 },
  ).catch((cause) => {
    throw new Error(
      `Historical Git object ${HISTORICAL_PRACTICE_PIN.sourceRevision} is unavailable or could not be read locally. This private diagnostic requires that exact committed source; it does not fetch objects or waive admission.`,
      { cause },
    );
  });
  assert.equal(tree.trim(), HISTORICAL_PRACTICE_PIN.sourceTree, 'Historical Git tree changed.');
  const admittedBytes = new Map(),
    inventories = [];
  let total = 0;
  for (const item of envelope.packages)
    for (const role of ROLES) {
      const pin = item[role],
        bytes = await readBounded(pin.path, 40 * 1024 * 1024);
      assertHistoricalArtifact(pin, bytes);
      total += bytes.length;
      assert(total <= 128 * 1024 * 1024);
      admittedBytes.set(pin.path, bytes);
      if (role === 'sourceInventory') inventories.push(JSON.parse(bytes.toString('utf8')));
    }
  const names = [
    ...new Set([
      ...Object.keys(HISTORICAL_ADMISSION_CLOSURE),
      ...inventories.flatMap((row) => row.inputs.map((input) => input.path)),
    ]),
  ];
  const committed = await committedBlobs(names);
  const closure = new Map(
    Object.keys(HISTORICAL_ADMISSION_CLOSURE).map((name) => [name, committed.get(name)]),
  );
  assertHistoricalClosure(closure);
  const inputs = assertHistoricalCommittedInputs(inventories, committed);
  const work = await mkdtemp(path.join(tmpdir(), 'practice-historical-admission-'));
  let admission;
  try {
    for (const [name, bytes] of closure) {
      const file = path.join(work, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: 'wx' });
    }
    await writeFile(path.join(work, 'package.json'), '{"type":"module"}', { flag: 'wx' });
    await mkdir(path.join(work, 'artifacts'));
    await writeFile(path.join(work, 'artifacts/optional-packages.json'), envelopeBytes, {
      flag: 'wx',
    });
    for (const [name, bytes] of admittedBytes)
      await writeFile(path.join(work, 'artifacts', name), bytes, { flag: 'wx' });
    const { stdout } = await execute(
      process.execPath,
      ['--max-old-space-size=256', '--input-type=module', '-e', PROGRAM, work],
      { env: {}, timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 65536 },
    );
    admission = JSON.parse(stdout);
    assert.equal(admission.publicEligible, false);
    for (const [name, bytes] of closure)
      assert.equal(hash(await readFile(path.join(work, name))), hash(bytes));
    for (const [name, bytes] of admittedBytes)
      assert.equal(hash(await readFile(path.join(work, 'artifacts', name))), hash(bytes));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return {
    envelopeBytes,
    envelope,
    admittedBytes,
    receipt: {
      format: 'PinnedHistoricalPracticeAdmission.v1',
      diagnosticOnly: true,
      publicEligible: false,
      ...HISTORICAL_PRACTICE_PIN,
      admission,
      committedInputsVerified: true,
      inputs,
      closure: Object.entries(HISTORICAL_ADMISSION_CLOSURE).map(([name, sha256]) => ({
        path: name,
        sha256,
      })),
      isolation:
        'Exact committed executable closure; unchanged historical policy and strict ZIP admission in 15-second env-empty Node child; 64 KiB output.',
      scope:
        'Only this historical snapshot for private migration observation. Does not alter current admission, qualify publication, approve review gates, or establish a general historical version registry.',
    },
  };
}
