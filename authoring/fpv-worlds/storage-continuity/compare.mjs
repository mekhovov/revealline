import { readFile, writeFile, stat } from "node:fs/promises";
import { compareContinuitySnapshots } from "./observe.mjs";
const [beforePath, afterPath, output] = process.argv.slice(2);
if (!beforePath || !afterPath || !output)
  throw new Error(
    "Usage: node compare.mjs BEFORE.json AFTER.json NEW_COMPARISON.json",
  );
async function load(path) {
  if ((await stat(path)).size > 32 * 1024 * 1024)
    throw new Error("Snapshot exceeds 32 MiB.");
  return JSON.parse(await readFile(path, "utf8"));
}
const result = await compareContinuitySnapshots(
  await load(beforePath),
  await load(afterPath),
);
await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(
  JSON.stringify(
    {
      exactMatch: result.exactMatch,
      anyExistingDatabase: result.anyExistingDatabase,
      changedStoresOrDatabases: result.differences.length,
      output,
      scope:
        "Stored-byte comparison only; native offline/restart observations remain separate.",
    },
    null,
    2,
  ),
);
