#!/usr/bin/env bash
# Add all required Microsoft Graph delegated permissions to an Azure AD app registration.
# Requires: Azure CLI (az), logged in (az login).
#
# Usage:
#   AZURE_APP_ID="your-app-client-id" ./scripts/azure-add-ms-graph-permissions.sh
# Or:
#   ./scripts/azure-add-ms-graph-permissions.sh your-app-client-id
#
# After running, grant admin consent in Azure Portal (API permissions → Grant admin consent)
# or run: az ad app permission admin-consent --id "$APP_ID"

set -e

APP_ID="${AZURE_APP_ID:-$1}"
if [ -z "$APP_ID" ]; then
  echo "Usage: AZURE_APP_ID=<client-id> $0" >&2
  echo "   or: $0 <client-id>" >&2
  exit 1
fi

# Microsoft Graph resource app ID (fixed)
GRAPH_API="00000003-0000-0000-c000-000000000000"

# Delegated permission IDs (Scope) for Microsoft Graph
# See: https://learn.microsoft.com/en-us/graph/permissions-reference
# Or run: az ad sp show --id $GRAPH_API --query oauth2PermissionScopes
USER_READ="e1fe6dd8-ba31-4d61-89e7-88639da4683d"                           # User.Read - sign-in and /me
CALENDARS_READ="465a38f9-76ea-45b9-9f34-9e8b0d4b0b42"                     # Calendars.Read
ONLINE_MEETINGS_READ="9be106e1-f4e3-4df5-bdff-e4bc531cbe43"               # OnlineMeetings.Read
ONLINE_MEETING_TRANSCRIPT_READ_ALL="30b87d18-ebb1-45db-97f8-82ccb1f0190c" # OnlineMeetingTranscript.Read.All
ONLINE_MEETING_RECORDING_READ_ALL="190c2bb6-1fdd-4fec-9aa2-7d571b5e1fe3"  # OnlineMeetingRecording.Read.All

echo "Adding Microsoft Graph delegated permissions to app: $APP_ID"

az ad app permission add \
  --id "$APP_ID" \
  --api "$GRAPH_API" \
  --api-permissions \
    "$USER_READ=Scope" \
    "$CALENDARS_READ=Scope" \
    "$ONLINE_MEETINGS_READ=Scope" \
    "$ONLINE_MEETING_TRANSCRIPT_READ_ALL=Scope" \
    "$ONLINE_MEETING_RECORDING_READ_ALL=Scope"

echo "Done. Permissions added: User.Read, Calendars.Read, OnlineMeetings.Read, OnlineMeetingTranscript.Read.All, OnlineMeetingRecording.Read.All"
echo ""
echo "Next: Grant admin consent for your tenant:"
echo "  az ad app permission admin-consent --id $APP_ID"
echo ""
echo "Or in Azure Portal: App registrations → Your app → API permissions → Grant admin consent for <Your org>"
