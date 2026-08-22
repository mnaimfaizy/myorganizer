#!/usr/bin/env bash
#
# cPanel cron entry point for the two YouTube workers.
#
# Both endpoints are bounded and resumable: each call processes one slice of
# the User list and records a cursor, so the cron can run on a short interval
# and the job never needs to finish in a single tick. `flock` is the host-level
# guard against two ticks overlapping; the workers also hold a database lease,
# which covers a stale lock file or a second host.
#
# Usage:
#   youtube-cron.sh sync
#   youtube-cron.sh digest
#
# Required environment:
#   YOUTUBE_API_BASE_URL   e.g. https://api.example.com/api/v1
#   YOUTUBE_CRON_SECRET    shared secret for the X-Cron-Secret header
#
# Suggested cPanel schedule (>= 5 minute interval, <= 5 jobs).
# Copy this script to $HOME/bin (outside the Passenger app root). Put secrets
# in $HOME/bin/youtube-cron.env (mode 600), not on the crontab line.
# Digest is hourly so one tick cannot stack with another against the
# Stellar Plus 200-emails-per-hour cap (DIGEST_MAX_USERS_PER_RUN is 200).
#   */15 * * * * set -a; . $HOME/bin/youtube-cron.env; $HOME/bin/youtube-cron.sh sync
#   0 * * * *    set -a; . $HOME/bin/youtube-cron.env; $HOME/bin/youtube-cron.sh digest

set -euo pipefail

WORKER="${1:-}"

case "$WORKER" in
  sync | digest) ;;
  *)
    echo "usage: $0 {sync|digest}" >&2
    exit 64
    ;;
esac

: "${YOUTUBE_API_BASE_URL:?YOUTUBE_API_BASE_URL is required}"
: "${YOUTUBE_CRON_SECRET:?YOUTUBE_CRON_SECRET is required}"

LOCK_DIR="${YOUTUBE_CRON_LOCK_DIR:-${TMPDIR:-/tmp}}"
LOCK_FILE="${LOCK_DIR}/myorganizer-youtube-${WORKER}.lock"

# Non-blocking: a tick that finds the previous one still running exits quietly
# rather than queueing up behind it and pinning the shared host's process cap.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "youtube-${WORKER}: previous run still in progress, skipping" >&2
  exit 0
fi

# The endpoints take no body. The empty JSON object is for LiteSpeed on the
# Namecheap host: it answers a POST carrying no Content-Type and no body with
# its own 403 page, before the request ever reaches Node (#273).
curl --silent --show-error --fail-with-body \
  --max-time "${YOUTUBE_CRON_TIMEOUT_SECONDS:-600}" \
  -X POST "${YOUTUBE_API_BASE_URL%/}/youtube/cron/${WORKER}" \
  -H "X-Cron-Secret: ${YOUTUBE_CRON_SECRET}" \
  -H 'Content-Type: application/json' \
  --data '{}'
