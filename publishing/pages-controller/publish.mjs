#!/usr/bin/env node
/** Main-only publication of a reviewed immutable release selector. Node built-ins only. */
import * as fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assemble,
  directoryInventory,
  loadCatalog,
  readOrdinary,
  validateAdmissions,
} from "./assemble.mjs";
import {
  digest,
  jsonBytes,
  parseJSON,
  selectReleaseMetadata,
} from "./metadata.mjs";
import { publishedReleasePages, releaseDecision } from "./release-policy.mjs";
import { downloadReleaseAsset } from "./release-asset.mjs";
import { verifyArchiveAuthorities } from "./archive-authority.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const directory = path.join(root, "publishing/pages-controller");
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16_000_000,
  });
  if (result.status !== 0)
    throw new Error(`${command} ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
};
async function workflowSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${lines.join("\n")}\n`,
    );
}
async function verify({ preview = false, remote = false } = {}) {
  const {
      lock,
      metadata: catalogMetadata,
      catalogSha256,
    } = await loadCatalog(directory),
    configuration = parseJSON(
      await readOrdinary(directory, "publication.json"),
    );
  if (configuration.catalogSha256 !== catalogSha256)
    throw new Error("Frozen catalog changed.");
  const testingVersions = new Set(
      Object.keys(configuration.testingRoutes || {}),
    ),
    testingMetadata = new Map(
      [...catalogMetadata].filter(([version]) => testingVersions.has(version)),
    ),
    metadata = selectReleaseMetadata(
      new Map(
        [...catalogMetadata].filter(
          ([version]) => !testingVersions.has(version),
        ),
      ),
      configuration,
    ),
    _testingRoutesExist =
      testingMetadata.size === testingVersions.size ||
      (() => {
        throw new Error("A development testing route has no frozen metadata.");
      })(),
    { qualification, admissions } = await validateAdmissions({
      directory,
      configuration,
      metadata: new Map([...metadata, ...testingMetadata]),
      catalogMetadata,
      requireBrowser: !preview,
    });
  const actualTags = new Set(
    run("git", ["tag", "--list", "v*"])
      .split("\n")
      .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)),
  );
  if (lock.releases.some((row) => !actualTags.has(row.version)))
    throw new Error("A frozen catalog tag is missing from the repository.");
  for (const row of lock.releases) {
    if (
      run("git", ["rev-parse", row.version]) !== row.tagObject ||
      run("git", ["rev-parse", `${row.version}^{commit}`]) !==
        row.sourceRevision
    )
      throw new Error(`Frozen tag identity changed: ${row.version}`);
  }
  const qualifiedSourceTree = run("git", [
    "rev-parse",
    `${qualification.sourceRevision}^{tree}`,
  ]);
  if (qualifiedSourceTree !== qualification.sourceTree)
    throw new Error(
      "Qualified source tree does not match the immutable game commit.",
    );
  if (
    run("git", ["status", "--porcelain", "--untracked-files=no"]) ||
    run("git", ["ls-files", "publishing/pages-controller/publication.json"]) !==
      "publishing/pages-controller/publication.json"
  )
    throw new Error(
      "Publishing tools and configuration must be committed with a clean checkout.",
    );
  const controllerCommit = run("git", ["rev-parse", "HEAD"]),
    controllerTree = run("git", ["rev-parse", "HEAD^{tree}"]);
  if (
    process.env.GITHUB_EVENT_NAME !== "pull_request" &&
    process.env.GITHUB_SHA &&
    controllerCommit !== process.env.GITHUB_SHA
  )
    throw new Error(
      "Publishing checkout does not equal its triggering commit.",
    );
  const observations = [];
  let releasePolicy = null,
    authorityMetrics = null;
  if (remote) {
    if (!preview) {
      if (process.env.GITHUB_REF !== "refs/heads/main")
        throw new Error("Frozen publication must run from main.");
      releasePolicy = releaseDecision({
        configuration,
        pages: publishedReleasePages(),
        requested: process.env.REQUESTED_RELEASE || "",
      });
    }
    const qualificationAsset = await downloadReleaseAsset({
      repository: "mekhovov/revealline",
      version: configuration.currentVersion,
      name: "source-qualification.json",
    });
    if (
      digest(qualificationAsset) !==
      configuration.currentSourceQualification.sha256
    )
      throw new Error(
        "Published source qualification does not match the reviewed pin.",
      );
    let remoteAdmissions = admissions;
    if (preview && process.env.PR_BASE_SHA) {
      try {
        const base = parseJSON(
          Buffer.from(
            run("git", [
              "show",
              `${process.env.PR_BASE_SHA}:publishing/pages-controller/publication.json`,
            ]),
          ),
        );
        const previous = new Map(
          base.admissions.map((admission) => [admission.id, admission]),
        );
        remoteAdmissions = admissions.filter(
          (admission) =>
            JSON.stringify(previous.get(admission.id)) !==
            JSON.stringify(admission),
        );
      } catch (error) {
        process.stderr.write(
          `Preview base comparison failed closed to all authorities: ${error.message}\n`,
        );
      }
    }
    const authority = await verifyArchiveAuthorities({
      admissions: remoteAdmissions,
      token: process.env.GH_TOKEN,
      cacheFile: path.join(root, ".cache/frozen-pages/authority-etags.json"),
    });
    observations.push(...authority.observations);
    authorityMetrics = authority.metrics;
  }
  return {
    configuration,
    controllerCommit,
    controllerTree,
    catalogSha256,
    qualifiedSourceTree,
    admittedArchives: admissions.length,
    observations,
    authorityMetrics,
    releasePolicy,
    publishable: !preview,
  };
}
async function main() {
  const command = process.argv[2],
    preview = process.argv.includes("--preview");
  if (
    !["verify", "build", "verify-artifact"].includes(command) ||
    process.argv.slice(3).some((arg) => arg !== "--preview")
  )
    throw new Error(
      "Usage: publish.mjs verify|build|verify-artifact [--preview]",
    );
  const output = path.join(root, ".cache/frozen-pages");
  const remote = Boolean(process.env.GITHUB_ACTIONS) && command === "verify";
  let identity = await verify({ preview, remote });
  if (remote) {
    await fs.mkdir(output, { recursive: true });
    const { configuration, ...binding } = identity;
    await fs.writeFile(
      path.join(output, "authority-receipt.json"),
      jsonBytes({
        ...binding,
        currentVersion: configuration.currentVersion,
        configurationSha256: digest(
          await readOrdinary(directory, "publication.json"),
        ),
      }),
      { flag: "wx" },
    );
  } else if (process.env.GITHUB_ACTIONS) {
    const authority = parseJSON(
      await readOrdinary(output, "authority-receipt.json", 16_000_000),
      16_000_000,
    );
    if (
      authority.controllerCommit !== identity.controllerCommit ||
      authority.controllerTree !== identity.controllerTree ||
      authority.catalogSha256 !== identity.catalogSha256 ||
      authority.qualifiedSourceTree !== identity.qualifiedSourceTree ||
      authority.currentVersion !== identity.configuration.currentVersion ||
      authority.configurationSha256 !==
        digest(await readOrdinary(directory, "publication.json")) ||
      authority.publishable !== !preview
    )
      throw new Error(
        "Remote authority receipt is not bound to this publishing controller.",
      );
    identity = {
      ...identity,
      observations: authority.observations,
      authorityMetrics: authority.authorityMetrics,
      releasePolicy: authority.releasePolicy,
    };
  }
  if (command === "verify") {
    const { configuration, ...binding } = identity;
    console.log(
      JSON.stringify({
        ...binding,
        currentVersion: configuration.currentVersion,
      }),
    );
    await workflowSummary([
      "### Frozen Pages authority verification",
      "",
      `Archives remotely checked: ${identity.observations.length}`,
      `GraphQL requests: ${identity.authorityMetrics?.graphqlRequests ?? 0}`,
      `Conditional REST requests: ${identity.authorityMetrics?.restRequests ?? 0}`,
      `REST cache hits: ${identity.authorityMetrics?.cacheHits ?? 0}`,
      `Rate-limit retries: ${identity.authorityMetrics?.retries ?? 0}`,
    ]);
    return;
  }
  if (command === "verify-artifact") {
    const receipt = parseJSON(
      await readOrdinary(output, "artifact-receipt.json", 16_000_000),
      16_000_000,
    );
    if (
      receipt.controllerCommit !== identity.controllerCommit ||
      receipt.controllerTree !== identity.controllerTree ||
      receipt.qualifiedSourceTree !== identity.qualifiedSourceTree ||
      receipt.currentVersion !== identity.configuration.currentVersion ||
      receipt.catalogSha256 !== identity.catalogSha256 ||
      receipt.configurationSha256 !==
        digest(await readOrdinary(directory, "publication.json")) ||
      receipt.publishable !== !preview
    )
      throw new Error(
        "Artifact receipt is not bound to this publishing controller.",
      );
    const rows = await directoryInventory(path.join(output, "artifact"));
    if (
      JSON.stringify(rows) !== JSON.stringify(receipt.files) ||
      rows.reduce((n, row) => n + row.bytes, 0) !== receipt.totalBytes ||
      receipt.totalBytes > 950_000_000
    )
      throw new Error("Prepared artifact inventory changed.");
    console.log(
      JSON.stringify({
        status: "PASS",
        controllerCommit: identity.controllerCommit,
        gameSourceRevision: receipt.gameSourceRevision,
        files: rows.length,
        totalBytes: receipt.totalBytes,
        publishable: !preview,
      }),
    );
    await workflowSummary([
      "### Independent Pages artifact reread",
      "",
      `Files: ${rows.length}`,
      `Bytes reread: ${receipt.totalBytes}`,
    ]);
    return;
  }
  await fs.mkdir(output, { recursive: true });
  const currentSite = path.join(output, "current-site");
  run("python3", [
    path.join(directory, "extract-current.py"),
    "--metadata",
    path.join(directory, "metadata", identity.configuration.currentVersion),
    "--output",
    currentSite,
    "--receipt",
    path.join(output, "zip-receipt.json"),
  ]);
  const receipt = await assemble({
    directory,
    currentSite,
    outputDirectory: path.join(output, "artifact"),
    requireBrowser: !preview,
    extractionReceipt: parseJSON(
      await readOrdinary(output, "zip-receipt.json", 16_000_000),
      16_000_000,
    ),
  });
  const { configuration: _configuration, ...binding } = identity;
  await fs.writeFile(
    path.join(output, "artifact-receipt.json"),
    jsonBytes({ ...receipt, ...binding }),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      ...binding,
      currentVersion: receipt.currentVersion,
      gameSourceRevision: receipt.gameSourceRevision,
      totalBytes: receipt.totalBytes,
      files: receipt.files.length,
    }),
  );
  await workflowSummary([
    "### Frozen Pages assembly",
    "",
    `Files: ${receipt.files.length}`,
    `Bytes assembled: ${receipt.totalBytes}`,
    `Authority API calls: ${(identity.authorityMetrics?.graphqlRequests ?? 0) + (identity.authorityMetrics?.restRequests ?? 0)}`,
  ]);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
