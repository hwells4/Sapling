#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "SaplingOS Managed Agents session ready (${MANAGED_AGENTS_BOOT_MODE:-unknown})"
# This repository is a knowledge-system vault. It has no long-running app server to launch.
