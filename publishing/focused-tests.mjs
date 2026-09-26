#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function safeChangedPath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4096 &&
    !path.isAbsolute(value) &&
    !value.split("/").includes("..") &&
    !value.includes("\0")
  );
}

function compilePatterns(patterns) {
  if (
    !Array.isArray(patterns) ||
    patterns.some((pattern) => typeof pattern !== "string")
  )
    throw new Error("Focused-test manifest contains invalid path patterns.");
  return patterns.map((pattern) => new RegExp(pattern, "u"));
}

function validateCommand(command) {
  if (
    !command ||
    typeof command.id !== "string" ||
    !["node", "npm"].includes(command.command) ||
    !Array.isArray(command.args) ||
    command.args.some(
      (argument) => typeof argument !== "string" || argument.includes("\0"),
    )
  )
    throw new Error("Focused-test manifest contains an invalid command.");
  return command;
}

export function validateFocusedTestMap(manifest) {
  if (
    manifest?.format !== "revealline-focused-test-map.v1" ||
    !Array.isArray(manifest.categories) ||
    !manifest.categories.length ||
    !Array.isArray(manifest.fallbackCommands)
  )
    throw new Error("Invalid focused-test manifest.");
  const ids = new Set();
  const categories = manifest.categories.map((category) => {
    if (
      typeof category?.id !== "string" ||
      ids.has(category.id) ||
      !Array.isArray(category.commands) ||
      !category.commands.length
    )
      throw new Error("Focused-test manifest contains an invalid category.");
    ids.add(category.id);
    return {
      ...category,
      patterns: compilePatterns(category.pathPatterns),
      commands: category.commands.map(validateCommand),
    };
  });
  return {
    categories,
    ignoredPatterns: compilePatterns(manifest.ignoredPathPatterns || []),
    runtimePatterns: compilePatterns(manifest.runtimePathPatterns || []),
    fallbackCommands: manifest.fallbackCommands.map(validateCommand),
  };
}

export function focusedTestPlan(paths, manifest) {
  if (
    !Array.isArray(paths) ||
    !paths.length ||
    paths.some((item) => !safeChangedPath(item))
  )
    throw new Error(
      "Focused-test selection requires bounded repository-relative paths.",
    );
  const map = validateFocusedTestMap(manifest);
  const categories = map.categories.filter((category) =>
    paths.some((changed) =>
      category.patterns.some((pattern) => pattern.test(changed)),
    ),
  );
  const matched = new Set(
    paths.filter((changed) =>
      categories.some((category) =>
        category.patterns.some((pattern) => pattern.test(changed)),
      ),
    ),
  );
  const unknownRuntime = paths.filter(
    (changed) =>
      !matched.has(changed) &&
      !map.ignoredPatterns.some((pattern) => pattern.test(changed)) &&
      map.runtimePatterns.some((pattern) => pattern.test(changed)),
  );
  const commands = [...categories.flatMap((category) => category.commands)];
  if (unknownRuntime.length) commands.push(...map.fallbackCommands);

  for (const changed of paths) {
    if (!changed.endsWith(".test.mjs")) continue;
    if (
      !/^(game\/test|publishing(?:\/pages-controller)?|scripts)\//u.test(
        changed,
      )
    )
      continue;
    if (
      commands.some(
        (command) =>
          command.command === "node" &&
          command.args[0] === "--test" &&
          command.args.includes(changed),
      )
    )
      continue;
    commands.push({
      id: `changed-test:${changed}`,
      command: "node",
      args: ["--test", changed],
    });
  }

  const uniqueCommands = [
    ...new Map(commands.map((command) => [command.id, command])).values(),
  ];
  return {
    categories: categories.map((category) => category.id),
    unknownRuntime,
    commands: uniqueCommands,
  };
}

async function readManifest(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const root = path.resolve(argument("--root", "."));
  const pathsFile = argument("--paths");
  if (!pathsFile)
    throw new Error(
      "Usage: focused-tests.mjs --paths FILE [--root DIRECTORY].",
    );
  const manifest = await readManifest(
    argument("--manifest", path.join(here, "focused-test-map.json")),
  );
  const paths = (await fs.readFile(pathsFile, "utf8"))
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const plan = focusedTestPlan(paths, manifest);
  const summary = [
    "### Focused release gate",
    "",
    `Categories: ${plan.categories.join(", ") || "bounded non-runtime change"}`,
    `Commands: ${plan.commands.length}`,
  ];
  if (plan.unknownRuntime.length)
    summary.push(`Fallback validation: ${plan.unknownRuntime.join(", ")}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${summary.join("\n")}\n`,
    );
  process.stdout.write(`${summary.join("\n")}\n`);
  if (process.argv.includes("--plan-only")) {
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(
        process.env.GITHUB_OUTPUT,
        `required=${plan.commands.length > 0}\ncommands=${plan.commands.length}\n`,
      );
    }
    return;
  }
  for (const command of plan.commands) {
    process.stdout.write(
      `\n[focused:${command.id}] ${command.command} ${command.args.join(" ")}\n`,
    );
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
      env: { ...process.env, CI: "true" },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
