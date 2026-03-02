import {
  getMicrosoftSignInScopes,
  getMicrosoftAdminConsentUrl,
  getMicrosoftRedirectUri,
} from "../../logic/oauth.js";

/**
 * GET /api/debug/ms-oauth?tenant=optional-tenant-id
 * Returns the Microsoft OAuth scopes, redirect_uri, and admin consent URL.
 * Use to verify redirect_uri matches Azure (must be your callback URL, never the token endpoint).
 */
export default async (req, res) => {
  const tenant = req.query.tenant || "common";
  const signInScopes = getMicrosoftSignInScopes();
  const adminConsentUrl = getMicrosoftAdminConsentUrl(tenant);
  const redirect_uri = getMicrosoftRedirectUri();
  res.json({
    signInScopes,
    redirect_uri,
    PUBLIC_URL: process.env.PUBLIC_URL || "(not set)",
    adminConsentUrl,
    note: "redirect_uri must match Azure Web redirect URIs exactly. It must NOT be the token endpoint (login.microsoftonline.com/.../token). If you see AADSTS900561, remove the token URL from both Web and SPA redirect URIs in Azure.",
  });
};
