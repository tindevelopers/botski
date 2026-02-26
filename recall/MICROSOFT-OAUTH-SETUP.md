# Microsoft Outlook OAuth Setup Guide

## Domain: meeting.tin.info (and internal testers)

If your app is served at **https://meeting.tin.info** and you want **internal testers only** (no production, no per-user authorization):

1. **Redirect URI** in Azure must be exactly:
   ```
   https://meeting.tin.info/oauth-callback/microsoft-outlook
   ```
   (No trailing slash, HTTPS only.) Add this under **Authentication** → **Platform configurations** → **Web** → **Redirect URIs**.

2. **Supported account types** (for internal-only, one org):
   - Use **"Accounts in this organizational directory only (Single tenant)"** so only your org’s users can sign in.
   - You do **not** need multi-tenant unless you need other orgs or personal Microsoft accounts.

3. **No per-user authorization** (all internal users can use the app):
   - **API permissions**: Add the delegated permissions below, then click **Grant admin consent for &lt;Your org&gt;**. One-time admin consent applies to the whole tenant; users won’t be prompted to consent.
   - **Enterprise application**: After the app is used at least once, go to **Azure AD** → **Enterprise applications** → find your app by name or client ID → **Properties** → set **User assignment required?** to **No**. Then any user in your directory can use the app without being assigned.

4. **Environment**: Ensure `PUBLIC_URL=https://meeting.tin.info` where the app runs so OAuth redirects and token exchange use this domain.

No Microsoft “app approval” or AppSource submission is required for internal use; the app is tenant-internal only.

---

## Step 1: Create Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **"+ New registration"**
4. Fill in:
   - **Name**: `Recall V2 Demo` (or any name)
   - **Supported account types**:
     - **Internal testers (one org)**: **"Accounts in this organizational directory only"** (Single tenant).
     - **Multiple orgs or personal accounts**: **"Accounts in any organizational directory and personal Microsoft accounts"** (Multi-tenant)
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://meeting.tin.info/oauth-callback/microsoft-outlook` (or your deployment URL, e.g. `https://recall-recall-production.up.railway.app/oauth-callback/microsoft-outlook`)
5. Click **Register**

**If you need to change account type later:**
1. Go to **Authentication** in your app registration
2. Under **Supported account types**, click **Edit**
3. Choose single-tenant or multi-tenant as above, then **Save**

## Step 2: Get Client ID and Secret

### Get Client ID:
1. After registration, you'll see the **Overview** page
2. Copy the **Application (client) ID** - this is your `MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID`

### Create Client Secret:
1. Go to **Certificates & secrets** in the left menu
2. Click **"+ New client secret"**
3. Add a description (e.g., "Railway Production")
4. Choose expiration (12 months, 24 months, or never)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately (you won't see it again!)
   - This is your `MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET`

## Step 3: Configure API Permissions

1. Go to **API permissions** in the left menu
2. Click **"+ Add a permission"**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these **Delegated** permissions:
   - `User.Read` (sign-in and read profile; **required for Graph `/me`** — fixes "Insufficient privileges" on OAuth callback)
   - `offline_access` (refresh tokens)
   - `Calendars.Read` (calendar events)
   - `openid`, `email` (authentication)
   - `OnlineMeetings.Read`, `OnlineMeetingTranscript.Read.All`, `OnlineMeetingRecording.Read.All` (Teams meetings/recordings/transcripts, if used)
6. Click **Add permissions**
7. Click **Grant admin consent for &lt;Your org&gt;** so internal users don’t need to consent individually

### Add permissions via Azure CLI

To add all required Microsoft Graph delegated permissions in one go (requires [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) and `az login`):

```bash
# Replace with your app's Application (client) ID
export AZURE_APP_ID="your-client-id"

# From the repo root
./recall/scripts/azure-add-ms-graph-permissions.sh
```

Then grant admin consent (required for some permissions):

```bash
az ad app permission admin-consent --id "$AZURE_APP_ID"
```

Or in Azure Portal: **App registrations** → your app → **API permissions** → **Grant admin consent for &lt;Your org&gt;**.

## Step 4: Set Environment Variables in Railway

Run these commands (replace with your actual values):

```bash
railway variables --set "MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID=your-client-id-here"
railway variables --set "MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET=your-client-secret-here"
```

Or set them in Railway dashboard:
1. Go to your Railway project
2. Select the service
3. Go to **Variables** tab
4. Add:
   - `MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID` = your client ID
   - `MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET` = your client secret

## Step 5: Verify Redirect URI

The redirect URI is built from `PUBLIC_URL` + `/oauth-callback/microsoft-outlook`. Ensure Azure has that exact URI, e.g.:

- `https://meeting.tin.info/oauth-callback/microsoft-outlook`
- or `https://recall-recall-production.up.railway.app/oauth-callback/microsoft-outlook`

No trailing slash; must be HTTPS.

## Step 6: Redeploy (if needed)

Railway should automatically redeploy when you set environment variables. If not:

```bash
railway up
```

## Staging vs production (different domains)

If **staging** is at `https://meeting-assistant-v1-staging.up.railway.app` and **production** at `https://meeting.tin.info`, set `PUBLIC_URL` **per environment** so OAuth redirects and cookies use the correct domain (users stay on the same site after sign-in).

1. **Staging Railway service**: set `PUBLIC_URL=https://meeting-assistant-v1-staging.up.railway.app` (no trailing slash).
2. **Production service**: set `PUBLIC_URL=https://meeting.tin.info`.
3. **Azure**: In the same app, under **Authentication** → **Web** → **Redirect URIs**, add **both**:
   - `https://meeting.tin.info/oauth-callback/microsoft-outlook`
   - `https://meeting-assistant-v1-staging.up.railway.app/oauth-callback/microsoft-outlook`

## Troubleshooting

**Error: Application not found**
- Verify `MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID` is set correctly
- Check for typos in the client ID

**Error: Invalid redirect URI**
- Ensure redirect URI in Azure matches exactly (e.g. `https://meeting.tin.info/oauth-callback/microsoft-outlook`)
- No trailing slash
- Must be HTTPS (not HTTP)
- Must match `PUBLIC_URL` in your environment

**Error: Invalid client secret**
- Verify `MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET` is set correctly
- If secret expired, create a new one in Azure

**Error: Insufficient permissions**
- Make sure API permissions are added
- Grant admin consent if required

**Error: AADSTS50194 - Not configured as multi-tenant**
- This appears when the app is single-tenant but you need users from other orgs or personal Microsoft accounts.
- **Fix**: Go to Azure Portal → Your App → **Authentication** → **Supported account types** → **Edit** → choose **"Accounts in any organizational directory and personal Microsoft accounts"** → **Save**. Wait a few minutes, then try again.
- If you only need **internal testers** in your org, keep single-tenant and ensure admin consent is granted; no change needed.
