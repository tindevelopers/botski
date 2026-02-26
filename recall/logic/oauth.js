export function buildGoogleCalendarOAuthUrl(state) {
  const params = {
    client_id: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
    redirect_uri: process.env.PUBLIC_URL + "/oauth-callback/google-calendar",
    response_type: "code",
    scope: buildGoogleOAuthScopes().join(" "),
    access_type: "offline",
    prompt: "consent",
    state: JSON.stringify(state),
  };

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams(params).toString();

  return url.toString();
}

function buildGoogleOAuthScopes() {
  return process.env.REQUEST_ONLY_CALENDAR_SCOPES ? ["https://www.googleapis.com/auth/calendar.events.readonly"] : ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/calendar.events.readonly"];
}

/**
 * Base scopes for sign-in and calendar (no admin consent required).
 * Excludes OnlineMeetings.Read and recording scopes so non-admin users can connect.
 */
function getMicrosoftOutlookBaseScopes() {
  const base = [
    "offline_access",
    "User.Read",
    "https://graph.microsoft.com/Calendars.Read",
    "openid",
    "email",
  ];
  return process.env.REQUEST_ONLY_CALENDAR_SCOPES
    ? base.filter((s) => s !== "openid" && s !== "email")
    : base;
}

/**
 * Scopes that may require admin consent: Teams meetings + recording/transcript.
 * Request these only when the user explicitly enables "Teams recording" in Settings.
 */
function getMicrosoftOutlookRecordingScopes() {
  return [
    "OnlineMeetings.Read", // required for finding Teams meetings by joinWebUrl; can require admin consent
    "OnlineMeetingTranscript.Read.All",
    "OnlineMeetingRecording.Read.All",
  ];
}

function buildMicrosoftOutlookOAuthScopes(includeRecordingScopes = false) {
  const base = getMicrosoftOutlookBaseScopes();
  const recording = includeRecordingScopes ? getMicrosoftOutlookRecordingScopes() : [];
  return [...base, ...recording];
}

/**
 * Build Microsoft OAuth authorize URL.
 * @param {Object} state - { intent?, userId?, calendarId? }
 * @param {Object} [options] - { includeRecordingScopes: false } set true to request Teams recording/transcript (admin consent may be required)
 */
export function buildMicrosoftOutlookOAuthUrl(state, options = {}) {
  const includeRecordingScopes = options.includeRecordingScopes === true;
  const scopes = buildMicrosoftOutlookOAuthScopes(includeRecordingScopes);
  const scopeStr = scopes.join(" ");
  const params = {
    client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
    redirect_uri: process.env.PUBLIC_URL + "/oauth-callback/microsoft-outlook",
    response_type: "code",
    scope: scopeStr,
    prompt: "consent",
    state: JSON.stringify(state),
  };

  const url = new URL(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  );
  url.search = new URLSearchParams(params).toString();

  return url.toString();
}

/**
 * Build Microsoft OAuth URL that includes Teams recording/transcript scopes.
 * Use when user enables "Teams recording & transcript"; admin approval may be required in their tenant.
 */
export function buildMicrosoftOutlookOAuthUrlForRecording(state) {
  return buildMicrosoftOutlookOAuthUrl(state, { includeRecordingScopes: true });
}

/** Return scopes used for sign-in (for debugging deployment). */
export function getMicrosoftSignInScopes() {
  return buildMicrosoftOutlookOAuthScopes(false);
}

/**
 * URL for an org admin to grant consent so all users in their tenant can use the app.
 * @param {string} [tenantId] - Azure AD tenant ID (e.g. eurastechnology.com's). Default "common" lets admin pick tenant.
 */
export function getMicrosoftAdminConsentUrl(tenantId = "common") {
  const clientId = process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID;
  const redirectUri = encodeURIComponent(
    process.env.PUBLIC_URL + "/oauth-callback/microsoft-outlook"
  );
  return `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${clientId}&redirect_uri=${redirectUri}`;
}

export async function fetchTokensFromAuthorizationCodeForGoogleCalendar(code) {
  const params = {
    client_id: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET,
    redirect_uri: process.env.PUBLIC_URL + "/oauth-callback/google-calendar",
    grant_type: "authorization_code",
    code,
  };

  const url = new URL("https://oauth2.googleapis.com/token");
  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams(params),
  });

  return await response.json();
}

export async function fetchTokensFromAuthorizationCodeForMicrosoftOutlook(
  code
) {
  const params = {
    client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
    client_secret: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
    redirect_uri:
      process.env.PUBLIC_URL + "/oauth-callback/microsoft-outlook",
    grant_type: "authorization_code",
    code,
  };
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/token");
  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams(params),
  });
  return await response.json();
}

/**
 * Refresh Microsoft OAuth access token using refresh token
 * @param {string} refreshToken - OAuth refresh token
 * @returns {Promise<Object>} New token response with access_token, refresh_token, etc.
 */
export async function refreshMicrosoftOutlookToken(refreshToken) {
  const params = {
    client_id: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_ID,
    client_secret: process.env.MICROSOFT_OUTLOOK_OAUTH_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };
  const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/token");
  const response = await fetch(url.toString(), {
    method: "POST",
    body: new URLSearchParams(params),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Fetch Microsoft user profile (email, name) for sign-in flow.
 * @param {string} accessToken - Microsoft OAuth access token
 * @returns {Promise<{ email: string, name: string }>}
 */
export async function fetchMicrosoftUserProfile(accessToken) {
  // #region agent log
  fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'logic/oauth.js:fetchMicrosoftUserProfile',message:'graph_me_before',data:{tokenLength:accessToken?.length,hasToken:!!accessToken},timestamp:Date.now(),runId:'ms-graph-403',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/9df62f0f-78c1-44fb-821f-c3c7b9f764cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'logic/oauth.js:fetchMicrosoftUserProfile',message:'graph_me_error',data:{status:response.status,bodyPreview:(text||'').slice(0,300)},timestamp:Date.now(),runId:'ms-graph-403',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    throw new Error(`Microsoft Graph /me failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  const email = data.mail || data.userPrincipalName || data.id;
  const name = data.displayName || email?.split("@")[0] || "User";
  return { email: (email || "").toLowerCase(), name: name || "User" };
}
