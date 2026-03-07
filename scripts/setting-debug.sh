#!/bin/bash

find_available_port() {
  while :; do
    PORT=$(( (RANDOM % 10000) + 30000 ))
    (echo > /dev/tcp/localhost/$PORT) >/dev/null 2>&1 || break
  done
  echo "$PORT"
}

DEBUG_PORT=$(find_available_port)

LAUNCH_FILE_PATH="./.vscode/launch.json"

mkdir -p "$(dirname "$LAUNCH_FILE_PATH")"

cat > "$LAUNCH_FILE_PATH" <<EOL
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to NestJS",
      "type": "node",
      "request": "attach",
      "port": $DEBUG_PORT,
      "address": "localhost",
      "restart": true,
      "timeout": 30000,
      "localRoot": "\${workspaceFolder}",
      "remoteRoot": "/",
      "skipFiles": ["<node_internals>/**"],
      "sourceMaps": true,
      "outFiles": ["\${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
EOL

sed -i '/^DEBUG_PORT=/d' .env
echo "DEBUG_PORT=${DEBUG_PORT}" >> .env

echo "Generated launch.json with port $DEBUG_PORT at $LAUNCH_FILE_PATH"
