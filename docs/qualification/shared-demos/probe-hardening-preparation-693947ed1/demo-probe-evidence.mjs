import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Byte identities complement the strict provider's semantic/source admission. */
export async function emittedEvidenceSnapshot(root, directory) {
  const manifestPath = path.resolve(root, directory, 'manifest.json');
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const auditName = manifest.auditReportPath;
  assert.ok(typeof auditName === 'string' && auditName.endsWith('.json'));
  assert.ok(!path.isAbsolute(auditName) && !auditName.split(/[\\/]/).some(part => part === '..'));
  const auditPath = path.resolve(root, auditName);
  const inventoryPath = auditPath.replace(/\.json$/, '.inventory.json');
  const pin = (name, bytes) => ({ path: path.relative(root, name), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  return {
    manifest: pin(manifestPath, manifestBytes),
    audit: pin(auditPath, await readFile(auditPath)),
    inventory: pin(inventoryPath, await readFile(inventoryPath)),
    identity: {
      inventorySHA256: manifest.inventorySHA256,
      sourceRevision: manifest.sourceRevision,
      sourceFingerprint: manifest.sourceFingerprint,
      buildInputFingerprint: manifest.buildInputFingerprint,
    },
  };
}

/** Run after browser cleanup; failure must not prevent saving the primary result. */
export async function closeOwnedPreview(preview, report, timeoutMs = 2000) {
  const started = performance.now();
  report.serverCleanup = { attempted: !!preview, complete: !preview, timeoutMs };
  if (!preview) return;
  let timer;
  try {
    preview.server.closeAllConnections();
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Preview cleanup exceeded ${timeoutMs}ms.`)), timeoutMs);
      preview.server.close(error => error ? reject(error) : resolve());
    });
    report.serverClosed = true;
    report.serverCleanup.complete = true;
  } catch (error) {
    const message = String(error?.stack ?? error).slice(0, 2048);
    report.serverClosed = false;
    report.serverCleanup.error = message;
    report.complete = false;
    report.failure ??= message;
    report.secondaryDiagnostics ??= [];
    if (report.secondaryDiagnostics.length < 8)
      report.secondaryDiagnostics.push({ stage: 'preview-close', error: message });
  } finally {
    clearTimeout(timer);
    report.serverCleanup.elapsedMs = performance.now() - started;
    report.serverCleanup.finished = new Date().toISOString();
  }
}
