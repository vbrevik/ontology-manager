#!/bin/bash
set -e

BACKEND_URL="http://localhost:5300"
USER_EMAIL="test-hardening-$(date +%s)@example.com"
USER_PASS="password123"

echo "0. Registering new test user..."
curl -s -X POST "$BACKEND_URL/api/auth/register" \
     -H "Content-Type: application/json" \
     -d "{\"username\": \"testuser_$(date +%s)\", \"email\": \"$USER_EMAIL\", \"password\": \"$USER_PASS\"}" > reg_response.json
cat reg_response.json
echo ""

echo "1. Logging in to generate audit log and session..."
# Using a dummy user from previous setups if it exists, or the default admin
# We need to capture the cookies for further requests
curl -s -c cookies.txt -X POST "$BACKEND_URL/api/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"identifier\": \"$USER_EMAIL\", \"password\": \"$USER_PASS\"}" > login_response.json

cat login_response.json
echo ""

# Extract CSRF token from cookies
CSRF_TOKEN=$(grep "csrf_token" cookies.txt | awk '{print $7}')
echo "CSRF Token: $CSRF_TOKEN"

echo "2. Fetching active sessions..."
curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" "$BACKEND_URL/api/auth/sessions" > sessions.json
cat sessions.json
echo ""

echo "3. Fetching audit logs..."
curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" "$BACKEND_URL/api/auth/audit-logs" > audit_logs.json
# Look for auth.login action
LOGIN_LOG=$(grep "auth.login" audit_logs.json || true)
if [ -n "$LOGIN_LOG" ]; then
    echo "SUCCESS: Found auth.login in audit logs."
else
    echo "FAILURE: auth.login not found in audit logs."
    cat audit_logs.json
fi
echo ""

echo "4. Testing session revocation..."
SESSION_ID=$(cat sessions.json | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")
echo "Revoking session: $SESSION_ID"

curl -s -b cookies.txt -X DELETE -H "X-CSRF-Token: $CSRF_TOKEN" "$BACKEND_URL/api/auth/sessions/$SESSION_ID" > revoke_res.txt
echo "Revoke response status check (expecting empty/no-content):"
cat revoke_res.txt
echo ""

echo "5. Verifying session is revoked in DB..."
curl -s -b cookies.txt -H "X-CSRF-Token: $CSRF_TOKEN" "$BACKEND_URL/api/auth/sessions" > sessions_after.json
STILL_THERE=$(grep "$SESSION_ID" sessions_after.json || true)
if [ -z "$STILL_THERE" ]; then
    echo "SUCCESS: Session revoked successfully."
else
    echo "FAILURE: Session still appears in active sessions."
    cat sessions_after.json
fi

# Cleanup
# rm cookies.txt login_response.json sessions.json audit_logs.json revoke_res.txt sessions_after.json
