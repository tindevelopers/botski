# OAuth Troubleshooting Guide

## Still doesn’t work for same tenant or another tenant

- **Other-tenant users:** The app must be **multi-tenant** (Azure → App registration → Authentication → Supported account types → “Accounts in any organizational directory” or “...and personal Microsoft accounts”). For a user in Tenant B, **Tenant B’s admin** must grant consent in **Tenant B** (admin consent URL with Tenant B’s tenant ID, or Tenant B’s Azure → Enterprise applications → your app → Grant admin consent; then set User assignment required = No).
- **Same-tenant users:** In **your** tenant: App registration → API permissions → Grant admin consent; Enterprise applications → your app → Properties → User assignment required = **No**.
- **Scopes:** This app uses short-form scopes (e.g. `Calendars.Read`). Ensure Azure API permissions match (e.g. Calendars.Read delegated).
- See **MICROSOFT-OAUTH-SETUP.md** section “Still doesn’t work (same tenant or separate tenant)” for full steps.

## Colleague sees "Need admin approval" after admin granted consent

If an admin (e.g. you) has already clicked **Grant admin consent** in App registrations but another user in the same tenant still sees **"Need admin approval"** for TIN Meetings:

**Cause:** The **Enterprise application** may have **User assignment required** set to **Yes**, so only explicitly assigned users can use the app.

**Fix:**
1. Azure Portal → **Microsoft Entra ID** (or **Azure Active Directory**) → **Enterprise applications**.
2. Find **TIN Meetings** (by name or Client ID).
3. Open it → **Properties**.
4. Set **User assignment required?** to **No** → **Save**.

After this, all users in the tenant (including different domains in the same org) can sign in without being assigned.

---

## Error: invalid_grant (AADSTS9002313)

This error typically means one of these issues:

### 1. Redirect URI Mismatch (Most Common)

**Problem**: The redirect URI in Azure doesn't match exactly what the app is using.

**Solution**:
1. Go to Azure Portal → Your App Registration → **Authentication**
2. Check the redirect URI is exactly:
   ```
   https://recall-recall-production.up.railway.app/oauth-callback/microsoft-outlook
   ```
3. Make sure:
   - No trailing slash
   - Exact match (case-sensitive)
   - Platform is set to **Web**
   - HTTPS (not HTTP)

### 2. Authorization Code Expired

**Problem**: Authorization codes expire quickly (usually within 5-10 minutes).

**Solution**: Try connecting again immediately after clicking "Connect".

### 3. Code Already Used

**Problem**: Authorization codes can only be used once.

**Solution**: If you refresh the callback page or try again, you need to start fresh by clicking "Connect" again.

### 4. Missing Code Parameter

**Problem**: The callback URL doesn't include the `code` parameter.

**Check**: Look at the browser URL when redirected back. It should look like:
```
https://recall-recall-production.up.railway.app/oauth-callback/microsoft-outlook?code=...&state=...
```

If the `code` parameter is missing, check:
- Redirect URI configuration in Azure
- Network/firewall issues
- Browser blocking redirects

## Debugging Steps

1. **Check Railway Logs**:
   ```bash
   railway logs --tail 50
   ```
   Look for: "Received microsoft oauth callback" - check if code is undefined

2. **Verify Environment Variables**:
   ```bash
   railway variables | grep MICROSOFT
   ```
   Ensure both CLIENT_ID and CLIENT_SECRET are set

3. **Check Azure Configuration**:
   - Redirect URI matches exactly
   - API permissions are granted
   - Admin consent is granted (if required)

4. **Test the Flow**:
   - Clear browser cache/cookies
   - Try connecting again
   - Check the full callback URL in browser address bar

## Common Fixes

### Fix 1: Update Redirect URI in Azure
1. Azure Portal → App Registration → Authentication
2. Remove old redirect URI
3. Add new one: `https://recall-recall-production.up.railway.app/oauth-callback/microsoft-outlook`
4. Save

### Fix 2: Verify Environment Variables
```bash
railway variables --set "MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID=your-id"
railway variables --set "MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET=your-secret"
```

### Fix 3: Redeploy
After changing environment variables or Azure settings:
```bash
railway up
```
