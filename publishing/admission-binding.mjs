import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const POLICY_FILES = [
  '.github/workflows/deploy-pages.yml',
  'publishing/admission-binding.mjs',
  'publishing/admission-preflight.mjs',
  'publishing/focused-tests.mjs',
  'publishing/focused-test-map.json',
  'publishing/test-policy.json',
  'publishing/test-policy.mjs',
];
const sha = (value) => /^[a-f0-9]{40}$/.test(value || '');
const digest = (value) => createHash('sha256').update(value).digest('hex');

export function dependenciesOf(body = '') {
  return [
    ...new Set(
      [...String(body).matchAll(/(?:depends on|blocked by)\s+#([1-9][0-9]*)/giu)].map((match) =>
        Number(match[1]),
      ),
    ),
  ].sort((a, b) => a - b);
}

export function classification(_pull, paths) {
  if (!Array.isArray(paths) || !paths.length) throw new Error('Empty changed-path inventory.');
  // Queue admission deliberately does not restrict implementation paths. The
  // exact changed-path inventory remains in the receipt for focused testing;
  // titles, milestones, and labels cannot alter an admitted PR's class.
  return 'maintenance';
}

export function admissionBinding(pull, { workflowRevision, policyDigest, paths }) {
  if (
    !sha(pull.head?.sha) ||
    !sha(pull.base?.sha) ||
    !sha(workflowRevision) ||
    !/^[a-f0-9]{64}$/.test(policyDigest || '')
  )
    throw new Error('Exact admission identities required.');
  return {
    format: 'revealline-admission.v1',
    headSha: pull.head.sha,
    baseSha: pull.base.sha,
    workflowRevision,
    policyDigest,
    classification: classification(pull, paths),
    dependencies: dependenciesOf(pull.body),
    paths: [...new Set(paths)].sort(),
  };
}

export function sameAdmission(receipt, pull, policyDigest) {
  try {
    if (receipt.policyDigest !== policyDigest) return false;
    return (
      JSON.stringify(receipt) ===
      JSON.stringify(
        admissionBinding(pull, {
          workflowRevision: receipt.workflowRevision,
          policyDigest,
          paths: receipt.paths,
        }),
      )
    );
  } catch {
    return false;
  }
}

export async function validationPolicyDigest(root) {
  const entries = [];
  for (const name of POLICY_FILES)
    entries.push([name, digest(await readFile(path.join(root, name)))]);
  return digest(JSON.stringify(entries));
}

// Compare parsed values, not a patch substring. Any dependency or other change
// fails closed, including extra lockfile root/package fields.
export function canonicalVersionOnly(before, after, paths) {
  const expected = ['game/build-config.json', 'package-lock.json', 'package.json'];
  if (JSON.stringify([...paths].sort()) !== JSON.stringify(expected)) return false;
  try {
    const oldVersion = before['package.json'].version;
    const version = after['package.json'].version;
    if (!/^\d+\.\d+\.\d+$/.test(version) || oldVersion === version) return false;
    for (const name of expected) {
      const old = structuredClone(before[name]),
        next = structuredClone(after[name]);
      if (old.version !== oldVersion || next.version !== version) return false;
      next.version = old.version;
      if (name === 'package-lock.json') {
        if (old.packages[''].version !== oldVersion || next.packages[''].version !== version)
          return false;
        next.packages[''].version = old.packages[''].version;
      }
      if (JSON.stringify(old) !== JSON.stringify(next)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
