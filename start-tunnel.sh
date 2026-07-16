#!/usr/bin/env bash
# Start Expo with its managed tunnel. Expo owns and cleans up the child
# tunnel process, so this script never terminates unrelated Node processes.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

exec npx expo start --tunnel --clear
