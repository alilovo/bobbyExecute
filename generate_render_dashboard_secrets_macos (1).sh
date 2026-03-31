#!/bin/bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed or not in PATH." >&2
  exit 1
fi

echo "=== Render Dashboard Secret Generator (macOS) ==="
echo

SESSION_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"

read -r -p "Username: " USERNAME
read -r -p "Display name: " DISPLAY_NAME

while true; do
  read -r -p "Role (viewer/operator/admin): " ROLE
  case "$ROLE" in
    viewer|operator|admin) break ;;
    *) echo "Please enter one of: viewer, operator, admin" ;;
  esac
done

echo -n "Password: "
stty -echo
read -r PASSWORD
stty echo
printf '\n'

if [ -z "$USERNAME" ] || [ -z "$DISPLAY_NAME" ] || [ -z "$PASSWORD" ]; then
  echo "Error: username, display name, and password must not be empty." >&2
  exit 1
fi

export USERNAME DISPLAY_NAME ROLE PASSWORD
OPERATOR_JSON="$(node - <<'NODE'
const { randomBytes, pbkdf2Sync } = require('node:crypto');
const username = process.env.USERNAME;
const displayName = process.env.DISPLAY_NAME;
const role = process.env.ROLE;
const password = process.env.PASSWORD;
const iterations = 120000;
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('base64url');
process.stdout.write(JSON.stringify([
  {
    username,
    displayName,
    role,
    active: true,
    passwordSalt: salt,
    passwordHash: hash,
    passwordIterations: iterations
  }
]));
NODE
)"
unset PASSWORD

OUTPUT_FILE="render_dashboard_secrets.txt"
{
  echo "DASHBOARD_SESSION_SECRET=$SESSION_SECRET"
  echo "DASHBOARD_OPERATOR_DIRECTORY_JSON=$OPERATOR_JSON"
} > "$OUTPUT_FILE"

echo
echo "Done."
echo
printf 'DASHBOARD_SESSION_SECRET=%s\n' "$SESSION_SECRET"
printf 'DASHBOARD_OPERATOR_DIRECTORY_JSON=%s\n' "$OPERATOR_JSON"
echo
echo "Saved to: $OUTPUT_FILE"
