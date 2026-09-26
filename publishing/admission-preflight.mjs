import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admissionBinding, validationPolicyDigest } from './admission-binding.mjs';
import { focusedTestPlan } from './focused-tests.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repository = process.env.GITHUB_REPOSITORY;
async function api(endpoint) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${endpoint}`, {
    headers: {
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
    },
  });
  if (!response.ok) throw new Error(`Admission API failed: ${response.status}`);
  return response.json();
}
const pull = await api(`pulls/${event.pull_request.number}`);
if (
  pull.head.sha !== event.pull_request.head.sha ||
  pull.base.sha !== event.pull_request.base.sha ||
  pull.title !== event.pull_request.title
)
  throw new Error('PR changed before preflight; await its new gate.');
const paths = new Set();
let count = 0;
for (let page = 1; page <= 30; page++) {
  const rows = await api(`pulls/${pull.number}/files?per_page=100&page=${page}`);
  count += rows.length;
  for (const row of rows) {
    paths.add(row.filename);
    if (row.previous_filename) paths.add(row.previous_filename);
  }
  if (rows.length < 100) break;
}
if (count !== pull.changed_files) throw new Error('Incomplete changed-file inventory.');
const receipt = admissionBinding(pull, {
  workflowRevision: process.env.WORKFLOW_REVISION,
  policyDigest: await validationPolicyDigest(root),
  paths: [...paths],
});
const plan = focusedTestPlan(
  receipt.paths,
  JSON.parse(await fs.readFile(path.join(root, 'publishing/focused-test-map.json'), 'utf8')),
  { fallbackHandled: ['release', 'release-evidence'].includes(receipt.classification) },
);
const fresh = await api(`pulls/${pull.number}`);
if (
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
await fs.writeFile(path.join(process.env.RUNNER_TEMP, 'admission.json'), JSON.stringify(receipt));
await fs.appendFile(
  process.env.GITHUB_OUTPUT,
  `mode=${receipt.classification}\nfocusedRequired=${plan.commands.length > 0}\n`,
);
