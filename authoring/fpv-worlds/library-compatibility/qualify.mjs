// Manual content/worker boundary qualification; not a browser or storage proof.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  inspectPack,
  inspectImport,
  preparePack,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  worldLibraryIndex,
  worldImportErrorCopy,
} from '../../../optional-practice/civilian-fpv/world-library.mjs';
import { installPracticeWorker } from '../../../optional-practice/worker-template.mjs';

const [oldPlayer, coatingPack, out] = process.argv.slice(2);
if (![oldPlayer, coatingPack, out].every((p) => p && path.isAbsolute(p)))
  throw Error('Use ABS_OLD_ADMITTED_PLAYER ABS_COATING_PACK ABS_NEW_RECEIPT');
const checks = [],
  hash = (b) => createHash('sha256').update(b).digest('hex');
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  if (!passed) throw Error(name);
}
async function rejection(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw Error('Expected rejection');
}
const old = await import(
  pathToFileURL(path.join(oldPlayer, 'optional-practice/civilian-fpv/world-content.mjs'))
);
const packBytes = await fs.readFile(coatingPack),
  sha256 = hash(packBytes);
check(
  'Exact genuine required-coating r14 pack',
  sha256 === '98dc5237b8e809029a0c08f414f36689c7a58313f911a84971d3ed0429477714',
);
const prior = Buffer.from(packBytes);
const refused = await rejection(() => old.inspectPack(packBytes));
check(
  'Old admitted importer refuses mandatory coating',
  refused.message.includes('Unsupported required extension: REVEALLINE_surface_coating'),
);
check('Old inspection did not mutate pack', packBytes.equals(prior));
const loaded = await inspectPack(packBytes);
check(
  'Capable importer retains exact pack identity',
  loaded.sha256 === sha256 && loaded.project.courses.length === 8,
);
const roundtrip = Buffer.from(
  await (await preparePack(loaded.project, { assets: loaded.assets })).arrayBuffer(),
);
check('Supported pack roundtrip byte exact', roundtrip.equals(packBytes));
const model = Buffer.from(await loaded.assets.get(loaded.project.world.modelAsset).arrayBuffer());
const jsonLength = model.readUInt32LE(12),
  base = JSON.parse(model.subarray(20, 20 + jsonLength)),
  tail = model.subarray(20 + jsonLength);
function rewrite(edit) {
  const doc = structuredClone(base);
  edit(doc);
  const json = Buffer.from(JSON.stringify(doc)),
    padding = (4 - (json.length % 4)) % 4,
    head = Buffer.alloc(20);
  model.copy(head, 0, 0, 20);
  head.writeUInt32LE(20 + json.length + padding + tail.length, 8);
  head.writeUInt32LE(json.length + padding, 12);
  return Buffer.concat([head, json, Buffer.alloc(padding, 32), tail]);
}
async function inspect(bytes) {
  return inspectImport({
    files: new Map([['case.glb', bytes]]),
    entry: 'case.glb',
    id: 'compatibility-case',
  });
}
const unknown = rewrite((doc) => {
  const name = 'REVEALLINE_future_diagnostic';
  doc.extensionsRequired.push(name);
  doc.extensionsUsed.push(name);
  (doc.extensions ??= {})[name] = { version: 1 };
});
const unsupported = await rejection(() => inspect(unknown));
check(
  'Future capability has typed refusal',
  unsupported.code === 'unsupported-world-extension' &&
    unsupported.extension === 'REVEALLINE_future_diagnostic',
);
const copy = worldImportErrorCopy(unsupported);
check(
  'EN/UK update guidance retains unsupported fallback',
  copy.length === 2 && copy[0].includes('compatible pack') && copy[1].includes('сумісний пакунок'),
);
check(
  'Guidance distinguishes prepare from update',
  copy[0].includes('Prepare offline saves the version you opened'),
);
for (const bad of ['REVEALLINE_future_diagnostic', [null], [42], [{}], [''], ['bad name']]) {
  const failure = await rejection(() =>
    inspect(
      rewrite((doc) => {
        doc.extensionsRequired = bad;
      }),
    ),
  );
  check(
    'Malformed required names are not an update request: ' + JSON.stringify(bad),
    !failure.code && !worldImportErrorCopy(failure),
  );
}
for (const bad of [
  null,
  false,
  { version: 2, kind: 'opaque-finish' },
  { version: 1, kind: 'opaque-finish', offset: -99 },
]) {
  const failure = await rejection(() =>
    inspect(
      rewrite((doc) => {
        doc.materials.find(
          (m) => m.extensions?.REVEALLINE_surface_coating,
        ).extensions.REVEALLINE_surface_coating = bad;
      }),
    ),
  );
  check(
    'Malformed known coating remains a validation error: ' + JSON.stringify(bad),
    !failure.code && !worldImportErrorCopy(failure),
  );
}
const empty = new TextEncoder().encode('{"format":"FPVWorldLibrary.v1","worlds":[]}');
check(
  'Unchanged v1 schema accepts empty capability catalogue',
  worldLibraryIndex(empty).length === 0,
);
const oldIndex =
    'https://raw.githubusercontent.com/mekhovov/revealline/main/authoring/fpv-worlds/published/index.json',
  nextIndex = oldIndex.replace('/index.json', '/surface-coating-v1/index.json');
const workerSource = await fs.readFile(
  path.join(oldPlayer, 'optional-practice/fpv-worlds/worker.js'),
  'utf8',
);
async function requestWorker(kind, url) {
  const fetched = [],
    events = [];
  let receive, resolve;
  const done = new Promise((r) => {
      resolve = r;
    }),
    scope = {
      crypto: globalThis.crypto,
      addEventListener(type, fn) {
        if (type === 'message') receive = fn;
      },
      postMessage(value) {
        events.push(value.type);
        if (value.type !== 'world-progress') resolve(value);
      },
      async fetch(value, options) {
        fetched.push({ url: value, credentials: options.credentials, redirect: options.redirect });
        return new Response(empty);
      },
    };
  if (kind === 'old')
    vm.runInNewContext(workerSource, { self: scope, AbortController, Uint8Array, URL });
  else installPracticeWorker(scope, [], 'manual');
  receive({ data: { type: 'world-read', url, bytes: 8192 } });
  const result = await done;
  return { fetched, events, type: result.type };
}
for (const [kind, allowed, denied] of [
  ['old', oldIndex, nextIndex],
  ['new', nextIndex, oldIndex],
]) {
  const yes = await requestWorker(kind, allowed),
    no = await requestWorker(kind, denied);
  check(
    kind + ' dedicated worker permits only its exact catalogue endpoint',
    yes.type === 'world-done' &&
      yes.fetched.length === 1 &&
      no.type === 'world-error' &&
      no.fetched.length === 0,
  );
  check(
    kind + ' catalogue request preserves no credentials/redirect contract',
    yes.fetched[0].credentials === 'omit' && yes.fetched[0].redirect === 'error',
  );
}
await fs.writeFile(
  out,
  JSON.stringify(
    {
      format: 'FPVLibraryCompatibilityManual.v1',
      checks,
      pack: { path: coatingPack, bytes: packBytes.length, sha256 },
      oldPlayer,
      oldRefusal: refused.message,
      limits: [
        'Node content and serialized dedicated-worker request boundaries only. Native UI, storage retention and launcher update flow require separate browser observations. No final-world presentation claim.',
      ],
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify({ checks: checks.length, passed: checks.every((c) => c.passed), out }));
