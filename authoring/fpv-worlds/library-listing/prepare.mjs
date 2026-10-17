import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const run = promisify(execFile);
export const ARCHIVE_SHA256 =
  "90d2cabcebd8c4647f6abced993dfb5c40f4a19bd5829a0e15c0b5bfc321f692";
export const MODULE_SHA256 =
  "6050ac77adf52c2b757b851c444a4b1430a8cbca34a9048713e540601ebcca22";
const SOURCE = "bc9bc71f192729f0661a0483d7d64609c1973343";
const MEMBER = "optional-practice/civilian-fpv/world-store.mjs";
const OWNED_FILES = {
  "index.html":
    "ee7b1343ca521480f02dbe51b022ee7ae0ea118cbad312d6ee89f9ba9d97d95c",
  "style.css":
    "0c7aef2cbbc6afaaafaf7f7a6f7875bf5fa571c1227f4b566fcf7d522541bef7",
  "harness.mjs":
    "d37599b6a90bfb1b6d8d276a905e02a5141a511c5ca226abe3b93e04bc2c4aca",
  "contract.mjs":
    "c2d819373994e2ac9e87b93fb04fe8df522d75d7a4167dcf6361a52496533f62",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function isInside(root, destination) {
  const path = relative(root, destination);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}
async function archiveHash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
export async function prepareListingContract({ archive, output }) {
  if (!archive || !output || !isAbsolute(output))
    throw new Error(
      "Supply the original archive and an absolute fresh external output directory.",
    );
  const requestedDestination = resolve(output),
    sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
  if (isInside(sourceRoot, requestedDestination))
    throw new Error(
      "Stage outside the repository; do not duplicate production bytes in source.",
    );
  try {
    await lstat(requestedDestination);
    throw new Error("Existing evidence/output must not be overwritten.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  // Resolve the existing parent before archive access, so an external alias
  // cannot stage production bytes back into this source checkout.
  const destination = resolve(
    await realpath(dirname(requestedDestination)),
    basename(requestedDestination),
  );
  if (isInside(await realpath(sourceRoot), destination))
    throw new Error(
      "Stage outside the repository; symlink destinations into source are refused.",
    );
  if ((await archiveHash(resolve(archive))) !== ARCHIVE_SHA256)
    throw new Error(
      "Expected the exact original qualified optional Worlds runtime archive.",
    );
  const { stdout } = await run(
    "python3",
    [
      "-c",
      `import sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 matches=[i for i in z.infolist() if i.filename==sys.argv[2]]
 if len(matches)!=1 or matches[0].file_size!=17516: raise ValueError('Expected one exact-size WorldStore member')
 sys.stdout.buffer.write(z.read(matches[0]))`,
      resolve(archive),
      MEMBER,
    ],
    { encoding: "buffer", maxBuffer: 32768 },
  );
  if (stdout.length !== 17516 || sha(stdout) !== MODULE_SHA256)
    throw new Error(
      "The exact 17,516-byte qualified WorldStore member is required.",
    );
  const files = new Map([["packaged-world-store.mjs", stdout]]);
  for (const [name, expected] of Object.entries(OWNED_FILES)) {
    const sourceName = name === "index.html" ? "index.html.template" : name;
    const bytes = await readFile(new URL(sourceName, import.meta.url));
    if (sha(bytes) !== expected)
      throw new Error(`Observed native harness identity changed: ${name}`);
    files.set(name, bytes);
  }
  for (const name of ["verify.mjs", "README.md"])
    files.set(name, await readFile(new URL(name, import.meta.url)));
  // Exclusive directory creation and exclusive files: failed/partial evidence is
  // preserved for inspection rather than removed or silently reused.
  await mkdir(destination);
  const members = [];
  for (const [name, bytes] of files) {
    await writeFile(resolve(destination, name), bytes, { flag: "wx" });
    members.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
  }
  const identity = {
    format: "FPVNativeListingPreparedStage.v1",
    sourceRevision: SOURCE,
    archiveSHA256: ARCHIVE_SHA256,
    originalMember: MEMBER,
    moduleSHA256: MODULE_SHA256,
    nativeObservedHarnessFilesByteIdentical: true,
    nativeEvidence:
      "docs/evidence/fpv-library-listing-native-20261016/native-receipt.json",
    nativeEvidenceReceiptSHA256:
      "175b89ed7ac8d38a3aec4095d334337ce5947c9a149779a447a630ab779e53ef",
    newStageNativeAccepted: false,
    normalPlayerAccepted: false,
    publicPersistenceAccepted: false,
    scope:
      "Preparation reproduces bytes only. The supplied-factory facade and tiny test DB are disclosed in README; a new origin/run has no inherited native acceptance. No player/default storage or runtime reconnect/migration changes.",
    files: members,
  };
  await writeFile(
    resolve(destination, "identity.json"),
    JSON.stringify(identity, null, 2) + "\n",
    { flag: "wx" },
  );
  return { output: destination, identity };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--archive" || args[2] !== "--output")
    throw new Error(
      "Usage: node prepare.mjs --archive ORIGINAL_WORLDS_RUNTIME_ZIP --output FRESH_ABSOLUTE_EXTERNAL_DIRECTORY",
    );
  console.log(
    JSON.stringify(
      await prepareListingContract({ archive: args[1], output: args[3] }),
      null,
      2,
    ),
  );
}
