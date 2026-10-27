import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { admissionBinding, validationPolicyDigest } from './admission-binding.mjs';
import { focusedTestPlan } from './focused-tests.mjs';
import { admissionPaths } from './admission-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exactSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const safePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  Buffer.byteLength(value) <= 4096 &&
  Buffer.from(value).toString('utf8') === value &&
  !/[\u0000-\u001f\u007f\\]/u.test(value) &&
  !value.split('/').some((part) => !part || part === '.' || part === '..');
const modes = new Map([
  ['040000', 'tree'],
  ['100644', 'blob'],
  ['100755', 'blob'],
  ['120000', 'blob'],
  ['160000', 'commit'],
]);
const MAX_TREE_ENTRIES = 100000;
const MAX_TREE_BYTES = 32 * 1024 * 1024;

/** Verify every directory's Git object identity, including the requested root.
 * A false truncated flag cannot conceal omitted or altered entries. No blobs,
 * executable source, symlink targets or submodule repositories are loaded.
 */
export function verifiedTreeLeaves(response, expectedSha) {
  if (
    !exactSha(expectedSha) ||
    response?.sha !== expectedSha ||
    response.truncated !== false ||
    !Array.isArray(response.tree) ||
    response.tree.length > MAX_TREE_ENTRIES ||
    Buffer.byteLength(JSON.stringify(response)) > MAX_TREE_BYTES
  )
    throw new Error('Incomplete or oversized Git tree inventory.');
  const nodes = new Map();
  const children = new Map([['', []]]);
  for (const row of response.tree) {
    if (
      !safePath(row?.path) ||
      !exactSha(row.sha) ||
      !modes.has(row.mode) ||
      modes.get(row.mode) !== row.type ||
      nodes.has(row.path)
    )
      throw new Error('Invalid or duplicate Git tree entry.');
    nodes.set(row.path, row);
    if (row.type === 'tree') children.set(row.path, []);
  }
  for (const row of nodes.values()) {
    const slash = row.path.lastIndexOf('/');
    const parent = slash < 0 ? '' : row.path.slice(0, slash);
    if (!children.has(parent)) throw new Error('Missing Git tree parent.');
    const name = row.path.slice(slash + 1);
    children.get(parent).push({
      ...row,
      name,
      sortKey: Buffer.from(name + (row.type === 'tree' ? '/' : '')),
    });
  }
  for (const [directory, entries] of children) {
    entries.sort((a, b) => Buffer.compare(a.sortKey, b.sortKey));
    const body = Buffer.concat(
      entries.flatMap((row) => [
        Buffer.from(row.mode.replace(/^0+/u, '') + ' ' + row.name + '\0'),
        Buffer.from(row.sha, 'hex'),
      ]),
    );
    const actual = createHash('sha1')
      .update('tree ' + body.length + '\0')
      .update(body)
      .digest('hex');
    if (actual !== (directory ? nodes.get(directory).sha : expectedSha))
      throw new Error('Git tree content identity mismatch.');
  }
  return new Map([...nodes].filter(([, row]) => row.type !== 'tree'));
}

function validatePull(pull) {
  if (
    !Number.isSafeInteger(pull?.number) ||
    pull.number < 1 ||
    !exactSha(pull.head?.sha) ||
    !exactSha(pull.base?.sha) ||
    pull.head.sha === pull.base.sha ||
    !Number.isSafeInteger(pull.changed_files) ||
    pull.changed_files < 1 ||
    pull.changed_files > 2 * MAX_TREE_ENTRIES
  )
    throw new Error('Invalid or oversized changed-file inventory.');
}

/** Return the complete changed path set, not GitHub's rename-paired row count.
 * Large PRs use verified tree metadata because the PR files endpoint stops at
 * 3000. Deleted and added endpoints of a rename are deliberately both retained.
 */
export async function completeChangedPaths(pull, { api, repository }) {
  validatePull(pull);
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/u.test(repository || ''))
    throw new Error('Exact admission repository required.');
  if (pull.changed_files <= 3000) {
    const paths = new Set();
    const filenames = new Set();
    let count = 0;
    for (let page = 1; page <= 30; page++) {
      const rows = await api('pulls/' + pull.number + '/files?per_page=100&page=' + page);
      if (!Array.isArray(rows) || rows.length > 100)
        throw new Error('Invalid changed-file response.');
      count += rows.length;
      if (count > pull.changed_files) throw new Error('Changed-file inventory exceeds PR count.');
      for (const row of rows) {
        if (
          !safePath(row?.filename) ||
          filenames.has(row.filename) ||
          (row.previous_filename !== undefined &&
            (!safePath(row.previous_filename) || row.previous_filename === row.filename)) ||
          (row.status === 'renamed' && !row.previous_filename)
        )
          throw new Error('Invalid or duplicate changed-file row.');
        filenames.add(row.filename);
        paths.add(row.filename);
        if (row.previous_filename) paths.add(row.previous_filename);
      }
      if (rows.length < 100) break;
    }
    if (count !== pull.changed_files) throw new Error('Incomplete changed-file inventory.');
    return [...paths].sort();
  }

  const base = pull.base.sha;
  const head = pull.head.sha;
  const comparisonPath = 'compare/' + base + '...' + head;
  // Files are returned only on the first comparison page. We need its pinned
  // merge-base metadata, not another truncated patch/file listing.
  const comparison = await api(comparisonPath + '?per_page=1&page=2');
  const mergeBase = comparison?.merge_base_commit?.sha;
  if (
    comparison?.url !== 'https://api.github.com/repos/' + repository + '/' + comparisonPath ||
    comparison.base_commit?.sha !== base ||
    !exactSha(mergeBase) ||
    mergeBase === head ||
    !Number.isSafeInteger(comparison.ahead_by) ||
    comparison.ahead_by < 1 ||
    !Number.isSafeInteger(comparison.behind_by) ||
    comparison.behind_by < 0 ||
    comparison.total_commits !== comparison.ahead_by ||
    !(
      (comparison.status === 'ahead' && comparison.behind_by === 0 && mergeBase === base) ||
      (comparison.status === 'diverged' && comparison.behind_by > 0 && mergeBase !== base)
    )
  )
    throw new Error('Comparison is not bound to the exact PR base and head.');

  const loadTree = async (sha) => {
    const commit = await api('git/commits/' + sha);
    if (commit?.sha !== sha || !exactSha(commit.tree?.sha))
      throw new Error('Git commit identity mismatch.');
    return verifiedTreeLeaves(
      await api('git/trees/' + commit.tree.sha + '?recursive=1'),
      commit.tree.sha,
    );
  };
  const before = await loadTree(mergeBase);
  const after = await loadTree(head);
  const paths = [];
  let added = 0;
  let removed = 0;
  let modified = 0;
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(name);
    const next = after.get(name);
    if (!old) added++;
    else if (!next) removed++;
    else if (old.sha !== next.sha || old.mode !== next.mode || old.type !== next.type) modified++;
    else continue;
    paths.push(name);
  }
  // GitHub counts a rename once; an unpaired tree diff retains both paths.
  // Pairing can reduce the count only by pairing a deletion with an addition.
  // In particular, inventories with no additions/deletions require equality.
  if (
    !paths.length ||
    pull.changed_files < modified + Math.max(added, removed) ||
    pull.changed_files > modified + added + removed
  )
    throw new Error('Git tree diff disagrees with the PR changed-file count.');
  return paths.sort();
}

export async function admissionPreflight({
  event,
  api,
  repository,
  workflowRevision,
  root: directory = root,
}) {
  const expected = event?.pull_request;
  if (
    !Number.isSafeInteger(expected?.number) ||
    expected.number < 1 ||
    !exactSha(expected.head?.sha) ||
    !exactSha(expected.base?.sha)
  )
    throw new Error('Exact event source identities required.');
  const pull = await api('pulls/' + expected?.number);
  validatePull(pull);
  if (
    pull.number !== expected?.number ||
    pull.head.sha !== expected.head?.sha ||
    pull.base.sha !== expected.base?.sha
  )
    throw new Error('PR changed before preflight; await its new gate.');
  const paths = [...(await admissionPaths(pull, api))];
  const receipt = admissionBinding(pull, {
    workflowRevision,
    policyDigest: await validationPolicyDigest(directory),
    paths,
  });
  const plan = focusedTestPlan(
    receipt.paths,
    JSON.parse(await fs.readFile(path.join(directory, 'publishing/focused-test-map.json'), 'utf8')),
    { fallbackHandled: ['release', 'release-evidence'].includes(receipt.classification) },
  );
  const fresh = await api('pulls/' + pull.number);
  if (
    fresh.number !== pull.number ||
    fresh.changed_files !== pull.changed_files ||
    JSON.stringify(receipt) !==
      JSON.stringify(
        admissionBinding(fresh, {
          workflowRevision: receipt.workflowRevision,
          policyDigest: receipt.policyDigest,
          paths: receipt.paths,
        }),
      )
  )
    throw new Error('PR changed during preflight; await its new gate.');
  return { receipt, plan };
}

export async function readAdmissionAPIResponse(response, maxBytes = MAX_TREE_BYTES) {
  if (!response.ok) throw new Error('Admission API failed: ' + response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Admission API response exceeds its byte limit.');
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function main() {
  const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repository = process.env.GITHUB_REPOSITORY;
  const api = async (endpoint) => {
    const response = await fetch('https://api.github.com/repos/' + repository + '/' + endpoint, {
      signal: AbortSignal.timeout(30000),
      headers: {
        authorization: 'Bearer ' + process.env.GH_TOKEN,
        accept: 'application/vnd.github+json',
      },
    });
    return readAdmissionAPIResponse(response);
  };
  const { receipt, plan } = await admissionPreflight({
    event,
    api,
    repository,
    workflowRevision: process.env.WORKFLOW_REVISION,
  });
  await fs.writeFile(path.join(process.env.RUNNER_TEMP, 'admission.json'), JSON.stringify(receipt));
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    'mode=' + receipt.classification + '\nfocusedRequired=' + (plan.commands.length > 0) + '\n',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
