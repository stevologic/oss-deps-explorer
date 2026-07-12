#!/usr/bin/env bash
#
# Keeps the production stack at https://ossde.dev in sync with origin/main.
# Safe to run repeatedly from cron, e.g.:
#
#   */5 * * * * /opt/oss-deps-explorer/deploy.sh >> /var/log/oss-deps-explorer-deploy.log 2>&1
#
# Environment overrides:
#   FORCE=1   rebuild and restart even if already up to date
#   BRANCH    branch to track (default: main)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="docker-compose.prod.yml"
LOCK_FILE="${REPO_DIR}/.deploy.lock"
EXPECTED_SERVICES=4 # caddy, api, ui, redis

log() { printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }

# Serialize runs: if another deploy is in flight, bail out quietly so an
# overlapping cron tick never produces a second concurrent build.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deploy is already running; skipping"
  exit 0
fi

cd "$REPO_DIR"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
else
  COMPOSE=(docker-compose -f "$COMPOSE_FILE")
fi

git fetch --prune origin "$BRANCH"
LOCAL_REV="$(git rev-parse HEAD)"
REMOTE_REV="$(git rev-parse "origin/${BRANCH}")"
RUNNING_SERVICES="$("${COMPOSE[@]}" ps --services --status running 2>/dev/null | grep -c . || true)"

if [[ "$LOCAL_REV" == "$REMOTE_REV" && "$RUNNING_SERVICES" -ge "$EXPECTED_SERVICES" && "${FORCE:-0}" != "1" ]]; then
  exit 0
fi

log "deploying origin/${BRANCH} (${LOCAL_REV:0:12} -> ${REMOTE_REV:0:12}, ${RUNNING_SERVICES}/${EXPECTED_SERVICES} services running)"

# Discard any local drift and pin the working tree to origin/BRANCH.
git checkout -qf -B "$BRANCH" "origin/${BRANCH}"

# Build from a pristine export of the tree, not the live repo dir. This host
# runs the deploy sandboxed, so the live dir holds paths the BuildKit context
# sender can't read -- the .git object store and agent scratch (.codex) -- and
# it walks into them regardless of .dockerignore, aborting the build with
# "error from sender: open .../<path>: permission denied". `git archive` emits
# only tracked files: no .git, no scratch, nothing unreadable to trip over.
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
git archive --format=tar "origin/${BRANCH}" | tar -x -C "$BUILD_DIR"

# Build the images in the clean context (compose project name is pinned in the
# compose file, so image tags are identical regardless of directory)...
( cd "$BUILD_DIR" && "${COMPOSE[@]}" build --pull )

# ...then start from the real repo dir so relative bind mounts (./Caddyfile)
# resolve. `up` reuses the images just built and does not rebuild.
"${COMPOSE[@]}" up -d --remove-orphans

# Wait for the API to answer before declaring success.
for _ in $(seq 1 20); do
  if "${COMPOSE[@]}" exec -T api wget -q -O /dev/null http://localhost:8080/api/config 2>/dev/null; then
    log "deployed $(git rev-parse --short HEAD); API healthy"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 3
done

log "ERROR: API failed its health check after deploy; status and recent logs follow"
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail 50 api
exit 1
