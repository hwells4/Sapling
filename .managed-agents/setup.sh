#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Managed Agents setup for SaplingOS (${MANAGED_AGENTS_BOOT_MODE:-unknown})"

if ! python3 -c 'import yaml' >/dev/null 2>&1; then
  echo "Installing Python dependency: PyYAML"
  python3 -m pip install --user 'PyYAML==6.0.2'
fi

if [ -f ".pi/npm/package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "Installing Pi npm packages"
    (cd .pi/npm && npm ci --no-audit --no-fund)
  else
    echo "npm is required for Pi package installation but was not found" >&2
    exit 1
  fi
fi

echo "Managed Agents setup complete"
