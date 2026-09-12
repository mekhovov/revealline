#!/usr/bin/env python3
"""Inspect or install links to this project's versioned authoring skills."""
import argparse
import os
from pathlib import Path
import sys

SOURCE = Path(__file__).resolve().parent / "skills"
NAMES = ("xonix-theme-designer", "xonix-asset-creator", "xonix-level-designer",
         "xonix-audio-director", "xonix-pack-reviewer", "xonix-background-stylist",
         "xonix-animation-director", "xonix-character-collection", "xonix-ability-designer")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true", help="Create missing links without replacing existing paths")
    parser.add_argument("--skills-dir", type=Path,
                        default=Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))) / "skills")
    args = parser.parse_args()
    planned = []
    errors = []
    for name in NAMES:
        source, destination = SOURCE / name, args.skills_dir.expanduser() / name
        if not (source / "SKILL.md").is_file():
            errors.append(f"Missing source skill: {source}")
        elif destination.is_symlink() and destination.resolve() == source.resolve():
            print(f"Linked: {name}")
        elif destination.exists() or destination.is_symlink():
            errors.append(f"Will not replace existing path: {destination}")
        else:
            planned.append((source, destination))
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 2
    for source, destination in planned:
        if args.install:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.symlink_to(source.resolve(), target_is_directory=True)
            print(f"Installed: {destination}")
        else:
            print(f"Available to install: {source.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
