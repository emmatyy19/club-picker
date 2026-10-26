#!/bin/bash
# Double-click in Finder to start the personal local app.
set -e
cd "$(dirname "$0")"
trap 'status=$?; if [ "$status" -ne 0 ]; then printf "\nCould not start My Caddie. See the error above.\n"; read -r -p "Press Enter to close..."; fi' EXIT

# Finder does not necessarily inherit the terminal's Node setup.
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" --no-use
  nvm use 24 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major >= 24 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  printf 'My Caddie needs Node 22.12+ (22.x) or Node 24+. Install Node 24 and try again.\n'
  exit 1
fi

# Reopen an existing My Caddie dev server without starting a duplicate.
if page=$(curl --silent --fail --max-time 2 http://127.0.0.1:5173/); then
  if [[ "$page" == *'<title>My Caddie'* && "$page" == *'/@vite/client'* ]]; then
    open http://127.0.0.1:5173/
    exit 0
  fi
  printf 'Port 5173 is serving another page. Close that server and try again.\n'
  exit 1
fi
if [ ! -x web/node_modules/.bin/vite ]; then
  npm ci --prefix web
fi
printf '\nStarting My Caddie at http://127.0.0.1:5173/\nKeep this window open. Press Control-C to stop the app.\n\n'
npm run dev --prefix web -- --open
