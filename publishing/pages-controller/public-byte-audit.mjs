#!/usr/bin/env node
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

class PermanentAuditError extends Error {}

function assertManifest(manifest) {
  if (
    !manifest ||
    manifest.publishable !== true ||
    typeof manifest.currentVersion !== "string" ||
    !Array.isArray(manifest.files) ||
    !Number.isSafeInteger(manifest.totalBytes)
  )
    throw new Error("A publishable Pages artifact receipt is required.");
  const seen = new Set();
  for (const file of manifest.files) {
    if (
      typeof file?.path !== "string" ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      file.path
        .split("/")
        .some((part) => !part || part === "." || part === "..") ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !/^[0-9a-f]{64}$/u.test(file.sha256) ||
      seen.has(file.path)
    )
      throw new Error("Pages artifact receipt contains an unsafe file row.");
    seen.add(file.path);
  }
  if (
    manifest.files.reduce((total, file) => total + file.bytes, 0) !==
    manifest.totalBytes
  )
    throw new Error("Pages artifact receipt byte total changed.");
}

function publicUrl(baseUrl, publicPath) {
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(publicPath.split("/").map(encodeURIComponent).join("/"), base);
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0)
    return Math.min(retryAfter * 1000, 30_000);
  return Math.min(500 * 2 ** attempt, 10_000);
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readResponse(response) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function fetchExact(file, { baseUrl, fetchImpl, signal, metrics }) {
  const url = publicUrl(baseUrl, file.path);
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    metrics.requests++;
    try {
      const response = await fetchImpl(url, {
        redirect: "error",
        signal,
        headers: {
          accept: "*/*",
          "cache-control": "no-cache",
          pragma: "no-cache",
          "user-agent": "revealline-public-byte-audit",
        },
      });
      if (RETRYABLE.has(response.status) && attempt < 3) {
        metrics.retries++;
        await response.body?.cancel();
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!response.ok)
        throw new PermanentAuditError(
          `${file.path}: public HTTP ${response.status}`,
        );
      const actual = await readResponse(response);
      if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256)
        throw new PermanentAuditError(
          `${file.path}: public bytes changed (${actual.bytes}/${actual.sha256}).`,
        );
      return { path: file.path, ...actual };
    } catch (error) {
      lastError = error;
      if (
        signal.aborted ||
        error instanceof PermanentAuditError ||
        attempt === 3
      )
        break;
      metrics.retries++;
      await sleep(retryDelay(null, attempt));
    }
  }
  throw lastError || new Error(`${file.path}: public audit failed.`);
}

export async function auditPublicBytes({
  manifest,
  baseUrl,
  concurrency = 8,
  fetchImpl = fetch,
  onProgress = () => {},
}) {
  assertManifest(manifest);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32)
    throw new Error("Public audit concurrency must be between 1 and 32.");
  const controller = new AbortController(),
    observations = new Array(manifest.files.length),
    metrics = { requests: 0, retries: 0, maxConcurrency: concurrency };
  let cursor = 0,
    completed = 0,
    firstError = null;
  async function worker() {
    while (!firstError) {
      const index = cursor++;
      if (index >= manifest.files.length) return;
      try {
        observations[index] = await fetchExact(manifest.files[index], {
          baseUrl,
          fetchImpl,
          signal: controller.signal,
          metrics,
        });
        completed++;
        onProgress({ completed, total: manifest.files.length });
      } catch (error) {
        if (!firstError) {
          firstError = error;
          controller.abort();
        }
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, manifest.files.length) },
      worker,
    ),
  );
  if (firstError) throw firstError;
  return {
    format: "revealline-public-byte-audit.v1",
    version: manifest.currentVersion,
    baseUrl: new URL(baseUrl).href,
    controllerCommit: manifest.controllerCommit,
    gameSourceRevision: manifest.gameSourceRevision,
    files: observations.length,
    bytes: observations.reduce((total, file) => total + file.bytes, 0),
    attempts: metrics.requests,
    retries: metrics.retries,
    failures: 0,
  };
}

async function main() {
  const [manifestPath, outputPath, baseUrl, concurrencyValue = "8"] =
    process.argv.slice(2);
  if (!manifestPath || !outputPath || !baseUrl)
    throw new Error(
      "Usage: public-byte-audit.mjs ARTIFACT_RECEIPT OUTPUT BASE_URL [CONCURRENCY]",
    );
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  let lastReported = 0;
  const receipt = await auditPublicBytes({
    manifest,
    baseUrl,
    concurrency: Number(concurrencyValue),
    onProgress({ completed, total }) {
      if (completed === total || completed - lastReported >= 100) {
        process.stderr.write(`Public audit ${completed}/${total}\n`);
        lastReported = completed;
      }
    },
  });
  await fs.writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx",
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  await main();
