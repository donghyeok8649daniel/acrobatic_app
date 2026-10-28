#!/usr/bin/env bash
# Read-only checks. Does not install packages, change firewall rules or purchase resources.
set -euo pipefail
case "$(uname -m)" in aarch64|arm64|x86_64) ;; *) echo 'Unsupported CPU architecture'; exit 1;; esac
command -v docker >/dev/null || { echo 'Docker is required on the Linux server'; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
if [[ ! -d /sys/module/binder_linux && ! -e /dev/binderfs && ! -e /dev/binder ]]; then
  echo 'Android binder kernel support must be installed/loaded on the server before deployment.'
  exit 1
fi
test -r assets/Iris.apk || { echo 'Verified upstream Iris.apk is required in bot/assets'; exit 1; }
test -r .env || { echo 'Private bot/.env is required'; exit 1; }
docker compose config --quiet
echo 'Preflight passed. Actual Kakao login, Iris compatibility and room delivery still require verification.'
