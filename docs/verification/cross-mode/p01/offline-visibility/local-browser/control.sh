#!/bin/sh
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec agent-browser --config "$BASE/agent-browser.json" --session p01-local-offline-v0571 "$@"
