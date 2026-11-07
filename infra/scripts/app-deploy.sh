#!/bin/bash
# Install a release tarball, refresh secrets from SSM, restart all services, health check.
# Rolls back to the previous release if the new one doesn't come up.
#
# Usage (as root):  app-deploy <s3-uri-of-app.tar.gz> <version>
# CI runs this through SSM Run Command; the instance also runs it on first boot.
set -euo pipefail

TARBALL_URI=${1:?usage: app-deploy <s3-uri> <version>}
VERSION=${2:?usage: app-deploy <s3-uri> <version>}
KEEP_RELEASES=5

# Written by user_data: PROJECT, APP_USER, APP_BASE, DATA_DIR, WORK_DIR, CONF_DIR, SSM_PREFIX, ...
# shellcheck source=/dev/null disable=SC2154
source /etc/app-deploy.conf
export AWS_DEFAULT_REGION PROJECT

# One deploy at a time (CI vs. first-boot deploy)
exec 9>/run/app-deploy.lock
flock 9

as_app() { runuser -u "$APP_USER" -- env HOME="/home/$APP_USER" "$@"; }

RELEASE_DIR="$APP_BASE/releases/$VERSION"
CURRENT="$APP_BASE/current"
PREVIOUS=$(readlink -f "$CURRENT" 2>/dev/null || true)

# --- Unpack ----------------------------------------------------------------
echo "Deploying $VERSION from $TARBALL_URI"
TMP_TAR=$(mktemp)
trap 'rm -f "$TMP_TAR"' EXIT
aws s3 cp --only-show-errors "$TARBALL_URI" "$TMP_TAR"

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$TMP_TAR" -C "$RELEASE_DIR"

# The app resolves data/ and tmp/ relative to the repo root (packages/shared/config.js):
# point them at the persistent volume and the build workspace.
rm -rf "$RELEASE_DIR/data" "$RELEASE_DIR/tmp"
ln -s "$DATA_DIR/data" "$RELEASE_DIR/data"
ln -s "$WORK_DIR" "$RELEASE_DIR/tmp"
chown -R "$APP_USER:$APP_USER" "$RELEASE_DIR"

# --- Install production deps on the instance (native modules match its glibc) ---
(cd "$RELEASE_DIR" && as_app npm ci --omit=dev --no-audit --no-fund)

# --- Secrets: every parameter under <SSM_PREFIX>/env/ becomes an env var ------
TMP_ENV=$(mktemp)
aws ssm get-parameters-by-path --path "$SSM_PREFIX/env/" --recursive --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text |
while IFS=$'\t' read -r name value; do
  if [ -n "$name" ] && [ "$name" != "None" ]; then
    value=${value//\\/\\\\}
    printf '%s="%s"\n' "${name##*/}" "${value//\"/\\\"}"
  fi
done > "$TMP_ENV"
install -m 600 -o root -g root "$TMP_ENV" "$CONF_DIR/secrets.env"
rm -f "$TMP_ENV"

# --- Switch & restart -------------------------------------------------------
activate() {
  ln -sfn "$1" "$CURRENT.new"
  mv -T "$CURRENT.new" "$CURRENT"
  local units
  units=$(awk 'NF { print ENVIRON["PROJECT"] "-" $1 ".service" }' "$CONF_DIR/services")
  # shellcheck disable=SC2086
  systemctl restart $units
}

healthy() {
  local name port
  while read -r name port; do
    [ -z "$name" ] && continue
    if [ "$port" != "-" ]; then
      # Any HTTP response means the server is up
      local ok=""
      for _ in $(seq 1 30); do
        if curl -s -o /dev/null "http://127.0.0.1:$port/"; then ok=1; break; fi
        sleep 1
      done
      [ -n "$ok" ] || { echo "$name did not respond on port $port" >&2; return 1; }
    fi
  done < "$CONF_DIR/services"

  # Background workers have no port: make sure nothing crash-looped meanwhile
  sleep 5
  while read -r name port; do
    [ -z "$name" ] && continue
    systemctl is-active --quiet "$PROJECT-$name" || { echo "$name is not running" >&2; return 1; }
  done < "$CONF_DIR/services"
}

activate "$RELEASE_DIR"
if ! healthy; then
  while read -r name _; do
    [ -n "$name" ] && journalctl -u "$PROJECT-$name" -n 40 --no-pager >&2
  done < "$CONF_DIR/services"
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$RELEASE_DIR" ]; then
    echo "Rolling back to $(basename "$PREVIOUS")" >&2
    activate "$PREVIOUS"
  fi
  exit 1
fi
echo "$VERSION is live"

# --- Keep the newest few releases ------------------------------------------
# shellcheck disable=SC2012 # release dirs are commit SHAs, no odd characters
ls -1dt "$APP_BASE"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  [ "$old" = "$(readlink -f "$CURRENT")" ] || rm -rf "$old"
done
