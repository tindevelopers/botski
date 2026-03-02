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

---

## Colleague still sees "Need admin approval" after you granted tenant consent

If you (the admin) granted **Grant admin consent for &lt;Your org&gt;** in **App registrations** but a colleague (e.g. non-admin) still sees **"Need admin approval"** for TIN Meetings:

1. **Turn off user assignment (most common fix)**  
   The Enterprise application can still require each user to be assigned. So even after API consent, only assigned users can use the app.

   - Go to **Azure Portal** → **Microsoft Entra ID** (or **Azure Active Directory**) → **Enterprise applications**.
   - Find **TIN Meetings** (search by name or by the app’s Client ID).
   - Open it → **Properties**.
   - Set **User assignment required?** to **No**.
   - **Save**.

   After this, any user in your tenant (including different domains in the same tenant, e.g. `@tin.info` and `@konnectglobal.net`) can sign in without being individually assigned.

2. **Confirm admin consent**  
   In **App registrations** → your app → **API permissions**, ensure **Grant admin consent for &lt;Your org&gt;** shows a green check for the permissions you use (e.g. User.Read, Calendars.Read, offline_access, openid, email).

---

## Still doesn’t work (same tenant or separate tenant)

If sign-in or connect still fails for both a user in your tenant and a user in another org (separate tenant), check the following.

### 1. App must be multi-tenant for other-tenant users

The authorize URL uses `login.microsoftonline.com/common`, which supports multiple tenants only if the app is multi-tenant.

- **Azure Portal** → **App registrations** → your app → **Authentication** → **Supported account types** → **Edit**.
- For users from **other organizations**, set to **"Accounts in any organizational directory (Multitenant)"** or **"Accounts in any organizational directory and personal Microsoft accounts"**.
- **Save** and wait a few minutes. Single-tenant apps only allow users from your own tenant.

### 2. Other-tenant admin must grant consent in their tenant

For a user in **Tenant B**, consent must be granted **in Tenant B**, not in your app’s tenant.

- **Option A:** Tenant B’s admin opens the admin consent URL using **their** tenant ID:
  `https://login.microsoftonline.com/<TENANT_B_ID>/adminconsent?client_id=<YOUR_CLIENT_ID>&redirect_uri=https%3A%2F%2Fmeeting.tin.info%2Foauth-callback%2Fmicrosoft-outlook`
  (Replace `<TENANT_B_ID>` with Tenant B’s directory (tenant) ID; replace `<YOUR_CLIENT_ID>` with your app’s client ID.)
- **Option B:** In **Tenant B’s** Azure Portal → **Microsoft Entra ID** → **Enterprise applications** → find your app (by name or client ID). Open it → **Permissions** → **Grant admin consent for &lt;Tenant B&gt;**. Then **Properties** → set **User assignment required?** to **No** → **Save**.

Your app appears in Tenant B’s Enterprise applications after the first sign-in attempt or when an admin in Tenant B opens the admin consent URL.

### 3. Use short-form scopes (this app)

This app requests **short-form** Microsoft Graph scopes (e.g. `Calendars.Read`, not `https://graph.microsoft.com/Calendars.Read`) to avoid “scope is not valid” in some tenants. No change needed if you’re on the latest code.

### 4. Same-tenant checklist

For users in **your** tenant:

- **App registrations** → your app → **API permissions** → **Grant admin consent for &lt;Your org&gt;** has a green check for User.Read, Calendars.Read, offline_access, openid, email.
- **Enterprise applications** → your app → **Properties** → **User assignment required?** = **No** → **Save**.
- Redirect URI in Azure exactly matches `PUBLIC_URL` + `/oauth-callback/microsoft-outlook` (e.g. `https://meeting.tin.info/oauth-callback/microsoft-outlook`), no trailing slash.

### 5. See the exact error

If the flow redirects back with an error, the callback shows it in the notice (e.g. “Microsoft sign-in failed: …”). Check server logs for token exchange errors (e.g. `invalid_grant`, `AADSTS65001`). Redirect URI mismatch and one-time use of the authorization code are the most common causes.

---

## invalid_grant (AADSTS9002313) or "request is missing" (AADSTS90014)

These often occur when exchanging the authorization code for tokens.

1. **Redirect URI must match exactly**  
   The `redirect_uri` sent in the token request must be **identical** to:
   - The redirect URI used in the sign-in link (built from `PUBLIC_URL`), and  
   - The redirect URI registered in Azure (**Authentication** → **Web** → **Redirect URIs**).

   - Ensure `PUBLIC_URL` has **no trailing slash** (e.g. `https://meeting.tin.info`, not `https://meeting.tin.info/`).
   - In Azure, the redirect URI must be exactly:  
     `https://meeting.tin.info/oauth-callback/microsoft-outlook` (or your app’s URL + `/oauth-callback/microsoft-outlook`).

2. **Code use**  
   The authorization `code` can only be used once and expires quickly. If the user refreshes the callback page or retries with the same code, you’ll get invalid_grant. Have the colleague try **Continue with Microsoft** again from a fresh sign-in.
