#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;
const SHA = /^[0-9a-f]{40}$/u;

export function validateFastlineInputs(value) {
  const releasePr = Number(value.releasePr);
  if (!VERSION.test(value.version || ""))
    throw new Error("version must be an exact stable vX.Y.Z value");
  if (!SHA.test(value.sourceSha || ""))
    throw new Error("source_sha must be an exact 40-character commit");
  if (!Number.isSafeInteger(releasePr) || releasePr < 1)
    throw new Error("release_pr must be a positive pull-request number");
  if (!VERSION.test(value.predecessorTag || ""))
    throw new Error("predecessor_tag must be an exact stable vX.Y.Z value");
  if (value.predecessorTag === value.version)
    throw new Error("predecessor_tag must differ from version");
  if (!["shadow", "publish", "resume"].includes(value.mode))
    throw new Error("mode must be shadow, publish, or resume");
  return {
    version: value.version,
    numericVersion: value.version.slice(1),
    sourceSha: value.sourceSha,
    releasePr,
    predecessorTag: value.predecessorTag,
    mode: value.mode,
  };
}

export function resumeDecision({ expected, actual = null, published = false }) {
  if (actual === null) return { action: "create", reason: "object is absent" };
  if (JSON.stringify(actual) === JSON.stringify(expected))
    return { action: "reuse", reason: "existing object matches exactly" };
  return {
    action: "stop",
    reason: published
      ? "published object differs and must never be overwritten"
      : "existing object differs from the exact request",
  };
}

export function fastlineStages(mode) {
  const stages = [
    "admission",
    "qualification",
    "inspection",
    "evidence",
    "publication",
    "archive",
    "pages",
    "public-verification",
  ];
  if (mode === "shadow") return stages.map((stage) => `shadow:${stage}`);
  if (mode === "resume") return stages.slice(3);
  return stages;
}

async function main() {
  const value = validateFastlineInputs({
    version: process.env.VERSION,
    sourceSha: process.env.SOURCE_SHA,
    releasePr: process.env.RELEASE_PR,
    predecessorTag: process.env.PREDECESSOR_TAG,
    mode: process.env.MODE,
  });
  process.stdout.write(`${JSON.stringify(value)}\n`);
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `numeric_version=${value.numericVersion}`,
        `release_pr=${value.releasePr}`,
        `stages=${JSON.stringify(fastlineStages(value.mode))}`,
        "",
      ].join("\n"),
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
