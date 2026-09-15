#!/bin/sh
exec env -u AGENT_BROWSER_AUTO_CONNECT -u AGENT_BROWSER_PROVIDER -u AGENT_BROWSER_PROFILE \
  -u AGENT_BROWSER_STATE -u AGENT_BROWSER_SESSION_NAME -u AGENT_BROWSER_PROXY -u AGENT_BROWSER_PROXY_BYPASS \
  -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u NO_PROXY \
  -u http_proxy -u https_proxy -u all_proxy -u no_proxy \
  /Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/agent-browser \
  --config /Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode/.cache/cross-mode/p01/public-offline-setup/agent-browser.json \
  --session p01-public-offline-cold "$@"
