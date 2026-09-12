#!/usr/bin/env python3
"""Browse and render prompt templates locally; never calls a model provider."""
import argparse
import json
from pathlib import Path
import re
import sys

CATALOG = Path(__file__).resolve().parent / "prompts/catalog.json"
SUPPLEMENTS = (CATALOG.parent / "round-06-asset-variations.json",
               CATALOG.parent / "round-07-animation-variants.json",
               CATALOG.parent / "round-08-character-collections.json",
               CATALOG.parent / "round-09-abilities-and-world.json",
               CATALOG.parent / "native-edition-workflows.json")
TOKEN = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")


def load_catalog():
    prompts = []
    for path in (CATALOG, *SUPPLEMENTS):
        prompts.extend(json.loads(path.read_text(encoding="utf-8"))["prompts"])
    ids = set()
    for item in prompts:
        if item["id"] in ids:
            raise ValueError(f"duplicate prompt ID: {item['id']}")
        ids.add(item["id"])
        used = set(TOKEN.findall(item["prompt"]))
        declared = set(item["variables"])
        if used != declared:
            raise ValueError(f"{item['id']}: declared variables differ from prompt tokens")
    return prompts


def render(item, assignments):
    values = {}
    for assignment in assignments:
        key, separator, value = assignment.partition("=")
        if not separator or not value.strip():
            raise ValueError("each --set must be NAME=nonempty value")
        if key in values:
            raise ValueError(f"duplicate assignment: {key}")
        values[key] = value
    required = set(item["variables"])
    missing, unknown = required - values.keys(), values.keys() - required
    if missing or unknown:
        raise ValueError(f"missing variables: {sorted(missing)}; unknown variables: {sorted(unknown)}")
    result = TOKEN.sub(lambda match: values[match[1]], item["prompt"])
    if "{{" in result or "}}" in result:
        raise ValueError("rendered prompt still contains template delimiters")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    listing = commands.add_parser("list", help="List matching prompt IDs and intents")
    listing.add_argument("--family")
    listing.add_argument("--type", dest="asset_type")
    for name in ("show", "render"):
        command = commands.add_parser(name)
        command.add_argument("id")
        if name == "render":
            command.add_argument("--set", action="append", default=[], metavar="NAME=VALUE")
    args = parser.parse_args()
    try:
        prompts = load_catalog()
        if args.command == "list":
            matches = [p for p in prompts if (not args.family or p["family"] == args.family)
                       and (not args.asset_type or p["asset_type"] == args.asset_type)]
            if not matches:
                raise ValueError("no prompts match those filters; run list without filters to see available values")
            for item in matches:
                print(f"{item['id']}\t{item['family']}\t{item['asset_type']}\t{item['intent']}")
        else:
            item = next((p for p in prompts if p["id"] == args.id), None)
            if item is None:
                raise ValueError(f"unknown prompt ID: {args.id}")
            if args.command == "show":
                print(json.dumps(item, ensure_ascii=False, indent=2))
            else:
                print(render(item, args.set))
        return 0
    except (OSError, ValueError, KeyError) as error:
        print(f"Prompt error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
