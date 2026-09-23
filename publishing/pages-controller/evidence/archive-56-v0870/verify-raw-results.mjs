import { ROOT, deployment, httpEvidence, writeJSON } from './archive56-evidence-contract.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
assert.equal(process.argv.length, 4, 'Usage: verify-raw-results.mjs ABS_HTTP_DIR ABS_ACTUAL_DEPLOYMENT_BINDING');
const binding = deployment(process.argv[3]);
const { report, ...rows } = httpEvidence(process.argv[2], binding);
const result = { status: 'PASS_INDEPENDENT_RAW_ROW_READBACK', checkedAt: new Date().toISOString(),
  archiveCommit: binding.archiveCommit, productionRunId: binding.runId, deploymentId: binding.deploymentId,
  ...rows, failed: 0,
  scope: 'Every final body/URL/MIME/size/hash reconciled with its complete raw attempt history. Initial failures and actual retries retained; no duplicate network requests.' };
writeJSON(path.join(ROOT, 'raw-results-readback.json'), result);
console.log(JSON.stringify(result));
