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
import { requireMainRepositoryPolicy } from "./main-repository-policy.mjs";
import { frozenEditionOverlay, validateEditionPublication } from "../edition-promotion.mjs";
import { frozenOptionalPackageOverlay, validateOptionalPackagePublication } from "../optional-package-promotion.mjs";

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
  const editionSelectorBytes = await readOrdinary(directory, "editions.json");
  validateEditionPublication(parseJSON(editionSelectorBytes));
  const optionalSelectorBytes = await readOrdinary(directory, "optional-packages.json");
  validateOptionalPackagePublication(parseJSON(optionalSelectorBytes));
  const {
      lock,
      metadata: catalogMetadata,
      catalogSha256,
    } = await loadCatalog(directory),
    configuration = parseJSON(
      await readOrdinary(directory, "publication.json"),
    );
  requireMainRepositoryPolicy(configuration);
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
    { qualification, canonicalSites, downloadOnlyVersions } = await validateAdmissions({
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
  let releasePolicy = null;
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

  }
  return {
    configuration,
    controllerCommit,
    controllerTree,
    catalogSha256,
    qualifiedSourceTree,
    editionSelectorSha256: digest(editionSelectorBytes),
    optionalSelectorSha256: digest(optionalSelectorBytes),
    hostingPolicy: configuration.hostingPolicy,
    retainedLegacyRoutes: Object.keys(canonicalSites).length,
    downloadOnlyVersions,
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
      authority.editionSelectorSha256 !== identity.editionSelectorSha256 ||
      authority.optionalSelectorSha256 !== identity.optionalSelectorSha256 ||
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
      "Hosting: main repository only; no new archive repositories or archive authority requests.",
      `Retained legacy links: ${identity.retainedLegacyRoutes}`,
      `Download-only historical releases: ${identity.downloadOnlyVersions.length}`,
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
      receipt.editionSelectorSha256 !== identity.editionSelectorSha256 ||
      receipt.optionalSelectorSha256 !== identity.optionalSelectorSha256 ||
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
  const editionFiles = await frozenEditionOverlay(
    parseJSON(await readOrdinary(directory, "editions.json")),
    { targetBasePath: "/revealline/", resolveReleaseIdentity: (version) => ({
      sourceRevision: run("git", ["rev-parse", `${version}^{commit}`]),
      sourceTree: run("git", ["rev-parse", `${version}^{tree}`]),
    }), readReleaseAsset: (version, name, maxBytes) => downloadReleaseAsset({
      repository: "mekhovov/revealline", version, name, maxBytes,
    }) },
  );
  const optionalFiles = await frozenOptionalPackageOverlay(
    parseJSON(await readOrdinary(directory, "optional-packages.json")),
    { targetBasePath: "/revealline/", resolveReleaseIdentity: (version) => ({
      sourceRevision: run("git", ["rev-parse", `${version}^{commit}`]),
      sourceTree: run("git", ["rev-parse", `${version}^{tree}`]),
    }), readReleaseAsset: (version, name, maxBytes) => downloadReleaseAsset({
      repository: "mekhovov/revealline", version, name, maxBytes,
    }) },
  );
  const additiveFiles = new Map(editionFiles);
  for (const [name, bytes] of optionalFiles) {
    if (additiveFiles.has(name)) throw new Error("Edition and optional publication paths collide.");
    additiveFiles.set(name, bytes);
  }
  if (receipt.totalBytes + [...additiveFiles.values()].reduce((sum, bytes) => sum + bytes.length, 0) > 950_000_000)
    throw new Error("Combined default and edition site exceeds the existing Pages budget.");
  for (const [relative, bytes] of additiveFiles) {
    const target = path.join(output, "artifact", relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: "wx" });
  }
  if (additiveFiles.size) {
    receipt.files = await directoryInventory(path.join(output, "artifact"));
    receipt.totalBytes = receipt.files.reduce((sum, row) => sum + row.bytes, 0);
    if (receipt.totalBytes > 950_000_000)
      throw new Error("Combined default and edition site exceeds the existing Pages budget.");
    receipt.editionFiles = editionFiles.size;
    if (optionalFiles.size) receipt.optionalPackageFiles = optionalFiles.size;
  }
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
    "Current source qualification and complete artifact/public byte checks remain required.",
  ]);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
