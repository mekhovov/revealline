#!/usr/bin/env node
import { TEAM_EVENT_SLOTS, teamEventSlot } from '../game/presentation/team-event-slots.mjs';
/** Release declaration gate, not a substitute for visual or gameplay review. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importThemeBundle } from '../game/presentation/bundle.mjs';
import { TEAM_THREAT_SLOTS, teamThreatSlot } from '../game/presentation/team-threat-slots.mjs';
import { TEAM_EFFECT_SLOTS, teamEffectSlot } from '../game/presentation/team-effect-slots.mjs';
import { TEAM_ANCHOR_SLOTS, teamAnchorSlot } from '../game/presentation/team-anchor-slots.mjs';
import { TEAM_ACTOR_SLOTS, teamActorSlot } from '../game/presentation/team-actor-slots.mjs';
import { LIMITS, presentationCoverage } from '../game/presentation/model.mjs';

export const PRODUCTION_LEDGER = 'authoring/library/fpv-field-kit/production.rltheme';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Verify the complete portable ledger before inspecting its selected revisions.
 * Historical optional sources remain valid. Evidence is checked as a declaration;
 * this function does not infer that its contents prove subjective visual quality. */
export async function checkFieldKitReadiness(ledger) {
  const { document } = await importThemeBundle(ledger, { decodeImage: null });
  const coverage = presentationCoverage(document);
  const teamSelected = coverage.rows.some((row) => teamActorSlot(row.slotId) && row.asset);
  const required = coverage.rows.filter((row) => row.required);
  if (teamSelected)
    for (const { id } of TEAM_ACTOR_SLOTS)
      if (!required.some((row) => row.slotId === id))
        required.push(
          coverage.rows.find((row) => row.slotId === id) ?? {
            slotId: id,
            stage: 'missing',
            asset: null,
            evidence: [],
          },
        );
  if (coverage.rows.some((row) => teamAnchorSlot(row.slotId) && row.asset))
    for (const { id } of TEAM_ANCHOR_SLOTS)
      if (!required.some((row) => row.slotId === id))
        required.push(
          coverage.rows.find((row) => row.slotId === id) ?? {
            slotId: id,
            stage: 'missing',
            asset: null,
            evidence: [],
          },
        );
  if (coverage.rows.some((row) => teamEffectSlot(row.slotId) && row.asset))
    for (const { id } of TEAM_EFFECT_SLOTS)
      if (!required.some((row) => row.slotId === id))
        required.push(
          coverage.rows.find((row) => row.slotId === id) ?? {
            slotId: id,
            stage: 'missing',
            asset: null,
            evidence: [],
          },
        );
  if (coverage.rows.some((row) => teamThreatSlot(row.slotId) && row.asset))
    for (const { id } of TEAM_THREAT_SLOTS)
      if (!required.some((row) => row.slotId === id))
        required.push(
          coverage.rows.find((row) => row.slotId === id) ?? {
            slotId: id,
            stage: 'missing',
            asset: null,
            evidence: [],
          },
        );
  if (coverage.rows.some((row) => teamEventSlot(row.slotId) && row.asset))
    for (const { id } of TEAM_EVENT_SLOTS)
      if (!required.some((row) => row.slotId === id))
        required.push(
          coverage.rows.find((row) => row.slotId === id) ?? {
            slotId: id,
            stage: 'missing',
            asset: null,
            evidence: [],
          },
        );
  const unresolved = required.filter(
    (row) =>
      row.stage !== 'reviewed' ||
      !row.evidence.length ||
      row.evidence.some((evidence) => !evidence.trim()),
  );
  if (unresolved.length) {
    const error = new Error(
      `Required presentation slots are not ready:\n${unresolved.map((row) => `${row.slotId}: ${row.stage}${row.asset ? ` (${row.asset.id}@${row.asset.revision})` : ''}${row.stage === 'reviewed' ? '; blank review evidence' : ''}`).join('\n')}`,
    );
    error.unresolved = unresolved;
    throw error;
  }
  return {
    format: 'revealline-production-readiness.v1',
    source: { id: document.id, revision: document.revision },
    selection: document.selection,
    requiredReviewed: required.length,
    optionalSlots: coverage.rows.length - required.length,
    coverage: coverage.counts,
    declarationOnly: true,
    limitation: 'Reviewed state and evidence declarations; no visual acceptance inferred.',
  };
}

/** Bind the result to one committed ledger and refuse an unstaged replacement. */
export async function checkCommittedFieldKitReadiness(projectRoot = root) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: projectRoot,
      maxBuffer: LIMITS.bundleBytes + 1024,
    });
  const sourceRevision = git('rev-parse', 'HEAD').toString('utf8').trim();
  const sourceTree = git('rev-parse', `${sourceRevision}^{tree}`).toString('utf8').trim();
  const ledgerPath = path.join(projectRoot, PRODUCTION_LEDGER),
    info = await fs.lstat(ledgerPath);
  if (!info.isFile() || info.size > LIMITS.bundleBytes)
    throw new Error('Production ledger must be a bounded ordinary file.');
  const ledger = await fs.readFile(ledgerPath);
  const committed = git('show', `${sourceRevision}:${PRODUCTION_LEDGER}`);
  if (!ledger.equals(committed))
    throw new Error('Production ledger differs from HEAD; commit the exact reviewed ledger first.');
  const result = await checkFieldKitReadiness(new Blob([committed]));
  return {
    ...result,
    sourceRevision,
    sourceTree,
    ledgerPath: PRODUCTION_LEDGER,
    ledgerSha256: hash(committed),
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2)
      throw new Error('Usage: node scripts/check-field-kit-readiness.mjs');
    process.stdout.write(JSON.stringify(await checkCommittedFieldKitReadiness()) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
