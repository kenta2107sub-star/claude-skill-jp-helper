#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")"
exec /usr/local/bin/node node_modules/electron/cli.js .
