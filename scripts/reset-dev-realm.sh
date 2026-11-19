#!/usr/bin/env bash
# Throw away the local-only "baiganio-dev" realm and load it fresh from
# dev/realm/baiganio-dev-realm.json. The real "baiganio" realm is not touched.
#
# Usage (from the repo root, with `docker compose up -d` running):
#   ./scripts/reset-dev-realm.sh
#
# If you replaced the bootstrap admin, pass your local admin login:
#   KC_ADMIN_USER=me KC_ADMIN_PASSWORD='...' ./scripts/reset-dev-realm.sh
set -euo pipefail

REALM="baiganio-dev"
FILE="/opt/keycloak/data/import/baiganio-dev-realm.json"
ADMIN_USER="${KC_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"

cd "$(dirname "$0")/.."

kcadm() {
  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@" \
    --config /tmp/kcadm-dev.config
}

kcadm config credentials --server http://localhost:8080 --realm master \
  --user "$ADMIN_USER" --password "$ADMIN_PASSWORD" >/dev/null

if kcadm get "realms/$REALM" >/dev/null 2>&1; then
  kcadm delete "realms/$REALM"
  echo "Deleted realm $REALM."
fi

kcadm create realms -f "$FILE"
echo "Created realm $REALM from dev/realm/baiganio-dev-realm.json."
