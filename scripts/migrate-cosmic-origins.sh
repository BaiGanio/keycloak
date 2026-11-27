#!/usr/bin/env bash
# Add the Cosmic Origins import client to a realm that already exists.
#
# Why: realm import runs only when a realm is first made. The live "baiganio"
# realm on the Pi already exists, so the new client and role in
# k8s/realm/baiganio-realm.json do not reach it on their own. This script adds:
#   1. client role "cosmic-import" on "bgapi-api"
#   2. confidential client "cosmic-importer" (client credentials only,
#      audience "bgapi-api")
#   3. role "cosmic-import" on the service account of "cosmic-importer"
#
# It is safe to run twice. It changes nothing that is already correct.
# It never sets a secret: Keycloak makes one. Read it in the admin console:
#   Clients -> cosmic-importer -> Credentials.
#
# Usage, on the Pi (as the user who runs "sudo kubectl"):
#   ./scripts/migrate-cosmic-origins.sh
#
# Usage, against local Docker (from the repo root, "docker compose up -d"):
#   KC_TARGET=docker KC_ADMIN_PASSWORD=admin ./scripts/migrate-cosmic-origins.sh
#
# Settings (environment variables):
#   KC_TARGET          k3s (default) or docker
#   KC_REALM           realm to change (default: baiganio)
#   KC_ADMIN_USER      master-realm admin (default: admin)
#   KC_ADMIN_PASSWORD  admin password; if empty, kcadm asks for it (safer:
#                      the password is then not in the process list)
set -euo pipefail

TARGET="${KC_TARGET:-k3s}"
REALM="${KC_REALM:-baiganio}"
ADMIN_USER="${KC_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-}"

API_CLIENT="bgapi-api"
ROLE="cosmic-import"
CLIENT="cosmic-importer"
SA_USER="service-account-${CLIENT}"
KCADM_CONFIG="/tmp/kcadm-migrate-cosmic.config"

cd "$(dirname "$0")/.."

kcadm() {
  case "$TARGET" in
    k3s)
      sudo kubectl --namespace keycloak exec -i deployment/keycloak -- \
        /opt/keycloak/bin/kcadm.sh "$@" --config "$KCADM_CONFIG" ;;
    docker)
      docker compose exec -T keycloak \
        /opt/keycloak/bin/kcadm.sh "$@" --config "$KCADM_CONFIG" ;;
    *)
      echo "KC_TARGET must be k3s or docker, not: $TARGET" >&2
      exit 2 ;;
  esac
}

# Print one field of the first match, or nothing.
first_id() {
  kcadm get "$@" --fields id --format csv --noquotes | head -n 1 | tr -d '\r'
}

if [ -n "$ADMIN_PASSWORD" ]; then
  kcadm config credentials --server http://localhost:8080 --realm master \
    --user "$ADMIN_USER" --password "$ADMIN_PASSWORD" >/dev/null
else
  # No password given: kcadm asks for it. It needs a terminal (-t) for that,
  # and the password stays out of the process list.
  case "$TARGET" in
    k3s)
      sudo kubectl --namespace keycloak exec -it deployment/keycloak -- \
        /opt/keycloak/bin/kcadm.sh config credentials --config "$KCADM_CONFIG" \
        --server http://localhost:8080 --realm master --user "$ADMIN_USER" ;;
    docker)
      docker compose exec keycloak \
        /opt/keycloak/bin/kcadm.sh config credentials --config "$KCADM_CONFIG" \
        --server http://localhost:8080 --realm master --user "$ADMIN_USER" ;;
  esac
fi
echo "Logged in as $ADMIN_USER. Realm: $REALM."

# --- 1. Role "cosmic-import" on bgapi-api ----------------------------------
API_ID="$(first_id clients -r "$REALM" -q clientId="$API_CLIENT")"
if [ -z "$API_ID" ]; then
  echo "Client $API_CLIENT is missing in realm $REALM. Stop." >&2
  exit 1
fi

if kcadm get "clients/$API_ID/roles/$ROLE" -r "$REALM" >/dev/null 2>&1; then
  echo "Role $API_CLIENT/$ROLE exists. No change."
else
  kcadm create "clients/$API_ID/roles" -r "$REALM" \
    -s name="$ROLE" \
    -s 'description=Write Cosmic Origins catalog data (import script only)'
  echo "Created role $API_CLIENT/$ROLE."
fi

# --- 2. Client "cosmic-importer" --------------------------------------------
CLIENT_ID="$(first_id clients -r "$REALM" -q clientId="$CLIENT")"
CLIENT_SETTINGS=(
  -s 'name=Cosmic Origins import script'
  -s 'description=Client credentials only. Only the Cosmic Origins import script may write catalog data. Keycloak makes the secret; read it in the admin console.'
  -s enabled=true
  -s publicClient=false
  -s clientAuthenticatorType=client-secret
  -s standardFlowEnabled=false
  -s implicitFlowEnabled=false
  -s directAccessGrantsEnabled=false
  -s serviceAccountsEnabled=true
  -s protocol=openid-connect
)
if [ -z "$CLIENT_ID" ]; then
  kcadm create clients -r "$REALM" -s clientId="$CLIENT" "${CLIENT_SETTINGS[@]}"
  CLIENT_ID="$(first_id clients -r "$REALM" -q clientId="$CLIENT")"
  echo "Created client $CLIENT. Keycloak made its secret."
else
  # Make sure the settings are right. This does not touch the secret.
  # Note: this update adds the "service_account" scope back. Step 2b removes it.
  kcadm update "clients/$CLIENT_ID" -r "$REALM" "${CLIENT_SETTINGS[@]}"
  echo "Client $CLIENT exists. Settings checked."
fi

# Audience mapper: tokens must carry aud = bgapi-api.
MAPPER="bgapi-api audience"
if kcadm get "clients/$CLIENT_ID/protocol-mappers/models" -r "$REALM" \
    --fields name --format csv --noquotes | tr -d '\r' | grep -qx "$MAPPER"; then
  echo "Mapper '$MAPPER' exists. No change."
else
  kcadm create "clients/$CLIENT_ID/protocol-mappers/models" -r "$REALM" \
    -s "name=$MAPPER" \
    -s protocol=openid-connect \
    -s protocolMapper=oidc-audience-mapper \
    -s 'config."included.client.audience"=bgapi-api' \
    -s 'config."access.token.claim"=true' \
    -s 'config."id.token.claim"=false' \
    -s 'config."userinfo.token.claim"=false'
  echo "Created mapper '$MAPPER'."
fi

# --- 2b. Same token as the JSON import --------------------------------------
# A client made through the admin API gets the "service_account" scope. The
# JSON import does not add it. Remove it, so both give the same token.
SA_SCOPE_ID="$(kcadm get "clients/$CLIENT_ID/default-client-scopes" -r "$REALM" \
  --fields id,name --format csv --noquotes | tr -d '\r' |
  awk -F, '$2 == "service_account" { print $1 }')"
if [ -n "$SA_SCOPE_ID" ]; then
  kcadm delete "clients/$CLIENT_ID/default-client-scopes/$SA_SCOPE_ID" -r "$REALM"
  echo "Removed scope service_account from $CLIENT."
else
  echo "Scope service_account is not on $CLIENT. No change."
fi

# --- 3. Service account gets only bgapi-api -> cosmic-import -----------------
SA_ID="$(first_id users -r "$REALM" -q username="$SA_USER" -q exact=true)"
if [ -z "$SA_ID" ]; then
  echo "Service account user $SA_USER is missing. Stop." >&2
  exit 1
fi

# add-roles does nothing if the role is already there.
kcadm add-roles -r "$REALM" --uusername "$SA_USER" \
  --cclientid "$API_CLIENT" --rolename "$ROLE"
echo "Service account $SA_USER has $API_CLIENT/$ROLE."

# A service account made through the admin API also gets the realm default
# roles (account access, offline_access). The JSON import does not give them.
# Remove them: this account needs only cosmic-import.
for DEFAULT_ROLE in $(kcadm get "users/$SA_ID/role-mappings/realm" -r "$REALM" \
    --fields name --format csv --noquotes | tr -d '\r' | grep '^default-roles-' || true); do
  kcadm remove-roles -r "$REALM" --uusername "$SA_USER" --rolename "$DEFAULT_ROLE"
  echo "Removed realm role $DEFAULT_ROLE from $SA_USER."
done

# Show every bgapi-api role of the service account. Expect only cosmic-import.
SA_ROLES="$(kcadm get "users/$SA_ID/role-mappings/clients/$API_ID" -r "$REALM" \
  --fields name --format csv --noquotes | tr -d '\r' | sort | paste -sd, -)"
echo "Service account $API_CLIENT roles: $SA_ROLES"
if [ "$SA_ROLES" != "$ROLE" ]; then
  echo "WARNING: expected only $ROLE. Remove the others by hand." >&2
fi

echo "Done. Read the secret in the admin console:"
echo "  Realm $REALM -> Clients -> $CLIENT -> Credentials."
