import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const route = (value) =>
  typeof value === "string" &&
  /^\/[a-zA-Z0-9_./-]+\/$/.test(value) &&
  !value.startsWith("//") &&
  !value.split("/").some((part) => [".", ".."].includes(part));
export async function prepareDiagnosticHost({ player, output, base }) {
  if (!route(base) || !base.endsWith("/optional-practice/fpv-worlds/"))
    throw new Error(
      "Use the frozen player’s absolute same-origin directory path as --base.",
    );
  const destination = resolve(output),
    identity = `${destination}.identity.json`;
  for (const path of [destination, identity]) {
    try {
      await access(path);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    throw new Error("Existing evidence must not be overwritten.");
  }
  const source = await readFile(player),
    text = source.toString("utf8"),
    entry = 'src="../civilian-fpv/world-app.mjs"';
  if (
    text.split(entry).length !== 2 ||
    /<base\b/i.test(text) ||
    !text.includes("<head>")
  )
    throw new Error(
      "Expected one untouched World Studio HTML entry and no base element.",
    );
  const html = text
    .replace(
      "<head>",
      `<head>\n    <base href="${base}" />\n    <meta name="idb-diagnostic-player-module" content="../civilian-fpv/world-app.mjs" />`,
    )
    .replace(entry, 'src="/authoring/fpv-worlds/idb-ownership/host.mjs"');
  const modules = {};
  for (const name of ["observe.mjs", "host.mjs", "access.mjs", "prepare.mjs"]) {
    const bytes = await readFile(new URL(name, import.meta.url));
    modules[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  await writeFile(destination, html, { flag: "wx" });
  await writeFile(
    identity,
    JSON.stringify(
      {
        format: "FPVIDBDiagnosticHost.v1",
        playerHTML: { bytes: source.length, sha256: sha(source) },
        diagnosticHTML: { bytes: Buffer.byteLength(html), sha256: sha(html) },
        playerBase: base,
        modules,
        boundary:
          "Separate authoring HTML and explicit window/factory facade. Production members unchanged; default entry/bootstrap and function identities differ. Not exact-runtime or original-cause qualification.",
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  return { output: destination, identity };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (
    args.length !== 6 ||
    args[0] !== "--player" ||
    args[2] !== "--output" ||
    args[4] !== "--base"
  )
    throw new Error(
      "Usage: node prepare.mjs --player FROZEN_INDEX --output NEW_DIAGNOSTIC_HTML --base /frozen/site/optional-practice/fpv-worlds/",
    );
  console.log(
    JSON.stringify(
      await prepareDiagnosticHost({
        player: args[1],
        output: args[3],
        base: args[5],
      }),
    ),
  );
}
